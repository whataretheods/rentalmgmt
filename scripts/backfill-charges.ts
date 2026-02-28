/**
 * Backfill Charges Migration Script
 *
 * Creates rent charge records for all historical payments (succeeded/pending)
 * so that balance computation (charges - payments) is accurate.
 *
 * Without this, tenants with v1.0 payments would show $0.00 balance because
 * there were no corresponding charge records.
 *
 * Usage:
 *   npm run backfill:charges -- --dry-run   # Preview what would be created
 *   npm run backfill:charges                # Execute the backfill
 *
 * Idempotent: Safe to run multiple times — dedup check prevents duplicates.
 *
 * Requires in .env.local:
 *   DATABASE_URL=...
 */
import { config } from "dotenv"
config({ path: ".env.local" })

import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import * as schema from "../src/db/schema"
import { eq, inArray, sql } from "drizzle-orm"

const { payments, charges, units } = schema

// Create a standalone DB connection (not the lazy-proxy from src/db/index.ts)
const sqlClient = neon(process.env.DATABASE_URL!)
const db = drizzle({ client: sqlClient, schema })

const isDryRun = process.argv.includes("--dry-run")

async function backfill() {
  console.log(`\n=== Charge Backfill Migration ${isDryRun ? "(DRY RUN)" : ""} ===\n`)

  // 1. Count existing state
  const [paymentCount] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(payments)
    .where(inArray(payments.status, ["succeeded", "pending"]))
  const [chargeCount] = await db.select({ count: sql<number>`COUNT(*)` }).from(charges)

  console.log(`Existing payments (succeeded/pending): ${paymentCount.count}`)
  console.log(`Existing charges: ${chargeCount.count}`)

  // 2. Get all succeeded/pending payments
  const historicalPayments = await db
    .select()
    .from(payments)
    .where(inArray(payments.status, ["succeeded", "pending"]))
    .orderBy(payments.createdAt)

  // 3. Get unit rent amounts for charge amount determination
  const allUnits = await db
    .select({ id: units.id, rentAmountCents: units.rentAmountCents })
    .from(units)
  const unitRentMap = new Map(allUnits.map((u) => [u.id, u.rentAmountCents]))

  // 4. Get existing charges to check for duplicates (idempotency)
  const existingCharges = await db
    .select({
      tenantUserId: charges.tenantUserId,
      unitId: charges.unitId,
      billingPeriod: charges.billingPeriod,
      type: charges.type,
    })
    .from(charges)
    .where(eq(charges.type, "rent"))

  // Build dedup set: "tenantUserId:unitId:billingPeriod"
  const existingChargeKeys = new Set(
    existingCharges.map(
      (c) => `${c.tenantUserId}:${c.unitId}:${c.billingPeriod}`
    )
  )

  // 5. Determine which charges need to be created
  // Group payments by tenant + unit + billing period to create ONE charge per period
  const chargeMap = new Map<
    string,
    {
      tenantUserId: string
      unitId: string
      billingPeriod: string
      totalPaymentCents: number
    }
  >()

  for (const payment of historicalPayments) {
    const key = `${payment.tenantUserId}:${payment.unitId}:${payment.billingPeriod}`

    if (existingChargeKeys.has(key)) continue // Already has a charge

    if (!chargeMap.has(key)) {
      chargeMap.set(key, {
        tenantUserId: payment.tenantUserId,
        unitId: payment.unitId,
        billingPeriod: payment.billingPeriod,
        totalPaymentCents: payment.amountCents,
      })
    } else {
      // Multiple payments for same period — use the larger amount for the charge
      const existing = chargeMap.get(key)!
      existing.totalPaymentCents = Math.max(
        existing.totalPaymentCents,
        payment.amountCents
      )
    }
  }

  // 6. Create charges
  const chargesToCreate = Array.from(chargeMap.values())
  console.log(`\nCharges to create: ${chargesToCreate.length}`)

  if (chargesToCreate.length === 0) {
    console.log(
      "No new charges needed — all payments already have corresponding charges."
    )
    return
  }

  let created = 0
  let skipped = 0

  for (const chargeData of chargesToCreate) {
    // Use unit rent amount if available, otherwise use payment amount
    const unitRent = unitRentMap.get(chargeData.unitId)
    const chargeAmountCents = unitRent ?? chargeData.totalPaymentCents

    const chargeValues = {
      tenantUserId: chargeData.tenantUserId,
      unitId: chargeData.unitId,
      type: "rent" as const,
      description: `Rent for ${chargeData.billingPeriod}`,
      amountCents: chargeAmountCents,
      billingPeriod: chargeData.billingPeriod,
      createdBy: null, // system-generated backfill
    }

    if (isDryRun) {
      console.log(
        `  [DRY RUN] Would create charge: tenant=${chargeData.tenantUserId.slice(0, 8)}... unit=${chargeData.unitId.slice(0, 8)}... period=${chargeData.billingPeriod} amount=$${(chargeAmountCents / 100).toFixed(2)}`
      )
      created++
    } else {
      try {
        await db.insert(charges).values(chargeValues)
        created++
      } catch (err) {
        console.error(
          `  Error creating charge for ${chargeData.billingPeriod}:`,
          err
        )
        skipped++
      }
    }
  }

  console.log(`\n=== Results ===`)
  console.log(`Created: ${created}`)
  console.log(`Skipped/Errored: ${skipped}`)
  console.log(`Total charges after: ${Number(chargeCount.count) + created}`)

  // 7. Validation: verify balance sanity
  if (!isDryRun) {
    console.log(`\n=== Post-Backfill Validation ===`)
    const [newChargeCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(charges)
    console.log(`Total charges in DB: ${newChargeCount.count}`)

    // Check for any payments without corresponding charges
    const orphaned = await db.execute(sql`
      SELECT COUNT(DISTINCT CONCAT(tenant_user_id, ':', unit_id, ':', billing_period))
      FROM payments
      WHERE status IN ('succeeded', 'pending')
      AND CONCAT(tenant_user_id, ':', unit_id, ':', billing_period) NOT IN (
        SELECT CONCAT(tenant_user_id, ':', unit_id, ':', billing_period)
        FROM charges
        WHERE type = 'rent'
      )
    `)
    console.log(
      `Payments without matching charges: ${JSON.stringify(orphaned.rows[0])}`
    )
  }

  console.log(`\nBackfill ${isDryRun ? "dry run " : ""}complete.`)
}

backfill().catch(console.error)
