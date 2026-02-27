# Architecture Research: RentalMgmt v2.0 Integration

**Domain:** Property management SaaS -- subsequent milestone adding financial ledger, cloud storage, edge auth, portfolio CRUD, tenant lifecycle, admin UX overhaul, and vendor/work-order management
**Researched:** 2026-02-26
**Confidence:** HIGH (based on existing codebase inspection + verified library documentation)

## Existing Architecture Snapshot

```
                          EDGE RUNTIME
 ┌──────────────────────────────────────────────────┐
 │  middleware.ts                                    │
 │  getSessionCookie() -> cookie existence check     │
 │  Redirects: unauth -> /auth/login                 │
 │             auth + /auth/* -> /tenant/dashboard   │
 └──────────────────────┬───────────────────────────┘
                        │
                   NODE RUNTIME
 ┌──────────────────────┴───────────────────────────┐
 │  App Router                                       │
 │  ┌────────────────┐  ┌─────────────────┐          │
 │  │ (admin)/admin/ │  │ (tenant)/tenant/ │          │
 │  │ layout.tsx     │  │ layout.tsx       │          │
 │  │ role check via │  │ session check    │          │
 │  │ getSession()   │  │ via getSession() │          │
 │  └───────┬────────┘  └────────┬─────────┘          │
 │          │                    │                    │
 │  ┌───────┴────────────────────┴─────────┐          │
 │  │  API Routes                           │          │
 │  │  /api/auth/*       (Better Auth)      │          │
 │  │  /api/cron/*       (CRON_SECRET)      │          │
 │  │  /api/webhooks/*   (Stripe/Twilio)    │          │
 │  │  /api/uploads/*    (auth-gated files) │          │
 │  │  /api/admin/*      (admin actions)    │          │
 │  └───────┬───────────────────────────────┘          │
 │          │                                         │
 │  ┌───────┴───────────────────────────────┐          │
 │  │  Shared Services                       │          │
 │  │  src/lib/auth.ts        (Better Auth)  │          │
 │  │  src/lib/stripe.ts      (Stripe proxy) │          │
 │  │  src/lib/notifications.ts (dispatch)   │          │
 │  │  src/lib/uploads.ts     (local fs)     │          │
 │  │  src/lib/resend.ts      (email)        │          │
 │  │  src/lib/twilio.ts      (SMS)          │          │
 │  └───────┬───────────────────────────────┘          │
 └──────────┼────────────────────────────────────────┘
            │
 ┌──────────┴────────────────────────────────────────┐
 │  Data Layer                                        │
 │  src/db/index.ts      (lazy Neon HTTP proxy)       │
 │  src/db/schema/auth.ts   (user, session, account)  │
 │  src/db/schema/domain.ts (properties, units, ...)  │
 │                                                    │
 │  External: Neon PostgreSQL (HTTP driver)            │
 │            Local uploads/ directory                 │
 │            Stripe, Resend, Twilio                   │
 └────────────────────────────────────────────────────┘
```

### Current Component Responsibilities

| Component | Responsibility | Key Detail |
|-----------|----------------|------------|
| middleware.ts | Auth gate at edge | Only checks cookie existence via `getSessionCookie()`, no role info |
| (admin) layout.tsx | Admin role enforcement | Server-side `auth.api.getSession()` + `role !== "admin"` redirect |
| (tenant) layout.tsx | Tenant session enforcement | Server-side `auth.api.getSession()` check |
| src/lib/auth.ts | Better Auth config | email/password, admin plugin, invite hook, drizzle adapter |
| src/lib/uploads.ts | Local file storage | UUID filenames, 25MB max, writes to `uploads/` on disk |
| src/db/schema/domain.ts | All domain tables | properties, units, tenantUnits, payments, maintenance, documents, notifications, autopayEnrollments |
| API cron routes | Scheduled jobs | CRON_SECRET bearer auth, `new Date()` for timezone (server-local) |
| Stripe webhook | Payment events | checkout.session.*, payment_intent.* handlers |

---

## Integration Architecture: New Features

### 1. Charges/Ledger Table Alongside Existing Payments

**Confidence:** HIGH

**Problem:** The current `payments` table records money received. There is no concept of money owed. The system compares `payments.succeeded` against `units.rentAmountCents` to infer whether rent is paid, but cannot express partial payments, late fees, credits, or carry-forward balances.

**Design: Single-ledger (not double-entry) with a `charges` table**

Full double-entry accounting is overkill for a 5-unit property manager. Use a simplified charge-and-payment ledger.

```
┌─────────────┐         ┌──────────────┐
│   charges    │ 1:many  │   payments   │
│              │<--------│ (existing)   │
│ id           │         │ id           │
│ tenantUserId │         │ chargeId(new)│  <- FK links payment to charge
│ unitId       │         │ ...existing  │
│ type (enum)  │         └──────────────┘
│ amountCents  │
│ description  │
│ billingPeriod│
│ dueDate      │
│ status       │
│ createdAt    │
└─────────────┘
```

