import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { db } from "@/db"
import { documents, documentRequests } from "@/db/schema"
import { eq, desc } from "drizzle-orm"
import { saveUploadedFile } from "@/lib/uploads"

const VALID_DOCUMENT_TYPES = ["government_id", "proof_of_income_insurance", "general"] as const

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Admin can query a specific tenant's documents via ?tenantUserId=xxx
  const { searchParams } = new URL(req.url)
  const isAdmin = session.user.role === "admin"
  const targetUserId = isAdmin && searchParams.get("tenantUserId")
    ? searchParams.get("tenantUserId")!
    : session.user.id

  // Tenants can only see their own documents
  if (!isAdmin && targetUserId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const docs = await db
    .select()
    .from(documents)
    .where(eq(documents.tenantUserId, targetUserId))
    .orderBy(desc(documents.createdAt))

  const pendingRequests = await db
    .select()
    .from(documentRequests)
    .where(eq(documentRequests.tenantUserId, targetUserId))
    .orderBy(desc(documentRequests.createdAt))

  return NextResponse.json({ documents: docs, requests: pendingRequests })
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  const documentType = formData.get("documentType") as string | null
  const requestId = formData.get("requestId") as string | null

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 })
  }

  if (!documentType || !VALID_DOCUMENT_TYPES.includes(documentType as typeof VALID_DOCUMENT_TYPES[number])) {
    return NextResponse.json(
      { error: "Invalid document type. Must be one of: government_id, proof_of_income_insurance, general" },
      { status: 400 }
    )
  }

  // Save file -- saveUploadedFile validates MIME type and size
  let uploadResult
  try {
    uploadResult = await saveUploadedFile(file, "documents")
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed"
    return NextResponse.json({ error: message }, { status: 400 })
  }

  // Insert document record
  const [doc] = await db
    .insert(documents)
    .values({
      tenantUserId: session.user.id,
      documentType: documentType as typeof VALID_DOCUMENT_TYPES[number],
      filePath: uploadResult.filePath,
      fileName: uploadResult.fileName,
      fileSize: uploadResult.fileSize,
      mimeType: uploadResult.mimeType,
      requestId: requestId || null,
    })
    .returning()

  // If fulfilling a request, update the request status
  if (requestId) {
    await db
      .update(documentRequests)
      .set({
        status: "submitted",
        fulfilledAt: new Date(),
      })
      .where(eq(documentRequests.id, requestId))
  }

  return NextResponse.json({ document: doc }, { status: 201 })
}
