# Phase 2: Tenant Onboarding - Research

**Researched:** 2026-02-25
**Domain:** QR-code invite tokens, single-use links, user-unit linking, admin token management
**Confidence:** HIGH

## Summary

Phase 2 implements a QR-code-based tenant onboarding flow where an admin generates a per-unit invite token, the token encodes into a QR code that can be printed on a physical letter, and when a tenant scans it they are taken to a registration page that automatically links their new account to the correct unit. Tokens must be single-use and expire after 30 days.

The approach is to build a custom `invite_tokens` table in the existing Drizzle schema (not use a third-party Better Auth plugin) because the core requirement is linking an invite to a specific `unit_id` -- metadata that no existing Better Auth invite plugin supports. The token is generated server-side with `crypto.randomBytes`, stored hashed in the database, and consumed atomically during registration via a Better Auth `after` hook on the `/sign-up/email` path. The admin UI is a server-rendered page listing units with "Generate Invite" actions, producing a downloadable QR code image via the `qrcode` npm package.

**Primary recommendation:** Build a custom invite_tokens table with unit_id foreign key, use `crypto.randomBytes(32)` for URL-safe tokens, consume tokens in a Better Auth after-signup hook, and generate QR codes server-side with the `qrcode` npm package.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTH-04 | Tenant can onboard by scanning QR code from physical letter, creating account, and being linked to their unit | Custom invite_tokens schema with unit_id FK, QR generation via `qrcode` package, token validation on invite page, consumption via Better Auth after-signup hook, automatic tenantUnits row creation |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `qrcode` | ^1.5.x | Server-side QR code generation (toDataURL, toBuffer) | 2.5M+ weekly npm downloads, full TypeScript types, supports PNG data URLs and SVG output, works server-side in Node.js without canvas dependencies |
| `crypto` (Node.js built-in) | Node 20+ | Secure token generation with `randomBytes` | Built-in, CSPRNG, zero dependencies, industry standard for security tokens |
| `drizzle-orm` | ^0.45.1 | Schema definition and queries for invite_tokens table | Already in project, consistent with existing domain schema pattern |
| `better-auth` | ^1.4.19 | After-signup hook for consuming token and linking user to unit | Already in project, hooks API documented and stable |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` | ^4.3.6 | Validate invite token format in API routes and server actions | Already in project, use for all input validation |
| `shadcn/ui` | existing | Table, Dialog, and Button components for admin invite management UI | Already partially installed, add Table component for invite list |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom invite_tokens table | `better-auth-invite` plugin | Plugin is alpha, does NOT support metadata (unit_id) on invites, would require external mapping table anyway -- adds complexity without benefit |
| Custom invite_tokens table | Better Auth `oneTimeToken` plugin | Designed for cross-domain session transfer, not invite flows -- requires existing session to generate, tokens are session-bound not unit-bound |
| `qrcode` npm package | `react-qr-code` | React component only, no server-side buffer/file generation for downloadable images |
| `qrcode` npm package | `next-qrcode` | Thin wrapper around `qrcode`, adds unnecessary abstraction |
| Server-side QR generation | Client-side QR generation | Admin needs downloadable/printable QR images -- server-side generation as data URL or PNG buffer is more reliable for download/print use case |

**Installation:**
```bash
npm install qrcode
npm install -D @types/qrcode
```

No other new dependencies needed -- `crypto` is built-in, all other packages already in `package.json`.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── db/schema/
│   ├── domain.ts              # ADD: inviteTokens table definition
│   └── index.ts               # Already re-exports domain.ts
├── lib/
│   ├── auth.ts                # MODIFY: add after-signup hook
│   ├── tokens.ts              # NEW: token generation + hashing utilities
│   └── qr.ts                  # NEW: QR code generation utility
├── app/
│   ├── invite/[token]/
│   │   └── page.tsx           # NEW: public invite landing page (validates token, shows register form or error)
│   ├── (admin)/admin/invites/
│   │   └── page.tsx           # NEW: admin invite management page
│   └── api/invites/
│       ├── generate/route.ts  # NEW: POST - generate invite token for a unit
│       └── qr/[token]/route.ts # NEW: GET - return QR code PNG image
├── components/
│   └── admin/
│       └── InviteManager.tsx  # NEW: client component for invite generation UI
└── middleware.ts              # MODIFY: allow /invite/* path without auth
```

