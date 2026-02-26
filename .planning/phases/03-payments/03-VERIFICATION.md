---
phase: 03-payments
verified: 2026-02-26T17:15:00Z
status: human_needed
score: 18/18 must-haves verified
re_verification: false
human_verification:
  - test: "Stripe Checkout redirect and card payment completion"
    expected: "Clicking Pay Rent redirects to checkout.stripe.com, test card 4242 4242 4242 4242 completes payment, webhook receives event, payment recorded in DB, success page shown, confirmation email sent"
    why_human: "Requires live Stripe keys, Stripe CLI webhook listener, and interaction with external Stripe Checkout UI — cannot verify programmatically without live payment credentials"
  - test: "ACH payment flow (pending -> succeeded)"
    expected: "ACH bank account selection shows at Stripe Checkout, checkout.session.completed fires with payment_status=unpaid creating a pending record, checkout.session.async_payment_succeeded later updates to succeeded"
    why_human: "ACH settlement is asynchronous (3-5 business days) and requires Stripe test ACH flow — cannot simulate webhook event sequence automatically"
  - test: "PDF receipt download"
    expected: "Clicking Download Receipt (PDF) on /tenant/payments/[id] for a succeeded payment downloads a valid PDF file with correct payment details"
    why_human: "PDF binary content validation requires opening the file — programmatic check would only verify 200 response, not PDF content correctness"
  - test: "Payment confirmation email delivery"
    expected: "After a successful card payment, tenant receives email with correct amount, unit, period, and date from noreply@rentalmgmt.com"
    why_human: "Requires checking Resend dashboard or actual email inbox — cannot verify external email delivery programmatically"
  - test: "Admin manual payment recording refreshes dashboard"
    expected: "Recording a cash payment via ManualPaymentForm updates the unit status badge in real time (client refetch) without page reload"
    why_human: "onPaymentRecorded callback triggers a client-side fetch and React state update — verifying this requires a running browser"
---

# Phase 3: Payments Verification Report

