"use client"

import { useState } from "react"
import { DocumentRequestForm } from "@/components/admin/DocumentRequestForm"
import { DocumentSubmissions } from "@/components/admin/DocumentSubmissions"

export default function AdminDocumentsPage() {
  const [refreshKey, setRefreshKey] = useState(0)

  function handleRequestCreated() {
    setRefreshKey((k) => k + 1)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Document Management</h1>
      <p className="mt-2 text-gray-600">
        Request documents from tenants and track submissions.
      </p>

      <div className="mt-6 grid gap-8 lg:grid-cols-3">
        {/* Request Form */}
        <div className="lg:col-span-1">
          <div className="rounded-lg border bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Request Document
            </h2>
            <DocumentRequestForm onRequestCreated={handleRequestCreated} />
          </div>
        </div>

        {/* Submissions */}
        <div className="lg:col-span-2">
          <div className="rounded-lg border bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              All Submissions
            </h2>
            <DocumentSubmissions refreshKey={refreshKey} />
          </div>
        </div>
      </div>
    </div>
  )
}
