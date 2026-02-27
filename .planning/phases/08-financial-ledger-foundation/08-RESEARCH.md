# Phase 8: Financial Ledger Foundation - Research

**Researched:** 2026-02-26
**Domain:** Financial ledger (charges/payments separation), balance computation, Stripe webhook hardening
**Confidence:** HIGH

## Summary

Phase 8 transforms the existing payment-only tracking system into a proper financial ledger where charges (what is owed) are separated from payments (what was paid). Currently, the system only tracks payments via the `payments` table. There is no concept of "charges" -- rent obligations are implicitly derived from unit configuration (`rentAmountCents`, `rentDueDay`). This phase introduces a `charges` table as a first-class ledger entry, computes running balances per tenant, enables admin manual charge/credit posting, backfills historical charge records for existing payments, and hardens the Stripe webhook for idempotent ledger entries.

The existing codebase uses Drizzle ORM with the Neon HTTP driver (`@neondatabase/serverless` via `neon()` function). Phase 7 is a prerequisite that will swap to the WebSocket driver for transaction support. This phase MUST assume Phase 7 is complete and transactions are available via `db.transaction()`.

**Primary recommendation:** Create a `charges` table with types (rent, late_fee, one_time, credit, adjustment), link payments to charges via `chargeId`, compute balances as `SUM(charges) - SUM(succeeded_payments)`, and use Stripe event ID deduplication for webhook idempotency.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| LEDG-01 | Tenant finances tracked via charges table separating what is owed from what was paid | Charges table schema design, charge type enum, relationship to payments table |
| LEDG-02 | Running balance computed per tenant and displayed on tenant dashboard and admin views | Balance computation query (SUM charges - SUM payments), UI integration points identified |
| LEDG-03 | Admin can manually post charges, credits, and adjustments to any tenant's ledger | Admin API route design, charge form UI, validation rules |
| LEDG-04 | Existing historical payment records reconciled with charge records via backfill migration | Backfill migration strategy, one charge per succeeded/pending payment, billing period matching |
| LEDG-05 | Stripe webhook uses strict payment intent ID matching and deduplicates events | Stripe event ID deduplication table or column, payment intent ID-based lookups, idempotency patterns |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | 0.45.1 | ORM for schema definition and queries | Already in use, type-safe schema |
| @neondatabase/serverless | 1.0.2 | Neon PostgreSQL driver (WebSocket after Phase 7) | Transaction support via WebSocket driver |
| stripe | 20.4.0 | Stripe API for payment processing | Already in use for payments and webhooks |
| zod | 4.3.6 | Input validation for API routes | Already used throughout the project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| drizzle-kit | 0.31.9 | Schema migrations | Generating migration SQL for charges table |
| next | 15.5 | App Router API routes and server components | All API and UI work |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Computed balance (query-time) | Materialized balance column | Materialized adds write complexity + staleness risk; computed is simpler and correct for this scale |
| Stripe event ID in separate table | event_id column on payments | Separate table is cleaner for webhook-level dedup across all event types |
| Single-entry ledger | Double-entry accounting | Out of scope per REQUIREMENTS.md; single-entry is sufficient for tenant-landlord billing |

