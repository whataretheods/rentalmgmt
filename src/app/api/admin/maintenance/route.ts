import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { db } from "@/db"
import { maintenanceRequests, maintenancePhotos, units } from "@/db/schema"
import { user } from "@/db/schema/auth"
import { eq, and, gte, lte, desc, sql } from "drizzle-orm"

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const url = new URL(req.url)
  const statusFilter = url.searchParams.get("status")
  const unitIdFilter = url.searchParams.get("unitId")
  const dateFrom = url.searchParams.get("dateFrom")
  const dateTo = url.searchParams.get("dateTo")

  // Build dynamic where conditions
  const conditions = []

  if (statusFilter) {
    conditions.push(eq(maintenanceRequests.status, statusFilter as "submitted" | "acknowledged" | "in_progress" | "resolved"))
  }
  if (unitIdFilter) {
    conditions.push(eq(maintenanceRequests.unitId, unitIdFilter))
  }
  if (dateFrom) {
    conditions.push(gte(maintenanceRequests.createdAt, new Date(dateFrom)))
  }
  if (dateTo) {
    // Include entire day by adding a day
    const endDate = new Date(dateTo)
    endDate.setDate(endDate.getDate() + 1)
    conditions.push(lte(maintenanceRequests.createdAt, endDate))
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const requests = await db
    .select({
      id: maintenanceRequests.id,
      category: maintenanceRequests.category,
      description: maintenanceRequests.description,
      status: maintenanceRequests.status,
      unitId: maintenanceRequests.unitId,
      unitNumber: units.unitNumber,
      tenantUserId: maintenanceRequests.tenantUserId,
      tenantName: user.name,
      tenantEmail: user.email,
      createdAt: maintenanceRequests.createdAt,
      updatedAt: maintenanceRequests.updatedAt,
      resolvedAt: maintenanceRequests.resolvedAt,
      photoCount: sql<number>`(
        SELECT count(*)::int FROM ${maintenancePhotos}
        WHERE ${maintenancePhotos.requestId} = ${maintenanceRequests.id}
      )`,
    })
    .from(maintenanceRequests)
    .innerJoin(units, eq(maintenanceRequests.unitId, units.id))
    .innerJoin(user, eq(maintenanceRequests.tenantUserId, user.id))
    .where(whereClause)
    .orderBy(desc(maintenanceRequests.createdAt))

  return NextResponse.json({ requests })
}
