# Project Research Summary

**Project:** RentalMgmt — Self-Hosted Property Management Portal
**Domain:** Small landlord tenant/landlord SaaS (5-unit residential building)
**Researched:** 2026-02-25
**Confidence:** MEDIUM-HIGH (stack HIGH, features/architecture/pitfalls MEDIUM)

## Executive Summary

RentalMgmt is a purpose-built, self-hosted property management portal for a single 5-unit residential building with month-to-month tenancies and no existing digital infrastructure. The domain is well-understood — commercial platforms like AppFolio, Buildium, and Innago cover the same feature space — but the project's scale and self-hosted nature means the right approach is a focused monolith, not a scaled SaaS. The recommended stack (Next.js 15.5 + Drizzle ORM + Neon PostgreSQL + Better Auth + Stripe) is a first-class, production-validated combination with official integrations between every component. The QR-code-first tenant onboarding is the single clearest differentiator: no commercial platform does it, it solves the cold-start problem for unreachable tenants, and it should be treated as a first-class feature rather than an afterthought.

The core architectural principle is: build two portals (tenant and admin) inside one Next.js app, separated by route groups and middleware-enforced role checks. The tenant portal is mobile-first and payment-centric. The admin portal is desktop-primary and dashboard-centric. Everything else — maintenance, documents, notifications — is secondary infrastructure that enhances the payment core. The build order is strictly dependency-driven: auth and data model first, onboarding second, payments third, then everything else. Deviation from this order creates rework.

The dominant risks are in the payment and onboarding surface. Three Stripe pitfalls (redirect-based payment confirmation, missing webhook idempotency, absent idempotency keys) can silently corrupt rent payment records and must be addressed architecturally, not as an afterthought. The QR onboarding token must be single-use and time-limited from the start — a static URL exposes the landlord to fraudulent unit claims. Cross-tenant data leakage (IDOR) must be enforced at the query layer, not the route layer. None of these are difficult to implement correctly if built right from the beginning; all are expensive to retrofit.

---

## Key Findings

### Recommended Stack

The stack is fully resolved with official integrations between all major components. Next.js 15.5 (App Router + Server Actions) eliminates the need for a separate API server. Drizzle ORM 0.45.x + Neon PostgreSQL is a first-class integration with near-zero overhead — critical for serverless deployment. Better Auth 1.4.x is the correct auth choice for new projects (the Auth.js team officially merged into Better Auth). Stripe handles all payment complexity including ACH. Resend + React Email covers transactional email. Twilio covers SMS. Cloudflare R2 (S3-compatible, no egress fees) handles file storage. No significant alternatives warrant further evaluation.

**Core technologies:**
- **Next.js 15.5 + React 19:** Full-stack framework — App Router, Server Actions, Server Components. Eliminates separate API server.
- **TypeScript 5.x:** Non-negotiable for a system handling payments and multi-user access.
- **Tailwind CSS 4.x + shadcn/ui:** CSS-first, zero-runtime component system. Admin dashboard and tenant portal templates available.
- **Neon PostgreSQL + Drizzle ORM 0.45.x:** Serverless Postgres with type-safe, zero-overhead ORM. First-class official integration.
- **Better Auth 1.4.x:** Auth.js successor. Plugin-based, built-in rate limiting, Drizzle adapter. New projects should use this, not Auth.js.
- **Stripe (stripe 20.3.x + @stripe/react-stripe-js):** Payment Element handles 100+ methods including ACH. All Stripe logic server-side only.
- **Resend + @react-email/components:** Transactional email via React templates. Free tier is sufficient for 5 units.
- **Twilio:** SMS notifications. $0.0083/SMS. No simpler alternative with equivalent control.
- **Cloudflare R2 + @aws-sdk/client-s3 v3:** Object storage for documents and maintenance photos. Zero egress fees vs. AWS S3.
- **Server-Sent Events (native):** In-app notifications. No third-party service needed for one-directional updates.
- **`qrcode` npm:** Server-side QR code generation for physical onboarding letters.

