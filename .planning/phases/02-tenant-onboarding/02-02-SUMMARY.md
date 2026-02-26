---
phase: 02-tenant-onboarding
plan: 02
subsystem: api, ui
tags: [invite-tokens, qr-code, admin-ui, next-api-routes, shadcn]

# Dependency graph
requires:
  - phase: 02-tenant-onboarding
    provides: inviteTokens schema, token utilities (generateInviteToken, hashToken, getInviteExpiry), QR utilities (generateQRCodeBuffer, generateQRCodeDataURL)
provides:
  - POST /api/invites/generate endpoint for admin invite token generation with QR data URL
  - GET /api/invites/qr/[token] endpoint for downloadable QR code PNG
  - Admin invites page at /admin/invites listing units with invite status
  - InviteManager client component for generate, preview, copy, and download actions
affects: [02-tenant-onboarding]

# Tech tracking
tech-stack:
  added: []
  patterns: [admin-only API route with session check, server-component data fetching with client interactivity, QR code inline preview and download]

key-files:
  created:
    - src/app/api/invites/generate/route.ts
    - src/app/api/invites/qr/[token]/route.ts
    - src/app/(admin)/admin/invites/page.tsx
    - src/components/admin/InviteManager.tsx
  modified:
    - .env.example

key-decisions:
  - "QR code served via dedicated API route for clean PNG download with Content-Disposition attachment header"
  - "NEXT_PUBLIC_APP_URL env var used for invite URL construction with localhost fallback"

patterns-established:
  - "admin-api-auth: API routes check session via auth.api.getSession + role === admin before processing"
  - "generate-and-display: token generated server-side, raw token + QR data URL returned once, only hash stored"

requirements-completed: [AUTH-04]

# Metrics
duration: 2min
completed: 2026-02-26
---

# Phase 02 Plan 02: Admin Invite Management Summary

**Admin invite management UI with API routes for generating hashed invite tokens, QR code preview/download, and unit-level invite status tracking**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-26T03:20:31Z
- **Completed:** 2026-02-26T03:23:12Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- POST /api/invites/generate endpoint validates admin session, verifies unit exists, generates 256-bit token, stores SHA-256 hash, returns raw token + QR data URL + invite URL
- GET /api/invites/qr/[token] endpoint generates QR code PNG buffer for download with Content-Disposition attachment header
- Admin invites page at /admin/invites fetches all units with property names and pending invite status via server component
- InviteManager client component provides generate button per unit, inline QR code preview, copy link to clipboard, and download QR as PNG

## Task Commits

Each task was committed atomically:

1. **Task 1: Create API routes for invite generation and QR code serving** - `7de964c` (feat)
2. **Task 2: Create admin invites page and InviteManager component** - `d5d9091` (feat)

## Files Created/Modified
- `src/app/api/invites/generate/route.ts` - POST endpoint: admin auth, token generation, hash storage, QR data URL response
- `src/app/api/invites/qr/[token]/route.ts` - GET endpoint: QR code PNG buffer with download headers
- `src/app/(admin)/admin/invites/page.tsx` - Server component listing units with invite status
- `src/components/admin/InviteManager.tsx` - Client component with generate, preview, copy, download functionality
- `.env.example` - Added NEXT_PUBLIC_APP_URL variable

## Decisions Made
- QR code download uses a dedicated API route (GET /api/invites/qr/[token]) rather than client-side download of the data URL -- cleaner for print workflows and produces a proper PNG file
- NEXT_PUBLIC_APP_URL environment variable used for constructing invite URLs, with http://localhost:3000 fallback for local development

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Buffer type incompatibility in QR response**
- **Found during:** Task 1 (QR code API route)
- **Issue:** `Buffer` from `generateQRCodeBuffer()` is not assignable to `BodyInit` in the `Response` constructor (TypeScript strict type check)
- **Fix:** Wrapped buffer with `new Uint8Array(buffer)` which is a valid `BodyInit` type
- **Files modified:** `src/app/api/invites/qr/[token]/route.ts`
- **Verification:** `npx tsc --noEmit` passes with no errors
- **Committed in:** `7de964c` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor type compatibility fix. No scope creep.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Admin can now generate invite tokens and download QR codes via /admin/invites
- Ready for Plan 03 (invite registration form and token consumption flow)
- Ready for Plan 04 (end-to-end verification of full invite flow)

## Self-Check: PASSED

All files exist, all commits verified.

---
*Phase: 02-tenant-onboarding*
*Completed: 2026-02-26*
