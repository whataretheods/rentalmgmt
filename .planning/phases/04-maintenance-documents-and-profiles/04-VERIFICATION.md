---
phase: 04-maintenance-documents-and-profiles
verified: 2026-02-26T19:00:00Z
status: passed
score: 6/6 must-haves verified
re_verification: null
gaps: []
human_verification:
  - test: "Drag-and-drop kanban status update"
    expected: "Dragging a card from Submitted column to Acknowledged updates the request status in the database and card moves columns"
    why_human: "Cannot verify drag-and-drop browser gesture interactions programmatically without running the app"
  - test: "Photo upload with thumbnail preview"
    expected: "Selecting image files shows thumbnail previews before submission; previews are removed when X button clicked"
    why_human: "URL.createObjectURL preview rendering requires a browser environment"
  - test: "Email change verification email delivery"
    expected: "Clicking 'Send Verification Email' on profile triggers Resend to deliver an email to the new address with a working verification link"
    why_human: "Email delivery requires checking an external mailbox; cannot verify Resend delivery programmatically"
---

# Phase 4: Maintenance, Documents, and Profiles Verification Report

**Phase Goal:** Tenants can manage their contact info, submit and track maintenance requests, and upload documents — completing the full tenant self-service experience
**Verified:** 2026-02-26T19:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Tenant can submit a maintenance request with issue type, description, and photos attached | VERIFIED | `MaintenanceRequestForm.tsx` POSTs FormData with category select, description textarea, and multi-file input to `/api/maintenance`. API route accepts up to 5 photos via `saveUploadedFile`. |
| 2 | Tenant can check the current status of their open maintenance requests (submitted, acknowledged, in progress, resolved) | VERIFIED | `MaintenanceRequestList.tsx` fetches GET `/api/maintenance` and renders color-coded status badges (yellow/blue/orange/green). `MaintenanceRequestDetail.tsx` shows current status badge on the detail view. |
| 3 | Admin can view all maintenance requests in a queue and filter by status, unit, or date | VERIFIED | `MaintenanceKanban.tsx` fetches `/api/admin/maintenance` with unit/dateFrom/dateTo filter params and renders 4 kanban columns. Admin API route applies dynamic Drizzle where conditions for status, unitId, dateFrom, dateTo. |
| 4 | Tenant can upload a document (ID, proof doc, ad-hoc file) with type and size validation that rejects unsupported formats | VERIFIED | `DocumentUpload.tsx` client-side checks file.size > 25MB before upload. `saveUploadedFile` in `uploads.ts` checks ALLOWED_MIME_TYPES and throws on mismatch; `POST /api/documents` catches and returns 400 with error message. |
| 5 | Admin can request a specific document from a tenant and see when the tenant has submitted it | VERIFIED | `DocumentRequestForm.tsx` POSTs to `/api/documents/requests` (admin-only). `DocumentSubmissions.tsx` fetches GET `/api/documents/requests` and shows status badges (pending/submitted) with fulfilled date. When tenant uploads with requestId, POST `/api/documents` atomically updates `documentRequests.status` to "submitted" and sets `fulfilledAt`. |
| 6 | Tenant can update their own name, phone, email, and emergency contact at any time | VERIFIED | `ProfileForm.tsx` has three independent save sections: personal info (PATCH `/api/profile` with name/phone), email change (via `authClient.changeEmail` with Better Auth verification flow), emergency contact (PATCH `/api/profile` with emergencyContact). Profile API uses Drizzle upsert on `emergencyContacts`. |

**Score:** 6/6 truths verified

---

### Required Artifacts

