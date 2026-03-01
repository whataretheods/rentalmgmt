# Roadmap: RentalMgmt

## Milestones

- **v1.0 MVP** - Phases 1-6 (shipped 2026-02-26)
- **v2.0 Production-Ready** - Phases 7-14 (shipped 2026-02-28)
- **v2.1 Production Hardening** - Phases 15-16 (shipped 2026-03-01)

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

<details>
<summary>v2.1 Production Hardening (Phases 15-16) - SHIPPED 2026-03-01</summary>

- [x] **Phase 15: Financial Integrity & Concurrency** - Balance-based late fee assessment and idempotent webhook UPSERT for ACH race conditions (2026-02-28)
- [x] **Phase 16: Date Math & Security** - UTC-based day calculations with DST proof tests and session-validated tenant middleware (2026-03-01)

</details>

## Progress

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
| 16. Date Math & Security | v2.1 | 2/2 | Complete | 2026-03-01 |
