import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

// Lazy-initialized singleton — don't create at import time (same pattern as db)
let _s3Client: S3Client | null = null

function getS3Client(): S3Client {
  if (!_s3Client) {
    _s3Client = new S3Client({
      region: "auto", // R2 uses "auto"; standard S3 would use a specific region
      endpoint: process.env.S3_ENDPOINT!,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID!,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
      },
    })
  }
  return _s3Client
}

function getBucketName(): string {
  const bucket = process.env.S3_BUCKET_NAME
  if (!bucket) {
    throw new Error("S3_BUCKET_NAME is not set")
  }
  return bucket
}

/**
 * Check if all 4 S3 env vars are configured.
 * Used as a graceful fallback — if S3 is not configured, uploads fall back to local storage.
 */
export function isS3Configured(): boolean {
  return !!(
    process.env.S3_ENDPOINT &&
    process.env.S3_ACCESS_KEY_ID &&
    process.env.S3_SECRET_ACCESS_KEY &&
    process.env.S3_BUCKET_NAME
  )
}

/**
 * Upload a buffer to S3-compatible storage.
 * Returns the S3 object key (not a URL).
 */
export async function uploadToS3(
  buffer: Buffer,
  key: string,
  contentType: string,
): Promise<string> {
  const client = getS3Client()
  const bucket = getBucketName()

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  )

  return key
}

/**
 * Generate a presigned GET URL for downloading a file from S3.
 * URL expires after 1 hour (3600 seconds).
 */
export async function getPresignedDownloadUrl(key: string): Promise<string> {
  const client = getS3Client()
  const bucket = getBucketName()

  const url = await getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
    { expiresIn: 3600 },
  )

  return url
}
