# Phase 13: FinTech Polish & Edge Cases - Research

**Researched:** 2026-02-27
**Domain:** Date math, financial ledger, auth cookies, operational workflows, unit testing
**Confidence:** HIGH

## Summary

Phase 13 addresses six specific priorities across two categories: critical fixes to existing financial logic (date math, pending balance visibility, middleware cookie handling) and new operational workflows (work order chargebacks, NSF handling, proration utility). All six items are well-scoped with clear before/after behavior, making them straightforward to implement and test.

The most impactful fix is the `daysSinceRentDue` date boundary bug. The current implementation (`day - rentDueDay`) produces incorrect results when crossing month boundaries (e.g., due 28th, checking on the 2nd yields -26 instead of +4/+5). This affects the late-fee cron job, which skips late fees when `daysSince <= gracePeriodDays` -- a negative result always passes that check, so late fees are never assessed for late-month due dates checked in the following month. The fix requires proper calendar-aware date difference calculation using `Intl.DateTimeFormat` (already the project standard -- no new dependencies).

The pending balance UX fix requires expanding `getTenantBalance` to return pending payment amounts alongside confirmed balance. The middleware cookie fix replaces a hardcoded cookie name with Better Auth's `getSessionCookie()` helper that automatically handles `__Secure-` prefix in production. The three new operational workflows (chargebacks, NSF, proration) integrate into existing schema and patterns.

This phase explicitly requires **unit tests** (not just E2E). The project currently has zero unit tests -- only Playwright E2E specs. A unit test framework (Vitest) must be set up as Wave 0 infrastructure before implementation.

**Primary recommendation:** Set up Vitest first, then implement the six priorities in dependency order: date fix, ledger fix, cookie fix, chargebacks, NSF, proration. Write unit tests alongside each implementation.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vitest | ^3.x | Unit test framework | Native ESM, TypeScript-first, Vite-compatible, standard for Next.js projects |
| Intl.DateTimeFormat | Built-in | Timezone-aware date math | Already used in project (Phase 9 decision), zero dependencies |
| better-auth/cookies | ^1.4.19 | Cookie name resolution | Already installed, `getSessionCookie()` handles `__Secure-` prefix |
| drizzle-orm | ^0.45.1 | Database operations | Already installed, used for all DB operations |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @vitest/coverage-v8 | ^3.x | Code coverage | Optional but recommended for timezone.ts and ledger.ts |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vitest | Jest | Jest requires more config for ESM/TypeScript; Vitest works out of the box with Next.js |
| Intl.DateTimeFormat | date-fns/luxon | Project already decided against external date libraries (Phase 9 decision) |

**Installation:**
```bash
npm install -D vitest @vitest/coverage-v8
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   ├── timezone.ts              # FIX: daysSinceRentDue rewrite
│   ├── timezone.test.ts         # NEW: unit tests
│   ├── ledger.ts                # FIX: add pendingPaymentsCents return
│   ├── ledger.test.ts           # NEW: unit tests (mocked DB)
│   ├── proration.ts             # NEW: calculateProratedRent()
│   └── proration.test.ts        # NEW: unit tests
├── middleware.ts                 # FIX: replace hardcoded cookie name
├── app/api/webhooks/stripe/
│   └── route.ts                 # MODIFY: add NSF fee logic
└── app/api/admin/work-orders/
    └── [id]/costs/route.ts      # MODIFY: add billToTenant toggle
vitest.config.ts                 # NEW: test configuration
```

### Pattern 1: Pure Function Unit Testing (timezone.ts, proration.ts)
**What:** Functions with no DB/external dependencies can be tested directly
**When to use:** `daysSinceRentDue`, `getLocalDate`, `calculateProratedRent`, `calculateLateFee`
**Example:**
```typescript
// src/lib/timezone.test.ts
import { describe, it, expect } from "vitest"
import { daysSinceRentDue, getLocalDate } from "./timezone"

describe("daysSinceRentDue", () => {
  it("handles month boundary: due 28th, current 2nd next month", () => {
    // Must return positive days (4-5 depending on month length)
    // NOT -26
  })
})
```

### Pattern 2: Mocked DB Testing (ledger.ts)
**What:** Functions that call `db.execute()` need DB mocks
**When to use:** `getTenantBalance` with pending amounts
**Example:**
```typescript
// src/lib/ledger.test.ts
import { vi, describe, it, expect } from "vitest"

// Mock the db module
vi.mock("@/db", () => ({
  db: {
    execute: vi.fn(),
  },
}))
```

