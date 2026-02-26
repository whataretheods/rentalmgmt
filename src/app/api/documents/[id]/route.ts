import { promises as fs } from "fs"
import path from "path"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { db } from "@/db"
import { documents } from "@/db/schema"
import { eq } from "drizzle-orm"
import { UPLOADS_DIR } from "@/lib/uploads"

const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return new Response("Unauthorized", { status: 401 })
  }

  const { id } = await params

  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, id))

  if (!doc) {
    return new Response("Not Found", { status: 404 })
  }

  // Verify access: document belongs to user, or user is admin
  if (doc.tenantUserId !== session.user.id && session.user.role !== "admin") {
    return new Response("Forbidden", { status: 403 })
  }

  const filePath = path.join(UPLOADS_DIR, doc.filePath)
  const resolvedPath = path.resolve(filePath)

  // Path traversal protection
  if (!resolvedPath.startsWith(path.resolve(UPLOADS_DIR))) {
    return new Response("Forbidden", { status: 403 })
  }

  try {
    const buffer = await fs.readFile(resolvedPath)
    const ext = path.extname(resolvedPath).toLowerCase()
    const contentType = MIME_TYPES[ext] || "application/octet-stream"

    return new Response(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${doc.fileName}"`,
        "Cache-Control": "private, max-age=3600",
      },
    })
  } catch {
    return new Response("Not Found", { status: 404 })
  }
}