**Phase Goal:** Payments — Tenants can pay rent online via Stripe and the admin can see at a glance who has paid and who hasn't
**Verified:** 2026-02-26T17:15:00Z
**Status:** human_needed — all automated checks passed; 5 items require live environment verification
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | payments table exists with all 13 columns and correct types | VERIFIED | `src/db/schema/domain.ts` lines 59-80: id, tenantUserId (text), unitId (uuid FK->units), amountCents (integer), stripeSessionId (unique), stripePaymentIntentId, paymentMethod (enum), status (enum), billingPeriod, note, paidAt, createdAt, updatedAt |
| 2 | Stripe client can be imported from @/lib/stripe without build errors | VERIFIED | `src/lib/stripe.ts` exports `stripe` via lazy Proxy pattern; `getStripe()` throws descriptive error if STRIPE_SECRET_KEY missing |
| 3 | stripe and @react-pdf/renderer packages installed | VERIFIED | `package.json`: `"stripe": "^20.4.0"`, `"@react-pdf/renderer": "^4.3.2"` |
| 4 | Tenant can click Pay Rent and be redirected to Stripe Checkout | VERIFIED | `PayRentButton.tsx` POSTs to `/api/payments/create-checkout`, receives URL, sets `window.location.href = url`. `create-checkout/route.ts` calls `stripe.checkout.sessions.create` with card + ACH (`us_bank_account`) and metadata |
| 5 | Webhook records payment on checkout.session.completed (card=succeeded, ACH=pending) | VERIFIED | `webhooks/stripe/route.ts` handles `checkout.session.completed`: `payment_status === "paid"` inserts with `status: "succeeded"`, `payment_status === "unpaid"` inserts with `status: "pending"`. Both use `.onConflictDoNothing()` for idempotency |
| 6 | ACH webhook updates to succeeded on async_payment_succeeded | VERIFIED | `webhooks/stripe/route.ts` handles `checkout.session.async_payment_succeeded`: updates `status: "succeeded"`, `paidAt: new Date()` where `stripeSessionId = session.id` |
| 7 | Duplicate webhook events do not create duplicate payment records | VERIFIED | `stripeSessionId.unique()` in schema + `.onConflictDoNothing()` on both inserts in webhook handler |
| 8 | Tenant receives email confirmation after successful payment | VERIFIED (code path) | `sendPaymentConfirmation()` called after card and ACH success, uses `resend.emails.send` fire-and-forget. Actual delivery requires human check |
| 9 | Success page shows payment confirmation after redirect | VERIFIED | `src/app/(tenant)/tenant/payments/success/page.tsx` renders confirmation UI with ACH processing note |
| 10 | Admin can see units with rent amount and due day, edit inline | VERIFIED | `/admin/units/page.tsx` queries all units with properties, renders `RentConfigForm` per row. `RentConfigForm.tsx` has dollar amount + due day inputs |
| 11 | Saving rent config updates units table | VERIFIED | `RentConfigForm.tsx` fetches PATCH `/api/units/[unitId]/rent-config`. Route updates `rentAmountCents`, `rentDueDay`, `updatedAt` via Drizzle `.update(units)` |
| 12 | Tenant dashboard shows balance, next due date, last payment | VERIFIED | `tenant/dashboard/page.tsx` queries unit and last payment, passes to `PaymentSummaryCard` which renders 3 cards: Rent Amount, Next Due Date, Last Payment |
| 13 | Tenant can view chronological payment history | VERIFIED | `/tenant/payments/page.tsx` queries all payments for tenant+unit ordered by `createdAt` desc, renders `PaymentHistoryTable` |
| 14 | Tenant can view individual payment details | VERIFIED | `/tenant/payments/[id]/page.tsx` fetches payment by id + tenantUserId guard, renders all fields; shows receipt download link for succeeded payments |
| 15 | Tenant can download PDF receipt | VERIFIED (code path) | `/api/payments/receipt/[paymentId]/route.ts` calls `renderToBuffer(ReceiptDocument({...}))`, returns `application/pdf` with `Content-Disposition: attachment` |
| 16 | Admin can see per-unit paid/unpaid status for current billing period | VERIFIED | `/admin/payments/page.tsx` + `PaymentDashboard.tsx` + `/api/admin/payments-overview/route.ts`: aggregates succeeded+pending payments per unit, computes paid/unpaid/partial/pending status |
| 17 | Status badges are color-coded: Paid (green), Unpaid (red), Partial (amber), Pending (yellow) | VERIFIED | `PaymentDashboard.tsx` `statusStyles` map: `paid: "bg-green-100 text-green-800"`, `unpaid: "bg-red-100 text-red-800"`, `partial: "bg-amber-100 text-amber-800"`, `pending: "bg-yellow-100 text-yellow-800"` |
| 18 | Admin can record manual offline payment | VERIFIED | `ManualPaymentForm.tsx` POSTs to `/api/payments/manual`. Route validates admin session, finds active tenant for unit, inserts payment with `status: "succeeded"` and no stripeSessionId |