**New `charges` table:**

```typescript
export const charges = pgTable("charges", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantUserId: text("tenant_user_id").notNull(),
  unitId: uuid("unit_id")
    .references(() => units.id, { onDelete: "cascade" })
    .notNull(),
  type: text("type", {
    enum: ["rent", "late_fee", "utility", "maintenance", "other"],
  }).notNull(),
  description: text("description"),
  amountCents: integer("amount_cents").notNull(),
  billingPeriod: text("billing_period").notNull(), // "2026-03"
  dueDate: timestamp("due_date").notNull(),
  status: text("status", {
    enum: ["pending", "partial", "paid", "void", "credited"],
  }).default("pending").notNull(),
  paidAmountCents: integer("paid_amount_cents").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})
```

**Modifications to existing `payments` table (additive only):**

```typescript
// ADD this column to existing payments table (nullable for backward compat):
chargeId: uuid("charge_id").references(() => charges.id),
```

**Running balance pattern:**

Compute balance on read, not stored. Use a Drizzle query:

```typescript
// Running balance = SUM(charges.amountCents) - SUM(payments.amountCents WHERE succeeded)
// Per tenant-unit, filtered by billingPeriod
async function getTenantBalance(tenantUserId: string, unitId: string): Promise<number> {
  const [result] = await db
    .select({
      totalCharged: sql<number>`COALESCE(SUM(${charges.amountCents}), 0)`,
    })
    .from(charges)
    .where(
      and(
        eq(charges.tenantUserId, tenantUserId),
        eq(charges.unitId, unitId),
        ne(charges.status, "void"),
      )
    )

  const [paid] = await db
    .select({
      totalPaid: sql<number>`COALESCE(SUM(${payments.amountCents}), 0)`,
    })
    .from(payments)
    .where(
      and(
        eq(payments.tenantUserId, tenantUserId),
        eq(payments.unitId, unitId),
        eq(payments.status, "succeeded"),
      )
    )

  return result.totalCharged - paid.totalPaid
}
```

**Data flow changes:**

1. Cron job creates `charges` records monthly (rent charges auto-generated on due date)
2. Late fee cron creates `charges` of type `late_fee` based on configurable rules
3. Stripe webhook updates `charges.paidAmountCents` and `charges.status` alongside `payments` insert
4. Admin can create manual charges (utility, maintenance, other)
5. Admin can void charges (sets status to `void`, no delete)

**Migration strategy:** Additive. New `charges` table, new nullable `chargeId` column on `payments`. Backfill existing payments into charges if needed (one-time migration script). No existing column changes.

---

### 2. S3 Presigned URL Flow Replacing Local Uploads

**Confidence:** HIGH

**Recommendation: Use Cloudflare R2** (S3-compatible) because zero egress fees are significant for serving tenant document downloads. The `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` packages work identically with R2.

**Current flow (local):**

```
Client -> POST /api/maintenance (multipart) -> saveUploadedFile() -> uploads/ disk
Client -> GET /api/uploads/[...path] -> readFile() from uploads/ disk
```

**New flow (S3/R2):**

```
                        ┌─────────────────────┐
                        │  1. Request upload   │
                        │  POST /api/uploads/  │
                        │  presign             │
Client ─────────────────┤                     │
                        │  Returns:            │
                        │  - presignedUrl      │
                        │  - objectKey         │
                        └─────────┬───────────┘
                                  │
                        ┌─────────┴───────────┐
                        │  2. PUT directly to  │
Client ─────────────────│  S3/R2 presigned URL │
                        │  (bypasses server)   │
                        └─────────┬───────────┘
                                  │
                        ┌─────────┴───────────┐
                        │  3. Confirm upload   │
                        │  POST /api/uploads/  │
Client ─────────────────│  confirm             │
                        │  Saves DB record     │
                        │  with S3 key         │
                        └─────────────────────┘

Download:
                        ┌─────────────────────┐
                        │  GET /api/uploads/   │
Client ─────────────────│  [id]/download       │
                        │  Auth check ->       │
                        │  Generate GET        │
                        │  presigned URL ->    │
                        │  302 redirect        │
                        └─────────────────────┘
```

**New service: `src/lib/s3.ts`**

```typescript
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

let _client: S3Client | null = null

function getS3Client(): S3Client {
  if (!_client) {
    _client = new S3Client({
      region: "auto", // R2 uses "auto"
      endpoint: process.env.S3_ENDPOINT!, // R2: https://<account>.r2.cloudflarestorage.com
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID!,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
      },
    })
  }
  return _client
}

export async function createPresignedUploadUrl(
  key: string, contentType: string
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET!,
    Key: key,
    ContentType: contentType,
  })
  return getSignedUrl(getS3Client(), command, { expiresIn: 120 }) // 2 min
}

export async function createPresignedDownloadUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: process.env.S3_BUCKET!,
    Key: key,
  })
  return getSignedUrl(getS3Client(), command, { expiresIn: 3600 }) // 1 hour
}
```

