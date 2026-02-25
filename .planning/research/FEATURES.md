# Feature Research

**Domain:** Residential property management portal — small landlord (5-50 units)
**Researched:** 2026-02-25
**Confidence:** MEDIUM (web research, multiple sources cross-checked; no proprietary user research)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Online rent payment | 76% of renters prefer digital payment; paying via check/cash is the dominant reason tenants abandon portals | MEDIUM | ACH is 65% of digital rent payments; Stripe supports ACH ($5 cap) + card. Autopay is the tier-2 expectation after basic pay-now. |
| Payment history & receipts | Tenants need proof of payment for their own records; removes "did my payment go through?" support calls | LOW | Simple ledger view per tenant; timestamped transaction log. |
| Maintenance request submission | Industry-wide baseline; tenants expect digital requests over calling/texting | MEDIUM | Requires: issue type category, description, photo upload, confirmation of receipt. |
| Maintenance status tracking | Tenants follow up by phone/text when status is unknown; tracking eliminates that load | LOW | Status states: submitted → acknowledged → in progress → resolved. |
| Contact info self-management | Tenants update phone/email themselves vs. calling office; reduces admin overhead | LOW | Name, phone, email, emergency contact at minimum. |
| Automated payment reminders | 30-40% drop in late payments when reminders sent 3-5 days in advance; tenants expect it | LOW | Pre-due-date reminder (3-5 days before), day-of reminder, and overdue notice. |
| Account balance visibility | Tenants want to see what they owe before paying; reduces support questions | LOW | Current balance, due date, last payment date. |
| Admin payment dashboard | Landlord core need: "who has paid, who hasn't" — without this the portal has no value | MEDIUM | Per-unit payment status, payment date, outstanding balance view. |
| Admin maintenance queue | Manage all open requests in one place; without this admin must check per-tenant | MEDIUM | Filter by status, unit, date submitted. |
| Document upload (tenant-to-admin) | Needed for ID collection, proof of insurance, ad-hoc admin requests | LOW | File upload UI with file type/size validation; admin-side document inbox. |
| Multi-channel notifications | SMS has 98% open rate vs. email; tenants expect the channel of their choice | MEDIUM | Email, SMS (Twilio or similar), and in-app. Three channels are expected together, not individually. |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| QR code onboarding | Solves the cold-start problem: tenants who are hard to reach can self-register from a physical letter without an app install or typed URL | MEDIUM | Generate per-unit QR code → URL with unit pre-filled → guided signup flow. Differentiates from commercial platforms which assume tenants are already in the system. |
| Per-unit rent configuration | Most landlords have identical units; this building has different rent and due dates per unit. Commercial tools support this but it's often hidden in configuration. Making it first-class simplifies admin work. | LOW | Store rent amount + due date at unit level, not property level. Drive reminders and dashboard from these values. |
| Autopay enrollment | Once set up, zero landlord/tenant effort for recurring payments. Reduces late payments more than reminders alone. | MEDIUM | Stripe Subscription or PaymentIntent with saved payment method. Tenant controls enrollment/cancellation. |
| Photo-first maintenance requests | Tenants with a photo can submit in under 60 seconds from a phone. Reduces incomplete or vague requests that require back-and-forth. | LOW | Mobile-optimized camera upload in the maintenance form. Already part of some platforms but often poorly implemented. |
| Inline payment link in SMS reminder | Including a direct pay link in the reminder message converts reminder → payment without requiring the tenant to log in separately | LOW | Deep link to payment checkout from notification. Reduces friction significantly. |
| Admin tenant activity feed | Instead of a dashboard of aggregates, show a chronological log: "Unit 3 paid rent," "Unit 1 submitted a maintenance request." Easier to scan for a 5-unit building than charts. | LOW | Event log model is simpler to build than analytics and more actionable at small scale. |
| Bulk admin messaging | Send a notice to all tenants (building-wide maintenance, policy change, etc.) without texting each one individually | LOW | Admin composes message, selects recipients (all or per-unit), sends via email/SMS. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Lease e-signature | Tenants expect digital leases; landlords want paperless processes | This project is month-to-month with no leases. Building e-signature correctly requires DocuSign/HelloSign integration + audit trail + legal compliance per state. Significant scope for zero current value. | Explicitly out of scope per PROJECT.md. Revisit if tenancies formalize. |
| Tenant screening / background checks | Landlords want to vet applicants before onboarding | These tenants are already in the building. Screening is a pre-lease function. Adding it creates a second, separate workflow that conflicts with the onboarding QR flow. | Screen tenants offline; use portal only for post-move-in management. |
| Full accounting / bookkeeping | Landlords want one system for everything | Accounting (P&L, expense tracking, bank reconciliation, tax export) is a separate product with a separate data model. Mixing it in creates a monolith that's hard to maintain and the accounting surface is never good enough to replace QuickBooks anyway. | Track payment received/outstanding in the portal; export to accounting software separately. |
| Vacancy advertising / listing syndication | Fill vacancies faster | With 5 units and 0% vacancy focus, this is infrastructure with no current users. Multi-platform listing syndication (Zillow, Apartments.com) requires API partnerships and significant integration work. | Use free direct tools (Zillow, Facebook Marketplace) manually until vacancy is a recurring problem. |
| Role-based admin permissions | Separate permissions for owner vs. property manager vs. maintenance staff | Explicitly out of scope per PROJECT.md. Small team, everyone gets full access. Adding roles before roles are needed creates premature abstraction and UI complexity. | Flat admin access for now. Add roles when a second access tier is actually needed. |
| Native mobile apps (iOS/Android) | Tenants prefer apps; landlords want icon on home screen | Two separate codebases to maintain. PWA (progressive web app) or responsive web achieves 90% of the UX benefit with 10% of the maintenance cost. | Responsive web app. Add "Add to Home Screen" prompt. Ship native apps only when web is proven and portfolio grows. |
| Real-time chat / two-way messaging | Tenants and landlords want to message each other | Unbounded support channel that needs moderation, notification threading, and read receipts. Creates expectation of 24/7 responsiveness. Most property management platforms that add chat find it displaces—not reduces—phone calls. | Structured maintenance requests + admin bulk messaging covers 90% of legitimate communication needs. For urgent issues, phone is better. |
| Tenant credit building / rent reporting | Tenants want rent payments to count toward credit score | Requires partnership with credit bureaus (Experian RentBureau, etc.), compliance, and opt-in consent flows. High complexity, low immediate value for a 5-unit building. | Nice future differentiator; defer until portfolio is larger. |