**Installation:**
No new packages needed. All dependencies are already installed.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── db/schema/domain.ts        # Add charges table + stripeEvents table
├── app/api/
│   ├── admin/charges/route.ts  # POST: admin creates charge/credit/adjustment
│   ├── admin/ledger/[tenantId]/route.ts  # GET: tenant ledger for admin view
│   ├── tenant/balance/route.ts # GET: tenant balance query
│   └── webhooks/stripe/route.ts # MODIFIED: add event dedup + charge linking
├── app/(tenant)/tenant/dashboard/page.tsx  # MODIFIED: show running balance
├── app/(admin)/admin/payments/page.tsx     # MODIFIED: show per-tenant balances
└── lib/ledger.ts               # Balance computation helpers
```

### Pattern 1: Charges Table Schema
**What:** A `charges` table recording all financial obligations (rent, fees, credits, adjustments) separate from payments.
**When to use:** Every financial event that creates or modifies what a tenant owes.
**Schema:**
```typescript
export const charges = pgTable("charges", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantUserId: text("tenant_user_id").notNull(),
  unitId: uuid("unit_id").references(() => units.id).notNull(),
  type: text("type", {
    enum: ["rent", "late_fee", "one_time", "credit", "adjustment"],
  }).notNull(),
  description: text("description").notNull(),
  amountCents: integer("amount_cents").notNull(), // positive = charge, negative = credit
  billingPeriod: text("billing_period"),          // "2026-03" for rent, null for one-time
  createdBy: text("created_by"),                  // admin user ID for manual entries, null for system
  createdAt: timestamp("created_at").defaultNow().notNull(),
})
```

### Pattern 2: Stripe Event Deduplication
**What:** Track processed Stripe event IDs to prevent duplicate webhook processing.
**When to use:** Every incoming Stripe webhook event.
**Schema:**
```typescript
export const stripeEvents = pgTable("stripe_events", {
  id: text("id").primaryKey(),           // Stripe event ID (evt_xxx)
  type: text("type").notNull(),          // event type string
  processedAt: timestamp("processed_at").defaultNow().notNull(),
})
```
**Processing pattern:**
```typescript
// Inside webhook handler, wrapped in transaction
await db.transaction(async (tx) => {
  // 1. Check if event already processed
  const [existing] = await tx.select().from(stripeEvents).where(eq(stripeEvents.id, event.id))
  if (existing) return // Already processed, skip

  // 2. Record event
  await tx.insert(stripeEvents).values({ id: event.id, type: event.type })

  // 3. Process event logic...
})
```

### Pattern 3: Balance Computation (Query-Time)
**What:** Compute tenant balance as SUM(charges.amountCents) - SUM(succeeded_payments.amountCents).
**When to use:** Displaying "You owe $X" on tenant dashboard and admin views.
**Query pattern:**
```typescript
// Balance = total charges - total succeeded payments
const [balance] = await db.execute(sql`
  SELECT
    COALESCE((SELECT SUM(amount_cents) FROM charges WHERE tenant_user_id = ${tenantUserId} AND unit_id = ${unitId}), 0)
    -
    COALESCE((SELECT SUM(amount_cents) FROM payments WHERE tenant_user_id = ${tenantUserId} AND unit_id = ${unitId} AND status = 'succeeded'), 0)
    AS balance_cents
`)
```

### Pattern 4: Payment-to-Charge Linking
**What:** Optional `chargeId` FK on payments table to link a payment to the specific charge it covers.
**When to use:** When a payment is made against a specific charge (e.g., paying rent for a specific month).
**Note:** Not strictly required for balance computation (which is aggregate-based), but useful for reconciliation and reporting. For v2.0, the aggregate balance approach is simpler and sufficient. Linking can be added in a future phase if needed.

### Anti-Patterns to Avoid
- **Stored/materialized balance column:** Adds write-time complexity, race conditions, and staleness. At this scale (<100 tenants), query-time computation is fast and always correct.
- **Using checkout session ID for webhook dedup instead of event ID:** Session-level dedup misses duplicate events that Stripe can send for the same session. Event ID is the correct dedup key.
- **Mixing positive/negative amounts without clear convention:** Credits MUST be negative amountCents in charges table. This keeps SUM(charges) - SUM(payments) = balance consistent.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Webhook signature verification | Custom HMAC | `stripe.webhooks.constructEvent()` | Already in use; handles timing attacks |
| Idempotency for Stripe API calls | Custom tracking | Stripe idempotency keys | Already used in autopay-charge cron |
| Migration SQL | Manual SQL strings | `drizzle-kit generate` / `drizzle-kit push` | Type-safe, tracks migration history |
| UUID generation | Custom ID function | `defaultRandom()` in Drizzle schema | Consistent with existing pattern |

**Key insight:** The charges table is a simple append-only log. Don't over-engineer it with double-entry accounting, running total columns, or complex state machines. Append charges, append payments, compute balance at query time.

## Common Pitfalls

### Pitfall 1: Race Condition in Webhook Dedup Without Transactions
**What goes wrong:** Two identical webhook events arrive simultaneously, both check for existing event, both find none, both process.
**Why it happens:** HTTP driver cannot do transactions; check-then-insert is not atomic.
**How to avoid:** Phase 7 provides WebSocket driver with transaction support. Wrap dedup check + event recording + processing in a single `db.transaction()`. Use `INSERT ... ON CONFLICT DO NOTHING` as a secondary safety net.
**Warning signs:** Duplicate payment records, double-charged tenants.

### Pitfall 2: Backfill Migration Creates Orphaned or Duplicate Charges
**What goes wrong:** Running backfill multiple times creates duplicate charge records, or backfill misses some payments.
**Why it happens:** No idempotency in the backfill script.
**How to avoid:** Backfill script should be idempotent -- check if a charge already exists for a given payment before creating. Use a `backfilledFromPaymentId` column or a transaction with count verification.
**Warning signs:** Balance shows double the expected amount after running backfill twice.

### Pitfall 3: Negative Credits Displayed as Negative Amounts to Users
**What goes wrong:** UI shows "$-50.00" instead of "Credit: $50.00" or balance shows negative when tenant has overpaid.
**Why it happens:** Raw amountCents from charges table used without formatting logic.
**How to avoid:** Display logic must handle: positive balance = "You owe $X", zero = "All caught up", negative = "Credit: $X". Credits in charges table have negative amountCents but display as positive with "Credit" label.
**Warning signs:** Confusing negative numbers in tenant-facing UI.

### Pitfall 4: Webhook Uses Session ID Instead of Payment Intent ID for ACH
**What goes wrong:** ACH payments that go through async settlement don't get matched because the lookup uses session ID which may not be present in `payment_intent.succeeded` events.
**Why it happens:** Current webhook matches on `stripeSessionId` for checkout flow but `payment_intent.succeeded` only has the payment intent ID.
**How to avoid:** For ACH settlement events (`payment_intent.succeeded` with `autopay=true`), match using `stripePaymentIntentId`. Ensure all payment records have this field populated.
**Warning signs:** ACH payments stuck in "pending" status after bank settlement.

### Pitfall 5: Balance Computation Includes Failed Payments
**What goes wrong:** Balance calculation subtracts failed payment amounts, showing incorrect lower balance.
**Why it happens:** Query doesn't filter by `status = 'succeeded'`.
**How to avoid:** Always filter payments by `status = 'succeeded'` in balance computation. Pending payments should NOT reduce the balance (they haven't settled yet).
**Warning signs:** Balance drops when payment is initiated but hasn't settled.

## Code Examples

### Charges Table Definition (Drizzle Schema)
```typescript
// Source: Project convention from src/db/schema/domain.ts
export const charges = pgTable("charges", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantUserId: text("tenant_user_id").notNull(),
  unitId: uuid("unit_id")
    .references(() => units.id, { onDelete: "restrict" }) // Phase 7 changes cascades to restrict
    .notNull(),
  type: text("type", {
    enum: ["rent", "late_fee", "one_time", "credit", "adjustment"],
  }).notNull(),
  description: text("description").notNull(),
  amountCents: integer("amount_cents").notNull(),
  billingPeriod: text("billing_period"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})
