---
phase: 10-portfolio-management-tenant-lifecycle
plan: 01
subsystem: api
tags: [drizzle, postgres, properties, soft-delete, crud]

requires:
  - phase: 08-financial-ledger-foundation
    provides: Database transaction support and schema patterns
provides:
  - Property CRUD API routes (GET, POST, PUT, DELETE)
  - Soft-delete pattern via archivedAt column on properties
  - Active-tenant guard preventing property archival with occupied units
affects: [10-03, 10-06, 11-admin-ux]

tech-stack:
  added: []
  patterns: [soft-delete via archivedAt, active-tenant guard on archive]

key-files:
  created:
    - src/app/api/admin/properties/route.ts
    - src/app/api/admin/properties/[id]/route.ts
  modified: []

key-decisions:
  - "archivedAt column already existed in schema from Phase 7 -- no migration needed"
  - "LEFT JOIN with unit count for properties list (shows 0 for empty properties)"
  - "409 Conflict response when archiving property with active tenants"

patterns-established:
  - "Soft-delete with isNull(archivedAt) WHERE filter on all list queries"
  - "Active-tenant guard before archival: check tenantUnits.isActive via joined units"

requirements-completed: [PORT-01]

duration: 4min
completed: 2026-02-27
---

# Plan 10-01: Property CRUD API Summary

**Property list, create, edit, and soft-archive API routes with active-tenant guard**

## Performance

- **Duration:** 4 min
- **Tasks:** 2
- **Files created:** 2

## Accomplishments
- GET /api/admin/properties returns active properties with unit counts
- POST /api/admin/properties creates properties with name/address validation
- PUT /api/admin/properties/[id] updates property details
- DELETE /api/admin/properties/[id] soft-archives with active-tenant guard

## Task Commits

1. **Plan 10-01** - `56761ce` (feat: add property CRUD API routes with soft-delete)

## Files Created/Modified
- `src/app/api/admin/properties/route.ts` - GET (list) and POST (create) endpoints
- `src/app/api/admin/properties/[id]/route.ts` - PUT (edit) and DELETE (soft-archive) endpoints

## Decisions Made
- Schema already had archivedAt from Phase 7 -- skipped migration
- Used LEFT JOIN with COUNT for unit totals in property list
- 409 response for archive attempts on properties with active tenants

## Deviations from Plan
None - plan executed as specified (archivedAt column already existed).

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Property API routes ready for admin UI in Plan 10-03
- Soft-delete pattern established for use across admin views

---
*Phase: 10-portfolio-management-tenant-lifecycle*
*Completed: 2026-02-27*
