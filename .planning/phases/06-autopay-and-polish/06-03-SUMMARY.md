---
phase: 06-autopay-and-polish
plan: 03
subsystem: payments
tags: [stripe, cron, autopay, paymentintent, off-session, webhook]

# Dependency graph
requires:
  - phase: 06-01
    provides: autopayEnrollments table, Stripe client packages
  - phase: 06-02
    provides: autopay-fees.ts fee calculation utilities
  - phase: 05-01
    provides: notifications system with multi-channel dispatch
provides:
  - Pre-charge notification cron (3 days before due)
  - Autopay charge cron with off-session PaymentIntents
  - Skip-if-paid and retry-on-failure logic
  - Stripe webhook handling for autopay PaymentIntent events
  - Styled pre-charge email template
affects: [06-04, admin-dashboard, tenant-autopay]

# Tech tracking
tech-stack:
  added: []
  patterns: [off-session-paymentintent, cron-idempotency-keys, two-strike-retry]

key-files:
  created:
    - src/app/api/cron/autopay-notify/route.ts
    - src/app/api/cron/autopay-charge/route.ts
    - src/emails/AutopayChargeEmail.tsx
  modified:
    - src/app/api/webhooks/stripe/route.ts

key-decisions:
  - "Retry logic uses dueDay+2 check in daily cron rather than separate retry scheduler"
  - "Two-strike policy: first failure notifies tenant, second marks enrollment payment_failed and alerts admin"
  - "Idempotency keys scoped per tenant per billing period (with separate retry key)"

patterns-established:
  - "Off-session PaymentIntent with autopay metadata for cron charges"
  - "Webhook distinguishes autopay vs checkout via metadata.autopay flag"

requirements-completed: [PAY-06]

# Metrics
duration: 3min
completed: 2026-02-26
---

# Phase 6 Plan 3: Autopay Cron Jobs Summary

**Off-session Stripe PaymentIntent cron with 3-day pre-charge notifications, skip-if-paid logic, two-strike retry, and webhook integration**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-26T19:49:06Z
- **Completed:** 2026-02-26T19:52:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Pre-charge notification cron sends alerts 3 days before autopay via in-app, email, and SMS
- Charge cron creates off-session PaymentIntents with card/ACH fee passthrough
- Auto-skips tenants who already paid for current billing period
- Failed charges retry once after 2 days; second failure pauses enrollment and alerts admin
- Stripe webhook handles payment_intent.succeeded and payment_intent.payment_failed for async autopay results

## Task Commits

Each task was committed atomically:

1. **Task 1: Create autopay cron jobs (notify + charge)** - `4eac966` (feat)
2. **Task 2: Update Stripe webhook for autopay PaymentIntent events** - `0b254d1` (feat)

## Files Created/Modified
- `src/emails/AutopayChargeEmail.tsx` - Styled pre-charge notification email with fee breakdown
- `src/app/api/cron/autopay-notify/route.ts` - Daily cron sending 3-day pre-charge alerts
- `src/app/api/cron/autopay-charge/route.ts` - Daily cron creating off-session PaymentIntents with retry logic
- `src/app/api/webhooks/stripe/route.ts` - Added payment_intent.succeeded and payment_intent.payment_failed cases

## Decisions Made
- Retry logic uses dueDay+2 check in daily cron rather than a separate retry scheduler -- simpler and sufficient for single-retry policy
- Two-strike policy: first failure sends tenant notification, second failure marks enrollment as payment_failed and notifies admin
- Idempotency keys scoped per tenant per billing period with separate key for retries to prevent duplicate charges
- Webhook checks metadata.autopay="true" to distinguish autopay PaymentIntents from future one-time PaymentIntents

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed isRetryDay scope and null type safety**
- **Found during:** Task 1 (autopay-charge cron)
- **Issue:** isRetryDay declared inside try block was inaccessible in catch block; rentAmountCents nullable type passed to non-nullable parameter
- **Fix:** Hoisted isRetryDay declaration before try block; added null coalescing for rentAmountCents in catch handler
- **Files modified:** src/app/api/cron/autopay-charge/route.ts
- **Verification:** tsc --noEmit passes clean for all plan files
- **Committed in:** 4eac966 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential TypeScript correctness fix. No scope creep.

## Issues Encountered
- Pre-existing tsc error in src/app/(tenant)/tenant/autopay/page.tsx (missing AutopayReEnrollButton module from Plan 02) -- out of scope, does not affect plan 03 files

## User Setup Required
None - no external service configuration required. CRON_SECRET env var already configured from Phase 5.

## Next Phase Readiness
- Autopay cron infrastructure complete
- Ready for Plan 04 (autopay settings UI / enrollment management)
- Webhook fully handles both checkout.session and payment_intent event families

---
*Phase: 06-autopay-and-polish*
*Completed: 2026-02-26*
