import { auth } from "@/lib/auth"
import { headers, cookies } from "next/headers"
import { redirect } from "next/navigation"
import { NotificationBell } from "@/components/ui/NotificationBell"
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar"
import { AdminSidebar } from "@/components/admin/AdminSidebar"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Full server-side session validation -- catches expired/invalidated sessions
  // Defense-in-depth: middleware also checks, but layout validates authoritatively
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

  // Read sidebar state from cookie (default to open if not set)
  const cookieStore = await cookies()
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false"

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AdminSidebar user={session.user} />
      <SidebarInset>
        <header className="flex items-center gap-2 border-b px-4 py-3">
          <SidebarTrigger />
          <span className="font-semibold text-gray-900">Admin Portal</span>
          <div className="ml-auto flex items-center gap-4">
            <NotificationBell apiUrl="/api/admin/notifications" inboxUrl="/admin/notifications" />
            <span className="text-sm text-gray-500">{session.user.email}</span>
          </div>
        </header>
        <main className="container mx-auto px-6 py-8">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
