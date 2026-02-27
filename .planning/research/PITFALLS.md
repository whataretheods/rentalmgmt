# Pitfalls Research

**Domain:** Property management portal v2.0 upgrade -- adding financial ledger, S3 storage, edge auth, portfolio CRUD, tenant lifecycle, admin UX overhaul, and vendor/work-order management to an existing production system
**Researched:** 2026-02-26
**Confidence:** HIGH -- Based on direct codebase analysis, official documentation (Stripe, AWS S3, Better Auth, Neon, Drizzle ORM), and verified community sources. Every pitfall maps to specific code in the existing system.

---

## Critical Pitfalls

Mistakes that cause data loss, broken payments, or production outages.

### Pitfall 1: Neon HTTP Driver Cannot Do Transactions -- Ledger Operations Will Silently Corrupt Data

**What goes wrong:**
The current `src/db/index.ts` uses `@neondatabase/serverless` with the HTTP driver (`neon()` + `drizzle-orm/neon-http`). This driver does NOT support `db.transaction()`. A financial ledger requires atomic multi-row operations: inserting a charge, creating ledger entries, and updating running balances must all succeed or all fail together. Without transactions, a crash between inserting a charge and updating the balance creates an inconsistent ledger -- the charge exists but the balance is wrong, and no amount of retrying fixes it.

**Why it happens:**
The Neon HTTP driver was the right choice for v1.0 -- it is faster for single queries in serverless environments. But it explicitly does not support interactive transactions. Developers discover this only when they call `db.transaction()` and get a runtime error: "No transactions support in neon-http driver."

**How to avoid:**
Switch from the Neon HTTP driver to the Neon WebSocket driver (`@neondatabase/serverless` with `Pool` + `drizzle-orm/neon-serverless`) before any ledger work begins. The WebSocket driver supports `db.transaction()` and is a drop-in replacement. Change `src/db/index.ts`:
```typescript
// BEFORE (current -- no transaction support)
import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
const sql = neon(databaseUrl)
const db = drizzle({ client: sql, schema })

// AFTER (WebSocket -- full transaction support)
import { Pool } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-serverless"
const pool = new Pool({ connectionString: databaseUrl })
const db = drizzle({ client: pool, schema })
```
Test all existing queries after the switch -- the API is compatible, but connection behavior differs (pooling vs. per-request HTTP calls).

**Warning signs:**
- Any call to `db.transaction()` will throw at runtime, not at compile time
- Tests pass in development but fail in production when a ledger write is interrupted mid-operation
- Ledger balances drift from the sum of entries over time (data corruption accumulating silently)

**Phase to address:**
First phase of v2.0, before any ledger schema work. This is a prerequisite infrastructure change.

---

### Pitfall 2: Ledger Migration Corrupts or Orphans Existing Payment Data

**What goes wrong:**
The existing `payments` table has 6+ columns of payment data with real production records. Adding a `charges` table and `ledger_entries` table requires backfilling: every historical payment must be represented as a charge + ledger entry pair, with running balances calculated correctly. If the migration script miscalculates a single balance, every subsequent balance for that tenant is wrong. If it misses a payment, the tenant appears to owe money they already paid.

**Why it happens:**
The existing `payments` table stores `amountCents`, `billingPeriod`, `status`, and `paidAt` -- but has no concept of "charges" (what the tenant owes) vs. "payments" (what they paid). The ledger model requires both sides. Developers write a migration that creates charges from payment records, but edge cases slip through:
- Manual payments (cash/check) that don't have Stripe IDs
- Failed payments (status = "failed") that should NOT create charge credits
- Pending ACH payments (status = "pending") that haven't settled yet
- Autopay payments with processing fees baked into `amountCents` that differ from the unit's `rentAmountCents`

**How to avoid:**
1. Design the charges table as additive -- do NOT modify the existing `payments` table schema. Add new tables alongside it.
2. Write the backfill migration as a standalone script (not a Drizzle migration) so it can be run, audited, and re-run during development.
3. For each active tenant-unit pair, generate one charge per billing period where a payment exists. The charge amount comes from `units.rentAmountCents`, NOT from `payments.amountCents` (which may include processing fees).
4. Mark all backfilled records with a `source: "migration"` flag so they can be identified and corrected later.
5. After backfill, validate: for every tenant, `SUM(payment credits) - SUM(charges) = running balance`. If any tenant's balance is non-zero and they have no outstanding charges, the migration has a bug.
6. Keep the existing `payments` table and webhook handlers working during migration. New code writes to both old and new tables until the migration is verified.

**Warning signs:**
- Migration script runs against production without being tested on a copy of production data first
- Backfill script uses `payments.amountCents` as the charge amount (wrong -- this includes fees for autopay)
- No validation query exists that compares old system balances to new system balances
- Failed/pending payment records are treated the same as succeeded payments during backfill

**Phase to address:**
Ledger/financial model phase. Run on a Neon branch (database fork) first, verify balances match, then apply to production.

---

### Pitfall 3: S3 Migration Leaves Orphaned File References or Breaks Existing Downloads

