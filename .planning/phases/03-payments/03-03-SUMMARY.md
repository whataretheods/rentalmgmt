---
phase: 03-payments
plan: 03
subsystem: payments, api, webhooks
tags: [stripe, checkout-sessions, webhooks, ach, payments, resend, email]

# Dependency graph
requires:
  - phase: 03-payments
    plan: 01
    provides: payments table schema, Stripe client (src/lib/stripe.ts), stripe package
provides:
  - POST /api/payments/create-checkout endpoint for Stripe Checkout Sessions
  - POST /api/webhooks/stripe handler for 3 event types
  - Payment confirmation email via Resend
  - /tenant/payments/success page for post-checkout redirect
affects: [03-04, 03-05, 03-06]

# Tech tracking
tech-stack:
  added: []
  patterns: [webhook-first-payment-confirmation, idempotent-webhook-processing, fire-and-forget-email]

key-files:
  created:
    - src/app/api/payments/create-checkout/route.ts
    - src/app/api/webhooks/stripe/route.ts
    - src/app/(tenant)/tenant/payments/success/page.tsx
  modified: []

key-decisions:
  - "Used Drizzle user schema instead of raw SQL for type safety in webhook email helper"
  - "Webhook returns 200 even on handler errors to prevent Stripe infinite retries"
  - "Email sent fire-and-forget (void) to not block webhook response"

patterns-established:
  - "Webhook-first: payments only recorded after Stripe webhook confirmation, never from redirect"
  - "Idempotent webhook: onConflictDoNothing + stripeSessionId unique prevents duplicates"
  - "ACH dual-event: checkout.session.completed (pending) then async_payment_succeeded (confirmed)"

requirements-completed: [PAY-01, NOTIF-02]

# Metrics
duration: 4min
completed: 2026-02-26
---

# Phase 3 Plan 03: Stripe Checkout Flow Summary

**Stripe Checkout Session API with card + ACH, webhook handler for 3 event types with idempotent processing, payment confirmation email, and success page**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-26T16:39:03Z
- **Completed:** 2026-02-26T16:43:22Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- POST /api/payments/create-checkout validates auth, verifies tenant-unit link, creates Stripe Checkout Session with card + ACH payment methods, includes metadata for webhook processing
- POST /api/webhooks/stripe verifies signature, handles checkout.session.completed (card=succeeded, ACH=pending), async_payment_succeeded (ACH settled), async_payment_failed (ACH failed) with idempotent insert
- Payment confirmation email sent via Resend after successful card payment and ACH settlement
- Success page at /tenant/payments/success shows confirmation with ACH processing time note

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Stripe Checkout Session API endpoint** - `b26eec5` (feat)
2. **Task 2: Create Stripe webhook handler and payment success page** - `8670ab1` (feat)

## Files Created/Modified
- `src/app/api/payments/create-checkout/route.ts` - POST endpoint creating Stripe Checkout Session with card + ACH, Zod validation, tenant-unit link verification
- `src/app/api/webhooks/stripe/route.ts` - Webhook handler: signature verification, 3 event types, idempotent DB insert/update, confirmation email
- `src/app/(tenant)/tenant/payments/success/page.tsx` - Post-checkout success page with ACH processing note and navigation links

## Decisions Made
- Used Drizzle `user` schema from `@/db/schema` instead of raw SQL `db.execute()` for the email lookup in the webhook handler -- provides type safety and eliminates SQL injection risk from string interpolation
- Webhook handler returns 200 even on internal handler errors (logged) to prevent Stripe from retrying failed events infinitely
- Email confirmation is fire-and-forget (`void resend.emails.send(...)`) to ensure webhook response is never delayed by email delivery

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Replaced raw SQL with Drizzle schema query for user email lookup**
- **Found during:** Task 2 (Webhook handler)
- **Issue:** Plan used `db.execute()` with string interpolation for user email query, which is a SQL injection risk
- **Fix:** Imported `user` from `@/db/schema` and used Drizzle's type-safe `db.select().from(user).where(eq(user.id, tenantUserId))`
- **Files modified:** src/app/api/webhooks/stripe/route.ts
- **Verification:** npm run build passes
- **Committed in:** 8670ab1 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Security improvement using existing schema. No scope creep.

## Issues Encountered
None

## User Setup Required
Stripe environment variables must be set in .env.local (documented in Plan 01):
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
- NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY

## Next Phase Readiness
- Checkout and webhook flow ready for tenant UI integration (Plans 04-05)
- Admin payment dashboard can query payments table (Plan 04)
- Receipt PDF generation can reference payment records (Plan 05)

## Self-Check: PASSED

All files exist. All commits verified.

---
*Phase: 03-payments*
*Completed: 2026-02-26*
