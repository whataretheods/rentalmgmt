# Phase 4: Maintenance, Documents, and Profiles - Research

**Researched:** 2026-02-26
**Domain:** File uploads, maintenance request management, tenant profile editing, admin kanban board
**Confidence:** HIGH

## Summary

Phase 4 adds three tenant self-service capabilities: maintenance request submission/tracking with photo attachments, document uploads with admin request workflow, and profile editing. The stack is well-understood (Next.js 15 App Router + Drizzle + Neon + shadcn/ui), and the patterns are established from Phases 1-3. The main technical challenges are: (1) file upload handling in Next.js Route Handlers with local storage, (2) drag-and-drop kanban board for admin maintenance queue, and (3) email verification for email changes via Better Auth.

**Primary recommendation:** Use Next.js Route Handler `formData()` for file uploads with `fs.writeFile` to local `uploads/` directory, `@hello-pangea/dnd` (maintained fork of `react-beautiful-dnd`) for the kanban board, and Better Auth's built-in `changeEmail` flow for email verification.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Issue categories: Plumbing, Electrical, HVAC, Appliance, Pest Control, Structural, General/Other
- Multi-photo upload: up to 5 photos per request, drag-drop or click to browse, thumbnail preview before submit
- 4-stage status progression: Submitted -> Acknowledged -> In Progress -> Resolved
- Threaded comments: both tenant and admin can add comments/updates to a request thread
- Document types: Government ID, Proof of Income/Insurance, General/Other
- Storage: local uploads directory on the server (simple, no extra cost, can migrate to S3 later)
- File limits: 25MB max per file, accept PDF, JPG, PNG, HEIC, Word docs, and common formats
- Admin document requests: admin selects tenant + doc type + optional message, tenant sees "Document Requested" on dashboard
- Editable fields: full name, phone number, email address, emergency contact (name + phone)
- Email changes require verification: send verification link to new email before updating
- Kanban board layout: cards organized by status columns (Submitted, Acknowledged, In Progress, Resolved)
- Drag cards between columns to update status
- Status updates include optional note that appears in the request thread

### Claude's Discretion
- Photo upload implementation (direct to server vs presigned URLs)
- Kanban board drag-and-drop library choice
- Emergency contact schema design
- Document request notification approach

### Deferred Ideas (OUT OF SCOPE)
- Maintenance request notifications (email/SMS when status changes) -- Phase 5
- Document expiration reminders -- future enhancement
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MAINT-01 | Tenant can submit maintenance request with issue type, description, and photos | File upload via formData(), maintenance requests + photos schema, multi-file upload component |
| MAINT-02 | Tenant can track maintenance request status (submitted, acknowledged, in progress, resolved) | Status enum in schema, status display component, threaded comments |
| MAINT-03 | Admin can manage maintenance queue with filters by status, unit, and date | Kanban board with @hello-pangea/dnd, filter API with Drizzle query builders |
| DOC-01 | Tenant can upload documents with type and size validation | File type/size validation, document schema, upload handler with MIME checking |
| DOC-02 | Admin can request specific documents from tenants and view submissions | Document requests schema, admin request UI, tenant dashboard integration |
| TMGMT-01 | Tenant can manage own contact info (name, phone, email, emergency contact) | Better Auth user update, emergency contacts schema, email change verification |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 15.5 | App Router, API Route Handlers, Server Components | Already in project |
| drizzle-orm | 0.45.x | Database schema, queries, migrations | Already in project |
| @neondatabase/serverless | 1.0.x | PostgreSQL HTTP driver | Already in project |
| react-hook-form | 7.71.x | Form state management | Already in project |
| zod | 4.3.x | Schema validation | Already in project |
| @hookform/resolvers | 5.2.x | Zod resolver for react-hook-form | Already in project |
| lucide-react | 0.575.x | Icons | Already in project |
| sonner | 2.0.x | Toast notifications | Already in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @hello-pangea/dnd | 17.x | Drag-and-drop for kanban board | Admin maintenance queue -- maintained fork of react-beautiful-dnd |
| sharp | 0.33.x | Image thumbnail generation for photo previews | Optional -- can use CSS object-fit for initial implementation |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @hello-pangea/dnd | @dnd-kit/core | dnd-kit more flexible but more boilerplate; hello-pangea simpler for column-based kanban |
| @hello-pangea/dnd | react-beautiful-dnd | Original is unmaintained by Atlassian since 2023; hello-pangea is the community fork |
| Local file storage | S3/R2 | S3 better at scale but unnecessary for 5-unit property; user explicitly chose local |

