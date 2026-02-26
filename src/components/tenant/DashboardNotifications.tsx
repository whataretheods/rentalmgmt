import Link from "next/link"

interface DashboardNotificationsProps {
  recentNotifications: Array<{
    id: string
    title: string
    body: string
    type: string
    readAt: Date | null
    createdAt: Date
  }>
  unreadCount: number
}

export function DashboardNotifications({ recentNotifications, unreadCount }: DashboardNotificationsProps) {
  return (
    <div className="rounded-lg border bg-white p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">
          Notifications
          {unreadCount > 0 && (
            <span className="ml-2 inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
              {unreadCount} new
            </span>
          )}
        </h3>
        <Link href="/tenant/notifications" className="text-sm text-blue-600 hover:underline">
          View All
        </Link>
      </div>

      {recentNotifications.length === 0 ? (
        <p className="text-sm text-gray-400">No notifications yet</p>
      ) : (
        <div className="space-y-2">
          {recentNotifications.map((notif) => (
            <div key={notif.id} className="flex items-start gap-2 text-sm">
              {/* Unread indicator */}
              <div className="mt-1.5 shrink-0">
                {notif.readAt === null ? (
                  <div className="h-2 w-2 rounded-full bg-blue-500" />
                ) : (
                  <div className="h-2 w-2" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-gray-900 truncate">{notif.title}</p>
                <p className="text-gray-500 truncate">{notif.body}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(notif.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
