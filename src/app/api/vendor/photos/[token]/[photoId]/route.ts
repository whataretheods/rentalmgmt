import { promises as fs } from "fs"
import path from "path"
import { NextResponse } from "next/server"
import { db } from "@/db"
import { workOrders, maintenancePhotos } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { UPLOADS_DIR } from "@/lib/uploads"
import { getPresignedDownloadUrl } from "@/lib/storage"

const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".heic": "image/heic",
  ".heif": "image/heif",
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string; photoId: string }> }
) {
  const { token, photoId } = await params

  // 1. Look up work order by vendor access token
  const [workOrder] = await db
    .select({
      id: workOrders.id,
      maintenanceRequestId: workOrders.maintenanceRequestId,
    })
    .from(workOrders)
    .where(eq(workOrders.vendorAccessToken, token))

  if (!workOrder) {
    return new Response("Not Found", { status: 404 })
  }

  // 2. Look up photo by ID
  const [photo] = await db
    .select()
    .from(maintenancePhotos)
    .where(eq(maintenancePhotos.id, photoId))

  if (!photo) {
    return new Response("Not Found", { status: 404 })
  }

  // 3. Verify photo belongs to this work order's maintenance request
  if (photo.requestId !== workOrder.maintenanceRequestId) {
    return new Response("Forbidden", { status: 403 })
  }

  // 4. Serve from S3 if applicable
  if (photo.storageBackend === "s3" && photo.s3Key) {
    const presignedUrl = await getPresignedDownloadUrl(photo.s3Key)
    return NextResponse.redirect(presignedUrl, 302)
  }

  // 5. Serve from local storage
  const filePath = path.join(UPLOADS_DIR, photo.filePath)
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
        "Cache-Control": "private, max-age=3600",
      },
    })
  } catch {
    return new Response("Not Found", { status: 404 })
  }
}