**Version constraints:**
- Use Next.js 15.5.x, not 16 (newly released, not yet battle-tested)
- Use Drizzle ORM 0.45.x stable, not 1.0 beta (breaking changes)
- `next lint` is deprecated in 15.5 — use ESLint CLI directly

See `.planning/research/STACK.md` for full installation commands and alternatives considered.

### Expected Features

The MVP is focused: get tenants into the system, collect rent digitally, and show the admin who has paid. Everything else is v1.x or later. The most important insight from feature research is the dependency structure: the tenant account system (auth + unit association) is the root dependency for every other feature. Per-unit rent configuration is the second critical dependency — without it, neither payments nor reminders work.

**Must have (v1 — table stakes):**
- QR code onboarding — solves the cold-start problem; unique differentiator; without it, no tenants enter the system
- Tenant account system — unit-to-tenant association, auth, profile
- Per-unit rent configuration — different amounts and due dates per unit (data stored at unit level, not property level)
- Online rent payment via Stripe — ACH + card; one-time payment first
- Admin payment dashboard — "who paid, who hasn't" per unit; core landlord value
- Payment history and balance view — eliminates "did my payment post?" support calls
- Contact info self-management — tenants update their own contact details
- Automated email notifications — payment confirmation, overdue notice

**Should have (v1.x — after core validated):**
- Autopay enrollment — Stripe SetupIntent + saved payment method
- Maintenance request submission + status tracking + admin queue
- Document upload (tenant-to-admin) — S3 presigned URL flow
- SMS notifications — Twilio; treat as first-class, not add-on
- Bulk admin messaging — building-wide announcements

**Defer (v2+):**
- Inline payment links in SMS (depends on SMS baseline)
- Admin tenant activity feed (overkill at 5 units)
- Multi-property UI (architecture supports it; no UI needed yet)
- Tenant credit reporting (high complexity, low immediate value)

**Explicitly out of scope (confirmed anti-features):**
- Lease e-signature (month-to-month tenancies)
- Tenant screening (in-place tenants)
- Full accounting/bookkeeping (separate product category)
- Vacancy advertising (no vacancies)
- Native iOS/Android apps (responsive web + PWA)
- Real-time chat (structured requests + messaging covers needs)

See `.planning/research/FEATURES.md` for full dependency graph and competitor analysis.

### Architecture Approach

A monolith is the correct architecture for this scale. One Next.js application with two route groups — `(tenant)` and `(admin)` — sharing a single Postgres database and middleware-enforced role separation. Business logic is centralized in a `lib/` service layer (plain TypeScript modules) called by both Server Actions (mutations) and Route Handlers (webhooks, presigned URLs). The service layer is not a framework abstraction — it's just functions, which makes it testable and reusable. This is not the architecture of a 500-unit SaaS; it is deliberately simple for the current scale and explicitly designed to accommodate future growth (multi-property) via a `propertyId` foreign key that exists in the schema now but drives no UI yet.

**Major components:**
1. **Middleware (`middleware.ts`)** — Auth check, role enforcement (TENANT vs. ADMIN), route guard at the edge
2. **Tenant Portal (`(tenant)/*`)** — Mobile-first; payment, maintenance, documents, profile; Server Components for data display, Client Components for interactive forms
3. **Admin Portal (`(admin)/*`)** — Desktop-primary; dashboard, tenant management, payment tracking, maintenance queue; Server Components + Drizzle queries
4. **Onboarding Flow (`/invite/[token]`)** — QR-linked invite token validation, account creation, unit linking, token consumption
5. **Service Layer (`lib/`)** — Domain logic: `payments.ts`, `maintenance.ts`, `notifications.ts`, `documents.ts`, `tenants.ts`, `invites.ts`
6. **Route Handlers (`/api/`)** — Stripe webhook receiver (must be Route Handler, not Server Action), presigned S3 URL generator
7. **Notification Service (`lib/notifications.ts`)** — Single unified dispatcher: Resend + Twilio + in-app DB record. All notification sends go through here — never scattered across actions.