**Installation:**
```bash
npm install @hello-pangea/dnd
npm install --save-dev @types/node  # already installed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/
│   ├── (tenant)/tenant/
│   │   ├── maintenance/
│   │   │   ├── page.tsx                 # List tenant's requests
│   │   │   ├── new/page.tsx             # Submit new request form
│   │   │   └── [id]/page.tsx            # Request detail with thread
│   │   ├── documents/
│   │   │   └── page.tsx                 # Tenant document uploads
│   │   └── profile/
│   │       └── page.tsx                 # Profile editing form
│   ├── (admin)/admin/
│   │   ├── maintenance/
│   │   │   ├── page.tsx                 # Kanban board
│   │   │   └── [id]/page.tsx            # Request detail view
│   │   └── documents/
│   │       └── page.tsx                 # Document requests + submissions
│   └── api/
│       ├── maintenance/
│       │   ├── route.ts                 # GET list, POST create
│       │   ├── [id]/route.ts            # GET detail, PATCH status
│       │   └── [id]/comments/route.ts   # GET/POST comments
│       ├── documents/
│       │   ├── route.ts                 # GET list, POST upload
│       │   ├── requests/route.ts        # POST admin request
│       │   └── [id]/route.ts            # GET download
│       ├── uploads/[...path]/route.ts   # Serve uploaded files
│       └── profile/route.ts             # GET/PATCH profile
├── components/
│   ├── tenant/
│   │   ├── MaintenanceRequestForm.tsx
│   │   ├── MaintenanceRequestList.tsx
│   │   ├── MaintenanceRequestDetail.tsx
│   │   ├── DocumentUpload.tsx
│   │   ├── DocumentList.tsx
│   │   └── ProfileForm.tsx
│   └── admin/
│       ├── MaintenanceKanban.tsx
│       ├── MaintenanceCard.tsx
│       ├── DocumentRequestForm.tsx
│       └── DocumentSubmissions.tsx
├── db/schema/
│   └── domain.ts                        # Add new tables here
└── lib/
    └── uploads.ts                       # File upload utilities
```

### Pattern 1: File Upload via Next.js Route Handler
**What:** Handle multipart form data uploads in API Route Handlers using built-in `formData()`.
**When to use:** Any file upload endpoint (photos, documents).
**Example:**
```typescript
// src/app/api/maintenance/route.ts
export async function POST(request: Request) {
  const formData = await request.formData()
  const files = formData.getAll("photos") as File[]
  const description = formData.get("description") as string

  for (const file of files) {
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const filename = `${crypto.randomUUID()}-${file.name}`
    const uploadPath = path.join(process.cwd(), "uploads", "maintenance", filename)
    await fs.mkdir(path.dirname(uploadPath), { recursive: true })
    await fs.writeFile(uploadPath, buffer)
  }
}
```

### Pattern 2: Local File Serving via API Route
**What:** Serve uploaded files through an API route rather than `public/` to enable auth checks.
**When to use:** Serving any uploaded file (maintenance photos, documents).
**Example:**
```typescript
// src/app/api/uploads/[...path]/route.ts
export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathSegments } = await params
  const filePath = path.join(process.cwd(), "uploads", ...pathSegments)

  // Verify path doesn't escape uploads directory (path traversal prevention)
  const resolvedPath = path.resolve(filePath)
  if (!resolvedPath.startsWith(path.resolve(process.cwd(), "uploads"))) {
    return new Response("Forbidden", { status: 403 })
  }

  const buffer = await fs.readFile(resolvedPath)
  const ext = path.extname(filePath).toLowerCase()
  const contentType = MIME_TYPES[ext] || "application/octet-stream"
  return new Response(buffer, {
    headers: { "Content-Type": contentType, "Cache-Control": "private, max-age=3600" },
  })
}
```

