import Link from "next/link"
import { Button } from "@/components/ui/button"
import { MaintenanceRequestList } from "@/components/tenant/MaintenanceRequestList"
import { Plus } from "lucide-react"

export default function MaintenancePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          Maintenance Requests
        </h1>
        <Button asChild size="sm">
          <Link href="/tenant/maintenance/new">
            <Plus className="size-4" />
            New Request
          </Link>
        </Button>
      </div>
      <MaintenanceRequestList />
    </div>
  )
}
