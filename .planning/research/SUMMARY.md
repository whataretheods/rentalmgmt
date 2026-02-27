# Project Research Summary

**Project:** RentalMgmt v2.0 — Production-Ready Property Management Portal
**Domain:** Residential property management SaaS — small landlord (5-50 units)
**Researched:** 2026-02-26
**Confidence:** HIGH

## Executive Summary

RentalMgmt v2.0 takes a working MVP (auth, payments, maintenance, documents, notifications, autopay) and upgrades it to production-grade. The defining characteristic of production-grade property management software is a financial ledger: a separate `charges` table that tracks what tenants *owe*, distinct from the `payments` table that tracks what they *paid*. Every PMS in the competitive landscape (AppFolio, Buildium, Stessa, Rentec Direct) is built on this model. Without it, the system cannot express late fees, partial payments, running balances, or the final reconciliation needed for move-out — all of which are expected by small landlords managing real tenants.

The recommended approach is additive and dependency-driven. The ledger is the root dependency: late fee automation, running balance display, move-out workflow, and KPI dashboard metrics all require it. Before the ledger can be safely built, one infrastructure prerequisite must be resolved — the current Neon HTTP database driver does not support transactions, and financial ledger writes (charge + ledger entry + balance update) must be atomic. This driver swap is the true first task. S3 cloud storage migration (replacing the local `uploads/` directory with Cloudflare R2) and edge-level JWT role authorization are both independent of the ledger and can be addressed early to reduce technical debt. Vendor management, work order cost tracking, and the admin UX overhaul (persistent sidebar + KPI dashboard) come after the ledger because they depend on it.

The critical risks are data integrity risks: corrupted ledger balances from non-atomic writes, orphaned file references during S3 migration, cascade-delete destruction of payment history during portfolio CRUD, and autopay charges firing against moved-out tenants. Every one of these has a clear prevention strategy. The secondary risk is the Better Auth JWT plugin potentially disrupting existing session cookies — the edge auth upgrade must be tested in isolation before any other phase depends on it.

---

## Key Findings

### Recommended Stack

The existing validated stack (Next.js 15.5, Better Auth, Drizzle ORM, Neon PostgreSQL, Stripe, Resend, Twilio, shadcn/ui, Tailwind v4) requires only four new packages and one shadcn component for v2.0. The new additions are minimal, well-documented, and solve specific gaps in the current system. Notably, the ledger, vendor management, and portfolio CRUD features require no new npm packages — they are database design patterns implemented with the existing Drizzle + Neon stack.

**Core new technologies:**
- `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` (^3.999.0): S3/R2 presigned URL uploads — files never touch the Next.js server, eliminating memory pressure and Vercel payload limits. Use Cloudflare R2 over AWS S3 to eliminate egress fees on tenant document downloads.
- `jose` (^6.1.3): Edge-compatible JWT verification using Web Crypto APIs. The only viable option for Edge Runtime JWT decoding — `jsonwebtoken` uses Node.js `crypto` which is unavailable at the edge.
- `date-fns` (^4.1.0) + `@date-fns/tz` (^1.4.1): Timezone-aware date math for cron jobs. Prevents rent reminders and autopay charges from firing on the wrong calendar day for non-UTC properties. Use v4 with the official first-party `@date-fns/tz` package — not the old third-party `date-fns-tz`.
- shadcn/ui chart component (Recharts v2, via `npx shadcn@latest add chart`): KPI dashboard charts pre-styled with Tailwind, integrated with the existing design system. Do NOT install Recharts directly or use v3 — shadcn targets v2 and the v3 integration is not yet shipped.

**Driver upgrade (prerequisite, not a new feature):** Switch from Neon HTTP driver (`neon()` + `drizzle-orm/neon-http`) to Neon WebSocket driver (`Pool` + `drizzle-orm/neon-serverless`). The HTTP driver does not support `db.transaction()`. This is a hard prerequisite for any ledger work.

See `.planning/research/STACK.md` for full version compatibility matrix, installation commands, and alternatives considered.

### Expected Features