### Pattern 3: Work Order Chargeback (Ledger Charge from Cost)
**What:** When `billToTenant` is toggled on a work order cost, auto-post a charge to the tenant's ledger
**When to use:** Work order cost creation/update
**Key data chain:** `workOrderCost -> workOrder -> maintenanceRequest -> tenantUnit -> (tenantUserId, unitId)` -- this traversal is needed to resolve the tenant and unit for the ledger charge.
**Example:**
```typescript
// In work order costs POST handler, after inserting cost:
if (billToTenant) {
  // Resolve tenant from maintenance request -> tenantUnits chain
  const [maintReq] = await tx.select({
    tenantUserId: maintenanceRequests.tenantUserId,
    unitId: maintenanceRequests.unitId,
  })
  .from(maintenanceRequests)
  .innerJoin(workOrders, eq(workOrders.maintenanceRequestId, maintenanceRequests.id))
  .where(eq(workOrders.id, workOrderId))

  await tx.insert(charges).values({
    tenantUserId: maintReq.tenantUserId,
    unitId: maintReq.unitId,
    type: "one_time",
    description: `Work order cost: ${description}`,
    amountCents,
    createdBy: session.user.id,
  })
}
```

### Pattern 4: NSF Fee in Webhook (payment_intent.payment_failed)
**What:** When ACH payment fails, optionally post NSF fee to tenant ledger
**When to use:** `payment_intent.payment_failed` webhook handler (already exists, line 176)
**Key decision:** NSF fees should be configurable. Options: (a) simple env var `NSF_FEE_CENTS`, (b) per-property config in `lateFeeRules`, (c) new `nsfFeeRules` table. Recommend (a) for simplicity -- NSF fees are typically fixed by state law ($25-$50 range).
**Example:**
```typescript
case "payment_intent.payment_failed": {
  const paymentIntent = event.data.object as Stripe.PaymentIntent
  const { autopay, tenantUserId, unitId, billingPeriod } = paymentIntent.metadata || {}

  // Update payment status (existing logic)
  await tx.update(payments)
    .set({ status: "failed", updatedAt: new Date() })
    .where(...)

  // Post NSF fee if configured
  const nsfFeeCents = parseInt(process.env.NSF_FEE_CENTS || "0", 10)
  if (nsfFeeCents > 0 && tenantUserId && unitId) {
    await tx.insert(charges).values({
      tenantUserId,
      unitId,
      type: "one_time",
      description: `NSF fee - returned payment for ${billingPeriod}`,
      amountCents: nsfFeeCents,
      billingPeriod: billingPeriod || null,
      createdBy: null, // system-generated
    })
  }
  break
}
```

### Anti-Patterns to Avoid
- **Floating-point dollar math:** Always use integer cents for all calculations. The `calculateProratedRent` function must return integer cents, using `Math.round()` at the final step.
- **UTC date assumption:** Never use `new Date().getDate()` for rent due date comparisons. Always use `getLocalDate(timezone)` (project decision from Phase 9).
- **Testing date functions with live clock:** Always test date-dependent functions with known fixed dates. The `daysSinceRentDue` rewrite should accept an optional `referenceDate` parameter for testability, or test via timezone mock.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cookie name with `__Secure-` prefix | Manual prefix detection | `getSessionCookie()` from `better-auth/cookies` | Handles both prefixed and unprefixed cookies, dot vs dash separators |
| Date difference across months | Simple subtraction | Proper date diff using `Date` constructor with year/month/day | Month lengths vary (28-31), must account for Feb, leap years |
| Unit test framework setup | Custom test runner | Vitest with `vitest.config.ts` | Works with path aliases, TypeScript, ESM out of the box |

**Key insight:** The current `daysSinceRentDue` bug exists precisely because month-boundary date math was hand-rolled with simple subtraction instead of proper calendar arithmetic.

## Common Pitfalls

### Pitfall 1: daysSinceRentDue Month Boundary
**What goes wrong:** `day - rentDueDay` returns -26 when due day is 28 and current day is 2 (next month). The late fee cron checks `daysSince <= gracePeriodDays` and skips assessment since -26 <= 5.
**Why it happens:** Simple subtraction assumes same month.
**How to avoid:** Calculate actual date of last due date occurrence (could be current month or previous month), then compute difference from current date. Algorithm:
1. Get local date (year, month, day) using `getLocalDate(timezone)`
2. Construct the due date for current month: `new Date(year, month-1, rentDueDay)`
3. If current day < rentDueDay, the relevant due date was last month: `new Date(year, month-2, rentDueDay)`
4. Calculate difference in days between current date and due date
**Warning signs:** Late fees not being assessed for tenants with due dates 20-28 when cron runs on days 1-7 of next month.

