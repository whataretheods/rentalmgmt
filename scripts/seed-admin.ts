/**
 * Creates the first admin user.
 * Run once on initial setup: npm run seed:admin
 *
 * Registers via Better Auth's HTTP signUp endpoint (which properly hashes
 * the password), then promotes the user to admin role via direct DB update.
 *
 * Requires in .env.local:
 *   ADMIN_EMAIL=landlord@example.com
 *   ADMIN_PASSWORD=choose-a-strong-password
 *   DATABASE_URL=...
 *   BETTER_AUTH_SECRET=...
 *   BETTER_AUTH_URL=http://localhost:3000
 */
import { config } from "dotenv"
config({ path: ".env.local" })
import { db } from "@/db"
import { user } from "@/db/schema/auth"
import { eq } from "drizzle-orm"

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD
  const baseUrl = process.env.BETTER_AUTH_URL || "http://localhost:3000"

  if (!email || !password) {
    console.error("Error: ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env.local")
    process.exit(1)
  }

  // Check if user already exists
  const existing = await db.select({ id: user.id, role: user.role }).from(user).where(eq(user.email, email))
  if (existing.length > 0) {
    if (existing[0].role === "admin") {
      console.log("Admin user already exists with email:", email)
      process.exit(0)
    }
    // Exists but not admin — promote
    await db.update(user).set({ role: "admin" }).where(eq(user.email, email))
    console.log("Promoted existing user to admin:", email)
    process.exit(0)
  }

  // Register via HTTP endpoint (properly hashes password)
  const res = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name: "Admin" }),
  })

  if (!res.ok) {
    const body = await res.text()
    console.error("Failed to create user:", res.status, body)
    process.exit(1)
  }

  // Promote to admin role
  await db.update(user).set({ role: "admin" }).where(eq(user.email, email))

  const result = await db.select({ id: user.id, email: user.email, role: user.role })
    .from(user).where(eq(user.email, email))

  console.log("Admin user created successfully:")
  console.log("  ID:", result[0].id)
  console.log("  Email:", result[0].email)
  console.log("  Role:", result[0].role)

  process.exit(0)
}

seedAdmin()