### Pattern 1: Custom Invite Token Schema
**What:** A Drizzle table that stores invite tokens linked to units with single-use and expiration semantics.
**When to use:** When tokens need to carry domain-specific metadata (unit_id) that generic auth plugins don't support.
**Example:**
```typescript
// src/db/schema/domain.ts -- add to existing file
export const inviteTokens = pgTable("invite_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  unitId: uuid("unit_id")
    .references(() => units.id, { onDelete: "cascade" })
    .notNull(),
  tokenHash: text("token_hash").notNull().unique(),  // SHA-256 hash of the raw token
  status: text("status", { enum: ["pending", "used", "expired"] })
    .default("pending")
    .notNull(),
  usedByUserId: text("used_by_user_id"),  // populated when consumed
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  usedAt: timestamp("used_at"),
})
```

### Pattern 2: Token Generation with Hash-Before-Store
**What:** Generate a cryptographically secure token, return the raw value to the admin, but store only the SHA-256 hash in the database. This prevents token theft via database compromise.
**When to use:** Always -- for any single-use secret token stored in a database.
**Example:**
```typescript
// src/lib/tokens.ts
import { randomBytes, createHash } from "crypto"

export function generateInviteToken(): string {
  // 32 bytes = 256 bits of entropy, URL-safe base64 encoded
  return randomBytes(32)
    .toString("base64url")  // Node 16+ built-in URL-safe base64
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}
```

### Pattern 3: Better Auth After-Signup Hook for Token Consumption
**What:** Use Better Auth's `hooks.after` middleware to detect signups coming from the invite flow, consume the token, and create the tenantUnits record.
**When to use:** To atomically link the new user to their unit during registration without modifying the registration form submission logic.
**Example:**
```typescript
// In src/lib/auth.ts -- add hooks config
import { createAuthMiddleware } from "better-auth/api"

export const auth = betterAuth({
  // ... existing config ...
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path.startsWith("/sign-up")) {
        const newSession = ctx.context.newSession
        if (newSession) {
          // Check if invite token was passed via request body or cookie
          // Consume the token and create tenantUnits row
          // This runs AFTER successful user creation
        }
      }
    }),
  },
})
```

### Pattern 4: Invite Landing Page with Server-Side Validation
**What:** A public page at `/invite/[token]` that validates the token server-side before rendering a registration form, or shows an appropriate error.
**When to use:** The entry point for the QR code scan flow.
**Example:**
```typescript
// src/app/invite/[token]/page.tsx
// Server Component -- validates token before rendering
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const tokenHash = hashToken(token)

  // Query invite_tokens by tokenHash
  // If not found: show "Invalid invite link" error
  // If status === "used": show "This invite has already been used" error
  // If expiresAt < now: show "This invite has expired" error
  // If valid: render registration form with unit context
}
```

