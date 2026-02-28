import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { db } from "@/db"
import {
  workOrders,
  vendors,
  maintenanceRequests,
  maintenancePhotos,
  units,
} from "@/db/schema"
import { eq } from "drizzle-orm"
import crypto from "crypto"
import { notifyVendorAssignment } from "@/lib/vendor-notifications"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  const [workOrder] = await db
    .select()
    .from(workOrders)
    .where(eq(workOrders.id, id))

  if (!workOrder) {
    return NextResponse.json({ error: "Work order not found" }, { status: 404 })
  }

  // Fetch related data
  const [maintReq] = await db
    .select()
    .from(maintenanceRequests)
    .where(eq(maintenanceRequests.id, workOrder.maintenanceRequestId))

  let vendor = null
  if (workOrder.vendorId) {
    const [v] = await db
      .select()
      .from(vendors)
      .where(eq(vendors.id, workOrder.vendorId))
    vendor = v || null
  }

  const [unit] = maintReq
    ? await db
        .select()
        .from(units)
        .where(eq(units.id, maintReq.unitId))
    : [null]

  const photos = maintReq
    ? await db
        .select()
        .from(maintenancePhotos)
        .where(eq(maintenancePhotos.requestId, maintReq.id))
    : []

  return NextResponse.json({
    workOrder,
    maintenanceRequest: maintReq,
    vendor,
    unit,
    photos,
  })
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
  const [existing] = await db
    .select()
    .from(workOrders)
    .where(eq(workOrders.id, id))

  if (!existing) {
    return NextResponse.json({ error: "Work order not found" }, { status: 404 })
  }

  const body = await req.json()
  const updates: Record<string, unknown> = { updatedAt: new Date() }

  // Handle special actions
  if (body.action === "regenerate_token") {
    updates.vendorAccessToken = crypto.randomUUID()
  } else if (body.action === "revoke_token") {
    updates.vendorAccessToken = null
  }

  // Handle vendor change (reassignment)
  if (body.vendorId !== undefined && body.vendorId !== existing.vendorId) {
    if (body.vendorId) {
      const [newVendor] = await db
        .select()
        .from(vendors)
        .where(eq(vendors.id, body.vendorId))

      if (!newVendor) {
        return NextResponse.json({ error: "Vendor not found" }, { status: 404 })
      }

      updates.vendorId = body.vendorId

      // Regenerate token and notify new vendor
      const newToken = crypto.randomUUID()
      updates.vendorAccessToken = newToken

      // Get maintenance request info for notification
      const [maintReq] = await db
        .select({
          category: maintenanceRequests.category,
          unitId: maintenanceRequests.unitId,
        })
        .from(maintenanceRequests)
        .where(eq(maintenanceRequests.id, existing.maintenanceRequestId))

      const [unit] = maintReq
        ? await db
            .select({ unitNumber: units.unitNumber })
            .from(units)
            .where(eq(units.id, maintReq.unitId))
        : [null]

      const appUrl =
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
      const workOrderUrl = `${appUrl}/vendor/work-order/${newToken}`
      const requestSummary = `${maintReq?.category || "Maintenance"} - Unit ${unit?.unitNumber || "Unknown"}`

      await notifyVendorAssignment(
        {
          email: newVendor.email,
          phone: newVendor.phone,
          companyName: newVendor.companyName,
        },
        workOrderUrl,
        requestSummary
      )
    } else {
      updates.vendorId = null
    }
  }

  if (body.status !== undefined) {
    updates.status = body.status
    // Auto-set completedDate when status changes to completed
    if (body.status === "completed" && !existing.completedDate) {
      updates.completedDate = new Date()
    }
  }
  if (body.priority !== undefined) updates.priority = body.priority
  if (body.notes !== undefined) updates.notes = body.notes?.trim() || null
  if (body.scheduledDate !== undefined) {
    updates.scheduledDate = body.scheduledDate
      ? new Date(body.scheduledDate)
      : null
  }

  const [workOrder] = await db
    .update(workOrders)
    .set(updates)
    .where(eq(workOrders.id, id))
    .returning()

  return NextResponse.json({ workOrder })
}
