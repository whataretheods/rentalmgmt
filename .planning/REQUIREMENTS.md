# Requirements: RentalMgmt

**Defined:** 2026-02-25
**Core Value:** Tenants can pay rent online and the landlord can see who's paid — replacing scattered, informal payment methods with one organized system.

## v1 Requirements (Complete)

All v1 requirements shipped and validated during milestone v1.0.

### Authentication & Onboarding

- [x] **AUTH-01**: User can create tenant account with email and password
- [x] **AUTH-02**: User session persists across browser refresh
- [x] **AUTH-03**: User can reset password via email link
- [x] **AUTH-04**: Tenant can onboard by scanning QR code from physical letter, creating account, and being linked to their unit
- [x] **AUTH-05**: Multiple admin users can access the admin portal with full permissions

### Payments

- [x] **PAY-01**: Tenant can pay rent via Stripe (ACH and card)
- [x] **PAY-02**: Tenant can view payment history and download receipts
- [x] **PAY-03**: Tenant can see current balance, due date, and last payment
- [x] **PAY-04**: Admin can configure different rent amounts and due dates per unit
- [x] **PAY-05**: Admin can view payment dashboard showing who's paid and outstanding balances per unit
- [x] **PAY-06**: Tenant can enroll in autopay for automatic recurring rent payments

### Maintenance

- [x] **MAINT-01**: Tenant can submit maintenance request with issue type, description, and photos
- [x] **MAINT-02**: Tenant can track maintenance request status (submitted, acknowledged, in progress, resolved)
- [x] **MAINT-03**: Admin can manage maintenance queue with filters by status, unit, and date

### Documents

- [x] **DOC-01**: Tenant can upload documents (ID, proof docs, ad-hoc files) with type and size validation
- [x] **DOC-02**: Admin can request specific documents from tenants and view submissions

### Notifications

- [x] **NOTIF-01**: System sends automated payment reminders (3-5 days before, day-of, overdue)
- [x] **NOTIF-02**: System sends email notifications for payment confirmations, reminders, and request updates
- [x] **NOTIF-03**: System sends SMS notifications for urgent items with TCPA-compliant opt-in and STOP handling
- [x] **NOTIF-04**: Tenant and admin can view in-app notifications via notification inbox
- [x] **NOTIF-05**: Admin can send bulk messages to all tenants via email and SMS

### Tenant Management

- [x] **TMGMT-01**: Tenant can manage own contact info (name, phone, email, emergency contact)

## v2.0 Requirements

Requirements for milestone v2.0 — Production-Ready. Each maps to roadmap phases 7+.

### Financial Ledger

- [ ] **LEDG-01**: Tenant finances tracked via charges table separating what is owed (rent, late fees, one-time charges) from what was paid
- [ ] **LEDG-02**: Running balance computed per tenant and displayed on tenant dashboard ("You owe $X") and admin views
- [ ] **LEDG-03**: Admin can manually post charges, credits, and adjustments to any tenant's ledger
- [ ] **LEDG-04**: Existing historical payment records reconciled with charge records via backfill migration
- [ ] **LEDG-05**: Stripe webhook uses strict payment intent ID matching for ACH settlements and deduplicates events to prevent duplicate ledger entries

### Late Fees

- [ ] **LATE-01**: System automatically posts a late fee charge to the tenant ledger when rent is unpaid after a configurable grace period
- [ ] **LATE-02**: Admin can configure late fee rules per property (grace period days, flat or percentage fee, fee amount)
- [ ] **LATE-03**: Tenant receives notification (email/SMS/in-app) when a late fee is posted to their account

### Infrastructure & Security

- [ ] **INFRA-01**: Maintenance photos and documents stored in S3-compatible cloud storage with presigned URLs for upload and download
- [ ] **INFRA-02**: User role encoded in JWT so edge middleware can reject unauthorized /admin access without hitting application code
- [ ] **INFRA-03**: Rent reminders, late fee calculations, and autopay scheduling use property-local timezone instead of UTC
- [ ] **INFRA-04**: Database driver supports transactions (Neon WebSocket driver) for atomic multi-table operations
- [ ] **INFRA-05**: Cascade delete constraints replaced with soft-delete and ON DELETE RESTRICT to protect financial history

### Portfolio Management

- [ ] **PORT-01**: Admin can create, edit, and archive properties from the admin dashboard
- [ ] **PORT-02**: Admin can create, edit, and archive units with rent amount and due day configuration
- [ ] **PORT-03**: Admin can initiate tenant move-out workflow that sets end date, cancels autopay, posts final charges, and archives the tenancy
- [ ] **PORT-04**: Moved-out tenant retains read-only portal access to their payment and maintenance history

### Admin UX

- [ ] **AUX-01**: Admin portal uses persistent collapsible sidebar navigation across all admin pages
- [ ] **AUX-02**: Admin dashboard displays KPI metric cards (collection rate, total outstanding, occupancy rate, open maintenance requests, overdue tenants)
- [ ] **AUX-03**: All admin tables and lists show polished empty states with contextual guidance
- [ ] **AUX-04**: Admin layout is mobile-responsive with collapsible sidebar and touch-friendly targets