**Must have (table stakes) — v2.0 production blockers:**
- Ledger-based financial model (charges table) — every production PMS is built on this; the current system cannot express what is owed, only what was paid
- Running balance visibility (tenant and admin) — "You owe $X" is expected on every tenant dashboard
- Late fee automation with configurable grace period and fee type — must be per-unit, not hardcoded; must be default-off until admin enables it
- Property and unit CRUD with soft-delete archiving — admin must manage the portfolio without developer intervention
- Tenant move-out workflow — structured atomic process: set end date, cancel autopay, post final charges, archive tenantUnit
- S3-compatible cloud storage migration — local `uploads/` is a single point of failure and does not scale
- Edge-level role authorization — reject non-admin requests at middleware before hitting application code
- Admin dashboard with KPIs — 5-7 key metrics (collection rate, outstanding balance, occupancy, open maintenance, overdue count) with trend indicators

**Should have (differentiators) — significant operational value:**
- Vendor assignment for maintenance — lightweight vendor directory with assignment and email/SMS notification + limited-view sharing link; no vendor login required
- Work order cost tracking — maintenance expense history per unit for tax records
- Persistent sidebar navigation — transforms admin UX from page-hopping to a workspace; affects all subsequent admin UI
- Timezone-aware cron scheduling — rent reminders and late fees use property-local time, not UTC
- Past-tenant read-only history — tenant retains read-only portal access after move-out

**Defer to v3+:**
- Tenant unit transfer — useful but low frequency; defer until an actual transfer is needed
- Self-service invite token entry — minor enhancement; the QR onboarding already differentiates
- Expense reporting per unit/property — valuable at 20+ units, overkill at current scale

**Explicit anti-features (do not build):**
- Full double-entry accounting — overengineered for a 5-unit receivables tracker; single-entry charges + payments is sufficient
- Security deposit management — complex state-specific legal requirements; track offline
- Vendor portal with login — a third user type is disproportionate scope for 2-3 vendors; signed read-only URL is sufficient
- Automated prorated rent calculation — proration methods vary; admin enters the prorated amount manually as a one-time charge

See `.planning/research/FEATURES.md` for the full feature dependency map, competitor analysis table, and detailed feature specifications.

### Architecture Approach

The architecture follows four primary patterns throughout v2.0: additive schema migration (every change adds new tables or nullable columns — never renames, removes, or changes existing column types), presigned URL uploads (client uploads directly to S3/R2 bypassing the server), defense-in-depth auth (edge JWT cookie decode as fast-path optimization; layout server component as authoritative DB-backed check), and computed balance (tenant balance always derived from `SUM(charges) - SUM(payments)`, never stored, preventing staleness and sync bugs).

**Major components and their responsibilities:**
1. **`src/lib/ledger.ts` (new)**: Charge creation, balance computation, late fee logic. The central financial service. All charge operations go through this module.
2. **`src/lib/s3.ts` (new)**: S3Client singleton with `createPresignedUploadUrl()` and `createPresignedDownloadUrl()`. All S3 operations go through this service — never direct SDK calls in routes.
3. **`src/db/schema/domain.ts` (modified)**: New tables: `charges`, `vendors`, `workOrders`, `workOrderCosts`. Modified tables: `payments` (add nullable `chargeId` FK), `maintenancePhotos` + `documents` (add `storageBackend` column for dual-read migration), `properties` (add `timezone` column).
4. **`middleware.ts` (modified)**: Add JWT cookie decode via `jose` for fast admin route rejection; existing `getSessionCookie()` check remains for session presence. Edge check is an optimization, not sole authorization.
5. **`(admin)/layout.tsx` (rewritten)**: Sidebar layout using shadcn Sidebar component. All subsequent admin pages inherit this layout automatically.
6. **New cron routes**: `/api/cron/generate-charges` (monthly rent charge auto-generation) and `/api/cron/late-fees`; existing cron routes modified for timezone awareness using `Intl.DateTimeFormat` with property timezone.

**Schema migration ordering (all additive, no destructive changes):**
```
1. charges table
2. payments.chargeId column (nullable FK)
3. properties.timezone column (with default 'America/New_York')
4. maintenancePhotos.storageBackend, documents.storageBackend
5. vendors table
6. workOrders table (depends on vendors + maintenanceRequests)
7. workOrderCosts table (depends on workOrders)
```

See `.planning/research/ARCHITECTURE.md` for schema definitions, data flow diagrams, full project structure, and the complete build order with dependency rationale.

### Critical Pitfalls

1. **Neon HTTP driver has no transaction support** — Switch to the WebSocket driver (`Pool` + `drizzle-orm/neon-serverless`) before writing any ledger code. Without transactions, a crash between inserting a charge and updating related records creates an inconsistent ledger that cannot be repaired by retrying. This is the true Phase 1 task — a prerequisite, not optional.

