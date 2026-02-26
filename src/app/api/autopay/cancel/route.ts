import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { db } from "@/db"
import { autopayEnrollments, tenantUnits, units } from "@/db/schema/domain"
import { user } from "@/db/schema/auth"
import { eq, and } from "drizzle-orm"
import { sendNotification } from "@/lib/notifications"

export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [enrollment] = await db
    .select()
    .from(autopayEnrollments)
    .where(
      and(
        eq(autopayEnrollments.tenantUserId, session.user.id),
        eq(autopayEnrollments.status, "active")
      )
    )

  if (!enrollment) {
    return NextResponse.json(
      { error: "No active autopay enrollment found" },
      { status: 404 }
    )
  }

  // Cancel enrollment (keep payment method for re-enrollment)
  await db
    .update(autopayEnrollments)
    .set({
      status: "cancelled",
      cancelledAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(autopayEnrollments.id, enrollment.id))

  // Get unit number for notification
  const [unit] = await db
    .select()
    .from(units)
    .where(eq(units.id, enrollment.unitId))

  // Notify admin users (in-app only)
  const adminUsers = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.role, "admin"))

  for (const admin of adminUsers) {
    void sendNotification({
      userId: admin.id,
      type: "system",
      title: "Autopay Cancelled",
      body: `Tenant ${session.user.name} cancelled autopay for Unit ${unit?.unitNumber ?? "unknown"}`,
      channels: ["in_app"],
    })
  }

  return NextResponse.json({ success: true })
}
