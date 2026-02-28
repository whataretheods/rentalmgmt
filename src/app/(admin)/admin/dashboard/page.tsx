import Link from "next/link"
import { getKpiMetrics } from "@/lib/kpi-queries"
import { KpiCard } from "@/components/admin/KpiCard"
import {
  DollarSign,
  TrendingUp,
  Building,
  Wrench,
  AlertTriangle,
} from "lucide-react"

export const dynamic = "force-dynamic"

export default async function AdminDashboard() {
  const metrics = await getKpiMetrics()

  const formattedCollectionRate = `${metrics.collectionRate}%`
  const formattedOutstanding = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(metrics.totalOutstandingCents / 100)
  const formattedOccupancy = `${metrics.occupancyRate}%`
  const formattedMaintenance = `${metrics.openMaintenanceCount}`
  const formattedOverdue = `${metrics.overdueTenantsCount}`

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-600">
          Portfolio overview for{" "}
          {new Date().toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>

      {/* KPI Grid -- 1 col on mobile, 2 on sm, 3 on lg */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          title="Collection Rate"
          value={formattedCollectionRate}
          subtitle="Current billing period"
          icon={TrendingUp}
          iconBgColor="bg-green-100"
          iconColor="text-green-600"
        />
        <KpiCard
          title="Total Outstanding"
          value={formattedOutstanding}
          subtitle="Unpaid rent this period"
          icon={DollarSign}
          iconBgColor="bg-red-100"
          iconColor="text-red-600"
        />
        <KpiCard
          title="Occupancy Rate"
          value={formattedOccupancy}
          subtitle="Units with active tenants"
          icon={Building}
          iconBgColor="bg-blue-100"
          iconColor="text-blue-600"
        />
        <KpiCard
          title="Open Requests"
          value={formattedMaintenance}
          subtitle="Unresolved maintenance"
          icon={Wrench}
          iconBgColor="bg-amber-100"
          iconColor="text-amber-600"
        />
        <KpiCard
          title="Overdue Tenants"
          value={formattedOverdue}
          subtitle="Past due day, no payment"
          icon={AlertTriangle}
          iconBgColor="bg-orange-100"
          iconColor="text-orange-600"
        />
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link
            href="/admin/users"
            className="inline-flex items-center rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
          >
            View Users
          </Link>
          <Link
            href="/admin/units"
            className="inline-flex items-center rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
          >
            Manage Units
          </Link>
          <Link
            href="/admin/payments"
            className="inline-flex items-center rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
          >
            Payment Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
