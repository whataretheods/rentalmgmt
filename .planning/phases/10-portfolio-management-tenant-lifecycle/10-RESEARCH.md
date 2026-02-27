# Phase 10: Portfolio Management & Tenant Lifecycle - Research

**Researched:** 2026-02-26
**Domain:** Property/unit CRUD, tenant move-out workflow, past-tenant read-only access, self-service invite token entry
**Confidence:** HIGH

## Summary

Phase 10 adds full property portfolio management and tenant lifecycle capabilities. The admin needs CRUD for properties and units (with archive/soft-delete instead of hard delete per INFRA-05 from Phase 7), an atomic move-out workflow that combines multiple operations in a single transaction (leveraging INFRA-04 from Phase 7), and read-only access for moved-out tenants. Tenants with no active unit need an empty-state dashboard with self-service invite token entry.

The existing codebase provides strong foundations: the `properties`, `units`, and `tenantUnits` tables already exist with the correct structure; the `tenantUnits.isActive` and `tenantUnits.endDate` fields already support tenancy lifecycle tracking; the invite token system (`inviteTokens` table, `hashToken`, `generateInviteToken`) already handles token generation and consumption; and the `autopayEnrollments` table has status management with cancellation. The main work is building admin CRUD UI, the atomic move-out transaction, read-only mode detection, and the empty-state invite entry form.

**Primary recommendation:** Add `archivedAt` columns to `properties` and `units` for soft-delete (Phase 7 prerequisite), build admin CRUD pages using the existing shadcn/ui component library and the admin route pattern, implement the move-out workflow as a single API route that uses `db.transaction()` (Phase 7 prerequisite) to atomically end tenancy + cancel autopay + post final charges, and modify the tenant layout/dashboard to detect no-active-unit state and show an invite token entry form.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PORT-01 | Admin can create, edit, and archive properties from the admin dashboard | Properties table exists; needs admin CRUD pages/API routes with soft-delete via `archivedAt` column |
| PORT-02 | Admin can create, edit, and archive units with rent amount and due day configuration | Units table exists with `rentAmountCents`/`rentDueDay`; needs admin CRUD pages/API routes; existing RentConfigForm handles rent config; add `archivedAt` column |
| PORT-03 | Admin can initiate tenant move-out workflow that sets end date, cancels autopay, posts final charges, and archives the tenancy | Requires `db.transaction()` from Phase 7; tenantUnits has `endDate`/`isActive`; autopayEnrollments has cancel logic; charges table from Phase 8 for final charges |
| PORT-04 | Moved-out tenant retains read-only portal access to their payment and maintenance history | tenantUnits.isActive=false with endDate set indicates moved-out; need to adjust tenant layout to allow access with read-only indicators |
| TUX-01 | Tenant with no active unit can enter an invite token directly on their empty-state dashboard to self-associate with a unit | Existing invite token system handles validation/consumption; need empty-state dashboard component with token input form |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | existing | Database queries, schema, transactions | Already in use; transaction support from Phase 7 |
| next.js | 15.5 | App Router, API routes, Server Components | Already in use |
| shadcn/ui | existing | Form components (Dialog, Input, Select, Button, Card) | Already in use across all admin pages |
| zod | existing | Request body validation | Already in use for API input validation |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sonner | existing | Toast notifications | User feedback for CRUD operations, move-out confirmation |
| drizzle-kit | existing | Schema push | After adding `archivedAt` columns |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Soft-delete with archivedAt | Hard delete | Hard delete destroys history; INFRA-05 mandates RESTRICT + soft-delete |
| API routes for CRUD | Server Actions | API routes match existing project pattern; server actions would be inconsistent |

**Installation:**
```bash
# No new packages needed - all dependencies already installed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/
│   ├── (admin)/admin/
│   │   ├── properties/          # NEW: property CRUD page
│   │   │   └── page.tsx
│   │   ├── units/
│   │   │   └── page.tsx         # MODIFIED: add unit CRUD (create, edit, archive)
│   ├── api/
│   │   ├── admin/
│   │   │   ├── properties/
│   │   │   │   └── route.ts     # NEW: GET (list), POST (create)
│   │   │   ├── properties/[id]/
│   │   │   │   └── route.ts     # NEW: PUT (edit), DELETE (archive)
│   │   │   ├── units/
│   │   │   │   └── route.ts     # MODIFIED: add POST (create)
│   │   │   ├── units/[id]/
│   │   │   │   └── route.ts     # NEW: PUT (edit), DELETE (archive)
│   │   │   └── move-out/
│   │   │       └── route.ts     # NEW: POST (atomic move-out)
│   ├── (tenant)/tenant/
│   │   ├── dashboard/
│   │   │   └── page.tsx         # MODIFIED: detect no-unit state, show invite entry
├── components/
│   ├── admin/
│   │   ├── PropertyForm.tsx     # NEW: create/edit property dialog
│   │   ├── UnitForm.tsx         # NEW: create/edit unit dialog
│   │   ├── MoveOutDialog.tsx    # NEW: move-out confirmation with final charges
│   ├── tenant/
│   │   ├── InviteTokenEntry.tsx # NEW: self-service invite token form
├── db/schema/
│   └── domain.ts                # MODIFIED: add archivedAt to properties/units
```

