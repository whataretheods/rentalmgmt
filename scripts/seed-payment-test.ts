import { config } from "dotenv"
config({ path: ".env.local" })

import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import * as schema from "../src/db/schema"
import { eq, and } from "drizzle-orm"

async function main() {
  const sql = neon(process.env.DATABASE_URL!)
  const db = drizzle({ client: sql, schema })

  // Find an active tenant-unit link
  const [link] = await db
    .select()
    .from(schema.tenantUnits)
    .where(eq(schema.tenantUnits.isActive, true))
    .limit(1)

  if (!link) {
    console.log("No active tenant-unit links found. Run invite flow first.")
    process.exit(1)
  }

  // Find the unit and configure rent if not already set
  const [unit] = await db
    .select()
    .from(schema.units)
    .where(eq(schema.units.id, link.unitId))

  if (!unit?.rentAmountCents) {
    await db.update(schema.units).set({
      rentAmountCents: 150000,  // $1,500.00
      rentDueDay: 1,
      updatedAt: new Date(),
    }).where(eq(schema.units.id, link.unitId))
    console.log("Configured rent for unit:", unit?.unitNumber, "-> $1,500.00 due day 1")
  }

  // Insert a test payment
  const billingPeriod = new Date().toISOString().slice(0, 7)
  const [existing] = await db
    .select()
    .from(schema.payments)
    .where(and(
      eq(schema.payments.tenantUserId, link.userId),
      eq(schema.payments.billingPeriod, billingPeriod),
    ))
    .limit(1)

  if (!existing) {
    await db.insert(schema.payments).values({
      tenantUserId: link.userId,
      unitId: link.unitId,
      amountCents: 150000,
      paymentMethod: "card",
      status: "succeeded",
      billingPeriod,
      paidAt: new Date(),
    })
    console.log("Inserted test payment: $1,500.00 for period", billingPeriod)
  } else {
    console.log("Test payment already exists for period", billingPeriod)
  }

  console.log("Payment test data seeded successfully.")
}

main().catch((err) => {
  console.error("Seed failed:", err)
  process.exit(1)
})
