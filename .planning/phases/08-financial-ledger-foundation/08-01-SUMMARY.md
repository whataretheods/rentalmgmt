---
phase: 08-financial-ledger-foundation
plan: 01
subsystem: database
tags: [drizzle, postgres, ledger, charges, stripe, balance]

# Dependency graph
requires:
  - phase: 07-infrastructure-hardening
    provides: WebSocket pool driver, restrict FK on units
provides:
  - charges table for append-only financial ledger
  - stripe_events table for webhook deduplication
  - getTenantBalance helper (SUM charges - SUM succeeded payments)
  - formatBalance display helper (owed/credit/current states)
  - e2e test scaffold for LEDG-01/02/03/05
affects: [08-02, 08-03, 08-04, 08-05, admin-charge-ui, tenant-dashboard-balance]

# Tech tracking
tech-stack:
  added: []
  patterns: [append-only ledger pattern, balance = charges - payments]

key-files:
  created:
    - src/lib/ledger.ts
    - e2e/ledger.spec.ts
    - drizzle/0006_mean_scarecrow.sql
  modified:
    - src/db/schema/domain.ts

key-decisions:
  - "Used onDelete restrict for charges.unitId to protect financial history from accidental unit deletion"
  - "charges.amountCents uses positive for debits and negative for credits/adjustments in single column"
  - "stripe_events uses text PK (Stripe event ID) not uuid to match Stripe's native ID format"
  - "Used db.execute raw SQL for balance computation to avoid ORM overhead on aggregate queries"

patterns-established:
  - "Append-only ledger: charges table is insert-only, no updates or deletes"
  - "Balance computation: SUM(charges) - SUM(succeeded payments) with COALESCE for null safety"

requirements-completed: [LEDG-01, LEDG-02]

# Metrics
duration: 3min
completed: 2026-02-27
---

# Phase 8 Plan 01: Charges Schema + Balance Helper Summary

**Charges and stripe_events tables with Drizzle schema, balance computation helper (SUM charges - SUM succeeded payments), and e2e test scaffold for ledger requirements**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-27T14:57:42Z
- **Completed:** 2026-02-27T15:00:27Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Charges table with type enum (rent, late_fee, one_time, credit, adjustment) and restrict FK on units
- Stripe events table for webhook deduplication with text PK matching Stripe event ID format
- getTenantBalance helper computing balance as SUM(charges) - SUM(succeeded payments)
- formatBalance display helper returning owed/credit/current status with formatted dollar amounts
- E2e test scaffold with 6 skipped tests covering LEDG-01, LEDG-02, LEDG-03, LEDG-05

## Task Commits

Each task was committed atomically:

1. **Task 1: Add charges and stripeEvents tables to Drizzle schema** - `17a3328` (feat)
2. **Task 2: Create balance computation helper and e2e test scaffold** - `ce7855e` (feat)

**Plan metadata:** [pending] (docs: complete plan)

## Files Created/Modified
- `src/db/schema/domain.ts` - Added charges and stripeEvents table definitions
- `drizzle/0006_mean_scarecrow.sql` - Migration SQL for charges and stripe_events tables
- `drizzle/meta/0005_snapshot.json` - Drizzle meta snapshot (previously untracked)
- `drizzle/meta/0006_snapshot.json` - Drizzle meta snapshot for new migration
- `src/lib/ledger.ts` - getTenantBalance and formatBalance helper functions
- `e2e/ledger.spec.ts` - Test scaffold with 6 skipped tests for ledger requirements

## Decisions Made
- Used `onDelete: "restrict"` for charges.unitId — consistent with existing schema pattern and protects financial history from accidental unit deletion
- Used text PK for stripe_events (not uuid) — Stripe event IDs are text strings like "evt_xxx"
- Used raw SQL via db.execute for balance computation — cleaner aggregate query than Drizzle query builder for multi-table SUMs
- Used `.rows[0]` access pattern for Neon WebSocket driver QueryResult compatibility

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed QueryResult destructuring for Neon WebSocket driver**
- **Found during:** Task 2 (balance computation helper)
- **Issue:** Plan template used array destructuring `const [result] = await db.execute(...)` which is incompatible with NeonDatabase's QueryResult type (not iterable)
- **Fix:** Changed to `const result = await db.execute(...)` then access `result.rows[0]`
- **Files modified:** src/lib/ledger.ts
- **Verification:** `npx tsc --noEmit --skipLibCheck` passes cleanly
- **Committed in:** ce7855e (Task 2 commit)

**2. [Rule 1 - Bug] Removed unused imports**
- **Found during:** Task 2 (balance computation helper)
- **Issue:** Plan template imported `charges`, `payments`, `eq`, `and` which are unused in the raw SQL approach
- **Fix:** Removed unused imports, kept only `db` and `sql`
- **Files modified:** src/lib/ledger.ts
- **Verification:** TypeScript compilation passes with no unused import warnings
- **Committed in:** ce7855e (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes necessary for type correctness with the Neon WebSocket driver. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Charges table ready for admin charge posting UI (08-02)
- Balance helper ready for tenant dashboard integration (08-03)
- Stripe events table ready for webhook deduplication (08-04/08-05)
- E2e test scaffold ready for unskipping as features ship

---
*Phase: 08-financial-ledger-foundation*
*Completed: 2026-02-27*
