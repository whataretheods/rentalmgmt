import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { db } from "@/db"
import { workOrders, workOrderCosts } from "@/db/schema"
import { eq, and, sql } from "drizzle-orm"
import { resolveAndPostChargeback } from "@/lib/chargeback"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  // Verify work order exists
  const [wo] = await db
    .select({ id: workOrders.id })
    .from(workOrders)
    .where(eq(workOrders.id, id))

  if (!wo) {
    return NextResponse.json({ error: "Work order not found" }, { status: 404 })
  }

  const costs = await db
    .select()
    .from(workOrderCosts)
    .where(eq(workOrderCosts.workOrderId, id))
    .orderBy(workOrderCosts.createdAt)

  // Compute total
  const [totalResult] = await db
    .select({
      total: sql<number>`COALESCE(SUM(${workOrderCosts.amountCents}), 0)`,
    })
    .from(workOrderCosts)
    .where(eq(workOrderCosts.workOrderId, id))

  return NextResponse.json({
    costs,
    totalCents: Number(totalResult.total),
  })
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  // Verify work order exists
  const [wo] = await db
    .select({ id: workOrders.id })
    .from(workOrders)
    .where(eq(workOrders.id, id))

  if (!wo) {
    return NextResponse.json({ error: "Work order not found" }, { status: 404 })
  }

  const body = await req.json()
  const { description, amountCents, category, receiptPath, billToTenant } = body

  if (!description || typeof description !== "string" || description.trim() === "") {
    return NextResponse.json({ error: "Description is required" }, { status: 400 })
  }

  if (typeof amountCents !== "number" || amountCents <= 0 || !Number.isInteger(amountCents)) {
    return NextResponse.json(
      { error: "Amount must be a positive integer (cents)" },
      { status: 400 }
    )
  }

  const validCategories = ["labor", "materials", "permits", "other"]
  if (!validCategories.includes(category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 })
  }

  const [cost] = await db
    .insert(workOrderCosts)
    .values({
      workOrderId: id,
      description: description.trim(),
      amountCents,
      category,
      receiptPath: receiptPath || null,
    })
    .returning()

  let chargePosted = false
  if (billToTenant) {
    chargePosted = await resolveAndPostChargeback(id, description, amountCents, session.user.id)
  }

  return NextResponse.json({ cost, chargePosted }, { status: 201 })
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const url = new URL(req.url)
  const costId = url.searchParams.get("costId")

  if (!costId) {
    return NextResponse.json({ error: "costId is required" }, { status: 400 })
  }

  // Verify cost exists and belongs to this work order
  const [cost] = await db
    .select()
    .from(workOrderCosts)
    .where(
      and(eq(workOrderCosts.id, costId), eq(workOrderCosts.workOrderId, id))
    )

  if (!cost) {
    return NextResponse.json({ error: "Cost not found" }, { status: 404 })
  }

  await db.delete(workOrderCosts).where(eq(workOrderCosts.id, costId))

  return NextResponse.json({ success: true })
}
