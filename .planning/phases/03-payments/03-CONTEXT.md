# Phase 3: Payments - Context

**Gathered:** 2026-02-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Stripe rent collection for tenants and admin payment visibility. Tenants can pay rent online via Stripe (ACH or card), view payment history, and download receipts. Admin can set per-unit rent amounts/due dates, view who has paid/unpaid for the current period, and record manual offline payments. Email confirmations sent on successful payment.

Requirements: PAY-01, PAY-02, PAY-03, PAY-04, PAY-05, NOTIF-02

</domain>

<decisions>
## Implementation Decisions

### Payment Flow
- Stripe Checkout Session (redirect-based) — not embedded Payment Element
- ACH bank transfer + credit/debit card payment methods
- Webhook-first confirmation — never trust the redirect as payment proof. Mark paid only after webhook event.
- Rent amount is pre-filled from admin-set amount but tenant can adjust (partial payment or overpayment allowed)

### Admin Dashboard Layout
- Table with color-coded status badges (Paid/Unpaid/Partial/Pending)
- Columns: unit, tenant name, amount due, amount paid, status badge, last payment date
- Default view: current calendar month. Option to navigate to past months.
- Admin can record manual/offline payments (cash, check, Venmo) with a note
- Rent amounts and due dates edited inline on the units/properties page — no separate settings page

### Tenant Payment Experience
- Prominent "Pay Rent" button on tenant dashboard — one click to start Stripe Checkout
- Dashboard at-a-glance: current balance owed, next due date, most recent payment summary
- After Stripe Checkout: redirect to success confirmation page + email receipt
- ACH pending status: show "Payment processing" badge until ACH clears (3-5 business days)

### Receipts and History
- Both on-screen detail view AND downloadable PDF receipt for each payment
- Payment history: simple chronological list, most recent first
- History columns: date, amount, payment method (ACH/card), status (paid/pending/failed)
- Email confirmation includes: amount, unit number, date, payment method — clean and concise

### Claude's Discretion
- PDF receipt layout and styling
- Exact Stripe Checkout session configuration
- Webhook event handling details (which events to listen for)
- Success page design
- Payment history pagination approach

</decisions>

<specifics>
## Specific Ideas

- Webhook-first was an architectural decision from project initialization — Stripe webhook confirms payment server-side, never trust redirect
- ACH is preferred for rent (lower fees ~0.8% vs card ~2.9%) — should be prominent option
- Manual payment recording lets admin capture real-world payments (cash under door, Venmo, etc.) that won't go through Stripe

</specifics>

<deferred>
## Deferred Ideas

- Autopay/recurring payments — Phase 6
- Late fee calculations — not in current scope
- Payment reminders/notifications — Phase 5

</deferred>

---

*Phase: 03-payments*
*Context gathered: 2026-02-26*
