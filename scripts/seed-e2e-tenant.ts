/**
 * Creates a test tenant for E2E tests.
 * Run: npm run seed:e2e-tenant
 *
 * Creates user testtenant@test.com / TestPass123!
 * Links them to the first available unit ($1,500/month, due day 1).
 * Idempotent — skips if user + unit link already exist.
 *
 * Requires the dev server running (uses Better Auth HTTP signup)
 * and DATABASE_URL in .env.local.
 */
import { config } from "dotenv"
config({ path: ".env.local" })
import { db } from "@/db"
import { user } from "@/db/schema/auth"
import { units, tenantUnits, inviteTokens } from "@/db/schema/domain"
import { eq, isNull } from "drizzle-orm"
import { randomUUID } from "crypto"

const EMAIL = "testtenant@test.com"
const PASSWORD = "TestPass123!"
const NAME = "Test Tenant"
const RENT_CENTS = 150_000 // $1,500
const DUE_DAY = 1

async function seedE2ETenant() {
  const baseUrl = process.env.BETTER_AUTH_URL || "http://localhost:3000"

  // 1. Check if user already exists
  const existing = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, EMAIL))

  let userId: string

  if (existing.length > 0) {
    userId = existing[0].id
    console.log("Test tenant user already exists:", EMAIL)
  } else {
    // Register via HTTP endpoint (properly hashes password)
    const res = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: baseUrl },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD, name: NAME }),
    })

    if (!res.ok) {
      const body = await res.text()
      console.error("Failed to create user:", res.status, body)
      process.exit(1)
    }

    const created = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, EMAIL))

    if (created.length === 0) {
      console.error("User was not found in DB after signup")
      process.exit(1)
    }

    userId = created[0].id
    console.log("Created test tenant user:", EMAIL, "id:", userId)
  }

  // 2. Check if user already has an active unit link
  const existingLink = await db
    .select({ id: tenantUnits.id })
    .from(tenantUnits)
    .where(eq(tenantUnits.userId, userId))

  if (existingLink.length > 0) {
    console.log("Tenant already linked to a unit — done.")
    process.exit(0)
  }

  // 3. Find first unit (or create one if none exist)
  let allUnits = await db.select({ id: units.id, propertyId: units.propertyId }).from(units).limit(1)

  if (allUnits.length === 0) {
    console.error("No units found in the database. Run seed:property first.")
    process.exit(1)
  }

  const unitId = allUnits[0].id

  // 4. Set rent amount and due day on the unit
  await db
    .update(units)
    .set({ rentAmountCents: RENT_CENTS, rentDueDay: DUE_DAY })
    .where(eq(units.id, unitId))

  console.log("Set unit", unitId, "rent to $1,500/month, due day 1")

  // 5. Create tenant-unit link
  await db.insert(tenantUnits).values({
    userId,
    unitId,
    startDate: new Date(),
    isActive: true,
  })

  console.log("Linked tenant to unit:", unitId)

  // 6. Create a "used" invite token for this unit/user
  const tokenHash = randomUUID() // placeholder hash for the seed
  await db.insert(inviteTokens).values({
    unitId,
    tokenHash,
    status: "used",
    usedByUserId: userId,
    expiresAt: new Date(),
    usedAt: new Date(),
  })

  console.log("Created used invite token for audit trail")
  console.log("\nE2E tenant seeded successfully!")
  console.log("  Email:", EMAIL)
  console.log("  Password:", PASSWORD)
  console.log("  Unit:", unitId)

  process.exit(0)
}

seedE2ETenant()
