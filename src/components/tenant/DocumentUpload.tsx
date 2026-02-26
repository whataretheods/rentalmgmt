"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25MB
const ACCEPTED_EXTENSIONS = ".pdf,.jpg,.jpeg,.png,.heic,.doc,.docx"

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  government_id: "Government ID",
  proof_of_income_insurance: "Proof of Income / Insurance",
  general: "General / Other",
}

interface DocumentUploadProps {
  onUploaded: () => void
  requestId?: string
  preselectedType?: string
}

export function DocumentUpload({
  onUploaded,
  requestId,
  preselectedType,
}: DocumentUploadProps) {
  const [documentType, setDocumentType] = useState(
    preselectedType || "general"
  )
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) {
      setSelectedFile(null)
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      toast.error(
        `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Maximum is 25MB.`
      )
      e.target.value = ""
      setSelectedFile(null)
      return
    }

    setSelectedFile(file)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!selectedFile) {
      toast.error("Please select a file to upload")
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", selectedFile)
      formData.append("documentType", documentType)
      if (requestId) {
        formData.append("requestId", requestId)
      }

      const res = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || "Upload failed")
        return
      }

      toast.success("Document uploaded successfully")
      setSelectedFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
      onUploaded()
    } catch {
      toast.error("Failed to upload document. Please try again.")
    } finally {
      setUploading(false)
    }
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="documentType">Document Type</Label>
        <select
          id="documentType"
          value={documentType}
          onChange={(e) => setDocumentType(e.target.value)}
          disabled={!!preselectedType}
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
        <Label htmlFor="file">File</Label>
        <input
          ref={fileInputRef}
          id="file"
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          onChange={handleFileChange}
          className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:rounded-md file:border-0 file:bg-gray-100 file:px-4 file:py-2 file:text-sm file:font-medium hover:file:bg-gray-200"
        />
        <p className="mt-1 text-xs text-gray-500">
          PDF, JPG, PNG, HEIC, or Word docs. Max 25MB.
        </p>
      </div>

      {selectedFile && (
        <div className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">
          <span className="font-medium">{selectedFile.name}</span>
          <span className="ml-2 text-gray-500">
            ({formatFileSize(selectedFile.size)})
          </span>
        </div>
      )}

      <Button type="submit" disabled={uploading || !selectedFile}>
        {uploading ? "Uploading..." : "Upload Document"}
      </Button>
    </form>
  )
}
