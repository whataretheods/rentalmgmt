import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { admin } from "better-auth/plugins"
import { nextCookies } from "better-auth/next-js"
import { db } from "@/db"
import * as schema from "@/db/schema"
import { resend } from "@/lib/resend"

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    sendResetPassword: async ({ user, url }) => {
      // Do NOT await -- Better Auth docs warn against awaiting to prevent timing attacks
      void resend.emails.send({
        from: "RentalMgmt <noreply@rentalmgmt.com>",
        to: user.email,
        subject: "Reset your password",
        html: `<p>Reset your password: <a href="${url}">${url}</a></p><p>This link expires in 1 hour.</p>`,
      })
    },
    resetPasswordTokenExpiresIn: 3600, // 1 hour in seconds
  },
  plugins: [
    admin({
      defaultRole: "user",     // all new sign-ups get "user" (tenant) role
      adminRoles: ["admin"],   // "admin" role grants admin portal access
    }),
    nextCookies(),             // REQUIRED: without this, Server Actions cannot set auth cookies
  ],
  user: {
    additionalFields: {
      smsOptIn: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false,          // cannot be set by user at signup
      },
      smsOptInAt: {
        type: "string",        // ISO timestamp string
        required: false,
        defaultValue: null,
        input: false,
      },
    },
  },
})

export type Session = typeof auth.$Infer.Session
export type User = typeof auth.$Infer.Session.user
