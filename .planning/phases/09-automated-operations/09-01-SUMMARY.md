---
phase: 09-automated-operations
plan: 01
subsystem: database, infra
tags: [timezone, late-fees, intl, drizzle, schema]

requires:
  - phase: 08-financial-ledger
    provides: charges table with late_fee type
provides:
  - lateFeeRules table schema
  - timezone column on properties table
  - Timezone-aware date utility functions (getLocalDate, getLocalBillingPeriod, daysSinceRentDue)
  - Late fee calculation pure functions (calculateLateFee, formatCentsAsDollars)
  - US_TIMEZONES dropdown options
affects: [09-automated-operations, cron-jobs, admin-property-settings]

tech-stack:
  added: []
  patterns: [Intl.DateTimeFormat for timezone conversion, basis-points for percentage fee storage]

key-files:
  created:
    - src/lib/timezone.ts
    - src/lib/late-fees.ts
    - src/app/api/test/timezone/route.ts
    - e2e/timezone-utils.spec.ts
  modified:
    - src/db/schema/domain.ts

key-decisions:
  - "Used Intl.DateTimeFormat.formatToParts() for timezone conversion — zero external dependencies"
  - "Percentage fees stored as basis points (500 = 5%) in feeAmountCents for integer-only math"
  - "lateFeeRules.enabled defaults to false — late fees are OFF until admin explicitly enables"

patterns-established:
  - "Property-local timezone: always use getLocalDate(property.timezone) instead of new Date()"
  - "Basis points storage: percentage values stored as integer basis points (500 = 5%)"

requirements-completed: [INFRA-03, LATE-01]

duration: 4min
completed: 2026-02-27
---

# Phase 9 Plan 01: Timezone & Late Fee Schema + Utility Foundations Summary

**Properties table extended with IANA timezone column, lateFeeRules table for per-property config, and pure utility functions for timezone-aware date math and late fee calculation using Intl.DateTimeFormat**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-27
- **Completed:** 2026-02-27
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- Properties table has timezone column (default "America/New_York")
- lateFeeRules table with per-property config (enabled defaults OFF)
- Timezone utilities using built-in Intl.DateTimeFormat (zero deps)
- Late fee calculation handles flat, percentage, and capped percentage
- 8 Playwright tests all passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Add timezone column and lateFeeRules table** - `3cbc2a3` (feat)
2. **Task 2: Create timezone and late fee utility modules** - `6c16c64` (feat)
3. **Task 3: Create timezone and late fee utility tests** - `de747d1` (test)

## Files Created/Modified
- `src/db/schema/domain.ts` - Added timezone column to properties, lateFeeRules table
- `src/lib/timezone.ts` - getLocalDate, getLocalBillingPeriod, daysSinceRentDue, US_TIMEZONES
- `src/lib/late-fees.ts` - calculateLateFee, formatCentsAsDollars, LateFeeRule interface
- `src/app/api/test/timezone/route.ts` - Dev-only test endpoint (404 in production)
- `e2e/timezone-utils.spec.ts` - 8 Playwright tests for all utility functions

## Decisions Made
- Used Intl.DateTimeFormat.formatToParts() for timezone conversion — no external date libraries needed
- Percentage fees stored as basis points (500 = 5%) for integer-only math
- lateFeeRules enabled defaults to false — late fees OFF until admin enables

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Schema and utilities ready for Wave 2 plans (cron endpoint, admin UI, timezone retrofit)
- All three Wave 2 plans can now import from timezone.ts and late-fees.ts

---
*Phase: 09-automated-operations*
*Completed: 2026-02-27*
