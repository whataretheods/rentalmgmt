import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { db } from "@/db"
import { documentRequests, user } from "@/db/schema"
import { eq, desc } from "drizzle-orm"
import { z } from "zod"

const VALID_DOCUMENT_TYPES = ["government_id", "proof_of_income_insurance", "general"] as const

const createRequestSchema = z.object({
  tenantUserId: z.string().min(1),
  documentType: z.enum(VALID_DOCUMENT_TYPES),
  message: z.string().max(500).optional(),
})

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (session.user.role === "admin") {
    // Admin sees all requests with tenant info
    const requests = await db
      .select({
        id: documentRequests.id,
        tenantUserId: documentRequests.tenantUserId,
        tenantName: user.name,
        tenantEmail: user.email,
        documentType: documentRequests.documentType,
        message: documentRequests.message,
        status: documentRequests.status,
        createdAt: documentRequests.createdAt,
        fulfilledAt: documentRequests.fulfilledAt,
      })
      .from(documentRequests)
      .leftJoin(user, eq(documentRequests.tenantUserId, user.id))
      .orderBy(desc(documentRequests.createdAt))

    return NextResponse.json({ requests })
  }

  // Tenant sees only their requests
  const requests = await db
    .select()
    .from(documentRequests)
    .where(eq(documentRequests.tenantUserId, session.user.id))
    .orderBy(desc(documentRequests.createdAt))

  return NextResponse.json({ requests })
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const parsed = createRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  // Validate that the target user exists
  const [targetUser] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.id, parsed.data.tenantUserId))

  if (!targetUser) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 })
  }

  const [request] = await db
    .insert(documentRequests)
    .values({
      tenantUserId: parsed.data.tenantUserId,
      documentType: parsed.data.documentType,
      message: parsed.data.message || null,
    })
    .returning()

  return NextResponse.json({ request }, { status: 201 })
}