### Pitfall 2: Pending Payment Double-Counting
**What goes wrong:** If `getTenantBalance` subtracts pending payments from balance, the tenant sees a lower balance than what's actually confirmed. If the pending payment fails, the balance was misleading.
**Why it happens:** Treating pending payments as confirmed.
**How to avoid:** Return `pendingPaymentsCents` as a SEPARATE field. Display it as informational ("$X.XX payment processing") but do NOT subtract it from the confirmed balance. The `BalanceCard` already has a `hasPendingPayments` boolean -- enhance it to show the actual amount.
**Warning signs:** Tenant sees $0 balance, payment fails, balance suddenly jumps to full rent amount.

### Pitfall 3: Cookie Name in Production vs Development
**What goes wrong:** Middleware checks for `"better-auth.session_token"` but production uses `"__Secure-better-auth.session_token"`. Tenant route middleware fails to find the cookie and redirects to login.
**Why it happens:** Better Auth auto-prefixes cookies with `__Secure-` when `baseURL` starts with `https://` or in production environment.
**How to avoid:** Use `getSessionCookie(request)` from `better-auth/cookies` which checks both prefixed and unprefixed names.
**Warning signs:** Tenant pages redirect to login in production but work in development.

### Pitfall 4: Proration Edge Cases
**What goes wrong:** Proration calculation breaks for February (28/29 days), months with 30 vs 31 days, or when move-in/move-out is on the 1st or last day.
**Why it happens:** Using 30 as fixed month length.
**How to avoid:** Use actual days in the specific month: `new Date(year, month, 0).getDate()`. Handle edge cases: move-in on 1st = full month, move-out on last day = full month.
**Warning signs:** Prorated amounts differ from expected for February and 31-day months.

### Pitfall 5: NSF Fee Without Tenant Metadata
**What goes wrong:** `payment_intent.payment_failed` fires but `tenantUserId`/`unitId` metadata is missing, so NSF fee cannot be posted.
**Why it happens:** Only autopay payments carry metadata currently. One-time checkout session failures use different event (`checkout.session.async_payment_failed`).
**How to avoid:** Only post NSF fee when metadata is present. Add NSF logic to BOTH `payment_intent.payment_failed` (autopay) AND `checkout.session.async_payment_failed` (one-time ACH) handlers.
**Warning signs:** NSF fees only posted for autopay failures, not one-time ACH failures.

### Pitfall 6: Work Order Chargeback Tenant Resolution
**What goes wrong:** Attempting to bill a tenant for a work order cost, but the maintenance request's tenant has moved out (no active tenancy).
**Why it happens:** Maintenance requests preserve `tenantUserId` even after move-out.
**How to avoid:** Use `maintenanceRequests.tenantUserId` directly (not the active tenancy lookup). The charge should be posted to the original tenant who filed the request, regardless of current tenancy status.
**Warning signs:** Chargeback fails for resolved maintenance requests where tenant has moved out.

## Code Examples

### daysSinceRentDue Rewrite
```typescript
/**
 * Calculate days elapsed since rent was due.
 * Returns 0 on due day, positive after, negative before.
 * Handles month boundaries correctly (e.g., due 28th, current 2nd = +4/+5).
 */
export function daysSinceRentDue(rentDueDay: number, timezone: string): number {
  const { year, month, day } = getLocalDate(timezone)

  // Determine the most recent due date occurrence
  let dueYear = year
  let dueMonth = month

  if (day < rentDueDay) {
    // Due date hasn't occurred this month yet -- use last month's due date
    dueMonth -= 1
    if (dueMonth < 1) {
      dueMonth = 12
      dueYear -= 1
    }
  }

  // Clamp due day to actual days in the due month
  const daysInDueMonth = new Date(dueYear, dueMonth, 0).getDate()
  const clampedDueDay = Math.min(rentDueDay, daysInDueMonth)

  // Calculate difference in milliseconds, convert to days
  const currentDate = new Date(year, month - 1, day)
  const dueDate = new Date(dueYear, dueMonth - 1, clampedDueDay)
  const diffMs = currentDate.getTime() - dueDate.getTime()

  return Math.round(diffMs / (1000 * 60 * 60 * 24))
}
```

