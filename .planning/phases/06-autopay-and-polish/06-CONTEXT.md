# Phase 6: Autopay and Polish - Context

**Gathered:** 2026-02-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Tenants can enroll in automatic recurring rent payments so they don't have to remember to pay each month. Includes enrollment, pre-charge notification, cancellation, and re-enrollment. Additionally, a polish pass across all pages: mobile responsiveness, dashboard consolidation, loading states, and error handling.

</domain>

<decisions>
## Implementation Decisions

### Enrollment Flow
- Dedicated /tenant/autopay setup page (separate from one-time payment flow)
- ACH + card both supported — push processing fees onto tenants
- Stripe SetupIntent to save payment method, then manual PaymentIntent charges via cron (not Stripe Subscriptions)
- Dashboard shows prominent "Autopay Active" badge + details card: last 4 digits of method, next charge date, amount, link to manage/cancel

### Pre-charge Notifications
- Notify tenant 3 days before the charge
- All channels: email + SMS (if opted in) + in-app — uses Phase 5 sendNotification helper
- Auto-skip if already paid: cron checks for existing payment in current period before charging
- On failure: notify tenant, retry once after 2 days. If still fails, mark as failed and notify admin. Tenant can pay manually.

### Cancellation Experience
- Immediate cancellation (no end-of-period delay). In-flight charges still complete.
- Simple confirm dialog: "Are you sure? You'll need to pay rent manually each month."
- Re-enrollment uses saved payment method (one-click re-enable, no re-entering details)
- Admin notified of enrollment/cancellation changes via in-app notification only (not email/SMS)

### Polish Scope
- Mobile responsiveness: Playwright E2E tests at 375px viewport for all tenant-facing pages
- Dashboard consolidation: payment-first layout. Top: payment status + autopay card. Middle: recent maintenance + document requests. Bottom: recent notifications.
- Loading states and error handling: skeleton loaders, empty states, error boundaries, toast feedback across all pages
- Polish both tenant-facing AND admin pages

### Claude's Discretion
- Exact SetupIntent flow UI details (form layout, Stripe Elements styling)
- Skeleton loader designs and animation
- Error boundary fallback content
- Which specific admin pages need the most polish attention

</decisions>

<specifics>
## Specific Ideas

- Processing fees should be visible to the tenant before they confirm enrollment (transparency)
- The autopay cron should integrate with the existing rent-reminder cron from Phase 5 — avoid duplicate notifications when autopay is active
- Dashboard should feel like a single "home base" for the tenant, not a navigation hub

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-autopay-and-polish*
*Context gathered: 2026-02-26*
