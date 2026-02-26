"use client"

import { useState, useEffect, useCallback } from "react"
import { DocumentUpload } from "@/components/tenant/DocumentUpload"
import { FileText } from "lucide-react"
import { Button } from "@/components/ui/button"

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  government_id: "Government ID",
  proof_of_income_insurance: "Proof of Income / Insurance",
  general: "General / Other",
}

interface Document {
  id: string
  tenantUserId: string
  documentType: string
  filePath: string
  fileName: string
  fileSize: number
  mimeType: string
  requestId: string | null
  createdAt: string
}

interface DocumentRequest {
  id: string
  tenantUserId: string
  documentType: string
  message: string | null
  status: string
  createdAt: string
  fulfilledAt: string | null
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function DocumentList() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [requests, setRequests] = useState<DocumentRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [fulfillingRequestId, setFulfillingRequestId] = useState<string | null>(
    null
  )

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch("/api/documents")
      if (res.ok) {
        const data = await res.json()
        setDocuments(data.documents || [])
        setRequests(data.requests || [])
      }
    } catch {
      // Silently fail -- user sees empty state
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  function handleUploaded() {
    setFulfillingRequestId(null)
    fetchDocuments()
  }

  const pendingRequests = requests.filter((r) => r.status === "pending")

  if (loading) {
    return <p className="text-sm text-gray-500">Loading documents...</p>
  }

  return (
    <div className="space-y-8">
      {/* Pending Document Requests from Admin */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900">
          Requested Documents
        </h2>
        {pendingRequests.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">
            No pending document requests.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {pendingRequests.map((request) => (
              <div
                key={request.id}
                className="rounded-lg border border-yellow-200 bg-yellow-50 p-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-gray-900">
                      {DOCUMENT_TYPE_LABELS[request.documentType] ||
                        request.documentType}
                    </p>
                    {request.message && (
                      <p className="mt-1 text-sm text-gray-600">
                        {request.message}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-gray-500">
                      Requested {formatDate(request.createdAt)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() =>
                      setFulfillingRequestId(
                        fulfillingRequestId === request.id
                          ? null
                          : request.id
                      )
                    }
                  >
                    {fulfillingRequestId === request.id ? "Cancel" : "Upload"}
                  </Button>
                </div>
                {fulfillingRequestId === request.id && (
                  <div className="mt-4 rounded-md border bg-white p-4">
                    <DocumentUpload
                      onUploaded={handleUploaded}
                      requestId={request.id}
                      preselectedType={request.documentType}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Uploaded Documents */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900">My Documents</h2>
        {documents.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">
            No documents uploaded yet.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between rounded-lg border bg-white p-3"
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {doc.fileName}
                    </p>
                    <p className="text-xs text-gray-500">
                      {DOCUMENT_TYPE_LABELS[doc.documentType] ||
                        doc.documentType}{" "}
                      &middot; {formatFileSize(doc.fileSize)} &middot;{" "}
                      {formatDate(doc.createdAt)}
                    </p>
                  </div>
                </div>
                <a
                  href={`/api/documents/${doc.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-blue-600 hover:text-blue-800"
                >
                  Download
                </a>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
