---
phase: 04-maintenance-documents-and-profiles
plan: 05
subsystem: api, ui
tags: [maintenance, kanban, drag-and-drop, hello-pangea-dnd, admin, next.js]

# Dependency graph
requires:
  - phase: 04-maintenance-documents-and-profiles
    plan: 02
    provides: "PATCH /api/maintenance/[id] for status updates, maintenanceRequests/Photos/Comments tables"
provides:
  - "GET /api/admin/maintenance with filters for status, unit, date range"
  - "GET /api/admin/units for unit list (filter dropdown)"
  - "Admin kanban board with drag-and-drop status updates via @hello-pangea/dnd"
  - "Admin maintenance detail page with status controls and comment thread"
  - "/admin/maintenance and /admin/maintenance/[id] pages"
affects: [04-06]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Drag-and-drop kanban with @hello-pangea/dnd DragDropContext/Droppable/Draggable", "Optimistic status update with revert on failure", "Dynamic import with ssr:false for browser-only DnD library"]

key-files:
  created:
    - "src/app/api/admin/maintenance/route.ts"
    - "src/app/api/admin/units/route.ts"
    - "src/components/admin/MaintenanceKanban.tsx"
    - "src/components/admin/MaintenanceCard.tsx"
    - "src/components/admin/AdminMaintenanceDetail.tsx"
    - "src/app/(admin)/admin/maintenance/page.tsx"
    - "src/app/(admin)/admin/maintenance/[id]/page.tsx"
  modified: []

key-decisions:
  - "Page uses 'use client' directive because Next.js 15 disallows ssr:false in Server Components"
  - "Created GET /api/admin/units endpoint for kanban filter dropdown (was missing)"
  - "Optimistic drag-and-drop updates with automatic revert on API failure"

patterns-established:
  - "Kanban column mapping: droppableId = status enum value, draggableId = request.id"
  - "Dynamic import with ssr:false for browser-only libraries requires 'use client' page in Next.js 15"

requirements-completed: [MAINT-03]

# Metrics
duration: 3min
completed: 2026-02-26
---

# Phase 4 Plan 05: Admin Maintenance Kanban Board Summary

**Drag-and-drop kanban board with @hello-pangea/dnd for admin maintenance queue management, 4 status columns, unit/date filters, and detail view with inline status controls**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-26T17:37:28Z
- **Completed:** 2026-02-26T17:40:51Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Created admin maintenance API with GET endpoint supporting status, unit, and date range filters, joining with units and user tables for enriched data
- Built drag-and-drop kanban board with 4 status columns (Submitted, Acknowledged, In Progress, Resolved) using @hello-pangea/dnd with optimistic updates
- Built admin detail page with status dropdown, optional note textarea, photo gallery lightbox, and threaded comment input
- Created admin units API endpoint for the kanban filter dropdown

## Task Commits

Each task was committed atomically:

1. **Task 1: Create admin maintenance API route and kanban components** - `82316a7` (feat)
2. **Task 2: Create admin maintenance pages** - `0589938` (feat)

## Files Created/Modified
- `src/app/api/admin/maintenance/route.ts` - GET all requests with filters for status, unit, date range (admin only)
- `src/app/api/admin/units/route.ts` - GET all units for filter dropdown (admin only)
- `src/components/admin/MaintenanceKanban.tsx` - Drag-and-drop kanban with 4 status columns, filter bar, optimistic updates
- `src/components/admin/MaintenanceCard.tsx` - Compact card with category icon, unit badge, tenant name, photo count, relative time
- `src/components/admin/AdminMaintenanceDetail.tsx` - Detail view with status update controls, photo gallery, comment thread
- `src/app/(admin)/admin/maintenance/page.tsx` - Kanban board page with dynamic import (ssr:false)
- `src/app/(admin)/admin/maintenance/[id]/page.tsx` - Request detail page

## Decisions Made
- Page uses "use client" directive because Next.js 15 App Router disallows `ssr: false` with `next/dynamic` in Server Components
- Created a lightweight GET /api/admin/units endpoint to populate the kanban filter dropdown (no existing units API was available)
- Optimistic UI update on drag: card moves immediately, reverts on API failure with toast error

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created GET /api/admin/units endpoint**
- **Found during:** Task 1 (MaintenanceKanban filter implementation)
- **Issue:** Kanban filter dropdown needed a units list API, but no admin units endpoint existed
- **Fix:** Created `src/app/api/admin/units/route.ts` with admin-only GET returning unit id and unitNumber
- **Files modified:** src/app/api/admin/units/route.ts
- **Verification:** npm run build passes
- **Committed in:** 82316a7 (Task 1 commit)

**2. [Rule 1 - Bug] Added "use client" to maintenance page for ssr:false**
- **Found during:** Task 2 (build verification)
- **Issue:** Next.js 15 does not allow `ssr: false` with `next/dynamic` in Server Components
- **Fix:** Added "use client" directive to the admin maintenance page
- **Files modified:** src/app/(admin)/admin/maintenance/page.tsx
- **Verification:** npm run build passes
- **Committed in:** 0589938 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes necessary for functionality. No scope creep.

## Issues Encountered
- Next.js 15 requires "use client" on pages that use `next/dynamic` with `ssr: false` -- this differs from Next.js 13/14 behavior where Server Components could use dynamic imports with ssr:false

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Admin maintenance kanban board complete and ready for end-to-end verification in Plan 06
- All CRUD operations for maintenance flow complete (tenant submit, admin manage, both comment)
- Status changes from kanban drag-and-drop and detail page both route through the same PATCH endpoint

## Self-Check: PASSED

All 7 created files verified on disk. Both task commits (82316a7, 0589938) verified in git log.

---
*Phase: 04-maintenance-documents-and-profiles*
*Completed: 2026-02-26*
