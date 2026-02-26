"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import {
  Droplets,
  Zap,
  Thermometer,
  Refrigerator,
  Bug,
  HardHat,
  Wrench,
  Send,
  ArrowLeft,
  Clock,
} from "lucide-react"
import Link from "next/link"

interface Photo {
  id: string
  filePath: string
  fileName: string
  mimeType: string
}

interface Comment {
  id: string
  userId: string
  content: string
  isStatusChange: boolean
  createdAt: string
}

interface MaintenanceRequest {
  id: string
  category: string
  description: string
  status: string
  createdAt: string
  updatedAt: string
  resolvedAt: string | null
}

const CATEGORY_CONFIG: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  plumbing: { label: "Plumbing", icon: Droplets },
  electrical: { label: "Electrical", icon: Zap },
  hvac: { label: "HVAC", icon: Thermometer },
  appliance: { label: "Appliance", icon: Refrigerator },
  pest_control: { label: "Pest Control", icon: Bug },
  structural: { label: "Structural", icon: HardHat },
  general: { label: "General", icon: Wrench },
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  submitted: {
    label: "Submitted",
    className: "bg-yellow-100 text-yellow-800",
  },
  acknowledged: {
    label: "Acknowledged",
    className: "bg-blue-100 text-blue-800",
  },
  in_progress: {
    label: "In Progress",
    className: "bg-orange-100 text-orange-800",
  },
  resolved: {
    label: "Resolved",
    className: "bg-green-100 text-green-800",
  },
}

const STATUSES = ["submitted", "acknowledged", "in_progress", "resolved"] as const

interface AdminMaintenanceDetailProps {
  requestId: string
}

export function AdminMaintenanceDetail({
  requestId,
}: AdminMaintenanceDetailProps) {
  const [request, setRequest] = useState<MaintenanceRequest | null>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [commentText, setCommentText] = useState("")
  const [sendingComment, setSendingComment] = useState(false)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  // Status change controls
  const [newStatus, setNewStatus] = useState("")
  const [statusNote, setStatusNote] = useState("")
  const [updatingStatus, setUpdatingStatus] = useState(false)

  const fetchDetail = useCallback(async () => {
    try {
      const res = await fetch(`/api/maintenance/${requestId}`)
      if (res.ok) {
        const data = await res.json()
        setRequest(data.request)
        setPhotos(data.photos)
        setComments(data.comments)
        setNewStatus(data.request.status)
      }
    } catch {
      toast.error("Failed to load request details")
    } finally {
      setLoading(false)
    }
  }, [requestId])

  useEffect(() => {
    fetchDetail()
  }, [fetchDetail])

  async function handleStatusUpdate() {
    if (!newStatus || newStatus === request?.status) return

    setUpdatingStatus(true)
    try {
      const res = await fetch(`/api/maintenance/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          ...(statusNote.trim() ? { note: statusNote.trim() } : {}),
        }),
      })

      if (res.ok) {
        toast.success("Status updated")
        setStatusNote("")
        fetchDetail()
      } else {
        const data = await res.json()
        toast.error(data.error || "Failed to update status")
      }
    } catch {
      toast.error("Something went wrong")
    } finally {
      setUpdatingStatus(false)
    }
  }

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault()
    if (!commentText.trim()) return

    setSendingComment(true)
    try {
      const res = await fetch(`/api/maintenance/${requestId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: commentText.trim() }),
      })

      if (res.ok) {
        const data = await res.json()
        setComments((prev) => [...prev, data.comment])
        setCommentText("")
        toast.success("Comment added")
      } else {
        const data = await res.json()
        toast.error(data.error || "Failed to add comment")
      }
    } catch {
      toast.error("Something went wrong")
    } finally {
      setSendingComment(false)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12 text-gray-500">Loading...</div>
    )
  }

  if (!request) {
    return (
      <div className="text-center py-12 text-gray-500">
        Request not found.
      </div>
    )
  }

  const catConfig =
    CATEGORY_CONFIG[request.category] || CATEGORY_CONFIG.general
  const statusConfig =
    STATUS_CONFIG[request.status] || STATUS_CONFIG.submitted
  const Icon = catConfig.icon

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/admin/maintenance"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="size-4" />
        Back to Queue
      </Link>

      {/* Request Info */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Icon className="size-5 text-gray-500" />
            <CardTitle className="text-lg">{catConfig.label}</CardTitle>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusConfig.className}`}
            >
              {statusConfig.label}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-700 whitespace-pre-wrap">
            {request.description}
          </p>
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <Clock className="size-3" />
              Submitted {new Date(request.createdAt).toLocaleDateString()}
            </span>
            {request.resolvedAt && (
              <span>
                Resolved{" "}
                {new Date(request.resolvedAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Admin Status Update */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Update Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">
              New Status
            </label>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              className="w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_CONFIG[s].label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">
              Note (optional)
            </label>
            <textarea
              value={statusNote}
              onChange={(e) => setStatusNote(e.target.value)}
              placeholder="Add a note about this status change..."
              rows={2}
              className="w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <Button
            onClick={handleStatusUpdate}
            disabled={updatingStatus || newStatus === request.status}
            size="sm"
          >
            {updatingStatus ? "Updating..." : "Update Status"}
          </Button>
        </CardContent>
      </Card>

      {/* Photos */}
      {photos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Photos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
              {photos.map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() =>
                    setLightboxUrl(`/api/uploads/${photo.filePath}`)
                  }
                  className="block"
                >
                  <img
                    src={`/api/uploads/${photo.filePath}`}
                    alt={photo.fileName}
                    className="aspect-square w-full rounded-md object-cover border hover:opacity-80 transition-opacity cursor-pointer"
                  />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <img
            src={lightboxUrl}
            alt="Full size"
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Comments */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Comments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {comments.length === 0 && (
            <p className="text-sm text-gray-400">No comments yet.</p>
          )}

          {comments.map((comment) => (
            <div
              key={comment.id}
              className={`rounded-md p-3 text-sm ${
                comment.isStatusChange
                  ? "bg-blue-50 border border-blue-100"
                  : "bg-gray-50 border"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-xs text-gray-500">
                  {comment.isStatusChange ? "Status Update" : "Comment"}
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(comment.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="text-gray-700 whitespace-pre-wrap">
                {comment.content}
              </p>
            </div>
          ))}

          {/* Add comment form */}
          <form onSubmit={handleAddComment} className="flex gap-2 pt-2">
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Add a comment..."
              rows={2}
              className="flex-1 rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <Button
              type="submit"
              size="icon"
              disabled={sendingComment || !commentText.trim()}
              className="self-end"
            >
              <Send className="size-4" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
