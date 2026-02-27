# Roadmap: RentalMgmt

## Milestones

- **v1.0 MVP** - Phases 1-6 (shipped 2026-02-26)
- **v2.0 Production-Ready** - Phases 7-12 (in progress)

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

<details>
<summary>v1.0 MVP (Phases 1-6) - SHIPPED 2026-02-26</summary>

- [x] **Phase 1: Foundation** - Auth, data model, and admin bootstrap (2026-02-25)
- [x] **Phase 2: Tenant Onboarding** - QR invite flow linking tenants to their units (2026-02-25)
- [x] **Phase 3: Payments** - Stripe rent collection and admin payment dashboard (2026-02-26)
- [x] **Phase 4: Maintenance, Documents, and Profiles** - Tenant self-service workflows (2026-02-26)
- [x] **Phase 5: Notifications and Messaging** - Multi-channel notifications with TCPA-compliant SMS (2026-02-26)
- [x] **Phase 6: Autopay and Polish** - Recurring payments and UX refinements (2026-02-26)

</details>

### v2.0 Production-Ready

- [ ] **Phase 7: Infrastructure Prerequisites** - Database transaction support, S3 cloud storage, edge auth, cascade safety, admin sidebar layout
- [ ] **Phase 8: Financial Ledger Foundation** - Charges table, running balances, charge management, historical reconciliation, webhook hardening
- [ ] **Phase 9: Automated Operations** - Late fee automation, configurable fee rules, timezone-aware scheduling, late fee notifications
- [ ] **Phase 10: Portfolio Management & Tenant Lifecycle** - Property/unit CRUD, move-out workflow, past-tenant access, self-service invite entry
- [ ] **Phase 11: Admin UX & KPI Dashboard** - KPI metric cards, polished empty states, mobile-responsive admin layout
- [ ] **Phase 12: Vendor & Work Order Management** - Vendor directory, maintenance assignment, magic link sharing, cost tracking

## Phase Details

### Phase 7: Infrastructure Prerequisites
**Goal**: The application has a transaction-safe database layer, cloud file storage, edge-level role authorization, safe deletion constraints, and a persistent admin sidebar — removing all technical blockers before feature work begins
**Depends on**: Phase 6 (v1.0 complete)
**Requirements**: INFRA-01, INFRA-02, INFRA-04, INFRA-05, AUX-01
**Success Criteria** (what must be TRUE):
  1. Database operations can execute multi-table transactions atomically (e.g., inserting a charge and updating a related record either both succeed or both roll back)
  2. Newly uploaded maintenance photos and documents are stored in S3-compatible cloud storage and served via presigned URLs — existing local files continue to work via dual-read
  3. A non-admin user attempting to access any /admin route is rejected at the edge (middleware) before the page component loads
  4. Deleting or archiving a property or unit does not destroy any associated payment, charge, or maintenance history
  5. Every admin page displays a persistent collapsible sidebar navigation that maintains state across page transitions
**Plans**: TBD

### Phase 8: Financial Ledger Foundation
**Goal**: Tenant finances are tracked through a proper ledger where charges (what is owed) are separated from payments (what was paid), with running balances visible to both tenants and admins
**Depends on**: Phase 7
**Requirements**: LEDG-01, LEDG-02, LEDG-03, LEDG-04, LEDG-05
**Success Criteria** (what must be TRUE):
  1. Every financial obligation (monthly rent, one-time charge, credit, adjustment) exists as a distinct charge record in the ledger, separate from payment records
  2. Tenant dashboard displays a computed running balance ("You owe $X") reflecting all charges minus all payments, and admin views show the same per-tenant balance
  3. Admin can manually post a charge, credit, or adjustment to any tenant's ledger with a description, and it immediately updates their running balance
  4. All historical payment records from v1.0 have been reconciled with corresponding charge records via a validated backfill migration
  5. Stripe webhook processes ACH settlements and payment confirmations using strict payment intent ID matching, and duplicate webhook events do not create duplicate ledger entries
**Plans**: TBD

### Phase 9: Automated Operations
**Goal**: The system automatically assesses late fees when rent goes unpaid past a configurable grace period, all time-sensitive operations use property-local timezone, and tenants are notified when fees are posted
**Depends on**: Phase 8
**Requirements**: LATE-01, LATE-02, LATE-03, INFRA-03
**Success Criteria** (what must be TRUE):
  1. When a tenant's rent is unpaid after the configured grace period, the system automatically posts a late fee charge to their ledger without admin intervention
  2. Admin can configure late fee rules per property — grace period days, flat or percentage fee type, and fee amount — and can disable automatic late fees entirely (default: off)
  3. Tenant receives a notification (email, SMS, and/or in-app per their preferences) when a late fee is posted to their account
  4. Rent reminders, late fee calculations, and autopay scheduling all use the property's configured timezone — a tenant with rent due on the 1st is not charged late on December 31st at 7pm because the server runs in UTC
