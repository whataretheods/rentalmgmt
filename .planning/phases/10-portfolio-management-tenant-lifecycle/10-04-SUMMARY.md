---
phase: 10-portfolio-management-tenant-lifecycle
plan: 04
subsystem: api
tags: [drizzle, postgres, transaction, move-out, autopay, charges, lifecycle]

requires:
  - phase: 07-infrastructure-prerequisites
    provides: db.transaction() via WebSocket Pool driver
  - phase: 08-financial-ledger-foundation
    provides: charges table for final charge posting
provides:
  - Atomic move-out API endpoint (POST /api/admin/move-out)
  - MoveOutDialog component with final charge entry
  - Transaction-based lifecycle management pattern
affects: [10-05, 10-06]

tech-stack:
  added: []
  patterns: [atomic-lifecycle-transaction, notification-after-commit]

key-files:
  created:
    - src/app/api/admin/move-out/route.ts
    - src/components/admin/MoveOutDialog.tsx
  modified: []

key-decisions:
  - "db.transaction() wraps tenancy deactivation + autopay cancellation + final charges"
  - "Notifications sent AFTER transaction commit (fire-and-forget, not in transaction)"
  - "Final charges posted as one_time type in charges table with admin as createdBy"
  - "Dollar-to-cents conversion for final charges in MoveOutDialog"

patterns-established:
  - "Atomic lifecycle: all state changes in single transaction, notifications after"
  - "Final charge posting: admin-initiated charges with description and amount"

requirements-completed: [PORT-03]

duration: 4min
completed: 2026-02-27
---

# Plan 10-04: Atomic Move-Out Workflow Summary

**Transaction-based move-out endpoint that atomically ends tenancy, cancels autopay, and posts final charges**

## Performance

- **Duration:** 4 min
- **Tasks:** 2
- **Files created:** 2

## Accomplishments
- POST /api/admin/move-out uses db.transaction() for all-or-nothing execution
- Deactivates tenancy, sets end date, cancels active autopay, posts final charges
- MoveOutDialog UI with date picker and dynamic final charge entry
- Notifications sent after successful transaction commit

## Task Commits

1. **Plan 10-04** - `7cdabeb` (feat: add atomic move-out workflow with transaction)

## Files Created/Modified
- `src/app/api/admin/move-out/route.ts` - Atomic move-out endpoint with transaction
- `src/components/admin/MoveOutDialog.tsx` - Move-out dialog with final charge entry

## Decisions Made
- Transaction includes: tenantUnits update, autopayEnrollments cancellation, charges insertion
- Notifications are fire-and-forget after commit (not part of transaction)
- Final charges use one_time type in the charges table

## Deviations from Plan
None - plan executed as specified.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Move-out API ready for integration into admin units page (Plan 10-06)
- Past-tenant state (isActive=false) ready for read-only dashboard (Plan 10-05)

---
*Phase: 10-portfolio-management-tenant-lifecycle*
*Completed: 2026-02-27*
