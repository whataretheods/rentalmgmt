import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { db } from "@/db"
import { tenantUnits } from "@/db/schema/domain"
import { eq, inArray } from "drizzle-orm"
import { z } from "zod"
import { sendNotification } from "@/lib/notifications"
import { renderBroadcastEmail } from "@/emails/BroadcastEmail"

const broadcastSchema = z.object({
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(2000),
  recipients: z.union([z.literal("all"), z.array(z.string())]),
  channels: z.array(z.enum(["email", "sms"])).min(1),
})

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let body: z.infer<typeof broadcastSchema>
  try {
    const raw = await req.json()
    body = broadcastSchema.parse(raw)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  // Resolve recipient user IDs
  let recipientUserIds: string[]

  if (body.recipients === "all") {
    const links = await db
      .select({ userId: tenantUnits.userId })
      .from(tenantUnits)
      .where(eq(tenantUnits.isActive, true))
    recipientUserIds = [...new Set(links.map((l) => l.userId))]
  } else {
    const links = await db
      .select({ userId: tenantUnits.userId })
      .from(tenantUnits)
      .where(
        inArray(tenantUnits.unitId, body.recipients)
      )
    recipientUserIds = [...new Set(links.map((l) => l.userId))]
  }

  if (recipientUserIds.length === 0) {
    return NextResponse.json({ error: "No recipients found" }, { status: 400 })
  }

  // Render email template
  const emailHtml = await renderBroadcastEmail({
    subject: body.subject,
    body: body.body,
    fromName: session.user.name ?? "Property Manager",
  })

  // Send to each recipient
  const channels: ("in_app" | "email" | "sms")[] = ["in_app", ...body.channels]
  let sent = 0

  for (const userId of recipientUserIds) {
    try {
      await sendNotification({
        userId,
        type: "broadcast",
        title: body.subject,
        body: body.body,
        emailHtml,
        channels,
      })
      sent++
    } catch (err) {
      console.error(`Broadcast send error for user ${userId}:`, err)
    }
  }

  // Confirmation notification for admin
  void sendNotification({
    userId: session.user.id,
    type: "system",
    title: "Broadcast Sent",
    body: `Sent "${body.subject}" to ${sent} recipients`,
    channels: ["in_app"],
  })

  return NextResponse.json({ sent, recipients: recipientUserIds })
}
