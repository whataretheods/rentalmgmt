# Phase 6: Autopay and Polish - Research

**Researched:** 2026-02-26
**Domain:** Stripe SetupIntent autopay, cron-based recurring charges, mobile responsiveness, dashboard consolidation
**Confidence:** HIGH

## Summary

Phase 6 adds automatic recurring rent payments using Stripe SetupIntents to save payment methods, then manual PaymentIntent charges via a cron job (not Stripe Subscriptions). This approach gives full control over charge timing, amounts, and retry logic without Stripe's subscription billing overhead. The existing payment infrastructure (Stripe v20, webhook handler, sendNotification helper) provides a solid foundation.

The polish work covers mobile responsiveness (375px Playwright tests), dashboard consolidation (payment-first layout), and loading/error states across all pages. The existing component structure (PaymentSummaryCard, PayRentButton, etc.) needs enhancement but not replacement.

**Primary recommendation:** Use Stripe SetupIntent with Payment Element for enrollment, store Stripe Customer ID and PaymentMethod ID in a new autopayEnrollments table, create a cron API route that charges via PaymentIntent.create with off_session: true.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Dedicated /tenant/autopay setup page (separate from one-time payment flow)
- ACH + card both supported — push processing fees onto tenants
- Stripe SetupIntent to save payment method, then manual PaymentIntent charges via cron (not Stripe Subscriptions)
- Dashboard shows prominent "Autopay Active" badge + details card: last 4 digits of method, next charge date, amount, link to manage/cancel
- Notify tenant 3 days before the charge
- All channels: email + SMS (if opted in) + in-app — uses Phase 5 sendNotification helper
- Auto-skip if already paid: cron checks for existing payment in current period before charging
- On failure: notify tenant, retry once after 2 days. If still fails, mark as failed and notify admin. Tenant can pay manually.
- Immediate cancellation (no end-of-period delay). In-flight charges still complete.
- Simple confirm dialog: "Are you sure? You'll need to pay rent manually each month."
- Re-enrollment uses saved payment method (one-click re-enable, no re-entering details)
- Admin notified of enrollment/cancellation changes via in-app notification only (not email/SMS)
- Mobile responsiveness: Playwright E2E tests at 375px viewport for all tenant-facing pages
- Dashboard consolidation: payment-first layout. Top: payment status + autopay card. Middle: recent maintenance + document requests. Bottom: recent notifications.
- Loading states and error handling: skeleton loaders, empty states, error boundaries, toast feedback across all pages
- Polish both tenant-facing AND admin pages

### Claude's Discretion
- Exact SetupIntent flow UI details (form layout, Stripe Elements styling)
- Skeleton loader designs and animation
- Error boundary fallback content
- Which specific admin pages need the most polish attention

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PAY-06 | Tenant can enroll in autopay for automatic recurring rent payments | SetupIntent enrollment flow, autopayEnrollments table, cron-based charging, pre-charge notifications, cancellation, re-enrollment |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| stripe | ^20.4.0 | Server-side Stripe API (already installed) | SetupIntent, PaymentIntent, Customer creation |
| @stripe/stripe-js | latest | Client-side Stripe.js loader | loadStripe, confirmSetup |
| @stripe/react-stripe-js | latest | React bindings for Stripe Elements | Elements provider, PaymentElement, useStripe, useElements |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sonner | ^2.0.7 | Toast notifications (already installed) | Enrollment success/failure feedback |
| zod | ^4.3.6 | Request validation (already installed) | Validate autopay API inputs |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SetupIntent + manual PaymentIntent | Stripe Subscriptions | Subscriptions handle billing automatically but remove control over charge timing, amounts, skip-if-paid logic, and fee passthrough. SetupIntent approach is explicitly chosen. |

