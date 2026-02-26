import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { getNotificationsForUser, getUnreadCount } from "@/lib/notifications"

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(req.url)
  const unreadOnly = url.searchParams.get("unreadOnly") === "true"
  const limit = Math.min(Number(url.searchParams.get("limit")) || 20, 50)
  const offset = Number(url.searchParams.get("offset")) || 0

  const [notificationsList, unreadCount] = await Promise.all([
    getNotificationsForUser(session.user.id, { unreadOnly, limit, offset }),
    getUnreadCount(session.user.id),
  ])

  return NextResponse.json({
    notifications: notificationsList,
    unreadCount,
  })
}