**Score:** 18/18 truths verified (5 require live environment human confirmation)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/db/schema/domain.ts` | payments table with all columns | VERIFIED | 13 columns, correct types, stripeSessionId.unique(), unitId FK to units |
| `src/lib/stripe.ts` | Lazy Proxy Stripe client | VERIFIED | Exports `stripe` and `getStripe()`, matches resend.ts pattern |
| `package.json` | stripe and @react-pdf/renderer deps | VERIFIED | stripe@^20.4.0, @react-pdf/renderer@^4.3.2, @playwright/test@^1.58.2 |
| `src/app/api/payments/create-checkout/route.ts` | POST: creates Checkout Session | VERIFIED | Auth check, tenant-unit link verification, card + ACH, metadata, returns URL |
| `src/app/api/webhooks/stripe/route.ts` | POST: handles 3 webhook events | VERIFIED | Signature verification, 3 event types, idempotent inserts, email fire-and-forget |
| `src/app/(tenant)/tenant/payments/success/page.tsx` | Post-checkout success page | VERIFIED | Renders confirmation with ACH note, links to dashboard and history |
| `src/app/(admin)/admin/units/page.tsx` | Admin units with rent config | VERIFIED | DB query with property join, renders RentConfigForm per unit |
| `src/app/api/units/[unitId]/rent-config/route.ts` | PATCH: update rent config | VERIFIED | Admin-only, Zod validation (0-10000000 cents, 1-28 day), updates units table |
| `src/components/admin/RentConfigForm.tsx` | Inline rent editing form | VERIFIED | Client component, dollar/cents conversion, PATCH fetch, toast feedback |
| `src/app/(tenant)/tenant/dashboard/page.tsx` | Dashboard with payment summary + Pay button | VERIFIED | Queries unit + last payment, renders PaymentSummaryCard + PayRentButton |
| `src/app/(tenant)/tenant/payments/page.tsx` | Payment history page | VERIFIED | Queries all payments desc, renders PaymentHistoryTable |
| `src/app/(tenant)/tenant/payments/[id]/page.tsx` | Payment detail view | VERIFIED | Tenant-scoped fetch, full field display, receipt download link for succeeded |
| `src/app/api/payments/receipt/[paymentId]/route.ts` | GET: PDF receipt endpoint | VERIFIED | Auth + tenant ownership check, renderToBuffer, Content-Disposition: attachment |
| `src/lib/pdf/receipt.tsx` | React-PDF ReceiptDocument | VERIFIED | Full A4 document with 7 fields (receipt#, unit, amount, method, period, date, status) |
| `src/components/tenant/PayRentButton.tsx` | Button triggering Stripe Checkout | VERIFIED | POST to create-checkout, window.location redirect, loading state |
| `src/components/tenant/PaymentSummaryCard.tsx` | 3-card summary (balance, due, last) | VERIFIED | Calculates next due date, StatusBadge with pending/succeeded/failed |
| `src/components/tenant/PaymentHistoryTable.tsx` | Payment history table | VERIFIED | 5 columns, links to detail page, PaymentStatusBadge, empty state |
| `src/app/(admin)/admin/payments/page.tsx` | Admin payment dashboard page | VERIFIED | Server-fetches initial data, passes to PaymentDashboard client component |
| `src/components/admin/PaymentDashboard.tsx` | Dashboard with month nav + status table | VERIFIED | Client component, Previous/Next month navigation, ManualPaymentForm per unit |
| `src/components/admin/ManualPaymentForm.tsx` | Manual payment recording form | VERIFIED | Toggle open/close, POST to /api/payments/manual, onPaymentRecorded callback |
| `src/app/api/payments/manual/route.ts` | POST: create manual payment | VERIFIED | Admin-only, Zod validation, finds active tenant, inserts with status=succeeded |
| `src/app/api/admin/payments-overview/route.ts` | GET: per-unit payment status | VERIFIED | Aggregates via SQL, computes paid/unpaid/partial/pending, uses Drizzle user schema |
| `e2e/payments.spec.ts` | Playwright tenant payment tests | VERIFIED | 5 tests: dashboard summary, Pay Rent button, Stripe redirect, history, detail+receipt |
| `e2e/admin-payments.spec.ts` | Playwright admin payment tests | VERIFIED | 4 tests: rent config, payment dashboard, status badges, manual payment |
| `scripts/seed-payment-test.ts` | Payment test data seed | VERIFIED | Uses config({ path: ".env.local" }), idempotent, configures rent + inserts test payment |
| `playwright.config.ts` | Playwright configuration | VERIFIED | testDir ./e2e, headless: true, baseURL localhost:3000, timeout 30s |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/db/schema/domain.ts` | units table | `payments.unitId references units.id` | VERIFIED | `.references(() => units.id, { onDelete: "cascade" })` at line 64 |
| `src/lib/stripe.ts` | STRIPE_SECRET_KEY | `process.env.STRIPE_SECRET_KEY` | VERIFIED | `getStripe()` reads `process.env.STRIPE_SECRET_KEY`, throws if missing |
| `src/components/admin/RentConfigForm.tsx` | `/api/units/[unitId]/rent-config` | fetch PATCH | VERIFIED | `fetch(\`/api/units/${unitId}/rent-config\`, { method: "PATCH" })` at line 36 |
| `src/app/api/units/[unitId]/rent-config/route.ts` | units table | `db.update(units)` | VERIFIED | `db.update(units).set({rentAmountCents, rentDueDay, updatedAt}).where(eq(units.id, unitId))` |
| `src/app/api/payments/create-checkout/route.ts` | `stripe.checkout.sessions.create` | Creates Checkout Session with metadata | VERIFIED | `stripe.checkout.sessions.create({ payment_method_types: ["card", "us_bank_account"], metadata: { tenantUserId, unitId, billingPeriod } })` |
| `src/app/api/webhooks/stripe/route.ts` | payments table | `db.insert(payments) / db.update(payments)` | VERIFIED | Insert on `checkout.session.completed`, update on `async_payment_succeeded` and `async_payment_failed` |
| `src/app/api/webhooks/stripe/route.ts` | `src/lib/resend.ts` | `resend.emails.send` | VERIFIED | `void resend.emails.send({ from: "...", to: tenantUser.email, subject: "Payment Confirmation", html: ... })` |
| `src/components/tenant/PayRentButton.tsx` | `/api/payments/create-checkout` | fetch POST then window.location redirect | VERIFIED | `fetch("/api/payments/create-checkout", { method: "POST" })` then `window.location.href = url` |
| `src/app/api/payments/receipt/[paymentId]/route.ts` | `src/lib/pdf/receipt.tsx` | `renderToBuffer(ReceiptDocument({...}))` | VERIFIED | `renderToBuffer(ReceiptDocument({ receiptId, unitNumber, amount, ... }))` at line 39 |
| `src/components/admin/PaymentDashboard.tsx` | `/api/admin/payments-overview` | fetch with period param | VERIFIED | `fetch(\`/api/admin/payments-overview?period=${p}\`)` inside `fetchData` callback |
| `src/components/admin/ManualPaymentForm.tsx` | `/api/payments/manual` | fetch POST | VERIFIED | `fetch("/api/payments/manual", { method: "POST", body: JSON.stringify({unitId, amountCents, paymentMethod, billingPeriod, note}) })` |
| `e2e/payments.spec.ts` | tenant dashboard | Navigates to `/tenant/dashboard` and verifies content | VERIFIED | `page.goto(\`${BASE_URL}/tenant/payments\`)` and `waitForURL("**/tenant/dashboard")` |
| `e2e/admin-payments.spec.ts` | `/admin/payments` | Navigates and verifies status table | VERIFIED | `page.goto(\`${BASE_URL}/admin/payments\`)` with `locator("text=Payment Dashboard")` |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|----------|
| PAY-01 | 03-01, 03-03, 03-04, 03-06 | Tenant can pay rent via Stripe (ACH and card) | SATISFIED | `create-checkout/route.ts` creates Checkout Session with card + us_bank_account; `PayRentButton` triggers it; webhook records result |
| PAY-02 | 03-04, 03-06 | Tenant can view payment history and download receipts | SATISFIED | `/tenant/payments` renders history table; `/tenant/payments/[id]` shows detail; receipt endpoint generates PDF |
| PAY-03 | 03-04, 03-06 | Tenant can see current balance, due date, and last payment | SATISFIED | `PaymentSummaryCard` renders 3 cards (Rent Amount, Next Due Date, Last Payment); wired in `tenant/dashboard/page.tsx` |
| PAY-04 | 03-02, 03-06 | Admin can configure different rent amounts and due dates per unit | SATISFIED | `/admin/units` page with `RentConfigForm` inline editing; PATCH endpoint updates DB |
| PAY-05 | 03-05, 03-06 | Admin can view payment dashboard showing who's paid and outstanding balances per unit | SATISFIED | `PaymentDashboard` + `/api/admin/payments-overview` aggregates per-unit paid/unpaid/partial/pending status |
| NOTIF-02 | 03-03, 03-06 | System sends email notifications for payment confirmations | SATISFIED (code path) | `sendPaymentConfirmation()` in webhook calls `resend.emails.send` with HTML receipt after succeeded card and ACH settlement |