**What goes wrong:**
The existing system stores files in a local `uploads/` directory. The database tables `maintenance_photos` and `documents` store relative paths like `maintenance/abc123.jpg`. Migrating to S3 requires: (1) uploading all existing files to S3, (2) updating database references to point to S3, and (3) changing the file serving route from `fs.readFile` to S3 presigned URLs. If any step fails partially, some files are on disk, some are in S3, and the `filePath` column points to the wrong location. Tenants get 404s on their maintenance photos or documents.

**Why it happens:**
The migration is treated as a single cutover: "upload everything to S3, change the code, deploy." But files are actively being uploaded during the migration window. A maintenance photo uploaded between "files copied to S3" and "code deployed" exists only on disk. The new code looks for it in S3 and returns 404.

**How to avoid:**
Use a dual-read migration strategy:
1. **Phase A**: Deploy new upload code that writes to S3 (new uploads go to S3). File serving code reads from S3 first, falls back to local disk if not found. Add a `storageBackend` column to `maintenance_photos` and `documents` (values: `"local"` or `"s3"`).
2. **Phase B**: Run a background script that copies all existing local files to S3 and updates `storageBackend` to `"s3"`. Verify checksums match.
3. **Phase C**: Once all files are verified in S3, remove the local disk fallback code. Delete local files after a grace period.

This eliminates any "migration window" where files could be lost.

**Warning signs:**
- No `storageBackend` column or equivalent -- code assumes all files are in one location
- Migration script does not verify checksums after upload to S3
- No fallback logic exists for files not yet migrated
- Presigned URLs are generated with very short expiration (under 5 minutes), causing downloads to fail if the user is slow

**Phase to address:**
S3 storage migration phase. Must be completed before any other phase depends on file uploads working correctly.

---

### Pitfall 4: S3 Presigned URL Expiration and CORS Misconfiguration

**What goes wrong:**
After migrating to S3, file downloads use presigned URLs. Two common failures:
1. **Expiration too short**: A presigned URL with a 5-minute expiry is generated when the page loads. The user opens the page, goes to lunch, comes back, clicks "download" -- 403 Forbidden. For maintenance photos in a gallery, all image `src` attributes become broken after the URL expires.
2. **CORS not configured**: The S3 bucket blocks cross-origin requests from the app's domain. Direct browser uploads via presigned PUT URLs fail silently with no error message (just a CORS block in the browser console).

**Why it happens:**
Developers test with long-lived URLs in development and don't notice expiration issues. CORS configuration is bucket-level, not file-level, and is easy to forget because local development doesn't need it (same-origin requests work without CORS).

**How to avoid:**
1. **Expiration**: Use 1-hour expiry for download URLs (covers reasonable browsing sessions). For upload URLs, use 15-minute expiry (upload should start quickly). For images rendered inline (maintenance photos), generate fresh presigned URLs on each page load, not cached in the database.
2. **CORS**: Configure the S3 bucket CORS policy before writing any upload code:
```json
{
  "CORSRules": [
    {
      "AllowedOrigins": ["https://your-domain.com"],
      "AllowedMethods": ["GET", "PUT"],
      "AllowedHeaders": ["Content-Type", "Content-Disposition"],
      "MaxAgeSeconds": 3600
    }
  ]
}
```
3. **Region-specific endpoints**: Use the region-specific S3 endpoint (`s3.us-east-1.amazonaws.com`), not the global endpoint. The global endpoint does not handle CORS preflight correctly for buckets outside us-east-1.

**Warning signs:**
- Maintenance photos load on first visit but show broken images on revisit (cached presigned URLs expired)
- File uploads work in Postman but fail in the browser (CORS not configured)
- 403 errors in browser console with no meaningful error message shown to the user

**Phase to address:**
S3 storage migration phase.

---

### Pitfall 5: JWT/Edge Auth Changes Break Existing Session Cookies

**What goes wrong:**
The current middleware (`middleware.ts`) uses `getSessionCookie()` from Better Auth to check for cookie presence. The v2.0 plan is to add edge-level JWT role authorization for instant admin route rejection. If the JWT plugin is added to the Better Auth config, it may change cookie behavior, add new database tables (the `jwks` table), or alter session validation logic. Existing sessions become invalid, logging out all active users. Tenants who were about to pay rent are suddenly redirected to login and may assume the system is broken.

**Why it happens:**
Better Auth's JWT plugin is explicitly documented as "not meant as a replacement for the session" -- it is an additional mechanism for services that need tokens. But adding it to the auth config requires running `@better-auth/cli migrate` to add the `jwks` table. If the migration runs but the plugin isn't properly configured, or if the cookie name/prefix configuration changes, `getSessionCookie()` stops finding existing cookies because the cookie configuration must match exactly between auth config and middleware.

**How to avoid:**
1. **Do NOT replace session-based auth with JWT**. The JWT plugin adds token endpoints alongside existing session cookies. The middleware should continue using `getSessionCookie()` for authentication, with an additional role check added.
2. **Edge-level role checking without JWT**: Instead of JWT, decode the Better Auth session cookie in middleware to extract the role. Better Auth session cookies contain the session token, which can be used to look up the session via an API call. For edge performance, use `getSessionCookie()` for existence check (fast) and defer role verification to the layout server component (already done in `(admin)/layout.tsx`).
3. **If JWT is truly needed**: Add the plugin, run migrations on a Neon branch first, test that existing sessions still work, then deploy. Never change `cookieName` or `cookiePrefix` in the auth config without invalidating all existing sessions intentionally.
4. **Test the migration**: Log in as both admin and tenant, add the JWT plugin, restart the server, verify both sessions still work without re-login.