```

### Stripe Event Dedup Table
```typescript
export const stripeEvents = pgTable("stripe_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  processedAt: timestamp("processed_at").defaultNow().notNull(),
})
```

### Balance Computation Helper
```typescript
// Source: Custom implementation following project patterns
import { db } from "@/db"
import { charges, payments } from "@/db/schema"
import { eq, and, sql } from "drizzle-orm"

export async function getTenantBalance(tenantUserId: string, unitId: string): Promise<number> {
  const [result] = await db.execute(sql`
    SELECT
      COALESCE((SELECT SUM(amount_cents) FROM charges WHERE tenant_user_id = ${tenantUserId} AND unit_id = ${unitId}), 0)
      -
      COALESCE((SELECT SUM(amount_cents) FROM payments WHERE tenant_user_id = ${tenantUserId} AND unit_id = ${unitId} AND status = 'succeeded'), 0)
      AS balance_cents
  `)
  return Number(result?.balance_cents ?? 0)
}
```

### Admin Charge Posting API Route
```typescript
// Source: Convention from src/app/api/payments/manual/route.ts
const chargeSchema = z.object({
  tenantUserId: z.string(),
  unitId: z.string().uuid(),
  type: z.enum(["one_time", "credit", "adjustment"]),
  description: z.string().min(1).max(500),
  amountCents: z.number().int(), // positive for charge, negative for credit
})
```

### Backfill Migration Script Pattern
```typescript
// For each historical payment with status 'succeeded' or 'pending':
// 1. Check if charge already exists for this payment's billing period + tenant + unit
// 2. If not, create a 'rent' charge matching the payment amount
// 3. Link via billing_period (not FK, since one charge covers one period)

const historicalPayments = await db
  .select()
  .from(payments)
  .where(inArray(payments.status, ["succeeded", "pending"]))

for (const payment of historicalPayments) {
  const [existingCharge] = await db
    .select()
    .from(charges)
    .where(
      and(
        eq(charges.tenantUserId, payment.tenantUserId),
        eq(charges.unitId, payment.unitId),
        eq(charges.billingPeriod, payment.billingPeriod),
        eq(charges.type, "rent"),
      )
    )
    .limit(1)

  if (!existingCharge) {
    await db.insert(charges).values({
      tenantUserId: payment.tenantUserId,
      unitId: payment.unitId,
      type: "rent",
      description: `Rent for ${payment.billingPeriod}`,
      amountCents: payment.amountCents,
      billingPeriod: payment.billingPeriod,
      createdBy: null, // system-generated
    })
  }
}
```

### Webhook Dedup Pattern
```typescript
// Inside POST handler for /api/webhooks/stripe
await db.transaction(async (tx) => {
  // Dedup: insert event ID, skip if already exists
  const inserted = await tx
    .insert(stripeEvents)
    .values({ id: event.id, type: event.type })
    .onConflictDoNothing()
    .returning()

  if (inserted.length === 0) {
    // Event already processed
    return
  }

  // Process event...
  switch (event.type) {
    case "payment_intent.succeeded": {
      const pi = event.data.object as Stripe.PaymentIntent
      // Use payment intent ID for strict matching
      await tx
        .update(payments)
        .set({ status: "succeeded", paidAt: new Date(), updatedAt: new Date() })
        .where(eq(payments.stripePaymentIntentId, pi.id))
      break
    }
    // ... other cases
  }
})
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Implicit rent from unit config | Explicit charge records | This phase | Enables late fees, credits, adjustments |
| Session ID webhook dedup | Event ID + transaction dedup | This phase | Prevents all duplicate processing |
| Payment-only tracking | Charges + Payments ledger | This phase | True balance = charges - payments |

