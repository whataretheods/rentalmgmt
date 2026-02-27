# Phase 12: Vendor & Work Order Management - Research

**Researched:** 2026-02-26
**Domain:** Vendor directory CRUD, work order lifecycle, magic link sharing, cost tracking
**Confidence:** HIGH

## Summary

Phase 12 adds vendor management and work order cost tracking to the existing maintenance request system. The core work is: (1) three new database tables (vendors, workOrders, workOrderCosts), (2) admin CRUD UI for vendors, (3) vendor assignment to maintenance requests with a "Create Work Order" flow, (4) a public magic link page for vendor-limited-view access, (5) email/SMS notification to vendors on assignment, and (6) cost line items on work orders with per-unit expense rollup.

This phase depends on Phase 7 (S3 for receipt uploads on work order costs) and Phase 8 (charges table for optional tenant billing of maintenance costs). At the time of implementation, both Phase 7 and Phase 8 schemas and services will be available. The vendor portal with login is explicitly out of scope per REQUIREMENTS.md -- magic link limited-view only.

**Primary recommendation:** Use the existing project patterns (Drizzle schema in domain.ts, API routes under /api/admin/*, shadcn/ui components, sendNotification dispatcher) and add a public route at `/vendor/work-order/[token]` for magic link access. Vendor access tokens are random UUIDs stored in the workOrders table. No new dependencies required beyond what Phase 7 and 8 will have already added.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| OPS-01 | Admin can manage a vendor directory (name, trade/specialty, phone, email) | New `vendors` table with CRUD API routes and admin UI page. Follows existing pattern from admin/users and admin/units pages. |
| OPS-02 | Admin can assign a vendor to a maintenance request | New `workOrders` table links vendors to maintenance requests. Admin maintenance detail page gets "Assign Vendor / Create Work Order" action. |
| OPS-03 | Assigned vendor receives email/SMS notification with a limited-view magic link showing request details and photos (no tenant PII) | Public route `/vendor/work-order/[token]` serves maintenance details without auth. `sendNotification` is not usable (requires userId) -- send email/SMS directly via Resend and Twilio to vendor contact info. Token is UUID stored in `workOrders.vendorAccessToken`. |
| OPS-04 | Admin can record labor and materials costs on work orders with per-unit expense rollup | New `workOrderCosts` table with line items (description, amountCents, category). Admin work order detail page shows cost form. Per-unit rollup is a SUM query joining workOrders -> maintenanceRequests -> units. |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Drizzle ORM | (existing) | Database schema, queries, migrations | Already used for all tables in the project |
| Next.js App Router | 15.5 (existing) | API routes and pages | Project framework |
| shadcn/ui | (existing) | UI components (Card, Button, Table, Dialog, Input, Select) | Project UI library |
| Resend | (existing) | Email notifications to vendors | Already configured in src/lib/resend.ts |
| Twilio | (existing) | SMS notifications to vendors | Already configured in src/lib/twilio.ts |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | (existing) | Icons for vendor/work order UI | Already installed |
| sonner | (existing) | Toast notifications | Already used in admin components |
| crypto (Node.js built-in) | N/A | Generate random UUID tokens for magic links | No install needed |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| UUID token for magic link | JWT with expiry | JWT adds complexity; UUID + DB lookup is simpler and revocable |
| Direct Resend/Twilio calls for vendor notification | sendNotification helper | sendNotification requires userId (vendor has no user account); direct calls are simpler |

**Installation:**
No new packages required. All dependencies already exist in the project.

## Architecture Patterns

### Recommended Project Structure

```
src/
├── db/schema/domain.ts          # ADD: vendors, workOrders, workOrderCosts tables
├── app/
│   ├── (admin)/admin/
│   │   ├── vendors/
│   │   │   └── page.tsx          # NEW: Vendor directory list + add/edit
│   │   ├── maintenance/
│   │   │   └── [id]/page.tsx     # EXISTING: Add "Create Work Order" button
│   │   └── work-orders/
│   │       ├── page.tsx          # NEW: Work order list
│   │       └── [id]/page.tsx     # NEW: Work order detail with costs
│   ├── api/admin/
│   │   ├── vendors/
│   │   │   ├── route.ts          # NEW: GET (list), POST (create)
│   │   │   └── [id]/route.ts     # NEW: GET (detail), PATCH (update), DELETE
│   │   └── work-orders/
│   │       ├── route.ts          # NEW: GET (list), POST (create from maintenance)
│   │       ├── [id]/route.ts     # NEW: GET, PATCH (status, assign vendor)
│   │       └── [id]/costs/route.ts # NEW: GET (list costs), POST (add cost)
│   └── vendor/                   # NEW: Public magic link route (no auth)
│       └── work-order/
│           └── [token]/page.tsx  # NEW: Limited-view page for vendors
├── lib/
│   └── vendor-notifications.ts   # NEW: Send email/SMS to vendor (not using sendNotification)
```

### Pattern 1: Admin CRUD API Route (Existing Pattern)

**What:** Standard admin API route pattern with session/role check, Drizzle query, JSON response.
**When to use:** All vendor and work order admin endpoints.
**Example:** (follows existing pattern from `/api/admin/maintenance/route.ts`)

```typescript
// src/app/api/admin/vendors/route.ts
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { db } from "@/db"
import { vendors } from "@/db/schema"
import { eq, desc } from "drizzle-orm"

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const result = await db.select().from(vendors).orderBy(desc(vendors.createdAt))
  return NextResponse.json({ vendors: result })
}
```

### Pattern 2: Magic Link Public Route (No Auth)

**What:** A public page that displays limited information using a token lookup. No authentication required. Token is a random UUID stored in the database.
**When to use:** Vendor work order view.
**Key security considerations:**
- Token is a random UUID (128-bit entropy) -- brute force infeasible
- Query only returns non-PII fields (description, category, photos, unit number)
- Never expose tenant name, email, phone, or payment info
- Admin can regenerate or revoke token (set to null)
- Token has no expiry (simpler than JWT); admin revokes manually if needed

```typescript
// src/app/vendor/work-order/[token]/page.tsx
// Server component -- fetches data server-side using token
export default async function VendorWorkOrderPage({
  params,
}: { params: Promise<{ token: string }> }) {
  const { token } = await params
  // Look up work order by vendorAccessToken
  // JOIN maintenance request, photos, unit (unitNumber only)
  // DO NOT JOIN user table or expose tenant PII
}
```

### Pattern 3: Direct Vendor Notification (Not sendNotification)

**What:** The existing `sendNotification` helper requires a `userId` and creates an in-app notification record. Vendors don't have user accounts, so we send email/SMS directly using Resend and Twilio.
**When to use:** When a vendor is assigned to a work order.

```typescript
// src/lib/vendor-notifications.ts
import { resend } from "@/lib/resend"
import { getTwilioClient } from "@/lib/twilio"

export async function notifyVendorAssignment(vendor: {
  email: string | null
  phone: string | null
  companyName: string
}, workOrderUrl: string, requestSummary: string) {
  // Email (if vendor has email)
  if (vendor.email) {
    void resend.emails.send({
      from: process.env.EMAIL_FROM || "RentalMgmt <noreply@rentalmgmt.com>",
      to: vendor.email,
      subject: `New Work Order Assignment`,
      html: `<p>You have been assigned a new work order...</p>
             <p><a href="${workOrderUrl}">View Details</a></p>`,
    })
  }
  // SMS (if vendor has phone)
  if (vendor.phone) {
    void getTwilioClient().messages.create({
      messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID!,
      to: vendor.phone,
      body: `New work order: ${requestSummary}. View details: ${workOrderUrl}`,
    })
  }
}
```

### Pattern 4: Per-Unit Expense Rollup Query

**What:** Aggregate work order costs per unit for expense tracking.
**When to use:** Admin expense reports, unit detail views.

```typescript
// Per-unit maintenance expense rollup
const expenses = await db
  .select({
    unitId: maintenanceRequests.unitId,
    unitNumber: units.unitNumber,
    totalCostCents: sql<number>`COALESCE(SUM(${workOrderCosts.amountCents}), 0)`,
    workOrderCount: sql<number>`COUNT(DISTINCT ${workOrders.id})`,
  })
  .from(workOrderCosts)
  .innerJoin(workOrders, eq(workOrderCosts.workOrderId, workOrders.id))
  .innerJoin(maintenanceRequests, eq(workOrders.maintenanceRequestId, maintenanceRequests.id))
  .innerJoin(units, eq(maintenanceRequests.unitId, units.id))
  .groupBy(maintenanceRequests.unitId, units.unitNumber)
```

### Anti-Patterns to Avoid

- **Giving vendors user accounts:** Out of scope. Magic link only. No login, no registration, no session.
- **Exposing tenant PII in magic link view:** The vendor page must NEVER show tenant name, email, phone, or payment data. Only show: category, description, photos, unit number, scheduled date.
- **Using sendNotification for vendors:** This helper requires a userId and creates in-app notification records. Vendors have no user accounts. Use direct Resend/Twilio calls.
- **Storing vendor access token as JWT:** A database-stored UUID is simpler, revocable without key rotation, and sufficient for this use case.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UUID generation | Custom random string | `crypto.randomUUID()` | Built-in, cryptographically secure |
| Email sending | Custom SMTP client | Resend (existing) | Already configured and working |
| SMS sending | Custom SMS integration | Twilio (existing) | Already configured with TCPA compliance |
| Form validation | Custom validators | Zod (if needed) or simple type checks | Project uses simple validation in API routes |
| File upload for receipts | New upload mechanism | S3 presigned URL flow (from Phase 7) | Will be available after Phase 7 completes |

## Common Pitfalls

### Pitfall 1: Exposing Tenant PII in Vendor View
**What goes wrong:** Magic link page accidentally shows tenant name/contact from JOINing the user table.
**Why it happens:** The maintenance request has a `tenantUserId` FK, and it's natural to JOIN to get context.
**How to avoid:** The vendor view query must explicitly select only safe columns. Never JOIN the user table. Only show: category, description, photos, unit number, work order notes, scheduled date.
**Warning signs:** Any reference to `user.name`, `user.email`, or `user.phone` in the vendor page component.

### Pitfall 2: Missing Token Regeneration
**What goes wrong:** Vendor access token cannot be revoked or regenerated after sharing.
**Why it happens:** Only creating the token on work order creation, no admin action to regenerate.
**How to avoid:** Add "Regenerate Link" and "Revoke Link" actions on the work order detail page.

### Pitfall 3: Work Order Without Maintenance Request
**What goes wrong:** Creating work orders disconnected from maintenance requests.
**Why it happens:** Over-engineering the data model for standalone work orders.
**How to avoid:** Work orders always require a `maintenanceRequestId`. Every work order originates from a maintenance request. This keeps the model simple and the data relationship clear.

### Pitfall 4: Cascade Delete on Vendor
**What goes wrong:** Deleting a vendor removes all their work orders and cost records.
**Why it happens:** Using `onDelete: "cascade"` on the vendor FK in workOrders.
**How to avoid:** Use `onDelete: "set null"` on `workOrders.vendorId`. When a vendor is deleted/archived, their past work orders retain cost data. Alternatively, soft-delete vendors (status = "inactive") rather than hard delete.

### Pitfall 5: Not Using Existing Photo Serving Paths
**What goes wrong:** Building a separate photo serving mechanism for the vendor view.
**Why it happens:** Assuming vendor needs different photo access.
**How to avoid:** The existing `/api/uploads/[...path]` route requires auth. For the vendor magic link page, use a server component that fetches photos server-side and serves them. Or create a token-gated photo proxy route: `/api/vendor/photos/[token]/[photoId]`.

## Code Examples

### Schema Definitions (for domain.ts)

```typescript
// Vendor directory
export const vendors = pgTable("vendors", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyName: text("company_name").notNull(),
  contactName: text("contact_name"),
  email: text("email"),
  phone: text("phone"),
  specialty: text("specialty", {
    enum: ["plumbing", "electrical", "hvac", "appliance", "pest_control",
           "general_maintenance", "painting", "cleaning", "landscaping", "other"],
  }),
  notes: text("notes"),
  status: text("status", { enum: ["active", "inactive"] }).default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

// Work orders linking vendors to maintenance requests
export const workOrders = pgTable("work_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  maintenanceRequestId: uuid("maintenance_request_id")
    .references(() => maintenanceRequests.id, { onDelete: "restrict" })
    .notNull(),
  vendorId: uuid("vendor_id")
    .references(() => vendors.id, { onDelete: "set null" }),
  assignedByUserId: text("assigned_by_user_id").notNull(),
  status: text("status", {
    enum: ["assigned", "scheduled", "in_progress", "completed", "cancelled"],
  }).default("assigned").notNull(),
  priority: text("priority", {
    enum: ["low", "medium", "high", "emergency"],
  }).default("medium").notNull(),
  scheduledDate: timestamp("scheduled_date"),
  completedDate: timestamp("completed_date"),
  notes: text("notes"),
  vendorAccessToken: text("vendor_access_token").unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

// Cost line items on work orders
export const workOrderCosts = pgTable("work_order_costs", {
  id: uuid("id").primaryKey().defaultRandom(),
  workOrderId: uuid("work_order_id")
    .references(() => workOrders.id, { onDelete: "cascade" })
    .notNull(),
  description: text("description").notNull(),
  amountCents: integer("amount_cents").notNull(),
  category: text("category", {
    enum: ["labor", "materials", "permits", "other"],
  }).notNull(),
  receiptPath: text("receipt_path"),  // S3 key for receipt upload (Phase 7)
  createdAt: timestamp("created_at").defaultNow().notNull(),
})
```

### Vendor Photo Access for Magic Link

The vendor magic link page is a server component. Photos are stored locally (or in S3 after Phase 7). For the vendor view, photos need to be accessible without auth. Options:

**Option A: Token-gated photo proxy route (Recommended)**
```typescript
// src/app/api/vendor/photos/[token]/[photoId]/route.ts
// Validates token, fetches photo from storage, serves with caching
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string; photoId: string }> }
) {
  const { token, photoId } = await params
  // Validate token matches a work order
  // Fetch photo record, verify it belongs to the maintenance request
  // Serve from local storage or S3
}
```

**Option B: Server component with inline data**
Photos rendered server-side as base64 in img tags. Simple but increases page size.

Option A is recommended for performance and cacheability.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Vendor portal with login | Magic link (token-based) | Project decision | No vendor auth needed, much simpler |
| Local file storage | S3 presigned URLs (Phase 7) | Phase 7 | Receipt uploads use S3 |
| HTTP Neon driver (no transactions) | WebSocket driver (Phase 7) | Phase 7 | Work order creation can be transactional |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright |
| Config file | playwright.config.ts |
| Quick run command | `npx playwright test e2e/vendors.spec.ts --headed` |
| Full suite command | `npx playwright test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OPS-01 | Admin can CRUD vendors | E2E | `npx playwright test e2e/vendors.spec.ts` | Wave 0 |
| OPS-02 | Admin assigns vendor to maintenance request | E2E | `npx playwright test e2e/work-orders.spec.ts` | Wave 0 |
| OPS-03 | Magic link shows request details without PII | E2E | `npx playwright test e2e/vendor-magic-link.spec.ts` | Wave 0 |
| OPS-04 | Record costs with per-unit rollup | E2E | `npx playwright test e2e/work-order-costs.spec.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx playwright test e2e/vendors.spec.ts --headed`
- **Per wave merge:** `npx playwright test`
- **Phase gate:** Full suite green before verification

### Wave 0 Gaps
- [ ] `e2e/vendors.spec.ts` -- covers OPS-01
- [ ] `e2e/work-orders.spec.ts` -- covers OPS-02
- [ ] `e2e/vendor-magic-link.spec.ts` -- covers OPS-03
- [ ] `e2e/work-order-costs.spec.ts` -- covers OPS-04

## Open Questions

1. **Photo access for vendor magic link page**
   - What we know: Photos are served via `/api/uploads/[...path]` which requires auth. Vendors have no auth.
   - What's unclear: Whether to build a token-gated photo proxy or use server-side rendering with base64.
   - Recommendation: Token-gated photo proxy route at `/api/vendor/photos/[token]/[photoId]` -- cleaner, cacheable.

2. **S3 receipt uploads dependency on Phase 7**
   - What we know: Phase 7 introduces S3 presigned URL flow. Work order cost receipts should use S3.
   - What's unclear: Exact S3 helper API surface after Phase 7.
   - Recommendation: Plan for `receiptPath` as an S3 key string. If Phase 7 is complete, use its presigned URL helpers. If not, receipt upload can be deferred or use local storage as fallback.

3. **Optional: Bill tenant for maintenance costs**
   - What we know: Phase 8 introduces charges table. Work order costs could optionally generate a tenant charge.
   - What's unclear: Whether this is in scope for Phase 12 OPS-04.
   - Recommendation: OPS-04 only requires recording costs and per-unit rollup. Billing tenant is a future enhancement, not required.

## Sources

### Primary (HIGH confidence)
- Existing codebase inspection: `src/db/schema/domain.ts`, `src/app/api/admin/maintenance/route.ts`, `src/lib/notifications.ts`, `src/components/admin/AdminMaintenanceDetail.tsx`
- Architecture research: `.planning/research/ARCHITECTURE.md` -- Section 6 (Vendor/Work-Order Data Model)

### Secondary (MEDIUM confidence)
- Drizzle ORM pgTable patterns -- verified against existing domain.ts usage
- Resend/Twilio direct invocation patterns -- verified against existing notifications.ts

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries, all patterns exist in codebase
- Architecture: HIGH -- schema design documented in ARCHITECTURE.md, follows existing patterns
- Pitfalls: HIGH -- PII exposure and cascade delete are well-understood risks

**Research date:** 2026-02-26
**Valid until:** 2026-03-26 (stable domain, no fast-moving dependencies)
