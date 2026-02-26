# RentalMgmt

## What This Is

A self-hosted property management portal for a 5-unit residential building. Tenants use the portal to pay rent, submit maintenance requests, upload documents, and manage their contact information. An admin portal gives the landlord and team full visibility into payments, requests, and tenant communications. Built as a personal alternative to expensive commercial solutions like AppFolio.

## Core Value

Tenants can pay rent online and the landlord can see who's paid — replacing scattered, informal payment methods with one organized system.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

- ✓ Multi-user admin access (full permissions for all team members) — Phase 1
- ✓ Tenant onboarding via QR code (scan → create account → linked to unit) — Phase 2
- ✓ Rent payment through Stripe with multiple payment methods — Phase 3
- ✓ Per-unit rent amounts and due dates (fully variable) — Phase 3
- ✓ Payment tracking dashboard (who's paid, who hasn't) — Phase 3

### Active

<!-- Current scope. Building toward these. -->

- [ ] Tenant contact info management (submit and update)
- [ ] Document uploads (ID/proof docs and general ad-hoc requests)
- [ ] Structured maintenance requests (issue type, description, photos)
- [ ] Admin portal with full tenant/payment/request management
- [ ] Notifications via email, SMS, and in-app
- [ ] Professional, polished tenant-facing experience

### Out of Scope

- Lease management/e-signatures — tenants are month-to-month, no leases for now
- Role-based admin permissions — all team members get full access for now
- Mobile native apps — web-first, responsive design instead
- Multi-property management — single building for now, architecture should allow growth later

## Context

- Recently purchased 5-unit residential building
- Many tenants haven't been reached yet — onboarding is critical first interaction
- Plan to send physical letters with QR codes for portal signup
- May need to send someone in person for tenant outreach
- Month-to-month tenancy, no leases
- Each unit has different rent amount and due date
- Commercial solutions (AppFolio, etc.) are too expensive for a 5-unit portfolio
- Portfolio might grow — more properties could be added down the road

## Constraints

- **Payments**: Stripe — tenant pays rent through Stripe with multiple payment method support
- **Budget**: Minimize hosting/operational costs — this replaces expensive SaaS
- **Scale**: 5 units now, architecture should accommodate growth without major rewrites

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| No leases/e-signatures | Month-to-month tenancy, keep it simple | — Pending |
| Flat admin access (no roles) | Small team, everyone needs full access | — Pending |
| QR code onboarding | Tenants are unreachable, physical letters with QR code is the outreach plan | — Pending |
| Stripe for payments | Industry standard, supports multiple payment methods | ✓ Phase 3 |
| Stripe Checkout (redirect) | Simplest PCI compliance, handles ACH + card | ✓ Phase 3 |
| Webhook-first confirmation | Never trust redirects as payment proof | ✓ Phase 3 |
| Manual payment recording | Admin can log cash/check/Venmo payments | ✓ Phase 3 |

---
*Last updated: 2026-02-26 after Phase 3*
