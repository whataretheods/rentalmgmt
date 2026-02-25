import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

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
        <span className="text-sm text-gray-500">{session.user.email}</span>
      </header>
      <main className="container mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  )
}
