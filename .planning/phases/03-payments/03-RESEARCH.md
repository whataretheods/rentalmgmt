# Phase 3: Payments - Research

**Researched:** 2026-02-26
**Domain:** Stripe payment integration, payment schema design, webhook handling, PDF receipt generation
**Confidence:** HIGH

## Summary

Phase 3 integrates Stripe Checkout Sessions (redirect-based) for rent collection with ACH Direct Debit and card payment methods. The architecture follows a webhook-first pattern where payment confirmation is only trusted after receiving Stripe webhook events -- never from the redirect URL. The phase adds a payments table to track all transactions, extends the existing units table with rent configuration, and builds both tenant-facing payment/history UI and an admin payment dashboard.

Key technical decisions are well-supported by Stripe's ecosystem: Checkout Sessions handle PCI compliance, Financial Connections handles ACH bank verification, and webhook signature verification ensures payment integrity. PDF receipt generation uses `@react-pdf/renderer` for server-side rendering in Next.js API routes. Email confirmations leverage the existing Resend integration.

**Primary recommendation:** Use Stripe Checkout Sessions with `payment_method_types: ['card', 'us_bank_account']`, webhook-first confirmation via `checkout.session.completed` and `checkout.session.async_payment_succeeded` events, and `@react-pdf/renderer` for downloadable PDF receipts.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Stripe Checkout Session (redirect-based) -- not embedded Payment Element
- ACH bank transfer + credit/debit card payment methods
- Webhook-first confirmation -- never trust the redirect as payment proof. Mark paid only after webhook event.
- Rent amount is pre-filled from admin-set amount but tenant can adjust (partial payment or overpayment allowed)
- Table with color-coded status badges (Paid/Unpaid/Partial/Pending)
- Columns: unit, tenant name, amount due, amount paid, status badge, last payment date
- Default view: current calendar month. Option to navigate to past months.
- Admin can record manual/offline payments (cash, check, Venmo) with a note
- Rent amounts and due dates edited inline on the units/properties page -- no separate settings page
- Prominent "Pay Rent" button on tenant dashboard -- one click to start Stripe Checkout
- Dashboard at-a-glance: current balance owed, next due date, most recent payment summary
- After Stripe Checkout: redirect to success confirmation page + email receipt
- ACH pending status: show "Payment processing" badge until ACH clears (3-5 business days)
- Both on-screen detail view AND downloadable PDF receipt for each payment
- Payment history: simple chronological list, most recent first
- History columns: date, amount, payment method (ACH/card), status (paid/pending/failed)
- Email confirmation includes: amount, unit number, date, payment method -- clean and concise

### Claude's Discretion
- PDF receipt layout and styling
- Exact Stripe Checkout session configuration
- Webhook event handling details (which events to listen for)
- Success page design
- Payment history pagination approach

### Deferred Ideas (OUT OF SCOPE)
- Autopay/recurring payments -- Phase 6
- Late fee calculations -- not in current scope
- Payment reminders/notifications -- Phase 5
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PAY-01 | Tenant can pay rent via Stripe (ACH and card) | Stripe Checkout Session with `payment_method_types: ['card', 'us_bank_account']`, webhook-first confirmation |
| PAY-02 | Tenant can view payment history and download receipts | Payments table with chronological query, `@react-pdf/renderer` for PDF generation via API route |
| PAY-03 | Tenant can see current balance, due date, and last payment | Dashboard query combining units.rentAmountCents, units.rentDueDay, and latest payment record |
| PAY-04 | Admin can configure different rent amounts and due dates per unit | Existing units table already has rentAmountCents and rentDueDay columns (nullable, added in Phase 1) |
| PAY-05 | Admin can view payment dashboard showing who's paid and outstanding balances per unit | Aggregate query joining units, tenantUnits, and payments for current billing period |
| NOTIF-02 | System sends email notifications for payment confirmations | Resend email triggered in webhook handler after successful payment |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| stripe | ^17.x | Server-side Stripe API client | Official Node.js SDK, typed, handles API versioning |
| @react-pdf/renderer | ^4.x | Server-side PDF generation | React-based PDF creation, works in Next.js API routes |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| resend (existing) | ^6.9.2 | Email delivery | Payment confirmation emails -- already integrated |
| zod (existing) | ^4.3.6 | Request validation | Validate webhook payloads, API inputs |
| drizzle-orm (existing) | ^0.45.1 | Database queries | Payment records, aggregation queries |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @react-pdf/renderer | pdfmake | pdfmake uses JSON definition, @react-pdf uses JSX which fits React codebase better |
| @react-pdf/renderer | PDFKit | PDFKit is lower-level, more control but more code for simple receipts |
| Stripe Checkout (redirect) | Stripe Payment Element (embedded) | User locked decision: redirect-based Checkout Session |

