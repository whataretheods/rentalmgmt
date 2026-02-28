import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { db } from "@/db"
import {
  units,
  tenantUnits,
  payments,
  autopayEnrollments,
  maintenanceRequests,
  documentRequests,
  notifications,
} from "@/db/schema"
import { eq, and, desc, count, isNull } from "drizzle-orm"
import { getTenantBalance } from "@/lib/ledger"
import { BalanceCard } from "@/components/tenant/BalanceCard"
import { PayRentButton } from "@/components/tenant/PayRentButton"
import { PaymentSummaryCard } from "@/components/tenant/PaymentSummaryCard"
import { AutopayStatusCard } from "@/components/tenant/AutopayStatusCard"
import { DashboardMaintenance } from "@/components/tenant/DashboardMaintenance"
import { DashboardNotifications } from "@/components/tenant/DashboardNotifications"
import { InviteTokenEntry } from "@/components/tenant/InviteTokenEntry"
import { ReadOnlyBanner } from "@/components/tenant/ReadOnlyBanner"

export default async function TenantDashboard() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return null // layout handles redirect

  // Check for active tenancy
  const [activeLink] = await db
    .select()
    .from(tenantUnits)
    .where(
      and(
        eq(tenantUnits.userId, session.user.id),
        eq(tenantUnits.isActive, true)
      )
    )

  // Check for past tenancies (moved-out)
  const pastLinks = await db
    .select()
    .from(tenantUnits)
    .where(
      and(
        eq(tenantUnits.userId, session.user.id),
        eq(tenantUnits.isActive, false)
      )
    )
    .orderBy(desc(tenantUnits.endDate))

  // STATE C: No unit at all -- show invite token entry
  if (!activeLink && pastLinks.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-2 text-gray-600">
            Welcome to the tenant portal! Link your account to your unit to get
            started.
          </p>
        </div>
        <InviteTokenEntry />
      </div>
    )
  }

  // Determine which link and mode to use
  const link = activeLink || pastLinks[0] // Use active, or most recent past
  const isReadOnly = !activeLink // Read-only if no active link

  // Get unit details
  const [unit] = await db
    .select()
    .from(units)
    .where(eq(units.id, link.unitId))

  // Compute running balance and pending payments (works for both active and past tenants)
  const { balanceCents, pendingPaymentsCents } = await getTenantBalance(session.user.id, link.unitId)

  // Get most recent payment
  const [lastPayment] = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.tenantUserId, session.user.id),
        eq(payments.unitId, link.unitId)
      )
    )
    .orderBy(desc(payments.createdAt))
    .limit(1)

  // Get autopay enrollment (only relevant for active tenants)
  const [enrollment] = isReadOnly
    ? [undefined]
    : await db
        .select()
        .from(autopayEnrollments)
        .where(eq(autopayEnrollments.tenantUserId, session.user.id))

  // Get recent maintenance requests
  const recentMaintenance = await db
    .select({
      id: maintenanceRequests.id,
      category: maintenanceRequests.category,
      description: maintenanceRequests.description,
      status: maintenanceRequests.status,
      createdAt: maintenanceRequests.createdAt,
    })
    .from(maintenanceRequests)
    .where(eq(maintenanceRequests.tenantUserId, session.user.id))
    .orderBy(desc(maintenanceRequests.createdAt))
    .limit(3)

  // Get pending document requests count (only for active tenants)
  const [docReqCount] = isReadOnly
    ? [{ value: 0 }]
    : await db
        .select({ value: count() })
        .from(documentRequests)
        .where(
          and(
            eq(documentRequests.tenantUserId, session.user.id),
            eq(documentRequests.status, "pending")
          )
        )

  // Get recent notifications
  const recentNotifications = await db
    .select({
      id: notifications.id,
      title: notifications.title,
      body: notifications.body,
      type: notifications.type,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, session.user.id),
        eq(notifications.channel, "in_app")
      )
    )
    .orderBy(desc(notifications.createdAt))
    .limit(5)

  // Get unread notification count
  const [unread] = await db
    .select({ value: count() })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, session.user.id),
        eq(notifications.channel, "in_app"),
        isNull(notifications.readAt)
      )
    )

  return (
    <div className="space-y-6">
      {/* Read-only banner for past tenants */}
      {isReadOnly && (
        <ReadOnlyBanner
          unitNumber={unit?.unitNumber ?? "Unknown"}
          endDate={link.endDate}
        />
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-gray-600">
          Unit {unit?.unitNumber}
          {isReadOnly && " (past tenancy)"}
        </p>
      </div>

      {/* Balance Overview */}
      <BalanceCard
        balanceCents={balanceCents}
        pendingPaymentsCents={isReadOnly ? 0 : pendingPaymentsCents}
      />

      {/* TOP SECTION: Payment Status + Autopay (conditional) */}
      <div className="space-y-4">
        <PaymentSummaryCard
          rentAmountCents={unit?.rentAmountCents ?? null}
          rentDueDay={unit?.rentDueDay ?? null}
          lastPayment={
            lastPayment
              ? {
                  amountCents: lastPayment.amountCents,
                  status: lastPayment.status,
                  paidAt: lastPayment.paidAt,
                  paymentMethod: lastPayment.paymentMethod,
                }
              : null
          }
        />
        {!isReadOnly && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <AutopayStatusCard
              enrollment={
                enrollment
                  ? {
                      status: enrollment.status,
                      paymentMethodType: enrollment.paymentMethodType,
                      paymentMethodLast4: enrollment.paymentMethodLast4,
                      paymentMethodBrand: enrollment.paymentMethodBrand,
                      nextChargeDate: enrollment.nextChargeDate,
                      enrolledAt: enrollment.enrolledAt,
                    }
                  : null
              }
              rentAmountCents={unit?.rentAmountCents ?? null}
            />
            <div className="flex items-stretch">
              <div className="w-full flex flex-col justify-center rounded-lg border bg-white p-4">
                <PayRentButton
                  unitId={link.unitId}
                  rentAmountCents={unit?.rentAmountCents ?? null}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MIDDLE SECTION: Maintenance + Documents */}
      <DashboardMaintenance
        recentRequests={recentMaintenance}
        pendingDocumentRequests={isReadOnly ? 0 : (docReqCount?.value ?? 0)}
      />

      {/* BOTTOM SECTION: Notifications */}
      <DashboardNotifications
        recentNotifications={recentNotifications}
        unreadCount={unread?.value ?? 0}
      />
    </div>
  )
}
