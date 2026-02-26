import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { stripe } from "@/lib/stripe"
import { db } from "@/db"
import { autopayEnrollments, tenantUnits, units } from "@/db/schema/domain"
import { user } from "@/db/schema/auth"
import { eq, and, or } from "drizzle-orm"
import { sendNotification } from "@/lib/notifications"

function calculateNextChargeDate(rentDueDay: number | null): string {
  const now = new Date()
  const day = rentDueDay ?? 1
  const year = now.getFullYear()
  const month = now.getMonth() // 0-indexed

  if (now.getDate() <= day) {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
  }
  const nextMonth = month + 1
  if (nextMonth > 11) {
    return `${year + 1}-01-${String(day).padStart(2, "0")}`
  }
  return `${year}-${String(nextMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Find existing cancelled or payment_failed enrollment
  const [enrollment] = await db
    .select()
    .from(autopayEnrollments)
    .where(
      and(
        eq(autopayEnrollments.tenantUserId, session.user.id),
        or(
          eq(autopayEnrollments.status, "cancelled"),
          eq(autopayEnrollments.status, "payment_failed")
        )
      )
    )

  if (!enrollment || !enrollment.stripePaymentMethodId) {
    return NextResponse.json(
      {
        error: "No previous enrollment found. Please complete full enrollment.",
        requiresFullEnrollment: true,
      },
      { status: 404 }
    )
  }

  // Verify saved payment method still exists on Stripe
  try {
    await stripe.paymentMethods.retrieve(enrollment.stripePaymentMethodId)
  } catch {
    return NextResponse.json(
      {
        error:
          "Saved payment method is no longer valid. Please complete full enrollment.",
        requiresFullEnrollment: true,
      },
      { status: 400 }
    )
  }

  // Get unit for next charge date
  const [link] = await db
    .select()
    .from(tenantUnits)
    .where(
      and(
        eq(tenantUnits.userId, session.user.id),
        eq(tenantUnits.isActive, true)
      )
    )

  let rentDueDay: number | null = null
  let unitNumber = "unknown"
  if (link) {
    const [unit] = await db
      .select()
      .from(units)
      .where(eq(units.id, link.unitId))
    rentDueDay = unit?.rentDueDay ?? null
    unitNumber = unit?.unitNumber ?? "unknown"
  }

  const nextChargeDateStr = calculateNextChargeDate(rentDueDay)

  // Re-activate enrollment
  await db
    .update(autopayEnrollments)
    .set({
      status: "active",
      cancelledAt: null,
      enrolledAt: new Date(),
      nextChargeDate: nextChargeDateStr,
      updatedAt: new Date(),
    })
    .where(eq(autopayEnrollments.id, enrollment.id))

  // Notify admin users (in-app only)
  const adminUsers = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.role, "admin"))

  for (const admin of adminUsers) {
    void sendNotification({
      userId: admin.id,
      type: "system",
      title: "Autopay Re-enrolled",
      body: `Tenant ${session.user.name} re-enrolled in autopay for Unit ${unitNumber}`,
      channels: ["in_app"],
    })
  }

  return NextResponse.json({ success: true })
}
