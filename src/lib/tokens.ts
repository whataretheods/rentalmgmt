import { randomBytes, createHash } from "crypto"

/** Generate a 256-bit cryptographically secure URL-safe token */
export function generateInviteToken(): string {
  return randomBytes(32).toString("base64url")
}

/** Hash a token with SHA-256 for database storage */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

/** Default invite token expiration: 30 days from now */
export function getInviteExpiry(): Date {
  const expiry = new Date()
  expiry.setDate(expiry.getDate() + 30)
  return expiry
}
