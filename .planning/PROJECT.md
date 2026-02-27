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
- ✓ Structured maintenance requests (issue type, description, photos, admin kanban) — Phase 4
- ✓ Document uploads (ID/proof docs and admin request workflow) — Phase 4
- ✓ Tenant contact info management (name, phone, email, emergency contact) — Phase 4
- ✓ Admin portal with full tenant/payment/request management — Phase 4
- ✓ Notifications via email, SMS, and in-app (reminders, inbox, admin broadcast) — Phase 5

### Active

<!-- Current scope. Building toward these. -->

- [ ] Ledger-based financial model with charges table, running balances, partial payments, and automated late fees
- [ ] Webhook hardening — strict Stripe intent ID matching for ACH settlements and partial payment edge cases
- [ ] S3-compatible cloud storage migration for maintenance photos and documents (replace local uploads/)
- [ ] Edge-level role authorization in JWT/middleware for instant admin route rejection
- [ ] Timezone-aware CRON job for rent reminders (property-local timezone)
- [ ] Admin API route protection audit
- [ ] Full property and unit CRUD from admin dashboard (create, update, archive)
- [ ] Tenant move-out workflow (end dates, cancel autopay, past-tenant view with read-only history)
- [ ] Tenant unit transfer support (move between units in same building)
- [ ] Self-service invite token entry on tenant empty-state dashboard
- [ ] Admin UX overhaul: persistent sidebar, KPI dashboard, polished empty states
- [ ] Mobile-first responsive polish across all tenant and admin views
- [ ] Vendor assignment for maintenance tickets with limited-view sharing
- [ ] Work order cost tracking tied to property expenses

### Out of Scope

- Lease management/e-signatures — tenants are month-to-month, no leases for now
- Role-based admin permissions — all team members get full access for now
- Mobile native apps — web-first, responsive design instead

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
- **Zero Regression**: v2.0 must not break existing Stripe Checkout, Better Auth sessions, Twilio SMS, or autopay flows

## Current Milestone: v2.0 Production-Ready

**Goal:** Elevate from functional MVP to enterprise-grade property management platform — financial integrity, security hardening, portfolio management, tenant lifecycle workflows, and professional admin UX.

**Target features:**
- Ledger-based financial model (charges, balances, late fees)
- S3 cloud storage replacing local file uploads
- Edge-level JWT role authorization
- Full property/unit CRUD and tenant lifecycle management
- Professional admin UI with sidebar navigation and KPI dashboard
- Vendor management and work order cost tracking

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
| Local file storage | uploads/ directory with API-based auth-gated serving, UUID filenames | ✓ Phase 4 |
| @hello-pangea/dnd for kanban | Drag-and-drop maintenance status management for admin | ✓ Phase 4 |
| Better Auth changeEmail | Email changes via auth client, not profile API — separation of concerns | ✓ Phase 4 |
| Twilio for SMS | TCPA-compliant with platform-level STOP handling, A2P 10DLC registration | ✓ Phase 5 |
| System crontab for reminders | Daily curl to CRON_SECRET-protected API route — simpler than BullMQ/Redis | ✓ Phase 5 |
| Multi-channel sendNotification | Single dispatch helper routes to in-app, email, and SMS based on user prefs | ✓ Phase 5 |

---
*Last updated: 2026-02-26 after milestone v2.0 initialization*
