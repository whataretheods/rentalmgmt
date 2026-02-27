import { config } from "dotenv"
config({ path: ".env.local" })

import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import * as schema from "../src/db/schema"
import { eq } from "drizzle-orm"

async function main() {
  const sql = neon(process.env.DATABASE_URL!)
  const db = drizzle({ client: sql, schema })

  // Find active tenant-unit link
  const [link] = await db
    .select()
    .from(schema.tenantUnits)
    .where(eq(schema.tenantUnits.isActive, true))
    .limit(1)

  if (!link) {
    console.log("No active tenant-unit links found. Run invite flow first.")
    process.exit(1)
  }

  console.log("Found active unit link:", link.unitId, "userId:", link.userId)

  // Find the tenant user
  const [tenant] = await db
    .select()
    .from(schema.user)
    .where(eq(schema.user.id, link.userId))
    .limit(1)

  if (!tenant) {
    console.log("Tenant user not found for userId:", link.userId)
    process.exit(1)
  }

  console.log("Found test tenant:", tenant.email, "(id:", tenant.id, ")")

  // Get unit to determine rent due day for next charge date
  const [unit] = await db
    .select()
    .from(schema.units)
    .where(eq(schema.units.id, link.unitId))
    .limit(1)

  if (!unit) {
    console.log("Unit not found for unitId:", link.unitId)
    process.exit(1)
  }

  // Calculate next charge date from rentDueDay
  const now = new Date()
  const dueDay = unit.rentDueDay ?? 1
  let nextChargeDate: string

  // If we're past the due day this month, next charge is next month
  if (now.getDate() >= dueDay) {
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, dueDay)
    nextChargeDate = nextMonth.toISOString().slice(0, 10)
  } else {
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), dueDay)
    nextChargeDate = thisMonth.toISOString().slice(0, 10)
  }

  // Create or update autopay enrollment with test data
  await db
    .insert(schema.autopayEnrollments)
    .values({
      tenantUserId: tenant.id,
      unitId: link.unitId,
      stripeCustomerId: "cus_test_autopay_seed",
      stripePaymentMethodId: "pm_test_autopay_seed",
      paymentMethodType: "card",
      paymentMethodLast4: "4242",
      paymentMethodBrand: "visa",
      status: "active",
      enrolledAt: new Date(),
      nextChargeDate,
    })
    .onConflictDoUpdate({
      target: schema.autopayEnrollments.tenantUserId,
      set: {
        status: "active",
        stripePaymentMethodId: "pm_test_autopay_seed",
        paymentMethodType: "card",
        paymentMethodLast4: "4242",
        paymentMethodBrand: "visa",
        enrolledAt: new Date(),
        cancelledAt: null,
        nextChargeDate,
        updatedAt: new Date(),
      },
    })

  console.log("Autopay enrollment created/updated:")
  console.log("  Status: active")
  console.log("  Payment method: Visa ending 4242")
  console.log("  Next charge date:", nextChargeDate)

  // Output the tenant email for E2E tests to use
  console.log("\n--- Test Credentials ---")
  console.log("TEST_TENANT_EMAIL=" + tenant.email)

  console.log("\nAutopay test data seeded successfully.")
}

main().catch((err) => {
  console.error("Seed failed:", err)
  process.exit(1)
})
