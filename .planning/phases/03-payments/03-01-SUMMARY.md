---
phase: 03-payments
plan: 01
subsystem: database, payments
tags: [stripe, react-pdf, drizzle, neon, payments-schema]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: domain schema (properties, units, tenantUnits), lazy Proxy pattern (db, resend)
provides:
  - payments table in database with all columns and correct types
  - Stripe client (src/lib/stripe.ts) with lazy Proxy pattern
  - stripe and @react-pdf/renderer packages installed
affects: [03-02, 03-03, 03-04, 03-05, 03-06]

# Tech tracking
tech-stack:
  added: [stripe@^20.4.0, "@react-pdf/renderer@^4.3.2"]
  patterns: [lazy-proxy-stripe-client]

key-files:
  created:
    - src/lib/stripe.ts
    - drizzle/0002_warm_vampiro.sql
  modified:
    - src/db/schema/domain.ts
    - .env.example
    - package.json

key-decisions:
  - "Stripe client uses same lazy Proxy pattern as db and resend clients for build-time safety"
  - "tenantUserId in payments table uses text() matching Better Auth user.id type"
  - "stripeSessionId has unique constraint for idempotent webhook processing"

patterns-established:
  - "Lazy Proxy pattern for external service clients: stripe follows db and resend"

requirements-completed: [PAY-01, PAY-02, PAY-05]

# Metrics
duration: 2min
completed: 2026-02-26
---

# Phase 3 Plan 01: Payments Schema & Stripe Setup Summary

**Payments table with 13 columns in Neon, lazy-init Stripe client via Proxy, plus stripe and @react-pdf/renderer installed**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-26T16:33:37Z
- **Completed:** 2026-02-26T16:35:46Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Payments table defined in domain schema with all required columns: id, tenantUserId (text), unitId (uuid FK), amountCents, stripeSessionId (unique), stripePaymentIntentId, paymentMethod (enum), status (enum), billingPeriod, note, paidAt, createdAt, updatedAt
- Stripe client created at src/lib/stripe.ts using project's established lazy Proxy pattern
- stripe and @react-pdf/renderer packages installed
- Database migration generated and applied to Neon -- payments table live
- .env.example updated with STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Stripe and PDF packages, add payments schema** - `3722438` (feat)
2. **Task 2: Create Stripe client and run database migration** - `4205424` (feat)

## Files Created/Modified
- `src/db/schema/domain.ts` - Added payments table with 13 columns after inviteTokens
- `src/lib/stripe.ts` - Lazy-initialized Stripe client using Proxy pattern
- `drizzle/0002_warm_vampiro.sql` - Migration adding payments table to database
- `.env.example` - Added STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
- `package.json` - Added stripe@^20.4.0 and @react-pdf/renderer@^4.3.2

## Decisions Made
- Stripe client follows exact same lazy Proxy pattern as db (src/db/index.ts) and resend (src/lib/resend.ts) -- consistent approach for all external service clients
- tenantUserId uses text() not uuid() matching Better Auth user.id type and existing tenantUnits.userId convention
- stripeSessionId has .unique() constraint to prevent duplicate payment records from Stripe webhook retries

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - Stripe env vars already present in .env.local.

## Next Phase Readiness
- Payments table and Stripe client ready for Plans 02-06
- All subsequent plans can import `stripe` from `@/lib/stripe` and query the `payments` table
- @react-pdf/renderer available for receipt generation (Plan 05)

---
*Phase: 03-payments*
*Completed: 2026-02-26*
