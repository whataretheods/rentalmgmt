import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

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
        <span className="text-sm text-gray-500">{session.user.email}</span>
      </header>
      <main className="container mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  )
}
