# Architecture Research

**Domain:** Tenant/Landlord Property Management Portal
**Researched:** 2026-02-25
**Confidence:** MEDIUM (patterns verified across multiple sources; no single authoritative spec for this exact domain)

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                         Browser (Client)                          │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────────┐  │
│  │  Tenant Portal │  │  Admin Portal  │  │  Onboarding Flow   │  │
│  │  /tenant/*     │  │  /admin/*      │  │  /invite/:token    │  │
│  └───────┬────────┘  └───────┬────────┘  └────────┬───────────┘  │
└──────────┼────────────────────┼─────────────────────┼────────────┘
           │                    │                     │
┌──────────▼────────────────────▼─────────────────────▼────────────┐
│                     Next.js App Router (Server)                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │                     Middleware Layer                          │ │
│  │  Auth check → Role check → Route guard → Tenant context      │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐   │
│  │Server Pages │  │Server       │  │  Route Handlers (API)   │   │
│  │& Components │  │Actions      │  │  /api/webhooks/stripe   │   │
│  │(RSC)        │  │(mutations)  │  │  /api/upload            │   │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘   │
│         │                │                      │                  │
│  ┌──────▼────────────────▼──────────────────────▼──────────────┐  │
│  │                     Service Layer                             │  │
│  │  payments.ts  |  maintenance.ts  |  notifications.ts         │  │
│  │  documents.ts |  tenants.ts      |  invites.ts               │  │
│  └──────────────────────────────┬────────────────────────────── ┘  │
└─────────────────────────────────┼──────────────────────────────────┘
                                  │
┌─────────────────────────────────▼──────────────────────────────────┐
│                          Data & External Layer                       │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────────┐   │
│  │  PostgreSQL  │  │  S3 / R2     │  │  External Services      │   │
│  │  (via Prisma)│  │  (documents  │  │  Stripe (payments)      │   │
│  │              │  │   & photos)  │  │  Resend (email)         │   │
│  │  All domain  │  │              │  │  Twilio (SMS)           │   │
│  │  data        │  │  File blobs  │  │                         │   │
│  └──────────────┘  └──────────────┘  └─────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Middleware | Auth verification, role enforcement, route guarding | Next.js `middleware.ts` + Auth.js/Better Auth session check |
| Tenant Portal | Rent payment UI, maintenance submission, document uploads, profile | Next.js Server Components + Client Components for interactive forms |
| Admin Portal | Dashboard, payment tracking, tenant management, request management | Server Components for data display, Client for filters/modals |
| Onboarding Flow | QR-linked invite token → account creation → profile setup | Multi-step Server Action flow with invite token in DB |
| Service Layer | Business logic isolated from HTTP concerns | Plain TypeScript modules, imported by Server Actions and Route Handlers |
| Route Handlers | Stripe webhook receiver, file upload presigned URL generator | `app/api/*/route.ts` — must be Route Handlers, not Server Actions (Stripe requires static URL) |
| Notification Service | Multi-channel dispatch (email/SMS/in-app) | Unified service function that dispatches to Resend + Twilio based on user preferences |

## Recommended Project Structure

```
src/
├── app/                         # Next.js App Router pages
│   ├── (tenant)/                # Route group — tenant-facing
│   │   ├── dashboard/           # Overview, upcoming rent
│   │   ├── payments/            # Pay rent, payment history
│   │   ├── maintenance/         # Submit/track requests
│   │   ├── documents/           # Upload/view documents
│   │   └── profile/             # Contact info management
│   ├── (admin)/                 # Route group — admin-facing
│   │   ├── dashboard/           # Payment overview
│   │   ├── tenants/             # Tenant list, profiles
│   │   ├── payments/            # Payment history, tracking
│   │   ├── maintenance/         # Request queue
│   │   └── notifications/       # Send announcements
│   ├── invite/
│   │   └── [token]/             # QR code onboarding entry point
│   ├── auth/                    # Login, password reset
│   └── api/
│       ├── webhooks/
│       │   └── stripe/          # Stripe webhook handler
│       └── upload/              # Presigned URL generator for S3
│
├── components/                  # Shared UI components
│   ├── ui/                      # shadcn/ui primitives
│   ├── tenant/                  # Tenant-specific components
│   ├── admin/                   # Admin-specific components
│   └── shared/                  # Used by both portals
│
├── lib/                         # Service layer (business logic)
│   ├── payments.ts              # Stripe session creation, payment queries
│   ├── maintenance.ts           # Request CRUD, status transitions
│   ├── notifications.ts         # Multi-channel dispatch
│   ├── documents.ts             # S3 presigned URL generation, DB record
│   ├── tenants.ts               # Tenant/unit management
│   ├── invites.ts               # Token generation, validation, expiry
│   └── db.ts                    # Prisma client singleton
│
├── actions/                     # Next.js Server Actions
│   ├── payment-actions.ts       # Initiate checkout, cancel payment
│   ├── maintenance-actions.ts   # Submit request, update status
│   ├── document-actions.ts      # Confirm upload, delete document
│   ├── tenant-actions.ts        # Update profile, onboarding
│   └── notification-actions.ts  # Admin-triggered sends
│
└── middleware.ts                # Auth + role enforcement at edge
```

### Structure Rationale

- **Route groups `(tenant)` / `(admin)`:** Separate layouts, nav, and auth checks without URL segments. Tenant and admin live at distinct URLs with shared middleware enforcing roles.
- **`lib/` service layer:** Business logic isolated from Next.js primitives. Server Actions and Route Handlers call `lib/` functions — makes logic testable and reusable across both.
- **`actions/` separate from `lib/`:** Server Actions are Next.js-specific (tied to forms, `use server` directive). Pure business logic stays in `lib/` and is framework-agnostic.
- **Route Handlers only for webhooks and presigned URLs:** Stripe webhook requires a static POST URL (Server Actions can't be used here). File uploads use presigned URLs — the Route Handler generates the URL, S3 handles the actual transfer.

## Architectural Patterns

### Pattern 1: Server-Side Pricing Authority

**What:** All payment amounts are computed server-side only. The client never sends a dollar amount — it sends intent (e.g., "pay rent for unit 3A"). The server looks up the rent amount from the database and passes it to Stripe.

**When to use:** Every payment initiation.

**Trade-offs:** Slightly more DB queries per payment flow; prevents any client-side amount manipulation. Worth it unconditionally for payments.

**Example:**
```typescript
// actions/payment-actions.ts
"use server"
export async function initiateRentPayment(unitId: string) {
  const session = await getAuthSession()
  if (!session?.user) throw new Error("Unauthorized")

  // Amount comes from DB, never from client
  const unit = await prisma.unit.findUniqueOrThrow({
    where: { id: unitId, tenantId: session.user.tenantId }
  })

  const stripeSession = await stripe.checkout.sessions.create({
    line_items: [{ price_data: {
      currency: "usd",
      unit_amount: unit.rentAmountCents, // Server truth
      product_data: { name: `Rent — Unit ${unit.number}` }
    }, quantity: 1 }],
    metadata: { unitId, tenantId: session.user.tenantId },
    success_url: `${process.env.NEXT_PUBLIC_URL}/payments/success`,
    cancel_url: `${process.env.NEXT_PUBLIC_URL}/payments`,
    mode: "payment"
  })

  redirect(stripeSession.url!)
}
```

### Pattern 2: Webhook-First Payment Confirmation

**What:** Payment success is confirmed via Stripe webhook, not via redirect. The `success_url` redirect shows a "payment processing" state. The webhook fires the actual DB update and sends the confirmation notification.

**When to use:** All Stripe payment flows.

**Trade-offs:** Slight UX latency (tenant sees "processing" briefly before confirmation appears); eliminates any possibility of recording payment without actual Stripe confirmation. Worth the tradeoff.

**Example:**
```typescript
// app/api/webhooks/stripe/route.ts
export async function POST(req: Request) {
  const body = await req.text()
  const sig = req.headers.get("stripe-signature")!

  const event = stripe.webhooks.constructEvent(
    body, sig, process.env.STRIPE_WEBHOOK_SECRET!
  )

  // Idempotency: skip if already processed
  const existing = await prisma.payment.findUnique({
    where: { stripeSessionId: event.id }
  })
  if (existing) return new Response("OK")

  if (event.type === "checkout.session.completed") {
    const sess = event.data.object
    await prisma.$transaction([
      prisma.payment.create({ data: {
        stripeSessionId: sess.id,
        unitId: sess.metadata.unitId,
        tenantId: sess.metadata.tenantId,
        amountCents: sess.amount_total!,
        paidAt: new Date()
      }}),
    ])
    await notifyPaymentReceived(sess.metadata.tenantId)
  }

  return new Response("OK")
}
```

### Pattern 3: Token-Based Invite Onboarding

**What:** Admin generates invite tokens per unit (stored in DB with unit association, expiry, and used status). QR code encodes `/invite/[token]`. Tenant scans → arrives at onboarding page → completes registration → token consumed and tenant linked to unit.

**When to use:** Initial tenant setup; re-invite if tenant loses access.

**Trade-offs:** Tokens expire (must regenerate for abandoned onboards); requires admin to manage invite lifecycle. Much simpler than email-only flows for tenants who may have unreliable email access.

**Example:**
```typescript
// Schema (Prisma)
model InviteToken {
  id        String   @id @default(cuid())
  token     String   @unique @default(cuid())
  unitId    String
  unit      Unit     @relation(fields: [unitId], references: [id])
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime @default(now())
}

