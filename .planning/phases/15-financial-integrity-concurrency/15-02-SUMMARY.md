---
phase: 15-financial-integrity-concurrency
plan: 02
subsystem: payments
tags: [stripe, webhooks, upsert, ach, drizzle, postgres, concurrency]

# Dependency graph
requires:
  - phase: 03-payments
    provides: Stripe webhook route with checkout.session handlers and payments table
provides:
  - UPSERT-based ACH webhook handlers that survive out-of-order delivery
  - buildAchPaymentUpsert pure function for testable UPSERT value construction
affects: [payments, webhooks, stripe]

# Tech tracking
tech-stack:
  added: []
  patterns: [INSERT ON CONFLICT DO UPDATE for idempotent webhook processing, pure function extraction for webhook logic testing]

key-files:
  created:
    - src/lib/webhook-upsert.ts
    - src/lib/__tests__/webhook-upsert.test.ts
  modified:
    - src/app/api/webhooks/stripe/route.ts

key-decisions:
  - "Pure function buildAchPaymentUpsert extracts UPSERT value construction for unit testing without DB/HTTP mocking"
  - "ON CONFLICT targets stripeSessionId UNIQUE constraint -- second layer of defense after stripe_events dedup"
  - "Metadata validation added to async handlers to fail fast on missing session metadata"

patterns-established:
  - "UPSERT pattern: INSERT ... ON CONFLICT DO UPDATE for webhook handlers where event ordering is not guaranteed"
  - "Pure function extraction: isolate DB value construction into testable functions separate from route handlers"

requirements-completed: [HARD-02]

# Metrics
duration: 2min
completed: 2026-02-28
---

# Phase 15 Plan 02: Webhook UPSERT Summary

**UPSERT-based ACH webhook handlers using INSERT ON CONFLICT DO UPDATE on stripeSessionId to prevent payments stuck in pending from out-of-order Stripe delivery**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-28T23:25:44Z
- **Completed:** 2026-02-28T23:27:43Z
- **Tasks:** 2 (TDD: RED + GREEN)
- **Files modified:** 3

## Accomplishments
- Replaced bare UPDATE with INSERT ... ON CONFLICT DO UPDATE for both async_payment_succeeded and async_payment_failed handlers
- Out-of-order webhook delivery (async event before checkout.session.completed) now creates the payment record instead of silently failing
- Added metadata validation guards to both async handlers (was missing -- metadata was destructured but used conditionally)
- 6 unit tests proving UPSERT value construction correctness for all delivery order combinations

## Task Commits

Each task was committed atomically:

1. **Task 1: Write tests for UPSERT behavior (RED)** - `d7544c6` (test)
2. **Task 2: Convert handlers to UPSERT (GREEN)** - `378d4bf` (feat)

## Files Created/Modified
- `src/lib/webhook-upsert.ts` - Pure function buildAchPaymentUpsert for UPSERT value construction
- `src/lib/__tests__/webhook-upsert.test.ts` - 6 unit tests covering succeeded/failed x before/after completed, idempotency, null PI
- `src/app/api/webhooks/stripe/route.ts` - Replaced UPDATE with UPSERT in async_payment_succeeded and async_payment_failed handlers

## Decisions Made
- Extracted `buildAchPaymentUpsert` as a pure function rather than testing via HTTP/DB mocks -- keeps tests fast and focused on the UPSERT value logic
- ON CONFLICT targets `stripeSessionId` (UNIQUE constraint in schema) as the conflict resolution key
- Added explicit metadata validation with `console.error` + early break to both async handlers -- previously metadata was destructured but only conditionally used

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added metadata validation to async handlers**
- **Found during:** Task 2 (webhook handler conversion)
- **Issue:** Original async handlers destructured metadata but used it conditionally without validation. If metadata was missing, the UPDATE would silently fail (no matching rows). With UPSERT, missing metadata would cause a DB NOT NULL constraint violation.
- **Fix:** Added explicit `if (!tenantUserId || !unitId || !billingPeriod)` guards with console.error logging and early break, matching the pattern already used in checkout.session.completed handler.
- **Files modified:** src/app/api/webhooks/stripe/route.ts
- **Verification:** Code review confirms guards match existing pattern in completed handler.
- **Committed in:** 378d4bf (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Essential for correctness -- UPSERT with null required fields would crash instead of gracefully skipping. No scope creep.

## Issues Encountered
- Pre-existing TypeScript error in `postNsfFee` call (Drizzle transaction type mismatch) -- confirmed pre-existing, not caused by this plan's changes. Out of scope.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Both ACH async webhook handlers now use UPSERT pattern
- Payments will no longer get permanently stuck in "pending" status due to out-of-order Stripe webhook delivery
- Stripe event deduplication (stripe_events table) provides first layer of idempotency, UPSERT provides second layer

## Self-Check: PASSED

- All 3 source files exist
- All 2 task commits verified (d7544c6, 378d4bf)
- Summary file created

---
*Phase: 15-financial-integrity-concurrency*
*Completed: 2026-02-28*
