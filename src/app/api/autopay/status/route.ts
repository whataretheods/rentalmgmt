import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { db } from "@/db"
import { autopayEnrollments, tenantUnits, units } from "@/db/schema/domain"
import { eq, and } from "drizzle-orm"
import { calculateCardFee, calculateAchFee, formatCents } from "@/lib/autopay-fees"

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [enrollment] = await db
    .select()
    .from(autopayEnrollments)
    .where(eq(autopayEnrollments.tenantUserId, session.user.id))

  if (!enrollment) {
    // Get rent amount for fee estimates even when not enrolled
    const [link] = await db
      .select()
      .from(tenantUnits)
      .where(
        and(
          eq(tenantUnits.userId, session.user.id),
          eq(tenantUnits.isActive, true)
        )
      )

    let rentAmountCents = 0
    if (link) {
      const [unit] = await db
        .select()
        .from(units)
        .where(eq(units.id, link.unitId))
      rentAmountCents = unit?.rentAmountCents ?? 0
    }

    return NextResponse.json({
      enrolled: false,
      feeEstimates: rentAmountCents > 0
        ? {
            rentAmountCents,
            cardFee: calculateCardFee(rentAmountCents),
            achFee: calculateAchFee(rentAmountCents),
            cardTotal: formatCents(rentAmountCents + calculateCardFee(rentAmountCents)),
            achTotal: formatCents(rentAmountCents + calculateAchFee(rentAmountCents)),
          }
        : null,
    })
  }

  // Get rent amount for fee estimates
  const [link] = await db
    .select()
    .from(tenantUnits)
    .where(
      and(
        eq(tenantUnits.userId, session.user.id),
        eq(tenantUnits.isActive, true)
      )
    )

  let rentAmountCents = 0
  if (link) {
    const [unit] = await db
      .select()
      .from(units)
      .where(eq(units.id, link.unitId))
    rentAmountCents = unit?.rentAmountCents ?? 0
  }

  const fee =
    enrollment.paymentMethodType === "card"
      ? calculateCardFee(rentAmountCents)
      : calculateAchFee(rentAmountCents)

  return NextResponse.json({
    enrolled: true,
    status: enrollment.status,
    paymentMethodType: enrollment.paymentMethodType,
    paymentMethodLast4: enrollment.paymentMethodLast4,
    paymentMethodBrand: enrollment.paymentMethodBrand,
    nextChargeDate: enrollment.nextChargeDate,
    enrolledAt: enrollment.enrolledAt,
    cancelledAt: enrollment.cancelledAt,
    feeEstimates:
      rentAmountCents > 0
        ? {
            rentAmountCents,
            currentFee: fee,
            currentTotal: formatCents(rentAmountCents + fee),
            cardFee: calculateCardFee(rentAmountCents),
            achFee: calculateAchFee(rentAmountCents),
            cardTotal: formatCents(
              rentAmountCents + calculateCardFee(rentAmountCents)
            ),
            achTotal: formatCents(
              rentAmountCents + calculateAchFee(rentAmountCents)
            ),
          }
        : null,
  })
}