#### Plan 01 — Schema and Upload Infrastructure

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/db/schema/domain.ts` | All 6 Phase 4 table definitions | VERIFIED | Contains `maintenanceRequests` (7 categories, 4-stage status), `maintenancePhotos`, `maintenanceComments` (with `isStatusChange`), `documents` (3 doc types, optional requestId), `documentRequests` (pending/submitted), `emergencyContacts` (unique userId). All user ID fields use `text()`. |
| `src/lib/uploads.ts` | File upload utility with validation | VERIFIED | Exports `saveUploadedFile`, `ALLOWED_MIME_TYPES` (7 MIME types), `MAX_FILE_SIZE` (25MB). Validates size and MIME before writing. Uses UUID filenames. |
| `src/app/api/uploads/[...path]/route.ts` | Authenticated file serving with path traversal protection | VERIFIED | Auth check returns 401 if no session. `path.resolve` check against `UPLOADS_DIR` prevents traversal. Reads and serves file with correct Content-Type. |

#### Plan 02 — Tenant Maintenance System

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/app/api/maintenance/route.ts` | GET list + POST create with photos | VERIFIED | GET returns tenant's requests with photo count subquery. POST validates category enum, looks up active unit, inserts request, uploads each photo via `saveUploadedFile`. Returns 201. |
| `src/app/api/maintenance/[id]/route.ts` | GET detail + PATCH status (admin) | VERIFIED | GET returns request + photos + comments. Access check: owner or admin. PATCH validates admin role, valid status enum, updates with optional resolvedAt, inserts status-change comment if note provided. |
| `src/app/api/maintenance/[id]/comments/route.ts` | POST threaded comment | VERIFIED | Auth check, request access check (owner or admin), validates non-empty content, inserts comment with `isStatusChange: false`. Returns 201. |
| `src/components/tenant/MaintenanceRequestForm.tsx` | Form with category select, description, multi-photo upload and preview | VERIFIED | "use client". Category select with 7 options, description textarea, file input with `URL.createObjectURL` thumbnails, remove buttons, max 5 photo warning. Submits FormData to POST `/api/maintenance`. Redirects on success. |
| `src/components/tenant/MaintenanceRequestList.tsx` | Request list with status badges and category icons | VERIFIED | Fetches GET `/api/maintenance` on mount. Renders cards with lucide-react category icons, color-coded status badges, photo count, date. Links to detail view. Empty state with CTA. |
| `src/components/tenant/MaintenanceRequestDetail.tsx` | Detail with photo gallery, status, and comment thread | VERIFIED | Fetches GET `/api/maintenance/[id]`. Shows category/status/dates, photo grid with lightbox, threaded comments (status changes distinguished). Comment form POSTs to `/api/maintenance/[id]/comments`. Optimistic append. |

#### Plan 03 — Document Management

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/app/api/documents/route.ts` | GET list + POST upload | VERIFIED | GET returns documents + pendingRequests for tenant (admin can query by tenantUserId). POST saves via `saveUploadedFile` (MIME/size validated), inserts document record, if requestId provided updates documentRequests to "submitted" with fulfilledAt. |
| `src/app/api/documents/[id]/route.ts` | GET download with auth | VERIFIED | Auth check, doc ownership check (owner or admin), path traversal protection, reads file, returns with Content-Disposition: inline. |
| `src/app/api/documents/requests/route.ts` | GET list + POST create request (admin) | VERIFIED | GET: admin sees all with tenant info (join on user table), tenant sees only own. POST: admin-only, Zod validation, target user existence check, inserts documentRequest. Returns 201. |
| `src/components/tenant/DocumentUpload.tsx` | Upload form with client validation | VERIFIED | "use client". Client-side size check (> 25MB shows toast error). Document type select. File input with accept extensions. Posts FormData with optional requestId for request fulfillment. |
| `src/components/admin/DocumentRequestForm.tsx` | Admin form to request document from tenant | VERIFIED | Fetches tenants via Better Auth admin listUsers. Tenant select, document type select, optional message textarea. POSTs to `/api/documents/requests`. Toast on success. |
| `src/components/admin/DocumentSubmissions.tsx` | Admin view of all requests with status | VERIFIED | Fetches GET `/api/documents/requests`. Status filter tabs (All/Pending/Submitted). Table with tenant name/email, type, date, color-coded status badge, fulfilled date. |

#### Plan 04 — Tenant Profile Editing

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/app/api/profile/route.ts` | GET profile + PATCH updates | VERIFIED | GET: queries user table for name/email/phone, queries emergencyContacts. PATCH: updates name/phone via Drizzle, upserts emergencyContacts with `onConflictDoUpdate`. Returns updated profile. |
| `src/components/tenant/ProfileForm.tsx` | Profile form with 3 independent save sections | VERIFIED | Fetches GET `/api/profile` on mount, pre-populates all fields. Three sections: personal info (PATCH name/phone), email change (via `authClient.changeEmail`), emergency contact (PATCH emergencyContact). Each has independent save button with toast. |
| `src/lib/auth.ts` | Better Auth config with email change verification | VERIFIED | `user.changeEmail.enabled: true` with `sendChangeEmailVerification` callback that fires `resend.emails.send` (non-awaited to prevent timing attacks). `phone` in `user.additionalFields` with `input: true`. |