**Installation:**
```bash
npm install @stripe/stripe-js @stripe/react-stripe-js
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/
│   ├── (tenant)/tenant/
│   │   ├── autopay/           # NEW: autopay setup page
│   │   │   └── page.tsx
│   │   ├── autopay/setup-complete/  # NEW: return URL after Stripe confirmation
│   │   │   └── page.tsx
│   │   └── dashboard/
│   │       └── page.tsx       # MODIFIED: consolidated payment-first layout
│   ├── api/
│   │   ├── autopay/
│   │   │   ├── enroll/route.ts       # NEW: create SetupIntent + Stripe Customer
│   │   │   ├── cancel/route.ts       # NEW: cancel enrollment
│   │   │   ├── re-enroll/route.ts    # NEW: re-enable with saved method
│   │   │   └── status/route.ts       # NEW: get enrollment status
│   │   └── cron/
│   │       ├── autopay-charge/route.ts    # NEW: monthly autopay cron
│   │       ├── autopay-notify/route.ts    # NEW: 3-day pre-charge notification cron
│   │       └── rent-reminders/route.ts    # MODIFIED: skip autopay-enrolled tenants
├── components/
│   ├── tenant/
│   │   ├── AutopayEnrollForm.tsx    # NEW: Stripe Elements enrollment form
│   │   ├── AutopayStatusCard.tsx    # NEW: dashboard autopay badge + details
│   │   └── PaymentSummaryCard.tsx   # MODIFIED: add autopay indicator
├── db/schema/
│   └── domain.ts              # MODIFIED: add autopayEnrollments table
├── emails/
│   └── AutopayChargeEmail.tsx # NEW: pre-charge notification email template
└── lib/
    └── stripe.ts              # EXISTING: Stripe client (no changes needed)
```

### Pattern 1: Stripe SetupIntent Enrollment Flow
**What:** Save a payment method for future charges without charging immediately
**When to use:** When tenant enrolls in autopay
**Example:**
```typescript
// Server: Create SetupIntent
// Source: https://docs.stripe.com/payments/save-and-reuse
const setupIntent = await stripe.setupIntents.create({
  customer: stripeCustomerId,
  payment_method_types: ["card", "us_bank_account"],
})

// Client: Confirm with PaymentElement
const { error } = await stripe.confirmSetup({
  elements,
  confirmParams: {
    return_url: `${origin}/tenant/autopay/setup-complete`,
  },
})

// Server: After confirmation, retrieve the PaymentMethod
const setupIntent = await stripe.setupIntents.retrieve(setupIntentId)
const paymentMethodId = setupIntent.payment_method
const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId)
// Store paymentMethodId, last4, brand in autopayEnrollments table
```

### Pattern 2: Off-Session Charging via Cron
**What:** Charge saved payment method without customer present
**When to use:** Monthly autopay cron job
**Example:**
```typescript
// Source: https://docs.stripe.com/payments/save-and-reuse
const paymentIntent = await stripe.paymentIntents.create({
  amount: amountWithFeesCents,
  currency: "usd",
  customer: stripeCustomerId,
  payment_method: savedPaymentMethodId,
  off_session: true,
  confirm: true,
  metadata: {
    tenantUserId,
    unitId,
    billingPeriod,
    autopay: "true",
  },
})
```

### Pattern 3: Fee Passthrough Calculation
**What:** Add processing fees to the charge amount so tenant covers them
**When to use:** During enrollment display and during charge creation
**Example:**
```typescript
// Card: 2.9% + $0.30
function calculateCardFee(amountCents: number): number {
  // To make tenant pay exactly rentAmount + fees:
  // totalCharge = (rentAmount + 0.30) / (1 - 0.029)
  const totalCents = Math.ceil((amountCents + 30) / (1 - 0.029))
  return totalCents - amountCents
}

// ACH: 0.8%, capped at $5.00
function calculateAchFee(amountCents: number): number {
  const fee = Math.ceil(amountCents * 0.008)
  return Math.min(fee, 500) // cap at $5.00
}
```

