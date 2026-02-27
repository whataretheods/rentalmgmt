---
phase: 07-infrastructure-prerequisites
plan: 02
subsystem: database
tags: [drizzle, schema, cascade, restrict, soft-delete, s3, migration]

requires:
  - phase: 07-infrastructure-prerequisites/01
    provides: WebSocket Pool driver with transaction support
provides:
  - "RESTRICT foreign keys preventing accidental destruction of financial/maintenance history"
  - "archivedAt columns on properties and units for soft-delete"
  - "storageBackend and s3Key columns on maintenancePhotos and documents for S3 dual-read"
affects: [07-infrastructure-prerequisites/03, 08-financial-ledger, 10-portfolio-management]

tech-stack:
  added: []
  patterns: [RESTRICT foreign keys for data safety, soft-delete via archivedAt, dual-read storage columns]

key-files:
  created:
    - e2e/infra-cascade.spec.ts
  modified:
    - src/db/schema/domain.ts

key-decisions:
  - "Used db:push instead of drizzle-kit migrate because prior phases used push and migration journal was out of sync"
  - "Kept CASCADE on maintenancePhotos and maintenanceComments (true parent-child with no financial data)"

patterns-established:
  - "Soft-delete pattern: archivedAt timestamp (null = active, non-null = archived)"
  - "Storage dual-read: storageBackend column determines local vs S3, s3Key stores S3 object key"

requirements-completed: [INFRA-05, INFRA-01]

duration: 4min
completed: 2026-02-26
---

# Phase 7 Plan 02: Cascade Safety + Schema Columns Summary

**Six CASCADE foreign keys changed to RESTRICT protecting financial/maintenance history, with archivedAt soft-delete and S3 storage columns added**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-26
- **Completed:** 2026-02-26
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Changed 6 dangerous CASCADE foreign keys to RESTRICT (units/properties refs)
- Preserved 2 safe CASCADE relationships (maintenancePhotos, maintenanceComments)
- Added archivedAt column to properties and units for soft-delete
- Added storageBackend and s3Key columns to maintenancePhotos and documents
- Schema pushed to database successfully, all existing data preserved

## Task Commits

Each task was committed atomically:

1. **Task 1: Update schema with RESTRICT + archivedAt + storage columns** - `6bdfd8f` (feat)
2. **Task 2: Verify with E2E tests** - `12369e0` (test)

## Files Created/Modified
- `src/db/schema/domain.ts` - Updated 6 FKs to RESTRICT, added archivedAt, storageBackend, s3Key columns
- `e2e/infra-cascade.spec.ts` - E2E tests verifying schema changes work with existing data

## Decisions Made
- Used db:push instead of drizzle-kit migrate (migration journal was out of sync from prior phases using push)
- Kept CASCADE on maintenancePhotos and maintenanceComments (true parent-child relationships)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Migration journal out of sync**
- **Found during:** Task 2 (generate and apply migration)
- **Issue:** drizzle-kit generate created CREATE TABLE statements for tables already in DB (from prior db:push usage)
- **Fix:** Used db:push instead of drizzle-kit migrate to apply changes directly
- **Files modified:** removed generated 0005_sharp_lyja.sql
- **Verification:** db:push applied all changes, E2E tests pass
- **Committed in:** 6bdfd8f (part of Task 1 workflow)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary workaround for migration tool state. No scope impact.

## Issues Encountered
None beyond the migration deviation documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- RESTRICT constraints active — deleting property/unit with children now fails safely
- storageBackend and s3Key columns ready for Plan 03 (S3 storage implementation)
- archivedAt columns ready for Phase 10 (portfolio management soft-delete)

---
*Phase: 07-infrastructure-prerequisites*
*Completed: 2026-02-26*

## Self-Check: PASSED
