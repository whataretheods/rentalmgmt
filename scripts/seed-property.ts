/**
 * Seeds the property and units into the database.
 * Run once on initial setup: npm run seed:property
 *
 * Edit the PROPERTY and UNITS constants below to match the actual property.
 * Units are seeded with null rent amounts -- configure these in Phase 3.
 *
 * Requires in .env.local:
 *   DATABASE_URL=...
 */
import "dotenv/config"
import { db } from "@/db"
import { properties, units } from "@/db/schema"

// Edit these to match the actual property
const PROPERTY = {
  name: "Rental Property",
  address: "123 Main Street, City, State 00000",
}

// Edit unit numbers to match actual unit designations
const UNIT_NUMBERS = ["1A", "1B", "2A", "2B", "3A"]

async function seedProperty() {
  try {
    // Insert property -- ignore if already exists
    const [property] = await db
      .insert(properties)
      .values(PROPERTY)
      .onConflictDoNothing()
      .returning()

    if (!property) {
      console.log("Property already exists -- skipping")
      process.exit(0)
    }

    console.log("Property created:", property.name, "(id:", property.id + ")")

    // Insert units
    const unitValues = UNIT_NUMBERS.map((unitNumber) => ({
      propertyId: property.id,
      unitNumber,
      // rentAmountCents and rentDueDay are null until Phase 3 admin configuration
    }))

    const insertedUnits = await db
      .insert(units)
      .values(unitValues)
      .onConflictDoNothing()
      .returning()

    console.log(`${insertedUnits.length} units created:`, insertedUnits.map((u) => u.unitNumber).join(", "))
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("Seed failed:", message)
    process.exit(1)
  }

  process.exit(0)
}

seedProperty()
