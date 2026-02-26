"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  government_id: "Government ID",
  proof_of_income_insurance: "Proof of Income / Insurance",
  general: "General / Other",
}

interface TenantOption {
  id: string
  name: string
  email: string
}

interface DocumentRequestFormProps {
  onRequestCreated: () => void
}

export function DocumentRequestForm({
  onRequestCreated,
}: DocumentRequestFormProps) {
  const [tenants, setTenants] = useState<TenantOption[]>([])
  const [tenantUserId, setTenantUserId] = useState("")
  const [documentType, setDocumentType] = useState("government_id")
  const [message, setMessage] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [loadingTenants, setLoadingTenants] = useState(true)

  useEffect(() => {
    async function fetchTenants() {
      try {
        const res = await fetch("/api/auth/admin/list-users?limit=100", {
          method: "GET",
        })
        if (res.ok) {
          const data = await res.json()
          // Better Auth admin listUsers returns { users: [...] }
          const users = data.users || []
          setTenants(
            users
              .filter((u: { role?: string }) => u.role !== "admin")
              .map((u: { id: string; name: string; email: string }) => ({
                id: u.id,
                name: u.name,
                email: u.email,
              }))
          )
        }
      } catch {
        // Silently fail
      } finally {
        setLoadingTenants(false)
      }
    }
    fetchTenants()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!tenantUserId) {
      toast.error("Please select a tenant")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/documents/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantUserId,
          documentType,
          message: message || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || "Failed to create request")
        return
      }

      toast.success("Document request sent")
      setTenantUserId("")
      setMessage("")
      onRequestCreated()
    } catch {
      toast.error("Failed to create request")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="tenant">Tenant</Label>
        <select
          id="tenant"
          value={tenantUserId}
          onChange={(e) => setTenantUserId(e.target.value)}
          className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
          disabled={loadingTenants}
        >
          <option value="">
            {loadingTenants ? "Loading tenants..." : "Select a tenant"}
          </option>
          {tenants.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.email})
            </option>
          ))}
        </select>
      </div>

      <div>
        <Label htmlFor="docType">Document Type</Label>
        <select
          id="docType"
          value={documentType}
          onChange={(e) => setDocumentType(e.target.value)}
          className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
        >
          {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <Label htmlFor="message">Message (optional)</Label>
        <textarea
          id="message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Add a note for the tenant..."
          maxLength={500}
          rows={3}
          className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>

      <Button type="submit" disabled={submitting || !tenantUserId}>
        {submitting ? "Sending..." : "Request Document"}
      </Button>
    </form>
  )
}