### Pattern 4: Stripe Customer Management
**What:** Create/reuse Stripe Customer objects for saved payment methods
**When to use:** First autopay enrollment — Stripe requires Customer for SetupIntent
**Example:**
```typescript
// Check if tenant already has a Stripe Customer
let stripeCustomerId = enrollment?.stripeCustomerId
if (!stripeCustomerId) {
  const customer = await stripe.customers.create({
    email: session.user.email,
    name: session.user.name,
    metadata: { tenantUserId: session.user.id },
  })
  stripeCustomerId = customer.id
}
```

### Anti-Patterns to Avoid
- **Using Stripe Subscriptions:** Subscriptions add billing cycle management overhead and don't support skip-if-already-paid logic natively. Manual PaymentIntent gives full control.
- **Storing raw payment method details:** Never store card numbers or bank account numbers. Store only Stripe PaymentMethod ID, last4, and brand.
- **Charging without pre-notification:** Nacha/card network rules require advance notice. The 3-day pre-charge notification cron handles this.
- **Immediate retry on failure:** Wait 2 days before retry per user decision. Don't retry in a tight loop.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Payment method collection UI | Custom card/bank form | Stripe PaymentElement | PCI compliance, validation, bank verification built-in |
| Bank account verification | Manual microdeposit flow | Stripe Financial Connections (via PaymentElement) | Handles instant + microdeposit verification automatically |
| Fee calculation display | Hardcoded fee amounts | Calculated from Stripe's published rates | Rates may change; centralize calculation |
| Skeleton loaders | Custom CSS animations | Tailwind animate-pulse on gray boxes | Consistent, zero-dependency, matches existing patterns |

**Key insight:** Stripe's PaymentElement handles the entire payment method collection flow including ACH bank verification, card validation, and mandate collection. Building custom forms would be a massive PCI compliance burden.

## Common Pitfalls

### Pitfall 1: Missing Stripe Customer Object
**What goes wrong:** SetupIntent requires a Customer ID. Current payment flow uses Checkout Sessions which auto-create customers, but SetupIntent needs explicit customer creation.
**Why it happens:** Checkout Sessions abstract away customer management. SetupIntent does not.
**How to avoid:** Create a Stripe Customer on first autopay enrollment. Store stripeCustomerId in autopayEnrollments table. Reuse for subsequent operations.
**Warning signs:** "No such customer" errors from Stripe API.

### Pitfall 2: ACH Mandate Requirements
**What goes wrong:** ACH charges fail or get disputed without proper mandate collection.
**Why it happens:** Nacha requires explicit authorization before ACH debit.
**How to avoid:** PaymentElement handles mandate display automatically when us_bank_account is a payment method type. Stripe stores the mandate reference.
**Warning signs:** Dispute rate increases, Nacha compliance warnings.

### Pitfall 3: Off-Session Authentication Failures
**What goes wrong:** Card charges fail with `authentication_required` when customer's bank requires 3DS.
**Why it happens:** Off-session charges can't display 3DS challenge UI.
**How to avoid:** Handle the error gracefully — notify tenant, provide link to make manual payment. The retry-once-after-2-days flow handles this.
**Warning signs:** PaymentIntent status `requires_action` instead of `succeeded`.

### Pitfall 4: Duplicate Charges
**What goes wrong:** Cron runs twice (Vercel cold starts, retries) and charges tenant twice.
**Why it happens:** Cron jobs in serverless environments may be invoked multiple times.
**How to avoid:** Use idempotency: check for existing payment in current billing period before charging. Also use Stripe's idempotency_key on PaymentIntent creation.
**Warning signs:** Multiple payments in same billing period for same tenant.

### Pitfall 5: Rent Reminder Duplication with Autopay
**What goes wrong:** Autopay-enrolled tenant gets "pay your rent" reminders alongside autopay pre-charge notifications.
**Why it happens:** Existing rent-reminder cron doesn't know about autopay enrollment.
**How to avoid:** Modify rent-reminders cron to check autopayEnrollments table — skip tenants with active autopay enrollment.
**Warning signs:** Confusing duplicate notifications to autopay tenants.

