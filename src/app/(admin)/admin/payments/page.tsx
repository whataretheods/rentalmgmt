import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { PaymentDashboard } from "@/components/admin/PaymentDashboard"
import { EmptyState } from "@/components/ui/empty-state"
import { CreditCard } from "lucide-react"

export default async function AdminPaymentsPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return null

  const currentPeriod = new Date().toISOString().slice(0, 7)

  // Fetch initial data server-side
  const baseUrl = process.env.BETTER_AUTH_URL || "http://localhost:3000"
  let initialData = []
  try {
    const res = await fetch(
      `${baseUrl}/api/admin/payments-overview?period=${currentPeriod}`,
      {
        headers: { cookie: (await headers()).get("cookie") || "" },
      }
    )
    if (res.ok) {
      const json = await res.json()
      initialData = json.units
    }
  } catch {
    // Fall back to empty -- client will re-fetch
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Payment Dashboard</h1>
      <p className="mt-2 text-gray-600">
        View payment status for all units. Record manual payments for cash,
        check, or Venmo.
      </p>
      <div className="mt-6">
        {initialData.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title="No payments recorded"
            description="Payments will appear here once tenants start paying rent online or you record manual payments."
          />
        ) : (
          <PaymentDashboard
            initialData={initialData}
            initialPeriod={currentPeriod}
          />
        )}
      </div>
    </div>
  )
}
