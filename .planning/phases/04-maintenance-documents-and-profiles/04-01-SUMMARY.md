---
phase: 04-maintenance-documents-and-profiles
plan: 01
subsystem: database, infra
tags: [drizzle, postgres, file-upload, hello-pangea-dnd, neon]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "units table, tenantUnits table, Better Auth user model"
provides:
  - "maintenanceRequests, maintenancePhotos, maintenanceComments tables"
  - "documents, documentRequests tables"
  - "emergencyContacts table"
  - "File upload utility (saveUploadedFile) with MIME/size validation"
  - "Authenticated file serving route /api/uploads/[...path]"
  - "@hello-pangea/dnd installed for kanban board"
affects: [04-02, 04-03, 04-04, 04-05, 04-06]

# Tech tracking
tech-stack:
  added: ["@hello-pangea/dnd@18.0.1"]
  patterns: ["local file storage with uploads/ directory", "authenticated file serving via API route", "path traversal protection on file access"]

key-files:
  created:
    - "src/lib/uploads.ts"
    - "src/app/api/uploads/[...path]/route.ts"
    - "uploads/.gitkeep"
    - "drizzle/0003_quick_tusk.sql"
  modified:
    - "src/db/schema/domain.ts"
    - ".gitignore"
    - "package.json"

key-decisions:
  - "Local file storage in uploads/ directory with API-based serving for auth-gated access"
  - "UUID-based filenames to prevent collisions and path information leakage"

patterns-established:
  - "File upload: validate MIME + size, save with UUID name, store relative path in DB"
  - "File serving: auth check + path.resolve traversal guard + Content-Type from extension"

requirements-completed: [MAINT-01, MAINT-02, MAINT-03, DOC-01, DOC-02, TMGMT-01]

# Metrics
duration: 2min
completed: 2026-02-26
---

# Phase 4 Plan 01: Schema and Upload Infrastructure Summary

**6 new Drizzle tables (maintenance, documents, emergency contacts) with file upload/serving utility and @hello-pangea/dnd installed**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-26T17:24:07Z
- **Completed:** 2026-02-26T17:26:52Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Defined 6 Phase 4 database tables: maintenanceRequests (7 categories, 4-stage status), maintenancePhotos, maintenanceComments (with isStatusChange flag), documents (3 document types), documentRequests (pending/submitted workflow), emergencyContacts (unique per user)
- Created file upload utility with 25MB limit and MIME validation (JPEG, PNG, HEIC, PDF, Word)
- Created authenticated file serving route with path traversal protection
- Applied database migration to Neon -- all 6 tables created
- Installed @hello-pangea/dnd for admin kanban board

## Task Commits

Each task was committed atomically:

1. **Task 1: Install @hello-pangea/dnd and add all Phase 4 database schemas** - `38fac4b` (feat)
2. **Task 2: Create file upload utility, file serving route, and run database migration** - `91f7719` (feat)

## Files Created/Modified
- `src/db/schema/domain.ts` - Added 6 new table definitions for Phase 4
- `src/lib/uploads.ts` - File upload utility with saveUploadedFile, ALLOWED_MIME_TYPES, MAX_FILE_SIZE
- `src/app/api/uploads/[...path]/route.ts` - Authenticated file serving with path traversal guard
- `uploads/.gitkeep` - Uploads directory placeholder
- `.gitignore` - Exclude upload contents, keep .gitkeep
- `package.json` - Added @hello-pangea/dnd dependency
- `drizzle/0003_quick_tusk.sql` - Migration creating 6 new tables

## Decisions Made
- Local file storage in uploads/ directory with API-based serving -- matches user constraint, keeps costs zero, can migrate to S3 later
- UUID-based filenames prevent collisions and don't leak original file names in URLs

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 6 database tables available for Plans 02-06 to build CRUD operations on
- File upload utility ready for maintenance photo and document upload endpoints
- File serving route ready to serve uploaded content
- @hello-pangea/dnd available for admin kanban board in Plan 04

---
*Phase: 04-maintenance-documents-and-profiles*
*Completed: 2026-02-26*
