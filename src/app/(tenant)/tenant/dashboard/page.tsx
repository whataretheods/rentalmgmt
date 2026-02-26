import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { db } from "@/db"
import { units, tenantUnits, payments } from "@/db/schema"
import { eq, and, desc } from "drizzle-orm"
import { PayRentButton } from "@/components/tenant/PayRentButton"
import { PaymentSummaryCard } from "@/components/tenant/PaymentSummaryCard"
import Link from "next/link"

export default async function TenantDashboard() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return null  // layout handles redirect

  // Get tenant's active unit link
  const [link] = await db
    .select()
    .from(tenantUnits)
    .where(and(eq(tenantUnits.userId, session.user.id), eq(tenantUnits.isActive, true)))

  if (!link) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-2 text-gray-600">
          Your account is not linked to a unit yet. Please contact your landlord for an invite.
        </p>
      </div>
    )
  }

  // Get unit details
  const [unit] = await db.select().from(units).where(eq(units.id, link.unitId))

  // Get most recent payment
  const [lastPayment] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.tenantUserId, session.user.id), eq(payments.unitId, link.unitId)))
    .orderBy(desc(payments.createdAt))
    .limit(1)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-gray-600">Unit {unit?.unitNumber}</p>
      </div>

      {/* Payment Summary Cards */}
      <PaymentSummaryCard
        rentAmountCents={unit?.rentAmountCents ?? null}
        rentDueDay={unit?.rentDueDay ?? null}
        lastPayment={lastPayment ? {
          amountCents: lastPayment.amountCents,
          status: lastPayment.status,
          paidAt: lastPayment.paidAt,
          paymentMethod: lastPayment.paymentMethod,
        } : null}
      />

      {/* Pay Rent Button */}
      <div>
        <PayRentButton
          unitId={link.unitId}
          rentAmountCents={unit?.rentAmountCents ?? null}
        />
      </div>

      {/* Quick Links */}
      <div>
        <Link
          href="/tenant/payments"
          className="text-sm text-blue-600 hover:underline"
        >
          View Payment History
        </Link>
      </div>
    </div>
  )
}
