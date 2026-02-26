import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { db } from "@/db"
import { inviteTokens, units } from "@/db/schema"
import { generateInviteToken, hashToken, getInviteExpiry } from "@/lib/tokens"
import { generateQRCodeDataURL } from "@/lib/qr"
import { eq } from "drizzle-orm"

export async function POST(request: NextRequest) {
  // Verify admin session
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Parse request body
  let body: { unitId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { unitId } = body
  if (!unitId) {
    return NextResponse.json({ error: "unitId is required" }, { status: 400 })
  }

  // Verify unit exists
  const [unit] = await db
    .select({ id: units.id, unitNumber: units.unitNumber })
    .from(units)
    .where(eq(units.id, unitId))
    .limit(1)

  if (!unit) {
    return NextResponse.json({ error: "Unit not found" }, { status: 404 })
  }

  // Generate token and store hash
  const rawToken = generateInviteToken()
  const tokenHash = hashToken(rawToken)
  const expiresAt = getInviteExpiry()

  await db.insert(inviteTokens).values({
    unitId,
    tokenHash,
    expiresAt,
  })

  // Generate invite URL and QR code
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  const inviteUrl = `${appUrl}/invite/${rawToken}`
  const qrDataUrl = await generateQRCodeDataURL(inviteUrl)

  return NextResponse.json({
    token: rawToken,
    inviteUrl,
    qrDataUrl,
    expiresAt: expiresAt.toISOString(),
    unitNumber: unit.unitNumber,
  })
}
