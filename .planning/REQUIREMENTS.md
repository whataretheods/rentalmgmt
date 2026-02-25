# Requirements: RentalMgmt

**Defined:** 2026-02-25
**Core Value:** Tenants can pay rent online and the landlord can see who's paid — replacing scattered, informal payment methods with one organized system.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Authentication & Onboarding

- [ ] **AUTH-01**: User can create tenant account with email and password
- [ ] **AUTH-02**: User session persists across browser refresh
- [ ] **AUTH-03**: User can reset password via email link
- [ ] **AUTH-04**: Tenant can onboard by scanning QR code from physical letter, creating account, and being linked to their unit
- [ ] **AUTH-05**: Multiple admin users can access the admin portal with full permissions

### Payments

- [ ] **PAY-01**: Tenant can pay rent via Stripe (ACH and card)
- [ ] **PAY-02**: Tenant can view payment history and download receipts
- [ ] **PAY-03**: Tenant can see current balance, due date, and last payment
- [ ] **PAY-04**: Admin can configure different rent amounts and due dates per unit
- [ ] **PAY-05**: Admin can view payment dashboard showing who's paid and outstanding balances per unit
- [ ] **PAY-06**: Tenant can enroll in autopay for automatic recurring rent payments

### Maintenance

- [ ] **MAINT-01**: Tenant can submit maintenance request with issue type, description, and photos
- [ ] **MAINT-02**: Tenant can track maintenance request status (submitted, acknowledged, in progress, resolved)
- [ ] **MAINT-03**: Admin can manage maintenance queue with filters by status, unit, and date

### Documents

- [ ] **DOC-01**: Tenant can upload documents (ID, proof docs, ad-hoc files) with type and size validation
- [ ] **DOC-02**: Admin can request specific documents from tenants and view submissions

### Notifications

- [ ] **NOTIF-01**: System sends automated payment reminders (3-5 days before, day-of, overdue)
- [ ] **NOTIF-02**: System sends email notifications for payment confirmations, reminders, and request updates
- [ ] **NOTIF-03**: System sends SMS notifications for urgent items with TCPA-compliant opt-in and STOP handling
- [ ] **NOTIF-04**: Tenant and admin can view in-app notifications via notification inbox
- [ ] **NOTIF-05**: Admin can send bulk messages to all tenants via email and SMS

### Tenant Management

- [ ] **TMGMT-01**: Tenant can manage own contact info (name, phone, email, emergency contact)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

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
| Lease management / e-signatures | Month-to-month tenancy, no leases currently |
| Tenant screening / background checks | Tenants are already in the building |
| Full accounting / bookkeeping | Separate domain; use QuickBooks or export data |
| Vacancy advertising / listing syndication | No vacancies to fill; use Zillow/FB manually |
| Role-based admin permissions | Small team, everyone gets full access for now |
| Native mobile apps (iOS/Android) | Responsive web first; 90% of benefit at 10% cost |
| Real-time chat / two-way messaging | Structured maintenance requests cover 90% of needs |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 1 | Pending |
| AUTH-04 | Phase 2 | Pending |
| AUTH-05 | Phase 1 | Pending |
| PAY-01 | Phase 3 | Pending |
| PAY-02 | Phase 3 | Pending |
| PAY-03 | Phase 3 | Pending |
| PAY-04 | Phase 3 | Pending |
| PAY-05 | Phase 3 | Pending |
| PAY-06 | Phase 6 | Pending |
| MAINT-01 | Phase 4 | Pending |
| MAINT-02 | Phase 4 | Pending |
| MAINT-03 | Phase 4 | Pending |
| DOC-01 | Phase 4 | Pending |
| DOC-02 | Phase 4 | Pending |
| NOTIF-01 | Phase 5 | Pending |
| NOTIF-02 | Phase 3 | Pending |
| NOTIF-03 | Phase 5 | Pending |
| NOTIF-04 | Phase 5 | Pending |
| NOTIF-05 | Phase 5 | Pending |
| TMGMT-01 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 22 total
- Mapped to phases: 22
- Unmapped: 0

---
*Requirements defined: 2026-02-25*
*Last updated: 2026-02-25 after roadmap creation*
