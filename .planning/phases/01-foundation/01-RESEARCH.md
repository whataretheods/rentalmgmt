# Phase 1: Foundation - Research

**Researched:** 2026-02-25
**Domain:** Next.js 15 App Router + Better Auth 1.4 + Drizzle ORM + Neon PostgreSQL — authentication, session management, data model, and route protection
**Confidence:** HIGH (core stack verified via official docs and Context7; Better Auth patterns verified against official better-auth.com documentation)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTH-01 | User can create tenant account with email and password | Better Auth `emailAndPassword: { enabled: true }` with `additionalFields` for role; Drizzle schema for User with role field |
| AUTH-02 | User session persists across browser refresh | Better Auth stores sessions in PostgreSQL via Drizzle adapter; HTTP-only cookies survive browser refresh and tab close/reopen by default (7-day expiry) |
| AUTH-03 | User can reset password via email link | Better Auth `sendResetPassword` callback in emailAndPassword config + Resend for email delivery; built-in token with configurable expiry |
| AUTH-05 | Multiple admin users can access admin portal with full access | Better Auth admin plugin with `role` field on user; middleware enforces `role === "admin"` before allowing `/admin/*` access |
</phase_requirements>

---

## Summary

Phase 1 delivers the foundational layer every subsequent phase depends on: a working Next.js 15.5 application with Better Auth session management, a complete Drizzle ORM schema covering all domain entities, and a barebones admin interface with role-enforced route protection. This is not a complex phase technically — Next.js + Better Auth + Drizzle is a well-documented combination with official integration guides between all three components — but it must be built carefully because every other phase builds on top of it. Mistakes in the data model or auth setup are expensive to retrofit.

The key decisions for this phase are all already locked (see STATE.md): Better Auth over Auth.js, Neon + Drizzle, the two-role model (TENANT/ADMIN). The work is applying the standard patterns correctly. The three failure modes to avoid are: (1) omitting `notification_preferences` fields from the schema now even though Phase 5 ships the UI, (2) implementing auth checks at the route level only without resource-level `tenantId` scoping in database queries, and (3) using the wrong middleware pattern for Next.js 15.5 (edge runtime) vs Next.js 15.2+ (Node.js runtime option).

Better Auth 1.4.x generates its own schema tables via CLI (`@better-auth/cli generate`) and then Drizzle migrations apply those alongside the domain schema. The admin plugin provides the TENANT/ADMIN role infrastructure out of the box. Password reset is built into the emailAndPassword plugin with a `sendResetPassword` callback — wire it to Resend early even if emails aren't styled yet.

**Primary recommendation:** Scaffold the Next.js app, run `npx @better-auth/cli generate` to produce the auth schema, define domain schema tables in `src/db/schema/`, run `drizzle-kit generate && drizzle-kit migrate` to apply everything, then implement middleware and route groups. Wire password reset to Resend even with a plain-text email. The admin interface can be barebones (a list page) — it just needs to exist and be role-protected to verify the auth machinery works end to end.

---

## Standard Stack

