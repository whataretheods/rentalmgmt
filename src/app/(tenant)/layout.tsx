import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import Link from "next/link"
import { NotificationBell } from "@/components/ui/NotificationBell"

export default async function TenantLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Full server-side session validation -- not just cookie existence
  // This runs in Node.js runtime (Server Component), not Edge
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session) {
    redirect("/auth/login")
  }

  // Tenants have role "user" -- admins should use the admin portal
  // If an admin navigates to /tenant/dashboard, let them in (they have a session)
  // The admin layout enforces admin-only access for /admin/* routes

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <span className="font-semibold text-gray-900">Tenant Portal</span>
        <div className="flex items-center gap-4">
          <NotificationBell apiUrl="/api/notifications" inboxUrl="/tenant/notifications" />
          <span className="text-sm text-gray-500">{session.user.email}</span>
        </div>
      </header>
      <nav className="bg-white border-b px-6 py-2">
        <div className="flex items-center gap-4">
          <Link href="/tenant/dashboard" className="text-sm text-gray-600 hover:text-gray-900">Dashboard</Link>
          <Link href="/tenant/payments" className="text-sm text-gray-600 hover:text-gray-900">Payments</Link>
          <Link href="/tenant/maintenance" className="text-sm text-gray-600 hover:text-gray-900">Maintenance</Link>
          <Link href="/tenant/documents" className="text-sm text-gray-600 hover:text-gray-900">Documents</Link>
          <Link href="/tenant/profile" className="text-sm text-gray-600 hover:text-gray-900">Profile</Link>
          <Link href="/tenant/notifications" className="text-sm text-gray-600 hover:text-gray-900">Notifications</Link>
        </div>
      </nav>
      <main className="container mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  )
}
