import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { db } from "@/db"
import { payments, tenantUnits } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { z } from "zod"

const manualPaymentSchema = z.object({
  unitId: z.string().uuid(),
  amountCents: z.number().int().min(1).max(10000000),
  paymentMethod: z.enum(["cash", "check", "venmo", "other"]),
  billingPeriod: z.string().regex(/^\d{4}-\d{2}$/), // "2026-03"
  note: z.string().max(500).optional(),
})

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const parsed = manualPaymentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  // Find the active tenant for this unit
  const [link] = await db
    .select()
    .from(tenantUnits)
    .where(
      and(
        eq(tenantUnits.unitId, parsed.data.unitId),
        eq(tenantUnits.isActive, true)
      )
    )

  if (!link) {
    return NextResponse.json(
      { error: "No active tenant for this unit" },
      { status: 400 }
    )
  }

  // Create manual payment record
  const [payment] = await db
    .insert(payments)
    .values({
      tenantUserId: link.userId,
      unitId: parsed.data.unitId,
      amountCents: parsed.data.amountCents,
      paymentMethod: parsed.data.paymentMethod,
      status: "succeeded", // manual payments are immediately confirmed
      billingPeriod: parsed.data.billingPeriod,
      note: parsed.data.note || null,
      paidAt: new Date(),
    })
    .returning()

  return NextResponse.json({ payment })
}
