import { neon } from "@neondatabase/serverless"
import { drizzle, NeonHttpDatabase } from "drizzle-orm/neon-http"
import * as schema from "./schema"

// Lazy initialization: the neon() driver validates the URL format at call time,
// which breaks Next.js builds when DATABASE_URL is not yet configured.
// Using a getter ensures the connection is only created when actually used.
let _db: NeonHttpDatabase<typeof schema> | null = null

function getDb(): NeonHttpDatabase<typeof schema> {
  if (!_db) {
    const databaseUrl = process.env.DATABASE_URL
    if (!databaseUrl) {
      throw new Error(
        "DATABASE_URL is not set. Please set it in .env.local to a valid Neon PostgreSQL connection string."
      )
    }
    const sql = neon(databaseUrl)
    _db = drizzle({ client: sql, schema })
  }
  return _db
}

// Export a proxy that lazily initializes the database connection on first access.
// This allows Next.js to import and analyze this module during build without
// requiring a valid DATABASE_URL at build time.
export const db = new Proxy({} as NeonHttpDatabase<typeof schema>, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver)
  },
})

export type DB = NeonHttpDatabase<typeof schema>