**Plans**: TBD

### Phase 10: Portfolio Management & Tenant Lifecycle
**Goal**: Admin can manage the full property portfolio and tenant lifecycle from the dashboard — creating properties and units, moving tenants out with proper financial reconciliation, and tenants can self-associate via invite tokens
**Depends on**: Phase 8
**Requirements**: PORT-01, PORT-02, PORT-03, PORT-04, TUX-01
**Success Criteria** (what must be TRUE):
  1. Admin can create, edit, and archive properties from the admin dashboard without developer intervention
  2. Admin can create, edit, and archive units within a property, including setting rent amount and due day
  3. Admin can initiate a tenant move-out that atomically sets an end date, cancels active autopay, posts any final charges, and archives the tenancy — no partial state is possible
  4. A moved-out tenant can still log in and view their payment history and maintenance request history in read-only mode
  5. A tenant with no active unit sees an empty-state dashboard where they can enter an invite token to self-associate with a unit
**Plans**: TBD

### Phase 11: Admin UX & KPI Dashboard
**Goal**: The admin dashboard surfaces key portfolio metrics at a glance and all admin interfaces are polished with proper empty states and mobile responsiveness
**Depends on**: Phase 8, Phase 10
**Requirements**: AUX-02, AUX-03, AUX-04
**Success Criteria** (what must be TRUE):
  1. Admin dashboard displays KPI metric cards showing collection rate, total outstanding balance, occupancy rate, open maintenance requests, and count of overdue tenants — with data derived from the live ledger
  2. Every admin table and list view shows a polished empty state with contextual guidance when no data exists (e.g., "No tenants yet — generate an invite to get started")
  3. Admin layout is fully usable on mobile devices — sidebar collapses to a hamburger menu and all interactive elements have touch-friendly tap targets
**Plans**: TBD

### Phase 12: Vendor & Work Order Management
**Goal**: Admin can manage vendors, assign them to maintenance requests, share limited-view details via magic links, and track work order costs per unit
**Depends on**: Phase 7, Phase 8
**Requirements**: OPS-01, OPS-02, OPS-03, OPS-04
**Success Criteria** (what must be TRUE):
  1. Admin can manage a vendor directory — adding, editing, and removing vendors with name, trade/specialty, phone, and email
  2. Admin can assign a vendor from the directory to any open maintenance request
  3. When a vendor is assigned, they receive an email/SMS notification with a magic link that shows the maintenance request details and photos without exposing any tenant personal information
  4. Admin can record labor and materials costs on a work order, and the system rolls up total maintenance expenses per unit
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 7 -> 8 -> 9 -> 10 -> 11 -> 12

Note: Phase 10 depends on Phase 8 (not Phase 9) — it can execute in parallel with Phase 9, but sequentially follows it to avoid splitting focus. Phase 11 depends on both Phase 8 and Phase 10 for ledger data and portfolio data respectively. Phase 12 depends on Phase 7 (S3 for receipt uploads) and Phase 8 (ledger for cost tracking).

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 6/6 | Complete | 2026-02-25 |
| 2. Tenant Onboarding | v1.0 | 4/4 | Complete | 2026-02-25 |
| 3. Payments | v1.0 | 6/6 | Complete | 2026-02-26 |
| 4. Maintenance, Documents, and Profiles | v1.0 | 6/6 | Complete | 2026-02-26 |
| 5. Notifications and Messaging | v1.0 | 5/5 | Complete | 2026-02-26 |
| 6. Autopay and Polish | v1.0 | 6/6 | Complete | 2026-02-26 |
| 7. Infrastructure Prerequisites | v2.0 | 0/TBD | Not started | - |
| 8. Financial Ledger Foundation | v2.0 | 0/TBD | Not started | - |
| 9. Automated Operations | v2.0 | 0/TBD | Not started | - |
| 10. Portfolio Management & Tenant Lifecycle | v2.0 | 0/TBD | Not started | - |
| 11. Admin UX & KPI Dashboard | v2.0 | 0/TBD | Not started | - |
| 12. Vendor & Work Order Management | v2.0 | 0/TBD | Not started | - |
