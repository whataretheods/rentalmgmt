# Phase 14: Audit Gap Closure - Research

**Researched:** 2026-02-28
**Domain:** Admin UI wiring, form enhancements, KPI query fixes
**Confidence:** HIGH

## Summary

Phase 14 closes 5 UI wiring gaps and 2 integration issues identified by the v2.0 milestone audit. Every gap has a working backend -- the work is purely UI additions (nav links, form fields, dropdown selectors) and one KPI query correction. No new APIs, database migrations, or external libraries are needed.

The scope is small (~120 lines across ~11 files) and every change is incremental: adding a sidebar nav item, adding a dropdown to a form, adding a checkbox to a cost form, adding a button that already exists, and correcting a KPI query that already has the charges table imported but underutilizes it.

**Primary recommendation:** Treat each gap as an isolated UI patch. No architectural changes needed. Follow existing component patterns exactly.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
The CONTEXT.md was created during `/gsd:plan-milestone-gaps` and represents the approved gap closure plan:
- 1 phase (Phase 14), 4 plans, 2 waves
- Wave 1: Plan 01 (LEDG-03 + LATE-02: nav fixes) + Plan 02 (INFRA-03 + OPS-02 + FIN-04: form enhancements) -- parallel
- Wave 2: Plan 03 (AUX-02 integration: KPI charges fix) + Plan 04 (traceability + cleanup) -- parallel

### Claude's Discretion
No explicit discretion areas defined. All gaps are prescriptive (fix what the audit identified).

### Deferred Ideas (OUT OF SCOPE)
- No new features beyond gap closure
- No UI redesign or refactoring
- receiptPath rendering (listed in tech debt but not in Phase 14 requirements)
- Unit expense rollup UI (OPS-04 API exists but UI consumer is tracked separately)
- Dead variable cleanup in late-fee cron (tech debt, not a requirement gap)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFRA-03 | Property-local timezone -- admin can select timezone per property | PropertyForm needs timezone dropdown; `US_TIMEZONES` already exported from `timezone.ts`; `properties` schema already has `timezone` column; API PUT route needs to accept `timezone` field |
| LEDG-03 | Admin can manage charges/credits/adjustments | Charges page exists at `/admin/charges`; sidebar `navItems` already includes `{ title: "Charges", href: "/admin/charges", icon: Receipt }` -- **GAP ALREADY CLOSED** in current codebase |
| LATE-02 | Admin can configure late fee rules per property | Late fees page exists at `/admin/properties/[id]/late-fees`; Properties page already has "Late Fees" button in actions column -- **GAP ALREADY CLOSED** in current codebase |
| OPS-02 | Admin can assign vendor to maintenance request via work order creation | AdminMaintenanceDetail already has "Create Work Order" button -- **GAP ALREADY CLOSED** in current codebase |
| FIN-04 | Admin can bill work order costs to tenant ledger | API accepts `billToTenant` and calls `resolveAndPostChargeback`; cost form in WorkOrderDetailPage does NOT send `billToTenant` -- needs checkbox added |
| AUX-02 | KPI dashboard shows Total Outstanding and Overdue Tenants | `kpi-queries.ts` already incorporates charges table for non-rent charges in `totalOutstandingCents` calculation -- **PARTIALLY CLOSED**; overdue tenants check uses `totalPaid === 0` which may miss partial-payment scenarios with extra charges |
| OPS-04 | Admin can record costs on work orders with per-unit expense rollup | Cost tracking UI exists on work order detail page; rollup API at `/api/admin/reports/unit-expenses` exists but has no UI consumer -- the gap is the UI display, but per Phase 14 scope, the focus is the `billToTenant` checkbox (FIN-04) |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15.5 | App Router, Server/Client Components | Already in use across all phases |
| React | 19.2 | UI framework | Already in use |
| shadcn/ui | 3.8.5 (CLI) | UI component library (new-york style) | Already in use across all admin pages |
| radix-ui | 1.4.3 | Headless UI primitives (unified package) | Already installed, backing shadcn components |
| lucide-react | 0.575.0 | Icon library | Already in use across all components |
| Drizzle ORM | 0.45.1 | Database queries | Already in use |
| Vitest | 4.0.18 | Unit testing | Already configured at `vitest.config.mts` |
| Playwright | 1.58.2 | E2E testing | Already configured at `playwright.config.ts` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sonner | 2.0.7 | Toast notifications | Already used in all admin forms for success/error feedback |
| zod | 4.3.6 | Schema validation | Available but not needed for these simple additions |

