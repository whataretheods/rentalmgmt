/**
 * Creates test data for portfolio management E2E tests.
 * Run: npx tsx scripts/seed-portfolio.ts
 *
 * Creates:
 * - Test property "Portfolio Test Property"
 * - Two units: "P101" (with tenant) and "P102" (vacant, with pending invite)
 * - A test tenant linked to P101
 * - A pending invite token for P102
 *
 * Also creates a "moved-out" test tenant for past-tenant read-only access testing.
 *
 * Idempotent -- skips if data already exists.
 *
 * Requires the dev server running (uses Better Auth HTTP signup)
 * and DATABASE_URL in .env.local.
 */
import { config } from "dotenv"
config({ path: ".env.local" })

import { db } from "@/db"
import { user } from "@/db/schema/auth"
import { properties, units, tenantUnits, inviteTokens } from "@/db/schema/domain"
import { eq, and } from "drizzle-orm"
import { generateInviteToken, hashToken, getInviteExpiry } from "@/lib/tokens"

const PROPERTY_NAME = "Portfolio Test Property"
const PROPERTY_ADDRESS = "100 Portfolio Drive, Test City, TS 10000"

const UNIT_101 = "P101"
const UNIT_102 = "P102"

const ACTIVE_TENANT_EMAIL = "portfolio-active@test.com"
const ACTIVE_TENANT_PASSWORD = "TestPass123!"
const ACTIVE_TENANT_NAME = "Active Portfolio Tenant"

const PAST_TENANT_EMAIL = "portfolio-past@test.com"
const PAST_TENANT_PASSWORD = "TestPass123!"
const PAST_TENANT_NAME = "Past Portfolio Tenant"

const UNLINKED_TENANT_EMAIL = "portfolio-unlinked@test.com"
const UNLINKED_TENANT_PASSWORD = "TestPass123!"
const UNLINKED_TENANT_NAME = "Unlinked Portfolio Tenant"

