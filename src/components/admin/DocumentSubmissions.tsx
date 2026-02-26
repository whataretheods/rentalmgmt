"use client"

import { useState, useEffect, useCallback } from "react"

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  government_id: "Government ID",
  proof_of_income_insurance: "Proof of Income / Insurance",
  general: "General / Other",
}

interface DocumentRequestRow {
  id: string
  tenantUserId: string
  tenantName: string | null
  tenantEmail: string | null
  documentType: string
  message: string | null
  status: string
  createdAt: string
  fulfilledAt: string | null
}

type StatusFilter = "all" | "pending" | "submitted"

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

interface DocumentSubmissionsProps {
  refreshKey: number
}

export function DocumentSubmissions({ refreshKey }: DocumentSubmissionsProps) {
  const [requests, setRequests] = useState<DocumentRequestRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<StatusFilter>("all")

  const fetchRequests = useCallback(async () => {
    try {
      const res = await fetch("/api/documents/requests")
      if (res.ok) {
        const data = await res.json()
        setRequests(data.requests || [])
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests, refreshKey])

  const filtered =
    filter === "all" ? requests : requests.filter((r) => r.status === filter)

  if (loading) {
    return <p className="text-sm text-gray-500">Loading submissions...</p>
  }

  return (
    <div>
      {/* Filter tabs */}
      <div className="mb-4 flex gap-2">
        {(["all", "pending", "submitted"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-md px-3 py-1 text-sm font-medium ${
              filter === f
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {f === "all" ? "All" : f === "pending" ? "Pending" : "Submitted"}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-500">No document requests found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="pb-2 pr-4 font-medium">Tenant</th>
                <th className="pb-2 pr-4 font-medium">Document Type</th>
                <th className="pb-2 pr-4 font-medium">Requested</th>
                <th className="pb-2 pr-4 font-medium">Status</th>
                <th className="pb-2 font-medium">Fulfilled</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((req) => (
                <tr key={req.id} className="border-b">
                  <td className="py-3 pr-4">
                    <div>
                      <p className="font-medium text-gray-900">
                        {req.tenantName || "Unknown"}
                      </p>
                      <p className="text-xs text-gray-500">
                        {req.tenantEmail || ""}
                      </p>
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-gray-700">
                    {DOCUMENT_TYPE_LABELS[req.documentType] ||
                      req.documentType}
                  </td>
                  <td className="py-3 pr-4 text-gray-500">
                    {formatDate(req.createdAt)}
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        req.status === "submitted"
                          ? "bg-green-100 text-green-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {req.status === "submitted" ? "Submitted" : "Pending"}
                    </span>
                  </td>
                  <td className="py-3 text-gray-500">
                    {req.fulfilledAt ? formatDate(req.fulfilledAt) : "--"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