### Alternatives Considered
None. All changes use existing stack components. No new libraries needed.

**Installation:**
```bash
# shadcn checkbox component (if needed for FIN-04)
npx shadcn@latest add checkbox
```

Note: The project uses `radix-ui` v1.4.3 (unified package). The shadcn CLI will handle the checkbox primitive installation. Alternatively, a simple native HTML checkbox with Tailwind styling would suffice for a single boolean toggle.

## Architecture Patterns

### Recommended Project Structure
No new directories needed. All changes are within existing files:
```
src/
├── components/admin/
│   ├── AdminSidebar.tsx          # Already has Charges nav link
│   └── PropertyForm.tsx          # Add timezone Select dropdown
├── app/(admin)/admin/
│   ├── properties/page.tsx       # Already has Late Fees action
│   └── work-orders/[id]/page.tsx # Add billToTenant checkbox to cost form
├── app/api/admin/properties/
│   ├── route.ts                  # Accept timezone in POST
│   └── [id]/route.ts             # Accept timezone in PUT
└── lib/
    └── kpi-queries.ts            # Fix overdue tenants to account for charges
```

### Pattern 1: Form Field Addition (PropertyForm timezone)
**What:** Add a Select dropdown to an existing Dialog form
**When to use:** When extending a form with a new field backed by an existing DB column
**Example:**
```typescript
// Source: Existing PropertyForm.tsx pattern + existing Select usage in work-orders/[id]/page.tsx
import { US_TIMEZONES } from "@/lib/timezone"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// In state:
const [timezone, setTimezone] = useState(property?.timezone ?? "America/New_York")

// In form body:
<div className="space-y-2">
  <Label htmlFor="property-timezone">Timezone</Label>
  <Select value={timezone} onValueChange={setTimezone}>
    <SelectTrigger id="property-timezone">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      {US_TIMEZONES.map((tz) => (
        <SelectItem key={tz.value} value={tz.value}>
          {tz.label}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>

// In handleSubmit JSON body:
body: JSON.stringify({ name: name.trim(), address: address.trim(), timezone })
```

### Pattern 2: Checkbox Toggle in Cost Form (billToTenant)
**What:** Add a boolean toggle to an existing inline form
**When to use:** When adding a boolean field to a POST body
**Example:**
```typescript
// Source: Existing costForm state pattern in work-orders/[id]/page.tsx
// Option A: Native HTML checkbox (simplest, no new dependency)
const [costForm, setCostForm] = useState({
  description: "",
  amount: "",
  category: "labor",
  billToTenant: false,  // NEW
})

// In the Add Cost section, after category select:
<div className="flex items-center gap-2">
  <input
    type="checkbox"
    id="billToTenant"
    checked={costForm.billToTenant}
    onChange={(e) => setCostForm({ ...costForm, billToTenant: e.target.checked })}
    className="h-4 w-4 rounded border-gray-300"
  />
  <Label htmlFor="billToTenant" className="text-sm font-normal">
    Bill to Tenant
  </Label>
</div>

// In handleAddCost body:
body: JSON.stringify({
  description: costForm.description.trim(),
  amountCents: Math.round(amountDollars * 100),
  category: costForm.category,
  billToTenant: costForm.billToTenant,  // NEW
})
```

### Pattern 3: API Route Field Extension
**What:** Accept a new field in PUT/POST body and include in database operation
**When to use:** When the DB column exists but the API doesn't accept the field
**Example:**
```typescript
// Source: Existing properties/[id]/route.ts pattern
// In PUT handler:
let body: { name?: string; address?: string; timezone?: string }

const updates: Record<string, unknown> = { updatedAt: new Date() }
if (body.name?.trim()) updates.name = body.name.trim()
if (body.address?.trim()) updates.address = body.address.trim()
if (body.timezone?.trim()) updates.timezone = body.timezone.trim()
```

