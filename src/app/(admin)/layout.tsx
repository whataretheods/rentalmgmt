import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import Link from "next/link"
import { NotificationBell } from "@/components/ui/NotificationBell"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Full server-side session validation -- catches expired/invalidated sessions
  const session = await auth.api.getSession({ headers: await headers() })

  // Not authenticated -> login
  if (!session) {
    redirect("/auth/login")
  }

  // Authenticated but not admin -> tenant dashboard
  // CRITICAL: check role from session, never from client-passed params
  if (session.user.role !== "admin") {
    redirect("/tenant/dashboard")
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <span className="font-semibold text-gray-900">Admin Portal</span>
        <div className="flex items-center gap-4">
          <NotificationBell apiUrl="/api/admin/notifications" inboxUrl="/admin/notifications" />
          <span className="text-sm text-gray-500">{session.user.email}</span>
        </div>
      </header>
      <nav className="bg-white border-b px-6 py-2">
        <div className="flex items-center gap-4">
          <Link href="/admin/dashboard" className="text-sm text-gray-600 hover:text-gray-900">Dashboard</Link>
          <Link href="/admin/units" className="text-sm text-gray-600 hover:text-gray-900">Units</Link>
          <Link href="/admin/payments" className="text-sm text-gray-600 hover:text-gray-900">Payments</Link>
          <Link href="/admin/maintenance" className="text-sm text-gray-600 hover:text-gray-900">Maintenance</Link>
          <Link href="/admin/documents" className="text-sm text-gray-600 hover:text-gray-900">Documents</Link>
          <Link href="/admin/users" className="text-sm text-gray-600 hover:text-gray-900">Users</Link>
          <Link href="/admin/invites" className="text-sm text-gray-600 hover:text-gray-900">Invites</Link>
          <Link href="/admin/notifications" className="text-sm text-gray-600 hover:text-gray-900">Notifications</Link>
          <Link href="/admin/broadcast" className="text-sm text-gray-600 hover:text-gray-900">Broadcast</Link>
        </div>
      </nav>
      <main className="container mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  )
}
