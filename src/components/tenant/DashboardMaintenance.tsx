import Link from "next/link"

interface DashboardMaintenanceProps {
  recentRequests: Array<{
    id: string
    category: string
    description: string
    status: string
    createdAt: Date
  }>
  pendingDocumentRequests: number
}

const statusStyles: Record<string, string> = {
  submitted: "bg-yellow-100 text-yellow-800",
  acknowledged: "bg-blue-100 text-blue-800",
  in_progress: "bg-purple-100 text-purple-800",
  resolved: "bg-green-100 text-green-800",
}

const statusLabels: Record<string, string> = {
  submitted: "Submitted",
  acknowledged: "Acknowledged",
  in_progress: "In Progress",
  resolved: "Resolved",
}

const categoryLabels: Record<string, string> = {
  plumbing: "Plumbing",
  electrical: "Electrical",
  hvac: "HVAC",
  appliance: "Appliance",
  pest_control: "Pest Control",
  structural: "Structural",
  general: "General",
}

export function DashboardMaintenance({ recentRequests, pendingDocumentRequests }: DashboardMaintenanceProps) {
  return (
    <div className="rounded-lg border bg-white p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">Maintenance & Documents</h3>
        <Link href="/tenant/maintenance" className="text-sm text-blue-600 hover:underline">
          View All
        </Link>
      </div>

      {recentRequests.length === 0 && pendingDocumentRequests === 0 ? (
        <p className="text-sm text-gray-400">No maintenance requests</p>
      ) : (
        <div className="space-y-3">
          {recentRequests.map((req) => (
            <div key={req.id} className="flex items-center justify-between text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-gray-900 truncate">
                  {categoryLabels[req.category] || req.category}
                </p>
                <p className="text-gray-500 truncate">{req.description}</p>
              </div>
              <span
                className={`ml-2 inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[req.status] || "bg-gray-100 text-gray-800"}`}
              >
                {statusLabels[req.status] || req.status}
              </span>
            </div>
          ))}

          {pendingDocumentRequests > 0 && (
            <div className="flex items-center justify-between text-sm border-t pt-3">
              <div>
                <p className="font-medium text-gray-900">
                  {pendingDocumentRequests} pending document {pendingDocumentRequests === 1 ? "request" : "requests"}
                </p>
              </div>
              <Link href="/tenant/documents" className="text-sm text-blue-600 hover:underline">
                Upload
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