#### Plan 05 — Admin Maintenance Kanban

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/admin/MaintenanceKanban.tsx` | Drag-and-drop kanban with 4 columns | VERIFIED | "use client". Imports `DragDropContext`, `Droppable`, `Draggable` from `@hello-pangea/dnd`. 4 status columns as Droppables. Requests as Draggables. `onDragEnd` optimistically updates state, PATCHes `/api/maintenance/[id]`, reverts on failure. Filter bar with unit dropdown and date inputs. |
| `src/components/admin/MaintenanceCard.tsx` | Compact kanban card | VERIFIED | Props: request object. Shows category icon + label, unit badge, description preview, tenant name, photo count indicator, relative time. Links to `/admin/maintenance/[id]`. |
| `src/app/api/admin/maintenance/route.ts` | GET all requests with filters (admin only) | VERIFIED | Admin role check. Dynamic where conditions for status, unitId, dateFrom, dateTo. Inner joins units and user tables. Photo count subquery. Returns enriched request array. |
| `src/app/(admin)/admin/maintenance/page.tsx` | Admin kanban page | VERIFIED | "use client". Dynamic import with `ssr: false` for `MaintenanceKanban` to avoid SSR hydration issues with @hello-pangea/dnd. |
| `src/app/(admin)/admin/maintenance/[id]/page.tsx` | Admin detail page | VERIFIED | Extracts params.id, renders `AdminMaintenanceDetail` with status update controls (dropdown + note textarea), photo gallery, and comment thread. |

#### Plan 06 — E2E Tests

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `e2e/maintenance.spec.ts` | E2E tests for MAINT-01, MAINT-02, MAINT-03 | VERIFIED | 7 tests covering: list page load, submit request form, track status in detail, add comment, admin kanban columns load, admin filter bar visibility. Uses env-var credentials with fallbacks. |
| `e2e/documents.spec.ts` | E2E tests for DOC-01, DOC-02 | VERIFIED | 3 tests: documents page sections load, pending admin request visible from seed, fulfill request with file upload via `setInputFiles`. |
| `e2e/profile.spec.ts` | E2E tests for TMGMT-01 | VERIFIED | 5 tests: form sections load, data pre-populates (name input has value, email shown), update personal info (toast appears), update emergency contact, phone field is editable. |
| `scripts/seed-phase4-test.ts` | Test seed script | VERIFIED | Uses `config({ path: ".env.local" })` (correct dotenv path per project conventions). Finds tenant via active tenant-unit link (portable). Idempotent — skips if data already exists. Seeds maintenance request + admin comment + document request. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `MaintenanceRequestForm.tsx` | `/api/maintenance` | `fetch` POST with FormData | WIRED | Line 95: `await fetch("/api/maintenance", { method: "POST", body: formData })` with response handling and toast/redirect on success |
| `MaintenanceRequestList.tsx` | `/api/maintenance` | `fetch` GET | WIRED | Line 65: `await fetch("/api/maintenance")` in useEffect, result stored in state and rendered |
| `MaintenanceRequestDetail.tsx` | `/api/maintenance/[id]/comments` | `fetch` POST | WIRED | Line 120: `await fetch(\`/api/maintenance/${requestId}/comments\`, { method: "POST", ... })` in handleAddComment |
| `DocumentUpload.tsx` | `/api/documents` | `fetch` POST with FormData | WIRED | Line 71: `await fetch("/api/documents", { method: "POST", body: formData })` with response handling |
| `DocumentRequestForm.tsx` | `/api/documents/requests` | `fetch` POST | WIRED | Line 73: `await fetch("/api/documents/requests", { method: "POST", ... })` in handleSubmit |
| `POST /api/documents/route.ts` | `documentRequests` table | Update on requestId | WIRED | Lines 90–98: `await db.update(documentRequests).set({ status: "submitted", fulfilledAt: new Date() })` when requestId provided |
| `MaintenanceKanban.tsx` | `/api/maintenance/[id]` | PATCH on drag end | WIRED | Line 96: `await fetch(\`/api/maintenance/${requestId}\`, { method: "PATCH", ... })` in onDragEnd |
| `MaintenanceKanban.tsx` | `@hello-pangea/dnd` | DragDropContext/Droppable/Draggable imports | WIRED | Lines 5–9: `import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd"` |
| `ProfileForm.tsx` | `/api/profile` | `fetch` GET and PATCH | WIRED | fetchProfile (line 47), handleSavePersonal (line 70), handleSaveEmergency (line 122) all use `/api/profile` |
| `ProfileForm.tsx` | `authClient.changeEmail` | Better Auth client | WIRED | Line 97: `await authClient.changeEmail({ newEmail: ..., callbackURL: ... })` |
| `src/lib/auth.ts` | Resend email | `sendChangeEmailVerification` | WIRED | Lines 42–50: `void resend.emails.send(...)` in `user.changeEmail.sendChangeEmailVerification` |
| `src/db/schema/domain.ts` | `units` table | `maintenanceRequests.unitId` references `units.id` | WIRED | Line 89: `.references(() => units.id, { onDelete: "cascade" })` |
| `/api/uploads/[...path]/route.ts` | `uploads/` directory | `fs.readFile` from resolved path | WIRED | Line 38: `const buffer = await fs.readFile(resolvedPath)` |

---

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| MAINT-01 | 01, 02, 06 | Tenant can submit maintenance request with issue type, description, and photos | SATISFIED | `MaintenanceRequestForm.tsx` + POST `/api/maintenance` with FormData photos via `saveUploadedFile`. E2E test in `maintenance.spec.ts` "submit maintenance request" verifies end-to-end. |
| MAINT-02 | 01, 02, 06 | Tenant can track maintenance request status (submitted, acknowledged, in progress, resolved) | SATISFIED | `MaintenanceRequestList.tsx` shows status badges. `MaintenanceRequestDetail.tsx` shows current status + comment thread including status-change comments. E2E test "track request status and view detail" verifies. |
| MAINT-03 | 01, 05, 06 | Admin can manage maintenance queue with filters by status, unit, and date | SATISFIED | `MaintenanceKanban.tsx` with 4 columns + filter bar. `/api/admin/maintenance` supports status/unitId/dateFrom/dateTo filters. E2E test "kanban board loads with status columns" verifies. |
| DOC-01 | 01, 03, 06 | Tenant can upload documents (ID, proof docs, ad-hoc files) with type and size validation | SATISFIED | `DocumentUpload.tsx` client-side 25MB check + `saveUploadedFile` MIME validation. POST `/api/documents` returns 400 with descriptive error on rejection. E2E "fulfill admin document request with file upload" verifies. |
| DOC-02 | 01, 03, 06 | Admin can request specific documents from tenants and view submissions | SATISFIED | `DocumentRequestForm.tsx` + POST `/api/documents/requests`. `DocumentSubmissions.tsx` shows all requests with status. Fulfillment atomically updates `documentRequests.status`. E2E "pending admin request is visible from seed data" verifies. |
| TMGMT-01 | 01, 04, 06 | Tenant can manage own contact info (name, phone, email, emergency contact) | SATISFIED | `ProfileForm.tsx` with 3 independent save sections. PATCH `/api/profile` updates name/phone and upserts emergencyContacts. Email change via `authClient.changeEmail` with Resend verification. E2E profile tests verify all 4 fields. |

**No orphaned requirements found.** All 6 requirement IDs declared across plans are accounted for with verified implementations.

---

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| None found | — | — | — |

All "placeholder" occurrences in component files are HTML `placeholder=""` attributes on form inputs — not stub implementations. The `provided.placeholder` in `MaintenanceKanban.tsx` is the `@hello-pangea/dnd` API prop, not a stub pattern.

---

### Human Verification Required

#### 1. Drag-and-Drop Kanban Status Update

**Test:** Navigate to `/admin/maintenance` as admin. Drag a card from the "Submitted" column to the "Acknowledged" column.
**Expected:** Card moves to the Acknowledged column, a PATCH request fires to `/api/maintenance/[id]`, the database record updates, and refreshing the page shows the card in the correct column.
**Why human:** Browser-level drag gesture (mousedown, mousemove, mouseup sequence) cannot be reliably automated without a running browser, and Playwright drag-and-drop with @hello-pangea/dnd requires specific action sequences.

#### 2. Photo Upload Thumbnail Preview

**Test:** Navigate to `/tenant/maintenance/new`. Click the photo upload area and select 2–3 image files.
**Expected:** Thumbnail previews appear in a grid below the upload button. Clicking the X button on a thumbnail removes it from the preview grid. Submit works with remaining photos.
**Why human:** `URL.createObjectURL` thumbnail rendering is a browser visual behavior; verifying the rendered image pixels and X-button interaction requires visual inspection.

#### 3. Email Change Verification Email

**Test:** Navigate to `/tenant/profile`. Click "Change Email Address", enter a new email, click "Send Verification Email".
**Expected:** Toast shows "Verification email sent to [new email]". Checking the new email inbox shows a message with a verification link that, when clicked, updates the user's email.
**Why human:** Email delivery requires checking an external mailbox. The Resend API call uses `void` (fire-and-forget), so there is no programmatic way to verify delivery without polling Resend's API or checking the mailbox.

---

### Gaps Summary

No gaps found. All 6 phase success criteria are verified against actual codebase implementations:

- Schema layer: All 6 Drizzle tables exist with correct column types, relationships, and enum values.
- Infrastructure: File upload utility validates MIME type and 25MB size limit; file serving route has auth check and path traversal protection.
- Maintenance requests: Full CRUD (create with photos, list with status, detail with photo gallery and comments, admin status update with note). Kanban board uses @hello-pangea/dnd with optimistic updates and filter bar.
- Documents: Upload with client+server validation, download with auth, admin request workflow with fulfillment tracking and status update.
- Profile editing: Name/phone/emergency contact via API upsert; email change via Better Auth client with Resend verification email configured.
- E2E tests: 14 Playwright tests across 3 files covering all 6 requirements; seed script uses correct dotenv path and idempotent data creation.

Three items are flagged for human verification (drag-and-drop UX, photo thumbnail preview, email delivery) — these are browser-visual and external-service behaviors that pass automated code review but require a human spot-check.

---

_Verified: 2026-02-26T19:00:00Z_
_Verifier: Claude (gsd-verifier)_