### Pattern 1: Soft-Delete with archivedAt
**What:** Add nullable `archivedAt` timestamp to properties and units; filter with `isNull(table.archivedAt)` in queries
**When to use:** Any entity that might have financial or maintenance history attached
**Example:**
```typescript
// Schema
archivedAt: timestamp("archived_at"),  // null = active

// Query active only
const activeProperties = await db.select().from(properties)
  .where(isNull(properties.archivedAt))
  .orderBy(properties.name)

// Archive (soft-delete)
await db.update(properties)
  .set({ archivedAt: new Date(), updatedAt: new Date() })
  .where(eq(properties.id, propertyId))
```

### Pattern 2: Atomic Move-Out Transaction
**What:** Use db.transaction() to ensure move-out is all-or-nothing
**When to use:** When multiple related records must be updated together
**Example:**
```typescript
// Requires Phase 7's WebSocket driver for transaction support
await db.transaction(async (tx) => {
  // 1. Set tenancy end date and deactivate
  await tx.update(tenantUnits)
    .set({ endDate: moveOutDate, isActive: false })
    .where(eq(tenantUnits.id, tenancyId))

  // 2. Cancel active autopay
  await tx.update(autopayEnrollments)
    .set({ status: "cancelled", cancelledAt: new Date(), updatedAt: new Date() })
    .where(and(
      eq(autopayEnrollments.tenantUserId, tenantUserId),
      eq(autopayEnrollments.status, "active"),
    ))

  // 3. Post final charges (if any) to charges table (from Phase 8)
  if (finalCharges.length > 0) {
    await tx.insert(charges).values(finalCharges)
  }
})
```

### Pattern 3: Read-Only Detection for Past Tenants
**What:** Check if tenant has any tenantUnit where isActive=false (moved out) but no isActive=true record
**When to use:** Tenant layout/dashboard to determine access level
**Example:**
```typescript
// Check for active tenancy
const [activeLink] = await db.select().from(tenantUnits)
  .where(and(eq(tenantUnits.userId, userId), eq(tenantUnits.isActive, true)))

// Check for any past tenancy (moved-out)
const [pastLink] = await db.select().from(tenantUnits)
  .where(and(eq(tenantUnits.userId, userId), eq(tenantUnits.isActive, false)))

if (!activeLink && pastLink) {
  // Read-only mode: show history but hide payment/maintenance submission
}
if (!activeLink && !pastLink) {
  // No unit at all: show invite token entry form
}
```

### Pattern 4: Self-Service Invite Token Consumption
**What:** Logged-in tenant enters an invite token to associate with a unit (bypasses QR code registration flow)
**When to use:** When an existing user (registered but unlinked, or after move-out) needs to link to a unit
**Example:**
```typescript
// POST /api/invites/consume
// 1. Hash the raw token
const tokenHash = hashToken(rawToken)

// 2. Atomically consume: UPDATE WHERE status='pending' AND not expired
const [consumed] = await db.update(inviteTokens)
  .set({ status: "used", usedByUserId: userId, usedAt: now })
  .where(and(
    eq(inviteTokens.tokenHash, tokenHash),
    eq(inviteTokens.status, "pending"),
    gt(inviteTokens.expiresAt, now),
  ))
  .returning()

if (!consumed) throw new Error("Invalid or expired token")

// 3. Create tenancy link
await db.insert(tenantUnits).values({
  userId,
  unitId: consumed.unitId,
  startDate: now,
  isActive: true,
})
```

### Anti-Patterns to Avoid
- **Hard-deleting properties or units:** Destroys financial history. Always soft-delete with archivedAt.
- **Non-transactional move-out:** If any step fails (e.g., autopay cancel succeeds but tenancy update fails), data is left in an inconsistent state. Must use db.transaction().
- **Blocking past-tenant login:** Moved-out tenants should retain access. Don't revoke sessions or block authentication.
- **Allowing actions on archived entities:** All CRUD queries must filter `WHERE archived_at IS NULL` by default. Creating units under an archived property should be blocked.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Confirmation dialogs | Custom modal logic | shadcn/ui AlertDialog | Handles accessibility, keyboard, focus trap |
| Form validation | Manual if/else chains | Zod schemas + shadcn/ui Form | Type-safe validation with error display |
| Token hashing | Custom hash function | Existing hashToken from lib/tokens.ts | Already implemented, SHA-256, consistent |
| Invite generation | New token system | Existing generateInviteToken + hashToken | Proven system from Phase 2 |

