// Temporary skeleton for CLI schema generation -- will be replaced in Task 2
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { admin, nextCookies } from "better-auth/plugins"
import { db } from "@/db"
import * as schema from "@/db/schema"

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: { enabled: true },
  plugins: [
    admin({ defaultRole: "user", adminRoles: ["admin"] }),
    nextCookies(),
  ],
  user: {
    additionalFields: {
      smsOptIn: { type: "boolean", required: false, defaultValue: false, input: false },
      smsOptInAt: { type: "string", required: false, defaultValue: null, input: false },
    },
  },
})
