---
phase: 13-fintech-polish-edge-cases
plan: 03
subsystem: api
tags: [stripe, webhooks, nsf, chargeback, ledger, work-orders, vitest]

# Dependency graph
requires:
  - phase: 08-financial-ledger
    provides: charges table and append-only ledger pattern
  - phase: 12-vendor-work-orders
    provides: work orders, work order costs, maintenance request chain
  - phase: 13-01
    provides: vitest test infrastructure and configuration
provides:
  - resolveAndPostChargeback helper for billing tenants from work order costs
  - postNsfFee helper for posting non-sufficient funds fees on failed payments
  - billToTenant flag on work order cost POST endpoint
  - NSF fee logic in both autopay and one-time ACH payment failure handlers
affects: [admin-ui, payments, webhooks]

# Tech tracking
tech-stack:
  added: []
  patterns: [extracted testable helpers for financial operations, env-var-gated fee posting]

key-files:
  created:
    - src/lib/chargeback.ts
    - src/lib/nsf.ts
    - src/lib/__tests__/chargeback.test.ts
    - src/lib/__tests__/nsf-fee.test.ts
  modified:
    - src/app/api/admin/work-orders/[id]/costs/route.ts
    - src/app/api/webhooks/stripe/route.ts

key-decisions:
  - "Chargeback resolves tenant from maintenance request chain (not active tenancy) so charges apply even if tenant moved out"
  - "NSF fee controlled by NSF_FEE_CENTS env var (0 or unset = disabled) for per-deployment flexibility"
  - "postNsfFee accepts tx parameter to run within existing webhook transaction for atomicity"

patterns-established:
  - "Extracted financial helpers: isolate DB-mutating logic into testable functions with mocked db"
  - "Env-var-gated fees: use integer env var with 0/unset = disabled pattern for optional charges"

requirements-completed: [FIN-04, FIN-05]

# Metrics
duration: 2min
completed: 2026-02-28
---

# Phase 13 Plan 03: Chargeback & NSF Fee Summary

**Work order cost bill-to-tenant chargeback via maintenance request chain and NSF fee posting on ACH/autopay payment failures**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-28T07:34:49Z
- **Completed:** 2026-02-28T07:37:07Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Extracted resolveAndPostChargeback helper that traverses workOrder -> maintenanceRequest to resolve tenant and post one_time charge
- Extracted postNsfFee helper gated by NSF_FEE_CENTS env var, wired into both payment_intent.payment_failed and checkout.session.async_payment_failed
- Work order cost POST endpoint now accepts billToTenant flag and returns chargePosted status
- 8 new unit tests (3 chargeback + 5 NSF) all passing with mocked db

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract chargeback helper and add billToTenant to work order costs** - `e266aed` (feat)
2. **Task 2: Extract postNsfFee to src/lib/nsf.ts and wire into webhook** - `ef659b7` (feat)

## Files Created/Modified
- `src/lib/chargeback.ts` - resolveAndPostChargeback helper resolving tenant from work order chain
- `src/lib/nsf.ts` - postNsfFee helper posting NSF fee charges gated by env var
- `src/lib/__tests__/chargeback.test.ts` - Unit tests for chargeback resolution and charge posting
- `src/lib/__tests__/nsf-fee.test.ts` - Unit tests for NSF fee posting, env var control, and descriptions
- `src/app/api/admin/work-orders/[id]/costs/route.ts` - Added billToTenant flag and resolveAndPostChargeback call
- `src/app/api/webhooks/stripe/route.ts` - Added postNsfFee calls in both payment failure handlers

## Decisions Made
- Chargeback resolves tenant from maintenance request chain (not active tenancy) so charges apply even if tenant moved out
- NSF fee controlled by NSF_FEE_CENTS env var (0 or unset = disabled) for per-deployment flexibility
- postNsfFee accepts tx parameter to run within existing webhook transaction for atomicity
- Used aliased destructuring (achTenantUserId, achUnitId) in checkout.session.async_payment_failed to avoid variable shadowing with outer scope

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. NSF_FEE_CENTS env var is optional (defaults to 0/disabled).

## Next Phase Readiness
- Chargeback and NSF fee infrastructure complete
- Ready for remaining Phase 13 plans (13-04)
- Admin UI can be updated to expose billToTenant toggle on cost form

---
*Phase: 13-fintech-polish-edge-cases*
*Completed: 2026-02-28*
