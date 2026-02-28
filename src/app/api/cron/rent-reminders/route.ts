import { NextResponse } from "next/server"
import { db } from "@/db"
import { tenantUnits, units, payments, notifications, autopayEnrollments, properties } from "@/db/schema/domain"
import { user } from "@/db/schema/auth"
import { eq, and, sql } from "drizzle-orm"
import { sendNotification } from "@/lib/notifications"
import { renderRentReminderEmail } from "@/emails/RentReminderEmail"
import { getLocalDate, getLocalBillingPeriod } from "@/lib/timezone"

type ReminderType = "upcoming" | "due_today" | "overdue_1" | "overdue_3" | "overdue_7"

function getReminderType(daysUntilDue: number): ReminderType | null {
  if (daysUntilDue >= 3 && daysUntilDue <= 5) return "upcoming"
  if (daysUntilDue === 0) return "due_today"
  if (daysUntilDue === -1) return "overdue_1"
  if (daysUntilDue === -3) return "overdue_3"
  if (daysUntilDue === -7) return "overdue_7"
  return null
}

function getReminderTitle(reminderType: ReminderType, period: string): string {
  return `Rent Reminder: ${reminderType} - ${period}`
}

function getReminderBody(
  reminderType: ReminderType,
  rentAmount: string,
  unitNumber: string
): string {
  switch (reminderType) {
    case "upcoming":
      return `Your rent of ${rentAmount} for Unit ${unitNumber} is due in a few days.`
    case "due_today":
      return `Your rent of ${rentAmount} for Unit ${unitNumber} is due today.`
    case "overdue_1":
      return `Your rent of ${rentAmount} for Unit ${unitNumber} was due yesterday. Please submit payment.`
    case "overdue_3":
      return `Your rent of ${rentAmount} for Unit ${unitNumber} is 3 days past due. Please pay as soon as possible.`
    case "overdue_7":
      return `Your rent of ${rentAmount} for Unit ${unitNumber} is 7 days past due. Immediate attention required.`
  }
}

export async function POST(req: Request) {
  // Validate CRON_SECRET bearer token
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Query all active tenant-unit links with unit details and property timezone
  const activeLinks = await db
    .select({
      userId: tenantUnits.userId,
      unitId: tenantUnits.unitId,
      unitNumber: units.unitNumber,
      rentAmountCents: units.rentAmountCents,
      rentDueDay: units.rentDueDay,
      propertyTimezone: properties.timezone,
    })
    .from(tenantUnits)
    .innerJoin(units, eq(units.id, tenantUnits.unitId))
    .innerJoin(properties, eq(properties.id, units.propertyId))
    .where(eq(tenantUnits.isActive, true))

  let sent = 0
  let skipped = 0
  let errors = 0

  for (const link of activeLinks) {
    try {
      // Skip units without rent configuration
      if (!link.rentDueDay || !link.rentAmountCents) {
        skipped++
        continue
      }

      // Skip tenants with active autopay — they get pre-charge notifications instead
      const [autopayActive] = await db
        .select({ id: autopayEnrollments.id })
        .from(autopayEnrollments)
        .where(
          and(
            eq(autopayEnrollments.tenantUserId, link.userId),
            eq(autopayEnrollments.status, "active"),
          )
        )
        .limit(1)

      if (autopayActive) {
        skipped++
        continue
      }

      // Use property-local timezone for date calculations
      const localDate = getLocalDate(link.propertyTimezone)
      const currentDay = localDate.day
      const currentPeriod = getLocalBillingPeriod(link.propertyTimezone)
      const startOfToday = new Date(localDate.year, localDate.month - 1, localDate.day)

      const daysUntilDue = link.rentDueDay - currentDay
      const reminderType = getReminderType(daysUntilDue)

      if (!reminderType) {
        skipped++
        continue
      }

      // Idempotency check: has this exact reminder been sent today?
      const title = getReminderTitle(reminderType, currentPeriod)
      const [existing] = await db
        .select({ id: notifications.id })
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, link.userId),
            eq(notifications.type, "rent_reminder"),
            eq(notifications.title, title),
            sql`${notifications.createdAt} >= ${startOfToday}`
          )
        )
        .limit(1)

      if (existing) {
        skipped++
        continue
      }

      // Payment check: has tenant already paid for this period?
      const [paid] = await db
        .select({ id: payments.id })
        .from(payments)
        .where(
          and(
            eq(payments.tenantUserId, link.userId),
            eq(payments.unitId, link.unitId),
            eq(payments.billingPeriod, currentPeriod),
            eq(payments.status, "succeeded")
          )
        )
        .limit(1)

      if (paid) {
        skipped++
        continue
      }

      // Get tenant name for email
      const [tenant] = await db
        .select({ name: user.name })
        .from(user)
        .where(eq(user.id, link.userId))
        .limit(1)

      const rentAmount = `$${(link.rentAmountCents / 100).toFixed(2)}`
      const body = getReminderBody(reminderType, rentAmount, link.unitNumber)

      // Render email template
      const emailHtml = await renderRentReminderEmail({
        tenantName: tenant?.name ?? "Tenant",
        unitNumber: link.unitNumber,
        rentAmount,
        reminderType,
        dueDay: link.rentDueDay,
      })

      // Send notification via all channels (SMS gated by sendNotification internally)
      await sendNotification({
        userId: link.userId,
        type: "rent_reminder",
        title,
        body,
        emailHtml,
        channels: ["in_app", "email", "sms"],
      })

      sent++
    } catch (err) {
      console.error(`Rent reminder error for user ${link.userId}:`, err)
      errors++
    }
  }

  return NextResponse.json({ sent, skipped, errors })
}
