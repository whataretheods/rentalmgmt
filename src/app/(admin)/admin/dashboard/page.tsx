import Link from "next/link"

export default function AdminDashboard() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
      <p className="mt-2 text-gray-600">
        Admin portal is active. Payment dashboard and tenant management arrive in Phase 3.
      </p>
      <div className="mt-6">
        <Link
          href="/admin/users"
          className="inline-flex items-center rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
        >
          View Users
        </Link>
      </div>
    </div>
  )
}