**Installation:**
```bash
npm install stripe @react-pdf/renderer
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/
│   ├── api/
│   │   ├── payments/
│   │   │   ├── create-checkout/route.ts    # POST: create Stripe Checkout Session
│   │   │   └── receipt/[paymentId]/route.ts # GET: generate PDF receipt
│   │   └── webhooks/
│   │       └── stripe/route.ts              # POST: Stripe webhook handler
│   ├── (tenant)/tenant/
│   │   ├── dashboard/page.tsx               # Enhanced with payment summary
│   │   ├── payments/page.tsx                # Payment history list
│   │   ├── payments/[id]/page.tsx           # Payment detail view
│   │   └── payments/success/page.tsx        # Post-checkout success page
│   └── (admin)/admin/
│       ├── payments/page.tsx                # Admin payment dashboard
│       └── payments/record/page.tsx         # Manual payment recording (or modal)
├── components/
│   ├── tenant/
│   │   ├── PayRentButton.tsx                # Triggers checkout session
│   │   ├── PaymentSummaryCard.tsx           # Dashboard at-a-glance
│   │   └── PaymentHistoryTable.tsx          # Payment history list
│   └── admin/
│       ├── PaymentDashboard.tsx             # Full payment overview table
│       ├── RentConfigForm.tsx               # Inline rent amount/due date editor
│       └── ManualPaymentForm.tsx            # Record offline payment
├── db/
│   └── schema/
│       └── domain.ts                        # Add payments table
└── lib/
    ├── stripe.ts                            # Stripe client (lazy init like db/resend)
    └── pdf/
        └── receipt.tsx                      # Receipt PDF component
```

### Pattern 1: Stripe Client (Lazy Proxy)
**What:** Lazy-initialized Stripe client matching project's existing pattern for db and resend
**When to use:** Always -- prevents build failures when STRIPE_SECRET_KEY is not set
**Example:**
```typescript
// src/lib/stripe.ts
import Stripe from 'stripe'

let _stripe: Stripe | null = null

function getStripe(): Stripe {
  if (!_stripe) {
    const secretKey = process.env.STRIPE_SECRET_KEY
    if (!secretKey) {
      throw new Error("STRIPE_SECRET_KEY is not set in .env.local")
    }
    _stripe = new Stripe(secretKey)
  }
  return _stripe
}

export const stripe = new Proxy({} as Stripe, {
  get(_target, prop, receiver) {
    return Reflect.get(getStripe(), prop, receiver)
  },
})
```

### Pattern 2: Webhook Handler (App Router)
**What:** Stripe webhook verification and event processing in Next.js route handler
**When to use:** For all Stripe webhook events
**Example:**
```typescript
// Source: https://github.com/stripe/stripe-node/blob/master/examples/webhook-signing/nextjs/app/api/webhooks/route.ts
import { Stripe } from 'stripe'
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string)

export async function POST(req: Request) {
  let event: Stripe.Event

  try {
    const stripeSignature = (await headers()).get('stripe-signature')
    event = stripe.webhooks.constructEvent(
      await req.text(),
      stripeSignature as string,
      process.env.STRIPE_WEBHOOK_SECRET as string
    )
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    console.log(`Webhook Error: ${errorMessage}`)
    return NextResponse.json({ message: `Webhook Error: ${errorMessage}` }, { status: 400 })
  }

  // Handle events...
  return NextResponse.json({ message: 'Received' }, { status: 200 })
}
```

### Pattern 3: Checkout Session Creation
**What:** Creating a Stripe Checkout Session for rent payment
**When to use:** When tenant clicks "Pay Rent"
**Example:**
```typescript
const session = await stripe.checkout.sessions.create({
  payment_method_types: ['card', 'us_bank_account'],
  mode: 'payment',
  line_items: [{
    price_data: {
      currency: 'usd',
      product_data: { name: `Rent - Unit ${unitNumber}` },
      unit_amount: amountCents,  // amount in cents
    },
    quantity: 1,
  }],
  metadata: {
    tenantUserId: userId,
    unitId: unitId,
    billingPeriod: '2026-03',  // YYYY-MM format
  },
  success_url: `${origin}/tenant/payments/success?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${origin}/tenant/dashboard`,
})
```