**Key insight:** The move-out workflow is the only genuinely new complexity. Property/unit CRUD is standard admin page work, and the invite entry reuses the existing token system.

## Common Pitfalls

### Pitfall 1: Forgetting to Filter Archived Entities
**What goes wrong:** Archived properties/units appear in dropdowns, lists, and tenant-facing pages.
**Why it happens:** Every query must include the `isNull(archivedAt)` filter, easy to miss.
**How to avoid:** Create a helper function `activeOnly(table)` or add the filter as a convention in every query. Consider a Drizzle query wrapper.
**Warning signs:** Archived properties showing up in unit creation dropdowns or tenant dashboards.

### Pitfall 2: Partial Move-Out State
**What goes wrong:** Move-out cancels autopay but fails to update tenantUnits, leaving tenant in limbo.
**Why it happens:** Multiple operations without transaction wrapping.
**How to avoid:** Wrap all move-out operations in db.transaction(). If any step fails, the entire operation rolls back.
**Warning signs:** Tenant has cancelled autopay but isActive is still true, or endDate is set but autopay is still active.

### Pitfall 3: Invite Token Consumed but Tenant Already Has Active Unit
**What goes wrong:** A tenant with an active unit consumes an invite token and gets linked to a second unit.
**Why it happens:** No check for existing active tenancy before consuming the token.
**How to avoid:** Before consuming the invite token, verify the tenant has no active tenantUnit record. Return an error if they already have an active unit.
**Warning signs:** Tenant linked to multiple active units, ambiguous dashboard state.

### Pitfall 4: Archiving Property with Active Tenants
**What goes wrong:** Admin archives a property that has occupied units, disrupting active tenants.
**Why it happens:** No validation check before archiving.
**How to avoid:** Before archiving a property, check if any of its units have active tenants. Block the archive and show an error: "Cannot archive property with active tenants. Move out all tenants first."
**Warning signs:** Tenants suddenly losing access or seeing errors after admin archives their property.

### Pitfall 5: Race Condition on Invite Token Self-Service
**What goes wrong:** Two users submit the same invite token simultaneously, both get linked.
**Why it happens:** Check-then-update without atomicity.
**How to avoid:** Use the same atomic UPDATE...WHERE pattern from the existing auth.ts hook: update WHERE status='pending' and check the returned row count. Only one transaction will succeed.
**Warning signs:** Multiple tenantUnit records for the same invite token.

### Pitfall 6: Missing Charges Table Dependency
**What goes wrong:** Move-out tries to post final charges but the charges table doesn't exist yet.
**Why it happens:** Charges table is added in Phase 8, and Phase 10 depends on Phase 8.
**How to avoid:** Verify the charges table schema exists before implementing the move-out final charges step. The move-out API route should gracefully handle the case where no final charges are needed.
**Warning signs:** Database errors during move-out, undefined table references.

## Code Examples

### archivedAt Schema Addition
```typescript
// Add to existing properties table in domain.ts
export const properties = pgTable("properties", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  archivedAt: timestamp("archived_at"),  // NEW: null = active
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

// Add to existing units table in domain.ts
export const units = pgTable("units", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id")
    .references(() => properties.id, { onDelete: "restrict" })  // CHANGED: cascade -> restrict (Phase 7)
    .notNull(),
  unitNumber: text("unit_number").notNull(),
  rentAmountCents: integer("rent_amount_cents"),
  rentDueDay: integer("rent_due_day"),
  archivedAt: timestamp("archived_at"),  // NEW: null = active
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})
```

### Admin Property CRUD API Pattern
```typescript
// POST /api/admin/properties
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { name, address } = body
  if (!name || !address) {
    return NextResponse.json({ error: "Name and address are required" }, { status: 400 })
  }

  const [property] = await db.insert(properties).values({ name, address }).returning()
  return NextResponse.json(property)
}
```

### Tenant Dashboard State Detection
```typescript
// In tenant dashboard page.tsx
const [activeLink] = await db.select().from(tenantUnits)
  .where(and(eq(tenantUnits.userId, session.user.id), eq(tenantUnits.isActive, true)))

const pastLinks = await db.select().from(tenantUnits)
  .where(and(eq(tenantUnits.userId, session.user.id), eq(tenantUnits.isActive, false)))

if (activeLink) {
  // Normal dashboard - show full functionality
} else if (pastLinks.length > 0) {
  // Read-only mode - show history, hide action buttons
} else {
  // Empty state - show invite token entry form
}
```

