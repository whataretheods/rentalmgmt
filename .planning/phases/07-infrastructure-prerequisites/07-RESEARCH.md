# Phase 7: Infrastructure Prerequisites - Research

**Researched:** 2026-02-26
**Domain:** Database transactions, cloud file storage, edge authorization, cascade safety, admin layout
**Confidence:** HIGH

## Summary

Phase 7 addresses five independent technical prerequisites that unblock all subsequent v2.0 feature work. The current codebase uses the Neon HTTP driver (`neon()` + `drizzle-orm/neon-http`) which cannot execute `db.transaction()` -- the most critical blocker for the financial ledger in Phase 8. Files are stored in a local `uploads/` directory on the server filesystem. Admin route protection relies on server-component-level session checks (no edge rejection). All foreign key relationships use `ON DELETE CASCADE`, which would destroy financial history if a unit or property were deleted. The admin layout uses a flat horizontal nav bar, not a sidebar.

Each of these five areas is well-understood with established patterns in the existing stack. The Neon serverless driver already supports WebSocket mode via `Pool` (same package, different import path). S3-compatible storage (Cloudflare R2 recommended for zero egress fees) uses the standard AWS SDK v3 with presigned URLs. Next.js 15.5 (the project's exact version) ships stable Node.js runtime support in middleware, enabling full `auth.api.getSession()` calls with role checking at the edge. Drizzle migrations can alter foreign key constraints from CASCADE to RESTRICT. shadcn/ui ships a full-featured sidebar component with cookie-based persistence.

**Primary recommendation:** Execute all five workstreams in sequence within a single phase. The database driver swap is the riskiest change (touches every query path) and should be done first. S3 migration uses a dual-read pattern for zero-downtime cutover. Middleware upgrade is straightforward given Next.js 15.5's stable Node.js runtime. Cascade-to-RESTRICT migration is a schema-only change. Sidebar is a pure UI task.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFRA-04 | Database driver supports transactions (Neon WebSocket driver) for atomic multi-table operations | Swap from `drizzle-orm/neon-http` to `drizzle-orm/neon-serverless` with `Pool` client. `db.transaction()` becomes available. Requires `ws` package on Node.js v20. See "Database Driver Swap" architecture pattern. |
| INFRA-01 | Maintenance photos and documents stored in S3-compatible cloud storage with presigned URLs | Cloudflare R2 with `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`. Add `storageBackend` column to schema for dual-read. See "S3 Cloud Storage Migration" pattern. |
| INFRA-02 | User role encoded in JWT/session so edge middleware can reject unauthorized /admin access without hitting application code | Next.js 15.5 stable Node.js middleware runtime. Use `auth.api.getSession()` with role check in middleware.ts. Better Auth cookie cache (`session_data` cookie) includes `role` field. See "Edge Role Authorization" pattern. |
| INFRA-05 | Cascade delete constraints replaced with soft-delete and ON DELETE RESTRICT to protect financial history | Drizzle migration to ALTER foreign keys from CASCADE to RESTRICT. Add `archivedAt` column to properties and units. See "Cascade Safety" pattern. |
| AUX-01 | Admin portal uses persistent collapsible sidebar navigation across all admin pages | shadcn/ui sidebar component with cookie-based persistence via `SidebarProvider`. See "Admin Sidebar" pattern. |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@neondatabase/serverless` | ^1.0.2 (already installed) | WebSocket-capable Neon driver | Same package, different adapter path. Supports `Pool`/`Client` for interactive transactions. |
| `drizzle-orm` | ^0.45.1 (already installed) | ORM with `neon-serverless` adapter | `drizzle-orm/neon-serverless` adapter uses `Pool` from `@neondatabase/serverless` for transactions. |
| `@aws-sdk/client-s3` | ^3.x | S3 API client (works with R2) | Official AWS SDK v3, S3-compatible API used by R2. Tree-shakeable modular design. |
| `@aws-sdk/s3-request-presigner` | ^3.x | Presigned URL generation | Standard way to generate time-limited upload/download URLs. |
| `better-auth` | ^1.4.19 (already installed) | Auth with cookie cache + admin plugin | Cookie cache stores `role` field. `getCookieCache()` or `auth.api.getSession()` in Node.js middleware. |
| shadcn/ui sidebar | latest | Collapsible sidebar with cookie persistence | Official shadcn/ui component, cookie-based state persistence, works with Next.js App Router. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `ws` | ^8.x | WebSocket polyfill for Node.js v20 | Required because project runs Node.js v20.12.0 (native WebSocket only in v22+). |
| `bufferutil` | ^4.x | Performance optimization for `ws` | Optional but recommended by `ws` docs for production performance. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Cloudflare R2 | AWS S3 | S3 has deeper ecosystem but R2 has zero egress fees. For a 5-unit building with low file volume, cost difference is minimal but R2 is simpler (no egress billing). Both use identical AWS SDK v3 code. |
| Node.js middleware runtime | Edge + cookie decode | Edge is lighter but cannot call `auth.api.getSession()`. Cookie cache (`getCookieCache()`) has known Edge compatibility issues (GitHub issue #5120). Node.js runtime is stable in Next.js 15.5 and allows full session validation. |
| `ON DELETE RESTRICT` | Soft-delete only (no constraint change) | RESTRICT provides database-level safety even if application code has bugs. Both are needed: RESTRICT as the guard rail, soft-delete (`archivedAt`) as the business logic. |
| Custom sidebar | shadcn/ui sidebar component | Custom would match current horizontal nav style but shadcn/ui sidebar is production-tested, handles mobile, and has cookie persistence built in. No reason to hand-roll. |

**Installation:**
```bash
npm install ws @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
npm install -D @types/ws
```

Note: `@neondatabase/serverless` and `drizzle-orm` are already installed at compatible versions. The sidebar is installed via `npx shadcn@latest add sidebar`.

## Architecture Patterns

### Recommended Changes to Project Structure
```
src/
├── db/
│   └── index.ts              # CHANGE: swap neon-http → neon-serverless + Pool
├── lib/
│   ├── uploads.ts            # CHANGE: add S3 upload path, keep local fallback
│   ├── storage.ts            # NEW: S3 client initialization + presigned URL helpers
│   └── auth.ts               # CHANGE: add cookieCache config
├── components/
│   ├── ui/
│   │   └── sidebar.tsx       # NEW: shadcn/ui sidebar (auto-generated)
│   └── admin/
│       └── AdminSidebar.tsx   # NEW: app-specific sidebar with nav items
├── app/
│   └── (admin)/
│       └── layout.tsx         # CHANGE: wrap with SidebarProvider + AdminSidebar
└── middleware.ts              # CHANGE: add role check for /admin routes
```

### Pattern 1: Database Driver Swap (neon-http to neon-serverless)

**What:** Replace the Neon HTTP adapter with the WebSocket adapter to enable `db.transaction()`.

**When to use:** This is a one-time migration. All database queries will go through the new driver.

**Current code (`src/db/index.ts`):**
```typescript
import { neon } from "@neondatabase/serverless"
import { drizzle, NeonHttpDatabase } from "drizzle-orm/neon-http"

const sql = neon(databaseUrl)
_db = drizzle({ client: sql, schema })
```

**New code:**
```typescript
import { Pool, neonConfig } from "@neondatabase/serverless"
import { drizzle, NeonHttpDatabase } from "drizzle-orm/neon-serverless"
import ws from "ws"
import * as schema from "./schema"

// Required for Node.js < v22 (project uses v20.12.0)
neonConfig.webSocketConstructor = ws

let _pool: Pool | null = null

function getPool(): Pool {
  if (!_pool) {
    const databaseUrl = process.env.DATABASE_URL
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is not set.")
    }
    _pool = new Pool({ connectionString: databaseUrl })
  }
  return _pool
}