### Core (Phase 1 specific)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15.5.x | Full-stack framework — App Router, Server Actions, middleware | App Router route groups enable `(tenant)` and `(admin)` with separate layouts; Node.js middleware (stable in 15.5) allows full session validation |
| React | 19.x | UI rendering | Ships with Next.js 15.5; required |
| TypeScript | 5.x | Type safety across the entire app | Non-negotiable for a system handling payments and multi-user auth |
| Better Auth | 1.4.x | Email/password auth, session management, admin roles, password reset | Auth.js official successor; built-in Drizzle adapter; admin plugin covers TENANT/ADMIN role model; built-in scrypt hashing; nextCookies plugin needed for Server Actions |
| Drizzle ORM | 0.45.x | Type-safe PostgreSQL queries and schema migrations | Zero overhead, zero binary — required for Neon serverless driver compatibility; first-class official Neon integration |
| `@neondatabase/serverless` | latest | Neon serverless HTTP/WebSocket PostgreSQL driver | Required for Drizzle + Neon; HTTP driver for single queries, WebSocket for transactions |
| Tailwind CSS | 4.x | Styling | CSS-first config in v4; `@tailwindcss/postcss` package (no tailwind.config.ts needed); 5x faster builds |
| shadcn/ui | latest | Component primitives (forms, tables, buttons, layouts) | Zero runtime overhead — components are copied into project; uses `new-york` style by default in latest; admin dashboard templates available; `sonner` is now the default toast |
| `drizzle-kit` | latest (dev dep) | Schema generation and migrations | `drizzle-kit generate` + `drizzle-kit migrate`; also `drizzle-kit push` for dev |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@better-auth/cli` | latest | Generate Better Auth schema tables as Drizzle migrations | Run once after auth config is set up; also re-run when adding plugins |
| `zod` | 3.x | Form and server action validation | All form schemas and Server Action input validation; pairs with react-hook-form |
| `react-hook-form` | latest | Form state management | Login, registration, password reset, admin user management forms |
| `@hookform/resolvers` | latest | Bridge between zod and react-hook-form | Always install alongside both |
| `resend` | latest | Email delivery for password reset | Password reset email in Phase 1; full notification integration in Phase 5 |
| `@react-email/components` | latest | React-based email templates | Use for password reset email template; plain functional component, renders server-side |
| `lucide-react` | latest | Icon set | Ships with shadcn/ui; use for nav icons, status indicators |
| `sonner` | latest | Toast notifications | shadcn/ui default; use for auth feedback (login error, password reset sent) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Better Auth 1.4.x | Auth.js / NextAuth v5 | Auth.js maintainers officially merged into Better Auth; new projects should use Better Auth — credentials provider requires manual security hardening that Better Auth provides out of the box |
| Drizzle ORM | Prisma | Prisma binary has cold-start overhead and doesn't work cleanly with Neon's serverless driver; Drizzle is zero-dependency and ~7.4kb |
| `@better-auth/cli generate` flow | Manual schema creation | CLI ensures Better Auth's required tables match exact field expectations; manual schema risks subtle mismatches |

**Installation (Phase 1 packages):**
```bash
# Core framework (scaffold with create-next-app first)
npx create-next-app@latest rentalmgmt --typescript --tailwind --eslint --app --src-dir

# Auth
npm install better-auth
npm install -D @better-auth/cli

# Database
npm install drizzle-orm @neondatabase/serverless dotenv
npm install -D drizzle-kit tsx

# UI
npx shadcn@latest init   # select new-york style, Tailwind v4

# Forms and validation
npm install zod react-hook-form @hookform/resolvers

# Email (password reset)
npm install resend @react-email/components

# UI utilities
npm install sonner lucide-react
```

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── app/
│   ├── (tenant)/                  # Route group — tenant portal
│   │   ├── layout.tsx             # Tenant nav, auth guard
│   │   └── dashboard/
│   │       └── page.tsx           # Placeholder (Phase 2 fills this)
│   ├── (admin)/                   # Route group — admin portal
│   │   ├── layout.tsx             # Admin nav, auth + role guard
│   │   └── dashboard/
│   │       └── page.tsx           # Barebones admin landing
│   ├── auth/
│   │   ├── login/
│   │   │   └── page.tsx           # Shared login page
│   │   ├── register/
│   │   │   └── page.tsx           # Tenant registration
│   │   └── reset-password/
│   │       └── page.tsx           # Password reset form
│   └── api/
│       └── auth/
│           └── [...all]/
│               └── route.ts       # Better Auth catch-all handler
│
├── db/
│   ├── index.ts                   # Drizzle client (Neon HTTP driver)
│   ├── schema/
│   │   ├── auth.ts                # Better Auth generated tables (user, session, account, verification)
│   │   └── domain.ts             # Domain tables: property, unit, tenant_unit
│   └── index.ts                  # Re-exports db + schema
│
├── lib/
│   └── auth.ts                    # Better Auth instance (server-side config)
│
├── lib/
│   └── auth-client.ts             # Better Auth client (browser-side)
│
├── actions/
│   └── auth-actions.ts            # Server Actions: register, login, reset password
│
├── components/
│   ├── ui/                        # shadcn/ui primitives (auto-populated)
│   ├── auth/                      # LoginForm, RegisterForm, ResetPasswordForm
│   └── admin/                     # AdminNav, UserTable (barebones)
│
└── middleware.ts                  # Auth check + role enforcement
```