**Key patterns:**
- Server-side pricing authority: client sends `unitId`, server fetches rent amount from DB — never trust client-provided amounts
- Webhook-first payment confirmation: payment state is set by webhook, not redirect
- Presigned URL uploads: client uploads directly to S3/R2; Next.js only generates the short-lived URL
- Two roles only (TENANT, ADMIN): no granular RBAC until concretely needed

See `.planning/research/ARCHITECTURE.md` for data model, data flow diagrams, and build order.

### Critical Pitfalls

Six critical pitfalls identified. All are preventable at design time and expensive to retrofit.

1. **Redirect-based payment confirmation** — Treating the Stripe `success_url` redirect as proof of payment. Browsers close before redirect; payment looks failed when it wasn't. Prevention: webhook-driven payment state from day one. `payment_intent.succeeded` fires the DB update. The redirect shows "processing."

2. **Webhook idempotency failures** — Stripe retries webhooks for 72 hours. Non-idempotent handlers create duplicate payment records and double-send notifications. Prevention: store `event.id` in DB on first receipt; check existence before processing; wrap event insert + business logic in a DB transaction.

3. **Missing Stripe idempotency keys** — Network timeouts cause Stripe to create multiple charges for the same rent payment when no idempotency key is set. Prevention: derive idempotency key from `tenant_id + unit_id + billing_period` on every Stripe write operation.

4. **Reusable QR onboarding links** — Static QR code URLs (e.g., `/onboard?unit=4`) allow anyone with the printed letter to claim a unit. Prevention: every QR code encodes a unique UUID token stored in DB with unit association, 30-day expiry, and single-use enforcement.

5. **Cross-tenant data leakage (IDOR)** — Authorization at route level but not resource level allows tenants to access other tenants' data by manipulating IDs. Prevention: every DB query for a tenant-owned resource must scope by `tenantId = currentUser.tenantId` — never look up by ID alone.

6. **SMS without TCPA consent tracking** — Sending SMS without explicit opt-in consent. After April 2025, violations start at $500/message. Prevention: collect SMS opt-in as a separate, affirmative step at onboarding; store consent status and timestamp in DB; handle STOP keywords via Twilio inbound webhook.

See `.planning/research/PITFALLS.md` for full technical debt patterns, integration gotchas, and "looks done but isn't" verification checklist.

---

## Implications for Roadmap

Based on the dependency graph from FEATURES.md and the build order from ARCHITECTURE.md, a 6-phase structure is recommended. The ordering is strict — each phase unlocks the next.

### Phase 1: Foundation — Auth, Data Model, and Admin Bootstrap

**Rationale:** Everything — payments, maintenance, documents, onboarding — depends on the data model and auth. This is the root dependency. No other phase can start without it.

**Delivers:** Working Next.js application with Drizzle schema (Property, Unit, User, roles), Better Auth session management, middleware route protection (tenant vs. admin), and a barebones admin interface to verify the data model works.

**Addresses:** Tenant account system prerequisite; per-unit rent configuration schema

**Avoids:** Cross-tenant data leakage — resource-level authorization scoping (`tenantId` filter) must be built into the data access layer here, not retrofitted later

**Research flag:** Standard patterns — Next.js App Router + Better Auth + Drizzle is a well-documented combination with official guides.

---

### Phase 2: Tenant Onboarding — QR Invite Flow

**Rationale:** Before any payments or maintenance requests can be tested, tenants must be in the system. The QR onboarding is also the project's primary differentiator and must work before any tenant-facing features can be validated end-to-end.

**Delivers:** Admin can generate per-unit invite tokens and print QR codes. Tenants can scan QR code, complete registration, and be linked to their unit. Invite tokens are single-use, time-limited, and consumed on account creation.

**Addresses:** QR code onboarding (P1 feature), tenant account system

