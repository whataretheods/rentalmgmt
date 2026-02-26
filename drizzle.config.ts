import { config } from "dotenv"
config({ path: ".env.local" })
import { defineConfig } from "drizzle-kit"

export default defineConfig({
  out: "./drizzle",
  schema: "./src/db/schema",   // points to schema directory -- picks up all files
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
