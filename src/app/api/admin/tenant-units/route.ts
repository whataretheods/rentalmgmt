import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { db } from "@/db"
import { tenantUnits, units, user } from "@/db/schema"
import { eq, inArray } from "drizzle-orm"

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Get all active tenant-unit links
  const activeLinks = await db
    .select({
      userId: tenantUnits.userId,
      unitId: tenantUnits.unitId,
    })
    .from(tenantUnits)
    .where(eq(tenantUnits.isActive, true))

  if (activeLinks.length === 0) {
    return NextResponse.json({ tenantUnits: [] })
  }

  // Get unit numbers
  const unitIds = [...new Set(activeLinks.map((l) => l.unitId))]
  const unitData = await db
    .select({ id: units.id, unitNumber: units.unitNumber })
    .from(units)
    .where(inArray(units.id, unitIds))

  const unitMap = new Map(unitData.map((u) => [u.id, u.unitNumber]))

  // Get user names and emails
  const userIds = [...new Set(activeLinks.map((l) => l.userId))]
  const userData = await db
    .select({ id: user.id, name: user.name, email: user.email })
    .from(user)
    .where(inArray(user.id, userIds))

  const userMap = new Map(
    userData.map((u) => [u.id, { name: u.name, email: u.email }])
  )

  // Combine into tenant-unit pairs
  const result = activeLinks
    .map((link) => {
      const u = userMap.get(link.userId)
      return {
        tenantUserId: link.userId,
        unitId: link.unitId,
        tenantName: u?.name || "Unknown",
        tenantEmail: u?.email || "",
        unitNumber: unitMap.get(link.unitId) || "",
      }
    })
    .filter((p) => p.tenantEmail) // Only include tenants with email
    .sort((a, b) => a.unitNumber.localeCompare(b.unitNumber))

  return NextResponse.json({ tenantUnits: result })
}
