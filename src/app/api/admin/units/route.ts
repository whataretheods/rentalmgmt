import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { db } from "@/db"
import { properties, units, tenantUnits } from "@/db/schema/domain"
import { user } from "@/db/schema/auth"
import { eq, and, isNull } from "drizzle-orm"

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const propertyId = request.nextUrl.searchParams.get("propertyId")

  const conditions = [isNull(units.archivedAt), isNull(properties.archivedAt)]
  if (propertyId) {
    conditions.push(eq(units.propertyId, propertyId))
  }

  const result = await db
    .select({
      id: units.id,
      unitNumber: units.unitNumber,
      propertyId: units.propertyId,
      propertyName: properties.name,
      propertyAddress: properties.address,
      rentAmountCents: units.rentAmountCents,
      rentDueDay: units.rentDueDay,
      createdAt: units.createdAt,
      currentTenantUserId: tenantUnits.userId,
      currentTenantName: user.name,
      currentTenantEmail: user.email,
    })
    .from(units)
    .innerJoin(properties, eq(units.propertyId, properties.id))
    .leftJoin(
      tenantUnits,
      and(eq(tenantUnits.unitId, units.id), eq(tenantUnits.isActive, true))
    )
    .leftJoin(user, eq(tenantUnits.userId, user.id))
    .where(and(...conditions))
    .orderBy(properties.name, units.unitNumber)

  return NextResponse.json(result)
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: {
    propertyId?: string
    unitNumber?: string
    rentAmountCents?: number
    rentDueDay?: number
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { propertyId, unitNumber, rentAmountCents, rentDueDay } = body

  if (!propertyId || !unitNumber?.trim()) {
    return NextResponse.json(
      { error: "propertyId and unitNumber are required" },
      { status: 400 }
    )
  }

  if (
    rentDueDay !== undefined &&
    rentDueDay !== null &&
    (rentDueDay < 1 || rentDueDay > 28)
  ) {
    return NextResponse.json(
      { error: "rentDueDay must be between 1 and 28" },
      { status: 400 }
    )
  }

  if (
    rentAmountCents !== undefined &&
    rentAmountCents !== null &&
    rentAmountCents < 0
  ) {
    return NextResponse.json(
      { error: "rentAmountCents cannot be negative" },
      { status: 400 }
    )
  }

  // Verify property exists and is not archived
  const [property] = await db
    .select({ id: properties.id })
    .from(properties)
    .where(and(eq(properties.id, propertyId), isNull(properties.archivedAt)))
    .limit(1)

  if (!property) {
    return NextResponse.json(
      { error: "Property not found or archived" },
      { status: 404 }
    )
  }

  const [unit] = await db
    .insert(units)
    .values({
      propertyId,
      unitNumber: unitNumber.trim(),
      rentAmountCents: rentAmountCents ?? null,
      rentDueDay: rentDueDay ?? null,
    })
    .returning()

  return NextResponse.json(unit, { status: 201 })
}