**Warning signs:**
- After deploying JWT plugin changes, all users are redirected to login
- `getSessionCookie()` returns null for requests that previously had valid sessions
- The `jwks` table migration fails or is not run before deployment
- Better Auth GitHub issues report JWT plugin edge runtime incompatibility (confirmed: issue #3207)

**Phase to address:**
Auth hardening phase. This must be a standalone change, deployed and verified before other features depend on it.

---

### Pitfall 6: Timezone Bugs in Rent Billing CRON -- Charges on Wrong Day

**What goes wrong:**
The current CRON job (`src/app/api/cron/rent-reminders/route.ts`) uses `new Date()` to determine the current day, which returns UTC time. The server's system clock determines what "today" is. If the CRON runs at 11 PM Eastern (3 AM UTC next day), `today.getDate()` returns tomorrow's date in UTC. Rent reminders for tenants due on the 1st fire on the 31st of the previous month (Eastern perspective). Autopay charges (`autopay-charge/route.ts`) fire a day early, charging tenants before their due date.

**Why it happens:**
`new Date()` in Node.js uses the server's timezone (usually UTC in production environments like Vercel). The code uses `today.getDate()` to compare against `units.rentDueDay`, but `rentDueDay` represents a calendar day in the property's local timezone, not UTC. This mismatch is invisible during development (where the developer's machine may be in the same timezone as the property) and only manifests in production.

**How to avoid:**
1. **Store the property timezone** in the `properties` table (e.g., `timezone: "America/New_York"`).
2. **Convert UTC to property-local time** before comparing dates:
```typescript
const propertyTz = "America/New_York" // from properties table
const now = new Date()
const localDate = new Intl.DateTimeFormat("en-US", {
  timeZone: propertyTz,
  day: "numeric",
  month: "numeric",
  year: "numeric",
}).format(now)
const currentDay = parseInt(localDate.split("/")[1]) // extract day
```
3. **Schedule the CRON to run after midnight in the latest US timezone** (Hawaii, UTC-10). Running at 11 AM UTC guarantees it is "today" in all US timezones.
4. **Add the timezone column to properties before building billing features**. Retrofitting timezone awareness into existing billing logic is much harder than building it in from the start.

**Warning signs:**
- Rent reminders arrive a day early or a day late for some tenants
- Autopay charges fire before the due date in the tenant's local time
- `daysUntilDue` calculation produces unexpected negative/positive values near midnight
- CRON "sent" count varies depending on what time the job runs
- DST transitions cause reminders to skip a day or fire twice

**Phase to address:**
Ledger/financial model phase (because the charges/late fees CRON depends on correct date math). Add `timezone` column to `properties` table before implementing any automated billing.

---

### Pitfall 7: Move-Out Workflow Fails to Cancel Autopay, Leaving Zombie Charges

**What goes wrong:**
A tenant moves out (admin sets `tenantUnits.endDate` and `isActive = false`). But their `autopay_enrollments` record remains `status: "active"`. Next month, the autopay CRON runs, sees the active enrollment, charges their saved payment method, and inserts a payment for a unit they no longer occupy. The tenant gets charged rent for a place they moved out of. Refunding requires manual Stripe intervention.

**Why it happens:**
The move-out workflow is designed as a tenant-units operation (deactivate the link). But autopay is a separate table (`autopay_enrollments`) with no foreign key cascade to `tenantUnits`. Deactivating `tenantUnits.isActive` does not automatically cancel autopay. The autopay CRON joins `autopay_enrollments` with `units` but does NOT check `tenantUnits.isActive`.

**How to avoid:**
The move-out operation must be a transaction that atomically:
1. Sets `tenantUnits.endDate` and `isActive = false`
2. Sets `autopayEnrollments.status = "cancelled"` and `cancelledAt = now()` for the same `tenantUserId`
3. Cancels any pending Stripe PaymentIntents for the tenant
4. Creates a final ledger entry showing the tenant's outstanding balance at move-out

Build a `moveOutTenant()` function that performs all four steps in a single database transaction (which requires solving Pitfall 1 first -- Neon WebSocket driver).

**Warning signs:**
- `autopay_enrollments` table has records with `status = "active"` for tenants where `tenant_units.is_active = false`
- Tenant receives a charge notification after move-out date
- No automated test covers the "move out + autopay cancellation" flow

**Phase to address:**
Tenant lifecycle phase. Must be implemented alongside or immediately after the ledger phase (needs transactions).

---

## Moderate Pitfalls

### Pitfall 8: Admin UX Overhaul Breaks Existing Workflows Without E2E Coverage

**What goes wrong:**
The admin layout (`(admin)/layout.tsx`) uses a horizontal nav bar with 9 links. The v2.0 plan is to replace this with a persistent sidebar, KPI dashboard, and new pages (property CRUD, vendor management). During the redesign, the existing pages (payments, maintenance, documents, users, invites, broadcast) are rearranged or re-routed. A previously working page like `/admin/maintenance/[id]` gets a new URL structure like `/admin/properties/[propertyId]/maintenance/[id]`, but internal links, API calls, and middleware matchers still reference the old paths. The admin cannot access the maintenance kanban board.

**Prevention:**
1. Run the existing Playwright E2E test suite before starting the overhaul. Every existing admin page must have at least one E2E test that verifies it loads and core functionality works.
2. Use Next.js route aliases or redirects for any changed URLs -- never delete a working route without a redirect.
3. Build the new sidebar navigation alongside the old horizontal nav (feature flag). Switch to sidebar only after all existing pages work under the new layout.
4. Do NOT change API route paths during the UI overhaul. UI changes and API changes must be separate deployments.

**Warning signs:**
- Admin pages return 404 after layout changes
- API calls in admin pages fail with 401/404 because path matchers changed
- Middleware `config.matcher` no longer covers new admin routes

**Phase to address:**
Admin UX overhaul phase. Run full E2E suite before and after every layout change.

---

### Pitfall 9: Portfolio CRUD Cascading Deletes Destroy Payment History

**What goes wrong:**
The `units` table has `onDelete: "cascade"` on `propertyId`. The `payments` table has `onDelete: "cascade"` on `unitId`. If an admin deletes a property (intending to "archive" it), the cascade deletes all units, which cascade-deletes all payments, autopay enrollments, maintenance requests, and documents. Years of financial records vanish in a single DELETE.

**Prevention:**
1. **Never implement hard delete for properties or units**. Use soft-delete with an `archivedAt` timestamp column.
2. Add a `status` column to `properties` and `units` (values: `"active"`, `"archived"`).
3. Filter all queries to exclude archived records by default: `WHERE status = 'active'`.
4. Remove the `ON DELETE CASCADE` from `payments.unitId` -- payments must survive unit archival. Replace with `ON DELETE RESTRICT` so any attempt to delete a unit with payments fails loudly.
5. The admin UI for "delete property" should be labeled "Archive property" and only set `archivedAt`.

**Warning signs:**
- Database schema has `ON DELETE CASCADE` on tables that store financial or legal records
- No "archive" concept exists -- only "delete"
- Admin UI has a red "Delete" button on properties or units with no confirmation or soft-delete behavior

**Phase to address:**
Portfolio CRUD phase. Change cascade behavior BEFORE building any delete/archive UI.

---

### Pitfall 10: Vendor Access Leaks Tenant PII Through Maintenance Tickets

**What goes wrong:**
Vendor management adds external users (plumbers, electricians) who can view maintenance tickets assigned to them. The maintenance ticket data includes `tenantUserId`, and the comments thread may contain the tenant's name, unit number, and uploaded photos of the interior of their apartment. If vendor access is implemented as "read access to the maintenance request," vendors see tenant identity and private living space photos.

**Prevention:**
1. Create a vendor-specific view that strips PII: show only the ticket description, category, unit number (not tenant name), and photos marked as "shareable with vendor."
2. Do NOT give vendors access to the same API endpoints that admin uses. Create separate `/api/vendor/maintenance/[id]` routes that return a filtered payload.
3. Tenant contact information (name, email, phone) must never appear in vendor-accessible data. If a vendor needs to contact the tenant, the admin facilitates communication.
4. Add a `shareableWithVendor` boolean to `maintenancePhotos` -- admin selects which photos the vendor can see.

**Warning signs:**
- Vendor role uses the same API routes as admin
- Maintenance ticket API response includes `tenantUserId` or tenant name
- No photo filtering exists for vendor views

**Phase to address:**
Vendor management phase.

---

### Pitfall 11: Late Fee Automation Without Grace Period Configuration Creates Tenant Disputes

**What goes wrong:**
Automated late fees charge a fixed fee on the day after rent is due. But some tenants have verbal agreements with the landlord for extended grace periods. Other jurisdictions require minimum grace periods by law (e.g., New York requires 5 days). An automated late fee that fires on day 1 violates tenant expectations and potentially local law.

**Prevention:**
1. Add a `gracePeriodDays` column to the `units` table (default: 5 days). Late fees only trigger after `rentDueDay + gracePeriodDays`.
2. Make late fee amount configurable per unit (not hardcoded). Some units may have different lease terms.
3. Add an `autoLateFees` boolean to units (default: false). Admin must explicitly enable automated late fees per unit.
4. Log every automated late fee charge with a clear audit trail: when it was assessed, which rule triggered it, and the calculation used.
5. Provide admin override: ability to waive a late fee after it has been assessed.

**Warning signs:**
- Late fee logic uses a hardcoded number of days or amount
- No admin UI exists to waive or adjust late fees
- Late fees fire without checking whether the tenant has a pending payment (ACH in transit)

**Phase to address:**
Ledger/financial model phase. Late fee rules must be configurable before they are automated.

---

### Pitfall 12: Webhook Hardening Breaks Existing Stripe Checkout Flow

**What goes wrong:**
The v2.0 plan includes "strict Stripe intent ID matching for ACH settlements." The existing webhook handler (`src/app/api/webhooks/stripe/route.ts`) handles `checkout.session.completed`, `checkout.session.async_payment_succeeded/failed`, `payment_intent.succeeded`, and `payment_intent.payment_failed`. If the hardening changes modify the matching logic (e.g., requiring `stripePaymentIntentId` to exist before updating), existing flows that create payment records with null `stripePaymentIntentId` break. ACH payments that arrive via `checkout.session.async_payment_succeeded` use `stripeSessionId` as the match key, not `stripePaymentIntentId`.

**Prevention:**
1. Map every existing webhook event type to its match key:
   - `checkout.session.completed` (card) -> matches by `stripeSessionId` (inserts new row)
   - `checkout.session.completed` (ACH unpaid) -> matches by `stripeSessionId` (inserts new row)
   - `checkout.session.async_payment_succeeded` -> matches by `stripeSessionId` (updates existing row)
   - `payment_intent.succeeded` (autopay) -> matches by `tenantUserId + unitId + billingPeriod + status=pending`
   - `payment_intent.payment_failed` (autopay) -> matches by `tenantUserId + unitId + billingPeriod + status=pending`
2. Any hardening changes must preserve ALL five match patterns. Add tests for each.
3. Add Stripe event ID deduplication (store `event.id`, skip if already processed) -- this is currently missing from the webhook handler and is the most valuable hardening change.
4. Do NOT change the `payments` table schema during webhook hardening. Schema changes and logic changes must be separate deployments.

**Warning signs:**
- After deploying webhook changes, ACH payments stop settling (no `async_payment_succeeded` handler matches)
- Autopay payments stuck in "pending" status because the `payment_intent.succeeded` matcher changed
- Duplicate payment records appear (missing event ID deduplication)

**Phase to address:**
Webhook hardening phase. Must be done before the ledger phase (ledger depends on webhook accuracy).

---

## Minor Pitfalls

### Pitfall 13: Unit Transfer Creates Overlapping Tenant-Unit Records

**What goes wrong:**
When a tenant transfers from unit A to unit B, both the old and new `tenantUnits` records can have `isActive = true` for a brief period. Any query that filters by `isActive = true` returns two units for the same tenant, causing double rent charges, duplicate notifications, and UI confusion.

**Prevention:**
The transfer must be atomic: set old record's `endDate = now, isActive = false` AND insert new record with `startDate = now, isActive = true` in a single transaction. Add a database constraint: `UNIQUE(userId) WHERE isActive = true` (partial unique index) to prevent multiple active assignments.

**Phase to address:**
Tenant lifecycle phase.

---

### Pitfall 14: Admin Sidebar Navigation State Lost on Page Refresh

**What goes wrong:**
A client-side sidebar with collapsible sections loses its expanded/collapsed state when the admin navigates to a new page (full page reload in Next.js App Router). The admin collapses "Maintenance" and expands "Financial" -- on next navigation, all sections reset to default. This makes the sidebar more annoying than the current horizontal nav.

**Prevention:**
Store sidebar state in `localStorage` or a cookie. Use the Next.js `<Link>` component for client-side navigation (no full reload). Consider making the sidebar a client component within a server component layout that persists across navigations.

**Phase to address:**
Admin UX overhaul phase.

---

### Pitfall 15: Work Order Cost Tracking Uses Floating Point for Money

**What goes wrong:**
Work order costs are stored as `DECIMAL` or floating-point numbers instead of integer cents. `$150.10 + $24.90` becomes `175.00000000001` due to IEEE 754 floating point. Financial reports show incorrect totals.

**Prevention:**
Store all monetary values as integer cents (consistent with the existing `rentAmountCents` and `amountCents` patterns in the schema). Display by dividing by 100 at the presentation layer. Never use `REAL`, `FLOAT`, or JavaScript `number` for money calculations in the database or application.

**Phase to address:**
Vendor/work-order management phase.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Keep Neon HTTP driver and use manual SQL for transactions | No driver migration needed | Cannot use Drizzle's `db.transaction()` API; manual SQL is error-prone and bypasses type safety | Never -- ledger operations require proper transaction support |
| Copy existing files to S3 without tracking migration status per file | Simpler migration script | Cannot resume after partial failure; re-running re-uploads everything; no way to verify completeness | Never |
| Use the same API routes for vendor and admin views | Less code to write | Vendor sees tenant PII; requires retrofitting access control later | Never |
| Hardcode late fee amount and grace period | Faster to implement | Violates jurisdiction-specific rules; creates tenant disputes; requires code change to adjust | Only during initial testing, never in production |
| Store presigned S3 URLs in database rows | Avoids generating URLs on each request | URLs expire; stale cached data serves broken links; database stores ephemeral data | Never -- generate presigned URLs at request time |
| Big-bang admin UI rewrite (replace all pages at once) | Clean codebase, no dual navigation | Any bug breaks all admin workflows simultaneously; no rollback path | Never -- incremental migration with feature flags |
| Skip backfill validation after ledger migration | Migration finishes faster | Corrupted balances go undetected until a tenant disputes their balance | Never |

---

## Integration Gotchas

Common mistakes when connecting to external services during the v2.0 upgrade.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| S3 (AWS/Cloudflare R2) | Not configuring CORS on the bucket before writing upload code | Configure CORS first with your production domain, allowed methods (GET, PUT), and required headers (Content-Type). Test with a browser upload before writing any React code. |
| S3 Presigned URLs | Using the global S3 endpoint instead of region-specific endpoint | Use `s3.{region}.amazonaws.com` (e.g., `s3.us-east-1.amazonaws.com`). The global endpoint fails CORS preflight for buckets outside us-east-1. |
| S3 Presigned URLs | Generating upload URLs with `Content-Type` mismatch | The `Content-Type` in the presigned URL must match the actual upload request. If the presigned URL specifies `image/jpeg` but the browser sends `image/png`, S3 returns `SignatureDoesNotMatch`. |
| Better Auth JWT Plugin | Adding JWT plugin and expecting it to replace session cookies | JWT is additive -- it provides token endpoints for external service auth. Session cookies continue to work. Do not remove `nextCookies()` plugin. |
| Better Auth JWT Plugin | Forgetting to run `@better-auth/cli migrate` after adding the JWT plugin | The plugin requires a `jwks` table. Without migration, token generation fails at runtime with a database error. |
| Neon WebSocket Driver | Not handling connection pool limits in serverless environment | Neon WebSocket connections are pooled. In serverless (Vercel), each function invocation may create a new connection. Use Neon's connection pooler URL (port 5432 with pooling) to avoid exhausting connection limits. |
| Stripe Webhook Hardening | Changing the `payments` table schema and webhook logic in the same deployment | If the schema migration fails, the webhook handler references columns that don't exist. Deploy schema changes first, verify, then deploy logic changes. |
| Drizzle ORM Migrations | Running `db:push` instead of `db:generate` + `db:migrate` for schema changes that affect production data | `db:push` may drop and recreate columns, destroying data. Always use `generate` to create migration SQL files, review them, then `migrate` to apply. |

---

## Performance Traps

Patterns that work at small scale but fail as the portfolio grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Generating presigned URLs for all maintenance photos on page load | Page load takes 500ms+ per photo as each URL requires an S3 SDK call | Batch presigned URL generation; or use CloudFront with signed cookies for photo galleries | At 20+ photos per maintenance request |
| Running balance queries scan all ledger entries for a tenant | Dashboard load time increases linearly with tenant history length | Store `currentBalance` as a denormalized field on `tenantUnits`; update atomically with each ledger entry | At 50+ ledger entries per tenant (unlikely at 5 units, relevant at 50+) |
| Autopay CRON queries every enrollment individually (N+1 payment checks) | CRON timeout at scale; existing code already has this pattern | Rewrite as a single JOIN query: enrollments LEFT JOIN payments WHERE billingPeriod = current AND status = 'succeeded' | At 50+ autopay enrollments |
| Admin KPI dashboard aggregates all payments, maintenance, and tenants on every load | Dashboard takes 5+ seconds to load | Pre-compute KPIs in a background job or materialized view; cache for 15 minutes | At 100+ properties with 500+ units |

---

## Security Mistakes

Domain-specific security issues for the v2.0 upgrade.

| Mistake | Risk | Prevention |
|---------|------|------------|
| S3 bucket configured as public | All tenant documents (IDs, proof of income) are publicly accessible via direct URL | Use private bucket with presigned URLs only. Never set bucket policy to public. Add `Block Public Access` at the account level. |
| Presigned upload URLs allow arbitrary file types | Attacker uploads executable or oversized file directly to S3 via presigned URL | Set `Content-Type` and `Content-Length` conditions on the presigned URL. Validate file type server-side after upload. |
| Vendor accounts share the admin `role: "admin"` | Vendors get full admin access to all financial data, tenant PII, and system settings | Create a `"vendor"` role distinct from `"admin"`. Vendor routes must be separate from admin routes with separate authorization checks. |
| JWT tokens stored in localStorage | XSS attack steals JWT and impersonates admin | If JWT is used, store in httpOnly cookie or use the session-cookie approach already in place. Never store auth tokens in localStorage. |
| Ledger entries can be modified after creation | Financial audit trail is compromised; balances can be silently altered | Make ledger entries immutable (no UPDATE, no DELETE). Corrections are new entries that reverse the original. Add database trigger or policy to prevent modifications. |
| Admin can delete a charge that has linked payments | Financial records become inconsistent; payments reference non-existent charges | Use soft-delete for charges. Never hard-delete financial records. Add `ON DELETE RESTRICT` on ledger entry foreign keys. |

---

## UX Pitfalls

User experience mistakes specific to the v2.0 upgrade.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Replacing horizontal nav with sidebar without preserving URL bookmarks | Admins who bookmarked `/admin/payments` get 404 if route structure changes | Keep all existing URL paths working. Add redirects for any changed paths. |
| KPI dashboard with no loading states | Admin sees a blank page for 2-3 seconds while data loads | Use skeleton loaders (already have `loading.tsx` files -- ensure new dashboard pages have them too) |
| Move-out workflow with no confirmation step | Admin accidentally ends a tenancy with a single click | Require a confirmation modal that shows: tenant name, unit, outstanding balance, and autopay status before processing |
| Vendor sees their assigned tickets but no way to update status | Vendor must call the admin to report work completion, defeating the purpose | Give vendors a "Mark complete" action on their tickets with an optional cost/notes field |
| Ledger balance shown without explanation of charges | Tenant sees "Balance: $350" but doesn't know if it's late fees, partial payment remainder, or a billing error | Show a breakdown: each charge, each payment, and the resulting balance as a line-item history |
| S3 migration breaks image previews for existing maintenance requests | Tenant revisits an old maintenance request and photos are broken | Dual-read fallback during migration (see Pitfall 3). Never deploy S3-only reads until all files are verified migrated. |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces in the v2.0 upgrade.

- [ ] **Ledger migration:** Looks done when charges table exists -- verify historical payments are backfilled as ledger entries, running balances match, and failed/pending payments are handled correctly
- [ ] **S3 migration:** Looks done when new uploads go to S3 -- verify ALL existing files are migrated, checksums match, presigned URLs work for downloads, CORS allows browser uploads, and the old `uploads/` directory is no longer needed
- [ ] **Edge auth:** Looks done when JWT plugin is added -- verify existing session cookies still work, admin and tenant logins are unaffected, and middleware `getSessionCookie()` still functions
- [ ] **Move-out workflow:** Looks done when tenant is deactivated -- verify autopay is cancelled, no future CRON charges will fire, outstanding balance is calculated, and the tenant can still view their read-only payment history
- [ ] **Portfolio CRUD:** Looks done when admin can create properties -- verify archiving a property does NOT cascade-delete payments or maintenance records, and unit rent configuration survives archival
- [ ] **Admin sidebar:** Looks done when sidebar renders -- verify all 9+ existing pages are accessible, navigation state persists across page loads, mobile responsiveness is maintained, and the middleware matcher covers new routes
- [ ] **Vendor management:** Looks done when vendors can view tickets -- verify vendors cannot see tenant names, contact info, or unrelated tickets, and that vendor-submitted costs appear in work order tracking
- [ ] **Late fees:** Looks done when fees auto-generate -- verify grace period is configurable per unit, pending ACH payments are not charged late fees, and admin can waive fees after assessment
- [ ] **Timezone-aware CRON:** Looks done when CRON uses property timezone -- verify DST transitions are handled (spring forward: no skipped day; fall back: no double execution), and that the billing period string uses local date, not UTC date

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Neon HTTP driver used for ledger writes (no transactions) | HIGH | Audit all ledger entries for consistency. Rebuild running balances from scratch by replaying entries. Switch to WebSocket driver. Fix any corrupted records. |
| Ledger backfill miscalculated balances | MEDIUM | Run validation query comparing SUM(entries) vs stored balance for each tenant. Correct discrepancies by inserting adjustment entries (not by modifying existing entries). Notify affected tenants. |
| S3 migration left orphaned files | LOW | Run comparison script: list all database file references, check each against S3 bucket. Re-upload any missing files from local backup. |
| Autopay charged moved-out tenant | HIGH | Issue immediate Stripe refund. Notify tenant with apology. Add database constraint to prevent future occurrence. Audit all autopay enrollments against tenant unit status. |
| Cascade delete destroyed payment history | CRITICAL | Restore from database backup (Neon point-in-time recovery). Identify affected time window. Change cascade behavior to RESTRICT before re-deploying. |
| Presigned URLs expired in cached pages | LOW | Clear CDN/browser cache. Regenerate URLs on next page load. Ensure URLs are never cached in database or CDN. |
| JWT plugin broke existing sessions | MEDIUM | Revert JWT plugin addition. All users must re-login. Deploy JWT changes again with proper testing. |
| CRON timezone bug charged wrong day | MEDIUM | Identify affected charges. Issue refunds or adjustments for any incorrect charges. Fix timezone logic. Add timezone-aware tests. |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Neon HTTP driver lacks transactions (P1) | Infrastructure/prerequisites phase | Call `db.transaction()` in a test -- must not throw. Run existing test suite -- all queries still work. |
| Ledger migration corrupts data (P2) | Ledger/financial model phase | Validation query: for each tenant, `SUM(credits) - SUM(debits) = stored balance`. Zero discrepancies. |
| S3 file orphaning (P3) | S3 storage migration phase | Comparison script: every `filePath` in `maintenance_photos` and `documents` tables resolves to a valid S3 object. Zero 404s. |
| S3 CORS and URL expiration (P4) | S3 storage migration phase | Browser test: upload a file via presigned URL from production domain. Download same file 30 minutes later. Both succeed. |
| JWT/auth session breakage (P5) | Auth hardening phase | Log in as admin and tenant before deploying. Deploy changes. Both sessions still valid without re-login. |
| Timezone CRON bugs (P6) | Ledger/financial model phase | Set server clock to 11 PM Eastern. Run CRON. Verify `currentDay` matches Eastern date, not UTC date. Test across DST boundary. |
| Move-out zombie autopay (P7) | Tenant lifecycle phase | Move out a tenant with active autopay. Run autopay CRON. Verify zero charges for the moved-out tenant. Query: no `autopay_enrollments.status = 'active'` where `tenant_units.is_active = false`. |
| Admin UX regressions (P8) | Admin UX overhaul phase | Run full Playwright E2E suite before and after each layout change. All existing admin page tests pass. |
| Portfolio cascade deletes (P9) | Portfolio CRUD phase | Attempt to delete a property with payment history. Must fail (RESTRICT) or soft-delete (archived). Payments table row count unchanged. |
| Vendor PII leakage (P10) | Vendor management phase | Log in as vendor, fetch maintenance ticket API response. Verify no `tenantUserId`, tenant name, or tenant contact info in response. |
| Late fee misconfiguration (P11) | Ledger/financial model phase | Set grace period to 5 days, run late fee logic on day 3. No fee assessed. Run on day 6. Fee assessed. Verify fee amount matches unit configuration. |
| Webhook hardening regressions (P12) | Webhook hardening phase | Replay saved webhook payloads for all 5 event types. All handlers produce correct database state. Send same payload twice -- second is a no-op. |
| Unit transfer overlap (P13) | Tenant lifecycle phase | Transfer tenant from unit A to B. Query `tenant_units WHERE is_active = true AND user_id = X`. Exactly one row returned. |
| Sidebar state loss (P14) | Admin UX overhaul phase | Collapse sidebar section, navigate to another page, verify collapsed state persists. |
| Float-point money bug (P15) | Vendor/work-order phase | Code review: all monetary columns use `integer` type. No `real`, `float`, or `decimal` types for money. |

---

## Sources

- [Neon Serverless Driver -- Transaction Limitations](https://neon.com/docs/serverless/serverless-driver) -- HIGH confidence (official Neon docs confirming HTTP driver does not support transactions)
- [Drizzle ORM -- Neon Connection Guide](https://orm.drizzle.team/docs/connect-neon) -- HIGH confidence (official Drizzle docs showing HTTP vs WebSocket driver differences)
- [pgledger -- Ledger Implementation in PostgreSQL](https://www.pgrs.net/2025/03/24/pgledger-ledger-implementation-in-postgresql/) -- MEDIUM confidence (practitioner implementation with concurrent test coverage)
- [Stripe: Idempotent Requests](https://docs.stripe.com/api/idempotent_requests) -- HIGH confidence (official Stripe docs)
- [Stripe: Handle Payment Events with Webhooks](https://docs.stripe.com/webhooks/handling-payment-events) -- HIGH confidence (official Stripe docs)
- [Stripe: Refund and Cancel Payments](https://docs.stripe.com/refunds) -- HIGH confidence (official Stripe docs)
- [AWS S3: Uploading Objects with Presigned URLs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html) -- HIGH confidence (official AWS docs)
- [AWS S3: Troubleshooting CORS](https://docs.aws.amazon.com/AmazonS3/latest/userguide/cors-troubleshooting.html) -- HIGH confidence (official AWS docs)
- [Better Auth: Next.js Integration](https://www.better-auth.com/docs/integrations/next) -- HIGH confidence (official Better Auth docs)
- [Better Auth: JWT Plugin](https://www.better-auth.com/docs/plugins/jwt) -- HIGH confidence (official Better Auth docs; JWT is "not meant as a replacement for the session")
- [Better Auth: Bearer Plugin Edge Issues -- GitHub #3207](https://github.com/better-auth/better-auth/issues/3207) -- MEDIUM confidence (confirmed community report of JWT reading failures in edge mode)
- [Handling Timezone Issues in Cron Jobs (2025 Guide)](https://dev.to/cronmonitor/handling-timezone-issues-in-cron-jobs-2025-guide-52ii) -- MEDIUM confidence (practitioner guide, consistent with Node.js behavior)
- [Landlord Studio: Dealing with Partial Rent Payments](https://www.landlordstudio.com/blog/dealing-with-partial-rent-payments-from-your-tenant) -- MEDIUM confidence (domain-specific, multiple sources agree on legal implications)
- [Neon: Connect from Drizzle to Neon](https://neon.com/docs/guides/drizzle) -- HIGH confidence (official Neon guide showing pooler URL for serverless)
- [Handling Payment Webhooks Reliably](https://medium.com/@sohail_saifii/handling-payment-webhooks-reliably-idempotency-retries-validation-69b762720bf5) -- MEDIUM confidence (consistent with Stripe official guidance)
- Codebase analysis: `src/db/index.ts`, `src/app/api/webhooks/stripe/route.ts`, `src/app/api/cron/autopay-charge/route.ts`, `src/app/api/cron/rent-reminders/route.ts`, `src/app/api/uploads/[...path]/route.ts`, `src/lib/uploads.ts`, `middleware.ts`, `src/lib/auth.ts`, `src/db/schema/domain.ts` -- HIGH confidence (direct code inspection)

---
*Pitfalls research for: Property management portal v2.0 upgrade*
*Researched: 2026-02-26*
