---
phase: 02-tenant-onboarding
plan: 03
subsystem: ui, auth
tags: [next.js-server-component, invite-page, registration-form, react-hook-form, zod, better-auth-signup]

# Dependency graph
requires:
  - phase: 02-tenant-onboarding
    plan: 01
    provides: inviteTokens schema, hashToken utility, Better Auth after-signup hook
provides:
  - /invite/[token] Server Component landing page with four-state token validation
  - InviteRegisterForm Client Component passing inviteToken through signup body
affects: [02-tenant-onboarding]

# Tech tracking
tech-stack:
  added: []
  patterns: [server-side token validation with hash lookup, invite-aware registration form with extra body field passthrough]

key-files:
  created:
    - src/app/invite/[token]/page.tsx
    - src/components/auth/InviteRegisterForm.tsx
  modified: []

key-decisions:
  - "Raw token passed as prop to InviteRegisterForm, then included in signUp.email body for after-hook consumption"
  - "Type assertion used for inviteToken extra field since Better Auth TS types do not include custom body fields"
  - "HTML ids prefixed with invite- to avoid collisions if both RegisterForm and InviteRegisterForm are on the same page"

patterns-established:
  - "server-side-token-validation: Hash token, query DB, render appropriate error state before showing form"
  - "extra-body-field-passthrough: Use type assertion to pass custom fields through Better Auth signUp.email"

requirements-completed: [AUTH-04]

# Metrics
duration: 2min
completed: 2026-02-26
---

# Phase 02 Plan 03: Invite Landing Page and Registration Form Summary

**/invite/[token] Server Component with four-state token validation (valid/used/expired/invalid) and InviteRegisterForm Client Component passing invite token through Better Auth signup body**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-26T03:20:32Z
- **Completed:** 2026-02-26T03:22:18Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- /invite/[token] page validates token server-side via SHA-256 hash lookup against inviteTokens table
- Four render states: valid (registration form + unit number), used ("already used"), expired ("invite expired"), invalid ("not recognized")
- InviteRegisterForm passes inviteToken as extra field in authClient.signUp.email() body for after-hook consumption
- Unit number displayed on valid invite page so tenant knows which unit they are registering for
- No middleware changes required -- /invite path is not under /tenant or /admin protected routes

## Task Commits

Each task was committed atomically:

1. **Task 1: Create /invite/[token] landing page with server-side token validation** - `610869f` (feat)
2. **Task 2: Create InviteRegisterForm with invite token passthrough** - `bbaff3c` (feat)

## Files Created/Modified
- `src/app/invite/[token]/page.tsx` - Server Component: validates invite token, renders four states (valid/used/expired/invalid), shows unit number context
- `src/components/auth/InviteRegisterForm.tsx` - Client Component: registration form with inviteToken passthrough in signup body, follows RegisterForm patterns (react-hook-form + zod + sonner)

## Decisions Made
- Raw token is passed as a prop from the Server Component to the Client Component, then included in the signUp.email body -- this matches the Plan 01 decision to use request body (not cookie) for token passthrough
- Type assertion `as Parameters<typeof authClient.signUp.email>[0] & { inviteToken: string }` used because Better Auth TypeScript types do not include custom body fields, but the runtime forwards them correctly
- HTML form element ids prefixed with `invite-` (e.g., `invite-name`, `invite-email`) to avoid potential DOM id collisions with the standard RegisterForm

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Invite landing page and registration form ready for end-to-end testing
- Complete invite flow: admin generates token (Plan 02) -> QR code encodes URL -> tenant scans -> /invite/[token] validates -> InviteRegisterForm submits -> after-hook consumes token and links user to unit
- Plan 04 (admin invite management UI) can proceed independently

## Self-Check: PASSED

All files exist, all commits verified.

---
*Phase: 02-tenant-onboarding*
*Completed: 2026-02-26*
