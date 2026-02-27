# Phase 9: Automated Operations - Research

**Researched:** 2026-02-26
**Domain:** Late fee automation, timezone-aware scheduling, tenant notifications
**Confidence:** HIGH

## Summary

Phase 9 builds the automated operations layer: late fee assessment, configurable fee rules, timezone-aware scheduling, and late fee notifications. The existing codebase has a mature cron-based scheduling pattern (rent-reminders, autopay-notify, autopay-charge) using CRON_SECRET-protected API routes, a unified `sendNotification` dispatch system with in-app/email/SMS channels, and Drizzle ORM for data access. Phase 8 introduces the charges table (ledger) which Phase 9 depends on for posting late fee charges.

The main technical challenges are: (1) adding a `timezone` column to the properties table so all date/time logic uses property-local time, (2) creating a `late_fee_rules` table per-property with grace period, fee type (flat/percentage), and amount, (3) building a cron endpoint that evaluates which tenants are past grace period and posts late fee charges to the ledger, and (4) sending multi-channel notifications when fees are posted.

**Primary recommendation:** Follow the existing cron API route pattern. Add a new `/api/cron/late-fees` endpoint that runs daily, checks each property's timezone to determine whether the grace period has elapsed in local time, posts charges to the ledger (Phase 8's charges table), and triggers notifications via the existing `sendNotification` system.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| LATE-01 | System automatically posts a late fee charge to the tenant ledger when rent is unpaid after a configurable grace period | Cron endpoint pattern, charges table from Phase 8, late_fee_rules config table |
| LATE-02 | Admin can configure late fee rules per property (grace period days, flat or percentage fee, fee amount) | New late_fee_rules table, admin settings UI, server action for CRUD |
| LATE-03 | Tenant receives notification (email/SMS/in-app) when a late fee is posted to their account | Existing sendNotification system, new LateFeeEmail template |
| INFRA-03 | Rent reminders, late fee calculations, and autopay scheduling use property-local timezone instead of UTC | Property timezone column, Intl.DateTimeFormat for TZ-aware date math |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js App Router | 15.5 | API route handlers for cron endpoints | Already in use for all cron jobs |
| Drizzle ORM | 0.45.1 | Schema definition, queries, migrations | Already in use throughout |
| @neondatabase/serverless | 1.0.2 | PostgreSQL driver (HTTP, WebSocket after Phase 7) | Already configured |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Intl.DateTimeFormat | Built-in (Node 18+) | Timezone-aware date formatting and calculation | All timezone conversions — no external library needed |
| date-fns (or luxon) | N/A | NOT needed | Built-in Intl API handles TZ math; avoid adding dependencies |
| Resend | 6.9.2 | Email delivery for late fee notifications | Already configured and used |
| Twilio | 5.12.2 | SMS delivery for late fee notifications | Already configured and used |
| @react-email/components | 1.0.8 | Email template rendering | Already used for rent reminder and autopay emails |
| zod | 4.3.6 | Input validation for admin late fee rule config | Already in use for form validation |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Built-in Intl API | date-fns-tz / luxon | Intl is zero-dependency, handles IANA timezones natively; external libs add bundle size for no gain |
| Cron API route | Vercel Cron Functions | Project already uses cron API routes with CRON_SECRET; consistency matters more than vendor features |
| Per-property config table | JSON column on properties | Separate table is cleaner, supports future expansion, avoids JSON query complexity |

**Installation:**
```bash
# No new packages needed — all dependencies already installed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/api/cron/late-fees/route.ts      # Daily late fee assessment cron
├── app/(admin)/admin/properties/[id]/late-fees/page.tsx  # Admin config UI
├── app/api/admin/late-fee-rules/route.ts  # Admin API for late fee rule CRUD
├── db/schema/domain.ts                    # Add lateFeeRules table + timezone column on properties
├── lib/timezone.ts                        # Timezone utility functions
├── lib/late-fees.ts                       # Late fee calculation logic (pure functions)
├── emails/LateFeeEmail.tsx                # Late fee notification email template
```

### Pattern 1: Cron Endpoint with CRON_SECRET Auth
**What:** API route protected by bearer token, triggered by system crontab
**When to use:** All scheduled operations (rent reminders, autopay, late fees)
**Example:**
```typescript
// Source: existing codebase — src/app/api/cron/rent-reminders/route.ts
export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  // ... processing logic
  return NextResponse.json({ assessed: count, skipped, errors })
}
```

