import { NextResponse } from "next/server"
import { db } from "@/db"
import {
  properties,
  lateFeeRules,
  units,
  tenantUnits,
  payments,
  charges,
} from "@/db/schema/domain"
import { user } from "@/db/schema/auth"
import { eq, and, inArray } from "drizzle-orm"
import { getLocalDate, getLocalBillingPeriod, daysSinceRentDue } from "@/lib/timezone"
import { calculateLateFee, formatCentsAsDollars } from "@/lib/late-fees"
import { sendNotification } from "@/lib/notifications"
import { renderLateFeeEmail } from "@/emails/LateFeeEmail"

export async function POST(req: Request) {
  // Validate CRON_SECRET bearer token
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Query all properties with enabled late fee rules
  const propertiesWithRules = await db
    .select({
      propertyId: properties.id,
      timezone: properties.timezone,
      ruleId: lateFeeRules.id,
      gracePeriodDays: lateFeeRules.gracePeriodDays,
      feeType: lateFeeRules.feeType,
      feeAmountCents: lateFeeRules.feeAmountCents,
      maxFeeAmountCents: lateFeeRules.maxFeeAmountCents,
    })
    .from(properties)
    .innerJoin(lateFeeRules, eq(lateFeeRules.propertyId, properties.id))
    .where(eq(lateFeeRules.enabled, true))

  let assessed = 0
  let skipped = 0
  let errors = 0

  for (const prop of propertiesWithRules) {
    try {
      // Get property-local date and billing period
      const localDate = getLocalDate(prop.timezone)
      const currentPeriod = getLocalBillingPeriod(prop.timezone)

      // Get all active tenant-unit links for this property
      const activeLinks = await db
        .select({
          userId: tenantUnits.userId,
          unitId: tenantUnits.unitId,
          unitNumber: units.unitNumber,
          rentAmountCents: units.rentAmountCents,
          rentDueDay: units.rentDueDay,
        })
        .from(tenantUnits)
        .innerJoin(units, eq(units.id, tenantUnits.unitId))
        .where(
          and(
            eq(units.propertyId, prop.propertyId),
            eq(tenantUnits.isActive, true)
          )
        )

      for (const link of activeLinks) {
        try {
          // Skip units without rent configuration
          if (!link.rentDueDay || !link.rentAmountCents) {
            skipped++
            continue
          }

          // Calculate days since rent was due
          const daysSince = daysSinceRentDue(link.rentDueDay, prop.timezone)

          // Skip if within grace period (or rent not yet due)
          if (daysSince <= prop.gracePeriodDays) {
            skipped++
            continue
          }

          // Check if rent is already paid (succeeded) for this billing period
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

          // Check for pending ACH payment — do not assess late fee if payment is pending
          const [pendingPayment] = await db
            .select({ id: payments.id })
            .from(payments)
            .where(
              and(
                eq(payments.tenantUserId, link.userId),
                eq(payments.unitId, link.unitId),
                eq(payments.billingPeriod, currentPeriod),
                eq(payments.status, "pending")
              )
            )
            .limit(1)

          if (pendingPayment) {
            skipped++
            continue
          }

          // Idempotency check: has a late fee already been posted for this tenant + unit + period?
          const [existingLateFee] = await db
            .select({ id: charges.id })
            .from(charges)
            .where(
              and(
                eq(charges.tenantUserId, link.userId),
                eq(charges.unitId, link.unitId),
                eq(charges.billingPeriod, currentPeriod),
                eq(charges.type, "late_fee")
              )
            )
            .limit(1)

          if (existingLateFee) {
            skipped++
            continue
          }

          // Calculate the late fee
          const feeAmountCents = calculateLateFee(link.rentAmountCents, {
            feeType: prop.feeType as "flat" | "percentage",
            feeAmountCents: prop.feeAmountCents,
            maxFeeAmountCents: prop.maxFeeAmountCents,
          })

          // Post late fee charge to ledger
          await db.insert(charges).values({
            tenantUserId: link.userId,
            unitId: link.unitId,
            type: "late_fee",
            description: `Late fee for ${currentPeriod}`,
            amountCents: feeAmountCents,
            billingPeriod: currentPeriod,
            createdBy: null, // system-generated
          })

          // Get tenant name for notification
          const [tenant] = await db
            .select({ name: user.name })
            .from(user)
            .where(eq(user.id, link.userId))
            .limit(1)

          const tenantName = tenant?.name ?? "Tenant"
          const feeFormatted = formatCentsAsDollars(feeAmountCents)
          const rentFormatted = formatCentsAsDollars(link.rentAmountCents)

          // Render email template
          let emailHtml: string | undefined
          try {
            emailHtml = await renderLateFeeEmail({
              tenantName,
              unitNumber: link.unitNumber,
              feeAmount: feeFormatted,
              rentAmount: rentFormatted,
              billingPeriod: currentPeriod,
              gracePeriodDays: prop.gracePeriodDays,
            })
          } catch (emailErr) {
            console.error(`Late fee email render error for user ${link.userId}:`, emailErr)
          }

          // Send notification via all channels
          // Notification errors should not prevent the fee from being posted
          try {
            await sendNotification({
              userId: link.userId,
              type: "system",
              title: `Late Fee Posted — Unit ${link.unitNumber}`,
              body: `A late fee of ${feeFormatted} has been posted to your account for Unit ${link.unitNumber}. Your rent for ${currentPeriod} was not received within the ${prop.gracePeriodDays}-day grace period.`,
              emailHtml,
              channels: ["in_app", "email", "sms"],
            })
          } catch (notifErr) {
            console.error(`Late fee notification error for user ${link.userId}:`, notifErr)
          }

          assessed++
        } catch (tenantErr) {
          console.error(`Late fee error for user ${link.userId}, unit ${link.unitId}:`, tenantErr)
          errors++
        }
      }
    } catch (propErr) {
      console.error(`Late fee error for property ${prop.propertyId}:`, propErr)
      errors++
    }
  }

  return NextResponse.json({ assessed, skipped, errors })
}
