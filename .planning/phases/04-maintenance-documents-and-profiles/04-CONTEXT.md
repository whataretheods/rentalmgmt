# Phase 4: Maintenance, Documents, and Profiles - Context

**Gathered:** 2026-02-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Tenant self-service workflows: submit and track maintenance requests with photos, upload documents (ID, proof docs, general), manage contact info (name, phone, email, emergency contact). Admin side: kanban board for maintenance queue, document request workflow, view tenant profiles.

Requirements: MAINT-01, MAINT-02, MAINT-03, DOC-01, DOC-02, TMGMT-01

</domain>

<decisions>
## Implementation Decisions

### Maintenance Request Flow
- Issue categories: Plumbing, Electrical, HVAC, Appliance, Pest Control, Structural, General/Other
- Multi-photo upload: up to 5 photos per request, drag-drop or click to browse, thumbnail preview before submit
- 4-stage status progression: Submitted → Acknowledged → In Progress → Resolved
- Threaded comments: both tenant and admin can add comments/updates to a request thread

### Document Management
- Document types: Government ID, Proof of Income/Insurance, General/Other — each with appropriate labels
- Storage: local uploads directory on the server (simple, no extra cost, can migrate to S3 later)
- File limits: 25MB max per file, accept PDF, JPG, PNG, HEIC, Word docs, and common formats
- Admin document requests: admin selects tenant + doc type + optional message, tenant sees "Document Requested" on dashboard

### Profile Editing
- Editable fields: full name, phone number, email address, emergency contact (name + phone)
- Email changes require verification: send verification link to new email before updating

### Admin Request Queue
- Kanban board layout: cards organized by status columns (Submitted, Acknowledged, In Progress, Resolved)
- Drag cards between columns to update status
- Status updates include optional note that appears in the request thread

### Claude's Discretion
- Photo upload implementation (direct to server vs presigned URLs)
- Kanban board drag-and-drop library choice
- Emergency contact schema design
- Document request notification approach

</decisions>

<specifics>
## Specific Ideas

- Kanban board for maintenance — visual, intuitive for admin to see workload at a glance
- Threaded comments keep all communication about a request in one place
- Local file storage is appropriate for 5-unit scale — no need for S3 complexity yet

</specifics>

<deferred>
## Deferred Ideas

- Maintenance request notifications (email/SMS when status changes) — Phase 5
- Document expiration reminders — future enhancement

</deferred>

---

*Phase: 04-maintenance-documents-and-profiles*
*Context gathered: 2026-02-26*