### Pattern 3: Kanban Board with @hello-pangea/dnd
**What:** Drag-and-drop kanban board with column-based layout.
**When to use:** Admin maintenance queue.
**Example:**
```typescript
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd"

function KanbanBoard({ requests }: { requests: MaintenanceRequest[] }) {
  const columns = groupByStatus(requests)

  async function onDragEnd(result: DropResult) {
    if (!result.destination) return
    const newStatus = result.destination.droppableId
    await fetch(`/api/maintenance/${result.draggableId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: newStatus }),
    })
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      {STATUS_COLUMNS.map((status) => (
        <Droppable key={status} droppableId={status}>
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps}>
              {columns[status]?.map((request, index) => (
                <Draggable key={request.id} draggableId={request.id} index={index}>
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>
                      <MaintenanceCard request={request} />
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      ))}
    </DragDropContext>
  )
}
```

### Pattern 4: Form with File Input and Preview
**What:** Multi-file upload with thumbnail preview before submission.
**When to use:** Maintenance request form, document upload.
**Example:**
```typescript
function PhotoUpload({ maxFiles = 5 }) {
  const [previews, setPreviews] = useState<{ file: File; url: string }[]>([])

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []).slice(0, maxFiles - previews.length)
    const newPreviews = files.map(file => ({
      file,
      url: URL.createObjectURL(file),
    }))
    setPreviews(prev => [...prev, ...newPreviews])
  }

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => previews.forEach(p => URL.revokeObjectURL(p.url))
  }, [previews])
}
```

### Anti-Patterns to Avoid
- **Storing files in `public/`:** Files in public/ are served without auth checks and persist across deployments. Use a separate `uploads/` directory with API-based serving.
- **Trusting client MIME type:** Always validate file signatures (magic bytes) server-side, not just the Content-Type header or file extension.
- **Unlimited file sizes in memory:** Use streaming or chunked reads for large files. Next.js Route Handlers buffer formData by default -- the 25MB limit is fine for this, but set `bodyParser` config.
- **Storing full file paths in DB:** Store relative paths from the uploads root, not absolute paths. Makes migration easier.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag-and-drop kanban | Custom drag handlers with mouse/touch events | @hello-pangea/dnd | Keyboard accessibility, scroll containers, mobile touch, animation -- hundreds of edge cases |
| File type detection | Checking file extension only | Magic bytes check + extension | Extensions can be renamed; magic bytes verify actual file type |
| UUID generation | Custom ID schemes | crypto.randomUUID() | Built into Node.js, cryptographically random, no dependency needed |
| Email verification | Custom token + email flow | Better Auth changeEmail | Better Auth handles token generation, email sending, and verification internally |

**Key insight:** The drag-and-drop kanban is the only genuinely complex UI in this phase. Everything else (forms, file uploads, CRUD) uses patterns already established in Phases 1-3.

## Common Pitfalls

### Pitfall 1: Next.js Body Size Limit for File Uploads
**What goes wrong:** File uploads fail silently or return 413 for files over 1MB.
**Why it happens:** Next.js Route Handlers have a default body size limit of 1MB in some configurations.
**How to avoid:** Export a route segment config with explicit body size limit:
```typescript
export const config = {
  api: { bodyParser: { sizeLimit: '25mb' } }
}
// Or for App Router:
export const maxDuration = 60 // seconds
```
For Next.js 15 App Router, the body size limit must be configured in `next.config.ts` using `experimental.serverActions.bodySizeLimit` or handled at the Route Handler level.
**Warning signs:** Uploads work for small files but fail for larger ones.

### Pitfall 2: @hello-pangea/dnd Requires Client Component
**What goes wrong:** Hydration errors or SSR failures with drag-and-drop.
**Why it happens:** DnD libraries use browser APIs (DOM measurements, event listeners) that don't exist during SSR.
**How to avoid:** Mark the kanban component with `"use client"` directive. Wrap in dynamic import with `ssr: false` if needed:
```typescript
const KanbanBoard = dynamic(() => import("@/components/admin/MaintenanceKanban"), { ssr: false })
```
**Warning signs:** "window is not defined" errors, hydration mismatch warnings.

### Pitfall 3: Path Traversal in File Serving
**What goes wrong:** Attacker requests `../../.env.local` through the uploads API.
**Why it happens:** URL path segments like `..` can escape the uploads directory.
**How to avoid:** Always resolve the final path and verify it starts with the uploads directory root:
```typescript
const resolved = path.resolve(filePath)
if (!resolved.startsWith(path.resolve(process.cwd(), "uploads"))) {
  return new Response("Forbidden", { status: 403 })
}
```
**Warning signs:** Any path that includes `..` or encoded variants (`%2e%2e`).

### Pitfall 4: HEIC Files Need Special Handling
**What goes wrong:** HEIC files from iPhones can't be displayed in browsers.
**Why it happens:** Most browsers don't support HEIC natively. Safari has limited support.
**How to avoid:** Accept HEIC for upload/storage but display a generic thumbnail or icon in the browser. Full HEIC-to-JPEG conversion requires `sharp` with libvips. For MVP, just show a file icon for HEIC and let users download.
**Warning signs:** Broken image thumbnails for iPhone photos.

### Pitfall 5: Better Auth changeEmail Requires Configuration
**What goes wrong:** Email change doesn't send verification or throws errors.
**Why it happens:** Better Auth's changeEmail requires `sendChangeEmailVerification` to be configured on the server.
**How to avoid:** Add the callback in the Better Auth config:
```typescript
emailAndPassword: {
  sendChangeEmailVerification: async ({ user, newEmail, url }) => {
    await resend.emails.send({
      from: "RentalMgmt <noreply@rentalmgmt.com>",
      to: newEmail,
      subject: "Verify your new email",
      html: `<p>Verify your new email: <a href="${url}">${url}</a></p>`,
    })
  },
}
```
**Warning signs:** Email change appears to succeed but email never changes.

## Code Examples

### Database Schema for Maintenance Requests
```typescript
// Maintenance requests with status progression
export const maintenanceRequests = pgTable("maintenance_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantUserId: text("tenant_user_id").notNull(),
  unitId: uuid("unit_id").references(() => units.id, { onDelete: "cascade" }).notNull(),
  category: text("category", {
    enum: ["plumbing", "electrical", "hvac", "appliance", "pest_control", "structural", "general"],
  }).notNull(),
  description: text("description").notNull(),
  status: text("status", {
    enum: ["submitted", "acknowledged", "in_progress", "resolved"],
  }).default("submitted").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
})