**Avoids:** Reusable QR onboarding link vulnerability — token validation, expiry, and single-use enforcement must be built here

**Research flag:** Standard patterns for token-based onboarding. ARCHITECTURE.md includes a full implementation example.

---

### Phase 3: Payments — Stripe Integration and Admin Dashboard

**Rationale:** The core product value proposition is "tenants pay rent online, landlord sees who's paid." This is the highest-priority feature block. All three Stripe pitfalls (redirect confirmation, webhook idempotency, idempotency keys) must be addressed in this phase.

**Delivers:** Tenant can pay rent via Stripe (ACH + card). Admin sees per-unit payment status dashboard. Payment history and balance view for tenants. Automated email notifications for payment confirmation and overdue status. Stripe webhook handler with idempotency, signature verification, and DB transaction.

**Addresses:** Online rent payment (P1), admin payment dashboard (P1), payment history/balance (P1), email notifications (P1), per-unit rent configuration

**Avoids:**
- Redirect-based payment confirmation — webhook-first from the start
- Webhook idempotency failures — `event.id` deduplication in DB
- Missing idempotency keys — on every Stripe write
- Client-side payment amount — server fetches amount from DB, never from client

**Research flag:** Stripe webhook patterns are well-documented. Use PITFALLS.md "looks done but isn't" checklist as acceptance criteria for this phase.

---

### Phase 4: Maintenance and Documents

**Rationale:** These two features are independent of each other and can be built in parallel. They depend only on the tenant account system (Phase 1) and file storage infrastructure. Adds the second major tenant workflow after payments.

**Delivers:** Tenant can submit maintenance requests with photo uploads. Status states (submitted → acknowledged → in progress → resolved). Admin maintenance queue with filtering. Tenant receives status change notifications. Tenant can upload documents (ID, insurance). Admin document inbox.

**Addresses:** Maintenance request submission + tracking + admin queue (P2), document upload (P2)

**Avoids:**
- Routing file uploads through Next.js server — presigned S3/R2 URL pattern (client uploads directly)
- Public file URLs — all documents served via signed URLs with 15-minute expiry
- Unvalidated file types — MIME type allowlist (PDF, JPG, PNG, HEIC) before storage

**Research flag:** Presigned URL upload pattern is well-documented. S3/R2 configuration may need validation for the specific hosting environment.

---

### Phase 5: Notifications and Messaging

**Rationale:** Email notifications are built in Phase 3, but SMS and the full multi-channel notification infrastructure belongs here. Building the notification service as shared infrastructure (single `lib/notifications.ts`) before the features that depend on it is the correct architectural approach.

**Delivers:** SMS notifications via Twilio with TCPA consent tracking (opt-in at onboarding, STOP keyword handling). Automated rent reminders (3-5 days before due date, day-of, overdue). Bulk admin messaging (building-wide announcements to all or specific units). Multi-channel dispatch (email + SMS, not both simultaneously for same event).

**Addresses:** SMS notifications (P2), automated payment reminders (table stakes), bulk admin messaging (P2), multi-channel notifications

**Avoids:**
- SMS without TCPA consent tracking — `sms_opted_in` field + consent timestamp + inbound webhook for STOP
- Notification fatigue — one primary channel per event type, not simultaneous multi-channel blast
- Monolithic notification dispatch — all sends through `lib/notifications.ts`, never scattered across actions
- Email deliverability failure — SPF/DKIM/DMARC DNS records verified before first production email

**Research flag:** Twilio TCPA compliance configuration needs validation — specifically inbound webhook setup for STOP keyword handling and opt-out synchronization with DB.

---

### Phase 6: Autopay and Polish

**Rationale:** Autopay is a significant Stripe integration addition (SetupIntent + saved payment methods) that belongs after the core payment flow is validated in production. Polish items (mobile responsiveness, in-app notification feed, activity log) are refinements that should be deferred until the core workflows are confirmed working.

