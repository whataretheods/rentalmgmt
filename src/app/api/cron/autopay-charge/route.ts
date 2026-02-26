import { NextResponse } from "next/server"
import { db } from "@/db"
import { autopayEnrollments, units, payments } from "@/db/schema/domain"
import { user } from "@/db/schema/auth"
import { eq, and } from "drizzle-orm"
import { stripe } from "@/lib/stripe"
import { calculateCardFee, calculateAchFee, formatCents } from "@/lib/autopay-fees"
import { sendNotification } from "@/lib/notifications"

export async function POST(req: Request) {
  // Validate CRON_SECRET bearer token
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const today = new Date()
  const currentDay = today.getDate()
  const currentPeriod = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`

  // Query all active autopay enrollments joined with units
  const enrollments = await db
    .select({
      enrollmentId: autopayEnrollments.id,
      tenantUserId: autopayEnrollments.tenantUserId,
      unitId: autopayEnrollments.unitId,
      stripeCustomerId: autopayEnrollments.stripeCustomerId,
      stripePaymentMethodId: autopayEnrollments.stripePaymentMethodId,
      paymentMethodType: autopayEnrollments.paymentMethodType,
      status: autopayEnrollments.status,
      unitNumber: units.unitNumber,
      rentAmountCents: units.rentAmountCents,
      rentDueDay: units.rentDueDay,
    })
    .from(autopayEnrollments)
    .innerJoin(units, eq(units.id, autopayEnrollments.unitId))
    .where(eq(autopayEnrollments.status, "active"))

  let charged = 0
  let skipped = 0
  let failed = 0
  let errors = 0

  for (const enrollment of enrollments) {
    // Hoist isRetryDay so it's accessible in catch block
    let isRetryDay = false
    try {
      // Skip units without rent configuration
      if (!enrollment.rentAmountCents || !enrollment.rentDueDay) {
        skipped++
        continue
      }

      const isDueDay = currentDay === enrollment.rentDueDay
      isRetryDay = currentDay === enrollment.rentDueDay + 2

      // Only process on due day or retry day (due day + 2)
      if (!isDueDay && !isRetryDay) {
        skipped++
        continue
      }

      // Auto-skip if already paid for this period
      const [alreadyPaid] = await db
        .select({ id: payments.id })
        .from(payments)
        .where(
          and(
            eq(payments.tenantUserId, enrollment.tenantUserId),
            eq(payments.unitId, enrollment.unitId),
            eq(payments.billingPeriod, currentPeriod),
            eq(payments.status, "succeeded")
          )
        )
        .limit(1)

      if (alreadyPaid) {
        skipped++
        continue
      }

      // On retry day, check if there's actually a failed autopay payment to retry
      if (isRetryDay) {
        const [failedPayment] = await db
          .select({ id: payments.id })
          .from(payments)
          .where(
            and(
              eq(payments.tenantUserId, enrollment.tenantUserId),
              eq(payments.unitId, enrollment.unitId),
              eq(payments.billingPeriod, currentPeriod),
              eq(payments.status, "failed")
            )
          )
          .limit(1)

        if (!failedPayment) {
          skipped++
          continue
        }
      }

      // Calculate total with fees
      const feeCents = enrollment.paymentMethodType === "card"
        ? calculateCardFee(enrollment.rentAmountCents)
        : calculateAchFee(enrollment.rentAmountCents)
      const totalCents = enrollment.rentAmountCents + feeCents

      // Idempotency key to prevent duplicate charges
      const idempotencyKey = isRetryDay
        ? `autopay-retry-${enrollment.tenantUserId}-${currentPeriod}`
        : `autopay-${enrollment.tenantUserId}-${currentPeriod}`

      // Create off-session PaymentIntent
      const paymentIntent = await stripe.paymentIntents.create(
        {
          amount: totalCents,
          currency: "usd",
          customer: enrollment.stripeCustomerId,
          payment_method: enrollment.stripePaymentMethodId,
          off_session: true,
          confirm: true,
          metadata: {
            tenantUserId: enrollment.tenantUserId,
            unitId: enrollment.unitId,
            billingPeriod: currentPeriod,
            autopay: "true",
            feeCents: String(feeCents),
          },
        },
        { idempotencyKey }
      )

      if (paymentIntent.status === "succeeded") {
        // Insert payment record
        await db.insert(payments).values({
          tenantUserId: enrollment.tenantUserId,
          unitId: enrollment.unitId,
          amountCents: totalCents,
          stripePaymentIntentId: paymentIntent.id,
          paymentMethod: enrollment.paymentMethodType === "card" ? "card" : "ach",
          status: "succeeded",
          billingPeriod: currentPeriod,
          note: `Autopay${isRetryDay ? " (retry)" : ""}`,
          paidAt: new Date(),
        })

        // Update enrollment
        const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, enrollment.rentDueDay)
        await db
          .update(autopayEnrollments)
          .set({
            lastChargeAt: new Date(),
            nextChargeDate: nextMonth.toISOString().split("T")[0],
            updatedAt: new Date(),
          })
          .where(eq(autopayEnrollments.id, enrollment.enrollmentId))

        charged++
      } else {
        // Payment requires action or failed — treat as failure for off-session
        await handleChargeFailure(enrollment, currentPeriod, totalCents, paymentIntent.id, isRetryDay)
        failed++
      }
    } catch (err: unknown) {
      // Stripe errors (e.g., card_declined) throw exceptions for off-session payments
      const stripeError = err as { type?: string; code?: string }
      if (stripeError.type === "StripeCardError" || stripeError.code) {
        try {
          await handleChargeFailure(enrollment, currentPeriod, enrollment.rentAmountCents ?? 0, null, isRetryDay)
          failed++
        } catch (innerErr) {
          console.error(`Error handling charge failure for user ${enrollment.tenantUserId}:`, innerErr)
          errors++
        }
      } else {
        console.error(`Autopay charge error for user ${enrollment.tenantUserId}:`, err)
        errors++
      }
    }
  }

  return NextResponse.json({ charged, skipped, failed, errors })
}

async function handleChargeFailure(
  enrollment: {
    enrollmentId: string
    tenantUserId: string
    unitId: string
    unitNumber: string
    rentAmountCents: number | null
  },
  billingPeriod: string,
  totalCents: number,
  paymentIntentId: string | null,
  isRetry: boolean
) {
  // Insert failed payment record
  await db.insert(payments).values({
    tenantUserId: enrollment.tenantUserId,
    unitId: enrollment.unitId,
    amountCents: totalCents,
    stripePaymentIntentId: paymentIntentId,
    paymentMethod: "card", // will be overridden by actual type via webhook
    status: "failed",
    billingPeriod,
    note: `Autopay charge failed${isRetry ? " (retry)" : ""}`,
  })

  if (isRetry) {
    // Second failure: mark enrollment as payment_failed and notify admin + tenant
    await db
      .update(autopayEnrollments)
      .set({ status: "payment_failed", updatedAt: new Date() })
      .where(eq(autopayEnrollments.id, enrollment.enrollmentId))

    // Get tenant name for admin notification
    const [tenant] = await db
      .select({ name: user.name })
      .from(user)
      .where(eq(user.id, enrollment.tenantUserId))
      .limit(1)

    const tenantName = tenant?.name ?? "Unknown Tenant"

    // Notify admin (in-app only) — find admin users
    const adminUsers = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.role, "admin"))

    for (const admin of adminUsers) {
      await sendNotification({
        userId: admin.id,
        type: "system",
        title: "Autopay charge failed twice",
        body: `Autopay charge failed twice for ${tenantName}, Unit ${enrollment.unitNumber}. Enrollment has been paused.`,
        channels: ["in_app"],
      })
    }

    // Notify tenant: autopay paused
    await sendNotification({
      userId: enrollment.tenantUserId,
      type: "system",
      title: "Autopay paused due to payment failure",
      body: `Your autopay has been paused due to payment failure. Please update your payment method or pay manually for Unit ${enrollment.unitNumber}.`,
      channels: ["in_app", "email"],
    })
  } else {
    // First failure: notify tenant only
    await sendNotification({
      userId: enrollment.tenantUserId,
      type: "system",
      title: "Autopay charge failed",
      body: `Your autopay charge for Unit ${enrollment.unitNumber} failed. We'll retry in 2 days. You can also pay manually.`,
      channels: ["in_app", "email"],
    })
  }
}
