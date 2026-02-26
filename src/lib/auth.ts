import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { admin } from "better-auth/plugins"
import { nextCookies } from "better-auth/next-js"
import { createAuthMiddleware } from "better-auth/api"
import { eq, and, gt } from "drizzle-orm"
import { db } from "@/db"
import * as schema from "@/db/schema"
import { inviteTokens, tenantUnits } from "@/db/schema"
import { resend } from "@/lib/resend"
import { hashToken } from "@/lib/tokens"

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
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      // Only process signup requests
      if (!ctx.path.startsWith("/sign-up")) return

      const newSession = ctx.context.newSession
      if (!newSession) return

      // Read invite token from request body (passed as extra field by invite registration form)
      let body: Record<string, unknown> = {}
      try {
        body = ctx.body as Record<string, unknown> ?? {}
      } catch {
        // Body may not be parseable — skip invite processing
        return
      }

      const inviteToken = body.inviteToken as string | undefined
      if (!inviteToken) return  // Normal registration (no invite) — skip

      const tokenHash = hashToken(inviteToken)
      const now = new Date()

      // Atomic consumption: UPDATE WHERE status='pending' AND not expired
      // If 0 rows returned, token was already used, expired, or invalid
      const [consumed] = await db
        .update(inviteTokens)
        .set({
          status: "used",
          usedByUserId: newSession.user.id,
          usedAt: now,
        })
        .where(
          and(
            eq(inviteTokens.tokenHash, tokenHash),
            eq(inviteTokens.status, "pending"),
            gt(inviteTokens.expiresAt, now),
          )
        )
        .returning()

      if (!consumed) {
        // Token invalid/expired/already used — user is created but not linked
        // They'll see an "unlinked" state on their dashboard
        console.warn("Invite token consumption failed for user:", newSession.user.id)
        return
      }

      // Link user to unit
      await db.insert(tenantUnits).values({
        userId: newSession.user.id,
        unitId: consumed.unitId,
        startDate: now,
        isActive: true,
      })

      console.log("Tenant linked to unit:", {
        userId: newSession.user.id,
        unitId: consumed.unitId,
      })
    }),
  },
})

export type Session = typeof auth.$Infer.Session
export type User = typeof auth.$Infer.Session.user