All 6 required requirement IDs (PAY-01, PAY-02, PAY-03, PAY-04, PAY-05, NOTIF-02) are covered. No orphaned requirements found. Note: NOTIF-02 full satisfaction requires human confirmation of actual email delivery (see Human Verification section).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | No stubs, empty implementations, or placeholder patterns detected |

Notable observations (not blocking):
- `admin-payments.spec.ts` line 66: `if (await recordBtn.isVisible())` — manual payment test skips silently if no unit has an active tenant. This is acceptable for current data state but could mask test gaps in empty environments.
- `src/app/api/webhooks/stripe/route.ts` line 9: Uses `new Stripe(process.env.STRIPE_SECRET_KEY as string)` directly (not the lazy proxy `stripe` from `@/lib/stripe`). This is intentional — the webhook handler needs a raw Stripe instance for `stripe.webhooks.constructEvent`. Not a bug.

### Human Verification Required

#### 1. Stripe Checkout and Card Payment Flow

**Test:** With STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, and NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY set in .env.local, run `npm run dev` and `stripe listen --forward-to localhost:3000/api/webhooks/stripe`. Login as tenant, click Pay Rent on dashboard, complete checkout with card 4242 4242 4242 4242 (any future expiry, any CVC)
**Expected:** Checkout page shows card option, payment completes, redirected to /tenant/payments/success, webhook terminal shows `checkout.session.completed` received, payment record appears in DB with status=succeeded
**Why human:** Requires live Stripe keys and interaction with Stripe's external checkout domain

