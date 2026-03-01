# Roadmap: RentalMgmt

## Milestones

- **v1.0 MVP** - Phases 1-6 (shipped 2026-02-26)
- **v2.0 Production-Ready** - Phases 7-14 (shipped 2026-02-28)
- **v2.1 Production Hardening** - Phases 15-16 (in progress)

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

<details>
<summary>v2.0 Production-Ready (Phases 7-14) - SHIPPED 2026-02-28</summary>

- [x] **Phase 7: Infrastructure Prerequisites** - Database transaction support, S3 cloud storage, edge auth, cascade safety, admin sidebar layout (2026-02-26)
- [x] **Phase 8: Financial Ledger Foundation** - Charges table, running balances, charge management, historical reconciliation, webhook hardening (2026-02-27)
- [x] **Phase 9: Automated Operations** - Late fee automation, configurable fee rules, timezone-aware scheduling, late fee notifications (2026-02-27)
- [x] **Phase 10: Portfolio Management & Tenant Lifecycle** - Property/unit CRUD, move-out workflow, past-tenant access, self-service invite entry (2026-02-27)
- [x] **Phase 11: Admin UX & KPI Dashboard** - KPI metric cards, polished empty states, mobile-responsive admin layout (2026-02-27)
- [x] **Phase 12: Vendor & Work Order Management** - Vendor directory, maintenance assignment, magic link sharing, cost tracking (2026-02-27)
- [x] **Phase 13: FinTech Polish & Edge Cases** - Date math fixes, pending balance UX, chargebacks, NSF fees, proration (2026-02-28)
- [x] **Phase 14: Audit Gap Closure** - Admin UI wiring, timezone config, KPI charges fix, nav and form enhancements (2026-02-28)

</details>

### v2.1 Production Hardening

- [x] **Phase 15: Financial Integrity & Concurrency** - Balance-based late fee assessment and idempotent webhook UPSERT for ACH race conditions (completed 2026-02-28)
- [x] **Phase 16: Date Math & Security** - UTC-based day calculations with DST proof tests and session-validated tenant middleware (completed 2026-03-01)

## Phase Details

<details>
<summary>v1.0 Phase Details (Phases 1-6)</summary>

### Phase 1: Foundation
**Goal**: Auth, data model, and admin bootstrap
**Plans**: 6/6 complete

### Phase 2: Tenant Onboarding
**Goal**: QR invite flow linking tenants to their units
**Plans**: 4/4 complete

### Phase 3: Payments
**Goal**: Stripe rent collection and admin payment dashboard
**Plans**: 6/6 complete

### Phase 4: Maintenance, Documents, and Profiles
**Goal**: Tenant self-service workflows
**Plans**: 6/6 complete

### Phase 5: Notifications and Messaging
**Goal**: Multi-channel notifications with TCPA-compliant SMS
**Plans**: 5/5 complete

### Phase 6: Autopay and Polish
**Goal**: Recurring payments and UX refinements
**Plans**: 6/6 complete

</details>

<details>
<summary>v2.0 Phase Details (Phases 7-14)</summary>

### Phase 7: Infrastructure Prerequisites
**Goal**: The application has a transaction-safe database layer, cloud file storage, edge-level role authorization, safe deletion constraints, and a persistent admin sidebar
**Requirements**: INFRA-01, INFRA-02, INFRA-04, INFRA-05, AUX-01
**Plans**: 4/4 complete

### Phase 8: Financial Ledger Foundation
**Goal**: Tenant finances are tracked through a proper ledger where charges (what is owed) are separated from payments (what was paid), with running balances visible to both tenants and admins
**Requirements**: LEDG-01, LEDG-02, LEDG-03, LEDG-04, LEDG-05
**Plans**: 5/5 complete

### Phase 9: Automated Operations
**Goal**: The system automatically assesses late fees when rent goes unpaid past a configurable grace period, all time-sensitive operations use property-local timezone, and tenants are notified when fees are posted
**Requirements**: LATE-01, LATE-02, LATE-03, INFRA-03
**Plans**: 4/4 complete

### Phase 10: Portfolio Management & Tenant Lifecycle
**Goal**: Admin can manage the full property portfolio and tenant lifecycle from the dashboard
**Requirements**: PORT-01, PORT-02, PORT-03, PORT-04, TUX-01
**Plans**: 6/6 complete

### Phase 11: Admin UX & KPI Dashboard
**Goal**: The admin dashboard surfaces key portfolio metrics at a glance and all admin interfaces are polished with proper empty states and mobile responsiveness
**Requirements**: AUX-02, AUX-03, AUX-04
**Plans**: 4/4 complete

### Phase 12: Vendor & Work Order Management
**Goal**: Admin can manage vendors, assign them to maintenance requests, share limited-view details via magic links, and track work order costs per unit
**Requirements**: OPS-01, OPS-02, OPS-03, OPS-04
**Plans**: 5/5 complete

