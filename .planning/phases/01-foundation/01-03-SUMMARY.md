---
phase: 01-foundation
plan: 03
subsystem: auth
tags: [middleware, route-protection, edge-runtime, getSessionCookie, role-enforcement, route-groups]

# Dependency graph
requires:
  - phase: 01-foundation-02
    provides: "Better Auth server config (auth.ts) with getSession API, admin plugin with role field"
provides:
  - "Edge-safe middleware at project root: cookie existence check redirecting unauthenticated users to /auth/login"
  - "Tenant layout with full server-side session validation via auth.api.getSession()"
  - "Admin layout with session + role === 'admin' enforcement, non-admin redirect to /tenant/dashboard"
  - "Placeholder dashboard pages at /tenant/dashboard and /admin/dashboard"
  - "Authenticated user redirect from /auth/login and /auth/register to /tenant/dashboard"
affects: [01-04, 01-05, 01-06]

# Tech tracking
tech-stack:
  added: []
  patterns: [edge-safe-cookie-check-middleware, server-side-session-validation-in-layouts, route-group-with-nested-url-segment]

key-files:
  created: [middleware.ts, src/app/(tenant)/layout.tsx, src/app/(tenant)/tenant/dashboard/page.tsx, src/app/(admin)/layout.tsx, src/app/(admin)/admin/dashboard/page.tsx]
  modified: []

key-decisions:
  - "Route groups (tenant)/(admin) require nested tenant/admin folders for distinct URL paths -- Next.js route groups are purely organizational and don't add URL segments"
  - "Middleware uses getSessionCookie() (Edge-safe cookie existence) not auth.api.getSession() (would fail on Edge runtime)"
  - "Authenticated users on /auth/login or /auth/register redirect to /tenant/dashboard (cannot check role in Edge middleware)"

patterns-established:
  - "Edge middleware for fast cookie-existence redirect; full session validation deferred to Server Component layouts"
  - "Route groups (parenthesized) for layout isolation, with real URL segments nested inside for distinct paths"
  - "Admin layout pattern: validate session first, then check role, redirect non-admins to tenant dashboard"

requirements-completed: [AUTH-02, AUTH-05]

# Metrics
duration: 3min
completed: 2026-02-25
---

# Phase 1 Plan 03: Route Protection Summary

**Edge-safe middleware with cookie-existence redirect plus server-side session/role validation in tenant and admin route group layouts**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-25T21:00:26Z
- **Completed:** 2026-02-25T21:03:31Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Created Edge-safe middleware at project root that redirects unauthenticated users from /tenant/* and /admin/* to /auth/login, and redirects authenticated users from auth pages to /tenant/dashboard
- Implemented full server-side session validation in tenant layout using auth.api.getSession() (Node.js runtime)
- Implemented session + role enforcement in admin layout, redirecting non-admin users to /tenant/dashboard
- Created placeholder dashboard pages for both route groups confirming routing works end-to-end

## Task Commits

Each task was committed atomically:

1. **Task 1: Create middleware for Edge-safe route protection** - `598415e` (feat)
2. **Task 2: Create route group layouts with full server-side session validation** - `96729a4` (feat)

## Files Created/Modified
- `middleware.ts` - Edge-safe cookie existence check; redirects unauthenticated users to /auth/login; redirects authenticated users away from auth pages
- `src/app/(tenant)/layout.tsx` - Full server-side session validation for tenant routes; displays user email in header
- `src/app/(tenant)/tenant/dashboard/page.tsx` - Placeholder tenant dashboard page at /tenant/dashboard
- `src/app/(admin)/layout.tsx` - Full server-side session + role === "admin" validation; redirects non-admins to /tenant/dashboard
- `src/app/(admin)/admin/dashboard/page.tsx` - Placeholder admin dashboard page at /admin/dashboard

## Decisions Made
- **Route group structure:** The plan specified `(tenant)/dashboard/page.tsx` and `(admin)/dashboard/page.tsx`, but Next.js route groups are purely organizational -- parenthesized folders don't add to the URL path. Both would resolve to `/dashboard`, causing a conflict. Fixed by nesting `tenant/dashboard/` inside `(tenant)/` and `admin/dashboard/` inside `(admin)/`, producing distinct URL paths `/tenant/dashboard` and `/admin/dashboard`.
- **Edge middleware limitation:** Middleware uses `getSessionCookie()` (cookie existence only) and cannot check user roles. Authenticated users on /auth/login redirect to /tenant/dashboard by default; admin-specific routing is handled in the admin layout.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Route group path collision between (tenant)/dashboard and (admin)/dashboard**
- **Found during:** Task 2 (Build verification)
- **Issue:** The plan specified dashboard pages at `src/app/(tenant)/dashboard/page.tsx` and `src/app/(admin)/dashboard/page.tsx`. Next.js route groups (parenthesized folders) don't add URL segments, so both resolved to `/dashboard`, causing a build error: "You cannot have two parallel pages that resolve to the same path."
- **Fix:** Restructured to `src/app/(tenant)/tenant/dashboard/page.tsx` and `src/app/(admin)/admin/dashboard/page.tsx`, adding real URL segment folders (`tenant/` and `admin/`) inside each route group. This produces `/tenant/dashboard` and `/admin/dashboard` as distinct routes while preserving route-group layout isolation.
- **Files modified:** Moved page.tsx files into nested tenant/ and admin/ subdirectories
- **Verification:** `npm run build` passes; routes show as `/tenant/dashboard` (dynamic) and `/admin/dashboard` (dynamic)
- **Committed in:** 96729a4 (Task 2)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Route group structure needed adjustment due to Next.js routing rules. The fix preserves the intended URL paths and layout isolation. No scope creep.

## Issues Encountered
- BETTER_AUTH_SECRET warning during build ("You are using the default secret") is expected when env var is not set. It does not prevent compilation or page generation. Both dashboard routes render as dynamic (server-rendered on demand) as expected since they use `headers()`.

## User Setup Required
None - no external service configuration required for this plan. (DATABASE_URL, BETTER_AUTH_SECRET, and RESEND_API_KEY were already documented as required in Plan 02 SUMMARY.)

## Next Phase Readiness
- All protected routes are now guarded: middleware handles fast cookie redirect, layouts handle full session validation
- Admin layout enforces role === "admin" server-side
- Route structure ready for Plan 04 (Auth UI pages at /auth/login, /auth/register, /auth/reset-password)
- Route structure ready for Plan 05 (admin seeding) and Plan 06 (password reset)

## Self-Check: PASSED

All 5 created files verified present. Both task commits (598415e, 96729a4) confirmed in git history.

---
*Phase: 01-foundation*
*Completed: 2026-02-25*
