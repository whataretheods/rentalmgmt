import { Pool, neonConfig } from "@neondatabase/serverless"
import { drizzle, NeonDatabase } from "drizzle-orm/neon-serverless"
import ws from "ws"
import * as schema from "./schema"

// Required for Node.js < v22: native WebSocket is only available in v22+.
// The ws package provides the WebSocket implementation for neon-serverless.
neonConfig.webSocketConstructor = ws

// Lazy initialization: the Pool validates the URL format at creation time,
// which breaks Next.js builds when DATABASE_URL is not yet configured.
// Using a getter ensures the connection is only created when actually used.
let _pool: Pool | null = null

function getPool(): Pool {
  if (!_pool) {
    const databaseUrl = process.env.DATABASE_URL
    if (!databaseUrl) {
      throw new Error(
        "DATABASE_URL is not set. Please set it in .env.local to a valid Neon PostgreSQL connection string."
      )
    }
    // NOTE: DATABASE_URL should use the -pooler hostname suffix for PgBouncer
    // connection pooling (e.g., ep-xxx-pooler.us-east-2.aws.neon.tech).
    _pool = new Pool({ connectionString: databaseUrl })
  }
  return _pool
}

let _db: NeonDatabase<typeof schema> | null = null

function getDb(): NeonDatabase<typeof schema> {
  if (!_db) {
    _db = drizzle({ client: getPool(), schema })
  }
  return _db
}

// Export a proxy that lazily initializes the database connection on first access.
// This allows Next.js to import and analyze this module during build without
// requiring a valid DATABASE_URL at build time.
export const db = new Proxy({} as NeonDatabase<typeof schema>, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver)
  },
})

export type DB = NeonDatabase<typeof schema>