// lib/invites.ts
export async function validateAndConsumeInvite(token: string) {
  const invite = await prisma.inviteToken.findUnique({ where: { token }, include: { unit: true } })
  if (!invite) throw new Error("Invalid invite")
  if (invite.usedAt) throw new Error("Invite already used")
  if (invite.expiresAt < new Date()) throw new Error("Invite expired")
  return invite
}
```

### Pattern 4: Presigned URL File Upload

**What:** Client requests a presigned PUT URL from the server. Client uploads directly to S3/R2. Server records the file metadata in the DB only after client confirms success. Avoids routing large files through Next.js server.

**When to use:** All document and photo uploads.

**Trade-offs:** Two-step flow (get URL, then upload, then confirm); requires handling the case where upload succeeds but confirmation fails. Worth it — routing uploads through Next.js adds latency and memory pressure.

**Example:**
```typescript
// app/api/upload/route.ts
export async function POST(req: Request) {
  const { filename, contentType, category } = await req.json()
  const key = `${category}/${crypto.randomUUID()}-${filename}`

  const command = new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key, ContentType: contentType })
  const url = await getSignedUrl(s3Client, command, { expiresIn: 60 })

  return Response.json({ uploadUrl: url, key })
}
```

## Data Flow

### Request Flow

```
Tenant submits maintenance request
    ↓