### Pattern 5: QR Code Generation as API Route
**What:** A Next.js API route that generates a QR code PNG for a given invite URL, allowing the admin to download or embed the image.
**When to use:** When the admin needs a downloadable/printable QR code image.
**Example:**
```typescript
// src/app/api/invites/qr/[token]/route.ts
import QRCode from "qrcode"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${token}`
  const buffer = await QRCode.toBuffer(inviteUrl, {
    errorCorrectionLevel: "H",  // High -- withstands print damage
    width: 400,
    margin: 2,
  })
  return new Response(buffer, {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="invite-${token.slice(0, 8)}.png"`,
    },
  })
}
```

### Anti-Patterns to Avoid
- **Storing raw tokens in the database:** Always hash. If the database is compromised, raw tokens allow account takeover. Hash with SHA-256 before storing.
- **Using sequential/guessable IDs as tokens:** UUIDs have only 122 bits of entropy and a predictable format. Use `crypto.randomBytes(32)` for 256 bits.
- **Validating tokens client-side only:** Token validation MUST happen server-side. The `/invite/[token]` page should be a Server Component that queries the database.
- **Race condition on token consumption:** Two simultaneous registrations with the same token could both succeed. Use a database UPDATE with WHERE status = 'pending' and check affected row count to ensure exactly-once consumption.
- **Skipping expiration check at consumption time:** The landing page checks expiration, but the after-signup hook MUST also re-validate -- the user could have opened the form before expiration and submitted after.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| QR code image generation | Canvas-based QR renderer | `qrcode` npm package (`toBuffer`, `toDataURL`) | QR encoding has error correction levels, masking patterns, and mode optimization -- well-solved problem |
| Cryptographic token generation | Math.random or UUID-based tokens | `crypto.randomBytes(32).toString('base64url')` | CSPRNG required for security tokens, base64url encoding is URL-safe without character replacement |
| Token hashing | Custom hashing or bcrypt | `crypto.createHash('sha256')` | SHA-256 is the standard for token hashing (not passwords). Tokens already have high entropy, so salting/stretching is unnecessary |
| User creation during invite flow | Custom user insert + session creation | Better Auth `signUp.email` + after hook | Better Auth handles password hashing, session creation, cookie setting -- reimplementing risks security bugs |

**Key insight:** The invite token system is a thin domain layer (one table, two utilities) on top of existing infrastructure. The actual auth flow (registration, session, cookies) stays entirely within Better Auth -- we only add the invite-to-unit linkage.

## Common Pitfalls

### Pitfall 1: Race Condition on Token Consumption
**What goes wrong:** Two browser tabs with the same invite link both submit registration simultaneously. Both pass validation, both create users, both try to consume the token. One user gets linked, the other doesn't -- or worse, two users link to the same unit.
**Why it happens:** Check-then-act without atomicity.
**How to avoid:** Use a single UPDATE query with `WHERE status = 'pending'` and check the returned row count. If 0 rows updated, the token was already consumed.
**Warning signs:** Duplicate tenantUnits rows for the same unit with different users.

### Pitfall 2: Token Stored But Link URL Lost
**What goes wrong:** Admin generates a token, the QR code renders on screen, but the admin closes the page before downloading. The raw token is not stored (only the hash) so there's no way to recover it.
**Why it happens:** Design choice to hash-before-store is correct for security, but requires clear UX.
**How to avoid:** Show the QR code prominently with an explicit "Download QR Code" button. Consider also showing a "copy link" button. The admin can always regenerate a new token for the same unit if needed (old one remains valid until expiry or manual revocation).
**Warning signs:** Admin complains they "lost" an invite link.

### Pitfall 3: Middleware Blocking the Invite Page
**What goes wrong:** The `/invite/[token]` page requires no authentication (it's the entry point for NEW users), but the middleware currently redirects all non-`/auth/*` routes to login if no session cookie exists.
**Why it happens:** Current middleware only allows `/auth/*` and `/api/auth/*` without a session.
**How to avoid:** Update the middleware matcher or the redirect logic to also allow `/invite/*` paths without authentication.
**Warning signs:** Scanning the QR code redirects to the login page instead of the invite page.

### Pitfall 4: Forgetting to Pass Token Through Registration
**What goes wrong:** The invite page validates the token and renders a registration form, but the token is not passed through to the signup request. The after-signup hook has no way to know which token to consume.
**Why it happens:** The registration form and the invite context are separate concerns that need explicit bridging.
**How to avoid:** Pass the token as a hidden field or store it in a short-lived cookie/query param that the after-signup hook can read. The cleanest approach: include the token in the signup request body as an extra field, or store in a cookie set by the invite page.
**Warning signs:** Users register successfully but aren't linked to any unit.

### Pitfall 5: Expired Token Not Checked at Consumption Time
**What goes wrong:** A tenant opens the invite page (token valid, form renders), waits several days, then submits the form. The token has since expired, but the after-signup hook doesn't re-check expiration.
**Why it happens:** Only the landing page check is implemented, not the consumption-time check.
**How to avoid:** The after-signup hook must re-validate token status AND expiration before consuming. If the token expired between page load and form submission, the user account is still created (can't undo that in an after hook) but the unit linking should fail gracefully, and the user should be informed.
**Warning signs:** User creates account but gets "invite expired" message on dashboard.

### Pitfall 6: Next.js 15 Async Params
**What goes wrong:** Runtime error accessing `params.token` synchronously in page components.
**Why it happens:** Next.js 15 changed `params` to be a Promise that must be awaited.
**How to avoid:** Always `const { token } = await params` in page components and API route handlers.
**Warning signs:** "params is not iterable" or undefined token errors.

## Code Examples

Verified patterns from official sources and existing codebase:

### Token Generation and Hashing
```typescript
// src/lib/tokens.ts
import { randomBytes, createHash } from "crypto"

/** Generate a 256-bit cryptographically secure URL-safe token */
export function generateInviteToken(): string {
  return randomBytes(32).toString("base64url")
}

/** Hash a token with SHA-256 for database storage */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}
```
Source: Node.js crypto documentation (https://nodejs.org/api/crypto.html)

### QR Code Generation (Server-Side)
```typescript
// src/lib/qr.ts
import QRCode from "qrcode"

/** Generate a QR code PNG buffer for an invite URL */
export async function generateQRCodeBuffer(url: string): Promise<Buffer> {
  return QRCode.toBuffer(url, {
    errorCorrectionLevel: "H",
    width: 400,
    margin: 2,
    color: { dark: "#000000", light: "#FFFFFF" },
  })
}

/** Generate a QR code as a data URL (for inline display) */
export async function generateQRCodeDataURL(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    errorCorrectionLevel: "H",
    width: 400,
    margin: 2,
  })
}
```
Source: node-qrcode GitHub (https://github.com/soldair/node-qrcode)

### Atomic Token Consumption (Drizzle)
```typescript
// Consume token atomically -- returns the token row if successful, null if already consumed
import { eq, and } from "drizzle-orm"

async function consumeInviteToken(tokenHash: string, userId: string) {
  const now = new Date()
  const [consumed] = await db
    .update(inviteTokens)
    .set({
      status: "used",
      usedByUserId: userId,
      usedAt: now,
    })
    .where(
      and(
        eq(inviteTokens.tokenHash, tokenHash),
        eq(inviteTokens.status, "pending"),
        // Also check expiration at consumption time
      )
    )
    .returning()

  return consumed ?? null  // null means token was already consumed or invalid
}
```
Source: Drizzle ORM docs, existing project pattern in seed-property.ts

### Better Auth After-Signup Hook
```typescript
// In auth.ts hooks config
import { createAuthMiddleware } from "better-auth/api"

hooks: {
  after: createAuthMiddleware(async (ctx) => {
    if (ctx.path.startsWith("/sign-up")) {
      const newSession = ctx.context.newSession
      if (newSession) {
        // Read invite token from request body or cookie
        // The invite registration form passes the token
        const inviteToken = ctx.body?.inviteToken
        if (inviteToken) {
          const tokenHash = hashToken(inviteToken)
          const consumed = await consumeInviteToken(tokenHash, newSession.user.id)
          if (consumed) {
            // Create tenantUnits row linking user to unit
            await db.insert(tenantUnits).values({
              userId: newSession.user.id,
              unitId: consumed.unitId,
              startDate: new Date(),
              isActive: true,
            })
          }
        }
      }
    }
  }),
}
```
Source: Better Auth hooks docs (https://www.better-auth.com/docs/concepts/hooks)

### Middleware Update for Invite Path
```typescript
// middleware.ts -- add /invite to allowed unauthenticated paths
if (!sessionCookie) {
  const isProtectedRoute =
    pathname.startsWith("/tenant") ||
    pathname.startsWith("/admin")

  // /invite/* is public -- tenants scanning QR codes don't have accounts yet
  // /auth/* is already excluded by the matcher or handled below
  if (isProtectedRoute) {
    const loginUrl = new URL("/auth/login", request.url)
    loginUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(loginUrl)
  }
}
```
Source: Existing middleware.ts in project -- `/invite/*` is NOT under `/tenant` or `/admin` so it naturally passes through without changes. This is already correct.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Email-based invitations (send link to known email) | Shareable token links (no email required, distribute via QR/print) | 2024+ | Critical for this project -- tenants are unreachable by email, physical letters are the delivery mechanism |
| Store raw tokens in DB | Hash tokens before storage (SHA-256) | Always best practice | Prevents token theft on DB compromise |
| `toString('base64')` with manual char replacement | `toString('base64url')` (Node 16+) | Node 16 (2021) | Built-in URL-safe base64 encoding, no manual `+/-` and `/` replacement needed |
| `better-auth-invite` plugin (alpha) | Custom invite_tokens table | Current | Plugin lacks metadata support (unit_id), is alpha-quality, and adds unnecessary dependency for a simple domain table |

**Deprecated/outdated:**
- `better-auth-invite` plugin: Alpha quality, no metadata support. Not suitable for unit-linked invites.
- `oneTimeToken` Better Auth plugin: Designed for cross-domain session transfer, not invite flows. Requires an existing session to generate tokens.

## Open Questions

1. **Token passthrough mechanism during registration**
   - What we know: The invite page validates the token and renders a registration form. The after-signup hook needs access to the token to consume it.
   - What's unclear: Whether to pass the token as a hidden form field in the request body, store it in a cookie, or use a different mechanism.
   - Recommendation: Use a cookie set by the invite page server component. This is cleanest because: (a) it doesn't require modifying the Better Auth signup schema, (b) the after-hook can read cookies from the request, (c) it's automatically scoped to the browser session. Alternative: pass as extra field in signUp.email body -- Better Auth may accept additional fields or they can be passed via a custom header.

2. **Admin UX for multiple invites per unit**
   - What we know: Tokens are single-use. If a tenant loses their letter, admin needs to generate a new one.
   - What's unclear: Should old pending tokens for the same unit be automatically revoked when a new one is generated?
   - Recommendation: Keep old tokens valid (they'll expire naturally). Show all pending tokens for a unit in the admin UI with a "Revoke" action. This avoids accidentally invalidating a token that's in transit.

3. **What happens if a user registers via invite but the token consumption fails**
   - What we know: The after-signup hook runs after user creation succeeds. If token consumption fails (race condition, expired), the user exists but isn't linked to a unit.
   - What's unclear: How to handle this edge case in UX.
   - Recommendation: The user account is created but unlinked. Show a message on the tenant dashboard like "Your account is not linked to a unit. Contact your property manager." Admin can manually link via the admin portal (future enhancement or manual DB operation).

## Sources

### Primary (HIGH confidence)
- Node.js crypto documentation (https://nodejs.org/api/crypto.html) - randomBytes, createHash, base64url encoding
- Better Auth hooks documentation (https://www.better-auth.com/docs/concepts/hooks) - after-signup hook pattern, createAuthMiddleware
- Better Auth admin plugin documentation (https://www.better-auth.com/docs/plugins/admin) - server-side user management APIs
- node-qrcode GitHub (https://github.com/soldair/node-qrcode) - API reference: toBuffer, toDataURL, options
- Existing project codebase - schema patterns, auth config, middleware, seed scripts

### Secondary (MEDIUM confidence)
- better-auth-invite GitHub (https://github.com/bard/better-auth-invite) - evaluated and rejected: alpha status, no metadata support
- Better Auth one-time-token plugin docs (https://www.better-auth.com/docs/plugins/one-time-token) - evaluated and rejected: session-bound, not invite-bound

### Tertiary (LOW confidence)
- None -- all findings verified against primary or secondary sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - `qrcode` is the dominant Node.js QR library (2.5M+ weekly downloads), `crypto` is built-in, Drizzle/Better Auth already in project
- Architecture: HIGH - Patterns derive directly from existing codebase conventions (schema in domain.ts, hooks in auth.ts, API routes pattern) and verified Better Auth docs
- Pitfalls: HIGH - Race conditions, middleware blocking, and token passthrough are well-understood patterns; verified against existing middleware code

**Research date:** 2026-02-25
**Valid until:** 2026-03-25 (stable domain, no fast-moving dependencies)
