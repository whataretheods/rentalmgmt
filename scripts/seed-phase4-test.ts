import { config } from "dotenv"
config({ path: ".env.local" })

import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import * as schema from "../src/db/schema"
import { eq, and } from "drizzle-orm"

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "odesantos2@gmail.com"

async function main() {
  const sql = neon(process.env.DATABASE_URL!)
  const db = drizzle({ client: sql, schema })

  // --- Find active tenant-unit link (same approach as seed-payment-test) ---
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

  // --- Find the tenant user ---
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

  // --- Find admin user ---
  const [admin] = await db
    .select()
    .from(schema.user)
    .where(eq(schema.user.email, ADMIN_EMAIL))
    .limit(1)

  if (!admin) {
    console.log(`No admin found with email ${ADMIN_EMAIL}.`)
    console.log("Run seed:admin first.")
    process.exit(1)
  }

  console.log("Found admin:", admin.email, "(id:", admin.id, ")")

  // --- Seed a maintenance request (submitted) for the test tenant ---
  const existingRequests = await db
    .select()
    .from(schema.maintenanceRequests)
    .where(eq(schema.maintenanceRequests.tenantUserId, tenant.id))
    .limit(1)

  if (existingRequests.length === 0) {
    const [request] = await db
      .insert(schema.maintenanceRequests)
      .values({
        tenantUserId: tenant.id,
        unitId: link.unitId,
        category: "plumbing",
        description:
          "Kitchen sink is leaking under the cabinet. Water pools when running the dishwasher.",
        status: "submitted",
      })
      .returning()

    console.log("Created maintenance request:", request.id)

    // Add a comment from admin
    await db.insert(schema.maintenanceComments).values({
      requestId: request.id,
      userId: admin.id,
      content: "We've scheduled a plumber to inspect. Will update you soon.",
      isStatusChange: false,
    })

    console.log("Added admin comment to maintenance request")
  } else {
    console.log(
      "Maintenance request already exists for tenant, skipping creation"
    )
  }

  // --- Seed a document request from admin ---
  const existingDocRequests = await db
    .select()
    .from(schema.documentRequests)
    .where(
      and(
        eq(schema.documentRequests.tenantUserId, tenant.id),
        eq(schema.documentRequests.status, "pending")
      )
    )
    .limit(1)

  if (existingDocRequests.length === 0) {
    const [docRequest] = await db
      .insert(schema.documentRequests)
      .values({
        tenantUserId: tenant.id,
        documentType: "proof_of_income_insurance",
        message:
          "Please upload a recent pay stub or proof of renter's insurance for our records.",
        status: "pending",
      })
      .returning()

    console.log("Created document request:", docRequest.id)
  } else {
    console.log(
      "Pending document request already exists for tenant, skipping creation"
    )
  }

  // Output the tenant email for E2E tests to use
  console.log("\n--- Test Credentials ---")
  console.log("TEST_TENANT_EMAIL=" + tenant.email)
  console.log("ADMIN_EMAIL=" + admin.email)

  console.log("\nPhase 4 test data seeded successfully.")
}

main().catch((err) => {
  console.error("Seed failed:", err)
  process.exit(1)
})