Client form (Client Component) → Server Action (maintenance-actions.ts)
    ↓
Server Action validates session → calls lib/maintenance.ts
    ↓
lib/maintenance.ts → prisma.maintenanceRequest.create()
    ↓
lib/notifications.ts → Resend (email to admin) + Twilio (SMS to admin)
    ↓
Revalidate admin dashboard cache → UI reflects new request
```

### Stripe Payment Flow

```
Tenant clicks "Pay Rent"
    ↓
Server Action: initiateRentPayment(unitId)
    ↓
Fetch rent amount from DB → Create Stripe Checkout Session
    ↓
Redirect to Stripe (external)
    ↓
Tenant completes payment on Stripe
    ↓
Stripe POSTs to /api/webhooks/stripe
    ↓
Verify signature → Record payment → Notify tenant + admin
    ↓
Tenant's success_url page polls or revalidates → shows confirmed
```

### Document Upload Flow

```
Tenant selects file
    ↓
Client POSTs to /api/upload (filename, contentType, category)
    ↓
Server generates presigned S3 URL + stores pending record
    ↓
Client PUTs file directly to S3 using presigned URL
    ↓
Client confirms to Server Action: confirmUpload(key)
    ↓
Server Action marks document as active in DB
    ↓
Admin notified of new document (if required)
```

### Notification Flow

```
Trigger event (payment received, request submitted, etc.)
    ↓
lib/notifications.ts: notifyEvent(tenantId, eventType, data)
    ↓
Load tenant preferences + contact info from DB
    ↓
