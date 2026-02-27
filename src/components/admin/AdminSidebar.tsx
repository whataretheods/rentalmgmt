"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  Wrench,
  FileText,
  Users,
  Mail,
  Bell,
  Megaphone,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const navItems = [
  { title: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { title: "Units", href: "/admin/units", icon: Building2 },
  { title: "Payments", href: "/admin/payments", icon: CreditCard },
  { title: "Maintenance", href: "/admin/maintenance", icon: Wrench },
  { title: "Documents", href: "/admin/documents", icon: FileText },
  { title: "Users", href: "/admin/users", icon: Users },
  { title: "Invites", href: "/admin/invites", icon: Mail },
  { title: "Notifications", href: "/admin/notifications", icon: Bell },
  { title: "Broadcast", href: "/admin/broadcast", icon: Megaphone },
]

interface AdminSidebarProps {
  user: {
    email: string
    name?: string | null
  }
}

export function AdminSidebar({ user }: AdminSidebarProps) {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b px-4 py-3">
        <span className="text-sm font-semibold truncate">Admin Portal</span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.href || pathname.startsWith(item.href + "/")}
                    tooltip={item.title}
                  >
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t px-4 py-3">
        <span className="text-xs text-muted-foreground truncate">
          {user.name || user.email}
        </span>
      </SidebarFooter>
    </Sidebar>
  )
}