### Anti-Patterns to Avoid
- **Over-engineering the checkbox:** Don't install shadcn checkbox just for one toggle. A native HTML checkbox with Tailwind classes matches the project's pragmatic style.
- **Modifying KPI query structure:** The existing Promise.all parallel query pattern is correct. Only modify the overdue tenant logic, not the query structure.
- **Adding timezone validation in UI:** The Select dropdown with fixed US_TIMEZONES options already constrains input. Don't add redundant Zod validation for a controlled dropdown.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Timezone dropdown options | Custom timezone list | `US_TIMEZONES` from `@/lib/timezone` | Already curated for US properties, with user-friendly labels |
| Select component | Custom dropdown | shadcn `Select` component | Already used extensively, accessible, keyboard-navigable |
| Cost form checkbox | Custom toggle component | Native HTML `<input type="checkbox">` or shadcn Checkbox | One-off boolean -- keep it simple |

**Key insight:** Every gap in Phase 14 is wiring existing pieces together. The backends, components, and data structures all exist. The work is connecting them in the UI layer.

## Common Pitfalls

### Pitfall 1: PropertyForm Interface Mismatch
**What goes wrong:** Adding timezone to PropertyForm but forgetting to update the `property` prop interface to include timezone
**Why it happens:** The `PropertyFormProps.property` interface only has `{ id: string; name: string; address: string }` -- timezone is missing
**How to avoid:** Update the interface to include `timezone?: string` and pass it from the properties page. Also update the API GET response to include timezone in the select fields.
**Warning signs:** Timezone always defaults to "America/New_York" even when editing a property that was saved with a different timezone.

### Pitfall 2: Properties API GET Doesn't Return Timezone
**What goes wrong:** PropertyForm receives timezone for editing, but the GET /api/admin/properties response doesn't include the timezone field
**Why it happens:** The GET handler selects only `id, name, address, createdAt, updatedAt, unitCount` -- timezone is not in the select list
**How to avoid:** Add `timezone: properties.timezone` to the select clause in the GET handler, and update the Property interface in properties/page.tsx

### Pitfall 3: KPI Overdue Tenants False Negatives
**What goes wrong:** A tenant with $1500 rent + $50 late fee who paid $1500 still shows as "not overdue" despite $50 outstanding
**Why it happens:** Current overdue check is `totalPaid === 0` -- any payment at all removes them from overdue
**How to avoid:** Change the overdue check to consider total owed (rent + extra charges) vs total paid, e.g. `totalPaid < totalOwed && currentDay > dueDay`
**Warning signs:** Overdue tenant count doesn't match intuition after late fees are posted

### Pitfall 4: Cost Form State Reset Missing billToTenant
**What goes wrong:** After adding a cost, the billToTenant checkbox stays checked
**Why it happens:** The `setCostForm` reset in handleAddCost doesn't include billToTenant
**How to avoid:** Include `billToTenant: false` in the state reset: `setCostForm({ description: "", amount: "", category: "labor", billToTenant: false })`
**Warning signs:** Subsequent cost additions unexpectedly bill to tenant

### Pitfall 5: Sidebar Nav Already Has Charges Link
**What goes wrong:** Duplicate Charges nav item added to sidebar
**Why it happens:** The milestone audit was run against a prior codebase state. The current `AdminSidebar.tsx` already includes `{ title: "Charges", href: "/admin/charges", icon: Receipt }` at line 40
**How to avoid:** Verify current state before modifying. The LEDG-03 sidebar gap is ALREADY CLOSED.

### Pitfall 6: Late Fees Action Already Exists on Properties Page
**What goes wrong:** Duplicate Late Fees button added to properties table
**Why it happens:** Same as above -- the current `properties/page.tsx` already has a "Late Fees" button linking to `/admin/properties/${property.id}/late-fees` at lines 130-134
**How to avoid:** Verify current state. The LATE-02 nav gap is ALREADY CLOSED.

### Pitfall 7: Create Work Order Button Already Exists
**What goes wrong:** Duplicate work order creation button added to maintenance detail
**Why it happens:** The current `AdminMaintenanceDetail.tsx` already has a "Create Work Order" button at lines 244-282 that POSTs to `/api/admin/work-orders`
**How to avoid:** Verify current state. The OPS-02 UI gap is ALREADY CLOSED.

## Code Examples