### Pattern 4: Payments Schema
**What:** Database schema for tracking payments
**Example:**
```typescript
export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantUserId: text("tenant_user_id").notNull(),
  unitId: uuid("unit_id").references(() => units.id, { onDelete: "cascade" }).notNull(),
  amountCents: integer("amount_cents").notNull(),
  stripeSessionId: text("stripe_session_id"),       // null for manual payments
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  paymentMethod: text("payment_method", { enum: ["card", "ach", "cash", "check", "venmo", "other"] }).notNull(),
  status: text("status", { enum: ["pending", "succeeded", "failed"] }).notNull(),
  billingPeriod: text("billing_period").notNull(),   // "2026-03" format
  note: text("note"),                                // for manual payments
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})
```

### Anti-Patterns to Avoid
- **Trusting redirect as payment proof:** NEVER mark payment as succeeded from the success URL redirect. Only webhook events confirm payment.
- **Storing amounts as floats:** Always use integer cents (e.g., 150000 = $1,500.00) to avoid floating-point rounding errors.
- **Skipping webhook signature verification:** Always verify `stripe-signature` header using `constructEvent()`.
- **Parsing req.json() for webhooks:** Use `req.text()` for raw body -- `req.json()` will break signature verification.
- **Blocking webhook responses:** Process async work (emails, DB updates) but always return 200 promptly. Stripe retries on non-2xx.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Payment form / PCI compliance | Custom card input | Stripe Checkout (redirect) | PCI compliance is handled by Stripe |
| Bank account verification | Custom ACH verification | Stripe Financial Connections | Handles instant + microdeposit fallback |
| Webhook signature verification | Manual HMAC | `stripe.webhooks.constructEvent()` | Handles timing-safe comparison, versioning |
| PDF generation | HTML-to-PDF screenshot | `@react-pdf/renderer` | Clean vector PDFs, no browser dependency |
| Idempotent webhook processing | Custom dedup logic | Check `stripeSessionId` uniqueness in DB | Stripe may send same event multiple times |

**Key insight:** Stripe Checkout handles the entire payment UX including PCI compliance, bank verification, and error handling. The application only needs to create sessions and process webhooks.

## Common Pitfalls

### Pitfall 1: ACH Delayed Notification
**What goes wrong:** App marks payment as complete on checkout.session.completed, but ACH payments are not immediately settled.
**Why it happens:** ACH Direct Debit is a "delayed notification" payment method. Unlike cards, funds take ~4 business days to settle.
**How to avoid:** Listen for `checkout.session.async_payment_succeeded` in addition to `checkout.session.completed`. For ACH, `checkout.session.completed` fires with `payment_status: 'unpaid'` initially. The actual payment confirmation comes via `checkout.session.async_payment_succeeded`.
**Warning signs:** Payment shows as "succeeded" immediately for ACH in the UI.

### Pitfall 2: Webhook Idempotency
**What goes wrong:** Duplicate payments recorded in database.
**Why it happens:** Stripe may retry webhook delivery. If DB insert is not idempotent, duplicates occur.
**How to avoid:** Use `stripeSessionId` (or `stripePaymentIntentId`) as a unique constraint or check-before-insert pattern. Wrap in a transaction.
**Warning signs:** Multiple payment records with the same Stripe session ID.

### Pitfall 3: Raw Body Parsing
**What goes wrong:** Webhook signature verification fails with "No signatures found matching the expected signature for payload."
**Why it happens:** Using `req.json()` instead of `req.text()` alters the body and breaks HMAC verification.
**How to avoid:** Always use `await req.text()` in the webhook route handler. Do NOT configure body parsing middleware.
**Warning signs:** All webhooks returning 400 status.

### Pitfall 4: Cents vs Dollars Confusion
**What goes wrong:** Tenant charged $1,500,000 instead of $1,500.
**Why it happens:** Stripe expects amounts in the smallest currency unit (cents for USD). If dollars are passed, amount is 100x too large.
**How to avoid:** Store all amounts in cents in the database (integer column). Convert to dollars only in UI display with `(cents / 100).toFixed(2)`.
**Warning signs:** Payment amounts look 100x too large or too small.

### Pitfall 5: Missing Environment Variables
**What goes wrong:** Build fails or runtime crash.
**Why it happens:** Stripe client validates key format at initialization. Without lazy init, Next.js build fails.
**How to avoid:** Use the same lazy Proxy pattern as existing `db` and `resend` clients. Required env vars: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
**Warning signs:** Build errors mentioning Stripe API key.

## Code Examples

