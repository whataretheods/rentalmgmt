---
phase: 02-tenant-onboarding
verified: 2026-02-25T00:00:00Z
status: passed
score: 17/17 must-haves verified
re_verification: false
---

# Phase 2: Tenant Onboarding Verification Report

**Phase Goal:** QR-code-based invite system for linking tenants to units
**Verified:** 2026-02-25
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

All must-haves aggregated across plans 01, 02, 03, and 04.

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | inviteTokens table exists in the database with all required columns | VERIFIED | `src/db/schema/domain.ts` lines 44-57; migration `drizzle/0001_wet_marvex.sql` |
| 2  | `generateInviteToken()` returns a 256-bit URL-safe base64 string | VERIFIED | `src/lib/tokens.ts` line 4-6: `randomBytes(32).toString("base64url")` |
| 3  | `hashToken(token)` returns a SHA-256 hex digest | VERIFIED | `src/lib/tokens.ts` line 9-11: `createHash("sha256").update(token).digest("hex")` |
| 4  | `generateQRCodeBuffer(url)` returns a PNG buffer | VERIFIED | `src/lib/qr.ts` line 4-11: `QRCode.toBuffer(...)` |
| 5  | `generateQRCodeDataURL(url)` returns a data URL string | VERIFIED | `src/lib/qr.ts` line 14-20: `QRCode.toDataURL(...)` |
| 6  | After-signup hook consumes token and creates tenantUnits row | VERIFIED | `src/lib/auth.ts` lines 55-115: full atomic UPDATE + INSERT |
| 7  | Admin can see a list of all units with invite status | VERIFIED | `src/app/(admin)/admin/invites/page.tsx`: db.select from units joined with properties, pending invite lookup |
| 8  | Admin can generate a new invite token for any unit | VERIFIED | `src/components/admin/InviteManager.tsx` handleGenerate: POST to /api/invites/generate, sets invite state |
| 9  | After generating, admin sees a QR code image and copy-able invite link | VERIFIED | `InviteManager.tsx` lines 141-187: conditional `{invite && ...}` block with img src={invite.qrDataUrl} and input value={invite.inviteUrl} |
| 10 | Admin can download the QR code as PNG | VERIFIED | `InviteManager.tsx` handleDownloadQR: anchors to `/api/invites/qr/${invite.token}` |
| 11 | The API stores only the hashed token, returning raw token only once | VERIFIED | `src/app/api/invites/generate/route.ts` lines 42-50: stores tokenHash, returns rawToken in response |
| 12 | Scanning a valid QR code opens /invite/[token] with registration form pre-associated with unit | VERIFIED | `src/app/invite/[token]/page.tsx`: valid token path renders InviteRegisterForm with inviteToken prop |
| 13 | Invite page displays unit number so tenant knows which unit they are registering for | VERIFIED | `/invite/[token]/page.tsx` lines 124-125: "You are registering for Unit {unit?.unitNumber}" |
| 14 | After submitting registration, tenant is linked to correct unit and redirected to /tenant/dashboard | VERIFIED | `InviteRegisterForm.tsx` line 64: `router.push("/tenant/dashboard")`; hook inserts tenantUnits row |
| 15 | An already-used invite token shows "This invite has already been used" error | VERIFIED | `/invite/[token]/page.tsx` lines 61-83: status === "used" → "Invite already used" CardTitle |
| 16 | An expired invite token shows "This invite has expired" error | VERIFIED | `/invite/[token]/page.tsx` lines 86-108: expiresAt < now → "Invite expired" CardTitle |
| 17 | An invalid/unknown token shows "Invalid invite link" error | VERIFIED | `/invite/[token]/page.tsx` lines 35-57: !invite → "Invalid invite link" CardTitle |

**Score:** 17/17 truths verified

---

## Required Artifacts

| Artifact | Status | Level 1: Exists | Level 2: Substantive | Level 3: Wired |
|----------|--------|-----------------|----------------------|----------------|
| `src/db/schema/domain.ts` | VERIFIED | Yes | inviteTokens table with all 8 columns including status enum, tokenHash unique, FK to units | Imported by auth.ts, generate route, invite page, admin page |
| `src/lib/tokens.ts` | VERIFIED | Yes | 3 real exports: generateInviteToken (32 random bytes), hashToken (SHA-256 hex), getInviteExpiry (30-day Date) | Imported and called in generate route, auth hook, invite page |
| `src/lib/qr.ts` | VERIFIED | Yes | 2 real exports: generateQRCodeBuffer (QRCode.toBuffer), generateQRCodeDataURL (QRCode.toDataURL) | Used in generate route and qr/[token] route |
| `src/lib/auth.ts` | VERIFIED | Yes | hooks.after with createAuthMiddleware: reads inviteToken from body, atomically updates inviteTokens, inserts tenantUnits | Wired as betterAuth config hooks property |
| `src/app/api/invites/generate/route.ts` | VERIFIED | Yes | POST handler: admin session check, unitId validation, DB unit lookup, token generation, hash storage, QR data URL, full JSON response | Called via fetch from InviteManager.tsx |
| `src/app/api/invites/qr/[token]/route.ts` | VERIFIED | Yes | GET handler: awaits params (Next.js 15 pattern), generates PNG buffer, returns Response with Content-Disposition attachment header | Called via download anchor in InviteManager.tsx |
| `src/app/(admin)/admin/invites/page.tsx` | VERIFIED | Yes | Server component: db.select units+properties join, db.select pendingInvites, map to unitsWithStatus, renders InviteManager | InviteManager wired via import and JSX |
| `src/components/admin/InviteManager.tsx` | VERIFIED | Yes | "use client", useState for generating/invite, handleGenerate (fetch POST), handleCopyLink (clipboard), handleDownloadQR (anchor), full table + invite display render | Imported and rendered in admin/invites/page.tsx |
| `src/app/invite/[token]/page.tsx` | VERIFIED | Yes | Server component: awaits params, hashToken lookup, 4 render states (invalid/used/expired/valid), fetches unit for valid state, passes token to InviteRegisterForm | InviteRegisterForm imported and rendered with inviteToken prop |
| `src/components/auth/InviteRegisterForm.tsx` | VERIFIED | Yes | "use client", react-hook-form + zodResolver, authClient.signUp.email with inviteToken extra field, error toast, redirect to /tenant/dashboard on success | Imported and rendered in invite/[token]/page.tsx |
| `drizzle/0001_wet_marvex.sql` | VERIFIED | Yes | CREATE TABLE invite_tokens with all columns, UNIQUE constraint on token_hash, FK to units | Applied to database (confirmed by plan 01 execution) |