2. **Ledger migration can miscalculate or orphan existing payment data** — The backfill script must use `units.rentAmountCents` as the charge amount (not `payments.amountCents`, which may include autopay processing fees). Failed and pending payments must not generate charge credits. Run on a Neon branch first; validate that `SUM(credits) - SUM(debits) = running balance` for every tenant before production deployment.

3. **S3 migration with no safe cutover window** — Add a `storageBackend` column to `maintenancePhotos` and `documents`. New uploads go to S3 immediately; existing files are migrated in a background script with checksum verification. File serving checks `storageBackend` and reads from the appropriate source. Never deploy S3-only reads until all existing files are verified migrated.

4. **Move-out without cancelling autopay creates zombie charges** — Move-out must be a database transaction that atomically deactivates `tenantUnits` AND sets `autopayEnrollments.status = 'cancelled'`. A partial update (tenantUnit deactivated, autopay still active) causes autopay charges against a moved-out tenant, requiring Stripe refunds and tenant communication to resolve.

5. **Portfolio CRUD cascade deletes destroy financial records** — The schema currently has `onDelete: "cascade"` on foreign keys that flow to the payments table. Change payments foreign keys to `RESTRICT` before building any delete UI. Archive properties and units with an `archivedAt` column — never hard-delete records that have financial history.

6. **JWT plugin can break existing sessions** — Enable cookie cache with JWT strategy as an optimization, not a session replacement. The layout-level `getSession()` DB call remains the authoritative authorization check. Test the JWT configuration change in isolation before any other phase depends on it. Never change `cookieName` or `cookiePrefix` in auth config without intentionally invalidating all sessions.

See `.planning/research/PITFALLS.md` for all 15 pitfalls, a pitfall-to-phase verification checklist, recovery strategies, and a "looks done but isn't" acceptance criteria list.

---

## Implications for Roadmap

Based on the combined dependency graph from FEATURES.md and the build order from ARCHITECTURE.md, a 6-phase structure is recommended. The ordering is strict: each phase removes blockers for the next.

### Phase 1: Infrastructure Prerequisites

**Rationale:** Three independent changes that must be done before any feature work can proceed safely. The Neon driver swap is a hard prerequisite for the ledger (no transactions without it). S3 migration should happen early to avoid accumulating more local files. Edge auth should be isolated and verified before anything depends on it. None of these depend on each other and all are self-contained.
**Delivers:** Transaction-safe database layer (Neon WebSocket driver); cloud file storage with dual-read migration strategy (Cloudflare R2 via `@aws-sdk`); JWT-based edge role checking in middleware.
**Addresses:** S3 cloud storage (table stakes), edge-level role authorization (table stakes), Stripe webhook hardening (event ID deduplication).
**Avoids:** Pitfall 1 (Neon transaction failure), Pitfall 3 (S3 orphaned files), Pitfall 4 (S3 CORS/expiration), Pitfall 5 (JWT session breakage).
**Research flag:** The `better-auth.session_data` cookie payload structure must be verified empirically during implementation. The ARCHITECTURE.md approach (decoding with `jose` + `BETTER_AUTH_SECRET`) is architecturally correct, but the exact JWT payload shape — specifically whether `user.role` is a top-level claim or nested — is not fully documented and must be confirmed by inspecting a live session cookie.

### Phase 2: Financial Ledger Foundation

**Rationale:** The `charges` table is the root dependency for late fees, running balance display, move-out reconciliation, and KPI metrics. Nothing downstream can be built without it. The data migration (backfilling existing payments into charges) is the most complex and highest-risk operation in v2.0 — it must be carefully validated on a Neon branch before production deployment.
**Delivers:** `charges` table; `src/lib/ledger.ts` service; charge backfill migration (with validation); monthly rent charge auto-generation cron; Stripe webhook updated to reconcile charges on payment; tenant-facing balance display ("You owe $X").
**Addresses:** Ledger-based financial model (table stakes), running balance visibility (table stakes).
**Avoids:** Pitfall 2 (migration data corruption), Pitfall 6 (timezone cron bugs — add `properties.timezone` column here), Pitfall 11 (late fee misconfiguration — grace period configurable from the start).
**Uses:** Neon WebSocket driver (from Phase 1), `date-fns` + `@date-fns/tz` for timezone-aware billing period calculations.

### Phase 3: Automated Operations