**Delivers:** Tenant can enroll in autopay (Stripe SetupIntent, saved payment method, tenant controls enrollment/cancellation). Mobile responsiveness refinement across all flows. In-app notification bell. Admin tenant activity feed (chronological event log). PWA "Add to Home Screen" prompt.

**Addresses:** Autopay enrollment (P2), admin activity feed (P3), mobile optimization

**Avoids:** Autopay Stripe integration complexity — Stripe SetupIntent flow is distinct from one-time payment flow; treat as a separate Stripe integration, not an extension of existing checkout

**Research flag:** Stripe Subscription vs. PaymentIntent-with-saved-method for autopay needs a decision during phase planning. Both are valid; the choice depends on whether rent amounts are fixed or variable per period.

---

### Phase Ordering Rationale

- **Foundation before features:** Every feature hangs off auth + data model. No shortcuts here.
- **Onboarding before payments:** You need real tenants in the system to test the payment flow end-to-end.
- **Payments before everything else:** The core value proposition. Prove this works before adding scope.
- **Maintenance and documents together:** Share the S3/R2 infrastructure. Independent of payments, so building them doesn't block or depend on Phase 3.
- **Notifications as infrastructure last:** Email is wired early (Phase 3). Full SMS + multi-channel is a discrete phase because it requires TCPA compliance infrastructure that should not be rushed.
- **Autopay deferred:** Requires the core payment flow to be validated in production first. Adding SetupIntent complexity to an unvalidated payment integration increases risk.

### Research Flags

**Phases needing deeper research during planning:**
- **Phase 3 (Payments):** Stripe Checkout Session vs. Payment Element decision. Checkout Sessions redirect to Stripe-hosted page (simpler, recommended for MVP); Payment Element embeds in your UI (more control, more complexity). Research which is appropriate before implementation begins.
- **Phase 5 (Notifications):** Twilio inbound webhook configuration for STOP handling. Need to validate the specific integration pattern with Twilio's Messaging Service API vs. raw phone number configuration.
- **Phase 6 (Autopay):** Stripe SetupIntent + saved payment method vs. Stripe Subscriptions. Both achieve autopay; the choice has billing model implications.

**Phases with standard patterns (research-phase can be skipped):**
- **Phase 1 (Foundation):** Next.js App Router + Better Auth + Drizzle is extensively documented with official guides.
- **Phase 2 (Onboarding):** Token-based invite pattern is well-documented; ARCHITECTURE.md includes a complete implementation example.
- **Phase 4 (Maintenance/Documents):** Presigned URL upload pattern is well-documented across multiple sources.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All technologies verified via official documentation and npm releases. Versions confirmed. Official integration guides exist between all major components (Drizzle + Neon, Better Auth + Drizzle, Resend + Next.js). |
| Features | MEDIUM | Web research with cross-referenced sources. No proprietary user research. Competitor feature analysis cross-referenced against multiple platforms. Feature dependencies and MVP definition are well-reasoned but untested against actual tenant behavior. |
| Architecture | MEDIUM | Patterns verified across multiple sources; consistent with official Next.js and Stripe documentation. Exact project structure is a synthesis, not a single canonical reference. Data model is standard relational property management design. |
| Pitfalls | MEDIUM | Stripe pitfalls sourced from official Stripe docs (HIGH confidence). TCPA/SMS compliance sourced from law firm + FCC rule (HIGH confidence). Security pitfalls consistent with OWASP. File storage and IDOR pitfalls extrapolated from adjacent domains. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Stripe Checkout Session vs. Payment Element:** Research recommends starting with Checkout Sessions (simpler, Stripe-hosted), but the product may want embedded payment UI (Payment Element). Decision needed in Phase 3 planning before implementation.
- **Autopay mechanism:** Stripe Subscriptions create a recurring billing schedule (Stripe controls timing). Stripe SetupIntent + saved payment method allows the app to initiate charges at the app-defined due date. For variable rent (different due dates per unit), SetupIntent is likely correct — but needs explicit decision.
- **Cloudflare R2 vs. AWS S3:** Stack recommends R2 (no egress fees). If the project deploys to AWS infrastructure, S3 may be simpler operationally. Same SDK, different endpoint config — low-risk decision but should be made before Phase 4.
- **Email deliverability:** Resend requires DNS record configuration (SPF/DKIM/DMARC) before first production email. This is an ops task, not a code task, but must be completed before Phase 3 goes live.
- **Notification preference storage:** The data model needs `notification_preferences` per tenant (email opt-in, SMS opt-in, channel preferences). This must be in the Phase 1 schema, even if the UI for managing preferences ships in Phase 5.

