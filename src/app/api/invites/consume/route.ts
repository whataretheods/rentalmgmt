import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { db } from "@/db"
import { inviteTokens, tenantUnits, units } from "@/db/schema/domain"
import { hashToken } from "@/lib/tokens"
import { eq, and, gt } from "drizzle-orm"

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: { token?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { token } = body
  if (!token?.trim()) {
    return NextResponse.json(
      { error: "Invite code is required" },
      { status: 400 }
    )
  }

  // Check if user already has an active tenancy
  const [existingActive] = await db
    .select({ id: tenantUnits.id })
    .from(tenantUnits)
    .where(
      and(
        eq(tenantUnits.userId, session.user.id),
        eq(tenantUnits.isActive, true)
      )
    )
    .limit(1)

  if (existingActive) {
    return NextResponse.json(
      {
        error:
          "You already have an active unit. Contact your landlord to transfer units.",
      },
      { status: 409 }
    )
  }

  // Hash and atomically consume token
  const tokenHash = hashToken(token.trim())
  const now = new Date()

  const [consumed] = await db
    .update(inviteTokens)
    .set({
      status: "used" as const,
      usedByUserId: session.user.id,
      usedAt: now,
    })
    .where(
      and(
        eq(inviteTokens.tokenHash, tokenHash),
        eq(inviteTokens.status, "pending"),
        gt(inviteTokens.expiresAt, now)
      )
    )
    .returning()

  if (!consumed) {
    return NextResponse.json(
      {
        error:
          "Invalid or expired invite code. Please check the code and try again.",
      },
      { status: 400 }
    )
  }

  // Create tenancy link
  await db.insert(tenantUnits).values({
    userId: session.user.id,
    unitId: consumed.unitId,
    startDate: now,
    isActive: true,
  })

  // Get unit number for response
  const [unit] = await db
    .select({ unitNumber: units.unitNumber })
    .from(units)
    .where(eq(units.id, consumed.unitId))
    .limit(1)

  return NextResponse.json({
    success: true,
    unitNumber: unit?.unitNumber ?? "Unknown",
  })
}