**Schema changes (additive):**

The `maintenancePhotos.filePath` and `documents.filePath` columns currently store relative paths like `maintenance/uuid.jpg`. After migration, they will store S3 keys like `maintenance/uuid.jpg` -- the format is intentionally identical, only the storage backend changes.

Add a `storageBackend` column to distinguish legacy local files from new S3 files during transition:

```typescript
// Add to maintenancePhotos and documents tables:
storageBackend: text("storage_backend", { enum: ["local", "s3"] })
  .default("s3")
  .notNull(),
```

**API changes:**

| Current Route | New Route | Change |
|---------------|-----------|--------|
| POST /api/maintenance (multipart) | POST /api/uploads/presign | New route: returns presigned PUT URL |
| -- | POST /api/uploads/confirm | New route: saves file metadata to DB |
| GET /api/uploads/[...path] | GET /api/uploads/[id]/download | Modified: auth check + presigned GET URL redirect |

**Migration strategy:**

1. Add `storageBackend` column (default `"s3"`)
2. Backfill existing rows: `UPDATE maintenance_photos SET storage_backend = 'local'`
3. Update `GET /api/uploads` to check `storageBackend`: if `local`, serve from disk (existing logic); if `s3`, generate presigned download URL
4. New uploads always use S3
5. Eventually migrate existing files to S3 and remove local serving code

---

### 3. JWT Role Claims in Better Auth for Edge Middleware

