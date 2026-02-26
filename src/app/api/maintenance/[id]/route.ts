import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { db } from "@/db"
import {
  maintenanceRequests,
  maintenancePhotos,
  maintenanceComments,
} from "@/db/schema"
import { eq, asc } from "drizzle-orm"

const VALID_STATUSES = [
  "submitted",
  "acknowledged",
  "in_progress",
  "resolved",
] as const

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  // Get the request
  const [request] = await db
    .select()
    .from(maintenanceRequests)
    .where(eq(maintenanceRequests.id, id))

  if (!request) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 })
  }

  // Verify access: must be the request owner or admin
  if (
    request.tenantUserId !== session.user.id &&
    session.user.role !== "admin"
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Get photos
  const photos = await db
    .select()
    .from(maintenancePhotos)
    .where(eq(maintenancePhotos.requestId, id))

  // Get comments ordered by creation time
  const comments = await db
    .select()
    .from(maintenanceComments)
    .where(eq(maintenanceComments.requestId, id))
    .orderBy(asc(maintenanceComments.createdAt))

  return NextResponse.json({ request, photos, comments })
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json()
  const { status, note } = body as { status?: string; note?: string }

  type ValidStatus = (typeof VALID_STATUSES)[number]

  // Validate status
  if (
    !status ||
    !VALID_STATUSES.includes(status as ValidStatus)
  ) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 })
  }

  const validatedStatus = status as ValidStatus

  // Verify request exists
  const [existing] = await db
    .select()
    .from(maintenanceRequests)
    .where(eq(maintenanceRequests.id, id))

  if (!existing) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 })
  }

  // Update the request
  const now = new Date()
  const [updated] = await db
    .update(maintenanceRequests)
    .set({
      status: validatedStatus,
      updatedAt: now,
      ...(validatedStatus === "resolved" ? { resolvedAt: now } : {}),
    })
    .where(eq(maintenanceRequests.id, id))
    .returning()

  // If a note was provided, add a status change comment
  if (note && note.trim().length > 0) {
    await db.insert(maintenanceComments).values({
      requestId: id,
      userId: session.user.id,
      content: note.trim(),
      isStatusChange: true,
    })
  }

  return NextResponse.json({ request: updated })
}
