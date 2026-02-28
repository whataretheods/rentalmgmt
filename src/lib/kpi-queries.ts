import { db } from "@/db"
import { units, tenantUnits, payments, maintenanceRequests } from "@/db/schema"
import { eq, ne, and, sql, isNotNull } from "drizzle-orm"

export interface KpiMetrics {
  collectionRate: number       // percentage 0-100
  totalOutstandingCents: number // total unpaid amount in cents
  occupancyRate: number        // percentage 0-100
  openMaintenanceCount: number // count of non-resolved requests
  overdueTenantsCount: number  // count of tenants past due with no payment
}

export async function getKpiMetrics(): Promise<KpiMetrics> {
  const currentPeriod = new Date().toISOString().slice(0, 7) // "2026-02"
  const currentDay = new Date().getDate()

  const [occupancy, maintenance, collection] = await Promise.all([
    getOccupancyMetrics(),
    getMaintenanceMetrics(),
    getCollectionMetrics(currentPeriod, currentDay),
  ])

  return { ...occupancy, ...maintenance, ...collection }
}

async function getOccupancyMetrics(): Promise<{ occupancyRate: number }> {
  const [totalResult, occupiedResult] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(units),
    db
      .select({ count: sql<number>`count(distinct ${tenantUnits.unitId})::int` })
      .from(tenantUnits)
      .where(eq(tenantUnits.isActive, true)),
  ])

  const totalUnits = totalResult[0]?.count ?? 0
  const occupiedUnits = occupiedResult[0]?.count ?? 0

  return {
    occupancyRate: totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0,
  }
}

async function getMaintenanceMetrics(): Promise<{ openMaintenanceCount: number }> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(maintenanceRequests)
    .where(ne(maintenanceRequests.status, "resolved"))

  return {
    openMaintenanceCount: result[0]?.count ?? 0,
  }
}

async function getCollectionMetrics(
  period: string,
  currentDay: number
): Promise<{
  collectionRate: number
  totalOutstandingCents: number
  overdueTenantsCount: number
}> {
  // Step A: Get all occupied units with rent configured
  const [occupiedUnitsWithRent, paymentTotals] = await Promise.all([
    db
      .select({
        unitId: tenantUnits.unitId,
        rentAmountCents: units.rentAmountCents,
        rentDueDay: units.rentDueDay,
      })
      .from(tenantUnits)
      .innerJoin(units, eq(tenantUnits.unitId, units.id))
      .where(
        and(
          eq(tenantUnits.isActive, true),
          isNotNull(units.rentAmountCents)
        )
      ),
    // Step B: Get payment totals per unit for current period
    db
      .select({
        unitId: payments.unitId,
        totalPaid: sql<number>`coalesce(sum(${payments.amountCents}), 0)::int`,
      })
      .from(payments)
      .where(
        and(
          eq(payments.billingPeriod, period),
          eq(payments.status, "succeeded")
        )
      )
      .groupBy(payments.unitId),
  ])

  // Step C: Compute metrics in JS
  const paymentMap = new Map<string, number>()
  for (const row of paymentTotals) {
    paymentMap.set(row.unitId, row.totalPaid)
  }

  let paidCount = 0
  let totalOutstandingCents = 0
  let overdueTenantsCount = 0

  for (const unit of occupiedUnitsWithRent) {
    const rentAmount = unit.rentAmountCents ?? 0
    const totalPaid = paymentMap.get(unit.unitId) ?? 0

    if (totalPaid >= rentAmount) {
      paidCount++
    }

    const outstanding = Math.max(rentAmount - totalPaid, 0)
    totalOutstandingCents += outstanding

    // Overdue: past due day AND no payment at all
    const dueDay = unit.rentDueDay ?? 1
    if (currentDay > dueDay && totalPaid === 0) {
      overdueTenantsCount++
    }
  }

  const total = occupiedUnitsWithRent.length
  return {
    collectionRate: total > 0 ? Math.round((paidCount / total) * 100) : 0,
    totalOutstandingCents,
    overdueTenantsCount,
  }
}
