/**
 * Creates test data for Phase 12: Vendor & Work Order Management.
 * Run: npx tsx scripts/seed-phase12.ts
 *
 * Creates:
 * - 4 sample vendors (plumbing, electrical, HVAC, general maintenance)
 * - 1 sample work order (linked to an existing maintenance request if available)
 * - 2-3 sample cost line items on the work order
 *
 * Idempotent -- checks for existing data before inserting.
 * Requires DATABASE_URL in .env.local.
 */
import { config } from "dotenv"
config({ path: ".env.local" })

import { db } from "@/db"
import { vendors, workOrders, workOrderCosts, maintenanceRequests } from "@/db/schema/domain"
import { eq } from "drizzle-orm"
import crypto from "crypto"

const sampleVendors = [
  {
    companyName: "Quick Fix Plumbing",
    contactName: "John Smith",
    email: "john@quickfixplumbing.com",
    phone: "+15551001001",
    specialty: "plumbing" as const,
  },
  {
    companyName: "Spark Electric",
    contactName: "Sarah Johnson",
    email: "sarah@sparkelectric.com",
    phone: "+15551001002",
    specialty: "electrical" as const,
  },
  {
    companyName: "Cool Air HVAC",
    contactName: "Mike Brown",
    email: "mike@coolairhvac.com",
    phone: "+15551001003",
    specialty: "hvac" as const,
  },
  {
    companyName: "All Around Maintenance",
    contactName: "Lisa Davis",
    email: "lisa@allaround.com",
    phone: "+15551001004",
    specialty: "general_maintenance" as const,
  },
]

async function seedPhase12() {
  console.log("Seeding Phase 12 test data...\n")

  // 1. Create vendors (idempotent -- skip if company already exists)
  const createdVendors = []
  for (const v of sampleVendors) {
    const [existing] = await db
      .select({ id: vendors.id })
      .from(vendors)
      .where(eq(vendors.companyName, v.companyName))
      .limit(1)

    if (existing) {
      console.log(`  Vendor already exists: ${v.companyName} (${existing.id})`)
      createdVendors.push(existing)
    } else {
      const [created] = await db
        .insert(vendors)
        .values(v)
        .returning({ id: vendors.id })
      console.log(`  Created vendor: ${v.companyName} (${created.id})`)
      createdVendors.push(created)
    }
  }

  // 2. Find an existing maintenance request for the work order
  const [maintReq] = await db
    .select({ id: maintenanceRequests.id, category: maintenanceRequests.category })
    .from(maintenanceRequests)
    .limit(1)

  if (!maintReq) {
    console.log("\n  No maintenance requests found -- skipping work order creation.")
    console.log("  Run seed-phase4-test.ts first to create maintenance requests.\n")
    console.log("--- Phase 12 Seed: Vendors Only ---")
    console.log(`Created ${createdVendors.length} vendors`)
    process.exit(0)
  }

  // 3. Create sample work order (idempotent -- check if one already exists for this request)
  const [existingWo] = await db
    .select({ id: workOrders.id })
    .from(workOrders)
    .where(eq(workOrders.maintenanceRequestId, maintReq.id))
    .limit(1)

  let workOrderId: string
  let vendorAccessToken: string

  if (existingWo) {
    console.log(`  Work order already exists for request ${maintReq.id}: ${existingWo.id}`)
    workOrderId = existingWo.id
    vendorAccessToken = "[existing]"
  } else {
    vendorAccessToken = crypto.randomUUID()
    const [wo] = await db
      .insert(workOrders)
      .values({
        maintenanceRequestId: maintReq.id,
        vendorId: createdVendors[0].id,
        assignedByUserId: "system-seed",
        priority: "medium",
        notes: "Sample work order for testing",
        vendorAccessToken,
      })
      .returning({ id: workOrders.id })
    workOrderId = wo.id
    console.log(`  Created work order: ${wo.id} (vendor: ${sampleVendors[0].companyName})`)
  }

  // 4. Create sample cost line items (idempotent -- skip if costs exist)
  const existingCosts = await db
    .select({ id: workOrderCosts.id })
    .from(workOrderCosts)
    .where(eq(workOrderCosts.workOrderId, workOrderId))

  if (existingCosts.length > 0) {
    console.log(`  Costs already exist for work order ${workOrderId} (${existingCosts.length} items)`)
  } else {
    const costItems = [
      { description: "Emergency plumbing repair - labor (2 hours)", amountCents: 25000, category: "labor" as const },
      { description: "Replacement pipe fittings", amountCents: 8500, category: "materials" as const },
      { description: "Service call fee", amountCents: 7500, category: "other" as const },
    ]

    for (const cost of costItems) {
      const [created] = await db
        .insert(workOrderCosts)
        .values({ workOrderId, ...cost })
        .returning({ id: workOrderCosts.id })
      console.log(`  Created cost: ${cost.description} ($${(cost.amountCents / 100).toFixed(2)})`)
    }
  }

  console.log("\n--- Phase 12 Test Data ---")
  console.log(`Vendors: ${createdVendors.length}`)
  console.log(`Work Order: ${workOrderId}`)
  console.log(`Vendor Access Token: ${vendorAccessToken}`)
  console.log(`Magic Link: /vendor/work-order/${vendorAccessToken}`)

  process.exit(0)
}

seedPhase12().catch((err) => {
  console.error("Seed failed:", err)
  process.exit(1)
})
