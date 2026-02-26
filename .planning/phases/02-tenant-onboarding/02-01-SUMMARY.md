---
phase: 02-tenant-onboarding
plan: 01
subsystem: database, auth
tags: [drizzle, invite-tokens, qr-code, better-auth-hooks, crypto, sha256]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: domain schema (properties, units, tenantUnits), Better Auth config, Drizzle ORM setup
provides:
  - inviteTokens table with unitId FK, tokenHash, status enum, expiry tracking
  - Token generation (crypto.randomBytes 256-bit) and hashing (SHA-256) utilities
  - QR code generation utilities (PNG buffer and data URL)
  - Better Auth after-signup hook consuming invite tokens and linking users to units
affects: [02-tenant-onboarding]

# Tech tracking
tech-stack:
  added: [qrcode, "@types/qrcode"]
  patterns: [hash-before-store tokens, atomic UPDATE WHERE for single-use consumption, Better Auth after-hook middleware]

key-files:
  created:
    - src/lib/tokens.ts
    - src/lib/qr.ts
    - drizzle/0001_wet_marvex.sql
  modified:
    - src/db/schema/domain.ts
    - src/lib/auth.ts
    - package.json

key-decisions:
  - "Token passed via request body field (inviteToken) rather than cookie for simplicity"
  - "Atomic UPDATE WHERE status=pending AND expiresAt>now for race-condition-safe consumption"
  - "Unlinked user on failed consumption gets warning log, not error -- account still created"

patterns-established:
  - "hash-before-store: SHA-256 hash tokens before DB storage, never store raw tokens"
  - "atomic-consumption: UPDATE WHERE with status+expiry check returns consumed row or empty array"
  - "after-hook middleware: createAuthMiddleware for post-signup processing in Better Auth"

requirements-completed: [AUTH-04]

# Metrics
duration: 3min
completed: 2026-02-26
---

# Phase 02 Plan 01: Invite Token Backend Summary

**inviteTokens schema with SHA-256 hashed tokens, QR code generation utils, and Better Auth after-signup hook for atomic token consumption and user-unit linking**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-26T03:14:24Z
- **Completed:** 2026-02-26T03:17:31Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- inviteTokens table added to domain schema with unitId FK, tokenHash (unique), status enum, expiry, and consumption tracking
- Token utilities: generateInviteToken (256-bit base64url), hashToken (SHA-256 hex), getInviteExpiry (30 days)
- QR utilities: generateQRCodeBuffer (PNG buffer), generateQRCodeDataURL (data URL string)
- Better Auth after-signup hook atomically consumes invite tokens and creates tenantUnits rows
- Database migration generated and applied successfully

## Task Commits

Each task was committed atomically:

1. **Task 1: Add inviteTokens schema, install qrcode, create token and QR utilities** - `e139732` (feat)
2. **Task 2: Add Better Auth after-signup hook and run database migration** - `01e6654` (feat)

## Files Created/Modified
- `src/db/schema/domain.ts` - Added inviteTokens table definition after tenantUnits
- `src/lib/tokens.ts` - Token generation (randomBytes), hashing (SHA-256), and expiry utilities
- `src/lib/qr.ts` - QR code generation as PNG buffer and data URL using qrcode package
- `src/lib/auth.ts` - Added createAuthMiddleware after-signup hook for token consumption
- `drizzle/0001_wet_marvex.sql` - Migration creating invite_tokens table
- `drizzle/meta/0001_snapshot.json` - Drizzle migration snapshot
- `package.json` - Added qrcode dependency and @types/qrcode devDependency

## Decisions Made
- Token is passed from invite registration form to Better Auth via request body field (`inviteToken`) rather than cookie -- simpler, no cookie management needed
- Atomic UPDATE WHERE with status='pending' AND expiresAt>now prevents race conditions on token consumption -- if 0 rows returned, token was already used or expired
- When token consumption fails, the user account is still created but not linked to a unit -- a warning is logged and the user sees an "unlinked" state

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Backend infrastructure ready for Plan 02 (invite generation API and admin UI)
- inviteTokens table exists and is migrated
- Token utilities and QR generation are importable from src/lib/
- After-signup hook is wired and will process any signup that includes an inviteToken field

## Self-Check: PASSED

All files exist, all commits verified.

---
*Phase: 02-tenant-onboarding*
*Completed: 2026-02-26*
