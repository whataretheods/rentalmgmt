import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { db } from "@/db"
import { units, tenantUnits } from "@/db/schema/domain"
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
  let body: {
    unitNumber?: string
    rentAmountCents?: number
    rentDueDay?: number
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  if (
    body.rentDueDay !== undefined &&
    body.rentDueDay !== null &&
    (body.rentDueDay < 1 || body.rentDueDay > 28)
  ) {
    return NextResponse.json(
      { error: "rentDueDay must be between 1 and 28" },
      { status: 400 }
    )
  }

  if (
    body.rentAmountCents !== undefined &&
    body.rentAmountCents !== null &&
    body.rentAmountCents < 0
  ) {
    return NextResponse.json(
      { error: "rentAmountCents cannot be negative" },
      { status: 400 }
    )
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() }
  if (body.unitNumber?.trim()) updates.unitNumber = body.unitNumber.trim()
  if (body.rentAmountCents !== undefined)
    updates.rentAmountCents = body.rentAmountCents
  if (body.rentDueDay !== undefined) updates.rentDueDay = body.rentDueDay

  const [updated] = await db
    .update(units)
    .set(updates)
    .where(and(eq(units.id, id), isNull(units.archivedAt)))
    .returning()

  if (!updated) {
    return NextResponse.json(
      { error: "Unit not found or archived" },
      { status: 404 }
    )
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

  // Check for active tenant in this unit
  const [activeTenant] = await db
    .select({ id: tenantUnits.id })
    .from(tenantUnits)
    .where(and(eq(tenantUnits.unitId, id), eq(tenantUnits.isActive, true)))
    .limit(1)

  if (activeTenant) {
    return NextResponse.json(
      {
        error:
          "Cannot archive unit with active tenant. Move out the tenant first.",
      },
      { status: 409 }
    )
  }

  const [archived] = await db
    .update(units)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(units.id, id), isNull(units.archivedAt)))
    .returning()

  if (!archived) {
    return NextResponse.json(
      { error: "Unit not found or already archived" },
      { status: 404 }
    )
  }

  return NextResponse.json({ success: true })
}