async function createOrFindUser(email: string, password: string, name: string): Promise<string> {
  const baseUrl = process.env.BETTER_AUTH_URL || "http://localhost:3000"

  const [existing] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email))
    .limit(1)

  if (existing) {
    console.log(`  User ${email} already exists: ${existing.id}`)
    return existing.id
  }

  const res = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: baseUrl },
    body: JSON.stringify({ email, password, name }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Failed to create user ${email}: ${res.status} ${body}`)
  }

  const [created] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email))
    .limit(1)

  if (!created) throw new Error(`User ${email} not found after signup`)

  console.log(`  Created user ${email}: ${created.id}`)
  return created.id
}

async function seedPortfolio() {
  console.log("Seeding portfolio test data...\n")

  // 1. Create property
  let [property] = await db
    .select({ id: properties.id })
    .from(properties)
    .where(eq(properties.name, PROPERTY_NAME))
    .limit(1)

  if (!property) {
    ;[property] = await db
      .insert(properties)
      .values({ name: PROPERTY_NAME, address: PROPERTY_ADDRESS })
      .returning({ id: properties.id })
    console.log(`  Created property: ${PROPERTY_NAME} (${property.id})`)
  } else {
    console.log(`  Property already exists: ${PROPERTY_NAME} (${property.id})`)
  }

  // 2. Create units
  let [unit101] = await db
    .select({ id: units.id })
    .from(units)
    .where(and(eq(units.propertyId, property.id), eq(units.unitNumber, UNIT_101)))
    .limit(1)

  if (!unit101) {
    ;[unit101] = await db
      .insert(units)
      .values({
        propertyId: property.id,
        unitNumber: UNIT_101,
        rentAmountCents: 150_000,
        rentDueDay: 1,
      })
      .returning({ id: units.id })
    console.log(`  Created unit ${UNIT_101}: ${unit101.id}`)
  } else {
    console.log(`  Unit ${UNIT_101} already exists: ${unit101.id}`)
  }

  let [unit102] = await db
    .select({ id: units.id })
    .from(units)
    .where(and(eq(units.propertyId, property.id), eq(units.unitNumber, UNIT_102)))
    .limit(1)

  if (!unit102) {
    ;[unit102] = await db
      .insert(units)
      .values({
        propertyId: property.id,
        unitNumber: UNIT_102,
        rentAmountCents: 120_000,
        rentDueDay: 5,
      })
      .returning({ id: units.id })
    console.log(`  Created unit ${UNIT_102}: ${unit102.id}`)
  } else {
    console.log(`  Unit ${UNIT_102} already exists: ${unit102.id}`)
  }

  // 3. Create active tenant and link to P101
  const activeUserId = await createOrFindUser(ACTIVE_TENANT_EMAIL, ACTIVE_TENANT_PASSWORD, ACTIVE_TENANT_NAME)

  const [existingActiveLink] = await db
    .select({ id: tenantUnits.id })
    .from(tenantUnits)
    .where(and(eq(tenantUnits.userId, activeUserId), eq(tenantUnits.isActive, true)))
    .limit(1)

  if (!existingActiveLink) {
    await db.insert(tenantUnits).values({
      userId: activeUserId,
      unitId: unit101.id,
      startDate: new Date(),
      isActive: true,
    })
    console.log(`  Linked ${ACTIVE_TENANT_EMAIL} to unit ${UNIT_101}`)
  } else {
    console.log(`  ${ACTIVE_TENANT_EMAIL} already has active link`)
  }

  // 4. Create past tenant (moved-out from P101 in the past)
  const pastUserId = await createOrFindUser(PAST_TENANT_EMAIL, PAST_TENANT_PASSWORD, PAST_TENANT_NAME)

  const [existingPastLink] = await db
    .select({ id: tenantUnits.id })
    .from(tenantUnits)
    .where(and(eq(tenantUnits.userId, pastUserId), eq(tenantUnits.unitId, unit101.id)))
    .limit(1)

  if (!existingPastLink) {
    const pastDate = new Date()
    pastDate.setMonth(pastDate.getMonth() - 3) // started 3 months ago
    const endDate = new Date()
    endDate.setMonth(endDate.getMonth() - 1) // ended 1 month ago

    await db.insert(tenantUnits).values({
      userId: pastUserId,
      unitId: unit101.id,
      startDate: pastDate,
      endDate,
      isActive: false,
    })
    console.log(`  Created past tenancy for ${PAST_TENANT_EMAIL} (ended ${endDate.toLocaleDateString()})`)
  } else {
    console.log(`  ${PAST_TENANT_EMAIL} already has past tenancy record`)
  }

  // 5. Create unlinked tenant (no unit)
  await createOrFindUser(UNLINKED_TENANT_EMAIL, UNLINKED_TENANT_PASSWORD, UNLINKED_TENANT_NAME)
  console.log(`  ${UNLINKED_TENANT_EMAIL} created (no unit link)`)

  // 6. Generate pending invite for P102
  const existingInvite = await db
    .select({ id: inviteTokens.id })
    .from(inviteTokens)
    .where(and(eq(inviteTokens.unitId, unit102.id), eq(inviteTokens.status, "pending")))
    .limit(1)

  let rawToken = ""
  if (existingInvite.length === 0) {
    rawToken = generateInviteToken()
    const tokenHash = hashToken(rawToken)

    await db.insert(inviteTokens).values({
      unitId: unit102.id,
      tokenHash,
      status: "pending",
      expiresAt: getInviteExpiry(),
    })
    console.log(`  Created pending invite for ${UNIT_102}`)
  } else {
    console.log(`  Pending invite for ${UNIT_102} already exists`)
    rawToken = "[already exists - check DB]"
  }

  console.log("\n--- Portfolio Test Data ---")
  console.log(`Property: ${PROPERTY_NAME} (${property.id})`)
  console.log(`Unit P101: ${unit101.id} (active tenant: ${ACTIVE_TENANT_EMAIL})`)
  console.log(`Unit P102: ${unit102.id} (vacant, invite token below)`)
  console.log(`Active tenant: ${ACTIVE_TENANT_EMAIL} / ${ACTIVE_TENANT_PASSWORD}`)
  console.log(`Past tenant: ${PAST_TENANT_EMAIL} / ${PAST_TENANT_PASSWORD}`)
  console.log(`Unlinked tenant: ${UNLINKED_TENANT_EMAIL} / ${UNLINKED_TENANT_PASSWORD}`)
  console.log(`Invite token for P102: ${rawToken}`)

  process.exit(0)
}

seedPortfolio().catch((err) => {
  console.error("Seed failed:", err)
  process.exit(1)
})