### Pattern 2: Timezone-Aware Date Calculation
**What:** Using Intl.DateTimeFormat to determine "today" in a property's local timezone
**When to use:** Any date comparison that must respect property-local time
**Example:**
```typescript
// Get "today" in a specific timezone
function getLocalDate(timezone: string): { year: number; month: number; day: number } {
  const now = new Date()
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now)

  return {
    year: Number(parts.find(p => p.type === "year")!.value),
    month: Number(parts.find(p => p.type === "month")!.value),
    day: Number(parts.find(p => p.type === "day")!.value),
  }
}

// Calculate days since rent was due in property-local timezone
function daysSinceDue(rentDueDay: number, timezone: string): number {
  const local = getLocalDate(timezone)
  return local.day - rentDueDay  // Simplified — handle month boundary
}
```

### Pattern 3: Late Fee Calculation (Pure Function)
**What:** Compute late fee amount based on rule configuration
**When to use:** When assessing late fees
**Example:**
```typescript
interface LateFeeRule {
  feeType: "flat" | "percentage"
  feeAmountCents: number       // flat fee in cents, OR percentage basis points (e.g., 500 = 5%)
  gracePeriodDays: number
  maxFeeAmountCents?: number   // cap for percentage-based fees
}

function calculateLateFee(rentAmountCents: number, rule: LateFeeRule): number {
  if (rule.feeType === "flat") {
    return rule.feeAmountCents
  }
  // Percentage: feeAmountCents stores basis points (500 = 5%)
  const fee = Math.round(rentAmountCents * rule.feeAmountCents / 10000)
  return rule.maxFeeAmountCents ? Math.min(fee, rule.maxFeeAmountCents) : fee
}
```

### Pattern 4: Idempotent Charge Posting
**What:** Ensure the same late fee is never posted twice for the same billing period
**When to use:** Every cron run — cron may run multiple times per day
**Example:**
```typescript
// Check if late fee already posted for this tenant + period
const [existing] = await db
  .select({ id: charges.id })
  .from(charges)
  .where(
    and(
      eq(charges.tenantUserId, tenantUserId),
      eq(charges.unitId, unitId),
      eq(charges.billingPeriod, currentPeriod),
      eq(charges.type, "late_fee")
    )
  )
  .limit(1)

if (existing) continue  // Already assessed
```

### Anti-Patterns to Avoid
- **UTC-based date comparison:** Never use `new Date().getDate()` for timezone-sensitive logic; always convert to property-local time first
- **Missing idempotency:** Cron jobs MUST be safe to run multiple times without double-posting charges
- **Hardcoded fee rules:** All fee parameters must come from per-property configuration, never hardcoded
- **Blocking notifications:** Notification dispatch (email/SMS) should never block the cron response; use fire-and-forget pattern
- **Enabling late fees by default:** Late fees MUST default to OFF (disabled) until admin explicitly enables per property

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Timezone conversion | Custom UTC offset math | Built-in `Intl.DateTimeFormat` with `timeZone` option | DST transitions, leap seconds, IANA database updates |
| Multi-channel notification | Per-channel dispatch logic | Existing `sendNotification()` from `src/lib/notifications.ts` | Already handles in-app, email, SMS with opt-in checks |
| Email templates | Raw HTML strings | `@react-email/components` with render function | Already used for RentReminderEmail, AutopayChargeEmail |
| Cron authentication | Custom auth middleware | Existing CRON_SECRET bearer token pattern | All 3 existing cron routes use this identical pattern |
| Form validation | Manual field checks | `zod` schemas with `react-hook-form` | Already used throughout admin forms |

**Key insight:** This phase adds a new cron endpoint and admin config UI — the infrastructure for both patterns already exists. The primary new work is the database schema (late_fee_rules table, timezone column) and the business logic (fee calculation, grace period evaluation).

## Common Pitfalls

### Pitfall 1: Timezone Edge Cases at Month Boundaries
**What goes wrong:** When rent is due on the 1st and the cron runs at 11 PM UTC on Dec 31, UTC thinks it's already January 1st but the property (in US Pacific) is still on December 31. The system would incorrectly start counting grace period days.
**Why it happens:** Using UTC `new Date()` instead of property-local time.
**How to avoid:** Always convert to property-local timezone before any date comparison. The `getLocalDate(timezone)` utility handles this.
**Warning signs:** Tenants in western US timezones getting late fees a day early.

### Pitfall 2: Double Late Fee Assessment
**What goes wrong:** The cron runs twice in one day (retry, server restart, etc.) and posts duplicate late fee charges.
**Why it happens:** Missing idempotency check before posting charge.
**How to avoid:** Always check for existing late_fee charge for the same tenant + unit + billing period before inserting.
**Warning signs:** Tenants see two identical late fee charges on their ledger.

### Pitfall 3: Late Fees Enabled by Default
**What goes wrong:** A new property is created and tenants immediately start getting late fees because the feature is on by default.
**Why it happens:** Default value of `enabled` column is `true` instead of `false`.
**How to avoid:** The `lateFeeRules.enabled` column MUST default to `false`. Admin must explicitly enable.
**Warning signs:** Complaints from tenants before admin has configured any fee rules.