### Pattern 1: Better Auth Configuration (Server)

**What:** Central auth config in `src/lib/auth.ts`. This is the single source of truth for all auth behavior — email/password, session config, role definitions, password reset. The `nextCookies()` plugin is required for Server Actions that set cookies.

**When to use:** Imported by the API route handler and by server-side session retrieval everywhere.

```typescript
// Source: https://www.better-auth.com/docs/integrations/next
// src/lib/auth.ts
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { admin, nextCookies } from "better-auth/plugins"
import { db } from "@/db"
import * as schema from "@/db/schema"
import { resend } from "@/lib/resend"

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,  // pass your full schema so Better Auth can find its tables
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    sendResetPassword: async ({ user, url }) => {
      // Wire to Resend — can be plain text in Phase 1, styled in Phase 5
      await resend.emails.send({
        from: "RentalMgmt <noreply@yourdomain.com>",
        to: user.email,
        subject: "Reset your password",
        html: `<p>Click to reset your password: <a href="${url}">${url}</a></p>`,
      })
    },
    resetPasswordTokenExpiresIn: 3600, // 1 hour
  },
  plugins: [
    admin({
      defaultRole: "user",      // new registrations get "user" role
      adminRoles: ["admin"],    // "admin" role gets admin portal access
    }),
    nextCookies(),              // required for Server Actions to set cookies
  ],
  user: {
    additionalFields: {
      // Fields needed later — define now to avoid schema rewrites
      smsOptIn: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false,
      },
      smsOptInAt: {
        type: "string",  // ISO timestamp
        required: false,
        defaultValue: null,
        input: false,
      },
    },
  },
})
```

### Pattern 2: API Route Handler

**What:** Better Auth requires a catch-all route at `/api/auth/[...all]/route.ts`. All auth HTTP traffic (sign in, sign up, password reset callbacks) routes through here.

```typescript
// Source: https://www.better-auth.com/docs/integrations/next
// src/app/api/auth/[...all]/route.ts
import { auth } from "@/lib/auth"
import { toNextJsHandler } from "better-auth/next-js"

export const { GET, POST } = toNextJsHandler(auth)
```

### Pattern 3: Drizzle + Neon Setup

**What:** Drizzle HTTP client for Neon. Import the auth-generated schema plus the domain schema, pass both to the Drizzle instance.

```typescript
// Source: https://orm.drizzle.team/docs/get-started/neon-new
// src/db/index.ts
import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import * as schema from "./schema"

const sql = neon(process.env.DATABASE_URL!)
export const db = drizzle({ client: sql, schema })
export type DB = typeof db
```

```typescript
// drizzle.config.ts (project root)
import "dotenv/config"
import { defineConfig } from "drizzle-kit"

export default defineConfig({
  out: "./drizzle",
  schema: "./src/db/schema",   // points to schema directory
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
```

### Pattern 4: Schema Layout — Auth Tables + Domain Tables

**What:** Better Auth CLI generates the auth tables (user, session, account, verification). Domain tables are defined separately. Both are in the same Drizzle schema directory so the db instance sees everything.

```typescript
// Source: https://www.better-auth.com/docs/adapters/drizzle
// Run FIRST to generate auth tables:
// npx @better-auth/cli@latest generate
// Output goes into src/db/schema/auth.ts (or wherever you configure)

// src/db/schema/domain.ts — domain tables defined manually
import { pgTable, text, integer, boolean, timestamp, uuid } from "drizzle-orm/pg-core"

export const properties = pgTable("properties", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const units = pgTable("units", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id").references(() => properties.id).notNull(),
  unitNumber: text("unit_number").notNull(),
  rentAmountCents: integer("rent_amount_cents"),  // nullable until configured
  rentDueDay: integer("rent_due_day"),             // day of month (1-28)
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

// Links a user (tenant) to a unit — supports historical tenancies
export const tenantUnits = pgTable("tenant_units", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),             // references Better Auth user.id
  unitId: uuid("unit_id").references(() => units.id).notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),                // null = current tenancy
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

// src/db/schema/index.ts — barrel export
export * from "./auth"    // Better Auth generated tables
export * from "./domain"  // Property, Unit, TenantUnit
```

