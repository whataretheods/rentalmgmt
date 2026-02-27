import { promises as fs } from "fs"
import path from "path"
import crypto from "crypto"
import { isS3Configured, uploadToS3 } from "@/lib/storage"

export const UPLOADS_DIR = path.join(process.cwd(), "uploads")

export const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
])

export const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25MB

export interface UploadResult {
  filePath: string
  fileName: string
  fileSize: number
  mimeType: string
  storageBackend: "local" | "s3"
  s3Key: string | null
}

export async function saveUploadedFile(
  file: File,
  subdirectory: string,
): Promise<UploadResult> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB (max 25MB)`)
  }
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error(`Unsupported file type: ${file.type}. Accepted: PDF, JPG, PNG, HEIC, Word docs`)
  }

  const ext = path.extname(file.name) || ""
  const safeName = `${crypto.randomUUID()}${ext}`
  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  // S3 upload path
  if (isS3Configured()) {
    const s3Key = `${subdirectory}/${safeName}`
    await uploadToS3(buffer, s3Key, file.type)
    return {
      filePath: "",
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      storageBackend: "s3",
      s3Key,
    }
  }

  // Local fallback
  const relPath = path.join(subdirectory, safeName)
  const fullPath = path.join(UPLOADS_DIR, relPath)
  await fs.mkdir(path.dirname(fullPath), { recursive: true })
  await fs.writeFile(fullPath, buffer)

  return {
    filePath: relPath,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type,
    storageBackend: "local",
    s3Key: null,
  }
}