export const db = drizzle({ client: getPool(), schema })
```

**Transaction usage (available after swap):**
```typescript
// Source: https://orm.drizzle.team/docs/transactions
await db.transaction(async (tx) => {
  await tx.insert(charges).values({ ... })
  await tx.update(balances).set({ ... }).where(...)
  // Both succeed or both roll back
})
```

**Critical detail:** The `Pool` is a persistent connection pool. Unlike the HTTP adapter which is stateless, the Pool maintains WebSocket connections. For serverless (Vercel), the pool is created per cold start and reused across requests within the same invocation. The `drizzle()` Proxy pattern from current code should be preserved for lazy initialization.

**Impact on Better Auth:** Better Auth's `drizzleAdapter` accepts any Drizzle DB instance. Swapping the underlying driver does not change the adapter API. The `auth.ts` file needs no changes -- it imports `db` from `@/db` which will transparently use the new driver.

### Pattern 2: S3 Cloud Storage Migration (Dual-Read)

**What:** New uploads go to S3/R2. Existing files continue to be read from local `uploads/` directory. A `storageBackend` column tracks which storage each file uses.

**Architecture:**
```
Upload Flow:
1. Client sends file to API route
2. API route uploads to S3 via presigned URL (or server-side PutObject)
3. API stores S3 key + storageBackend="s3" in database
4. Return success