Verified patterns from the current codebase:

### Existing Sidebar Nav Item Pattern
```typescript
// Source: src/components/admin/AdminSidebar.tsx, lines 35-49
const navItems = [
  { title: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  // ... 11 more items including:
  { title: "Charges", href: "/admin/charges", icon: Receipt },  // ALREADY EXISTS
  { title: "Work Orders", href: "/admin/work-orders", icon: ClipboardList },
]
```

### Existing Select Dropdown Pattern (for timezone)
```typescript
// Source: src/app/(admin)/admin/work-orders/[id]/page.tsx, lines 389-401
<Select value={wo.status} onValueChange={handleStatusChange}>
  <SelectTrigger>
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    {STATUS_OPTIONS.map((opt) => (
      <SelectItem key={opt.value} value={opt.value}>
        {opt.label}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

### Existing Dollar-to-Cents Pattern (for cost form)
```typescript
// Source: src/app/(admin)/admin/work-orders/[id]/page.tsx, lines 252-268
const amountDollars = parseFloat(costForm.amount)
if (isNaN(amountDollars) || amountDollars <= 0) {
  toast.error("Amount must be a positive number")
  return
}
// ...
body: JSON.stringify({
  amountCents: Math.round(amountDollars * 100),
  // ...
})
```

### Existing KPI Charges Query (for reference)
```typescript
// Source: src/lib/kpi-queries.ts, lines 94-108
// Non-rent charges per unit for current period (late fees, one-time, etc.)
db.select({
  unitId: charges.unitId,
  totalCharged: sql<number>`coalesce(sum(${charges.amountCents}), 0)::int`,
})
.from(charges)
.where(
  and(
    eq(charges.billingPeriod, period),
    sql`${charges.type} != 'rent'`
  )
)
.groupBy(charges.unitId),
```

### US Timezones Constant (already defined)
```typescript
// Source: src/lib/timezone.ts, lines 88-95
export const US_TIMEZONES: { value: string; label: string }[] = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HT)" },
]
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@radix-ui/react-*` individual packages | `radix-ui` unified package v1.4.3 | 2025 | Single dependency for all primitives |
| shadcn registry (individual installs) | `npx shadcn@latest add` | 2025 | CLI v3.x uses new unified radix-ui |

**Deprecated/outdated:**
- None relevant. All components use current shadcn v3.x patterns.

## Critical Discovery: Gaps Already Closed

During research, I verified each gap against the CURRENT codebase (not the audit snapshot). Three of the five UI gaps have already been fixed:

| Gap | Audit Status | Current Codebase Status | Evidence |
|-----|-------------|------------------------|----------|
| LEDG-03 sidebar nav | Missing | **PRESENT** | `AdminSidebar.tsx` line 40: `{ title: "Charges", href: "/admin/charges", icon: Receipt }` |
| LATE-02 properties nav | Missing | **PRESENT** | `properties/page.tsx` lines 130-134: Late Fees button in actions column |
| OPS-02 work order button | Missing | **PRESENT** | `AdminMaintenanceDetail.tsx` lines 244-282: Create Work Order button |
| INFRA-03 timezone selector | Missing | **STILL MISSING** | PropertyForm has no timezone field; API doesn't accept timezone |
| FIN-04 billToTenant toggle | Missing | **STILL MISSING** | Cost form doesn't include billToTenant checkbox |

**Implication for planning:** Plans 01 (LEDG-03 + LATE-02) may need to verify existing implementations rather than create new ones. Plans should include verification steps to confirm the gaps are truly closed, then focus on the remaining real gaps (INFRA-03 timezone, FIN-04 billToTenant, AUX-02 KPI).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 (unit) + Playwright 1.58.2 (E2E) |
| Config file | `vitest.config.mts` (unit), `playwright.config.ts` (E2E) |
| Quick run command | `npm test` |
| Full suite command | `npm test && npx playwright test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFRA-03 | Timezone dropdown persists to DB | E2E | `npx playwright test e2e/timezone-utils.spec.ts` | Partial (tests timezone utils, not PropertyForm) |
| LEDG-03 | Charges nav link in sidebar | E2E | `npx playwright test e2e/admin-sidebar.spec.ts` | Exists (verify existing link) |
| LATE-02 | Late Fees action on properties page | E2E | `npx playwright test e2e/late-fee-admin.spec.ts` | Exists (verify existing button) |
| OPS-02 | Create Work Order button on maintenance detail | E2E | `npx playwright test e2e/work-orders.spec.ts` | Exists (verify existing button) |
| FIN-04 | Bill to Tenant checkbox sends billToTenant=true | Unit | `npx vitest run src/lib/__tests__/chargeback.test.ts` | Exists (chargeback logic); UI test needed |
| AUX-02 | KPI Total Outstanding includes charges | Unit | `npm test` | No unit test for kpi-queries.ts |
| OPS-04 | Work order cost tracking | E2E | `npx playwright test e2e/work-orders.spec.ts` | Exists |

