"use client"

import dynamic from "next/dynamic"

const MaintenanceKanban = dynamic(
  () => import("@/components/admin/MaintenanceKanban"),
  {
    ssr: false,
    loading: () => (
      <div className="p-8 text-center text-gray-400">
        Loading kanban board...
      </div>
    ),
  }
)

export default function AdminMaintenancePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Maintenance Requests
        </h1>
        <p className="text-sm text-muted-foreground">
          Drag cards between columns to update request status.
        </p>
      </div>
      <MaintenanceKanban />
    </div>
  )
}