**Rationale:** Late fee automation and timezone-aware cron depend on the charges table (Phase 2). These features are higher risk than manual operations because they fire automatically and charge tenants — they require configurable rules, audit trails, and a default-off stance before any cron is deployed to production.
**Delivers:** Late fee cron with configurable grace period and fee type per unit (default-off); timezone-aware rent reminder and autopay crons using `Intl.DateTimeFormat` with property timezone; Stripe webhook event deduplication.
**Addresses:** Late fee automation (table stakes), timezone-aware cron scheduling (differentiator), webhook hardening (table stakes).
**Avoids:** Pitfall 6 (timezone/UTC day mismatch), Pitfall 11 (hardcoded late fee rules creating tenant disputes), Pitfall 12 (webhook hardening regressions breaking ACH settlement).
**Research flag:** Late fee legal requirements are jurisdiction-specific. Before enabling automated late fees, confirm the applicable state's grace period minimum, fee cap if any, and notice requirements for the property's location.

### Phase 4: Portfolio Management and Tenant Lifecycle

**Rationale:** Property/unit CRUD and move-out workflow both depend on the ledger (Phase 2) for balance calculation and charge posting. The move-out transaction requires the WebSocket driver (Phase 1) for atomicity. These features have the highest consequence of error — a botched move-out with active autopay causes erroneous charges that require Stripe refunds and tenant communication.
**Delivers:** Property and unit CRUD with soft-delete archiving (never hard-delete records with financial history); tenant move-out workflow as a single atomic transaction (deactivate tenantUnit + cancel autopay + post final balance); past-tenant read-only portal access.
**Addresses:** Property/unit CRUD (table stakes), tenant move-out workflow (table stakes), past-tenant read-only history (differentiator).
**Avoids:** Pitfall 7 (zombie autopay charges after move-out), Pitfall 9 (cascade delete destroying payment history — fix FK cascade to RESTRICT before building any delete UI), Pitfall 13 (unit transfer overlap if transfer is added later).

### Phase 5: Admin UX Overhaul

**Rationale:** The sidebar layout affects every admin page. Building it before the vendor/work-order pages (Phase 6) means those pages inherit the sidebar immediately rather than being retrofitted. The KPI dashboard requires ledger data (Phase 2) for balance aggregations and occupancy metrics. This phase is largely visual and unlikely to regress financial functionality, but must be covered by E2E tests before and after every layout change.
**Delivers:** Persistent sidebar navigation using shadcn Sidebar component with collapsible mobile support; KPI dashboard with 5-7 metric cards and trend indicators; breadcrumb navigation; mobile-responsive admin polish; proper loading states (skeleton loaders on all dashboard data).
**Addresses:** Admin dashboard with KPIs (table stakes), persistent sidebar navigation (differentiator), mobile-responsive admin polish.
**Avoids:** Pitfall 8 (admin UX regressions breaking existing workflows — run Playwright E2E suite before and after every layout change), Pitfall 14 (sidebar state loss on page navigation — persist to localStorage or cookie).
**Uses:** shadcn/ui chart component (Recharts v2) for KPI trend charts.
**Research flag:** Standard patterns — shadcn Sidebar and Chart components are well-documented with an official Vercel dashboard template. No additional research needed.

### Phase 6: Vendor and Work Order Management