// Photos attached to maintenance requests
export const maintenancePhotos = pgTable("maintenance_photos", {
  id: uuid("id").primaryKey().defaultRandom(),
  requestId: uuid("request_id").references(() => maintenanceRequests.id, { onDelete: "cascade" }).notNull(),
  filePath: text("file_path").notNull(),       // relative path from uploads root
  fileName: text("file_name").notNull(),       // original filename
  fileSize: integer("file_size").notNull(),    // bytes
  mimeType: text("mime_type").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

// Threaded comments on maintenance requests
export const maintenanceComments = pgTable("maintenance_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  requestId: uuid("request_id").references(() => maintenanceRequests.id, { onDelete: "cascade" }).notNull(),
  userId: text("user_id").notNull(),            // can be tenant or admin
  content: text("content").notNull(),
  isStatusChange: boolean("is_status_change").default(false).notNull(),  // true for system-generated status change notes
  createdAt: timestamp("created_at").defaultNow().notNull(),
})
```

### Database Schema for Documents
```typescript
// Tenant documents (uploaded files)
export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantUserId: text("tenant_user_id").notNull(),
  documentType: text("document_type", {
    enum: ["government_id", "proof_of_income_insurance", "general"],
  }).notNull(),
  filePath: text("file_path").notNull(),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size").notNull(),
  mimeType: text("mime_type").notNull(),
  requestId: uuid("request_id"),              // links to admin request if this was requested
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

// Admin document requests
export const documentRequests = pgTable("document_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantUserId: text("tenant_user_id").notNull(),
  documentType: text("document_type", {
    enum: ["government_id", "proof_of_income_insurance", "general"],
  }).notNull(),
  message: text("message"),                     // optional admin note
  status: text("status", {
    enum: ["pending", "submitted"],
  }).default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  fulfilledAt: timestamp("fulfilled_at"),
})
```

### Database Schema for Emergency Contacts
```typescript
// Emergency contacts for tenants (separate table for clean normalization)
export const emergencyContacts = pgTable("emergency_contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().unique(),   // one emergency contact per tenant
  contactName: text("contact_name").notNull(),
  contactPhone: text("contact_phone").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})
```

### File Upload Utility
```typescript
// src/lib/uploads.ts
import { promises as fs } from "fs"
import path from "path"
import crypto from "crypto"

const UPLOADS_DIR = path.join(process.cwd(), "uploads")

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg", "image/png", "image/heic", "image/heif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
])

const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25MB

