---
phase: 07-infrastructure-prerequisites
plan: 03
subsystem: storage
tags: [s3, r2, cloudflare, storage, uploads, presigned-url, dual-read]

requires:
  - phase: 07-infrastructure-prerequisites/02
    provides: storageBackend and s3Key columns on maintenancePhotos and documents
provides:
  - "S3 client library with uploadToS3, getPresignedDownloadUrl, isS3Configured"
  - "Updated saveUploadedFile that stores to S3 when configured with local fallback"
  - "Dual-read file serving routes (S3 presigned URL redirect or local filesystem)"
affects: [08-financial-ledger, 10-portfolio-management]

tech-stack:
  added: ["@aws-sdk/client-s3", "@aws-sdk/s3-request-presigner"]
  patterns: [S3 dual-read serving, presigned URL redirect, graceful local fallback]

key-files:
  created:
    - src/lib/storage.ts
  modified:
    - src/lib/uploads.ts
    - src/app/api/maintenance/route.ts
    - src/app/api/documents/route.ts
    - src/app/api/uploads/[...path]/route.ts
    - src/app/api/documents/[id]/route.ts
    - package.json

key-decisions:
  - "Used lazy-initialized singleton S3Client (same pattern as database connection)"
  - "Graceful fallback: when S3 env vars are not configured, uploads use local filesystem"
  - "Presigned URLs use 302 redirect so file bytes never pass through app server"

patterns-established:
  - "Storage dual-read: check storageBackend column, redirect to presigned URL for S3 or serve local file"
  - "Upload result interface includes storageBackend and s3Key alongside legacy filePath"

requirements-completed: [INFRA-01]

duration: 5min
completed: 2026-02-26
---

# Phase 7 Plan 03: S3 Cloud Storage Summary

**S3-compatible cloud storage with dual-read pattern for maintenance photos and documents**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-26
- **Completed:** 2026-02-26
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Created S3 client library (src/lib/storage.ts) with uploadToS3, getPresignedDownloadUrl, isS3Configured
- Updated saveUploadedFile to upload to S3 when configured, with graceful local fallback
- Added storageBackend and s3Key to maintenance photo and document insert operations
- Implemented dual-read serving in upload and document routes (presigned URL redirect for S3, local file for existing)
- Installed @aws-sdk/client-s3 and @aws-sdk/s3-request-presigner

## Task Commits

Each task was committed atomically:

1. **Task 1: Create S3 client library and update upload function** - `0d0ae91` (feat)
2. **Task 2: Update API routes for S3 upload and dual-read serving** - `e38bb4a` (feat)

## Files Created/Modified
- `src/lib/storage.ts` - S3 client, uploadToS3, getPresignedDownloadUrl, isS3Configured
- `src/lib/uploads.ts` - Updated saveUploadedFile with S3/local dual path and expanded return type
- `src/app/api/maintenance/route.ts` - Added storageBackend and s3Key to photo inserts
- `src/app/api/documents/route.ts` - Added storageBackend and s3Key to document inserts
- `src/app/api/uploads/[...path]/route.ts` - Dual-read: S3 presigned URL redirect or local file
- `src/app/api/documents/[id]/route.ts` - Dual-read: S3 presigned URL redirect or local file
- `package.json` - Added @aws-sdk/client-s3 and @aws-sdk/s3-request-presigner

## Decisions Made
- Used lazy-initialized singleton S3Client (same deferred-initialization pattern as database)
- Graceful fallback when S3 env vars not configured (development-friendly)
- 302 redirect to presigned URLs avoids proxying file bytes through the app server

## Deviations from Plan
None.

## Issues Encountered
None.

## User Setup Required

To enable S3 cloud storage, configure these environment variables in `.env.local`:

| Variable | Source |
|---|---|
| `S3_ENDPOINT` | R2 Dashboard -> Overview -> S3 API endpoint |
| `S3_ACCESS_KEY_ID` | R2 Dashboard -> Manage R2 API Tokens -> Create API Token |
| `S3_SECRET_ACCESS_KEY` | R2 Dashboard -> Manage R2 API Tokens -> Secret Access Key |
| `S3_BUCKET_NAME` | R2 Dashboard -> Create Bucket (e.g., "rentalmgmt-uploads") |

Without these variables, uploads gracefully fall back to local filesystem storage.

## Next Phase Readiness
- S3 upload and dual-read serving ready for production deployments
- Existing local files continue to work via storageBackend column
- No schema changes needed (columns were added in Plan 02)

---
*Phase: 07-infrastructure-prerequisites*
*Completed: 2026-02-26*

## Self-Check: PASSED