---

## Feature Dependencies

```
QR Code Onboarding
    └──requires──> Tenant Account System (auth, unit association)
                       └──requires──> Unit/Property Data Model

Rent Payment
    └──requires──> Tenant Account System
    └──requires──> Stripe Integration
    └──requires──> Per-Unit Rent Configuration

Autopay
    └──requires──> Rent Payment (base Stripe integration)
    └──requires──> Saved Payment Methods (Stripe SetupIntent)

Payment Reminders
    └──requires──> Per-Unit Rent Configuration (due dates)
    └──requires──> Notification System (email/SMS)
    └──enhances──> Rent Payment (drives tenant to pay)

Admin Payment Dashboard
    └──requires──> Rent Payment (data to display)
    └──requires──> Per-Unit Rent Configuration (expected amounts)

Maintenance Request Submission
    └──requires──> Tenant Account System

Maintenance Status Tracking
    └──requires──> Maintenance Request Submission
    └──requires──> Admin Maintenance Queue (admin updates status)

Document Upload (Tenant)
    └──requires──> Tenant Account System
    └──requires──> File storage (S3 or equivalent)

Multi-channel Notifications
    └──requires──> Notification Service (Twilio for SMS, email provider)
    └──enhances──> Payment Reminders
    └──enhances──> Maintenance Status Tracking

Bulk Admin Messaging
    └──requires──> Multi-channel Notifications
    └──requires──> Tenant Account System (recipient list)

Inline Payment Link in Notifications
    └──requires──> Rent Payment
    └──requires──> Notification System
```