### Pitfall 6: Stale Payment Method After Card Expiry
**What goes wrong:** Saved card expires, charge fails, but enrollment still shows "active."
**Why it happens:** Card expiry is not proactively detected by the system.
**How to avoid:** On charge failure, update enrollment status to "payment_failed." Notify tenant. After retry also fails, mark as "inactive" and notify admin.
**Warning signs:** Increasing failure rates on autopay charges.

## Code Examples

### autopayEnrollments Schema
```typescript
// Source: Project pattern from domain.ts
export const autopayEnrollments = pgTable("autopay_enrollments", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantUserId: text("tenant_user_id").notNull().unique(), // one enrollment per tenant
  unitId: uuid("unit_id")
    .references(() => units.id, { onDelete: "cascade" })
    .notNull(),
  stripeCustomerId: text("stripe_customer_id").notNull(),
  stripePaymentMethodId: text("stripe_payment_method_id").notNull(),
  paymentMethodType: text("payment_method_type", {
    enum: ["card", "us_bank_account"],
  }).notNull(),
  paymentMethodLast4: text("payment_method_last4").notNull(),
  paymentMethodBrand: text("payment_method_brand"), // "visa", "mastercard", null for ACH
  status: text("status", {
    enum: ["active", "paused", "payment_failed", "cancelled"],
  }).default("active").notNull(),
  enrolledAt: timestamp("enrolled_at").defaultNow().notNull(),
  cancelledAt: timestamp("cancelled_at"),
  lastChargeAt: timestamp("last_charge_at"),
  nextChargeDate: text("next_charge_date"),  // "2026-03-01" for display
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})
```

### Enrollment API Route
```typescript
// POST /api/autopay/enroll
// Returns { clientSecret } for Stripe Elements
export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Get tenant's active unit
  const [link] = await db.select().from(tenantUnits)
    .where(and(eq(tenantUnits.userId, session.user.id), eq(tenantUnits.isActive, true)))
  if (!link) return NextResponse.json({ error: "No unit linked" }, { status: 403 })

  // Check existing enrollment
  const [existing] = await db.select().from(autopayEnrollments)
    .where(eq(autopayEnrollments.tenantUserId, session.user.id))

  let stripeCustomerId: string
  if (existing?.stripeCustomerId) {
    stripeCustomerId = existing.stripeCustomerId
  } else {
    const customer = await stripe.customers.create({
      email: session.user.email,
      name: session.user.name || undefined,
      metadata: { tenantUserId: session.user.id },
    })
    stripeCustomerId = customer.id
  }

  const setupIntent = await stripe.setupIntents.create({
    customer: stripeCustomerId,
    payment_method_types: ["card", "us_bank_account"],
  })

  return NextResponse.json({
    clientSecret: setupIntent.client_secret,
    stripeCustomerId,
  })
}
```