**Rationale:** Vendor features depend on the ledger (work order costs can generate tenant charges), S3 (receipt photo uploads), and the sidebar layout (vendor CRUD pages inherit Phase 5's admin layout automatically). This is the least risky phase because it adds new functionality without modifying existing financial flows.
**Delivers:** Vendor directory CRUD; work order creation from maintenance requests; cost tracking (labor, materials, receipt uploads); vendor limited-view sharing via signed token URL (no vendor login required — read-only view of work order details without tenant PII).
**Addresses:** Vendor assignment for maintenance (differentiator), work order cost tracking (differentiator).
**Avoids:** Pitfall 10 (vendor PII leakage — vendor-specific API routes with filtered payloads, no tenant names or contact info), Pitfall 15 (floating-point money in cost fields — use integer cents consistent with existing schema).
**Research flag:** Standard patterns — vendor CRUD + work order is straightforward relational modeling. The signed token pattern for vendor access is documented in STACK.md. No additional research needed.

### Phase Ordering Rationale

- **Infrastructure before features**: The Neon driver swap is a hard prerequisite. S3 and edge auth are independent but should be resolved early to prevent technical debt from accumulating.
- **Ledger before everything financial**: Late fees, KPI metrics, and move-out reconciliation all require the charges table. This is a hard dependency, not a soft preference.
- **Automated operations are higher risk than manual ones**: Late fees fire automatically and charge tenants. They must be configurable, auditable, and default-off before any cron is deployed.
- **Move-out requires the ledger**: Final balance calculation, charge posting, and autopay cancellation must be atomic — all require the charges table and WebSocket driver transactions.
- **Admin UX before vendor pages**: The sidebar is the layout container. New vendor pages are built inside it directly, not retrofitted into it later.
- **Vendor management is additive**: It adds new tables and UI without touching existing financial flows, making it the safest last phase.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1 (Edge Auth):** The exact format of the `better-auth.session_data` cookie JWT payload is not fully documented. The architecture is correct, but the payload structure must be verified empirically by inspecting a live session cookie. Better Auth issue #5120 confirms `getCookieCache()` is not Edge-safe, but the manual JWT decode workaround may need adjustment if the cookie format changes between Better Auth versions.
- **Phase 2 (Ledger Migration):** The backfill logic for reconciling existing payments into charges is custom to this codebase. Run `SELECT COUNT(*), status FROM payments GROUP BY status` before designing the migration to understand the scope. The migration must handle autopay processing fees, failed payments, pending ACH transactions, and any manual/cash payments differently.
- **Phase 3 (Late Fee Rules):** Jurisdiction-specific legal requirements need validation before automating late fees. Research is currently at the general level; applicable state law must be confirmed for the property's location.

Phases with standard patterns (skip research-phase):
- **Phase 4 (Portfolio CRUD):** Standard CRUD with soft-delete is a well-documented Drizzle pattern. The key decisions (RESTRICT vs CASCADE, archivedAt soft-delete) are schema decisions, not research questions.
- **Phase 5 (Admin UX):** shadcn/ui Sidebar and Chart components are thoroughly documented. The official Vercel dashboard template is a direct reference.
- **Phase 6 (Vendor/Work Orders):** Standard relational data modeling with a signed read-only URL pattern (documented in STACK.md). No research needed.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions confirmed via npm registry as of 2026-02-26. Official documentation reviewed for all new packages. One risk area: Recharts v3 shadcn support is tracked in open issue #7669 — use v2 until resolved or shadcn ships v3 support. |
| Features | MEDIUM-HIGH | Multiple PMS platforms analyzed (AppFolio, Buildium, Stessa, Rentec Direct, TenantCloud, DoorLoop). Sources are mostly vendor documentation and blogs — subject to vendor bias, but cross-referenced for consistency. Late fee legal rules require jurisdiction-specific verification before production automation. |
| Architecture | HIGH | Based on direct codebase inspection plus official library documentation. Schema designs are concrete and verifiable. One MEDIUM-confidence area: Better Auth cookie cache edge compatibility (GitHub issue #5120 confirmed, but the manual JWT decode workaround relies on an undocumented cookie payload format). |
| Pitfalls | HIGH | Every pitfall maps to specific code in the existing system. Infrastructure pitfalls (Neon driver, S3 CORS, Stripe webhook) are sourced from official documentation with HIGH confidence. Domain pitfalls (move-out zombie autopay, cascade deletes) are confirmed as real risks via direct schema analysis. |

**Overall confidence:** HIGH

### Gaps to Address

- **Better Auth cookie cache JWT payload structure**: The edge middleware will decode `better-auth.session_data` using `jose` and `BETTER_AUTH_SECRET`. The exact shape of the JWT payload — specifically whether `user.role` is a top-level claim or nested under a `user` object — must be verified by inspecting an actual session cookie during Phase 1 implementation. If the structure differs, the middleware role check silently falls through to the layout-level check (safe, but the edge optimization is lost until the claim path is corrected).

- **Neon WebSocket driver connection pooling in serverless**: The WebSocket driver (`Pool`) behaves differently from the HTTP driver in serverless environments. The Neon connection pooler URL (port 5432 with PgBouncer) must be used to avoid exhausting connection limits under concurrent invocations. Verify connection behavior during Phase 1 with a concurrent load test.

- **Late fee jurisdiction requirements**: The current single property's location determines which state laws apply. Before enabling automated late fees in Phase 3, confirm: grace period minimum, fee cap if any, and notice requirements.

- **Backfill scope**: Run `SELECT COUNT(*), status FROM payments GROUP BY status` before designing the Phase 2 migration script to understand exact counts of succeeded, failed, pending, and manually-created payment records. This determines migration complexity.

---

## Sources

### Primary (HIGH confidence)
- [Neon Serverless Driver — Transaction Limitations](https://neon.com/docs/serverless/serverless-driver) — HTTP driver has no `db.transaction()` support; WebSocket driver does
- [Drizzle ORM — Neon Connection Guide](https://orm.drizzle.team/docs/connect-neon) — HTTP vs WebSocket driver API differences
- [AWS S3 Presigned URLs Documentation](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html) — presigned URL patterns and expiry best practices
- [AWS S3: Troubleshooting CORS](https://docs.aws.amazon.com/AmazonS3/latest/userguide/cors-troubleshooting.html) — CORS configuration requirements
- [Cloudflare R2 Presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/) — S3-compatible presigned URL confirmation
- [Cloudflare R2 AWS SDK v3 Example](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/) — S3Client configuration for R2
- [Better Auth JWT Plugin](https://www.better-auth.com/docs/plugins/jwt) — JWT token issuance, JWKS, definePayload
- [Better Auth Bearer Plugin](https://www.better-auth.com/docs/plugins/bearer) — bearer token authentication
- [Better Auth Edge Issue #5120](https://github.com/better-auth/better-auth/issues/5120) — confirms getCookieCache NOT Edge-safe
- [jose npm (v6.1.3)](https://github.com/panva/jose) — Edge-compatible JWT library
- [Next.js Authentication Guide](https://nextjs.org/docs/app/guides/authentication) — official recommendation to use jose for Edge Runtime
- [date-fns v4 Blog Post](https://blog.date-fns.org/v40-with-time-zone-support/) — first-party timezone support via @date-fns/tz
- [shadcn/ui Chart Component](https://ui.shadcn.com/docs/components/radix/chart) — Recharts v2 integration details
- [shadcn/ui Sidebar Component](https://ui.shadcn.com/docs/components/radix/sidebar) — sidebar layout patterns
- [Stripe: Handle Payment Events with Webhooks](https://docs.stripe.com/webhooks/handling-payment-events) — webhook event handling patterns
- [Stripe: Idempotent Requests](https://docs.stripe.com/api/idempotent_requests) — event deduplication
- npm registry version checks (2026-02-26): `jose@6.1.3`, `@aws-sdk/client-s3@3.999.0`, `@aws-sdk/s3-request-presigner@3.999.0`, `date-fns@4.1.0`, `@date-fns/tz@1.4.1`

### Secondary (MEDIUM confidence)
- [Stessa — Tenant Ledger](https://support.stessa.com/en/articles/4806958-tenant-ledger-how-to-track-charges-payments-balances) — production ledger implementation reference
- [Rentec Direct — Understanding Tenant Transactions](https://help.rentecdirect.com/article/524-understanding-tenant-related-transactions) — charge entry types from production PMS
- [Rentec Direct — Understanding Ledgers and Transaction Types](https://help.rentecdirect.com/article/523-understanding-ledgers-and-transaction-types) — ledger structure
- [AppFolio — Move-Out Workflow](https://www.apmhelp.com/blog/move-outs-in-appfolio) — industry-standard move-out process
- [DoorLoop — Work Orders](https://www.doorloop.com/features/work-orders) — vendor assignment and work order workflow
- [Revela — Property Management KPIs](https://www.revela.co/resources/property-management-kpis) — KPI definitions and formulas
- [Modern Treasury — Ledger Database](https://www.moderntreasury.com/learn/ledger-database) — append-only ledger design principles
- [pgledger — Ledger Implementation in PostgreSQL](https://www.pgrs.net/2025/03/24/pgledger-ledger-implementation-in-postgresql/) — concurrent ledger implementation
- [Better Auth Cookie Cache Discussion #5066](https://github.com/better-auth/better-auth/discussions/5066) — community workarounds for edge cookie reading
- [Neon Guide: S3 + Next.js](https://neon.com/guides/next-upload-aws-s3) — S3 uploads with Next.js and Postgres reference storage

### Tertiary (LOW confidence — needs validation)
- Late fee state law sources (Baselane, TrueDoor PM, UtilityProfit) — consistent across sources but require jurisdiction-specific legal verification before production use

---
*Research completed: 2026-02-26*
*Ready for roadmap: yes*
