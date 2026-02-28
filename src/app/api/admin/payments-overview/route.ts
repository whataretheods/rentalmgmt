import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { db } from "@/db"
import { units, properties, tenantUnits, payments, charges, user } from "@/db/schema"
import { eq, and, sql, inArray, isNull } from "drizzle-orm"

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(req.url)
  const period =
    url.searchParams.get("period") || new Date().toISOString().slice(0, 7)

  // 1. Get all active (non-archived) units with properties
  const allUnits = await db
    .select({
      unitId: units.id,
      unitNumber: units.unitNumber,
      propertyName: properties.name,
      rentAmountCents: units.rentAmountCents,
    })
    .from(units)
    .innerJoin(properties, eq(units.propertyId, properties.id))
    .where(and(isNull(units.archivedAt), isNull(properties.archivedAt)))
    .orderBy(units.unitNumber)

  // 2. Get active tenant links
  const activeTenants = await db
    .select({
      unitId: tenantUnits.unitId,
      userId: tenantUnits.userId,
    })
    .from(tenantUnits)
    .where(eq(tenantUnits.isActive, true))

  // 3. Get payment totals per unit for the period
  const periodPayments = await db
    .select({
      unitId: payments.unitId,
      totalPaidCents:
        sql<number>`COALESCE(SUM(CASE WHEN ${payments.status} IN ('succeeded', 'pending') THEN ${payments.amountCents} ELSE 0 END), 0)`.as(
          "total_paid_cents"
        ),
      lastPaymentDate:
        sql<string>`MAX(${payments.paidAt})`.as("last_payment_date"),
      hasPending:
        sql<boolean>`BOOL_OR(${payments.status} = 'pending')`.as(
          "has_pending"
        ),
    })
    .from(payments)
    .where(eq(payments.billingPeriod, period))
    .groupBy(payments.unitId)

  // 3b. Get charge totals per tenant-unit pair (for balance computation)
  const chargeTotals = await db
    .select({
      tenantUserId: charges.tenantUserId,
      unitId: charges.unitId,
      totalChargesCents: sql<number>`COALESCE(SUM(${charges.amountCents}), 0)`.as("total_charges_cents"),
    })
    .from(charges)
    .groupBy(charges.tenantUserId, charges.unitId)

  const chargeMap = new Map(chargeTotals.map(c => [`${c.tenantUserId}:${c.unitId}`, Number(c.totalChargesCents)]))

  // 3c. Get all-time succeeded payment totals per tenant-unit pair (for balance)
  const paymentTotals = await db
    .select({
      tenantUserId: payments.tenantUserId,
      unitId: payments.unitId,
      totalPaidCents: sql<number>`COALESCE(SUM(${payments.amountCents}), 0)`.as("total_paid_cents"),
    })
    .from(payments)
    .where(eq(payments.status, "succeeded"))
    .groupBy(payments.tenantUserId, payments.unitId)

  const totalPaidMap = new Map(paymentTotals.map(p => [`${p.tenantUserId}:${p.unitId}`, Number(p.totalPaidCents)]))

  // 4. Get user names/emails for active tenants using Drizzle schema (type-safe)
  const tenantUserIds = activeTenants.map((t) => t.userId)
  let userMap: Record<string, { name: string | null; email: string }> = {}
  if (tenantUserIds.length > 0) {
    const users = await db
      .select({ id: user.id, name: user.name, email: user.email })
      .from(user)
      .where(inArray(user.id, tenantUserIds))

    for (const u of users) {
      userMap[u.id] = { name: u.name, email: u.email }
    }
  }

  // 5. Combine into response
  const tenantByUnit = new Map(activeTenants.map((t) => [t.unitId, t.userId]))
  const paymentByUnit = new Map(periodPayments.map((p) => [p.unitId, p]))

  const result = allUnits.map((unit) => {
    const tenantUserId = tenantByUnit.get(unit.unitId)
    const usr = tenantUserId ? userMap[tenantUserId] : null
    const paymentData = paymentByUnit.get(unit.unitId)
    const amountPaid = paymentData?.totalPaidCents ?? 0
    const hasPending = paymentData?.hasPending ?? false

    let status: "paid" | "unpaid" | "partial" | "pending" = "unpaid"
    if (hasPending && amountPaid === 0) {
      status = "pending"
    } else if (unit.rentAmountCents && amountPaid >= unit.rentAmountCents) {
      status = "paid"
    } else if (amountPaid > 0) {
      status = hasPending ? "pending" : "partial"
    }

    // Compute running balance: charges - succeeded payments (all-time)
    const balanceKey = tenantUserId ? `${tenantUserId}:${unit.unitId}` : null
    const totalCharges = balanceKey ? (chargeMap.get(balanceKey) ?? 0) : 0
    const totalPaid = balanceKey ? (totalPaidMap.get(balanceKey) ?? 0) : 0
    const balanceCents = totalCharges - totalPaid

    return {
      unitId: unit.unitId,
      unitNumber: unit.unitNumber,
      propertyName: unit.propertyName,
      tenantName: usr?.name || null,
      tenantEmail: usr?.email || null,
      rentAmountCents: unit.rentAmountCents,
      amountPaidCents: amountPaid,
      status,
      balanceCents,
      lastPaymentDate: paymentData?.lastPaymentDate
        ? new Date(paymentData.lastPaymentDate).toLocaleDateString()
        : null,
    }
  })

  return NextResponse.json({ units: result, period })
}
