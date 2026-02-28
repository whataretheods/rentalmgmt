import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { db } from "@/db"
import {
  workOrders,
  vendors,
  maintenanceRequests,
  units,
} from "@/db/schema"
import { eq, desc, and, sql } from "drizzle-orm"
import crypto from "crypto"
import { notifyVendorAssignment } from "@/lib/vendor-notifications"

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const url = new URL(req.url)
  const statusFilter = url.searchParams.get("status")
  const vendorIdFilter = url.searchParams.get("vendorId")

  const conditions = []
  if (statusFilter) {
    conditions.push(
      eq(
        workOrders.status,
        statusFilter as "assigned" | "scheduled" | "in_progress" | "completed" | "cancelled"
      )
    )
  }
  if (vendorIdFilter) {
    conditions.push(eq(workOrders.vendorId, vendorIdFilter))
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const result = await db
    .select({
      id: workOrders.id,
      maintenanceRequestId: workOrders.maintenanceRequestId,
      vendorId: workOrders.vendorId,
      assignedByUserId: workOrders.assignedByUserId,
      status: workOrders.status,
      priority: workOrders.priority,
      scheduledDate: workOrders.scheduledDate,
      completedDate: workOrders.completedDate,
      notes: workOrders.notes,
      vendorAccessToken: workOrders.vendorAccessToken,
      createdAt: workOrders.createdAt,
      updatedAt: workOrders.updatedAt,
      // Joined data
      vendorCompanyName: vendors.companyName,
      requestCategory: maintenanceRequests.category,
      requestDescription: maintenanceRequests.description,
      requestStatus: maintenanceRequests.status,
      unitId: maintenanceRequests.unitId,
      unitNumber: units.unitNumber,
    })
    .from(workOrders)
    .leftJoin(vendors, eq(workOrders.vendorId, vendors.id))
    .innerJoin(
      maintenanceRequests,
      eq(workOrders.maintenanceRequestId, maintenanceRequests.id)
    )
    .innerJoin(units, eq(maintenanceRequests.unitId, units.id))
    .where(whereClause)
    .orderBy(desc(workOrders.createdAt))

  return NextResponse.json({ workOrders: result })
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const { maintenanceRequestId, vendorId, priority, notes, scheduledDate } = body

  if (!maintenanceRequestId) {
    return NextResponse.json(
      { error: "Maintenance request ID is required" },
      { status: 400 }
    )
  }

  // Verify maintenance request exists
  const [maintReq] = await db
    .select({
      id: maintenanceRequests.id,
      category: maintenanceRequests.category,
      unitId: maintenanceRequests.unitId,
    })
    .from(maintenanceRequests)
    .where(eq(maintenanceRequests.id, maintenanceRequestId))

  if (!maintReq) {
    return NextResponse.json(
      { error: "Maintenance request not found" },
      { status: 404 }
    )
  }

  // Get unit info for notification summary
  const [unit] = await db
    .select({ unitNumber: units.unitNumber })
    .from(units)
    .where(eq(units.id, maintReq.unitId))

  // Verify vendor if provided
  let vendor = null
  if (vendorId) {
    const [v] = await db
      .select()
      .from(vendors)
      .where(eq(vendors.id, vendorId))
    if (!v) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 })
    }
    if (v.status !== "active") {
      return NextResponse.json(
        { error: "Vendor is inactive" },
        { status: 400 }
      )
    }
    vendor = v
  }

  const vendorAccessToken = crypto.randomUUID()

  const [workOrder] = await db
    .insert(workOrders)
    .values({
      maintenanceRequestId,
      vendorId: vendorId || null,
      assignedByUserId: session.user.id,
      priority: priority || "medium",
      notes: notes?.trim() || null,
      scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
      vendorAccessToken,
    })
    .returning()

  // Notify vendor if assigned
  if (vendor) {
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    const workOrderUrl = `${appUrl}/vendor/work-order/${vendorAccessToken}`
    const requestSummary = `${maintReq.category} - Unit ${unit?.unitNumber || "Unknown"}`
    await notifyVendorAssignment(
      {
        email: vendor.email,
        phone: vendor.phone,
        companyName: vendor.companyName,
      },
      workOrderUrl,
      requestSummary
    )
  }

  return NextResponse.json({ workOrder }, { status: 201 })
}