Dispatch in parallel:
  → Resend: send transactional email
  → Twilio: send SMS (if phone number on file)
  → DB: insert in-app notification record
    ↓
In-app notification visible on next page load (Server Component refresh)
```

### Key Data Flows

1. **Invite → Onboarding:** Token in URL → validate token → create user account → link user to unit → mark token used → redirect to tenant dashboard
2. **Admin payment view:** Query payments join units join tenants → grouped by unit → shows paid/unpaid status for current period
3. **Maintenance photo upload:** Presigned URL per photo → client uploads photos → confirm with request submission in single Server Action

## Data Model (Core Entities)

```
Property
  └── Unit (1:many)
        ├── InviteToken (1:many — for onboarding)
        ├── TenantUnit (current + historical tenancies)
        │     └── User (tenant)
        ├── Payment (1:many)
        └── MaintenanceRequest (1:many)
              └── MaintenancePhoto (1:many)

User
  ├── role: TENANT | ADMIN
  ├── Contact info (phone, email)
  └── Document (1:many — uploaded files)

Notification (in-app log)
  └── User (recipient)
```

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 5 units / ~10 users | Monolith is correct. Single Next.js app, single Postgres DB, no queue needed. Stripe webhooks handle async. |
| 50 units / ~100 users | Same architecture. Add DB connection pooling (PgBouncer or Prisma Accelerate). Add basic DB indexes on tenantId, unitId, paidAt. |
| 500+ units / 1000+ users | Consider background job queue (BullMQ or similar) for notifications instead of inline dispatch. Add read replicas. Admin dashboard may need pagination on all list views. |
| Multi-property | Add `Property` entity above `Unit`. Auth middleware routes admin to correct property scope. Tenant stays isolated to their unit. |

### Scaling Priorities

1. **First bottleneck:** Stripe webhook processing — if high volume, move webhook handler to a queue so retries don't hammer DB.
2. **Second bottleneck:** Admin dashboard queries — add DB indexes early on `payments.paidAt`, `payments.unitId`, `maintenanceRequests.status`.

## Anti-Patterns

### Anti-Pattern 1: Client-Side Payment Amount

**What people do:** Pass the payment amount from the React form to the Server Action or API route.

**Why it's wrong:** Any user can intercept and modify the POST body to pay $0.01 instead of $1,500. This is a security failure, not just a bug.

**Do this instead:** Server Action receives only `unitId`. Amount is fetched from DB server-side before creating the Stripe session.

### Anti-Pattern 2: Confirming Payment on Redirect

**What people do:** On the Stripe `success_url` redirect, immediately record the payment in the DB.

**Why it's wrong:** Stripe explicitly warns that redirect success does not guarantee payment completion. Network failures can cause the redirect without the payment processing.

**Do this instead:** Record payment only inside the Stripe webhook handler (`checkout.session.completed`). The success page shows "processing" until the webhook fires.

### Anti-Pattern 3: Routing File Uploads Through Next.js Server

**What people do:** Send the entire file as a multipart form body to a Route Handler, which then proxies it to S3.

**Why it's wrong:** Large files consume Next.js server memory. On Vercel, function memory limits will cause failures for large uploads. Adds latency for the extra network hop.

**Do this instead:** Presigned URL pattern — client uploads directly to S3. Next.js only generates the short-lived URL.

### Anti-Pattern 4: Monolithic Notification Dispatch in Every Action

**What people do:** Copy-paste email/SMS dispatch logic into every Server Action that needs to notify users.

**Why it's wrong:** Notification logic becomes scattered, hard to update, and untestable. Changing from Twilio to a different SMS provider requires touching every action.

**Do this instead:** Single `lib/notifications.ts` service with typed event dispatch. All Server Actions call `notifyEvent(tenantId, "PAYMENT_RECEIVED", data)`. Notification service owns the channel routing.

### Anti-Pattern 5: Building Role Complexity Early

**What people do:** Implement granular permissions (read-only vs. full admin, property-scoped access, etc.) from day one.

**Why it's wrong:** For 5 units with a small team where everyone has full access, this is pure overhead. Over-engineered RBAC becomes a maintenance burden and slows initial delivery.

**Do this instead:** Two roles only: `TENANT` and `ADMIN`. All admins have full access. Design the data model so a `propertyId` or `organizationId` can be added later without schema rewrites (include the FK now, even if unused). Add granular permissions only when a concrete need arises.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Stripe | Server Action creates session; Route Handler receives webhooks | Webhook must be Route Handler — not a Server Action. Verify signature on every webhook. Handle idempotency with stored event IDs. |
| S3 / Cloudflare R2 | Route Handler generates presigned PUT URL; client uploads directly | R2 has no egress fees — preferred over AWS S3 for self-hosted cost control. Same S3-compatible API. |
| Resend | Called from `lib/notifications.ts` server-side only | Never expose Resend API key to client. Use React Email templates for type-safe HTML emails. |
| Twilio | Called from `lib/notifications.ts` server-side only | Store tenant phone numbers at onboarding. SMS is optional if no phone on file. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Server Action → Service Layer | Direct function call | Server Actions import from `lib/`. No HTTP overhead. |
| Route Handler → Service Layer | Direct function call | Same as Server Actions — Route Handlers also run server-side. |
| Client Component → Server | Server Action (mutations) or fetch (queries) | Prefer Server Components for read data. Client Components for interactive forms. |
| Tenant Portal ↔ Admin Portal | Shared DB, separate route groups | No direct component communication. Both read/write same Prisma models. |
| Notification Service ↔ External Providers | Outbound HTTP (Resend SDK, Twilio SDK) | Wrap in try/catch — notification failure should never break the primary action. |

## Build Order Implications

Components have hard dependencies. Build in this order:

1. **Foundation:** Auth + middleware + DB schema (Prisma). Everything depends on this.
2. **Invite/Onboarding:** Must exist before tenants can be onboarded. QR code generation and token flow.
3. **Tenant profile + unit linking:** Tenants need to be associated with units before any unit-specific features work.
4. **Admin portal (basic):** Admin needs to see tenants and units before testing any other feature.
5. **Payments:** Stripe checkout + webhook. Requires tenants linked to units with rent amounts set.
6. **Maintenance requests:** Requires tenants and file upload infrastructure.
7. **Document uploads:** S3/R2 integration, presigned URL flow. Can be built in parallel with maintenance.
8. **Notifications:** Last because it enhances existing features. Email/SMS on events that already exist.
9. **Polish:** In-app notification bell, dashboard stats, mobile responsiveness refinement.

## Sources

- Next.js App Router multi-tenancy guide: [https://nextjs.org/docs/app/guides/multi-tenant](https://nextjs.org/docs/app/guides/multi-tenant) — MEDIUM confidence (official docs)
- Stripe + Next.js 2025 architecture (Pedro Alonso): [https://www.pedroalonso.net/blog/stripe-nextjs-complete-guide-2025/](https://www.pedroalonso.net/blog/stripe-nextjs-complete-guide-2025/) — MEDIUM confidence (verified with Stripe docs patterns)
- Stripe webhook idempotency and verification: Official Stripe documentation — HIGH confidence
- S3 presigned URL pattern in Next.js: [https://conermurphy.com/blog/presigned-urls-nextjs-s3-upload/](https://conermurphy.com/blog/presigned-urls-nextjs-s3-upload/) — MEDIUM confidence (multiple sources agree on this pattern)
- Property management data model entities: [https://www.geeksforgeeks.org/dbms/how-to-design-er-diagrams-for-real-estate-property-management/](https://www.geeksforgeeks.org/dbms/how-to-design-er-diagrams-for-real-estate-property-management/) — MEDIUM confidence
- Multi-tenant Next.js architecture patterns: [https://www.nextbraintech.com/blog/crafting-scalable-saas-for-a-multitenant-architecture-with-nextjs-nodejs](https://www.nextbraintech.com/blog/crafting-scalable-saas-for-a-multitenant-architecture-with-nextjs-nodejs) — LOW-MEDIUM confidence (single source, patterns consistent with Next.js official docs)
- Prisma + Next.js integration: [https://www.prisma.io/nextjs](https://www.prisma.io/nextjs) — HIGH confidence (official documentation)

---
*Architecture research for: Tenant/Landlord Property Management Portal (RentalMgmt)*
*Researched: 2026-02-25*
