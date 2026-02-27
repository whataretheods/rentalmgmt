---
phase: 07-infrastructure-prerequisites
plan: 01
subsystem: database
tags: [neon, websocket, pool, drizzle, transaction, ws]

requires:
  - phase: 06-autopay-and-polish
    provides: working application with neon-http driver
provides:
  - "WebSocket Pool-based Drizzle database instance with db.transaction() support"
  - "ws polyfill configured for Node.js v20"
  - "bufferutil and utf-8-validate binary addons for ws performance"
affects: [08-financial-ledger, 09-automated-operations, 10-portfolio-management]

tech-stack:
  added: [ws, bufferutil, utf-8-validate, drizzle-orm/neon-serverless]
  patterns: [Pool singleton with lazy init, Proxy pattern for build safety]

key-files:
  created:
    - e2e/infra-transactions.spec.ts
  modified:
    - src/db/index.ts
    - package.json

key-decisions:
  - "Used Pool from @neondatabase/serverless instead of neon() HTTP function for full transaction support"
  - "Installed bufferutil and utf-8-validate to fix ws binary addon errors in Node.js v20"
  - "Preserved lazy-init Proxy pattern for Next.js build safety"

patterns-established:
  - "Pool singleton: module-level Pool created lazily on first access, not per-request"
  - "neonConfig.webSocketConstructor: required ws polyfill for Node.js < v22"

requirements-completed: [INFRA-04]

duration: 5min
completed: 2026-02-26
---

# Phase 7 Plan 01: DB Driver Swap Summary

**Neon HTTP driver replaced with WebSocket Pool (neon-serverless) enabling db.transaction() for atomic multi-table operations**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-26
- **Completed:** 2026-02-26
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Swapped neon-http driver to neon-serverless Pool driver with WebSocket transport
- Installed ws polyfill + binary addons (bufferutil, utf-8-validate) for Node.js v20
- Preserved lazy-init Proxy pattern so Next.js build doesn't require DATABASE_URL
- All existing auth flows and queries work unchanged with new driver

## Task Commits

Each task was committed atomically:

1. **Task 1: Install ws polyfill and swap database driver** - `c23fcef` (feat)
2. **Task 2: Verify driver swap with E2E tests** - `be03980` (test)

## Files Created/Modified
- `src/db/index.ts` - Rewritten to use Pool from @neondatabase/serverless with drizzle-orm/neon-serverless
- `e2e/infra-transactions.spec.ts` - E2E tests verifying admin login, tenant session persistence, and multi-query operations
- `package.json` - Added ws, bufferutil, utf-8-validate dependencies

## Decisions Made
- Used Pool from @neondatabase/serverless (not neon() HTTP function) for full transaction support
- Installed bufferutil and utf-8-validate to resolve ws binary addon errors on Node.js v20
- Kept Proxy pattern for lazy initialization during Next.js build

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] bufferUtil.mask is not a function error**
- **Found during:** Task 2 (E2E verification)
- **Issue:** ws package threw `TypeError: bufferUtil.mask is not a function` causing database connections to terminate
- **Fix:** Installed `bufferutil` and `utf-8-validate` optional binary dependencies for ws
- **Files modified:** package.json, package-lock.json
- **Verification:** All E2E tests pass after installing dependencies
- **Committed in:** be03980 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential fix — ws binary addons required for stable WebSocket connections on Node.js v20.

## Issues Encountered
None beyond the bufferUtil deviation documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- db.transaction() is now available for Phase 8 financial ledger atomic operations
- All existing queries and auth flows verified working with new driver
- Ready for Plan 02 (cascade safety + schema columns)

---
*Phase: 07-infrastructure-prerequisites*
*Completed: 2026-02-26*

## Self-Check: PASSED
