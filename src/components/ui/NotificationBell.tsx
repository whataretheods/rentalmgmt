"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Bell } from "lucide-react"

interface NotificationBellProps {
  apiUrl: string
  inboxUrl: string
}

export function NotificationBell({ apiUrl, inboxUrl }: NotificationBellProps) {
  const [unreadCount, setUnreadCount] = useState(0)

  const fetchCount = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}?unreadOnly=true&limit=1`)
      if (res.ok) {
        const data = await res.json()
        setUnreadCount(data.unreadCount ?? 0)
      }
    } catch {
      // Silently fail -- bell is non-critical UI
    }
  }, [apiUrl])

  useEffect(() => {
    fetchCount()

    // Refetch when user tabs back
    function handleVisibility() {
      if (document.visibilityState === "visible") {
        fetchCount()
      }
    }

    document.addEventListener("visibilitychange", handleVisibility)
    return () => document.removeEventListener("visibilitychange", handleVisibility)
  }, [fetchCount])

  return (
    <Link href={inboxUrl} className="relative inline-flex items-center text-gray-600 hover:text-gray-900">
      <Bell className="size-5" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </Link>
  )
}
