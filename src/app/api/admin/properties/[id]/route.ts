import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { db } from "@/db"
import { properties, units, tenantUnits } from "@/db/schema/domain"
import { eq, and, isNull } from "drizzle-orm"

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  let body: { name?: string; address?: string; timezone?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() }
  if (body.name?.trim()) updates.name = body.name.trim()
  if (body.address?.trim()) updates.address = body.address.trim()
  if (body.timezone?.trim()) updates.timezone = body.timezone.trim()

  const [updated] = await db
    .update(properties)
    .set(updates)
    .where(and(eq(properties.id, id), isNull(properties.archivedAt)))
    .returning()

  if (!updated) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 })
  }

  return NextResponse.json(updated)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  // Check for active tenants in this property's units
  const activeTenants = await db
    .select({ id: tenantUnits.id })
    .from(tenantUnits)
    .innerJoin(units, eq(tenantUnits.unitId, units.id))
    .where(
      and(
        eq(units.propertyId, id),
        eq(tenantUnits.isActive, true),
        isNull(units.archivedAt)
      )
    )
    .limit(1)

  if (activeTenants.length > 0) {
    return NextResponse.json(
      {
        error:
          "Cannot archive property with active tenants. Move out all tenants first.",
      },
      { status: 409 }
    )
  }

  const [archived] = await db
    .update(properties)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(properties.id, id), isNull(properties.archivedAt)))
    .returning()

  if (!archived) {
    return NextResponse.json(
      { error: "Property not found or already archived" },
      { status: 404 }
    )
  }

  return NextResponse.json({ success: true })
}