### Pitfall 4: Percentage Fee Without Cap
**What goes wrong:** A percentage-based late fee on a high-rent unit produces an unreasonably large fee.
**Why it happens:** No maximum fee amount configured.
**How to avoid:** Include optional `maxFeeAmountCents` field in late_fee_rules. UI should recommend setting a cap for percentage fees.
**Warning signs:** Late fee amounts exceeding the rent amount itself.

### Pitfall 5: Missing Notification After Fee Posting
**What goes wrong:** Late fee is posted to ledger but tenant is never notified.
**Why it happens:** Notification call placed inside a try/catch that silently swallows errors, or notification is conditional on a flag that's not set.
**How to avoid:** Notification dispatch should be a mandatory step after every successful charge insertion. Log errors but always attempt.
**Warning signs:** Tenants discover late fees only when checking their balance.

### Pitfall 6: Rent Already Paid But Payment Still Pending
**What goes wrong:** A tenant paid via ACH on the due date, but the payment is still "pending" (3-5 day settlement). The system sees no "succeeded" payment and posts a late fee.
**Why it happens:** Only checking for `status: "succeeded"` payments, ignoring `status: "pending"` ones.
**How to avoid:** When checking if rent is paid, also count `pending` payments as "paid" to avoid false late fees.
**Warning signs:** Tenants who paid via ACH getting late fees while their payment is settling.

## Code Examples

### Schema: Late Fee Rules Table
```typescript
// Add to src/db/schema/domain.ts
export const lateFeeRules = pgTable("late_fee_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id")
    .references(() => properties.id, { onDelete: "cascade" })
    .notNull()
    .unique(),  // one rule per property
  enabled: boolean("enabled").default(false).notNull(),  // DEFAULT OFF
  gracePeriodDays: integer("grace_period_days").notNull().default(5),
  feeType: text("fee_type", { enum: ["flat", "percentage"] }).notNull().default("flat"),
  feeAmountCents: integer("fee_amount_cents").notNull().default(5000),  // $50 flat or 500 = 5%
  maxFeeAmountCents: integer("max_fee_amount_cents"),  // optional cap for percentage
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})
```

### Schema: Timezone on Properties
```typescript
// Add timezone column to properties table
// IANA timezone string, e.g., "America/New_York"
// Default to "America/New_York" for existing properties
export const properties = pgTable("properties", {
  // ... existing columns ...
  timezone: text("timezone").notNull().default("America/New_York"),
})
```

### Timezone Utility
```typescript
// src/lib/timezone.ts
export function getLocalDate(timezone: string): { year: number; month: number; day: number } {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
  const parts = formatter.formatToParts(now)
  return {
    year: Number(parts.find(p => p.type === "year")!.value),
    month: Number(parts.find(p => p.type === "month")!.value),
    day: Number(parts.find(p => p.type === "day")!.value),
  }
}

export function getLocalBillingPeriod(timezone: string): string {
  const local = getLocalDate(timezone)
  return `${local.year}-${String(local.month).padStart(2, "0")}`
}

/**
 * Calculate the number of days since rent was due, in property-local time.
 * Returns negative if rent is not yet due, 0 on due day, positive after.
 */
export function daysSinceRentDue(rentDueDay: number, timezone: string): number {
  const local = getLocalDate(timezone)
  // Simple case: same month
  if (local.day >= rentDueDay) {
    return local.day - rentDueDay
  }
  // Rent is due later this month — not yet due
  return local.day - rentDueDay  // negative
}

// IANA timezone values for US properties (dropdown options)
export const US_TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HT)" },
]
```

### Late Fee Cron Endpoint
```typescript
// src/app/api/cron/late-fees/route.ts
export async function POST(req: Request) {
  // 1. Validate CRON_SECRET
  // 2. Query all properties with late fees enabled (JOIN lateFeeRules)
  // 3. For each property:
  //    a. Get local date using property timezone
  //    b. Get all active tenants with unpaid rent for current period
  //    c. Check if days since due > grace period
  //    d. Check if late fee already posted (idempotency)
  //    e. Check if payment is pending (ACH settlement — don't assess)
  //    f. Post late fee charge to ledger
  //    g. Send notification via sendNotification()
  // 4. Return summary { assessed, skipped, errors }
}
```