Download Flow:
1. Client requests file
2. API checks storageBackend column
3. If "s3": generate presigned GET URL, redirect
4. If "local": serve from uploads/ directory (existing behavior)
```

**S3 Client Setup (`src/lib/storage.ts`):**
```typescript
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

const s3 = new S3Client({
  region: "auto",  // R2 uses "auto"
  endpoint: process.env.S3_ENDPOINT!,  // https://<account_id>.r2.cloudflarestorage.com
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
})

export async function uploadToS3(
  buffer: Buffer,
  key: string,
  contentType: string,
): Promise<string> {
  await s3.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME!,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }))
  return key
}

export async function getPresignedDownloadUrl(key: string): Promise<string> {
  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME!,
      Key: key,
    }),
    { expiresIn: 3600 },  // 1 hour
  )
}
```

**Schema change for dual-read:**
```typescript
// Add to maintenancePhotos and documents tables:
storageBackend: text("storage_backend", {
  enum: ["local", "s3"],
}).default("local").notNull(),
s3Key: text("s3_key"),  // null for local files
```

**Environment variables needed:**
```
S3_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_BUCKET_NAME=rentalmgmt-uploads
```

### Pattern 3: Edge Role Authorization (Middleware Upgrade)

**What:** Upgrade middleware.ts to use Node.js runtime and check user role before allowing access to /admin routes.

**Key insight:** Next.js 15.5 (the project's exact version) ships **stable** Node.js runtime support in middleware. This means we can call `auth.api.getSession()` directly, which validates the session against the database and returns the full user object including `role`.

**Two viable approaches:**

**Approach A: Full session validation (Node.js runtime) -- RECOMMENDED**
```typescript
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Admin routes: full session + role check
  if (pathname.startsWith("/admin")) {
    const session = await auth.api.getSession({
      headers: await headers()
    })

    if (!session) {
      return NextResponse.redirect(new URL("/auth/login", request.url))
    }
    if (session.user.role !== "admin") {
      return NextResponse.redirect(new URL("/tenant/dashboard", request.url))
    }
    return NextResponse.next()
  }

  // Other protected routes: cookie existence check (fast)
  if (pathname.startsWith("/tenant")) {
    const sessionCookie = request.cookies.get("better-auth.session_token")
    if (!sessionCookie) {
      return NextResponse.redirect(new URL("/auth/login", request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  runtime: "nodejs",  // Stable in Next.js 15.5
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
}
```

**Approach B: Cookie cache (Edge runtime) -- NOT RECOMMENDED for this project**
Better Auth's `getCookieCache()` has documented Edge compatibility issues (GitHub issue #5120, #5376). The `session_data` cookie DOES include `role`, but the decode function uses Node.js APIs internally. Since Next.js 15.5 supports Node.js middleware, there is no reason to use this approach.

**Why approach A is better:**
- Full database session validation (not just cookie signature check)
- Catches expired/invalidated sessions at the edge
- No dependency on cookie cache configuration
- No risk of stale cached role data
- Works with existing Better Auth config (no `cookieCache` config needed)

**Security note (STATE.md):** "Better Auth cookie JWT payload structure must be verified empirically during Phase 7 edge auth work." With Approach A (Node.js runtime), this is no longer necessary -- we use `auth.api.getSession()` which returns the authoritative session from the database. The admin layout's existing server-component check becomes a defense-in-depth layer, not the primary gate.

### Pattern 4: Cascade Safety (RESTRICT + Soft Delete)

**What:** Change all `ON DELETE CASCADE` foreign keys that reference units or properties to `ON DELETE RESTRICT`, and add `archivedAt` columns for soft-delete.

**Current dangerous cascades in schema:**
```
units.propertyId → properties.id (CASCADE) -- deleting property destroys all units
tenantUnits.unitId → units.id (CASCADE) -- deleting unit destroys tenancy records
payments.unitId → units.id (CASCADE) -- deleting unit destroys payment history!
maintenanceRequests.unitId → units.id (CASCADE) -- deleting unit destroys requests!
autopayEnrollments.unitId → units.id (CASCADE) -- deleting unit destroys autopay!
inviteTokens.unitId → units.id (CASCADE) -- deleting unit destroys invites
```

**Safe cascades to KEEP (parent-child with no financial data):**
```
maintenancePhotos.requestId → maintenanceRequests.id (CASCADE OK)
maintenanceComments.requestId → maintenanceRequests.id (CASCADE OK)
session.userId → user.id (CASCADE OK -- Better Auth managed)
account.userId → user.id (CASCADE OK -- Better Auth managed)
```

**Migration approach:**
```sql
-- Drop and re-create foreign key with RESTRICT
ALTER TABLE units DROP CONSTRAINT units_property_id_properties_id_fk;
ALTER TABLE units ADD CONSTRAINT units_property_id_properties_id_fk
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE RESTRICT;

ALTER TABLE tenant_units DROP CONSTRAINT tenant_units_unit_id_units_id_fk;
ALTER TABLE tenant_units ADD CONSTRAINT tenant_units_unit_id_units_id_fk
  FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE RESTRICT;

-- Repeat for: payments, maintenance_requests, autopay_enrollments, invite_tokens
```

**Drizzle schema change:**
```typescript
// Before:
propertyId: uuid("property_id")
  .references(() => properties.id, { onDelete: "cascade" })
  .notNull(),

// After:
propertyId: uuid("property_id")
  .references(() => properties.id, { onDelete: "restrict" })
  .notNull(),
```

**Soft-delete columns:**
```typescript
// Add to properties and units tables:
archivedAt: timestamp("archived_at"),  // null = active, non-null = archived
```

**Application-level deletion:** Instead of SQL DELETE, the application sets `archivedAt = new Date()`. Queries filter `WHERE archived_at IS NULL` for active records.

### Pattern 5: Admin Sidebar (shadcn/ui)

**What:** Replace the flat horizontal nav in `(admin)/layout.tsx` with a collapsible sidebar using shadcn/ui's sidebar component.

**Installation:**
```bash
npx shadcn@latest add sidebar
```

This generates `src/components/ui/sidebar.tsx` with `SidebarProvider`, `Sidebar`, `SidebarContent`, `SidebarGroup`, `SidebarMenu`, `SidebarMenuItem`, `SidebarTrigger`, and other composable parts.

**Cookie-based persistence (App Router):**
```typescript
// src/app/(admin)/layout.tsx
import { cookies } from "next/headers"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AdminSidebar } from "@/components/admin/AdminSidebar"

export default async function AdminLayout({ children }) {
  const session = await auth.api.getSession({ headers: await headers() })
  // ... auth checks ...

  const cookieStore = await cookies()
  const sidebarOpen = cookieStore.get("sidebar_state")?.value === "true"

  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      <AdminSidebar user={session.user} />
      <main className="flex-1">
        <header className="flex items-center gap-2 border-b px-4 py-2">
          <SidebarTrigger />
          <span>Admin Portal</span>
        </header>
        <div className="container mx-auto px-6 py-8">
          {children}
        </div>
      </main>
    </SidebarProvider>
  )
}
```

**Collapsible modes:**
- `offcanvas` -- slides in from side (best for mobile)
- `icon` -- collapses to icon-only rail (best for desktop)
- `none` -- always visible

Recommendation: Use `icon` mode for desktop, which collapses to a narrow icon rail. The `SidebarProvider` handles responsive behavior automatically.

### Anti-Patterns to Avoid

- **Running both HTTP and WebSocket drivers simultaneously:** After the driver swap, remove ALL imports from `drizzle-orm/neon-http`. The entire application must use one driver.
- **Server-side S3 upload via presigned URL:** For this project (server-side API routes handling file upload), use direct `PutObjectCommand` from the server. Presigned upload URLs are only needed when the browser uploads directly to S3 (which adds complexity). Use presigned URLs only for DOWNLOAD (serving files to browsers).
- **Decoding cookie cache manually:** Do not parse/decode the `session_data` cookie yourself. Use `auth.api.getSession()` in Node.js middleware or `getCookieCache()` (if Edge compatibility is resolved). Manual decode is fragile and breaks on version upgrades.
- **Deleting foreign key constraints without a migration plan:** Always use `drizzle-kit generate` to create migration files, never raw SQL ALTER statements outside the migration system.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Presigned URL signing | Custom HMAC signature code | `@aws-sdk/s3-request-presigner` | AWS Signature v4 is complex, error-prone. The SDK handles it correctly. |
| Collapsible sidebar | Custom sidebar with localStorage | shadcn/ui `sidebar` component | Handles responsive, cookie persistence, accessible keyboard nav, animation. Hundreds of edge cases. |
| Session validation in middleware | Custom JWT decode / cookie parse | `auth.api.getSession()` (Node.js runtime) | Better Auth session validation handles expiry, invalidation, token rotation. Rolling your own misses edge cases. |
| Database transactions | Multiple sequential queries with error checking | `db.transaction(async (tx) => { ... })` | Manual multi-query "transactions" leave inconsistent state on partial failure. The driver handles BEGIN/COMMIT/ROLLBACK. |
| Foreign key constraint migration | Raw SQL scripts | `drizzle-kit generate` + `drizzle-kit migrate` | Drizzle tracks migration state, generates correct ALTER statements, handles rollback metadata. |

**Key insight:** Every item in this phase has a well-supported library solution. The risk is in the integration (swapping the database driver without breaking existing queries), not in novel engineering.

## Common Pitfalls

### Pitfall 1: Pool Connection Leak After Driver Swap
**What goes wrong:** WebSocket `Pool` creates persistent connections. If the pool is never closed or connections are not released, they accumulate and hit Neon's connection limits.
**Why it happens:** The HTTP driver (`neon()`) is stateless -- each call is a fetch. The WebSocket Pool maintains connections.
**How to avoid:** Use connection pooling with Neon's `-pooler` hostname suffix in the DATABASE_URL. This routes through PgBouncer. The `Pool` object should be a module-level singleton (one per Node.js process), not created per-request.
**Warning signs:** "too many connections" errors in logs, increasing connection count in Neon dashboard.

### Pitfall 2: Better Auth Adapter Incompatibility After Driver Swap
**What goes wrong:** Better Auth's `drizzleAdapter` might behave differently with the neon-serverless driver.
**Why it happens:** The HTTP adapter and WebSocket adapter have slightly different type signatures. `NeonHttpDatabase` vs the type from `drizzle-orm/neon-serverless`.
**How to avoid:** Test auth flows (login, session, getSession) immediately after the driver swap. The Drizzle adapter accepts the generic `db` type, so this should work seamlessly, but verify empirically.
**Warning signs:** Auth API routes returning 500 errors after the swap.

### Pitfall 3: S3 CORS Blocking Browser File Display
**What goes wrong:** Presigned download URLs work from server-side but fail when loaded in `<img>` tags or iframe previews.
**Why it happens:** R2/S3 requires CORS configuration to allow cross-origin requests from the app domain.
**How to avoid:** Configure CORS on the R2 bucket to allow GET from the application domain. For presigned URLs, the request comes from the user's browser directly to R2, not through the app server.
**Warning signs:** Network tab shows CORS errors when loading maintenance photos.

### Pitfall 4: Middleware Blocking API Routes
**What goes wrong:** Node.js middleware with `auth.api.getSession()` adds latency to every matched route, including API routes that do their own auth.
**Why it happens:** Middleware runs before route handlers. If the matcher is too broad, every API request pays the session lookup cost twice.
**How to avoid:** Keep the middleware matcher scoped to page routes only. API routes (`/api/*`) should be excluded from middleware and handle their own auth (they already do).
**Warning signs:** Doubled latency on API routes, timeout errors on cold starts.

### Pitfall 5: Migration Breaks Existing Data (CASCADE to RESTRICT)
**What goes wrong:** If any orphaned records exist (e.g., a `payment` referencing a deleted `unit`), the RESTRICT constraint creation fails.
**Why it happens:** PostgreSQL validates existing data when adding a RESTRICT constraint.
**How to avoid:** Before running the migration, check for orphaned records. Clean up any data integrity issues first.
**Warning signs:** Migration fails with "violates foreign key constraint" error.

### Pitfall 6: Dual-Read Missing Files
**What goes wrong:** After deploying S3 uploads, the `storageBackend` column defaults to `"local"` for existing records, but the `uploads/` directory might not exist on a new deployment.
**Why it happens:** Serverless/container deployments don't persist filesystem state between deploys. The local `uploads/` directory from development won't exist in production.
**How to avoid:** Plan for eventually migrating all existing local files to S3 (a background task, not part of this phase). For this phase, document that existing local files continue to work only if the `uploads/` directory exists on the server.
**Warning signs:** 404 errors for maintenance photos uploaded before the S3 migration.

## Code Examples

### Drizzle Transaction with neon-serverless
```typescript
// Source: https://orm.drizzle.team/docs/transactions
import { db } from "@/db"
import { charges, tenantBalances } from "@/db/schema"
import { eq, sql } from "drizzle-orm"

// Atomic: insert charge + update balance
await db.transaction(async (tx) => {
  const [charge] = await tx.insert(charges).values({
    tenantUserId: userId,
    unitId: unitId,
    type: "rent",
    amountCents: 150000,
    description: "March 2026 rent",
  }).returning()

  await tx.update(tenantBalances)
    .set({ balanceCents: sql`${tenantBalances.balanceCents} + ${charge.amountCents}` })
    .where(eq(tenantBalances.tenantUserId, userId))
})
```

### S3 Server-Side Upload (replacing local saveUploadedFile)
```typescript
// Source: https://developers.cloudflare.com/r2/api/s3/presigned-urls/
import { uploadToS3 } from "@/lib/storage"
import crypto from "crypto"
import path from "path"

export async function saveUploadedFileToS3(
  file: File,
  subdirectory: string,
): Promise<{ s3Key: string; fileName: string; fileSize: number; mimeType: string }> {
  // Validate (same as existing saveUploadedFile)
  if (file.size > MAX_FILE_SIZE) throw new Error("File too large")
  if (!ALLOWED_MIME_TYPES.has(file.type)) throw new Error("Unsupported type")

  const ext = path.extname(file.name) || ""
  const key = `${subdirectory}/${crypto.randomUUID()}${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  await uploadToS3(buffer, key, file.type)

  return {
    s3Key: key,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type,
  }
}
```

### Presigned Download URL (serving files)
```typescript
// Source: https://developers.cloudflare.com/r2/api/s3/presigned-urls/
import { getPresignedDownloadUrl } from "@/lib/storage"

// In API route handler:
export async function GET(request: Request, { params }) {
  const photo = await db.query.maintenancePhotos.findFirst({
    where: eq(maintenancePhotos.id, params.id)
  })

  if (photo.storageBackend === "s3") {
    const url = await getPresignedDownloadUrl(photo.s3Key!)
    return NextResponse.redirect(url)
  } else {
    // Existing local file serving logic
    const filePath = path.join(UPLOADS_DIR, photo.filePath)
    const buffer = await fs.readFile(filePath)
    return new Response(buffer, { headers: { "Content-Type": photo.mimeType } })
  }
}
```

### Node.js Middleware with Role Check
```typescript
// Source: https://www.better-auth.com/docs/integrations/next
// Source: https://nextjs.org/blog/next-15-5 (stable nodejs middleware)
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith("/admin")) {
    const session = await auth.api.getSession({
      headers: await headers(),
    })
    if (!session) {
      const url = new URL("/auth/login", request.url)
      url.searchParams.set("callbackUrl", pathname)
      return NextResponse.redirect(url)
    }
    if (session.user.role !== "admin") {
      return NextResponse.redirect(new URL("/tenant/dashboard", request.url))
    }
  }

  if (pathname.startsWith("/tenant")) {
    const sessionCookie = request.cookies.get("better-auth.session_token")
    if (!sessionCookie) {
      const url = new URL("/auth/login", request.url)
      url.searchParams.set("callbackUrl", pathname)
      return NextResponse.redirect(url)
    }
  }

  return NextResponse.next()
}

export const config = {
  runtime: "nodejs",
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Neon HTTP driver only | WebSocket driver for transactions, HTTP for simple queries | @neondatabase/serverless v0.9+ (2024) | `Pool` class enables `db.transaction()` |
| Edge-only middleware | Node.js runtime in middleware | Next.js 15.2 experimental, 15.5 stable (2025) | Full session validation at edge, not just cookie check |
| Local file storage | S3/R2 with presigned URLs | Industry standard for years | Scales beyond single server, survives redeployments |
| ON DELETE CASCADE everywhere | RESTRICT for financial data, soft-delete for archiving | Best practice for any system with financial records | Prevents accidental data destruction |
| Custom sidebar implementations | shadcn/ui `sidebar` component | shadcn/ui v3 (2024) | Built-in mobile responsive, cookie persistence, accessible |

**Deprecated/outdated:**
- `neonConfig.webSocketConstructor = ws` will not be needed once project upgrades to Node.js v22+ (native WebSocket)
- Better Auth's `getCookieCache()` in Edge Runtime has documented compatibility issues (GitHub #5120, #5376). Avoid for now; use Node.js middleware instead.

## Open Questions

1. **R2 bucket configuration for this project**
   - What we know: R2 works identically to S3 from the SDK perspective. Presigned URLs require CORS configuration.
   - What's unclear: Whether the user already has a Cloudflare account / R2 bucket set up, or needs to create one. Also whether they prefer R2 vs AWS S3.
   - Recommendation: Default to R2 in the plan (zero egress, simpler pricing), but make the `S3Client` configuration generic so either works. The only difference is the `endpoint` and `region` values.

2. **Existing local files migration strategy**
   - What we know: The dual-read pattern handles new uploads seamlessly. Existing files in `uploads/` remain accessible if the directory exists.
   - What's unclear: Whether any maintenance photos or documents already exist in production that would need bulk migration to S3.
   - Recommendation: Phase 7 should NOT include bulk file migration. Add a `storageBackend` column defaulting to `"local"`. A future task can bulk-migrate existing files if needed.

3. **Pool connection limits with Neon free tier**
   - What we know: Neon free tier has connection limits. The `Pool` object should use the `-pooler` hostname for PgBouncer.
   - What's unclear: Exact connection limit for the project's Neon plan.
   - Recommendation: Use the pooled connection string (hostname ending in `-pooler.us-east-2.aws.neon.tech` or similar). Verify in Neon dashboard.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright 1.58.2 |
| Config file | `playwright.config.ts` |
| Quick run command | `npx playwright test --grep "test-name" --headed=false` |
| Full suite command | `npx playwright test` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFRA-04 | Database transactions work (insert + update atomically) | integration | `npx playwright test e2e/infra-transactions.spec.ts` | Wave 0 |
| INFRA-01 | File upload stores in S3, file download returns presigned URL | integration/e2e | `npx playwright test e2e/infra-storage.spec.ts` | Wave 0 |
| INFRA-02 | Non-admin accessing /admin gets redirected (middleware) | e2e | `npx playwright test e2e/infra-edge-auth.spec.ts` | Wave 0 |
| INFRA-05 | Deleting property/unit with payments fails (RESTRICT) | integration | `npx playwright test e2e/infra-cascade.spec.ts` | Wave 0 |
| AUX-01 | Admin sidebar visible, collapsible, persists state | e2e | `npx playwright test e2e/admin-sidebar.spec.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx playwright test e2e/<relevant-spec>.spec.ts`
- **Per wave merge:** `npx playwright test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `e2e/infra-transactions.spec.ts` -- covers INFRA-04 (verify atomic operations via API route that uses transaction)
- [ ] `e2e/infra-storage.spec.ts` -- covers INFRA-01 (upload a file, verify it can be downloaded)
- [ ] `e2e/infra-edge-auth.spec.ts` -- covers INFRA-02 (login as tenant, attempt /admin, verify redirect)
- [ ] `e2e/infra-cascade.spec.ts` -- covers INFRA-05 (attempt to delete unit with payments, verify rejection)
- [ ] `e2e/admin-sidebar.spec.ts` -- covers AUX-01 (verify sidebar renders, collapses, persists)

Note: INFRA-04 and INFRA-05 are database-level behaviors. E2E tests would exercise them through API routes that trigger multi-table operations or deletion attempts. The INFRA-02 test is a natural Playwright test (navigate to /admin as tenant, assert redirect). AUX-01 is a pure UI test.

## Sources

### Primary (HIGH confidence)
- [Drizzle ORM - Neon connection](https://orm.drizzle.team/docs/connect-neon) - WebSocket adapter setup, Pool configuration, transaction support
- [Drizzle ORM - Transactions](https://orm.drizzle.team/docs/transactions) - `db.transaction()` API, isolation levels, rollback patterns
- [Cloudflare R2 Presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/) - S3-compatible presigned URL generation, S3Client config for R2
- [Better Auth Next.js Integration](https://www.better-auth.com/docs/integrations/next) - Middleware patterns, `getSessionCookie()`, `getCookieCache()`, Node.js runtime support
- [Better Auth Session Management](https://www.better-auth.com/docs/concepts/session-management) - Cookie cache strategies, session_data cookie contents
- [Next.js 15.5 Release](https://nextjs.org/blog/next-15-5) - Stable Node.js runtime in middleware
- [shadcn/ui Sidebar](https://v3.shadcn.com/docs/components/sidebar) - Installation, SidebarProvider, cookie persistence, collapsible modes
- [Neon Serverless Driver](https://neon.com/docs/ai/skills/neon-postgres/references/neon-serverless.md) - Pool/Client WebSocket setup, neonConfig

### Secondary (MEDIUM confidence)
- [Neon + Next.js S3 Upload Guide](https://neon.com/guides/next-upload-aws-s3) - Complete upload flow architecture with presigned URLs and Neon
- [AWS S3 Presigned URLs docs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html) - Official AWS presigned URL documentation
- [Better Auth getCookieCache Edge issue #5120](https://github.com/better-auth/better-auth/issues/5120) - Edge Runtime incompatibility confirmed and closed
- [Better Auth session_data fields discussion #5066](https://github.com/better-auth/better-auth/discussions/5066) - Cookie cache field inclusion details
- [Vercel: Middleware Node.js support](https://vercel.com/changelog/middleware-now-supports-node-js) - Node.js middleware runtime announcement

### Tertiary (LOW confidence)
- [Cloudflare R2 vs AWS S3 cost comparison](https://www.digitalapplied.com/blog/cloudflare-r2-vs-aws-s3-comparison) - Third-party cost analysis (R2 zero egress advantage)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries are already installed or are standard ecosystem packages. Versions verified from `package.json` and `node_modules`.
- Architecture: HIGH - Each pattern is verified from official docs. The driver swap is the most impactful change but follows documented patterns exactly. Next.js 15.5 Node.js middleware is explicitly stable (not experimental).
- Pitfalls: HIGH - Connection pooling, CORS, and migration data integrity are well-documented concerns. The Better Auth Edge compatibility issue is confirmed via GitHub issues.

**Research date:** 2026-02-26
**Valid until:** 2026-03-26 (stable ecosystem, no fast-moving dependencies)
