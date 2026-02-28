import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { db } from "@/db"
import { vendors } from "@/db/schema"
import { eq } from "drizzle-orm"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const [vendor] = await db.select().from(vendors).where(eq(vendors.id, id))

  if (!vendor) {
    return NextResponse.json({ error: "Vendor not found" }, { status: 404 })
  }

  return NextResponse.json({ vendor })
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const [existing] = await db.select().from(vendors).where(eq(vendors.id, id))

  if (!existing) {
    return NextResponse.json({ error: "Vendor not found" }, { status: 404 })
  }

  const body = await req.json()
  const updates: Record<string, unknown> = { updatedAt: new Date() }

  if (body.companyName !== undefined) updates.companyName = body.companyName.trim()
  if (body.contactName !== undefined) updates.contactName = body.contactName?.trim() || null
  if (body.email !== undefined) updates.email = body.email?.trim() || null
  if (body.phone !== undefined) updates.phone = body.phone?.trim() || null
  if (body.specialty !== undefined) updates.specialty = body.specialty || null
  if (body.notes !== undefined) updates.notes = body.notes?.trim() || null
  if (body.status !== undefined) updates.status = body.status

  const [vendor] = await db
    .update(vendors)
    .set(updates)
    .where(eq(vendors.id, id))
    .returning()

  return NextResponse.json({ vendor })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const [existing] = await db.select().from(vendors).where(eq(vendors.id, id))

  if (!existing) {
    return NextResponse.json({ error: "Vendor not found" }, { status: 404 })
  }

  // Soft delete: set status to inactive (preserves work order history)
  await db
    .update(vendors)
    .set({ status: "inactive", updatedAt: new Date() })
    .where(eq(vendors.id, id))

  return NextResponse.json({ success: true })
}
