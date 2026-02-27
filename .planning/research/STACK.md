# Stack Research: v2.0 Additions

**Domain:** Property management portal -- v2.0 production hardening (financial ledger, cloud storage, edge auth, admin UX, vendor management)
**Researched:** 2026-02-26
**Confidence:** HIGH (versions confirmed via npm registry; integration patterns verified via official docs)

**Scope:** This document covers ONLY new stack additions for v2.0. The existing validated stack (Next.js 15.5, Better Auth, Drizzle ORM, Neon PostgreSQL, Stripe, Resend, Twilio, shadcn/ui, Tailwind v4) is unchanged and not re-documented here.

---

## New Stack Additions

### 1. S3-Compatible Cloud Storage

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@aws-sdk/client-s3` | ^3.999.0 | S3 operations -- PutObject, GetObject, DeleteObject, HeadObject | Official AWS SDK v3 is modular (import only commands you need). Works with both AWS S3 and Cloudflare R2 via endpoint override. Server-side only -- never expose credentials to the client. |
| `@aws-sdk/s3-request-presigner` | ^3.999.0 | Generate presigned URLs for direct browser uploads and time-limited downloads | Presigned URLs let the browser upload directly to S3/R2 -- file data never touches the Next.js server. This eliminates memory pressure from large file buffers and avoids Next.js request payload limits. Presign expiry should be 5 minutes for uploads, 1 hour for downloads. |

**Use Cloudflare R2, not AWS S3.** R2 has zero egress fees (S3 charges $0.09/GB). For a property management app serving maintenance photos and documents to tenants and admin, egress costs would dominate. R2 is fully S3-API-compatible -- same SDK, same presigned URL pattern, different endpoint URL.

**R2 S3Client configuration:**

```typescript
import { S3Client } from "@aws-sdk/client-s3"