### InviteTokenEntry Component
```typescript
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

export function InviteTokenEntry() {
  const [token, setToken] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token.trim()) return

    setLoading(true)
    try {
      const res = await fetch("/api/invites/consume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Invalid token")

      toast.success(`Successfully linked to Unit ${data.unitNumber}`)
      router.refresh()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Link Your Account</CardTitle>
        <CardDescription>
          Enter the invite code from your landlord to connect to your unit.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            placeholder="Enter invite code"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            disabled={loading}
          />
          <Button type="submit" disabled={loading || !token.trim()}>
            {loading ? "Linking..." : "Link"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hard delete (CASCADE) | Soft delete (archivedAt) + ON DELETE RESTRICT | Phase 7 decision | Preserves all financial/maintenance history |
| HTTP-only Neon driver | WebSocket driver with transaction support | Phase 7 prerequisite | Enables atomic move-out transaction |
| QR-code-only invite | QR code + self-service token entry | Phase 10 addition | Existing tenants can link without re-registering |

**Deprecated/outdated:**
- ON DELETE CASCADE for properties/units: Being replaced with RESTRICT in Phase 7
- HTTP Neon driver for transactions: Being replaced with WebSocket driver in Phase 7

## Open Questions

1. **Charges Table Schema**
   - What we know: Phase 8 adds a charges table for the financial ledger. Move-out needs to post "final charges" to this table.
   - What's unclear: The exact schema of the charges table (columns, types).
   - Recommendation: The move-out API should accept an array of final charge descriptions and amounts. Map to whatever schema Phase 8 defines. If Phase 8 is not yet implemented when Phase 10 executes, the final charges feature can be added as a follow-up or the plan can reference the Phase 8 schema.

2. **Unit Number Uniqueness Scope**
   - What we know: Unit numbers are stored as text. Multiple properties might have "Unit 1."
   - What's unclear: Whether unitNumber should be unique per property.
   - Recommendation: Add a unique constraint on (propertyId, unitNumber) to prevent duplicate unit numbers within the same property.

3. **What Constitutes a "Final Charge"**
   - What we know: Move-out should "post any final charges."
   - What's unclear: Whether these are prorated rent, cleaning fees, damage deposits, or user-defined.
   - Recommendation: Allow admin to enter arbitrary final charges (description + amount) during the move-out dialog. No automatic calculation (prorated rent is out of scope per REQUIREMENTS.md).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright ^1.58.2 |
| Config file | playwright.config.ts |
| Quick run command | `npx playwright test --grep "portfolio\|move-out\|invite"` |
| Full suite command | `npx playwright test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PORT-01 | Admin can create, edit, archive properties | e2e | `npx playwright test e2e/admin-properties.spec.ts` | No -- Wave 0 |
| PORT-02 | Admin can create, edit, archive units | e2e | `npx playwright test e2e/admin-units.spec.ts` | No -- Wave 0 |
| PORT-03 | Admin can initiate move-out workflow | e2e | `npx playwright test e2e/move-out.spec.ts` | No -- Wave 0 |
| PORT-04 | Moved-out tenant sees read-only history | e2e | `npx playwright test e2e/past-tenant.spec.ts` | No -- Wave 0 |
| TUX-01 | Tenant can enter invite token on dashboard | e2e | `npx playwright test e2e/invite-token-entry.spec.ts` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npx tsc --noEmit` (type checking)
- **Per wave merge:** `npx playwright test` (full suite)
- **Phase gate:** Full suite green before verification

### Wave 0 Gaps
- [ ] `e2e/admin-properties.spec.ts` -- covers PORT-01
- [ ] `e2e/admin-units.spec.ts` -- covers PORT-02
- [ ] `e2e/move-out.spec.ts` -- covers PORT-03
- [ ] `e2e/past-tenant.spec.ts` -- covers PORT-04
- [ ] `e2e/invite-token-entry.spec.ts` -- covers TUX-01
- [ ] Seed data for test scenarios (property with units, tenant with active/past tenancy)

## Sources

### Primary (HIGH confidence)
- Existing codebase analysis: schema (domain.ts), API route patterns, component patterns, auth.ts hooks
- Drizzle ORM documentation: transaction support, schema modification, query patterns
- Project ROADMAP.md and REQUIREMENTS.md: Phase dependencies, success criteria

### Secondary (MEDIUM confidence)
- Next.js App Router documentation: route groups, server components, API route patterns

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use, no new dependencies
- Architecture: HIGH - Follows established project patterns (API routes, schema, components)
- Pitfalls: HIGH - Well-understood CRUD + transaction patterns; race conditions addressed by existing atomic update pattern

**Research date:** 2026-02-26
**Valid until:** 2026-03-26 (stable stack, no dependency changes expected)
