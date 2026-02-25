---
phase: 01-foundation
plan: 02
subsystem: auth
tags: [better-auth, drizzle, neon, resend, nextcookies, admin-plugin, email-password]

# Dependency graph
requires:
  - phase: 01-foundation-01
    provides: "Next.js scaffold, Drizzle client, domain schema, all Phase 1 packages"
provides:
  - "Better Auth server config with emailAndPassword, admin plugin, nextCookies, additionalFields"
  - "Better Auth browser client with adminClient plugin"
  - "Auth schema tables: user, session, account, verification (with admin and smsOptIn fields)"
  - "Resend client singleton for password reset emails"
  - "API catch-all route at /api/auth/[...all]"
  - "Drizzle migration SQL covering all auth + domain tables"
  - "Session and User TypeScript types from auth.$Infer"
affects: [01-03, 01-04, 01-05, 01-06]

# Tech tracking
tech-stack:
  added: []
  patterns: [better-auth-drizzle-adapter, lazy-db-proxy, lazy-resend-proxy, nextcookies-from-next-js, force-dynamic-auth-route]

key-files:
  created: [src/lib/auth.ts, src/lib/auth-client.ts, src/lib/resend.ts, "src/app/api/auth/[...all]/route.ts", src/db/schema/auth.ts, drizzle/0000_fine_rawhide_kid.sql]
  modified: [src/db/schema/index.ts, src/db/index.ts]

key-decisions:
  - "nextCookies is imported from better-auth/next-js, not better-auth/plugins (API change in 1.4.x)"
  - "Auth schema generated manually matching CLI output due to CLI requiring live database connection"
  - "DB client uses Proxy for lazy initialization to support builds without DATABASE_URL"
  - "Resend client uses Proxy for lazy initialization to support builds without RESEND_API_KEY"
  - "forgetPassword/resetPassword removed from auth-client re-exports (not in TypeScript types at top level)"

patterns-established:
  - "Lazy Proxy pattern for server-side singletons: wrap neon() and Resend() in getters behind Proxy to defer instantiation past build time"
  - "nextCookies import from better-auth/next-js (not better-auth/plugins) for Server Action cookie support"
  - "force-dynamic on auth catch-all route to prevent static page data collection"
  - "Auth schema owned by Better Auth CLI output format; domain schema manually maintained separately"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03, AUTH-05]

# Metrics
duration: 7min
completed: 2026-02-25
---

# Phase 1 Plan 02: Better Auth Configuration Summary

**Better Auth server with email/password auth, admin plugin, Resend-powered password reset, and Drizzle-generated auth schema (user, session, account, verification) with smsOptIn additionalFields**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-25T20:50:08Z
- **Completed:** 2026-02-25T20:57:41Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Generated Better Auth auth schema with user, session, account, and verification tables including admin plugin fields (role, banned, banReason, banExpires) and custom additionalFields (smsOptIn, smsOptInAt)
- Configured Better Auth server with emailAndPassword, sendResetPassword via Resend, admin plugin, and nextCookies plugin
- Created browser-side auth client with adminClient plugin for Client Components
- Generated Drizzle migration SQL covering all 7 tables (4 auth + 3 domain) with proper foreign keys and indexes
- Build passes cleanly with zero TypeScript errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Generate Better Auth schema and run database migrations** - `beddc01` (feat)
2. **Task 2: Configure Better Auth server instance, Resend client, auth-client, and API route** - `31c743c` (feat)

## Files Created/Modified
- `src/db/schema/auth.ts` - Better Auth generated tables: user (with role, banned, smsOptIn, smsOptInAt), session, account, verification, plus Drizzle relations
- `src/db/schema/index.ts` - Barrel export now includes both auth and domain schemas
- `src/db/index.ts` - Modified to use lazy Proxy initialization for Neon connection
- `src/lib/auth.ts` - Better Auth server config: drizzleAdapter, emailAndPassword with sendResetPassword, admin plugin, nextCookies, additionalFields
- `src/lib/auth-client.ts` - Browser auth client with adminClient plugin; exports signIn, signUp, signOut, useSession
- `src/lib/resend.ts` - Resend client singleton with lazy Proxy initialization
- `src/app/api/auth/[...all]/route.ts` - Better Auth catch-all HTTP handler with force-dynamic
- `drizzle/0000_fine_rawhide_kid.sql` - Full migration SQL for all 7 tables with foreign keys and indexes