---

## Sources

### Primary (HIGH confidence)
- [Next.js 15.5 Official Blog](https://nextjs.org/blog/next-15-5) — Current stable version, Node.js middleware stable
- [Better Auth V1.0 Release](https://www.better-auth.com/v1) — Stable production release
- [Better Auth Blog — Auth.js Joins Better Auth](https://www.better-auth.com/blog/authjs-joins-better-auth) — Auth.js team recommends Better Auth for new projects
- [Neon Docs — Connect Drizzle to Neon](https://neon.com/docs/guides/drizzle) — Official first-class integration
- [Drizzle ORM — Get Started with Neon](https://orm.drizzle.team/docs/get-started/neon-new) — Official integration guide
- [Tailwind CSS v4.0 Release](https://tailwindcss.com/blog/tailwindcss-v4) — Stable January 2025
- [Stripe Payment Element Docs](https://docs.stripe.com/payments/payment-element) — Recommended payment UI approach
- [Stripe: Idempotent Requests](https://docs.stripe.com/api/idempotent_requests) — Idempotency key guidance
- [Stripe: ACH Direct Debit](https://docs.stripe.com/payments/ach-direct-debit) — ACH integration and failure rates
- [Resend + Next.js Docs](https://resend.com/docs/send-with-nextjs) — Official App Router integration
- [BCLP Law: TCPA New Opt-Out Rules April 2025](https://www.bclplaw.com/en-US/events-insights-news/the-tcpas-new-opt-out-rules-take-effect-on-april-11-2025-what-does-this-mean-for-businesses.html) — TCPA compliance requirements

### Secondary (MEDIUM confidence)
- [Stripe + Next.js 2025 architecture — Pedro Alonso](https://www.pedroalonso.net/blog/stripe-nextjs-complete-guide-2025/) — Stripe + Next.js patterns (verified against Stripe docs)
- [S3 Presigned URL pattern in Next.js](https://conermurphy.com/blog/presigned-urls-nextjs-s3-upload/) — Multiple sources agree on this pattern
- [Tenant Isolation in Multi-Tenant Systems — Security Boulevard](https://securityboulevard.com/2025/12/tenant-isolation-in-multi-tenant-systems-architecture-identity-and-security/) — IDOR prevention patterns
- [Stigg: Stripe Webhook Integration Best Practices](https://www.stigg.io/blog-posts/best-practices-i-wish-we-knew-when-integrating-stripe-webhooks) — Verified against Stripe official docs
- [Stripe How to Accept Rent Payments Online](https://stripe.com/resources/more/how-to-accept-rent-payments-online) — Rent payment integration patterns
- [Buildium: Tenant Portal Features](https://www.buildium.com/blog/tenant-portal-app-easy-for-rent-payments-and-maintenance/) — Competitor feature baseline

### Tertiary (LOW confidence — needs validation)
- [Renting Well: Data Security Risks in Property Management Software](https://rentingwell.com/2025/07/26/data-security-risks-in-property-management-software/) — Domain-specific security (single source)
- [Tenant Onboarding Innovation — riooapp.com](https://riooapp.com/blog/transforming-tenant-onboarding-innovative-solutions-for-smarter-property-management) — QR onboarding (single source; corroborated by competitor absence)

---
*Research completed: 2026-02-25*
*Ready for roadmap: yes*