### Pattern 5: Middleware — Auth Check + Role Enforcement

**What:** Single `middleware.ts` at project root. Uses Node.js runtime (stable in Next.js 15.5) for full session validation. Redirects unauthenticated users to `/auth/login`. Redirects authenticated non-admin users away from `/admin/*`.

**Critical note:** In Next.js 15.5 with Node.js middleware runtime, you can call `auth.api.getSession()` directly. Prefer this over `getSessionCookie()` for admin role checks because `getSessionCookie()` does not validate the session — it only checks cookie existence and can be bypassed.

```typescript
// Source: https://www.better-auth.com/docs/integrations/next
// middleware.ts (project root)
import { NextRequest, NextResponse } from "next/server"
import { getSessionCookie } from "better-auth/cookies"

// Use cookie-based check for speed — validate fully in each page/layout
export async function middleware(request: NextRequest) {
  const sessionCookie = getSessionCookie(request)
  const { pathname } = request.nextUrl

  // Unauthenticated user accessing protected route → login
  if (!sessionCookie) {
    if (pathname.startsWith("/tenant") || pathname.startsWith("/admin")) {
      return NextResponse.redirect(new URL("/auth/login", request.url))
    }
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|auth).*)",
  ],
}
```

**IMPORTANT:** Middleware only does cookie existence check for speed. Each layout must perform a full server-side session check and role validation using `auth.api.getSession()`:

```typescript
// Source: https://www.better-auth.com/docs/integrations/next
// src/app/(admin)/layout.tsx
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() })

  // Full validation: must be authenticated AND have admin role
  if (!session) redirect("/auth/login")
  if (session.user.role !== "admin") redirect("/tenant/dashboard")

  return <>{children}</>
}
```

### Pattern 6: Better Auth Client (Browser)

**What:** The client-side auth instance used in Client Components for sign-in, sign-up, and password reset UI.

```typescript
// Source: https://www.better-auth.com/docs/integrations/next
// src/lib/auth-client.ts
import { createAuthClient } from "better-auth/react"
import { adminClient } from "better-auth/client/plugins"

export const authClient = createAuthClient({
  plugins: [adminClient()],
})

// Usage in Client Components:
// const { data: session } = authClient.useSession()
// await authClient.signIn.email({ email, password })
// await authClient.signUp.email({ email, password, name })
// await authClient.forgetPassword({ email, redirectTo: "/auth/reset-password" })
// await authClient.resetPassword({ newPassword, token })
```

### Pattern 7: Resource-Level Authorization (CRITICAL)

**What:** Every database query for tenant-owned resources MUST include a `userId` or `tenantId` scope. This prevents IDOR (Insecure Direct Object Reference) where tenant A accesses tenant B's data by guessing IDs.

**When to use:** Every Server Action and Route Handler that fetches a resource owned by a user.

```typescript
// Source: Architecture research — PITFALLS.md (IDOR prevention)
// CORRECT: scope by authenticated user's ID
export async function getTenantUnit(userId: string) {
  return db.query.tenantUnits.findFirst({
    where: (tenantUnits, { eq, and }) =>
      and(eq(tenantUnits.userId, userId), eq(tenantUnits.isActive, true)),
    with: { unit: true },
  })
}

// WRONG: looks up by ID alone — any authenticated user can access any unit
// return db.query.tenantUnits.findFirst({ where: eq(tenantUnits.id, id) })
```

### Anti-Patterns to Avoid

