import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { stripe } from "@/lib/stripe"
import { db } from "@/db"
import {
  tenantUnits,
  units,
  autopayEnrollments,
} from "@/db/schema/domain"
import { user } from "@/db/schema/auth"
import { eq, and } from "drizzle-orm"
import { z } from "zod"
import { sendNotification } from "@/lib/notifications"

const bodySchema = z.object({
  setupIntentId: z.string().min(1),
})

function calculateNextChargeDate(rentDueDay: number | null): string {
  const now = new Date()
  const day = rentDueDay ?? 1
  const year = now.getFullYear()
  const month = now.getMonth() // 0-indexed

  // If the due day hasn't passed this month, use this month; otherwise next month
  if (now.getDate() <= day) {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
  }
  // Next month
  const nextMonth = month + 1
  if (nextMonth > 11) {
    return `${year + 1}-01-${String(day).padStart(2, "0")}`
  }
  return `${year}-${String(nextMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  // Retrieve SetupIntent from Stripe
  const setupIntent = await stripe.setupIntents.retrieve(parsed.data.setupIntentId)

  if (setupIntent.status !== "succeeded") {
    return NextResponse.json(
      { error: "SetupIntent not completed", status: setupIntent.status },
      { status: 400 }
    )
  }

  if (!setupIntent.payment_method || typeof setupIntent.payment_method !== "string") {
    return NextResponse.json(
      { error: "No payment method found on SetupIntent" },
      { status: 400 }
    )
  }

  // Get tenant's active unit link
  const [link] = await db
    .select()
    .from(tenantUnits)
    .where(
      and(
        eq(tenantUnits.userId, session.user.id),
        eq(tenantUnits.isActive, true)
      )
    )

  if (!link) {
    return NextResponse.json({ error: "No active unit found" }, { status: 400 })
  }

  // Get unit details for next charge date
  const [unit] = await db
    .select()
    .from(units)
    .where(eq(units.id, link.unitId))

  // Retrieve PaymentMethod details
  const paymentMethod = await stripe.paymentMethods.retrieve(
    setupIntent.payment_method
  )

  let pmType: "card" | "us_bank_account"
  let last4: string
  let brand: string | null = null

  if (paymentMethod.type === "card" && paymentMethod.card) {
    pmType = "card"
    last4 = paymentMethod.card.last4
    brand = paymentMethod.card.brand
  } else if (
    paymentMethod.type === "us_bank_account" &&
    paymentMethod.us_bank_account
  ) {
    pmType = "us_bank_account"
    last4 = paymentMethod.us_bank_account.last4 ?? "0000"
    brand = null
  } else {
    return NextResponse.json(
      { error: "Unsupported payment method type" },
      { status: 400 }
    )
  }

  const nextChargeDateStr = calculateNextChargeDate(unit?.rentDueDay ?? null)
  const customerId =
    typeof setupIntent.customer === "string"
      ? setupIntent.customer
      : setupIntent.customer?.id ?? ""

  // Upsert enrollment
  await db
    .insert(autopayEnrollments)
    .values({
      tenantUserId: session.user.id,
      unitId: link.unitId,
      stripeCustomerId: customerId,
      stripePaymentMethodId: setupIntent.payment_method,
      paymentMethodType: pmType,
      paymentMethodLast4: last4,
      paymentMethodBrand: brand,
      status: "active",
      enrolledAt: new Date(),
      cancelledAt: null,
      nextChargeDate: nextChargeDateStr,
    })
    .onConflictDoUpdate({
      target: autopayEnrollments.tenantUserId,
      set: {
        unitId: link.unitId,
        stripeCustomerId: customerId,
        stripePaymentMethodId: setupIntent.payment_method,
        paymentMethodType: pmType,
        paymentMethodLast4: last4,
        paymentMethodBrand: brand,
        status: "active",
        enrolledAt: new Date(),
        cancelledAt: null,
        nextChargeDate: nextChargeDateStr,
        updatedAt: new Date(),
      },
    })

  // Notify admin users (in-app only)
  const adminUsers = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.role, "admin"))

  for (const admin of adminUsers) {
    void sendNotification({
      userId: admin.id,
      type: "system",
      title: "Autopay Enrollment",
      body: `Tenant ${session.user.name} enrolled in autopay for Unit ${unit?.unitNumber ?? "unknown"}`,
      channels: ["in_app"],
    })
  }

  return NextResponse.json({
    success: true,
    enrollment: {
      paymentMethodType: pmType,
      paymentMethodLast4: last4,
      paymentMethodBrand: brand,
      nextChargeDate: nextChargeDateStr,
    },
  })
}
