import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { db } from "@/db"
import { payments, tenantUnits } from "@/db/schema"
import { eq, and, desc } from "drizzle-orm"
import { PaymentHistoryTable } from "@/components/tenant/PaymentHistoryTable"
import Link from "next/link"

export default async function PaymentHistoryPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return null

  // Get tenant's active unit
  const [link] = await db
    .select()
    .from(tenantUnits)
    .where(and(eq(tenantUnits.userId, session.user.id), eq(tenantUnits.isActive, true)))

  if (!link) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Payment History</h1>
        <p className="mt-2 text-gray-600">Your account is not linked to a unit.</p>
      </div>
    )
  }

  // Fetch all payments for this tenant+unit, most recent first
  const allPayments = await db
    .select()
    .from(payments)
    .where(and(eq(payments.tenantUserId, session.user.id), eq(payments.unitId, link.unitId)))
    .orderBy(desc(payments.createdAt))

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Payment History</h1>
        <Link
          href="/tenant/dashboard"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Back to Dashboard
        </Link>
      </div>
      <div className="mt-6">
        <PaymentHistoryTable payments={allPayments} />
      </div>
    </div>
  )
}
