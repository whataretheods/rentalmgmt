import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { db } from "@/db"
import {
  maintenanceRequests,
  maintenancePhotos,
  tenantUnits,
} from "@/db/schema"
import { eq, and, desc, sql } from "drizzle-orm"
import { saveUploadedFile } from "@/lib/uploads"

const VALID_CATEGORIES = [
  "plumbing",
  "electrical",
  "hvac",
  "appliance",
  "pest_control",
  "structural",
  "general",
] as const

const MAX_PHOTOS = 5

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Get all maintenance requests for this tenant, with photo count
  const requests = await db
    .select({
      id: maintenanceRequests.id,
      category: maintenanceRequests.category,
      description: maintenanceRequests.description,
      status: maintenanceRequests.status,
      createdAt: maintenanceRequests.createdAt,
      updatedAt: maintenanceRequests.updatedAt,
      resolvedAt: maintenanceRequests.resolvedAt,
      photoCount: sql<number>`(
        SELECT count(*)::int FROM maintenance_photos
        WHERE maintenance_photos.request_id = ${maintenanceRequests.id}
      )`,
    })
    .from(maintenanceRequests)
    .where(eq(maintenanceRequests.tenantUserId, session.user.id))
    .orderBy(desc(maintenanceRequests.createdAt))

  return NextResponse.json({ requests })
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const formData = await req.formData()
  const category = formData.get("category") as string | null
  const description = formData.get("description") as string | null
  const photoFiles = formData.getAll("photos") as File[]

  type ValidCategory = (typeof VALID_CATEGORIES)[number]

  // Validate category
  if (
    !category ||
    !VALID_CATEGORIES.includes(category as ValidCategory)
  ) {
    return NextResponse.json(
      { error: "Invalid category" },
      { status: 400 }
    )
  }

  const validatedCategory = category as ValidCategory

  // Validate description
  if (!description || description.trim().length === 0) {
    return NextResponse.json(
      { error: "Description is required" },
      { status: 400 }
    )
  }

  // Validate photo count
  if (photoFiles.length > MAX_PHOTOS) {
    return NextResponse.json(
      { error: `Maximum ${MAX_PHOTOS} photos allowed` },
      { status: 400 }
    )
  }

  // Look up tenant's active unit
  const [link] = await db
    .select()
    .from(tenantUnits)
    .where(
      and(
        eq(tenantUnits.userId, session.user.id),
        eq(tenantUnits.isActive, true)
      )
    )

  if (!link) {
    return NextResponse.json(
      { error: "No active unit found for your account" },
      { status: 400 }
    )
  }

  // Create the maintenance request
  const [request] = await db
    .insert(maintenanceRequests)
    .values({
      tenantUserId: session.user.id,
      unitId: link.unitId,
      category: validatedCategory,
      description: description.trim(),
      status: "submitted",
    })
    .returning()

  // Upload and save photos
  const savedPhotos = []
  for (const file of photoFiles) {
    // Skip empty file inputs
    if (!file || file.size === 0) continue

    try {
      const uploaded = await saveUploadedFile(file, "maintenance")
      const [photo] = await db
        .insert(maintenancePhotos)
        .values({
          requestId: request.id,
          filePath: uploaded.filePath,
          fileName: uploaded.fileName,
          fileSize: uploaded.fileSize,
          mimeType: uploaded.mimeType,
        })
        .returning()
      savedPhotos.push(photo)
    } catch (err) {
      console.error("Failed to upload photo:", err)
      // Continue with other photos -- don't fail the whole request
    }
  }

  return NextResponse.json(
    { request, photos: savedPhotos },
    { status: 201 }
  )
}