export const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})
```

**Migration strategy:** The existing `uploads/` directory stores files at `filePath` (relative path). During migration, upload each file to R2 with the same key, then update the serving route (`/api/uploads/[...path]`) to generate presigned GET URLs instead of reading from disk. The `filePath` column in `maintenancePhotos` and `documents` tables becomes the S3 key -- no schema change needed.

**Integration with existing stack:**
- Replace `src/lib/uploads.ts` (`saveUploadedFile`) with a `getUploadPresignedUrl()` function that returns a presigned PUT URL
- Replace `src/app/api/uploads/[...path]/route.ts` with a route that generates presigned GET URLs (or serve via R2 public bucket with signed cookies)
- Maintain the same auth check (session required) before generating any presigned URL

### 2. Edge-Level JWT Role Authorization

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Better Auth JWT plugin | (bundled with `better-auth` ^1.4.19) | Issue JWTs with custom claims including user role | Built into Better Auth -- no new dependency. The `definePayload` option lets you embed `role` from the admin plugin directly into the JWT. Uses asymmetric keys (EdDSA Ed25519 by default) with automatic key rotation via a `jwks` DB table. |
| Better Auth Bearer plugin | (bundled with `better-auth` ^1.4.19) | Send JWT as Authorization header instead of cookies | Required for the JWT flow. Client stores the bearer token and attaches it to requests. The plugin intercepts requests and adds the token to the Authorization header. |
| `jose` | ^6.1.3 | Verify JWTs in Edge Runtime middleware | The standard library for JWT operations in Edge environments. Uses Web Crypto APIs (no Node.js `crypto` dependency). Next.js officially recommends jose for Edge Runtime JWT verification. The `jwtVerify` function validates tokens against the JWKS public keys without any database call. |

**How it works end-to-end:**

1. Better Auth JWT plugin issues a token at `/api/auth/token` with payload `{ id, email, role }` via `definePayload`
2. Better Auth exposes JWKS at `/api/auth/jwks` for public key retrieval
3. Client stores the bearer token (via Better Auth Bearer plugin)
4. `middleware.ts` uses `jose.jwtVerify()` to validate the token and extract the `role` claim
5. Admin routes (`/admin/*`) are rejected at the edge if `role !== "admin"` -- no DB call, no cold start

**Why jose, not jsonwebtoken:** The `jsonwebtoken` package uses Node.js `crypto` module which is unavailable in Edge Runtime. jose uses Web Crypto APIs and is explicitly designed for Edge/serverless. Next.js docs recommend it.

**Integration with existing middleware:** The current `middleware.ts` uses `getSessionCookie()` from Better Auth which only checks cookie presence (not role). The upgrade path:
- Keep the cookie-presence check as a fast-path for session existence
- Add JWT verification for role-based routing: admin routes require `role === "admin"` in the JWT payload
- The comment in the current middleware (`"Can't check role here (Edge runtime)"`) is exactly what this solves

**Caveat:** Better Auth's JWT plugin documentation does not explicitly discuss Edge Runtime compatibility for the token generation side, but that runs server-side (Node.js runtime), not in Edge middleware. The Edge middleware only needs jose for verification, which is fully compatible.

### 3. Timezone-Aware Date Handling

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `date-fns` | ^4.1.0 | Date manipulation -- rent due date calculations, overdue logic, billing period formatting | Tree-shakeable, TypeScript-native, immutable API. v4 is the current stable release. The project currently does manual date math (`today.getDate()`, `today.getMonth()`) which is error-prone around month boundaries and DST transitions. |
| `@date-fns/tz` | ^1.4.1 | Timezone-aware date calculations | First-party timezone support for date-fns v4. Provides `TZDate` class that performs all calculations in a specified IANA timezone rather than the server's system timezone. Replaces the third-party `date-fns-tz` package which was designed for v2/v3. |

**Why timezone awareness matters:** The cron jobs (`/api/cron/rent-reminders`, `/api/cron/autopay-charge`) currently use `new Date()` which returns server-local time. If deployed to Vercel (UTC servers), "today" for a property in America/Los_Angeles would be wrong by up to 8 hours. A reminder meant for the 5th could fire on the 4th or 6th depending on when the cron runs.

**Integration approach:**
- Store the property timezone in the `properties` table (new column: `timezone TEXT DEFAULT 'America/New_York'`)
- In cron routes, use `TZDate` to compute "today" in the property's timezone before calculating `daysUntilDue`
- System crontab continues to fire at a fixed UTC time; the route handler adjusts to property-local time

**No in-process scheduler needed.** The existing pattern (system crontab curling a CRON_SECRET-protected API route) is correct for this scale. Do NOT add `node-cron` or `cron` npm packages -- they require a long-running process, which conflicts with serverless deployment. The timezone logic belongs in the route handler, not the scheduler.

### 4. Dashboard Charts (KPI Metrics)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `recharts` | ^2.15.3 (v2 stable) | Render KPI charts on admin dashboard -- payment trends, occupancy, revenue | shadcn/ui's chart components are built on Recharts v2 -- this is the only charting library that integrates with the existing component system without friction. Install via `npx shadcn@latest add chart` to get the pre-styled chart primitives (ChartContainer, ChartTooltip, etc.). No separate Recharts install needed -- shadcn bundles it. |

**Why NOT Recharts v3:** shadcn/ui is actively working on Recharts v3 support but has not shipped it yet (open issue #7669 as of Feb 2026). Stick with v2 via shadcn's chart component to avoid breaking the shadcn integration.

**Why NOT Tremor:** Tremor is built on Recharts + Radix UI (same foundation as shadcn/ui) but introduces its own design system. The project already uses shadcn/ui -- adding Tremor creates two competing component systems. shadcn's chart components provide the same KPI card + chart patterns without the duplication.

**What to build:**
- Revenue collected vs. expected (bar chart by month)
- Payment status distribution (donut chart: paid/pending/overdue)
- Occupancy rate over time (area chart)
- Outstanding balances summary (KPI cards with trend indicators)

All data comes from existing `payments` table + new `charges` table via server-side Drizzle aggregation queries. No client-side data processing.

### 5. Ledger/Financial Model (Schema-Only -- No New Libraries)

No new npm packages required. The ledger model is a database design pattern implemented with Drizzle ORM + Neon PostgreSQL (both already in the stack).

**New tables needed:**

| Table | Purpose |
|-------|---------|
| `charges` | Immutable charge records (rent, late fees, one-time charges). Each charge has `amountCents`, `dueDate`, `billingPeriod`, `chargeType`, `unitId`, `tenantUserId`. |
| `ledger_entries` | Append-only ledger linking charges to payments. Each entry records a debit (charge) or credit (payment) with a running balance. |

**Design principles:**
- **Append-only:** Never update or delete ledger entries. Corrections are new entries (credit adjustments).
- **Running balance per tenant-unit:** Compute balance as `SUM(charges) - SUM(payments)` for the tenant-unit pair. Store as a materialized running balance column on `tenant_units` for fast dashboard reads, recompute on each transaction.
- **Partial payments:** A single payment can be applied across multiple charges. The `ledger_entries` table links payment ID to charge ID with the applied amount.
- **Late fees:** Automated via cron route. Create a new `charge` record with `chargeType: 'late_fee'` when payment is overdue past threshold.

**Why NOT full double-entry bookkeeping:** Double-entry (debit + credit accounts, journal entries) is designed for general-purpose accounting systems. This is a property-specific receivables tracker. The charges + payments + ledger_entries model is simpler, sufficient, and avoids the cognitive overhead of T-accounts for a 5-unit building. If the portfolio grows to 50+ units and needs GL integration, migrate then.

### 6. Vendor Management (Schema-Only -- No New Libraries)

No new npm packages required. Vendor management is CRUD with relationships to maintenance requests and cost tracking.

**New tables needed:**

| Table | Purpose |
|-------|---------|
| `vendors` | Vendor directory: name, trade/specialty, phone, email, notes, active status |
| `work_orders` | Links a maintenance request to a vendor assignment with cost tracking (estimated cost, actual cost, invoice reference) |

**Limited-view sharing for vendors:** Do NOT build a full vendor portal or vendor auth. Instead, generate a time-limited signed URL (using the same jose library) that gives read-only access to a specific work order's details. The vendor receives this link via email/SMS. This avoids adding another auth flow and user type.

---

## Existing Stack Upgrades

| Package | Current | Recommended | Why |
|---------|---------|-------------|-----|
| `date-fns` | not installed | ^4.1.0 | Required for timezone-aware cron logic. v4 has first-party TZ support via `@date-fns/tz`. |
| `zod` | ^4.3.6 | no change | Already latest major. |
| `better-auth` | ^1.4.19 | no change | JWT and Bearer plugins are already bundled. Just enable them in config. |
| `drizzle-orm` | ^0.45.1 | no change | Stable. v1.0 beta available but not recommended for production. |

---

## Installation

```bash
# S3/R2 cloud storage
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner

# Edge JWT verification
npm install jose

# Timezone-aware dates
npm install date-fns @date-fns/tz

# Dashboard charts (installs recharts v2 as shadcn dependency)
npx shadcn@latest add chart
```

**Total new dependencies: 4 packages + 1 shadcn component.** Everything else (ledger, vendor management, admin CRUD) is implemented with the existing stack.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Cloud storage | Cloudflare R2 | AWS S3 | R2 has zero egress fees. For serving photos/docs to tenants, egress would be the dominant cost on S3. Same SDK, same API. |
| Cloud storage | Cloudflare R2 | Uploadthing | Uploadthing is a managed wrapper around S3. Adds abstraction and monthly cost for features we do not need. Presigned URLs via AWS SDK are straightforward. |
| Cloud storage | Cloudflare R2 | Vercel Blob | Vercel Blob is simpler but more expensive per GB and locks you into Vercel's storage pricing. R2 is cheaper and provider-agnostic. |
| Edge JWT verification | jose | jsonwebtoken | jsonwebtoken uses Node.js `crypto` -- incompatible with Edge Runtime. jose uses Web Crypto APIs. Next.js officially recommends jose. |
| Timezone | date-fns v4 + @date-fns/tz | luxon | Luxon is heavier (~68kb) and not tree-shakeable. date-fns v4 is modular and the project will use it for non-TZ date operations too. |
| Timezone | date-fns v4 + @date-fns/tz | date-fns-tz (third-party) | date-fns-tz was designed for date-fns v2/v3. v4 has official first-party TZ support via @date-fns/tz. Use the official package. |
| Dashboard charts | shadcn/ui chart (Recharts v2) | Tremor | Tremor adds a second component system alongside shadcn/ui. Unnecessary duplication. shadcn chart components use the same Radix + Recharts foundation. |
| Dashboard charts | shadcn/ui chart (Recharts v2) | Chart.js / react-chartjs-2 | Would require separate styling system. shadcn chart components are pre-styled with Tailwind and match the existing design system. |
| CRON scheduling | System crontab + API route | node-cron / cron npm | In-process schedulers require a long-running server. The app deploys to serverless (Vercel/similar). System crontab (or Vercel Cron) hitting an API route is the correct pattern. |
| Financial model | Charges + payments + ledger_entries | Full double-entry bookkeeping | Overkill for a 5-unit receivables tracker. Double-entry adds journal entries, T-accounts, and chart of accounts -- complexity that provides no value at this scale. |
| Vendor sharing | Signed URL (jose) | Vendor auth / login portal | Adding vendor accounts means a third user type, new auth flows, new middleware rules. A signed read-only URL is 10x simpler for "vendor sees work order details." |

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `multer` | Server-side file processing creates memory pressure and hits Next.js payload limits. | Presigned S3 URLs -- browser uploads directly to R2. |
| `sharp` for image processing | The original STACK.md recommended sharp for compression before S3 upload. With presigned URLs, files go directly from browser to R2 -- the server never sees the file bytes. Server-side sharp would require a two-step flow (upload to server, process, re-upload to R2) which defeats the purpose. | Accept reasonable file sizes (25MB max, already enforced client-side) and let R2 store originals. If thumbnails are needed later, use Cloudflare Image Resizing (R2 integration) or a Cloudflare Worker. |
| `node-cron` / `cron` npm packages | Require a persistent Node.js process. Incompatible with serverless/Vercel deployment. | System crontab (or Vercel Cron Jobs) hitting CRON_SECRET-protected API routes. Already implemented and working. |
| `jsonwebtoken` | Uses Node.js `crypto` module. Crashes in Edge Runtime. | `jose` (Web Crypto APIs, Edge-compatible). |
| Tremor | Adds a competing design system alongside shadcn/ui. | shadcn/ui chart components (built on Recharts). |
| Full accounting library (e.g., `medici`, `ledger.js`) | Designed for general-purpose double-entry bookkeeping. Adds complexity and abstractions that do not map to property management receivables. | Custom charges + payments + ledger_entries tables in Drizzle. |
| Redis / BullMQ for job queues | No background jobs that cannot be handled by cron + API routes. Adding Redis is a new infrastructure dependency with hosting costs. | Cron-triggered API routes for all scheduled work (reminders, autopay charges, late fee generation). |
| Separate vendor portal / vendor auth | Third user type adds auth complexity, middleware rules, and UI surface area disproportionate to the value. | Signed read-only URLs for work order viewing. Vendors are a directory entry, not portal users. |

---

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `@aws-sdk/client-s3` ^3.999.0 | `@aws-sdk/s3-request-presigner` ^3.999.0 | Both are AWS SDK v3 monorepo packages -- keep versions in sync. |
| `@aws-sdk/client-s3` ^3.999.0 | Cloudflare R2 | R2 is S3-API-compatible. Set `endpoint` and `region: "auto"` in S3Client config. |
| `jose` ^6.1.3 | Next.js 15.5 Edge Runtime | v6.0.4 fixed a regression with Edge Runtime compatibility. v6.1.3 is current and stable. |
| `jose` ^6.1.3 | Better Auth JWT plugin | jose verifies tokens from Better Auth's JWKS endpoint. No direct dependency -- jose reads standard JWKS/JWT formats. |
| `date-fns` ^4.1.0 | `@date-fns/tz` ^1.4.1 | @date-fns/tz is the official first-party TZ extension for date-fns v4. Not compatible with date-fns v3. |
| `recharts` ^2.15.x | shadcn/ui chart component | shadcn chart components target Recharts v2. Recharts v3 (3.7.0) is available but shadcn support is not shipped yet. Let shadcn manage the Recharts version. |
| Better Auth JWT plugin | Better Auth ^1.4.19 | Bundled with Better Auth. No separate install. Enable via `jwt()` in plugins array. |
| Better Auth Bearer plugin | Better Auth ^1.4.19 | Bundled with Better Auth. No separate install. Enable via `bearer()` in plugins array. |

---

## Environment Variables (New)

```bash
# Cloudflare R2
R2_ACCOUNT_ID=           # Cloudflare account ID
R2_ACCESS_KEY_ID=        # R2 API token access key
R2_SECRET_ACCESS_KEY=    # R2 API token secret
R2_BUCKET_NAME=          # R2 bucket name (e.g., "rentalmgmt-uploads")
R2_PUBLIC_URL=           # Optional: custom domain for public R2 access

# Better Auth JWT (optional -- Better Auth generates keys automatically)
# No new env vars required. Keys are stored in the `jwks` DB table.
# The JWKS endpoint is automatically served at /api/auth/jwks.
```

---

## Sources

- [AWS S3 Presigned URLs Documentation](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html) -- Official AWS docs on presigned URL generation and best practices. **HIGH confidence.**
- [AWS Presigned URL Best Practices (PDF)](https://docs.aws.amazon.com/pdfs/prescriptive-guidance/latest/presigned-url-best-practices/presigned-url-best-practices.pdf) -- AWS prescriptive guidance on security and expiry. **HIGH confidence.**
- [Cloudflare R2 Presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/) -- Official R2 docs confirming S3-compatible presigned URL support. **HIGH confidence.**
- [Cloudflare R2 AWS SDK v3 Example](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/) -- Official R2 S3Client configuration example. **HIGH confidence.**
- [Better Auth JWT Plugin](https://www.better-auth.com/docs/plugins/jwt) -- Official docs on JWT token issuance, JWKS, definePayload, key rotation. **HIGH confidence.**
- [Better Auth Bearer Plugin](https://www.better-auth.com/docs/plugins/bearer) -- Official docs on bearer token authentication. **HIGH confidence.**
- [jose npm (v6.1.3)](https://github.com/panva/jose) -- Edge-compatible JWT library, Web Crypto APIs, recommended by Next.js. Version confirmed via npm registry. **HIGH confidence.**
- [Next.js Authentication Guide](https://nextjs.org/docs/app/guides/authentication) -- Official Next.js recommendation to use jose for Edge Runtime JWT. **HIGH confidence.**
- [date-fns v4 Blog Post](https://blog.date-fns.org/v40-with-time-zone-support/) -- Official announcement of first-party timezone support via @date-fns/tz. **HIGH confidence.**
- [shadcn/ui Chart Component](https://ui.shadcn.com/docs/components/radix/chart) -- Official shadcn chart docs confirming Recharts v2 under the hood. **HIGH confidence.**
- [Neon Guide: S3 + Next.js](https://neon.com/guides/next-upload-aws-s3) -- Neon's official guide for S3 uploads with Next.js and Postgres reference storage. **MEDIUM confidence.**
- [Ledger Database Design -- Modern Treasury](https://www.moderntreasury.com/learn/ledger-database) -- Ledger design principles (append-only, immutability, idempotency). **MEDIUM confidence.**
- [Square Books -- Immutable Double-Entry Accounting](https://developer.squareup.com/blog/books-an-immutable-double-entry-accounting-database-service/) -- Design principles for append-only financial systems. **MEDIUM confidence.**
- npm registry version checks (2026-02-26): `jose@6.1.3`, `@aws-sdk/client-s3@3.999.0`, `@aws-sdk/s3-request-presigner@3.999.0`, `date-fns@4.1.0`, `@date-fns/tz@1.4.1`, `recharts@3.7.0` (v3 available but shadcn uses v2). **HIGH confidence.**

---

*Stack research for: RentalMgmt v2.0 -- new capabilities only*
*Researched: 2026-02-26*