### Dependency Notes

- **Tenant Account System is the root dependency.** Everything else — payments, maintenance, documents — hangs off a tenant being associated with a specific unit. Build this first.
- **Per-Unit Rent Configuration unlocks both payments and reminders.** Without knowing what a unit owes and when, neither the payment flow nor automated reminders work correctly.
- **Stripe Integration gates the entire payment surface.** Autopay, payment history, payment reminders with links — all depend on Stripe being wired correctly first.
- **Notification System should be built as shared infrastructure.** Payment reminders, maintenance updates, and bulk messaging all use the same channels; build once, wire everywhere.
- **Document Upload and Maintenance Requests are independent.** These don't depend on each other and can be built in parallel.

---

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to validate the core value proposition ("tenants pay rent online, landlord sees who's paid").

- [ ] **QR code onboarding** — First interaction for unreachable tenants; without this, no one is in the system
- [ ] **Tenant account system** — Unit-to-tenant association, auth, profile (name, phone, email)
- [ ] **Per-unit rent configuration** — Different amounts and due dates per unit (required from day one)
- [ ] **Online rent payment via Stripe** — ACH + card; one-time payment first, autopay second
- [ ] **Payment history & balance view** — Tenant-facing; eliminates "did my payment post?" calls
- [ ] **Admin payment dashboard** — "Who paid, who hasn't" per unit; this is the core landlord value
- [ ] **Basic email notifications** — Payment confirmation, overdue notice; SMS can follow
- [ ] **Contact info management** — Tenant updates own contact details

### Add After Validation (v1.x)

Features to add once tenants are onboarded and core payment flow is confirmed working.

- [ ] **Autopay enrollment** — Add when tenants express interest in set-and-forget payments
- [ ] **Maintenance request submission + status tracking** — Add when the manual overhead of phone-based requests becomes painful
- [ ] **Document upload** — Add when admin needs to collect ID or proof docs at scale
- [ ] **SMS notifications** — Add when email open rates prove insufficient for reminders
- [ ] **Admin maintenance queue** — Add alongside maintenance request feature
- [ ] **Bulk admin messaging** — Add when a building-wide notice is needed

### Future Consideration (v2+)

Features to defer until portfolio grows or clear demand emerges.

- [ ] **Inline payment links in SMS** — Improves conversion; defer until SMS baseline is working
- [ ] **Admin tenant activity feed** — Useful when portfolio grows; overkill at 5 units
- [ ] **Multi-property support** — Architecture should accommodate it, but no UI needed yet
- [ ] **Tenant credit reporting** — High value for tenants but high integration complexity

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| QR code onboarding | HIGH | MEDIUM | P1 |
| Tenant account / auth | HIGH | MEDIUM | P1 |
| Per-unit rent config | HIGH | LOW | P1 |
| Online rent payment (Stripe) | HIGH | MEDIUM | P1 |
| Admin payment dashboard | HIGH | MEDIUM | P1 |
| Payment history / balance | HIGH | LOW | P1 |
| Contact info management | MEDIUM | LOW | P1 |
| Email notifications | HIGH | LOW | P1 |
| Autopay | HIGH | MEDIUM | P2 |
| Maintenance requests | HIGH | MEDIUM | P2 |
| Maintenance status tracking | MEDIUM | LOW | P2 |
| Document upload | MEDIUM | LOW | P2 |
| SMS notifications | HIGH | LOW | P2 |
| Admin maintenance queue | MEDIUM | LOW | P2 |
| Bulk admin messaging | MEDIUM | LOW | P2 |
| Inline payment links | MEDIUM | LOW | P3 |
| Admin activity feed | LOW | LOW | P3 |
| Multi-property UI | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch (v1)
- P2: Should have, add after core is validated (v1.x)
- P3: Nice to have, future consideration (v2+)