- **Checking auth only in middleware:** Middleware does a cookie existence check for performance. A valid cookie from an expired or invalidated session passes middleware. Always call `auth.api.getSession()` in layouts and server components that render protected content.
- **Storing role in a client-readable location:** The `role` field is managed by Better Auth's admin plugin server-side. Never trust role information passed from the client.
- **Using `getSessionCookie()` for admin role gating:** `getSessionCookie()` only checks cookie existence — it cannot read role from the cookie. Use `auth.api.getSession()` for any role-based decision.
- **Skipping `nextCookies()` plugin:** Without this plugin, Server Actions that call Better Auth methods (sign in, sign up) fail to set cookies in the response. Required.
- **Defining domain schema without `userId` foreign keys to Better Auth's user table:** Better Auth generates its own `user` table with `id: text` (not uuid). Domain tables that reference users must use `text` for the foreign key, not `uuid`.
- **One schema file for everything:** Split auth schema (CLI-generated, do not edit) from domain schema (manually maintained). This avoids merge conflicts when re-running the CLI.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password hashing | Custom bcrypt/argon2 wrapper | Better Auth built-in (scrypt) | Better Auth uses scrypt by default — designed to be slow and memory-intensive; handles salt, iterations, verification |
| Session storage + token management | Custom JWT or session table | Better Auth session system | Better Auth handles session creation, rotation, expiry, invalidation, and DB persistence |
| Password reset token generation + expiry | Custom token table | Better Auth `emailAndPassword.sendResetPassword` | Built-in token generation, storage, validation, and expiry (`resetPasswordTokenExpiresIn`); verified token-for-password exchange |
| Rate limiting on auth endpoints | Custom rate limiter middleware | Better Auth built-in rate limiting | Better Auth has built-in rate limiting on auth endpoints by default — no configuration needed for standard protection |
| Role management | Custom roles table | Better Auth admin plugin | `admin()` plugin adds `role` field to user table, provides `userHasPermission` API, manages role assignment server-side |
| CSRF protection | Manual CSRF token handling | Better Auth handles CSRF | Better Auth manages CSRF protection for all its endpoints |
| Cookie flags (httpOnly, secure, sameSite) | Manual `Set-Cookie` headers | Better Auth + `nextCookies()` plugin | Better Auth sets httpOnly, secure (in prod), sameSite=lax automatically; `nextCookies()` makes this work in Server Actions |

**Key insight:** Authentication is one of the highest-risk hand-roll areas in web development. Every custom implementation has historically introduced vulnerabilities (timing attacks, session fixation, token leakage). Better Auth encapsulates these solutions — don't bypass them.

---

## Common Pitfalls

### Pitfall 1: Forgetting `notification_preferences` in Phase 1 Schema

**What goes wrong:** Phase 5 (Notifications) needs `smsOptIn`, `smsOptInAt`, and email preference fields per user. If these aren't in the Phase 1 schema, Phase 5 requires a schema migration that touches the user table — higher risk and more friction later.

**Why it happens:** Phase 1 feels like "just auth" — it's tempting to keep the schema minimal. But the user table is the root of the data model; adding to it later requires a migration in production.

**How to avoid:** Add `smsOptIn` (boolean, default false) and `smsOptInAt` (timestamp, nullable) to Better Auth's `additionalFields` in Phase 1. Add `emailOptIn` (boolean, default true) as well. These are null-safe — they don't affect Phase 1 behavior but prevent Phase 5 schema rewrites.

**Warning signs:** Phase 1 schema has no notification-preference columns on the user record.

### Pitfall 2: Wrong User ID Type in Domain Schema

**What goes wrong:** Better Auth generates `user.id` as `text` (string UUID stored as text, not PostgreSQL uuid type). Domain tables that reference `user.id` using `uuid()` Drizzle column type will fail foreign key constraints or type mismatches.

**Why it happens:** Developers assume user PKs are uuid columns. Better Auth's generated schema uses `text` for `id` across all its tables (user, session, account).

**How to avoid:** Define `userId` foreign key columns in domain tables as `text("user_id").notNull()`, not `uuid("user_id")`. Verify against the CLI-generated auth schema before writing domain schema.

**Warning signs:** Foreign key errors when inserting a `tenantUnit` record linking to a Better Auth user.

### Pitfall 3: Middleware Edge Runtime + Better Auth Session Validation

**What goes wrong:** Calling `auth.api.getSession()` in middleware with the default Edge runtime throws an error because the Edge runtime doesn't have access to Node.js APIs that Better Auth's session validation uses.