### Creating a Checkout Session (API Route)
```typescript
// src/app/api/payments/create-checkout/route.ts
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { stripe } from '@/lib/stripe'
import { db } from '@/db'
import { units, tenantUnits } from '@/db/schema'
import { eq, and } from 'drizzle-orm'

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { unitId, amountCents } = body

  // Verify tenant is linked to this unit
  const [link] = await db.select()
    .from(tenantUnits)
    .where(and(eq(tenantUnits.userId, session.user.id), eq(tenantUnits.unitId, unitId), eq(tenantUnits.isActive, true)))

  if (!link) {
    return NextResponse.json({ error: 'Not linked to this unit' }, { status: 403 })
  }

  const [unit] = await db.select().from(units).where(eq(units.id, unitId))

  const origin = req.headers.get('origin') || 'http://localhost:3000'

  const checkoutSession = await stripe.checkout.sessions.create({
    payment_method_types: ['card', 'us_bank_account'],
    mode: 'payment',
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: { name: `Rent - Unit ${unit.unitNumber}` },
        unit_amount: amountCents,
      },
      quantity: 1,
    }],
    metadata: {
      tenantUserId: session.user.id,
      unitId: unitId,
      billingPeriod: new Date().toISOString().slice(0, 7), // "2026-03"
    },
    success_url: `${origin}/tenant/payments/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/tenant/dashboard`,
  })

  return NextResponse.json({ url: checkoutSession.url })
}
```

### Webhook Handler with ACH Support
```typescript
// src/app/api/webhooks/stripe/route.ts
import { Stripe } from 'stripe'
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { db } from '@/db'
import { payments } from '@/db/schema'
import { eq } from 'drizzle-orm'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string)

export async function POST(req: Request) {
  let event: Stripe.Event

  try {
    const stripeSignature = (await headers()).get('stripe-signature')
    event = stripe.webhooks.constructEvent(
      await req.text(),
      stripeSignature as string,
      process.env.STRIPE_WEBHOOK_SECRET as string
    )
  } catch (err) {
    return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 })
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.payment_status === 'paid') {
        // Card payment -- immediately confirmed
        await recordPayment(session, 'succeeded')
        await sendConfirmationEmail(session)
      } else if (session.payment_status === 'unpaid') {
        // ACH -- pending verification/settlement
        await recordPayment(session, 'pending')
      }
      break
    }
    case 'checkout.session.async_payment_succeeded': {
      // ACH payment settled
      const session = event.data.object as Stripe.Checkout.Session
      await db.update(payments)
        .set({ status: 'succeeded', paidAt: new Date(), updatedAt: new Date() })
        .where(eq(payments.stripeSessionId, session.id))
      await sendConfirmationEmail(session)
      break
    }
    case 'checkout.session.async_payment_failed': {
      // ACH payment failed
      const session = event.data.object as Stripe.Checkout.Session
      await db.update(payments)
        .set({ status: 'failed', updatedAt: new Date() })
        .where(eq(payments.stripeSessionId, session.id))
      break
    }
  }

  return NextResponse.json({ received: true }, { status: 200 })
}
```

