import Link from "next/link"

export default function AdminDashboard() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
      <p className="mt-2 text-gray-600">
        Manage properties, tenants, and payments from one place.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
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
  )
}
