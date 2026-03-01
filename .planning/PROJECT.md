# RentalMgmt

## What This Is

A self-hosted property management portal for a 5-unit residential building. Tenants pay rent online, submit maintenance requests, upload documents, and manage contact info. Admin portal provides full visibility into payments, ledger balances, maintenance, vendor work orders, and tenant lifecycle. Production-hardened with financial integrity guarantees, DST-proof date math, and session-validated security.

## Core Value

Tenants can pay rent online and the landlord can see who's paid — replacing scattered, informal payment methods with one organized system.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

- ✓ Multi-user admin access (full permissions for all team members) — v1.0
- ✓ Tenant onboarding via QR code (scan → create account → linked to unit) — v1.0
- ✓ Rent payment through Stripe with multiple payment methods — v1.0
- ✓ Per-unit rent amounts and due dates (fully variable) — v1.0
- ✓ Payment tracking dashboard (who's paid, who hasn't) — v1.0
- ✓ Structured maintenance requests (issue type, description, photos, admin kanban) — v1.0
- ✓ Document uploads (ID/proof docs and admin request workflow) — v1.0
- ✓ Tenant contact info management (name, phone, email, emergency contact) — v1.0
- ✓ Admin portal with full tenant/payment/request management — v1.0
- ✓ Notifications via email, SMS, and in-app (reminders, inbox, admin broadcast) — v1.0
- ✓ Autopay enrollment for recurring rent payments — v1.0
- ✓ Ledger-based financial model with charges, running balances, manual adjustments — v2.0
- ✓ Webhook hardening with strict payment intent ID matching and event deduplication — v2.0
- ✓ S3-compatible cloud storage for maintenance photos and documents — v2.0
- ✓ Edge-level role authorization in JWT/middleware — v2.0
- ✓ Timezone-aware operations (reminders, late fees, autopay) — v2.0
- ✓ Property/unit CRUD and tenant move-out workflow — v2.0
- ✓ Admin KPI dashboard, persistent sidebar, mobile-responsive layout — v2.0
- ✓ Vendor directory, work order assignment, magic link sharing, cost tracking — v2.0
- ✓ NSF fees, proration, chargeback handling, pending balance UX — v2.0
- ✓ Balance-based late fee assessment (closes partial payment loophole) — v2.1
- ✓ UPSERT webhook handlers for ACH race condition resilience — v2.1
- ✓ DST-proof date math with Date.UTC() and boundary tests — v2.1
- ✓ Session-validated tenant middleware (rejects revoked/expired sessions) — v2.1

### Active

<!-- Current scope. Building toward these. -->

(No active requirements — next milestone not yet defined)

### Out of Scope

- Lease management/e-signatures — tenants are month-to-month, no leases
- Role-based admin permissions — small team, everyone gets full access
- Mobile native apps — responsive web-first, 90% of benefit at 10% cost
- Full double-entry accounting / GL — use QuickBooks or CSV export
- Security deposit management — complex state-specific legal requirements
- Vendor portal with login — magic link limited-view is sufficient
- Real-time chat / two-way messaging — structured maintenance requests cover 90% of needs

## Context

Shipped through v2.1 Production Hardening. 16 phases, 73 plans across 3 milestones.
Tech stack: Next.js 15.5, Better Auth, Drizzle ORM, Neon PostgreSQL, Stripe, Resend, Twilio, shadcn/ui, Tailwind v4.
60+ unit tests, 12 e2e specs. Zero known critical bugs.

Known pre-existing tech debt:
- `postNsfFee` TypeScript type mismatch in src/lib/nsf.ts (Phase 13, runtime correct)
- No vercel.json cron schedule for /api/cron/late-fees (Phase 9, needs external scheduler)

## Constraints

- **Payments**: Stripe — tenant pays rent through Stripe with multiple payment method support
- **Budget**: Minimize hosting/operational costs — this replaces expensive SaaS
- **Scale**: 5 units now, architecture should accommodate growth without major rewrites

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| QR code onboarding | Tenants are unreachable, physical letters with QR code | ✓ v1.0 |
| Stripe Checkout (redirect) | Simplest PCI compliance, handles ACH + card | ✓ v1.0 |
| Webhook-first confirmation | Never trust redirects as payment proof | ✓ v1.0 |
| Twilio for SMS | TCPA-compliant with platform-level STOP handling | ✓ v1.0 |
| System crontab for reminders | Daily curl to CRON_SECRET-protected API route | ✓ v1.0 |
| Charges table (single-entry ledger) | Separates what's owed from what's paid | ✓ v2.0 |
| Neon WebSocket driver for transactions | Enables atomic multi-table operations | ✓ v2.0 |
| Balance-based late fee eligibility | Check getTenantBalance(), not payment existence | ✓ v2.1 |
| UPSERT for ACH webhooks | INSERT ON CONFLICT DO UPDATE prevents stuck payments | ✓ v2.1 |
| Date.UTC() for day math | Eliminates DST off-by-one in daysSinceRentDue | ✓ v2.1 |
| auth.api.getSession() for all routes | Full session validation, not just cookie existence | ✓ v2.1 |

---
*Last updated: 2026-03-01 after v2.1 milestone completion*