## Decisions Made
- **nextCookies import path:** The plan specified `import { nextCookies } from "better-auth/plugins"` but Better Auth 1.4.19 exports `nextCookies` from `better-auth/next-js` instead. Verified at runtime and adjusted all imports.
- **Manual auth schema generation:** The Better Auth CLI requires a live database connection to generate the schema (it instantiates the adapter). Since DATABASE_URL is a placeholder, I used `getAuthTables()` from `better-auth/db` to get the exact schema definition and generated the Drizzle schema manually matching the CLI's output format (verified against the CLI source code).
- **Lazy Proxy for db and Resend:** Next.js evaluates route modules during build for page data collection. Both `neon()` and `new Resend()` validate their inputs at call time, causing build failures without real credentials. Wrapping both in Proxy objects that defer initialization to first property access solves this cleanly.
- **Reduced auth-client re-exports:** The plan included `forgetPassword` and `resetPassword` in destructured re-exports, but TypeScript types don't expose these at the top level of the auth client. Removed them to pass type checking; consumers can access them via `authClient.forgetPassword()` and `authClient.resetPassword()` directly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] nextCookies import path incorrect**
- **Found during:** Task 1 (auth skeleton creation)
- **Issue:** Plan specified `import { nextCookies } from "better-auth/plugins"` but `nextCookies` is not exported from that path in Better Auth 1.4.19
- **Fix:** Changed import to `import { nextCookies } from "better-auth/next-js"` (verified via runtime check)
- **Files modified:** src/lib/auth.ts
- **Verification:** TypeScript compilation passes; build succeeds
- **Committed in:** beddc01 (Task 1), 31c743c (Task 2)

**2. [Rule 3 - Blocking] CLI requires live database connection for schema generation**
- **Found during:** Task 1 (CLI execution)
- **Issue:** `npx @better-auth/cli generate` imports auth.ts which imports db/index.ts which calls `neon()` with placeholder DATABASE_URL, causing the CLI to fail with "Database connection string format" error
- **Fix:** Used `getAuthTables()` from `better-auth/db` and the CLI's own generator logic to produce the exact Drizzle schema the CLI would output. Verified field types, column names, indexes, and relations match the CLI source code.
- **Files modified:** src/db/schema/auth.ts
- **Verification:** Schema contains correct pgTable definitions for all 4 tables; drizzle-kit generate produces valid migration SQL; TypeScript compiles cleanly
- **Committed in:** beddc01 (Task 1)

**3. [Rule 3 - Blocking] Build fails during page data collection without valid DATABASE_URL**
- **Found during:** Task 2 (npm run build)
- **Issue:** `neon()` validates URL format at call time; `new Resend()` validates API key at instantiation. Both are called at module scope, causing the build to fail during page data collection.
- **Fix:** Wrapped both `db` and `resend` exports in Proxy objects that defer initialization to first property access. Added `force-dynamic` to auth route.
- **Files modified:** src/db/index.ts, src/lib/resend.ts, src/app/api/auth/[...all]/route.ts
- **Verification:** `npm run build` completes successfully with zero errors
- **Committed in:** 31c743c (Task 2)

**4. [Rule 1 - Bug] forgetPassword/resetPassword not in TypeScript types at top level**
- **Found during:** Task 2 (TypeScript compilation)
- **Issue:** `export const { forgetPassword, resetPassword } = authClient` fails TS2339 because these methods exist at runtime (Proxy) but not in the TypeScript type definition at the top level
- **Fix:** Removed `forgetPassword` and `resetPassword` from destructured re-exports; kept signIn, signUp, signOut, useSession which have proper types
- **Files modified:** src/lib/auth-client.ts
- **Verification:** TypeScript compiles cleanly
- **Committed in:** 31c743c (Task 2)

---

**Total deviations:** 4 auto-fixed (1 bug, 3 blocking)
**Impact on plan:** All auto-fixes necessary for correctness and build success. No scope creep. The lazy Proxy pattern is a clean solution that doesn't change runtime behavior.

## Issues Encountered
- Database migrations could not be applied to Neon because DATABASE_URL is a placeholder. Migration SQL files were generated and are ready to apply when a real Neon connection string is configured (`npx drizzle-kit migrate`).
- BETTER_AUTH_SECRET warning during build: "You are using the default secret" -- expected when env var is not set. Does not prevent build.

## User Setup Required
Before the auth system is fully operational, the following environment variables must be set in `.env.local`:
- `DATABASE_URL` - Valid Neon PostgreSQL connection string (from Neon dashboard)
- `BETTER_AUTH_SECRET` - Generate with `openssl rand -base64 32`
- `RESEND_API_KEY` - From Resend dashboard (required for password reset emails)

After setting DATABASE_URL, run: `npx drizzle-kit migrate` to apply all migrations to Neon.

## Next Phase Readiness
- Auth server config complete and exports `auth` with full plugin chain
- Auth client exports `authClient` with `signIn`, `signUp`, `signOut`, `useSession` for UI consumption
- API route handler at `/api/auth/[...all]` is wired and ready
- Schema barrel export includes both auth and domain tables
- Ready for Plan 03: Middleware and route protection (depends on auth.ts)
- Ready for Plan 04: Auth UI pages (depends on auth-client.ts and API route)

## Self-Check: PASSED

All 6 created files verified present. Both task commits (beddc01, 31c743c) confirmed in git history.

---
*Phase: 01-foundation*
*Completed: 2026-02-25*
