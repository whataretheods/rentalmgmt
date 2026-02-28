import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { db } from "@/db"
import {
  tenantUnits,
  autopayEnrollments,
  units,
  charges,
} from "@/db/schema/domain"
import { user } from "@/db/schema/auth"
import { eq, and } from "drizzle-orm"
import { sendNotification } from "@/lib/notifications"

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: {
    tenantUserId?: string
    unitId?: string
    moveOutDate?: string
    finalCharges?: Array<{ description: string; amountCents: number }>
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { tenantUserId, unitId, moveOutDate, finalCharges } = body

  if (!tenantUserId || !unitId || !moveOutDate) {
    return NextResponse.json(
      { error: "tenantUserId, unitId, and moveOutDate are required" },
      { status: 400 }
    )
  }

  // Parse move-out date
  const moveOutDateObj = new Date(moveOutDate)
  if (isNaN(moveOutDateObj.getTime())) {
    return NextResponse.json({ error: "Invalid moveOutDate" }, { status: 400 })
  }

  // Verify active tenancy exists
  const [activeTenancy] = await db
    .select()
    .from(tenantUnits)
    .where(
      and(
        eq(tenantUnits.userId, tenantUserId),
        eq(tenantUnits.unitId, unitId),
        eq(tenantUnits.isActive, true)
      )
    )
    .limit(1)

  if (!activeTenancy) {
    return NextResponse.json(
      { error: "No active tenancy found for this tenant and unit" },
      { status: 404 }
    )
  }

  // Execute all move-out operations atomically in a transaction
  try {
    await db.transaction(async (tx) => {
      // Step 1: Set end date and deactivate tenancy
      await tx
        .update(tenantUnits)
        .set({
          endDate: moveOutDateObj,
          isActive: false,
        })
        .where(eq(tenantUnits.id, activeTenancy.id))

      // Step 2: Cancel active autopay (if any)
      await tx
        .update(autopayEnrollments)
        .set({
          status: "cancelled",
          cancelledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(autopayEnrollments.tenantUserId, tenantUserId),
            eq(autopayEnrollments.status, "active")
          )
        )

      // Step 3: Post final charges to ledger
      if (finalCharges && finalCharges.length > 0) {
        for (const charge of finalCharges) {
          await tx.insert(charges).values({
            tenantUserId,
            unitId,
            type: "one_time",
            description: charge.description,
            amountCents: charge.amountCents,
            createdBy: session.user.id,
          })
        }
      }
    })
  } catch (err: unknown) {
    console.error("Move-out failed:", err)
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json(
      { error: "Move-out failed. No changes were made. " + message },
      { status: 500 }
    )
  }

  // Get tenant and unit info for notifications (after transaction)
  const [tenantInfo] = await db
    .select({ name: user.name, email: user.email })
    .from(user)
    .where(eq(user.id, tenantUserId))
    .limit(1)

  const [unitInfo] = await db
    .select({ unitNumber: units.unitNumber })
    .from(units)
    .where(eq(units.id, unitId))
    .limit(1)

  // Notify tenant of move-out (fire-and-forget, outside transaction)
  void sendNotification({
    userId: tenantUserId,
    type: "system",
    title: "Move-Out Processed",
    body: `Your tenancy for Unit ${unitInfo?.unitNumber ?? "unknown"} has ended as of ${moveOutDateObj.toLocaleDateString()}. You can still access your payment and maintenance history.`,
    channels: ["in_app", "email"],
  })

  // Notify other admins
  const adminUsers = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.role, "admin"))

  for (const adminUser of adminUsers) {
    if (adminUser.id === session.user.id) continue
    void sendNotification({
      userId: adminUser.id,
      type: "system",
      title: "Tenant Moved Out",
      body: `${tenantInfo?.name ?? "Tenant"} has been moved out of Unit ${unitInfo?.unitNumber ?? "unknown"}.`,
      channels: ["in_app"],
    })
  }

  return NextResponse.json({
    success: true,
    moveOutDate: moveOutDateObj.toISOString(),
    autopayStatus: "cancelled",
    finalChargesPosted: finalCharges?.length ?? 0,
  })
}