**Confidence:** MEDIUM (Better Auth cookie cache is evolving; edge compatibility has known issues per GitHub issue #5120)

**Current state:** The middleware uses `getSessionCookie()` which only checks cookie existence -- it cannot read role, so all authenticated users reach the layout, where Node.js server-side `getSession()` does the actual role check via DB lookup.

**Goal:** Reject non-admin users at the edge before they hit the admin layout server component, saving compute and improving response time.

**Approach: Enable Better Auth cookie caching with role in session data**

Better Auth's cookie cache serializes session + user data into a signed cookie (`session_data`). The admin plugin adds `role` to the user object, so it gets included in the cached cookie automatically (plugin-provided fields are included since Better Auth v1.3.5+).

**Configuration change in `src/lib/auth.ts`:**

```typescript
export const auth = betterAuth({
  // ...existing config...
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
      strategy: "jwt", // Use JWT for edge-decodable tokens
    },
  },
  // ...rest of config...
})
```

**Edge middleware approach -- decode JWT cookie directly:**

Since `getCookieCache()` is NOT Edge-compatible (references `process.platform`, see GitHub issue #5120), decode the JWT cookie manually in middleware:

```typescript
// middleware.ts
import { NextRequest, NextResponse } from "next/server"
import { jwtVerify } from "jose" // lightweight, edge-compatible

const JWT_SECRET = new TextEncoder().encode(process.env.BETTER_AUTH_SECRET!)

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const sessionToken = request.cookies.get("better-auth.session_token")
  const sessionData = request.cookies.get("better-auth.session_data")

  // No session cookie -> redirect to login for protected routes
  if (!sessionToken) {
    if (pathname.startsWith("/tenant") || pathname.startsWith("/admin")) {
      const loginUrl = new URL("/auth/login", request.url)
      loginUrl.searchParams.set("callbackUrl", pathname)
      return NextResponse.redirect(loginUrl)
    }
    return NextResponse.next()
  }

  // For admin routes: try to read role from cached session data
  if (pathname.startsWith("/admin") && sessionData) {
    try {
      const { payload } = await jwtVerify(sessionData.value, JWT_SECRET)
      const user = payload.user as { role?: string }
      if (user?.role !== "admin") {
        return NextResponse.redirect(new URL("/tenant/dashboard", request.url))
      }
    } catch {
      // JWT decode failed (expired, tampered) -- fall through to layout check
    }
  }

  // Authenticated users on /auth/* -> redirect to dashboard
  if (pathname === "/auth/login" || pathname === "/auth/register") {
    return NextResponse.redirect(new URL("/tenant/dashboard", request.url))
  }

  return NextResponse.next()
}
```

**Important caveat:** The cookie cache is short-lived (5 min). If the JWT is expired or absent, the edge middleware simply passes through and the layout server component does the authoritative check. This is defense-in-depth, not sole authorization.

**Dependencies:** Add `jose` package (lightweight JWT library, fully Edge-compatible, no Node.js APIs).

**Fallback:** If Better Auth's cookie cache format proves incompatible with manual JWT decoding, the layout-level role check remains the security boundary. The edge check is an optimization, not a requirement. Verify the exact JWT payload structure during implementation by inspecting the `session_data` cookie content.

---

### 4. Timezone Handling in Cron Jobs

**Confidence:** HIGH

**Current state:** The cron job uses `new Date()` which gives server-local time. For a single property in one timezone, this works fine. But the PROJECT.md notes "portfolio might grow -- more properties could be added down the road," potentially across timezones.

**Design: Property-level timezone column**

```typescript
// Add to properties table:
timezone: text("timezone").default("America/New_York").notNull(),
// IANA timezone string, e.g., "America/New_York", "America/Chicago"
```

**Cron job modification pattern:**

```typescript
// In rent-reminders/route.ts and autopay-charge/route.ts:
// Instead of:
const today = new Date()
const currentDay = today.getDate()

// Use property timezone:
// Query includes property join to get timezone
const activeLinks = await db
  .select({
    // ...existing fields...
    timezone: properties.timezone,
  })
  .from(tenantUnits)
  .innerJoin(units, eq(units.id, tenantUnits.unitId))
  .innerJoin(properties, eq(properties.id, units.propertyId))
  .where(eq(tenantUnits.isActive, true))

// Per-tenant timezone conversion:
for (const link of activeLinks) {
  const now = new Date()
  // Convert UTC "now" to property-local date
  const localDate = new Intl.DateTimeFormat("en-US", {
    timeZone: link.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now)

  const [month, day, year] = localDate.split("/")
  const currentDay = parseInt(day, 10)
  const currentPeriod = `${year}-${month}`
  // ...rest of logic uses currentDay and currentPeriod...
}
```

**No external libraries needed.** `Intl.DateTimeFormat` is built into Node.js and handles DST transitions correctly. The cron job itself still runs on a fixed UTC schedule (e.g., every hour or every 15 minutes), but each tenant's due-day comparison uses property-local time.

**Cron frequency change:** Currently daily is sufficient for a single timezone. With timezone awareness, the cron should run more frequently (hourly or every 6 hours) to catch due dates across different US timezones. Even hourly, the idempotency check on notifications prevents duplicates.

**Migration:** Add `timezone` column to `properties` with default `"America/New_York"` (matches current single-property deployment). Non-breaking.

---

### 5. Admin Sidebar + Dashboard Layout Changes

**Confidence:** HIGH

**Current state:** The admin layout uses a horizontal top nav bar with inline links. All links are visible regardless of screen size (no responsive handling). No KPI dashboard -- just a simple data listing.

**Target:** Persistent collapsible sidebar + KPI dashboard with cards.

**Approach: Use shadcn/ui Sidebar component**

shadcn/ui has an official Sidebar component (`npx shadcn@latest add sidebar`) that provides:
- Collapsible modes: `offcanvas`, `icon`, or `none`
- Responsive: auto-collapses on mobile into a Sheet drawer
- Composable: SidebarProvider, SidebarHeader, SidebarContent, SidebarGroup, SidebarMenuItem, SidebarTrigger

**Layout restructure:**

```
BEFORE:
┌──────────────────────────────────────┐
│ Header: "Admin Portal" | email      │
├──────────────────────────────────────┤
│ Nav: Dashboard Units Payments ...   │
├──────────────────────────────────────┤
│                                      │
│              Content                 │
│                                      │
└──────────────────────────────────────┘

AFTER:
┌────────┬─────────────────────────────┐
│        │  Header: breadcrumbs | user │
│ Logo   ├─────────────────────────────┤
│        │                             │
│ Nav    │         Content             │
│ items  │                             │
│        │                             │
│ ────── │                             │
│ (group │                             │
│ labels)│                             │
│        │                             │
│ ────── │                             │
│ user   │                             │
│ footer │                             │
└────────┴─────────────────────────────┘
```

**Implementation in `src/app/(admin)/layout.tsx`:**

The layout becomes a `SidebarProvider` wrapping a `Sidebar` and main content area. Key changes:

1. Wrap children in `SidebarProvider` + `Sidebar`
2. Move nav links from horizontal bar to sidebar menu items
3. Add `SidebarTrigger` for mobile collapse
4. Group sidebar items logically:
   - Overview: Dashboard
   - Properties: Units (future: Properties CRUD)
   - Tenants: Users, Invites
   - Financial: Payments, Ledger
   - Operations: Maintenance, Vendors, Work Orders
   - Communication: Notifications, Broadcast
   - Documents

**New shadcn components to install:**
- `sidebar` (the main component)
- `breadcrumb` (for header navigation context)
- `sheet` (sidebar dependency for mobile drawer)
- `tooltip` (for collapsed icon-only mode)
- `separator` (for visual grouping)

**KPI Dashboard cards:**

| Card | Data Source | Query |
|------|------------|-------|
| Total Revenue (month) | `payments` WHERE status=succeeded AND billingPeriod=current | SUM(amountCents) |
| Outstanding Balance | `charges` - `payments` per tenant | Aggregate balance |
| Occupancy Rate | `tenantUnits` WHERE isActive=true / total units | COUNT ratio |
| Open Maintenance | `maintenanceRequests` WHERE status != resolved | COUNT |
| Overdue Payments | `charges` WHERE status=pending AND dueDate < now | COUNT |
| Autopay Enrollment | `autopayEnrollments` WHERE status=active / total tenants | COUNT ratio |

---

### 6. Vendor/Work-Order Data Model Additions

**Confidence:** HIGH

**Design: Three new tables -- `vendors`, `workOrders`, `workOrderCosts`**

```
┌──────────────────┐     ┌──────────────────────┐
│    vendors       │     │ maintenanceRequests   │
│                  │     │ (existing)            │
│ id               │     │                       │
│ companyName      │     │ id                    │
│ contactName      │     └──────────┬────────────┘
│ email            │                │
│ phone            │     ┌──────────┴────────────┐
│ specialty (enum) │     │    workOrders          │
│ notes            │     │                       │
│ status (enum)    │     │ id                    │
│ createdAt        │<────│ vendorId (FK)         │
│ updatedAt        │     │ maintenanceRequestId  │
└──────────────────┘     │ assignedByUserId      │
                         │ status (enum)         │
                         │ scheduledDate         │
                         │ completedDate         │
                         │ notes                 │
                         │ vendorAccessToken     │
                         │ createdAt             │
                         │ updatedAt             │
                         └──────────┬────────────┘
                                    │
                         ┌──────────┴────────────┐
                         │  workOrderCosts        │
                         │                       │
                         │ id                    │
                         │ workOrderId (FK)      │
                         │ description           │
                         │ amountCents           │
                         │ category (enum)       │
                         │ receiptPath           │
                         │ createdAt             │
                         └───────────────────────┘
```

**Schema definitions:**

```typescript
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
  status: text("status", {
    enum: ["active", "inactive"],
  }).default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const workOrders = pgTable("work_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  maintenanceRequestId: uuid("maintenance_request_id")
    .references(() => maintenanceRequests.id, { onDelete: "cascade" })
    .notNull(),
  vendorId: uuid("vendor_id")
    .references(() => vendors.id, { onDelete: "set null" }),
  assignedByUserId: text("assigned_by_user_id").notNull(), // admin who created it
  status: text("status", {
    enum: ["draft", "assigned", "scheduled", "in_progress", "completed", "cancelled"],
  }).default("draft").notNull(),
  priority: text("priority", {
    enum: ["low", "medium", "high", "emergency"],
  }).default("medium").notNull(),
  scheduledDate: timestamp("scheduled_date"),
  completedDate: timestamp("completed_date"),
  notes: text("notes"),
  vendorAccessToken: text("vendor_access_token"), // limited-view sharing token
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

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
  receiptPath: text("receipt_path"), // S3 key for receipt upload
  createdAt: timestamp("created_at").defaultNow().notNull(),
})
```

**Integration with existing maintenance flow:**

1. Admin views a maintenance request and clicks "Create Work Order"
2. Optionally assigns a vendor from the vendor list
3. Vendor access token generates a public URL for vendor-only view (no auth required, read-only, time-limited)
4. Admin tracks costs against the work order
5. Work order costs can optionally generate a `charges` record for the tenant (maintenance charge type)

**Vendor limited-view sharing:**

```
/vendor/work-order/[token]  (public route, no auth)
  - Shows: maintenance request description, photos, unit number (no tenant PII)
  - Does NOT show: tenant name, contact info, payment info
  - Token is a random UUID stored in workOrders.vendorAccessToken
  - Admin can regenerate or revoke token
```

---

## Recommended Project Structure (New/Modified Files)

```
src/
├── db/
│   └── schema/
│       ├── auth.ts                    # (unchanged)
│       ├── domain.ts                  # ADD: charges, vendors, workOrders, workOrderCosts
│       │                              # MODIFY: payments (add chargeId)
│       │                              # MODIFY: maintenancePhotos, documents (add storageBackend)
│       │                              # MODIFY: properties (add timezone)
│       └── index.ts                   # (unchanged)
├── lib/
│   ├── auth.ts                        # MODIFY: add session.cookieCache config
│   ├── s3.ts                          # NEW: S3/R2 client with presigned URL helpers
│   ├── uploads.ts                     # DEPRECATE (keep for local fallback during transition)
│   ├── ledger.ts                      # NEW: charge creation, balance computation, late fee logic
│   ├── stripe.ts                      # (unchanged)
│   ├── notifications.ts              # (unchanged)
│   └── ...
├── app/
│   ├── (admin)/
│   │   ├── layout.tsx                 # REWRITE: sidebar layout
│   │   └── admin/
│   │       ├── dashboard/page.tsx     # REWRITE: KPI cards
│   │       ├── properties/            # NEW: property CRUD
│   │       │   └── page.tsx
│   │       ├── vendors/               # NEW: vendor CRUD
│   │       │   ├── page.tsx
│   │       │   └── [id]/page.tsx
│   │       ├── work-orders/           # NEW: work order management
│   │       │   ├── page.tsx
│   │       │   └── [id]/page.tsx
│   │       ├── ledger/                # NEW: charges/ledger view
│   │       │   └── page.tsx
│   │       └── ...existing routes
│   ├── api/
│   │   ├── uploads/
│   │   │   ├── presign/route.ts       # NEW: presigned upload URL
│   │   │   ├── confirm/route.ts       # NEW: confirm upload + save metadata
│   │   │   ├── [id]/
│   │   │   │   └── download/route.ts  # NEW: auth-gated presigned download
│   │   │   └── [...path]/route.ts     # KEEP: legacy local file serving (transition)
│   │   ├── cron/
│   │   │   ├── generate-charges/route.ts  # NEW: monthly charge generation
│   │   │   ├── late-fees/route.ts         # NEW: late fee charge creation
│   │   │   └── ...existing cron routes (MODIFY for timezone awareness)
│   │   └── admin/
│   │       ├── vendors/route.ts       # NEW
│   │       ├── work-orders/route.ts   # NEW
│   │       ├── charges/route.ts       # NEW
│   │       └── ...existing admin routes
│   └── vendor/                        # NEW: public vendor work-order view
│       └── work-order/
│           └── [token]/page.tsx
└── middleware.ts                      # MODIFY: add JWT role check for /admin/*
```

---

## Architectural Patterns

### Pattern 1: Additive Schema Migration

**What:** All schema changes add new tables or nullable columns. No existing columns are renamed, removed, or have their types changed.

**When to use:** Every migration in v2.0.

**Trade-offs:** Slightly denormalized in places (e.g., `storageBackend` on photos/documents), but prevents any breaking changes to existing queries or deployed code.

**Migration ordering:**
```
Migration 1: charges table (no FK dependencies on new tables)
Migration 2: payments.chargeId column (nullable FK to charges)
Migration 3: properties.timezone column (with default)
Migration 4: maintenancePhotos.storageBackend, documents.storageBackend
Migration 5: vendors table
Migration 6: workOrders table (depends on vendors + maintenanceRequests)
Migration 7: workOrderCosts table (depends on workOrders)
```

All migrations can be combined into a single `drizzle-kit generate` run since Drizzle handles dependency ordering automatically. The numbered sequence above represents the logical dependency order, not necessarily separate migration files.

### Pattern 2: Presigned URL Upload (Client-Direct)

**What:** Client uploads directly to S3/R2 using a short-lived presigned URL, bypassing the server for file data transfer.

**When to use:** All file uploads (maintenance photos, documents, receipt uploads).

**Trade-offs:**
- Pro: No server memory/bandwidth for file data, no 4.5MB Vercel serverless limit concern
- Pro: Larger file support without server constraints
- Con: Two-step process (presign + confirm) adds client complexity
- Con: Orphaned uploads if confirm step fails (mitigate with S3 lifecycle rules to delete unconfirmed objects after 24h)

### Pattern 3: Defense-in-Depth Auth

**What:** Edge middleware provides fast role rejection using cached JWT; layout server component provides authoritative session validation via database lookup.

**When to use:** Admin route protection.

**Trade-offs:**
- Pro: Non-admin users rejected in ~5ms at edge (no server component render)
- Pro: If JWT is expired/missing, falls through safely to layout check
- Con: Adds `jose` dependency, requires `BETTER_AUTH_SECRET` available at edge
- Con: Cookie cache format may change between Better Auth versions -- must verify during implementation

### Pattern 4: Computed Balance (No Stored Balance Column)

**What:** Tenant balance is always computed from `SUM(charges) - SUM(payments)` rather than stored in a denormalized column.

**When to use:** All balance displays, ledger views, payment checks.

**Trade-offs:**
- Pro: No stale data, no consistency bugs from failed updates
- Pro: Simple audit trail -- just examine charges and payments tables
- Con: Slightly more expensive queries (mitigate with composite index on `(tenant_user_id, unit_id)`)
- Note: At 5-50 units, query cost is negligible. If portfolio grows to 1000+ units, consider a materialized view.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Modifying Existing Column Types

**What people do:** Change `payments.billingPeriod` from text to date, or rename columns to match new naming conventions.

**Why it is wrong:** Breaks existing Drizzle queries, requires coordinated code+schema deployment, risks data loss during type conversion.

**Do this instead:** Add new columns alongside existing ones. If a new format is needed, add a new column and backfill. Mark old column as deprecated in code comments.

### Anti-Pattern 2: Storing File Bytes in PostgreSQL

**What people do:** Store uploaded files as `bytea` columns to avoid S3 complexity.

**Why it is wrong:** Bloats database size, slows backups, Neon charges for storage, and cannot serve files at edge.

**Do this instead:** Always use S3/R2 for file storage. Store only the S3 key (string) in the database.

### Anti-Pattern 3: Trusting Edge-Decoded JWT as Sole Authorization

**What people do:** Remove the layout-level `getSession()` check and rely only on the edge JWT decode.

**Why it is wrong:** JWT cookie cache can be stale (up to `maxAge` seconds), user could be banned/deleted, role could change. Edge has no database access to verify.

**Do this instead:** Edge JWT is an optimization layer. Layout server component remains the authoritative auth check. Both must exist.

### Anti-Pattern 4: Full Double-Entry Accounting

**What people do:** Implement debits and credits with a journal table for a property management app.

**Why it is wrong:** Massive overengineering for a 5-unit building. Adds complexity without proportional value. Property management is not a general ledger.

**Do this instead:** Use a simple charges + payments model. Charges represent money owed, payments represent money received. Balance = charges - payments. This covers rent, late fees, maintenance costs, and credits.

---

## Data Flow Changes

### Monthly Charge Generation Flow

```
Cron (daily or hourly, UTC) -> /api/cron/generate-charges
    │
    ├─ For each active tenant-unit:
    │   ├─ JOIN properties to get timezone
    │   ├─ Convert UTC now to property-local date
    │   ├─ Is today the rentDueDay in local timezone?
    │   │   └─ YES: Check if charge already exists for this billingPeriod
    │   │       └─ NO existing charge: INSERT charges (type=rent)
    │   └─ NO: skip
    │
    └─ Return { created, skipped, errors }
```

### Payment + Charge Reconciliation Flow

```
Stripe Webhook -> /api/webhooks/stripe
    │
    ├─ checkout.session.completed:
    │   ├─ INSERT payments (existing logic)
    │   ├─ NEW: Find matching charge (tenantUserId + unitId + billingPeriod)
    │   ├─ UPDATE charges.paidAmountCents += payment.amountCents
    │   ├─ UPDATE charges.status = (paidAmountCents >= amountCents ? "paid" : "partial")
    │   └─ SET payments.chargeId = charge.id
    │
    ├─ payment_intent.succeeded (autopay):
    │   └─ Same charge reconciliation as above
    │
    └─ ...existing handlers unchanged
```

### Upload Flow (New)

```
Client                     Server                      S3/R2
  │                          │                           │
  │─── POST /api/uploads/    │                           │
  │    presign               │                           │
  │    {filename, type,      │                           │
  │     context, contextId}  │                           │
  │                          │── Auth check              │
  │                          │── Generate UUID key       │
  │                          │── PutObjectCommand        │
  │                          │── getSignedUrl()          │
  │<── {presignedUrl, key} ──│                           │
  │                          │                           │
  │───────── PUT file data ──┼──────────────────────────>│
  │<──────── 200 OK ─────────┼───────────────────────────│
  │                          │                           │
  │─── POST /api/uploads/    │                           │
  │    confirm               │                           │
  │    {key, filename, size, │                           │
  │     context, contextId}  │                           │
  │                          │── Auth check              │
  │                          │── HeadObject (verify)     │
  │                          │── INSERT db record        │
  │<── {id, downloadUrl} ────│                           │
```

---

## Scaling Considerations

| Concern | At 5 units (now) | At 50 units | At 500+ units |
|---------|-------------------|-------------|---------------|
| Balance computation | Simple query, < 5ms | Still fast with composite index | Consider materialized view refreshed hourly |
| Charge generation cron | ~5 charges/month | ~50 charges/month, one cron run | Batch processing, consider queue |
| S3 presigned URLs | Negligible cost | ~$0.005/1K PUT requests | Add CDN for frequently accessed files |
| Middleware JWT decode | Tiny `jose` decode ~1ms | Same | Same -- edge is stateless |
| Sidebar rendering | Server component, instant | Same | Same |
| Work order queries | Trivial | Add index on status | Add pagination |

---

## Integration Points

### External Services

| Service | Integration Pattern | v2.0 Changes |
|---------|---------------------|--------------|
| Stripe | Webhooks + API calls | Update webhook handler for charge reconciliation |
| S3/R2 (NEW) | Presigned URLs via `@aws-sdk/client-s3` | New service, new API routes |
| Neon PostgreSQL | Drizzle ORM over HTTP | New tables, new columns, no driver changes |
| Resend | Fire-and-forget email | No changes |
| Twilio | SMS via sendNotification | No changes |
| System Crontab | curl to CRON_SECRET routes | New cron routes for charges + late fees; modify existing for timezone |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Ledger <-> Payments | `charges` FK from `payments.chargeId` | Payments link to charges; charge status updated on payment webhook |
| S3 <-> Upload API | `src/lib/s3.ts` service | All S3 ops go through service layer, never direct SDK calls in routes |
| Vendors <-> Maintenance | `workOrders.maintenanceRequestId` FK | Work orders extend maintenance requests |
| Work Orders <-> Ledger | Admin action to generate charge from cost | Optional: admin clicks "bill tenant" on work order cost to create charge |
| Sidebar <-> Routes | URL pathname match for active state | Sidebar highlights active item based on `usePathname()` client hook |

---

## Suggested Build Order (Dependency-Driven)

```
Phase 1: Schema Foundation + S3 Storage
├── All schema additions in one migration batch
├── src/lib/s3.ts service
├── /api/uploads/presign + /api/uploads/confirm routes
├── Update uploads serving for dual-backend
├── Update maintenance photo + document upload flows
└── Rationale: Schema is the foundation; S3 is independent and unblocks
    receipt uploads for work orders later

Phase 2: Financial Ledger
├── src/lib/ledger.ts (charge creation, balance, late fees)
├── /api/cron/generate-charges + /api/cron/late-fees routes
├── Update Stripe webhook for charge reconciliation
├── Update autopay cron for charge reconciliation
├── Admin ledger/charges view page
├── Tenant balance display on dashboard
└── Rationale: Depends on charges table; heaviest business logic

Phase 3: Edge Auth + Timezone
├── Enable cookie cache in auth config
├── Add jose dependency
├── Update middleware.ts for JWT role decode
├── Update all cron routes for timezone-aware date computation
├── Admin API route protection audit
└── Rationale: Small scope, cross-cutting improvements

Phase 4: Admin UX Overhaul
├── Install shadcn sidebar + supporting components
├── Rewrite admin layout with sidebar
├── KPI dashboard cards (uses ledger data from Phase 2)
├── Property CRUD pages
├── Mobile-responsive polish
└── Rationale: Depends on ledger for KPI data; visual overhaul

Phase 5: Vendor + Work Orders + Tenant Lifecycle
├── Vendor CRUD pages
├── Work order management (create from maintenance request)
├── Work order cost tracking + receipt uploads (uses S3 from Phase 1)
├── Vendor limited-view sharing page
├── Tenant move-out workflow
├── Tenant unit transfer
├── Self-service invite token entry
└── Rationale: Depends on all prior phases; highest complexity
```

**Phase ordering rationale:**
- Schema must come first (all subsequent phases depend on new tables/columns)
- S3 in Phase 1 because receipt uploads in work orders (Phase 5) need it
- Ledger in Phase 2 because KPI dashboard (Phase 4) needs balance data
- Edge auth in Phase 3 because it is a small, self-contained improvement
- Admin UX in Phase 4 because the sidebar needs to include links to vendor/work-order pages (Phase 5), but those pages can use the new layout immediately when built
- Tenant lifecycle in Phase 5 because move-out needs ledger (final balance) and autopay cancellation

---

## Sources

- Better Auth Session Management: https://www.better-auth.com/docs/concepts/session-management (MEDIUM confidence -- cookie cache documented but edge compatibility caveats exist)
- Better Auth Edge Issue #5120: https://github.com/better-auth/better-auth/issues/5120 (HIGH confidence -- confirms getCookieCache NOT Edge-safe)
- Better Auth Admin Plugin: https://www.better-auth.com/docs/plugins/admin (HIGH confidence -- role management)
- Better Auth Cookie Cache Discussion #5066: https://github.com/better-auth/better-auth/discussions/5066 (MEDIUM confidence -- community workarounds for field inclusion)
- S3 Upload Pattern (Neon Guide): https://neon.com/guides/next-upload-aws-s3 (HIGH confidence -- matches project's Neon stack)
- Cloudflare R2 Presigned URLs: https://developers.cloudflare.com/r2/api/s3/presigned-urls/ (HIGH confidence -- official docs)
- Cloudflare R2 vs AWS S3: https://www.digitalapplied.com/blog/cloudflare-r2-vs-aws-s3-comparison (MEDIUM confidence -- cost comparison)
- Drizzle ORM Migrations: https://orm.drizzle.team/docs/migrations (HIGH confidence -- official docs)
- Drizzle ORM Migration Best Practices: https://medium.com/@bhagyarana80/8-drizzle-orm-patterns-for-clean-fast-migrations-456c4c35b9d8 (MEDIUM confidence)
- shadcn/ui Sidebar Component: https://ui.shadcn.com/docs/components/radix/sidebar (HIGH confidence -- official docs)
- shadcn Dashboard Template: https://vercel.com/templates/next.js/next-js-and-shadcn-ui-admin-dashboard (HIGH confidence -- official Vercel template)
- Session Caching Architecture: https://deepwiki.com/better-auth/better-auth/3.3-session-and-cookie-management (MEDIUM confidence)

---
*Architecture research for: RentalMgmt v2.0 Property Management Platform*
*Researched: 2026-02-26*