**Deprecated/outdated:**
- Neon HTTP driver for webhook handlers: Phase 7 replaces with WebSocket driver for transaction support
- `onDelete: "cascade"` on units FK: Phase 7 changes to `"restrict"` to protect financial history

## Open Questions

1. **Backfill: Should charges match exact payment amounts or unit rent amounts?**
   - What we know: Payments may include processing fees (autopay adds card/ACH fees on top of rent). Charges should represent the obligation amount (rent), not the payment amount (rent + fees).
   - What's unclear: Whether existing payment `amountCents` includes fees or is pure rent.
   - Recommendation: Inspect actual data. For manual payments and checkout payments, amount IS rent (fees are Stripe's concern, not recorded in our DB). For autopay, `amountCents` includes fees. Backfill should use `units.rentAmountCents` for the charge amount when available, falling back to payment amount.

2. **Should pending payments reduce the displayed balance?**
   - What we know: ACH payments are "pending" for 3-5 days. Showing full balance during this time is technically correct but may confuse tenants.
   - Recommendation: Display balance based on succeeded payments only. Show a separate "Pending: $X" indicator if there are pending payments. This is both accurate and clear.

3. **Charge amount sign convention for credits**
   - What we know: Credits reduce what tenant owes. Options: (a) negative amountCents on charge, (b) separate "credit" with positive amount and different treatment.
   - Recommendation: Use negative amountCents for credits and adjustments that reduce balance. SUM(charges) naturally handles this. Type field distinguishes display formatting.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright 1.58.2 |
| Config file | playwright.config.ts |
| Quick run command | `npx playwright test e2e/ledger.spec.ts` |
| Full suite command | `npx playwright test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LEDG-01 | Charges table exists and separates charges from payments | e2e (admin creates charge, verify in DB) | `npx playwright test e2e/ledger.spec.ts -g "charge creation"` | No - Wave 0 |
| LEDG-02 | Running balance displayed on tenant dashboard and admin view | e2e (verify balance text on pages) | `npx playwright test e2e/ledger.spec.ts -g "running balance"` | No - Wave 0 |
| LEDG-03 | Admin can post charges/credits/adjustments | e2e (admin form submission) | `npx playwright test e2e/ledger.spec.ts -g "admin charge"` | No - Wave 0 |
| LEDG-04 | Historical payments reconciled with charges | script validation (run backfill, verify counts) | `tsx scripts/backfill-charges.ts --dry-run` | No - Wave 0 |
| LEDG-05 | Stripe webhook deduplicates events | e2e/integration (send duplicate webhook, verify single record) | `npx playwright test e2e/ledger.spec.ts -g "webhook dedup"` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `npx playwright test e2e/ledger.spec.ts -x`
- **Per wave merge:** `npx playwright test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `e2e/ledger.spec.ts` -- covers LEDG-01, LEDG-02, LEDG-03, LEDG-05
- [ ] `scripts/backfill-charges.ts` -- covers LEDG-04 (with --dry-run validation mode)
- [ ] Seed script updates for test data with charges

## Sources

### Primary (HIGH confidence)
- Project codebase: `src/db/schema/domain.ts` -- existing payments table schema
- Project codebase: `src/app/api/webhooks/stripe/route.ts` -- current webhook handler
- Project codebase: `src/app/(tenant)/tenant/dashboard/page.tsx` -- current tenant dashboard
- Project codebase: `src/app/api/admin/payments-overview/route.ts` -- current admin payment view
- Project codebase: `src/app/api/payments/manual/route.ts` -- manual payment recording pattern
- Project codebase: `src/app/api/cron/autopay-charge/route.ts` -- autopay charging pattern with fees

### Secondary (MEDIUM confidence)
- Drizzle ORM patterns: pgTable, uuid, text, integer, references conventions from existing schema
- Stripe webhook best practices: event ID-based idempotency (standard pattern)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in use, no new dependencies
- Architecture: HIGH - charges table is a standard append-only financial log pattern
- Pitfalls: HIGH - webhook dedup and balance computation are well-understood problems
- Backfill: MEDIUM - exact data distribution not yet inspected (STATE.md notes this)

**Research date:** 2026-02-26
**Valid until:** 2026-03-26 (30 days - stable domain, no fast-moving dependencies)