---

## Competitor Feature Analysis

| Feature | AppFolio | Buildium | TenantCloud | Innago (free) | Our Approach |
|---------|----------|----------|-------------|---------------|--------------|
| Online rent collection | Yes (ACH + card) | Yes, 1-2 day processing | Yes | Yes (free) | Stripe — ACH + card, we control the integration |
| Autopay | Yes | Yes | Yes | Yes | Build on Stripe Subscriptions; add in v1.x |
| Tenant portal | Yes | Yes | Yes | Yes | QR-code-first onboarding differentiates us |
| Maintenance requests | Yes (with vendor dispatch) | Yes | Yes | Yes | Simple form + photo upload; no vendor workflow needed at 5 units |
| Document storage | Yes | Yes | Yes (limited) | Yes (limited) | Upload to cloud storage (S3); admin inbox |
| SMS notifications | Yes (add-on) | Yes | Yes | No | Build with Twilio; treat as first-class, not add-on |
| Per-unit rent config | Yes (buried in setup) | Yes | Yes | Yes | First-class UI; different amount + due date per unit |
| Accounting / bookkeeping | Full | Full | Basic | Basic | Explicitly excluded; not competing here |
| Lease management | Full (e-sign) | Full (e-sign) | Yes | Yes | Explicitly excluded; month-to-month |
| Tenant screening | Yes | Yes | Yes | Yes | Explicitly excluded; tenants are in-place |
| Mobile app | Yes (iOS/Android) | Yes (iOS/Android) | Yes | Yes | Responsive web only; no native app |
| Vacancy listing / marketing | Yes | Yes | Yes | No | Explicitly excluded |
| QR code tenant onboarding | No | No | No | No | Unique to this project; key differentiator |
| Pricing model | $280/mo minimum | $55/mo minimum | $15-45/mo | Free (upsell) | Self-hosted; operational cost only |

---

## Sources

- [13 Best Property Management Software for Small Landlords — DoorLoop](https://www.doorloop.com/blog/small-landlord-property-management-software) (MEDIUM confidence — editorial, multiple platforms reviewed)
- [15 Best Landlord Software 2026 — Baselane](https://www.baselane.com/resources/15-best-landlord-software-platforms) (MEDIUM confidence)
- [Tenant Portal Features — Buildium Blog](https://www.buildium.com/blog/tenant-portal-app-easy-for-rent-payments-and-maintenance/) (MEDIUM confidence — vendor source, but specific feature detail)
- [Tenant Portal — Rentec Direct](https://www.rentecdirect.com/details/tenant-portal) (MEDIUM confidence — vendor source, specific feature enumeration)
- [How to Accept Rent Payments Online — Stripe](https://stripe.com/resources/more/how-to-accept-rent-payments-online) (HIGH confidence — official Stripe documentation)
- [ACH Payments for Rent 2026 — Baselane](https://www.baselane.com/resources/set-up-ach-payments-for-rent) (MEDIUM confidence)
- [Rent Reminder Best Practices — TurboTenant](https://www.turbotenant.com/rent-collection/rent-reminder/) (MEDIUM confidence — vendor source with cited statistics)
- [Property Management Technology Trends 2025 — Minut](https://www.minut.com/blog/property-management-technology-trends-2025) (MEDIUM confidence — industry overview)
- [AppFolio vs Buildium vs TenantCloud Comparison — Blankx](https://blankx.com/best-rental-property-management-software-compared-buildium-vs-appfolio-vs-tenantcloud/) (MEDIUM confidence — third-party comparison)
- [Tenant Onboarding — riooapp.com](https://riooapp.com/blog/transforming-tenant-onboarding-innovative-solutions-for-smarter-property-management) (LOW confidence — single source on onboarding innovation)

---

*Feature research for: Small landlord property management portal (5-unit residential)*
*Researched: 2026-02-25*
