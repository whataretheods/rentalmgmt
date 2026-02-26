import { promises as fs } from "fs"
import path from "path"
import crypto from "crypto"

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

export async function saveUploadedFile(
  file: File,
  subdirectory: string,
): Promise<{ filePath: string; fileName: string; fileSize: number; mimeType: string }> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB (max 25MB)`)
  }
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error(`Unsupported file type: ${file.type}. Accepted: PDF, JPG, PNG, HEIC, Word docs`)
  }

  const ext = path.extname(file.name) || ""
  const safeName = `${crypto.randomUUID()}${ext}`
  const relPath = path.join(subdirectory, safeName)
  const fullPath = path.join(UPLOADS_DIR, relPath)

  await fs.mkdir(path.dirname(fullPath), { recursive: true })
  const bytes = await file.arrayBuffer()
  await fs.writeFile(fullPath, Buffer.from(bytes))

  return {
    filePath: relPath,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type,
  }
}