### Operations

- [ ] **OPS-01**: Admin can manage a vendor directory (name, trade/specialty, phone, email)
- [ ] **OPS-02**: Admin can assign a vendor to a maintenance request
- [ ] **OPS-03**: Assigned vendor receives email/SMS notification with a limited-view magic link showing request details and photos (no tenant PII)
- [ ] **OPS-04**: Admin can record labor and materials costs on work orders with per-unit expense rollup

### Tenant UX

- [ ] **TUX-01**: Tenant with no active unit can enter an invite token directly on their empty-state dashboard to self-associate with a unit

## v2.1 Requirements

Deferred to next milestone. Tracked but not in current roadmap.

### Tenant Lifecycle

- **TLIF-01**: Tenant can transfer between units in the same building preserving payment and maintenance history

### Payments

- **PAY-07**: Inline payment link in SMS reminders for direct pay without portal login

### Admin

- **ADMIN-01**: Admin can view chronological tenant activity feed (payments, requests, uploads)

### Multi-Property

- **MPROP-01**: Admin can manage multiple properties from a single dashboard

### Tenant Services

- **TSVC-01**: Tenant rent payments reported to credit bureaus for credit building

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Full double-entry accounting / GL | Separate domain — use QuickBooks or export CSV. Tenant ledger is single-entry. |
| Security deposit management | Complex state-specific legal requirements (CA: 21-day return, itemized deductions). Track offline. |
| Vendor portal with login | Overengineered for 2-3 vendors. Magic link limited-view is sufficient. |
| Automated prorated rent | Proration methods vary; admin posts manual charge for prorated amount. |
| Rent increase scheduling | Requires legal notice periods. Admin manually updates unit rent when change takes effect. |
| Tenant financial disputes | Adversarial workflow. Resolved via conversation; admin posts credits/adjustments. |
| Lease management / e-signatures | Month-to-month tenancy, no leases currently |
| Tenant screening / background checks | Tenants are already in the building |
| Vacancy advertising / listing syndication | No vacancies to fill; use Zillow/FB manually |
| Role-based admin permissions | Small team, everyone gets full access for now |
| Native mobile apps (iOS/Android) | Responsive web first; 90% of benefit at 10% cost |
| Real-time chat / two-way messaging | Structured maintenance requests cover 90% of needs |
| Multi-currency support | USD only. All properties US-based. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

### v1 (Complete)

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |
| AUTH-03 | Phase 1 | Complete |
| AUTH-04 | Phase 2 | Complete |
| AUTH-05 | Phase 1 | Complete |
| PAY-01 | Phase 3 | Complete |
| PAY-02 | Phase 3 | Complete |
| PAY-03 | Phase 3 | Complete |
| PAY-04 | Phase 3 | Complete |
| PAY-05 | Phase 3 | Complete |
| PAY-06 | Phase 6 | Complete |
| MAINT-01 | Phase 4 | Complete |
| MAINT-02 | Phase 4 | Complete |
| MAINT-03 | Phase 4 | Complete |
| DOC-01 | Phase 4 | Complete |
| DOC-02 | Phase 4 | Complete |
| NOTIF-01 | Phase 5 | Complete |
| NOTIF-02 | Phase 3 | Complete |
| NOTIF-03 | Phase 5 | Complete |
| NOTIF-04 | Phase 5 | Complete |
| NOTIF-05 | Phase 5 | Complete |
| TMGMT-01 | Phase 4 | Complete |

### v2.0 (Pending)

| Requirement | Phase | Status |
|-------------|-------|--------|
| LEDG-01 | — | Pending |
| LEDG-02 | — | Pending |
| LEDG-03 | — | Pending |
| LEDG-04 | — | Pending |
| LEDG-05 | — | Pending |
| LATE-01 | — | Pending |
| LATE-02 | — | Pending |
| LATE-03 | — | Pending |
| INFRA-01 | — | Pending |
| INFRA-02 | — | Pending |
| INFRA-03 | — | Pending |
| INFRA-04 | — | Pending |
| INFRA-05 | — | Pending |
| PORT-01 | — | Pending |
| PORT-02 | — | Pending |
| PORT-03 | — | Pending |
| PORT-04 | — | Pending |
| AUX-01 | — | Pending |
| AUX-02 | — | Pending |
| AUX-03 | — | Pending |
| AUX-04 | — | Pending |
| OPS-01 | — | Pending |
| OPS-02 | — | Pending |
| OPS-03 | — | Pending |
| OPS-04 | — | Pending |
| TUX-01 | — | Pending |

**Coverage:**
- v1 requirements: 22 total (all complete)
- v2.0 requirements: 26 total
- Mapped to phases: 0 (pending roadmap creation)
- Unmapped: 26

---
*Requirements defined: 2026-02-25*
*Last updated: 2026-02-26 after v2.0 milestone requirements definition*