**Why it happens:** Next.js 15.5 supports Node.js middleware as a stable feature, but it's opt-in. The default runtime for `middleware.ts` remains Edge.

**How to avoid:** For middleware that only redirects unauthenticated users, use `getSessionCookie(request)` from `better-auth/cookies` — this is Edge-safe and only checks cookie existence. For role validation (admin check), do it inside each layout using `auth.api.getSession()` which runs in the Node.js runtime of Server Components/Layouts (not middleware). If you do need full validation in middleware, add `export const runtime = "nodejs"` to the middleware file, but this has performance implications.

**Warning signs:** `TypeError: edge runtime does not support Node.js` in middleware when calling auth functions.

### Pitfall 4: Resource-Level Authorization Not Enforced

**What goes wrong:** Tenants can access other tenants' data by manipulating resource IDs in API calls or URL parameters. Auth middleware only checks "is this user logged in?" — not "does this user own this resource?"

**Why it happens:** Authorization is implemented at the route level (middleware) but not at the query level. This is the #5 pitfall identified in PITFALLS.md.

**How to avoid:** Every Drizzle query for a tenant-owned resource must include `eq(table.userId, session.user.id)` in the WHERE clause. Centralize this in `lib/` service functions so the pattern is enforced once, not per-handler.

**Warning signs:** Any route handler or Server Action that queries by resource ID alone without also filtering by the authenticated user's ID.

### Pitfall 5: Admin Portal Without Seeded Admin User

**What goes wrong:** Phase 1 delivers an admin portal, but there's no way to create admin users from the UI (and there shouldn't be — this is a security requirement). If the seeding mechanism isn't built, no one can log into the admin portal during development.

**Why it happens:** Admin user creation is a chicken-and-egg problem. The admin plugin restricts role assignment to admins only, so the first admin must be created differently.

**How to avoid:** Build a seeding script (`scripts/seed-admin.ts`) that uses Better Auth's server-side `auth.api.createUser()` with `role: "admin"` set directly. Also consider `adminUserIds` in the admin plugin config to designate specific user IDs as admin regardless of their role field. Run the seed script once on initial deploy.

**Warning signs:** No way to create or designate an admin user; admin portal is inaccessible in development.

### Pitfall 6: shadcn/ui + Tailwind v4 Breaking Changes

**What goes wrong:** shadcn/ui with Tailwind v4 has breaking changes from v3: `tailwindcss-animate` is replaced by `tw-animate-css`, the `toast` component is deprecated in favor of `sonner`, and `forwardRef` patterns are removed from components. If you initialize shadcn with `--style default` instead of `--style new-york`, you get the deprecated style.

**Why it happens:** Community tutorials and stack overflow answers often reference the v3 setup. The shadcn Tailwind v4 migration is relatively recent.

**How to avoid:** Always run `npx shadcn@latest init` (not a pinned version). When prompted, select `new-york` style. Use `sonner` for toasts from the start. Do not install `tailwindcss-animate`.

