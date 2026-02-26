import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { db } from "@/db"
import { maintenanceRequests, maintenanceComments } from "@/db/schema"
import { eq } from "drizzle-orm"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  // Verify the request exists
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

  const body = await req.json()
  const { content } = body as { content?: string }

  if (!content || content.trim().length === 0) {
    return NextResponse.json(
      { error: "Comment content is required" },
      { status: 400 }
    )
  }

  const [comment] = await db
    .insert(maintenanceComments)
    .values({
      requestId: id,
      userId: session.user.id,
      content: content.trim(),
      isStatusChange: false,
    })
    .returning()

  return NextResponse.json({ comment }, { status: 201 })
}
