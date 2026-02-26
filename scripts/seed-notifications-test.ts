import { config } from "dotenv"
config({ path: ".env.local" })

import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import * as schema from "../src/db/schema"
import { eq, and } from "drizzle-orm"

async function main() {
  const sql = neon(process.env.DATABASE_URL!)
  const db = drizzle({ client: sql, schema })

  // --- Find tenant via active tenant-unit link (same approach as seed-payment-test) ---
  const [link] = await db
    .select()
    .from(schema.tenantUnits)
    .where(eq(schema.tenantUnits.isActive, true))
    .limit(1)

  if (!link) {
    console.log("No active tenant-unit links found. Run invite flow first.")
    process.exit(1)
  }

  const [tenant] = await db
    .select()
    .from(schema.user)
    .where(eq(schema.user.id, link.userId))
    .limit(1)

  if (!tenant) {
    console.log("Tenant user not found for active unit link.")
    process.exit(1)
  }

  console.log("Found tenant:", tenant.id, tenant.email)

  // --- Ensure tenant has phone and smsOptIn for SMS testing ---
  if (!tenant.phone) {
    await db
      .update(schema.user)
      .set({
        phone: "+15551234567",
        smsOptIn: true,
        smsOptInAt: new Date().toISOString(),
        updatedAt: new Date(),
      })
      .where(eq(schema.user.id, tenant.id))
    console.log("Set tenant phone and smsOptIn")
  } else {
    // Just ensure smsOptIn is true
    await db
      .update(schema.user)
      .set({
        smsOptIn: true,
        smsOptInAt: tenant.smsOptInAt || new Date().toISOString(),
        updatedAt: new Date(),
      })
      .where(eq(schema.user.id, tenant.id))
    console.log("Ensured tenant smsOptIn is true")
  }

  // --- Create sample notifications for tenant ---
  // Check if we already seeded
  const [existingTenantNotif] = await db
    .select()
    .from(schema.notifications)
    .where(
      and(
        eq(schema.notifications.userId, tenant.id),
        eq(schema.notifications.title, "Rent Reminder: upcoming - test")
      )
    )
    .limit(1)

  if (!existingTenantNotif) {
    await db.insert(schema.notifications).values([
      {
        userId: tenant.id,
        type: "rent_reminder",
        title: "Rent Reminder: upcoming - test",
        body: "Your rent of $1,500.00 for Unit 101 is due in 3 days.",
        channel: "in_app",
        readAt: null, // unread
      },
      {
        userId: tenant.id,
        type: "broadcast",
        title: "Building Update",
        body: "Water will be shut off Thursday 10am-2pm for pipe maintenance.",
        channel: "in_app",
        readAt: new Date(), // read
      },
      {
        userId: tenant.id,
        type: "system",
        title: "Welcome to RentalMgmt",
        body: "Your account has been set up. Explore your tenant portal.",
        channel: "in_app",
        readAt: null, // unread
      },
    ])
    console.log("Created 3 tenant notifications")
  } else {
    console.log("Tenant notifications already exist, skipping")
  }

  // --- Find admin user and create notification ---
  const [adminUser] = await db
    .select()
    .from(schema.user)
    .where(eq(schema.user.role, "admin"))
    .limit(1)

  if (adminUser) {
    const [existingAdminNotif] = await db
      .select()
      .from(schema.notifications)
      .where(
        and(
          eq(schema.notifications.userId, adminUser.id),
          eq(schema.notifications.title, "System Maintenance Complete")
        )
      )
      .limit(1)

    if (!existingAdminNotif) {
      await db.insert(schema.notifications).values({
        userId: adminUser.id,
        type: "system",
        title: "System Maintenance Complete",
        body: "All database migrations have been applied successfully.",
        channel: "in_app",
        readAt: null,
      })
      console.log("Created admin notification")
    } else {
      console.log("Admin notification already exists, skipping")
    }
  } else {
    console.log("No admin user found, skipping admin notification")
  }

  console.log("Phase 5 test seed complete!")
}

main().catch((err) => {
  console.error("Seed error:", err)
  process.exit(1)
})