### PDF Receipt Generation
```typescript
// src/lib/pdf/receipt.tsx
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12 },
  header: { fontSize: 20, marginBottom: 20, fontWeight: 'bold' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  label: { color: '#666' },
  value: { fontWeight: 'bold' },
  divider: { borderBottom: '1 solid #eee', marginVertical: 12 },
  footer: { marginTop: 30, fontSize: 10, color: '#999', textAlign: 'center' },
})

interface ReceiptProps {
  paymentId: string
  unitNumber: string
  amount: string
  paymentMethod: string
  date: string
  status: string
}

export function ReceiptDocument({ paymentId, unitNumber, amount, paymentMethod, date, status }: ReceiptProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.header}>Payment Receipt</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Receipt #</Text>
          <Text style={styles.value}>{paymentId}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Unit</Text>
          <Text style={styles.value}>{unitNumber}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Amount</Text>
          <Text style={styles.value}>{amount}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Payment Method</Text>
          <Text style={styles.value}>{paymentMethod}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Date</Text>
          <Text style={styles.value}>{date}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Status</Text>
          <Text style={styles.value}>{status}</Text>
        </View>
        <View style={styles.divider} />
        <Text style={styles.footer}>RentalMgmt - Payment Receipt</Text>
      </Page>
    </Document>
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Stripe Charges API | Stripe Checkout Sessions / Payment Intents | 2019+ | Checkout handles full UX, PCI compliance |
| Manual ACH verification | Financial Connections (automatic) | 2022+ | Instant bank verification, microdeposit fallback |
| stripe-node < v12 (manual API version) | stripe-node v12+ (auto API version per SDK release) | 2024 | SDK pins its own API version |
| Pages Router API routes | App Router route handlers | Next.js 13+ | Use `req.text()` for raw body, `headers()` for header access |

**Deprecated/outdated:**
- Stripe Charges API: Replaced by Payment Intents. Checkout Sessions use Payment Intents internally.
- Manual bank account verification (Plaid integration): Replaced by Stripe Financial Connections built into Checkout.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright (e2e) + Vitest (unit, if added) |
| Config file | none -- Wave 0 installs |
| Quick run command | `npx playwright test --grep @smoke` |
| Full suite command | `npx playwright test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PAY-01 | Tenant pays rent via Stripe Checkout (card) | e2e | `npx playwright test e2e/payments.spec.ts --grep "pay rent"` | -- Wave 0 |
| PAY-02 | Tenant views payment history and downloads receipt | e2e | `npx playwright test e2e/payments.spec.ts --grep "history"` | -- Wave 0 |
| PAY-03 | Tenant dashboard shows balance, due date, last payment | e2e | `npx playwright test e2e/payments.spec.ts --grep "dashboard"` | -- Wave 0 |
| PAY-04 | Admin configures rent amount and due date per unit | e2e | `npx playwright test e2e/admin-payments.spec.ts --grep "configure rent"` | -- Wave 0 |
| PAY-05 | Admin views payment dashboard with paid/unpaid status | e2e | `npx playwright test e2e/admin-payments.spec.ts --grep "dashboard"` | -- Wave 0 |
| NOTIF-02 | Email confirmation after successful payment | manual-only | Check Resend dashboard or test mode logs | N/A |

### Sampling Rate
- **Per task commit:** `npx playwright test --grep @smoke`
- **Per wave merge:** `npx playwright test`
- **Phase gate:** Full suite green before verification

### Wave 0 Gaps
- [ ] Install Playwright as devDependency: `npm install -D @playwright/test`
- [ ] Create `playwright.config.ts` with baseURL `http://localhost:3000`
- [ ] Create `e2e/payments.spec.ts` -- stubs for PAY-01, PAY-02, PAY-03
- [ ] Create `e2e/admin-payments.spec.ts` -- stubs for PAY-04, PAY-05
- [ ] Seed script for test data (unit with rent config, tenant linked to unit)

## Open Questions

1. **Stripe Test Mode for E2E**
   - What we know: Stripe provides test API keys and test card numbers (4242424242424242)
   - What's unclear: Whether Playwright can reliably interact with Stripe's hosted Checkout page (it's a redirect to stripe.com domain)
   - Recommendation: Use Stripe test mode keys. For e2e, verify the redirect URL contains `checkout.stripe.com` but don't try to fill the Stripe form in Playwright. Use Stripe CLI `stripe trigger checkout.session.completed` for webhook testing.

2. **ACH E2E Testing**
   - What we know: ACH requires Financial Connections dialog or microdeposit verification
   - What's unclear: Full end-to-end ACH testing in automated tests
   - Recommendation: Test ACH payment flow manually. Automated tests cover the webhook handler with mock events via Stripe CLI.

## Sources

### Primary (HIGH confidence)
- [Stripe Checkout Quickstart (Next.js)](https://docs.stripe.com/checkout/quickstart?client=next) - Session creation, redirect flow
- [Stripe ACH Direct Debit](https://docs.stripe.com/payments/ach-direct-debit/accept-a-payment) - ACH configuration, webhook events, settlement timeline
- [stripe-node webhook signing example](https://github.com/stripe/stripe-node/blob/master/examples/webhook-signing/nextjs/app/api/webhooks/route.ts) - Official webhook handler pattern
- [@react-pdf/renderer](https://www.npmjs.com/package/@react-pdf/renderer) - v4.x, server-side PDF generation

### Secondary (MEDIUM confidence)
- [Vercel Next.js Stripe examples](https://github.com/vercel/next.js/blob/canary/examples/with-stripe-typescript/README.md) - App Router integration patterns
- [Vercel nextjs-subscription-payments](https://github.com/vercel/nextjs-subscription-payments) - Webhook handler patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official Stripe SDK + documented patterns
- Architecture: HIGH - Follows existing project patterns (lazy proxy, route handlers)
- Pitfalls: HIGH - Well-documented by Stripe and community
- PDF generation: MEDIUM - @react-pdf/renderer works server-side but has known Next.js App Router quirks

**Research date:** 2026-02-26
**Valid until:** 2026-03-26 (Stripe API is stable, patterns well-established)
