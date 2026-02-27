---
phase: 08-financial-ledger-foundation
plan: 03
subsystem: ui
tags: [react, tailwind, drizzle, balance, dashboard]

requires:
  - phase: 08-financial-ledger-foundation
    provides: charges schema and getTenantBalance/formatBalance helpers from Plan 01
provides:
  - BalanceCard component showing tenant running balance (owed/current/credit)
  - Admin payments-overview API with balanceCents field per unit
  - Admin PaymentDashboard with Balance column
affects: [09-late-fees, 10-reporting]

tech-stack:
  added: [lucide-react icons for balance states]
  patterns: [server-side balance computation passed as props to presentational components]

key-files:
  created:
    - src/components/tenant/BalanceCard.tsx
  modified:
    - src/app/(tenant)/tenant/dashboard/page.tsx
    - src/app/api/admin/payments-overview/route.ts
    - src/components/admin/PaymentDashboard.tsx

key-decisions:
  - "BalanceCard is a server component (no 'use client') receiving computed balance as props from parent"
  - "Used amber/soft tone for owed state instead of harsh red for better UX"
  - "Admin balance uses batch queries (charge totals + payment totals maps) to avoid N+1"

patterns-established:
  - "Balance display consistency: red/amber=owed, green=current, blue=credit across tenant and admin views"

requirements-completed: [LEDG-02]

duration: 5min
completed: 2026-02-27
---

# Phase 8 Plan 3: Balance Display Summary

**BalanceCard on tenant dashboard and per-tenant balance column in admin payments view using charges-minus-payments computation**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-27T15:02:52Z
- **Completed:** 2026-02-27T15:08:29Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Tenant dashboard displays running balance as first visual element with color-coded states (owed/current/credit)
- Admin payments-overview API returns balanceCents for each unit computed from charges and succeeded payments
- Admin PaymentDashboard table shows Balance column with consistent color coding

## Task Commits

Each task was committed atomically:

1. **Task 1: Create BalanceCard and integrate into tenant dashboard** - `b2cf603` (feat)
2. **Task 2: Add per-tenant balance to admin payment dashboard** - `e1bbbe3` (feat)

## Files Created/Modified
- `src/components/tenant/BalanceCard.tsx` - Presentational component displaying balance with icons and color-coded states
- `src/app/(tenant)/tenant/dashboard/page.tsx` - Added getTenantBalance call, pending payment check, and BalanceCard rendering
- `src/app/api/admin/payments-overview/route.ts` - Added charge totals and all-time payment totals queries, balanceCents in response
- `src/components/admin/PaymentDashboard.tsx` - Added Balance column with color-coded display (owed/current/credit)

## Decisions Made
- BalanceCard is a server component (no "use client") that receives balance data as props from the parent server component, keeping rendering simple and avoiding client-side fetch
- Used amber tones for "owed" state instead of harsh red for a softer UX that doesn't alarm tenants
- Admin balance computation uses two batch queries (charge totals map + payment totals map) to avoid N+1 query patterns, consistent with existing periodPayments batch approach

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Flaky Next.js build prerender errors when using stale `.next` cache (different pages fail each run). Resolved by cleaning `.next` directory. Pre-existing issue, not caused by plan changes. TypeScript type-checking (`tsc --noEmit`) passed cleanly throughout.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Balance display is live on both tenant and admin views
- Balance computation is consistent: SUM(charges) - SUM(succeeded payments)
- Ready for Plan 04 (backfill migration) and Plan 05 (Stripe webhook hardening)
- Late fee automation (Phase 9) can build on the charges schema and balance helpers

## Self-Check: PASSED

All 5 files verified present. Both task commits (b2cf603, e1bbbe3) verified in git log.

---
*Phase: 08-financial-ledger-foundation*
*Completed: 2026-02-27*
