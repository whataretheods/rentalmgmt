---
phase: 07-infrastructure-prerequisites
plan: 04
subsystem: auth, ui
tags: [middleware, role-auth, sidebar, shadcn, next-middleware, cookie]

requires:
  - phase: 06-autopay-and-polish
    provides: admin layout with flat nav bar and server-side auth checks
provides:
  - "Node.js middleware with role-based route protection at edge level"
  - "Collapsible admin sidebar with 9 nav links and cookie-based persistence"
  - "SidebarProvider/SidebarInset layout pattern for admin pages"
affects: [08-financial-ledger, 10-portfolio-management, 11-admin-ux]

tech-stack:
  added: [shadcn/ui sidebar]
  patterns: [Node.js middleware for auth, cookie-persisted sidebar state, SidebarProvider layout]

key-files:
  created:
    - src/middleware.ts
    - src/components/admin/AdminSidebar.tsx
    - src/components/ui/sidebar.tsx
    - e2e/infra-edge-auth.spec.ts
    - e2e/admin-sidebar.spec.ts
  modified:
    - src/app/(admin)/layout.tsx

key-decisions:
  - "Used Node.js runtime for middleware (stable in Next.js 15.5) to enable auth.api.getSession()"
  - "Excluded API routes from middleware matcher to avoid double auth cost"
  - "Kept server-component auth checks in layout as defense-in-depth alongside middleware"
  - "Used collapsible='icon' mode for sidebar to support icon-only rail on desktop"

patterns-established:
  - "Middleware auth pattern: full session validation for /admin, lightweight cookie check for /tenant"
  - "Admin layout pattern: SidebarProvider wraps AdminSidebar + SidebarInset containing header and content"

requirements-completed: [INFRA-02, AUX-01]

duration: 5min
completed: 2026-02-26
---

# Phase 7 Plan 04: Edge Auth + Admin Sidebar Summary

**Node.js middleware for role-based route protection and collapsible shadcn/ui admin sidebar with cookie-persisted state**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-26
- **Completed:** 2026-02-26
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Created Node.js middleware rejecting non-admin users from /admin routes before page loads
- Installed shadcn/ui sidebar component with full set of primitives
- Built AdminSidebar with all 9 admin nav links, active state highlighting, and icon-only collapse
- Refactored admin layout from flat header+nav to SidebarProvider+SidebarInset pattern
- 8 E2E tests passing: 4 for edge auth, 4 for sidebar behavior

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Node.js middleware** - `f804dea` (feat)
2. **Task 2: Install sidebar and build admin layout** - `abf92e6` (feat)

## Files Created/Modified
- `src/middleware.ts` - Node.js middleware with role-based route protection
- `src/components/admin/AdminSidebar.tsx` - Admin sidebar with 9 nav links, icons, active state
- `src/components/ui/sidebar.tsx` - shadcn/ui sidebar primitives (auto-generated)
- `src/app/(admin)/layout.tsx` - Refactored to SidebarProvider + SidebarInset pattern
- `e2e/infra-edge-auth.spec.ts` - E2E tests for middleware redirects
- `e2e/admin-sidebar.spec.ts` - E2E tests for sidebar visibility, toggle, persistence

## Decisions Made
- Used Node.js runtime for middleware (not Edge) because auth.api.getSession() needs Node.js APIs
- Excluded all API routes from middleware to avoid double auth cost
- Kept layout auth checks as defense-in-depth alongside middleware
- Used collapsible="icon" mode for sidebar to support icon-only rail

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All new admin pages built in Phases 8-12 will automatically inherit the sidebar layout
- Middleware provides edge-level protection for all future /admin routes
- Ready for Plan 02 (cascade safety + schema columns)

---
*Phase: 07-infrastructure-prerequisites*
*Completed: 2026-02-26*

## Self-Check: PASSED
