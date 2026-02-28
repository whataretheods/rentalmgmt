import { NextResponse } from "next/server"
import { db } from "@/db"
import { autopayEnrollments, units, notifications, properties } from "@/db/schema/domain"
import { user } from "@/db/schema/auth"
import { eq, and, sql } from "drizzle-orm"
import { sendNotification } from "@/lib/notifications"
import { calculateCardFee, calculateAchFee, formatCents, getPaymentMethodLabel } from "@/lib/autopay-fees"
import { renderAutopayChargeEmail } from "@/emails/AutopayChargeEmail"
import { getLocalDate } from "@/lib/timezone"

export async function POST(req: Request) {
  // Validate CRON_SECRET bearer token
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Query all active autopay enrollments joined with units and properties for timezone
  const enrollments = await db
    .select({
      tenantUserId: autopayEnrollments.tenantUserId,
      unitId: autopayEnrollments.unitId,
      paymentMethodType: autopayEnrollments.paymentMethodType,
      paymentMethodLast4: autopayEnrollments.paymentMethodLast4,
      paymentMethodBrand: autopayEnrollments.paymentMethodBrand,
      unitNumber: units.unitNumber,
      rentAmountCents: units.rentAmountCents,
      rentDueDay: units.rentDueDay,
      propertyTimezone: properties.timezone,
    })
    .from(autopayEnrollments)
    .innerJoin(units, eq(units.id, autopayEnrollments.unitId))
    .innerJoin(properties, eq(properties.id, units.propertyId))
    .where(eq(autopayEnrollments.status, "active"))

  let notified = 0
  let skipped = 0
  let errors = 0

  for (const enrollment of enrollments) {
    try {
      // Skip units without rent configuration
      if (!enrollment.rentAmountCents || !enrollment.rentDueDay) {
        skipped++
        continue
      }

      // Use property-local timezone for date calculations
      const localDate = getLocalDate(enrollment.propertyTimezone)
      const currentDay = localDate.day
      const startOfToday = new Date(localDate.year, localDate.month - 1, localDate.day)

      // Only notify exactly 3 days before due date
      const daysUntilDue = enrollment.rentDueDay - currentDay
      if (daysUntilDue !== 3) {
        skipped++
        continue
      }

      // Idempotency: check if notification already sent today for this user
      const [existing] = await db
        .select({ id: notifications.id })
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, enrollment.tenantUserId),
            eq(notifications.type, "system"),
            sql`${notifications.title} LIKE '%Autopay charge%'`,
            sql`${notifications.createdAt} >= ${startOfToday}`
          )
        )
        .limit(1)

      if (existing) {
        skipped++
        continue
      }

      // Calculate fee based on payment method type
      const feeCents = enrollment.paymentMethodType === "card"
        ? calculateCardFee(enrollment.rentAmountCents)
        : calculateAchFee(enrollment.rentAmountCents)
      const totalCents = enrollment.rentAmountCents + feeCents

      const rentAmount = formatCents(enrollment.rentAmountCents)
      const feeAmount = formatCents(feeCents)
      const totalAmount = formatCents(totalCents)

      // Calculate charge date using property-local time
      const chargeDate = new Date(localDate.year, localDate.month - 1, enrollment.rentDueDay)
      const chargeDateStr = chargeDate.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })

      const paymentMethodLabel = getPaymentMethodLabel(
        enrollment.paymentMethodType,
        enrollment.paymentMethodBrand,
        enrollment.paymentMethodLast4
      )

      // Get tenant name for email
      const [tenant] = await db
        .select({ name: user.name })
        .from(user)
        .where(eq(user.id, enrollment.tenantUserId))
        .limit(1)

      // Render email template
      const emailHtml = await renderAutopayChargeEmail({
        tenantName: tenant?.name ?? "Tenant",
        unitNumber: enrollment.unitNumber,
        rentAmount,
        feeAmount,
        totalAmount,
        chargeDate: chargeDateStr,
        paymentMethodLabel,
      })

      // Send notification via all channels
      await sendNotification({
        userId: enrollment.tenantUserId,
        type: "system",
        title: "Autopay charge in 3 days",
        body: `Your autopay charge of ${totalAmount} (${rentAmount} + ${feeAmount} fee) for Unit ${enrollment.unitNumber} will process on ${chargeDateStr}.`,
        emailHtml,
        channels: ["in_app", "email", "sms"],
      })

      notified++
    } catch (err) {
      console.error(`Autopay notify error for user ${enrollment.tenantUserId}:`, err)
      errors++
    }
  }

  return NextResponse.json({ notified, skipped, errors })
}
