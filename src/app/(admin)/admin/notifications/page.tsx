"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Bell, ArrowLeft, Check } from "lucide-react"
import { toast } from "sonner"
import { EmptyState } from "@/components/ui/empty-state"

interface Notification {
  id: string
  type: string
  title: string
  body: string
  channel: string
  readAt: string | null
  createdAt: string
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMin / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMin < 1) return "just now"
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

function typeBadgeColor(type: string): string {
  switch (type) {
    case "rent_reminder": return "bg-amber-100 text-amber-800"
    case "payment_confirmation": return "bg-green-100 text-green-800"
    case "broadcast": return "bg-blue-100 text-blue-800"
    case "maintenance_update": return "bg-purple-100 text-purple-800"
    case "system": return "bg-gray-100 text-gray-800"
    default: return "bg-gray-100 text-gray-800"
  }
}

function typeLabel(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function AdminNotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const LIMIT = 20

  useEffect(() => {
    fetchNotifications(0)
  }, [])

  async function fetchNotifications(currentOffset: number) {
    try {
      const res = await fetch(`/api/admin/notifications?limit=${LIMIT}&offset=${currentOffset}`)
      if (!res.ok) throw new Error("Failed to load notifications")
      const data = await res.json()

      if (currentOffset === 0) {
        setNotifications(data.notifications)
      } else {
        setNotifications((prev) => [...prev, ...data.notifications])
      }
      setUnreadCount(data.unreadCount)
      setHasMore(data.notifications.length === LIMIT)
      setOffset(currentOffset + data.notifications.length)
    } catch {
      toast.error("Failed to load notifications")
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  async function handleMarkRead(id: string) {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: "PATCH" })
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n))
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch {
      toast.error("Failed to mark as read")
    }
  }

  async function handleMarkAllRead() {
    const unread = notifications.filter((n) => !n.readAt)
    if (unread.length === 0) return

    try {
      await Promise.all(
        unread.map((n) => fetch(`/api/notifications/${n.id}/read`, { method: "PATCH" }))
      )
      setNotifications((prev) =>
        prev.map((n) => (n.readAt ? n : { ...n, readAt: new Date().toISOString() }))
      )
      setUnreadCount(0)
      toast.success("All notifications marked as read")
    } catch {
      toast.error("Failed to mark all as read")
    }
  }

  function handleLoadMore() {
    setLoadingMore(true)
    fetchNotifications(offset)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-6">
          <Bell className="size-6" />
          <h1 className="text-2xl font-bold">Notifications</h1>
        </div>
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
              <div className="h-3 bg-gray-200 rounded w-2/3" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Link href="/admin/dashboard" className="text-gray-500 hover:text-gray-700">
            <ArrowLeft className="size-5" />
          </Link>
          <Bell className="size-6" />
          <h1 className="text-2xl font-bold">Notifications</h1>
          {unreadCount > 0 && (
            <span className="text-sm text-gray-500">({unreadCount} unread)</span>
          )}
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
            <Check className="size-4 mr-1" />
            Mark all as read
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No notifications yet"
          description="System notifications will appear here as payment activity, maintenance requests, and other events occur."
        />
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <Card
              key={n.id}
              className={`cursor-pointer transition-colors ${!n.readAt ? "border-l-4 border-l-blue-500 bg-blue-50/30" : ""}`}
              onClick={() => !n.readAt && handleMarkRead(n.id)}
            >
              <CardContent className="py-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {!n.readAt && (
                        <span className="inline-block w-2 h-2 bg-blue-500 rounded-full shrink-0" />
                      )}
                      <span className="font-medium text-gray-900 truncate">{n.title}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${typeBadgeColor(n.type)}`}>
                        {typeLabel(n.type)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2">{n.body}</p>
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap shrink-0">
                    {formatRelativeTime(n.createdAt)}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {hasMore && (
        <div className="text-center pt-4">
          <Button variant="outline" onClick={handleLoadMore} disabled={loadingMore}>
            {loadingMore ? "Loading..." : "Load more"}
          </Button>
        </div>
      )}
    </div>
  )
}