### Cron Charge Logic
```typescript
// POST /api/cron/autopay-charge
// Called on rent due day
for (const enrollment of activeEnrollments) {
  // 1. Skip if already paid this period
  const [paid] = await db.select({ id: payments.id }).from(payments)
    .where(and(
      eq(payments.tenantUserId, enrollment.tenantUserId),
      eq(payments.unitId, enrollment.unitId),
      eq(payments.billingPeriod, currentPeriod),
      eq(payments.status, "succeeded"),
    )).limit(1)
  if (paid) continue

  // 2. Calculate amount with fees
  const rentCents = unit.rentAmountCents
  const feeCents = enrollment.paymentMethodType === "card"
    ? calculateCardFee(rentCents)
    : calculateAchFee(rentCents)
  const totalCents = rentCents + feeCents

  // 3. Create PaymentIntent (off-session)
  try {
    const pi = await stripe.paymentIntents.create({
      amount: totalCents,
      currency: "usd",
      customer: enrollment.stripeCustomerId,
      payment_method: enrollment.stripePaymentMethodId,
      off_session: true,
      confirm: true,
      metadata: { tenantUserId, unitId, billingPeriod, autopay: "true" },
    })
    // 4. Record payment
    await db.insert(payments).values({ /* ... */ })
  } catch (err) {
    // 5. Handle failure — mark for retry
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Stripe Sources API | PaymentMethods API | 2020 | Sources deprecated — always use PaymentMethods |
| Custom card forms | Payment Element | 2021 | Unified multi-method UI, PCI SAQ-A compliance |
| CardElement | PaymentElement | 2021 | PaymentElement supports all methods (card, ACH, etc.) |
| Manual bank verification | Financial Connections | 2022 | Instant bank verification via login, microdeposit fallback |

**Deprecated/outdated:**
- Stripe Sources API: replaced by PaymentMethods API
- CardElement: replaced by PaymentElement (handles all method types)
- Token-based flows: replaced by PaymentMethod-based flows

## Open Questions

1. **STRIPE_PUBLISHABLE_KEY env var**
   - What we know: The existing checkout flow uses server-side Stripe only. SetupIntent client confirmation needs the publishable key in the browser.
   - What's unclear: Whether NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is already configured.
   - Recommendation: Add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to .env.local. This is safe — publishable keys are meant to be public.

2. **Exact charge timing on due day**
   - What we know: Cron fires once daily. Rent due day is stored in units.rentDueDay.
   - What's unclear: What time of day the cron runs.
   - Recommendation: Charge on the due day itself. Pre-charge notification fires 3 days before. Both crons should run daily and check dates.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright ^1.58.2 |
| Config file | playwright.config.ts (if exists, otherwise create) |
| Quick run command | `npx playwright test --grep "autopay"` |
| Full suite command | `npx playwright test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PAY-06 | Tenant can enroll in autopay | e2e | `npx playwright test tests/autopay-enroll.spec.ts` | No — Wave 0 |
| PAY-06 | Tenant can cancel autopay | e2e | `npx playwright test tests/autopay-cancel.spec.ts` | No — Wave 0 |
| PAY-06 | Pre-charge notification sent | integration | `curl -X POST /api/cron/autopay-notify -H "Authorization: Bearer $CRON_SECRET"` | No — Wave 0 |
| PAY-06 | Autopay charge succeeds | integration | `curl -X POST /api/cron/autopay-charge -H "Authorization: Bearer $CRON_SECRET"` | No — Wave 0 |
| PAY-06 | Dashboard shows autopay status | e2e | `npx playwright test tests/dashboard-autopay.spec.ts` | No — Wave 0 |
| PAY-06 | Mobile responsive at 375px | e2e | `npx playwright test tests/mobile-responsive.spec.ts` | No — Wave 0 |

### Sampling Rate
- **Per task commit:** `npx tsc --noEmit` (type checking)
- **Per wave merge:** `npx playwright test` (full suite)
- **Phase gate:** Full suite green before verification

### Wave 0 Gaps
- [ ] `@stripe/stripe-js` and `@stripe/react-stripe-js` packages — must be installed
- [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` env var — must be configured
- [ ] Playwright config for 375px mobile viewport — may need mobile project config
- [ ] Seed script for autopay test data — creates tenant with active unit and payment method

## Sources

### Primary (HIGH confidence)
- Stripe Save & Reuse docs (https://docs.stripe.com/payments/save-and-reuse) — SetupIntent flow, PaymentElement, off-session charging
- Stripe ACH Setup docs (https://docs.stripe.com/payments/ach-debit/set-up-payment) — ACH verification, mandate requirements
- Existing codebase analysis — payment infrastructure, schema patterns, notification system

### Secondary (MEDIUM confidence)
- Stripe pricing (https://stripe.com/pricing via web search) — Card: 2.9% + $0.30, ACH: 0.8% capped at $5.00

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Stripe v20 already installed, SetupIntent API is well-documented
- Architecture: HIGH - Follows existing project patterns (lazy Proxy, cron routes, sendNotification)
- Pitfalls: HIGH - Well-documented Stripe failure modes, existing codebase patterns inform solutions

**Research date:** 2026-02-26
**Valid until:** 2026-03-26 (stable Stripe API, no breaking changes expected)
