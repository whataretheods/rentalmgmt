import { db } from "@/db"
import { notifications } from "@/db/schema/domain"
import { user } from "@/db/schema/auth"
import { resend } from "@/lib/resend"
import { getTwilioClient } from "@/lib/twilio"
import { eq, and, isNull, desc, sql, count } from "drizzle-orm"

export interface NotificationPayload {
  userId: string
  type: "rent_reminder" | "payment_confirmation" | "broadcast" | "maintenance_update" | "system"
  title: string
  body: string
  emailHtml?: string
  channels: ("in_app" | "email" | "sms")[]
}

export type NotificationRecord = typeof notifications.$inferSelect

/**
 * Unified notification dispatch function.
 * Always creates an in-app notification record.
 * Optionally sends email and/or SMS based on channels array.
 * Email and SMS are fire-and-forget (void) to never block the caller.
 */
export async function sendNotification(payload: NotificationPayload): Promise<NotificationRecord> {
  const { userId, type, title, body, emailHtml, channels } = payload

  // Always create the in-app notification record
  const [record] = await db.insert(notifications).values({
    userId,
    type,
    title,
    body,
    channel: "in_app",
  }).returning()

  // Fetch user data once for email/SMS channels
  const needsUser = channels.includes("email") || channels.includes("sms")
  let userData: { email: string; phone: string | null; smsOptIn: boolean | null; name: string } | undefined

  if (needsUser) {
    const [found] = await db
      .select({
        email: user.email,
        phone: user.phone,
        smsOptIn: user.smsOptIn,
        name: user.name,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1)
    userData = found
  }

  // Email channel: fire-and-forget
  if (channels.includes("email") && userData) {
    // Create email notification record
    void db.insert(notifications).values({
      userId,
      type,
      title,
      body,
      channel: "email",
    })

    void resend.emails.send({
      from: process.env.EMAIL_FROM || "RentalMgmt <noreply@rentalmgmt.com>",
      to: userData.email,
      subject: title,
      html: emailHtml ?? `<p>${body}</p>`,
    })
  }

  // SMS channel: fire-and-forget, only if user opted in and has phone
  if (channels.includes("sms") && userData) {
    if (userData.smsOptIn === true && userData.phone) {
      // Create SMS notification record
      void db.insert(notifications).values({
        userId,
        type,
        title,
        body,
        channel: "sms",
      })

      void getTwilioClient().messages.create({
        messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID!,
        to: userData.phone,
        body: body,
      })
    }
  }

  return record
}

/**
 * Get paginated notifications for a user, ordered by createdAt desc.
 */
export async function getNotificationsForUser(
  userId: string,
  options?: { unreadOnly?: boolean; limit?: number; offset?: number }
): Promise<NotificationRecord[]> {
  const limit = Math.min(options?.limit ?? 20, 50)
  const offset = options?.offset ?? 0

  const conditions = [
    eq(notifications.userId, userId),
    eq(notifications.channel, "in_app"),
  ]

  if (options?.unreadOnly) {
    conditions.push(isNull(notifications.readAt))
  }

  return db
    .select()
    .from(notifications)
    .where(and(...conditions))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
    .offset(offset)
}

/**
 * Mark a notification as read. Only marks if userId matches (security).
 */
export async function markNotificationRead(
  notificationId: string,
  userId: string
): Promise<void> {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, userId)
      )
    )
}

/**
 * Get count of unread in-app notifications for a user.
 */
export async function getUnreadCount(userId: string): Promise<number> {
  const [result] = await db
    .select({ value: count() })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.channel, "in_app"),
        isNull(notifications.readAt)
      )
    )
  return result?.value ?? 0
}