### Phase 13: FinTech Polish & Edge Cases
**Goal**: Critical financial logic bugs are fixed and new operational workflows are implemented with comprehensive unit test coverage
**Requirements**: FIN-01, FIN-02, FIN-03, FIN-04, FIN-05, FIN-06
**Plans**: 4/4 complete

### Phase 14: Audit Gap Closure
**Goal**: All admin features are discoverable through navigation, configurable through UI controls, and reflected in the KPI dashboard
**Requirements**: INFRA-03, LEDG-03, LATE-02, OPS-02, FIN-04, AUX-02, OPS-04
**Plans**: 4/4 complete

</details>

### Phase 15: Financial Integrity & Concurrency
**Goal**: Late fees are assessed based on actual money owed (not payment existence) and ACH webhook processing is resilient to out-of-order delivery
**Depends on**: Phase 14 (v2.0 complete)
**Requirements**: HARD-01, HARD-02
**Success Criteria** (what must be TRUE):
  1. A tenant who makes a partial payment (e.g., $1 on a $1,500 balance) still receives a late fee when their remaining balance exceeds zero after the grace period -- the late fee cron checks getTenantBalance(), not "does any succeeded payment exist"
  2. When Stripe delivers ACH webhooks out of order (e.g., async_payment_succeeded arrives before checkout.session.completed finishes), the payment record is created or updated via UPSERT and never remains permanently stuck in "pending" status
  3. When Stripe delivers the same webhook event multiple times, no duplicate payment records or ledger entries are created (idempotency preserved through the UPSERT pattern)
**Plans**: 0/2

Plans:
- [ ] 15-01: Balance-based late fee assessment (HARD-01)
- [ ] 15-02: UPSERT webhook handlers for ACH race conditions (HARD-02)

### Phase 16: Date Math & Security
**Goal**: Day-difference calculations are immune to DST transitions and tenant routes reject invalid/expired sessions at the edge
**Depends on**: Phase 15
**Requirements**: HARD-03, HARD-04, HARD-05
**Success Criteria** (what must be TRUE):
  1. daysSinceRentDue uses Date.UTC() constructors so that a DST spring-forward (23-hour day) or fall-back (25-hour day) never produces an off-by-one day count
  2. Unit tests explicitly exercise DST spring-forward (March) and fall-back (November) date pairs and assert correct day counts across those boundaries
  3. A tenant with a revoked session, suspended account, or expired cookie is rejected by middleware when accessing any tenant route -- not just checked for cookie existence but validated against the session store
  4. If middleware session validation is not feasible at the edge, all tenant API routes are audited to confirm they independently call auth.api.getSession() and reject unauthorized requests
**Plans**: 2 plans

Plans:
- [ ] 16-01-PLAN.md — DST-proof daysSinceRentDue with Date.UTC() and DST boundary tests (HARD-03, HARD-04)
- [ ] 16-02-PLAN.md — Full session validation for tenant middleware (HARD-05)

## Progress

**Execution Order:**
Phases execute in numeric order: 15 -> 16

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 6/6 | Complete | 2026-02-25 |
| 2. Tenant Onboarding | v1.0 | 4/4 | Complete | 2026-02-25 |
| 3. Payments | v1.0 | 6/6 | Complete | 2026-02-26 |
| 4. Maintenance, Documents, and Profiles | v1.0 | 6/6 | Complete | 2026-02-26 |
| 5. Notifications and Messaging | v1.0 | 5/5 | Complete | 2026-02-26 |
| 6. Autopay and Polish | v1.0 | 6/6 | Complete | 2026-02-26 |
| 7. Infrastructure Prerequisites | v2.0 | 4/4 | Complete | 2026-02-26 |
| 8. Financial Ledger Foundation | v2.0 | 5/5 | Complete | 2026-02-27 |
| 9. Automated Operations | v2.0 | 4/4 | Complete | 2026-02-27 |
| 10. Portfolio Management & Tenant Lifecycle | v2.0 | 6/6 | Complete | 2026-02-27 |
| 11. Admin UX & KPI Dashboard | v2.0 | 4/4 | Complete | 2026-02-27 |
| 12. Vendor & Work Order Management | v2.0 | 5/5 | Complete | 2026-02-27 |
| 13. FinTech Polish & Edge Cases | v2.0 | 4/4 | Complete | 2026-02-28 |
| 14. Audit Gap Closure | v2.0 | 4/4 | Complete | 2026-02-28 |
| 15. Financial Integrity & Concurrency | v2.1 | 2/2 | Complete | 2026-02-28 |
| 16. Date Math & Security | 2/2 | Complete    | 2026-03-01 | - |