**Warning signs:** `tailwind.config.ts` file exists (v4 doesn't need it); using `useToast` hook from `@/components/ui/toast` instead of `sonner`.

---

## Code Examples

Verified patterns from official sources:

### Complete Better Auth Setup (auth.ts)

```typescript
// Source: https://www.better-auth.com/docs/integrations/next + https://www.better-auth.com/docs/plugins/admin
// src/lib/auth.ts
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
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    sendResetPassword: async ({ user, url }) => {
      // Import resend and send email — do NOT await to prevent timing attacks
      // (Better Auth docs explicitly warn against this)
      void sendPasswordResetEmail(user.email, url)
    },
    resetPasswordTokenExpiresIn: 3600, // 1 hour in seconds
  },
  plugins: [
    admin({
      defaultRole: "user",     // tenants get "user" role
      adminRoles: ["admin"],   // "admin" role gets full admin access
    }),
    nextCookies(),             // REQUIRED for Server Action cookie setting
  ],
  user: {
    additionalFields: {
      smsOptIn: { type: "boolean", required: false, defaultValue: false, input: false },
      smsOptInAt: { type: "string", required: false, defaultValue: null, input: false },
    },
  },
})
```

### Schema Generation Workflow

```bash
# Step 1: Generate Better Auth schema tables
npx @better-auth/cli@latest generate
# → Outputs to src/db/schema/auth.ts (or configured path)

# Step 2: Write domain schema manually (src/db/schema/domain.ts)

# Step 3: Generate and apply migrations
npx drizzle-kit generate
npx drizzle-kit migrate

# For development: push directly without migration files
npx drizzle-kit push
```

### Admin User Seeding Script

```typescript
// Source: https://www.better-auth.com/docs/plugins/admin
// scripts/seed-admin.ts
import { auth } from "@/lib/auth"

async function seedAdmin() {
  try {
    const user = await auth.api.createUser({
      body: {
        email: process.env.ADMIN_EMAIL!,
        password: process.env.ADMIN_PASSWORD!,
        name: "Admin",
        role: "admin",
      },
    })
    console.log("Admin user created:", user.user.id)
  } catch (error) {
    console.error("Failed to create admin:", error)
  }
  process.exit(0)
}

seedAdmin()
```

```bash
# Run seed script
npx tsx scripts/seed-admin.ts
```

### Password Reset Flow (Client Side)

```typescript
// Source: https://www.better-auth.com/docs/authentication/email-password
// In a "Forgot Password" Client Component:
import { authClient } from "@/lib/auth-client"

// Step 1: Request reset link
await authClient.forgetPassword({
  email: formData.email,
  redirectTo: "/auth/reset-password",  // token appended as query param
})

// Step 2: On the reset-password page (token from URL search params):
await authClient.resetPassword({
  newPassword: formData.newPassword,
  token: searchParams.get("token")!,
})
```

### Drizzle Query with Tenant Scoping

```typescript
// Source: Architecture research — PITFALLS.md (IDOR prevention)
// src/lib/tenants.ts
import { db } from "@/db"
import { tenantUnits, units } from "@/db/schema"
import { eq, and } from "drizzle-orm"

// Always scope tenant queries by userId — never by resource ID alone
export async function getCurrentTenantUnit(userId: string) {
  return db.query.tenantUnits.findFirst({
    where: and(
      eq(tenantUnits.userId, userId),
      eq(tenantUnits.isActive, true)
    ),
    with: { unit: { with: { property: true } } },
  })
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Auth.js / NextAuth v5 | Better Auth 1.4.x | 2025 — Auth.js team officially merged into Better Auth | New projects should start on Better Auth; credentials provider in Auth.js requires manual security hardening that Better Auth provides built-in |
| `tailwind.config.ts` | CSS-only config via `globals.css` `@theme` directive | Tailwind v4 (January 2025) | No config file needed; `@tailwindcss/postcss` package replaces `tailwindcss` in PostCSS config |
| `tailwindcss-animate` | `tw-animate-css` | shadcn/ui Tailwind v4 migration | Breaking change in shadcn/ui; install `tw-animate-css` not `tailwindcss-animate` |
| `useToast` / `Toaster` component | `sonner` | shadcn/ui recent update | `toast` component deprecated; use `sonner` for all toast notifications |
| Edge runtime-only middleware | Node.js middleware (opt-in, stable in 15.5) | Next.js 15.2+ | Allows full session validation in middleware; enables calling Node.js-dependent auth functions |
| Prisma on Neon | Drizzle ORM on Neon | 2024-2025 | Prisma binary overhead unsuitable for serverless; Drizzle zero-dependency approach is first-class on Neon |
| `next lint` CLI | Direct `eslint` CLI | Next.js 15.5 | `next lint` is deprecated in 15.5 and will be removed in Next.js 16; use `eslint --config eslint.config.mjs` |

**Deprecated/outdated:**
- `Auth.js` credentials provider for new projects: The Auth.js team explicitly recommends Better Auth for new projects.
- Pages Router: App Router is the only supported path for new Next.js features. This project uses App Router exclusively.
- `tailwind.config.ts`: Tailwind v4 uses CSS-first configuration. No TypeScript config file.
- `forwardRef` patterns in React components: React 19 + shadcn/ui latest removed forwardRef; components are plain function components.

---

## Open Questions

1. **Admin user bootstrap in production**
   - What we know: Better Auth admin plugin restricts role assignment to existing admins; the first admin must be seeded differently (via script or `adminUserIds` config)
   - What's unclear: Whether to use `adminUserIds` (hardcoded user ID in config) or a seeding script for initial admin setup
   - Recommendation: Use both — `adminUserIds` for the landlord's account (set in env var), seeding script for development. Simpler than maintaining a separate seeding mechanism.

2. **Neon database branching strategy**
   - What we know: Neon supports instant DB branches — a copy of the DB for dev/staging environments
   - What's unclear: Whether the team wants separate Neon databases per environment or Neon branching
   - Recommendation: Use Neon branching for staging; `DATABASE_URL` in `.env.local` for dev. This is an ops decision, not a code decision — doesn't block Phase 1 but should be settled before Phase 3 (payments in production).

3. **Property seed data**
   - What we know: The system manages one property with 5 units; these don't change
   - What's unclear: Whether the property and unit records should be seeded via migration or created through an admin UI
   - Recommendation: Seed property + unit records via a migration or seed script in Phase 1. An admin UI for unit management is a later concern — the units need to exist for auth and data model testing.

---

## Sources

### Primary (HIGH confidence)
- [Better Auth Next.js Integration](https://www.better-auth.com/docs/integrations/next) — middleware setup, API route, server-side session retrieval, client setup
- [Better Auth Email/Password Plugin](https://www.better-auth.com/docs/authentication/email-password) — password reset flow, scrypt hashing, `sendResetPassword` callback, token expiry
- [Better Auth Admin Plugin](https://www.better-auth.com/docs/plugins/admin) — role management, `defaultRole`, `adminRoles`, `adminUserIds`, server-side permission check
- [Better Auth Drizzle Adapter](https://www.better-auth.com/docs/adapters/drizzle) — `drizzleAdapter` setup, `provider: "pg"`, schema passing, experimental joins
- [Better Auth Installation](https://www.better-auth.com/docs/installation) — env vars, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, CLI schema generation workflow
- [Drizzle ORM + Neon Get Started](https://orm.drizzle.team/docs/get-started/neon-new) — `neon-http` driver, `drizzle.config.ts`, migration commands
- [shadcn/ui Tailwind v4 Guide](https://ui.shadcn.com/docs/tailwind-v4) — breaking changes, `tw-animate-css`, `sonner`, `new-york` style, `data-slot` attribute changes

### Secondary (MEDIUM confidence)
- [Better Auth V1.0 Release](https://www.better-auth.com/v1) — stable production release, feature set
- [Better Auth Blog — Auth.js Joins Better Auth](https://www.better-auth.com/blog/authjs-joins-better-auth) — confirmed recommendation to use Better Auth for new projects
- [Neon Docs — Connect Drizzle to Neon](https://neon.com/docs/guides/drizzle) — official Drizzle integration guide from Neon
- [Next.js 15.5 Release](https://nextjs.org/blog/next-15-5) — Node.js middleware stable, `next lint` deprecation
- GitHub Issue — `getSessionCookie` Edge runtime compatibility concerns (#2170, #5120) — confirmed Edge runtime limitation; use Node.js runtime or cookie-check-only approach

### Tertiary (LOW confidence)
- Medium article: Full-stack Next.js + Drizzle + Neon + Better Auth — helpful for patterns, not authoritative; verified against official docs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — All packages verified via official documentation with current versions
- Architecture: HIGH — Better Auth + Drizzle + Next.js is an officially documented combination; patterns drawn from official sources
- Pitfalls: HIGH for auth-specific pitfalls (verified against Better Auth docs and GitHub issues); MEDIUM for schema/data model pitfalls (derived from domain knowledge and research)

**Research date:** 2026-02-25
**Valid until:** 2026-03-25 (30 days — Better Auth and Next.js are active; check for Better Auth 1.5.x or Next.js 16 stable before extending)