### getTenantBalance with Pending Payments
```typescript
export interface TenantBalanceResult {
  balanceCents: number            // confirmed balance (charges - succeeded payments)
  pendingPaymentsCents: number    // sum of pending payment amounts
}

export async function getTenantBalance(
  tenantUserId: string,
  unitId: string
): Promise<TenantBalanceResult> {
  const result = await db.execute(sql`
    SELECT
      COALESCE(
        (SELECT SUM(amount_cents) FROM charges
         WHERE tenant_user_id = ${tenantUserId} AND unit_id = ${unitId}),
        0
      )
      -
      COALESCE(
        (SELECT SUM(amount_cents) FROM payments
         WHERE tenant_user_id = ${tenantUserId} AND unit_id = ${unitId}
         AND status = 'succeeded'),
        0
      )
      AS balance_cents,
      COALESCE(
        (SELECT SUM(amount_cents) FROM payments
         WHERE tenant_user_id = ${tenantUserId} AND unit_id = ${unitId}
         AND status = 'pending'),
        0
      )
      AS pending_payments_cents
  `)
  const row = result.rows[0] as {
    balance_cents: string
    pending_payments_cents: string
  } | undefined

  return {
    balanceCents: Number(row?.balance_cents ?? 0),
    pendingPaymentsCents: Number(row?.pending_payments_cents ?? 0),
  }
}
```

### Middleware Cookie Fix
```typescript
import { getSessionCookie } from "better-auth/cookies"

// In middleware, replace:
// const sessionCookie = request.cookies.get("better-auth.session_token")
// With:
const sessionToken = getSessionCookie(request)
if (!sessionToken) {
  // redirect to login
}
```

### calculateProratedRent
```typescript
/**
 * Calculate prorated rent based on actual days in the month.
 * @param monthlyRentCents - Full month's rent in cents
 * @param moveDate - Move-in or move-out date
 * @param type - "move_in" (charges remaining days) or "move_out" (charges elapsed days)
 * @returns Prorated amount in cents (integer)
 */
export function calculateProratedRent(
  monthlyRentCents: number,
  moveDate: Date,
  type: "move_in" | "move_out"
): number {
  const year = moveDate.getFullYear()
  const month = moveDate.getMonth() // 0-indexed
  const day = moveDate.getDate()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  if (type === "move_in") {
    // Charge for remaining days including move-in day
    const remainingDays = daysInMonth - day + 1
    return Math.round((monthlyRentCents * remainingDays) / daysInMonth)
  } else {
    // Charge for elapsed days including move-out day
    return Math.round((monthlyRentCents * day) / daysInMonth)
  }
}
```

### Vitest Configuration
```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Simple `day - rentDueDay` | Calendar-aware date difference | This phase | Fixes late fee assessment for late-month due dates |
| Balance as single number | Balance + pending payments | This phase | Tenant sees processing payments separately |
| Hardcoded cookie name | `getSessionCookie()` helper | Better Auth 1.x | Works in both dev and production environments |

**Deprecated/outdated:**
- `daysSinceRentDue` current implementation: Returns incorrect negative values across month boundaries. Must be replaced.

## Open Questions

1. **NSF Fee Configuration Approach**
   - What we know: NSF fees are typically $25-$50, set by state law. The project has per-property `lateFeeRules` but no NSF-specific config.
   - What's unclear: Should NSF fees be per-property (like late fees) or global?
   - Recommendation: Use environment variable `NSF_FEE_CENTS` for simplicity. A global default is sufficient for a single-landlord app. If per-property is needed later, add an `nsfFeeCents` column to `lateFeeRules`.

2. **Chargeback Charge Type**
   - What we know: Current charge types are `rent`, `late_fee`, `one_time`, `credit`, `adjustment`.
   - What's unclear: Should work order chargebacks use `one_time` or a new `work_order` type?
   - Recommendation: Use `one_time` with a descriptive description field (e.g., "Work order cost: Plumbing repair"). Adding a new enum value requires a schema migration and all code paths that switch on charge type would need updating. Not worth it for this feature.

3. **Proration Integration Point**
   - What we know: Move-out dialog (`MoveOutDialog.tsx`) already supports "Final Charges" with manual amounts. Proration could pre-populate a charge.
   - What's unclear: Should proration be automatic or a convenience button that suggests an amount?
   - Recommendation: Add a "Calculate Prorated Rent" button in the move-out dialog that pre-fills a final charge with the calculated amount. Admin can review and adjust before confirming. This matches the existing UI pattern.

4. **`daysSinceRentDue` Forward-Looking Behavior**
   - What we know: Current function returns negative values before rent is due. The rewrite changes behavior for the `day < rentDueDay` case.
   - What's unclear: Should the function return negative values (days until due) or should it look at the previous month's due date?
   - Recommendation: When `day < rentDueDay`, calculate days since LAST month's due date (positive value). This correctly reflects that rent is overdue from last month. The late fee cron depends on this being positive when rent is late. For "days until next due" add a separate function if needed.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.x (to be installed) |
| Config file | `vitest.config.ts` (Wave 0) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run --coverage` |
| E2E command | `npx playwright test` |