#### 2. ACH Payment Pending Flow

**Test:** In Stripe Checkout, select bank account (ACH) payment method, complete the bank linking flow
**Expected:** Webhook receives `checkout.session.completed` with payment_status=unpaid, DB record created with status=pending, payment_method=ach
**Why human:** ACH requires Stripe test bank account selection in the UI; async settlement sequence cannot be simulated without the Stripe CLI event injection

#### 3. PDF Receipt Download

**Test:** After a succeeded payment exists, navigate to /tenant/payments/[id] for that payment, click "Download Receipt (PDF)"
**Expected:** Browser downloads a valid PDF file named `receipt-[8chars].pdf` containing correct payment fields (amount, unit, period, date)
**Why human:** PDF binary correctness requires opening the file; HTTP 200 status is verifiable programmatically but content validity is not

#### 4. Payment Confirmation Email Delivery

**Test:** Complete a card payment, check Resend dashboard (https://resend.com/emails) or the tenant's actual email inbox
**Expected:** Email from noreply@rentalmgmt.com with subject "Payment Confirmation" contains amount, unit number, billing period, and date
**Why human:** External email delivery requires checking Resend dashboard or inbox — cannot verify programmatically

#### 5. Manual Payment Real-Time Refresh

**Test:** On /admin/payments, click "Record Payment" for a unit with an active tenant, enter $500.00, click Save
**Expected:** Toast "Manual payment recorded for Unit [X]" appears, the unit's status badge and amount paid update without a full page reload
**Why human:** The `onPaymentRecorded={() => fetchData(period)}` client-side state update requires a running browser to observe

### Gaps Summary

No gaps found. All 18 observable truths are verified against actual codebase implementation. All artifacts exist and are substantive (no stubs). All key links are wired with real implementation (fetch calls backed by endpoints, endpoints backed by DB queries, webhook idempotency enforced).

The 5 human verification items are inherent to the nature of this feature:
- External Stripe payment processing (live keys required)
- Async ACH settlement (webhook-driven)
- Binary PDF content validation
- External email service delivery
- Real-time UI state updates in browser

All of these are structural requirements of the payment system, not gaps in implementation.

---

_Verified: 2026-02-26T17:15:00Z_
_Verifier: Claude (gsd-verifier)_
