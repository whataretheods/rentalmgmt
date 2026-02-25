/**
 * Creates the first admin user.
 * Run once on initial setup: npm run seed:admin
 *
 * Requires in .env.local:
 *   ADMIN_EMAIL=landlord@example.com
 *   ADMIN_PASSWORD=choose-a-strong-password
 *   DATABASE_URL=...
 *   BETTER_AUTH_SECRET=...
 */
import "dotenv/config"
import { auth } from "@/lib/auth"

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD

  if (!email || !password) {
    console.error("Error: ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env.local")
    process.exit(1)
  }

  try {
    const result = await auth.api.createUser({
      body: {
        email,
        password,
        name: "Admin",
        role: "admin",
      },
    })
    console.log("Admin user created successfully:")
    console.log("  ID:", result.user.id)
    console.log("  Email:", result.user.email)
    console.log("  Role:", result.user.role)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes("already exists") || message.includes("duplicate") || message.includes("unique")) {
      console.log("Admin user already exists with email:", email)
    } else {
      console.error("Failed to create admin user:", message)
      process.exit(1)
    }
  }

  process.exit(0)
}

seedAdmin()