### Sampling Rate
- **Per task commit:** `npm test` (unit tests, <5 seconds)
- **Per wave merge:** `npm test && npx playwright test e2e/admin-sidebar.spec.ts e2e/work-orders.spec.ts`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/lib/__tests__/kpi-queries.test.ts` -- covers AUX-02 (unit test for overdue tenant logic with charges)
- [ ] Verify LEDG-03, LATE-02, OPS-02 are truly closed via Playwright snapshots

*(Note: If gaps LEDG-03, LATE-02, OPS-02 are confirmed closed, their test coverage already exists in prior E2E specs.)*

## Open Questions

1. **Are the three "already closed" gaps truly verified?**
   - What we know: The current source code includes the sidebar nav link, late fees button, and create work order button
   - What's unclear: Whether these were added AFTER the audit or were present at audit time but somehow missed. The audit file is dated 2026-02-28.
   - Recommendation: Plan 01 should include a verification-only task for LEDG-03, LATE-02, and OPS-02. If confirmed present, mark them as verified. If somehow not rendering (e.g., behind a condition), fix them.

2. **KPI overdue tenant definition**
   - What we know: Current logic: `currentDay > dueDay && totalPaid === 0`. This already accounts for extra charges in `totalOutstandingCents` but the `overdueTenantsCount` still uses `totalPaid === 0`.
   - What's unclear: Whether the intent is "no payment at all" or "any amount outstanding past due day"
   - Recommendation: Change to `totalPaid < totalOwed` for consistency with `totalOutstandingCents` calculation. A tenant who paid rent but not their late fee should still show as having outstanding balance, even if not "overdue" in the strictest sense. Document the choice.

3. **Should PropertyForm support timezone for both create and edit?**
   - What we know: Schema defaults to "America/New_York". PropertyForm handles both create and edit mode.
   - What's unclear: Whether create should show timezone (it has a sensible default) or only edit
   - Recommendation: Show timezone on both create and edit. The default "Eastern Time" pre-selected in the dropdown is clear UX and avoids a second step.

## Sources

### Primary (HIGH confidence)
- Codebase analysis of 12+ source files (direct file reads)
- `src/components/admin/AdminSidebar.tsx` -- confirmed Charges nav link exists
- `src/app/(admin)/admin/properties/page.tsx` -- confirmed Late Fees button exists
- `src/components/admin/AdminMaintenanceDetail.tsx` -- confirmed Create Work Order button exists
- `src/lib/timezone.ts` -- confirmed US_TIMEZONES export
- `src/db/schema/domain.ts` -- confirmed properties.timezone column exists
- `src/app/api/admin/work-orders/[id]/costs/route.ts` -- confirmed billToTenant API support
- `src/lib/kpi-queries.ts` -- confirmed charges table usage in KPI
- `src/lib/chargeback.ts` -- confirmed resolveAndPostChargeback implementation

### Secondary (MEDIUM confidence)
- `.planning/v2.0-MILESTONE-AUDIT.md` -- gap identification
- `.planning/phases/14-audit-gap-closure/CONTEXT.md` -- approved plan structure

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all existing libraries, no new additions needed
- Architecture: HIGH -- all changes follow established patterns visible in current codebase
- Pitfalls: HIGH -- identified from direct codebase analysis, not hypothetical
- Critical discovery (3 gaps already closed): HIGH -- verified via direct source code reads

**Research date:** 2026-02-28
**Valid until:** 2026-03-28 (stable -- no external dependency changes expected)
