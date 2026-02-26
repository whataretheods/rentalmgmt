# Roadmap: RentalMgmt

## Overview

Six phases, each unlocking the next. The build order is dependency-driven: auth and data model first, then the QR onboarding flow that gets tenants into the system, then the core payment and dashboard capability that delivers the product's entire reason for existence. Maintenance, documents, and contact management follow once the tenant account foundation is proven. Full multi-channel notification infrastructure ships next as a discrete phase requiring TCPA compliance work that should not be rushed. Autopay closes the loop on the payment experience once the core payment flow has been validated in production.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - Auth, data model, and admin bootstrap — every other phase depends on this
- [ ] **Phase 2: Tenant Onboarding** - QR invite flow linking tenants to their units before any other tenant feature can be tested
- [ ] **Phase 3: Payments** - Stripe rent collection and admin payment dashboard — the core product value
- [ ] **Phase 4: Maintenance, Documents, and Profiles** - Tenant self-service workflows after the payment core is validated
- [ ] **Phase 5: Notifications and Messaging** - Full multi-channel notification infrastructure with TCPA-compliant SMS
- [ ] **Phase 6: Autopay and Polish** - Recurring payments and UX refinements after core flows are production-validated

## Phase Details

### Phase 1: Foundation
**Goal**: A working application with secure auth, a complete data model, and a barebones admin interface — the prerequisite for every other feature
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-05
**Success Criteria** (what must be TRUE):
  1. A tenant can create an account with email and password and land on their portal
  2. A logged-in user's session persists across browser refresh and tab close/reopen
  3. A user who forgot their password can reset it via an emailed link and regain access
  4. Multiple admin users can each log in to the admin portal and see the same data with full access
  5. Accessing any tenant or admin route while unauthenticated redirects to the login page
**Plans**: 6 plans

Plans:
- [x] 01-01-PLAN.md — Next.js scaffold, all packages, Drizzle + Neon client, domain schema
- [ ] 01-02-PLAN.md — Better Auth config, schema generation, API route, database migrations
- [ ] 01-03-PLAN.md — Middleware + route group layouts with session/role guards
- [ ] 01-04-PLAN.md — Auth UI pages (login, register, forgot-password, reset-password)
- [ ] 01-05-PLAN.md — Admin users page, UserTable, admin seed script, property seed script
- [ ] 01-06-PLAN.md — Human verification checkpoint: full auth flow end to end

### Phase 2: Tenant Onboarding
**Goal**: A tenant who has never used the portal can scan a QR code from a physical letter, create an account, and be linked to their unit — no manual admin steps required
**Depends on**: Phase 1
**Requirements**: AUTH-04
**Success Criteria** (what must be TRUE):
  1. Admin can generate a unique per-unit invite token and download or print a QR code
  2. Tenant scans QR code, is taken directly to account creation pre-associated with their unit
  3. After completing account creation, tenant is linked to the correct unit automatically
  4. The invite link becomes invalid after one use — a second scan shows an error, not a registration form
  5. An invite link that has expired (past 30 days) shows a clear expiry message
**Plans**: 4 plans

Plans:
- [ ] 02-01-PLAN.md — inviteTokens schema, token/QR utilities, Better Auth after-signup hook, DB migration
- [ ] 02-02-PLAN.md — Admin invite management API routes and UI page
- [ ] 02-03-PLAN.md — Tenant invite landing page and invite-aware registration form
- [ ] 02-04-PLAN.md — End-to-end Playwright verification and human verification checkpoint

### Phase 3: Payments
**Goal**: Tenants can pay rent online via Stripe and the admin can see at a glance who has paid and who hasn't — the complete core value proposition
**Depends on**: Phase 2
**Requirements**: PAY-01, PAY-02, PAY-03, PAY-04, PAY-05, NOTIF-02
**Success Criteria** (what must be TRUE):
  1. Tenant can pay rent via Stripe using ACH or card and receive a payment confirmation
  2. Tenant can view their full payment history and download a receipt for any past payment
  3. Tenant's portal shows their current balance, next due date, and most recent payment
  4. Admin can set a different rent amount and due date for each unit individually
  5. Admin's payment dashboard shows per-unit paid/unpaid status for the current period at a glance
  6. Tenant receives an email confirmation immediately after a successful payment
**Plans**: TBD

### Phase 4: Maintenance, Documents, and Profiles
**Goal**: Tenants can manage their contact info, submit and track maintenance requests, and upload documents — completing the full tenant self-service experience
**Depends on**: Phase 1
**Requirements**: MAINT-01, MAINT-02, MAINT-03, DOC-01, DOC-02, TMGMT-01
**Success Criteria** (what must be TRUE):
  1. Tenant can submit a maintenance request with issue type, description, and photos attached
  2. Tenant can check the current status of their open maintenance requests (submitted, acknowledged, in progress, resolved)
  3. Admin can view all maintenance requests in a queue and filter by status, unit, or date
  4. Tenant can upload a document (ID, proof doc, ad-hoc file) with type and size validation that rejects unsupported formats
  5. Admin can request a specific document from a tenant and see when the tenant has submitted it
  6. Tenant can update their own name, phone, email, and emergency contact at any time
**Plans**: TBD

### Phase 5: Notifications and Messaging
**Goal**: The system proactively notifies tenants and admins via email, SMS, and in-app channels — with automated rent reminders and admin broadcast capability
**Depends on**: Phase 3
**Requirements**: NOTIF-01, NOTIF-03, NOTIF-04, NOTIF-05
**Success Criteria** (what must be TRUE):
  1. Tenant receives automated rent reminder emails 3-5 days before due date, on the due date, and when overdue
  2. Tenant who has opted in to SMS receives the same reminders by text with a working STOP opt-out
  3. Tenant and admin can open a notification inbox in the app and see a chronological list of recent notifications
  4. Admin can compose and send a bulk message to all tenants (or specific units) via email and SMS from the admin portal
**Plans**: TBD

### Phase 6: Autopay and Polish
**Goal**: Tenants can enroll in automatic recurring rent payments — removing the need to remember to pay each month
**Depends on**: Phase 3
**Requirements**: PAY-06
**Success Criteria** (what must be TRUE):
  1. Tenant can enroll a saved payment method in autopay and see their enrollment status on their dashboard
  2. Tenant can cancel their autopay enrollment at any time and immediately stop future automatic charges
  3. Tenant receives a notification before each autopay charge fires so they are not surprised
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

Note: Phase 4 depends on Phase 1 (not Phase 3) — it can start in parallel with Phase 3, but conventionally follows Phase 3 to avoid splitting focus.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 6/6 | Complete | - |
| 2. Tenant Onboarding | 2/4 | In Progress | - |
| 3. Payments | 0/TBD | Not started | - |
| 4. Maintenance, Documents, and Profiles | 0/TBD | Not started | - |
| 5. Notifications and Messaging | 0/TBD | Not started | - |
| 6. Autopay and Polish | 0/TBD | Not started | - |