---

## Key Link Verification

### Plan 01 Key Links

| From | To | Via | Status | Evidence |
|------|----|-----|--------|----------|
| `src/lib/auth.ts` | `src/db/schema/domain.ts` | imports inviteTokens, tenantUnits | WIRED | Line 9: `import { inviteTokens, tenantUnits } from "@/db/schema"` — both used in UPDATE and INSERT |
| `src/lib/auth.ts` | `src/lib/tokens.ts` | imports hashToken | WIRED | Line 11: `import { hashToken } from "@/lib/tokens"` — called at line 75 |

### Plan 02 Key Links

| From | To | Via | Status | Evidence |
|------|----|-----|--------|----------|
| `src/app/api/invites/generate/route.ts` | `src/lib/tokens.ts` | generateInviteToken, hashToken, getInviteExpiry | WIRED | Lines 6, 42-44: all three imported and called |
| `src/app/api/invites/generate/route.ts` | `src/lib/qr.ts` | generateQRCodeDataURL | WIRED | Line 7, 55: imported and called |
| `src/app/api/invites/qr/[token]/route.ts` | `src/lib/qr.ts` | generateQRCodeBuffer | WIRED | Lines 2, 12: imported and called |
| `src/components/admin/InviteManager.tsx` | `src/app/api/invites/generate/route.ts` | fetch POST to /api/invites/generate | WIRED | Line 30: `fetch("/api/invites/generate", { method: "POST", ... })` — response assigned to data and setInvite called |
| `src/app/(admin)/admin/invites/page.tsx` | `src/db` | db.select from units + inviteTokens | WIRED | Lines 8-29: two db.select calls — units+properties join and pendingInvites query |

### Plan 03 Key Links

| From | To | Via | Status | Evidence |
|------|----|-----|--------|----------|
| `src/app/invite/[token]/page.tsx` | `src/lib/tokens.ts` | hashToken(token) for DB lookup | WIRED | Lines 3, 21: imported and called on the URL token param |
| `src/app/invite/[token]/page.tsx` | `src/db` | db.select from inviteTokens + units | WIRED | Lines 24-33, 112-116: two db.select calls |
| `src/components/auth/InviteRegisterForm.tsx` | `src/lib/auth-client.ts` | authClient.signUp.email with inviteToken | WIRED | Lines 9, 47-55: imported authClient, signUp.email called with inviteToken field |
| `src/components/auth/InviteRegisterForm.tsx` | `src/lib/auth.ts` (hook) | inviteToken in signup body read by after-hook | WIRED | Line 54: `inviteToken: inviteToken` in signUp.email body; auth.ts hook reads `ctx.body.inviteToken` |

---

## Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| AUTH-04 | 02-01, 02-02, 02-03, 02-04 | Tenant can onboard by scanning QR code from physical letter, creating account, and being linked to their unit | SATISFIED | Full invite flow implemented and E2E verified: admin generates per-unit QR invite via /admin/invites, tenant scans → /invite/[token] → InviteRegisterForm → after-hook creates tenantUnits row. Used/expired/invalid tokens all show distinct error states. |

No orphaned requirements — AUTH-04 is the only requirement mapped to Phase 2 in REQUIREMENTS.md, and all 4 plans claim it.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/lib/auth.ts` | 111 | `console.log("Tenant linked to unit:", {...})` | Info | Debug log for successful tenant linking — intentional operational visibility, not a stub |
| `src/lib/auth.ts` | 99 | `console.warn("Invite token consumption failed...")` | Info | Warning log for failed token consumption — intentional for diagnosing linkage failures |

The `placeholder="..."` matches in InviteRegisterForm are HTML input placeholder attributes (form hints), not code stubs.

No blockers. The two console.log/warn calls are deliberate operational logs in the auth hook and do not affect correctness.

---

## Human Verification Required

None — E2E Playwright tests in plan 04 covered all five observable behaviors:

1. Admin generates invite with QR code and link at /admin/invites
2. Tenant registers via invite link and lands on /tenant/dashboard
3. Used invite shows "already used" error
4. Invalid token shows "invalid link" error
5. Database confirms tenant_units row linking userId to unitId with isActive=true

The Playwright test script (`e2e/invite-flow-test.mjs`) and DB verification script (`e2e/check-db.ts`) exist as regression test artifacts.

---

## Gaps Summary

No gaps. All 17 observable truths verified. All artifacts exist, are substantive, and are properly wired. All key links confirmed present and used. One requirement (AUTH-04) fully satisfied. TypeScript compiles with no errors (`npx tsc --noEmit` produces no output). All 8 commits from summaries exist in git log.

---

_Verified: 2026-02-25_
_Verifier: Claude (gsd-verifier)_