### Late Fee Email Template
```typescript
// src/emails/LateFeeEmail.tsx
import { Html, Head, Body, Container, Text, Section, Hr } from "@react-email/components"

interface LateFeeEmailProps {
  tenantName: string
  unitNumber: string
  feeAmount: string
  rentAmount: string
  billingPeriod: string
  gracePeriodDays: number
}

export function LateFeeEmail({ ... }: LateFeeEmailProps) {
  return (
    <Html>
      <Head />
      <Body>
        <Container>
          <Text>Hi {tenantName},</Text>
          <Text>
            A late fee of {feeAmount} has been posted to your account for Unit {unitNumber}.
            Your rent of {rentAmount} for {billingPeriod} was not received within the
            {gracePeriodDays}-day grace period.
          </Text>
          <Text>Please log in to your portal to view your updated balance and make a payment.</Text>
        </Container>
      </Body>
    </Html>
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| moment-timezone for TZ math | Built-in Intl.DateTimeFormat | Node 13+ (2019) | Zero-dependency timezone handling |
| Cron job libraries (node-cron, bull) | System crontab + API route | Project convention | Simpler deployment, no Redis needed |
| UTC-only timestamps | Property-local timezone | This phase | Correct late fee assessment timing |

**Deprecated/outdated:**
- moment.js / moment-timezone: Deprecated, use Intl API or date-fns
- node-cron: Unnecessary complexity for this use case; system crontab is simpler

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright 1.58.2 |
| Config file | playwright.config.ts |
| Quick run command | `npx playwright test --grep "late-fee"` |
| Full suite command | `npx playwright test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LATE-01 | Late fee auto-posted after grace period | integration (cron endpoint) | `npx playwright test tests/late-fee-cron.spec.ts` | Wave 0 |
| LATE-02 | Admin configures late fee rules per property | e2e (admin UI) | `npx playwright test tests/late-fee-admin.spec.ts` | Wave 0 |
| LATE-03 | Tenant notified when late fee posted | integration (notification check) | `npx playwright test tests/late-fee-notification.spec.ts` | Wave 0 |
| INFRA-03 | Timezone-aware date calculations | unit (pure functions) | `npx playwright test tests/timezone-utils.spec.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx playwright test --grep "late-fee" --reporter=line`
- **Per wave merge:** `npx playwright test`
- **Phase gate:** Full suite green before verification

### Wave 0 Gaps
- [ ] `tests/late-fee-cron.spec.ts` -- covers LATE-01 (cron endpoint integration test)
- [ ] `tests/late-fee-admin.spec.ts` -- covers LATE-02 (admin config UI e2e test)
- [ ] `tests/late-fee-notification.spec.ts` -- covers LATE-03 (notification dispatch test)
- [ ] `tests/timezone-utils.spec.ts` -- covers INFRA-03 (timezone utility unit tests)

## Open Questions

1. **Phase 8 charges table schema**
   - What we know: Phase 8 will create a charges table separating what is owed from what was paid
   - What's unclear: Exact column names, type enum values, billing period format
   - Recommendation: Plans should reference charges table generically; exact column names will be known after Phase 8 planning. The late fee cron will insert a charge with `type: "late_fee"`.

2. **Legal maximum late fees by jurisdiction**
   - What we know: STATE.md notes "Late fee jurisdiction-specific legal requirements need validation"
   - What's unclear: Whether the system needs to enforce state-specific caps
   - Recommendation: Out of scope for v2.0. The `maxFeeAmountCents` field lets admins self-limit. Legal compliance is the admin's responsibility. Add a tooltip/note in the UI.

3. **Recurring vs one-time late fees**
   - What we know: Requirements say "a late fee charge" (singular) when rent is unpaid
   - What's unclear: Should additional late fees accrue for continued non-payment?
   - Recommendation: v2.0 scope is one late fee per billing period. No compounding or recurring late fees. Keep it simple.

4. **Retrofit existing cron jobs for timezone**
   - What we know: INFRA-03 says rent reminders and autopay scheduling should also use property timezone
   - What's unclear: Whether we retrofit existing cron endpoints in this phase or leave them as-is
   - Recommendation: This phase MUST retrofit rent-reminders and autopay-charge/autopay-notify cron endpoints to use property-local timezone. The timezone utility functions built for late fees will be shared.

## Sources

### Primary (HIGH confidence)
- Existing codebase: `src/app/api/cron/rent-reminders/route.ts`, `src/app/api/cron/autopay-charge/route.ts`, `src/app/api/cron/autopay-notify/route.ts` — established cron patterns
- Existing codebase: `src/lib/notifications.ts` — unified notification dispatch
- Existing codebase: `src/db/schema/domain.ts` — current schema, properties table
- MDN Intl.DateTimeFormat: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat — timezone support documentation

### Secondary (MEDIUM confidence)
- Drizzle ORM schema patterns: consistent with project's existing schema conventions
- IANA timezone database: standard timezone identifiers used by Intl API

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use, no new dependencies needed
- Architecture: HIGH - Follows exact patterns of existing cron endpoints and notification system
- Pitfalls: HIGH - Timezone and idempotency pitfalls are well-documented in the industry
- Validation: MEDIUM - Test structure is clear but depends on Phase 8 charges table schema

**Research date:** 2026-02-26
**Valid until:** 2026-03-26 (stable patterns, no fast-moving dependencies)
