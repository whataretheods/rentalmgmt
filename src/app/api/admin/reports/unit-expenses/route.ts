import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { db } from "@/db"
import {
  workOrderCosts,
  workOrders,
  maintenanceRequests,
  units,
  properties,
} from "@/db/schema"
import { eq, desc, sql } from "drizzle-orm"

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const expenses = await db
    .select({
      unitId: units.id,
      unitNumber: units.unitNumber,
      propertyName: properties.name,
      totalCostCents: sql<number>`COALESCE(SUM(${workOrderCosts.amountCents}), 0)`,
      laborCostCents: sql<number>`COALESCE(SUM(CASE WHEN ${workOrderCosts.category} = 'labor' THEN ${workOrderCosts.amountCents} ELSE 0 END), 0)`,
      materialsCostCents: sql<number>`COALESCE(SUM(CASE WHEN ${workOrderCosts.category} = 'materials' THEN ${workOrderCosts.amountCents} ELSE 0 END), 0)`,
      workOrderCount: sql<number>`COUNT(DISTINCT ${workOrders.id})`,
    })
    .from(workOrderCosts)
    .innerJoin(workOrders, eq(workOrderCosts.workOrderId, workOrders.id))
    .innerJoin(
      maintenanceRequests,
      eq(workOrders.maintenanceRequestId, maintenanceRequests.id)
    )
    .innerJoin(units, eq(maintenanceRequests.unitId, units.id))
    .innerJoin(properties, eq(units.propertyId, properties.id))
    .groupBy(units.id, units.unitNumber, properties.name)
    .orderBy(desc(sql`COALESCE(SUM(${workOrderCosts.amountCents}), 0)`))

  // Compute grand total
  const grandTotalCents = expenses.reduce(
    (sum, e) => sum + Number(e.totalCostCents),
    0
  )

  return NextResponse.json({
    expenses: expenses.map((e) => ({
      ...e,
      totalCostCents: Number(e.totalCostCents),
      laborCostCents: Number(e.laborCostCents),
      materialsCostCents: Number(e.materialsCostCents),
      workOrderCount: Number(e.workOrderCount),
    })),
    grandTotalCents,
  })
}