### Phase Requirements to Test Map
| Priority | Behavior | Test Type | Automated Command | File Exists? |
|----------|----------|-----------|-------------------|-------------|
| P1-1 | daysSinceRentDue month boundary fix | unit | `npx vitest run src/lib/timezone.test.ts` | Wave 0 |
| P1-1 | daysSinceRentDue same-month behavior preserved | unit | `npx vitest run src/lib/timezone.test.ts` | Wave 0 |
| P1-1 | daysSinceRentDue February edge case | unit | `npx vitest run src/lib/timezone.test.ts` | Wave 0 |
| P1-2 | getTenantBalance returns pendingPaymentsCents | unit | `npx vitest run src/lib/ledger.test.ts` | Wave 0 |
| P1-2 | BalanceCard shows pending amount | e2e | `npx playwright test e2e/dashboard.spec.ts` | Modify existing |
| P1-3 | Middleware uses getSessionCookie | unit | `npx vitest run src/middleware.test.ts` | Wave 0 |
| P2-1 | Work order chargeback posts charge | e2e | `npx playwright test e2e/work-orders.spec.ts` | Modify existing |
| P2-2 | NSF fee posted on payment failure | unit | `npx vitest run src/app/api/webhooks/stripe/route.test.ts` | Wave 0 |
| P2-3 | Prorated rent calculation | unit | `npx vitest run src/lib/proration.test.ts` | Wave 0 |
| P2-3 | Prorated rent integrated in move-out UI | e2e | `npx playwright test e2e/portfolio-management.spec.ts` | Modify existing |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run --coverage && npx playwright test`
- **Phase gate:** Full suite green before verification

### Wave 0 Gaps
- [ ] `vitest.config.ts` -- Vitest configuration with path aliases
- [ ] `src/lib/timezone.test.ts` -- covers P1-1 daysSinceRentDue rewrite
- [ ] `src/lib/ledger.test.ts` -- covers P1-2 pending balance
- [ ] `src/lib/proration.test.ts` -- covers P2-3 proration utility
- [ ] `package.json` "test" script -- `vitest run`
- [ ] Install: `npm install -D vitest @vitest/coverage-v8`

## Sources

### Primary (HIGH confidence)
- Project source code -- `src/lib/timezone.ts`, `src/lib/ledger.ts`, `src/middleware.ts` (direct inspection)
- Project source code -- `src/app/api/webhooks/stripe/route.ts` (webhook handler, lines 176-193)
- Project source code -- `src/db/schema/domain.ts` (charges, workOrderCosts tables)
- Project source code -- `src/components/tenant/BalanceCard.tsx` (current pending display)
- Better Auth source -- `node_modules/better-auth/dist/cookies/index.mjs` (getSessionCookie implementation, lines 166-175)
- Better Auth types -- `node_modules/better-auth/dist/cookies/index.d.mts` (getSessionCookie signature, lines 101-105)

### Secondary (MEDIUM confidence)
- Better Auth cookie prefix logic -- `node_modules/better-auth/dist/cookies/index.mjs` line 17: `__Secure-` prefix applied when `baseURL` starts with `https://` or `isProduction`
- MDN Intl.DateTimeFormat -- used for timezone conversion (project standard from Phase 9)

### Tertiary (LOW confidence)
- None -- all findings verified from source code

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new libraries needed except Vitest (well-established)
- Architecture: HIGH - All patterns build on existing codebase patterns (charges, webhooks, middleware)
- Pitfalls: HIGH - Date boundary bug reproduced by reading source; cookie issue verified from Better Auth source
- Code examples: HIGH - All based on actual project source code and Better Auth internals

**Research date:** 2026-02-27
**Valid until:** 2026-03-27 (stable domain, no fast-moving dependencies)