export async function saveUploadedFile(
  file: File,
  subdirectory: string,
): Promise<{ filePath: string; fileName: string; fileSize: number; mimeType: string }> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File too large: ${file.size} bytes (max ${MAX_FILE_SIZE})`)
  }
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error(`Unsupported file type: ${file.type}`)
  }

  const ext = path.extname(file.name) || ""
  const safeName = `${crypto.randomUUID()}${ext}`
  const relPath = path.join(subdirectory, safeName)
  const fullPath = path.join(UPLOADS_DIR, relPath)

  await fs.mkdir(path.dirname(fullPath), { recursive: true })
  const bytes = await file.arrayBuffer()
  await fs.writeFile(fullPath, Buffer.from(bytes))

  return {
    filePath: relPath,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type,
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| multer middleware | Next.js formData() native | Next.js 13+ | No external middleware needed for file uploads |
| react-beautiful-dnd | @hello-pangea/dnd | 2023 | Drop-in replacement, actively maintained |
| Custom email verification | Better Auth changeEmail | Better Auth 1.x | Built-in flow handles verification tokens |
| express.static | API Route file serving | Next.js 13+ | Auth-gated file serving through Route Handlers |

**Deprecated/outdated:**
- react-beautiful-dnd: Unmaintained since Atlassian archived in 2023. Use @hello-pangea/dnd (same API)
- multer: Express middleware, not needed with Next.js App Router formData()

## Open Questions

1. **Better Auth changeEmail exact API**
   - What we know: Better Auth supports email changes with verification
   - What's unclear: The exact client-side API call and whether it requires additional plugin configuration beyond the callback
   - Recommendation: Check Better Auth docs during implementation; if changeEmail is complex, implement as simple server-side user update with manual verification email

2. **Next.js 15 body size limit for uploads**
   - What we know: Next.js App Router handles formData natively; previous versions had limits
   - What's unclear: Whether Next.js 15.5 has a default body parser limit that needs overriding for 25MB uploads
   - Recommendation: Test with a large file early in implementation; add `next.config.ts` override if needed

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright 1.58.x (E2E) |
| Config file | playwright.config.ts |
| Quick run command | `npx playwright test e2e/maintenance.spec.ts --headed=false` |
| Full suite command | `npx playwright test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MAINT-01 | Tenant submits maintenance request with photos | E2E | `npx playwright test e2e/maintenance.spec.ts -g "submit request"` | Wave 0 |
| MAINT-02 | Tenant views request status and thread | E2E | `npx playwright test e2e/maintenance.spec.ts -g "track status"` | Wave 0 |
| MAINT-03 | Admin manages maintenance queue | E2E | `npx playwright test e2e/admin-maintenance.spec.ts` | Wave 0 |
| DOC-01 | Tenant uploads document with validation | E2E | `npx playwright test e2e/documents.spec.ts -g "upload document"` | Wave 0 |
| DOC-02 | Admin requests document, tenant fulfills | E2E | `npx playwright test e2e/documents.spec.ts -g "document request"` | Wave 0 |
| TMGMT-01 | Tenant updates profile info | E2E | `npx playwright test e2e/profile.spec.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run build` (type-check + build)
- **Per wave merge:** `npx playwright test` (full E2E suite)
- **Phase gate:** Full suite green before verification

### Wave 0 Gaps
- [ ] `e2e/maintenance.spec.ts` -- covers MAINT-01, MAINT-02
- [ ] `e2e/admin-maintenance.spec.ts` -- covers MAINT-03
- [ ] `e2e/documents.spec.ts` -- covers DOC-01, DOC-02
- [ ] `e2e/profile.spec.ts` -- covers TMGMT-01

## Sources

### Primary (HIGH confidence)
- Project codebase analysis: schema patterns, auth config, route structure, component patterns from Phases 1-3
- Next.js 15 App Router: formData() in Route Handlers is the standard pattern for file uploads
- Drizzle ORM: pgTable definition patterns match existing project code

### Secondary (MEDIUM confidence)
- @hello-pangea/dnd: Community-maintained fork of react-beautiful-dnd with same API surface
- Better Auth changeEmail: Documented in Better Auth docs, exact configuration needs verification during implementation

### Tertiary (LOW confidence)
- Next.js 15.5 body size limits: May need runtime testing to confirm default limits for file uploads

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in project or well-established community packages
- Architecture: HIGH - follows exact patterns from Phases 1-3 (route groups, API routes, Drizzle schema)
- Pitfalls: HIGH - well-known issues with file uploads, path traversal, DnD SSR
- File upload handling: MEDIUM - Next.js 15 specifics for large file uploads may need runtime validation

**Research date:** 2026-02-26
**Valid until:** 2026-03-26 (30 days - stable stack)
