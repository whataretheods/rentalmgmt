import { promises as fs } from "fs"
import path from "path"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { UPLOADS_DIR } from "@/lib/uploads"
import { db } from "@/db"
import { maintenancePhotos } from "@/db/schema"
import { eq } from "drizzle-orm"
import { getPresignedDownloadUrl } from "@/lib/storage"

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
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  // Auth check -- only authenticated users can access uploads
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return new Response("Unauthorized", { status: 401 })
  }

  const { path: pathSegments } = await params
  const relPath = pathSegments.join("/")

  // Check if this file is stored in S3 by looking up the photo record by filePath
  const [photo] = await db
    .select()
    .from(maintenancePhotos)
    .where(eq(maintenancePhotos.filePath, relPath))

  if (photo && photo.storageBackend === "s3" && photo.s3Key) {
    // Redirect to S3 presigned URL — file bytes never pass through the app server
    const presignedUrl = await getPresignedDownloadUrl(photo.s3Key)
    return NextResponse.redirect(presignedUrl, 302)
  }

  // Local file serving (existing behavior)
  const filePath = path.join(UPLOADS_DIR, ...pathSegments)

  // Path traversal protection -- verify resolved path stays within uploads directory
  const resolvedPath = path.resolve(filePath)
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
        "Cache-Control": "private, max-age=3600",
      },
    })
  } catch {
    return new Response("Not Found", { status: 404 })
  }
}
