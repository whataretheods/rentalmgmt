import { MaintenanceRequestForm } from "@/components/tenant/MaintenanceRequestForm"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default function NewMaintenanceRequestPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/tenant/maintenance"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2"
        >
          <ArrowLeft className="size-4" />
          Back to requests
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">
          New Maintenance Request
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Describe the issue and we will get it resolved.
        </p>
      </div>
      <MaintenanceRequestForm />
    </div>
  )
}
