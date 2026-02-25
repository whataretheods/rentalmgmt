# Stack Research

**Domain:** Property management portal (tenant/landlord SaaS — single building, 5 units, self-hosted)
**Researched:** 2026-02-25
**Confidence:** HIGH (core stack verified via official docs and Context7; versions confirmed via npm/GitHub releases)

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js | 15.5.x (latest stable) | Full-stack framework — routing, server actions, API routes, rendering | App Router + Server Actions eliminate the need for a separate API server. Node.js middleware is now stable in 15.5. Vercel-native and the industry standard for full-stack TypeScript in 2025. Use `npm install next@latest`. |
| React | 19.x | UI rendering | Ships with Next.js 15+. Server Components reduce client bundle size — important for tenants on mobile. |
| TypeScript | 5.x | Type safety | Non-negotiable for a system handling money (Stripe), personal data, and multi-user access. Next.js is TypeScript-first. |
| Tailwind CSS | 4.x | Styling | v4 released Jan 2025; stable and production-ready. CSS-first config, 5x faster builds, auto-scanning (no config file needed). The ecosystem default for Next.js. |
| shadcn/ui | latest | Component library | Copy-into-project component system built on Radix UI + Tailwind. Admin dashboards and tenant portals are the primary use case — there are verified templates for both. Not a dependency, no lock-in. |

### Database

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| PostgreSQL (via Neon) | Neon serverless, PG 16 | Primary data store — tenants, payments, maintenance requests, documents, notifications | Relational data with foreign keys is the right model for property management. Neon provides serverless PostgreSQL with auto-scaling to zero, instant branching for dev environments, and native Vercel/Next.js integration. Free tier is generous for a 5-unit building. |
| Drizzle ORM | 0.45.x stable (v1.0 beta available) | Type-safe DB queries and schema management | SQL-first TypeScript ORM. Zero dependencies, ~7.4kb, no binary engine — critical for Neon's serverless driver compatibility. Drizzle + Neon is a first-class integration with official Neon docs. Prefer 0.45.x stable for production; v1.0 beta is promising but introduces breaking changes. |
| `@neondatabase/serverless` | latest | Neon serverless HTTP/WebSocket driver | Required for Drizzle + Neon integration. HTTP driver for single queries; WebSocket driver for transactions. Official Neon package — not optional if using Neon. |

### Authentication

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Better Auth | 1.4.x stable | Full authentication system — email/password, session management, magic links, 2FA | Auth.js (NextAuth) team has officially merged into Better Auth; new projects should use Better Auth. v1.0 reached stable in 2025, currently at 1.4.x. Plugin architecture makes QR code onboarding (magic link + one-time invite token) clean to implement. Built-in rate limiting and security hardening. Framework-agnostic but Next.js is a first-class target. |

### Payments

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `stripe` (server SDK) | 20.3.x | Stripe API calls from server — create payment intents, webhooks, customer management | Industry-standard, required per project constraints. Server SDK runs in Server Actions / Route Handlers. Never expose secret key to client. |
| `@stripe/react-stripe-js` | latest | Stripe Payment Element in React | Embed the Payment Element — the single UI component that supports 100+ payment methods (cards, ACH, bank transfers, etc.). Handles PCI compliance automatically. |
| `@stripe/stripe-js` | latest | Stripe.js client-side loader | Loads Stripe.js asynchronously. Required peer dep for `@stripe/react-stripe-js`. |

### Email

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Resend | latest | Transactional email delivery | Developer-first email API with a clean Next.js integration via Server Actions. Created by the React Email author — tight integration. Free tier: 3,000 emails/month — more than sufficient for a 5-unit building. Simple API: one function call, done. |
| `@react-email/components` | latest | Email template components | Write email templates in React (not HTML soup). Resend renders these server-side. Vercel template available. Version supports React 19 and Next.js 16. |

### SMS

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Twilio | latest (`twilio` npm) | SMS notifications — rent reminders, maintenance updates | Industry standard for programmatic SMS. US rates are $0.0083/SMS + $1.15/month per number — negligible for 5 units. No viable simpler alternative at this level of control. Use server-side only via Route Handlers or Server Actions. |

### File Storage

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| AWS S3 (or Cloudflare R2) | AWS SDK v3 | Document storage — tenant ID uploads, proof docs, maintenance photos | Object storage is the correct solution: cheaper than DB, more scalable than local disk, no server-side storage required. R2 is Cloudflare's S3-compatible alternative with no egress fees — better cost profile for a budget-conscious project. AWS SDK v3 is S3-compatible with both. |
| Presigned URLs pattern | N/A (built-in S3 feature) | Secure direct-to-S3 uploads from browser | Tenant uploads go directly from browser to S3 — no file data touches the Next.js server. Server generates a presigned URL (time-limited), client uploads to that URL. Prevents large payload processing on the app server. |

### Real-Time / In-App Notifications

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Server-Sent Events (SSE) | Native browser API (no library) | In-app notification feed — real-time updates for admin | Built into modern browsers; Next.js Route Handlers support SSE natively via `ReadableStream`. No third-party service, no extra cost. One-way server-to-client is all that's needed for notifications. For a 5-unit building, this is far simpler than WebSockets or Pusher. |

### QR Code

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `qrcode` | latest | Generate QR codes for tenant onboarding letters | Server-side QR generation — generate a unique magic-link URL per unit, encode as QR, print to PDF for physical letters. Simple, battle-tested, zero-dependency approach. |

---

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `react-hook-form` | latest | Form handling | Every form in the app — maintenance requests, contact info, onboarding. Minimizes re-renders, integrates cleanly with shadcn/ui form components. Always. |
| `zod` | 3.x | Schema validation | Validate form data client-side AND server-side (in Server Actions). Pairs with `react-hook-form` via `@hookform/resolvers`. Always. |
| `@hookform/resolvers` | latest | Bridge between zod and react-hook-form | Install alongside both. Always when using zod + react-hook-form. |
| `date-fns` | 3.x | Date manipulation | Rent due dates, overdue calculations, notification scheduling. Lighter than moment.js, tree-shakeable. Prefer over `dayjs` for TypeScript projects. |
| `sonner` | latest | Toast notifications | Shadcn/ui's recommended toast library. Use for success/error feedback on form submissions and payment confirmations. |
| `lucide-react` | latest | Icon set | Ships with shadcn/ui. Consistent, well-maintained, tree-shakeable. Use for all icons. |
| `@aws-sdk/client-s3` | 3.x | AWS S3 operations | Server-side only — generate presigned URLs, delete objects. Use `@aws-sdk/s3-request-presigner` alongside. |
| `sharp` | latest | Image optimization for maintenance photos | Compress uploaded maintenance photos before storing to S3. Reduces storage costs. Server-side only. |

---

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `drizzle-kit` | Drizzle schema migrations — `drizzle-kit generate`, `drizzle-kit migrate` | Run locally and in CI. Install as dev dependency. |
| `stripe-cli` | Local Stripe webhook testing | Essential during development — forwards Stripe events to `localhost`. Install via Homebrew (`brew install stripe/stripe-cli/stripe`). |
| `@next/codemod` | Automated Next.js upgrades | Useful when upgrading Next.js minor versions. `npx @next/codemod@canary upgrade latest`. |
| ESLint + `eslint.config.mjs` | Linting | Note: `next lint` is deprecated in Next.js 15.5 and will be removed in 16. Use direct `eslint` CLI with explicit config file instead. |
| Biome | Fast linting + formatting alternative | Optional alternative to ESLint. Next.js 15.5 supports it natively in `create-next-app`. Use if the team values speed over ESLint's rule breadth. |

---

## Installation

```bash
# Core framework
npm install next@latest react@latest react-dom@latest typescript @types/react @types/node

# Database
npm install drizzle-orm @neondatabase/serverless

# Auth
npm install better-auth

# Payments
npm install stripe @stripe/react-stripe-js @stripe/stripe-js

# Email
npm install resend @react-email/components

# SMS
npm install twilio

# Storage
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner sharp

# Forms & validation
npm install react-hook-form zod @hookform/resolvers

# UI
npm install @tailwindcss/postcss
npx shadcn@latest init

# QR codes
npm install qrcode @types/qrcode

# Utilities
npm install date-fns sonner lucide-react

# Dev dependencies
npm install -D drizzle-kit @types/twilio
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Better Auth | Auth.js (NextAuth v5) | If you need a specific social provider only in Auth.js. Note: Auth.js will be maintained by the Better Auth team going forward, so new projects should default to Better Auth. |
| Neon + Drizzle ORM | Supabase (Postgres + BaaS) | If you want a batteries-included BaaS with built-in auth, storage, and realtime out of the box. Supabase is a larger footprint but reduces assembly time. For this project, Neon + Better Auth + custom storage is more cost-effective at the 5-unit scale and avoids vendor lock-in. |
| Drizzle ORM | Prisma | If team prefers schema-first SDL over code-first TypeScript definitions, or if you're not on a serverless/edge deployment. Prisma has a larger binary and cold-start overhead — not ideal for Neon serverless. |
| Resend | SendGrid / Postmark | If Resend's deliverability becomes a concern at scale. For a 5-unit building sending dozens of emails/month, Resend is ideal. |
| Cloudflare R2 | AWS S3 | R2 has zero egress fees (vs. S3's $0.09/GB egress) — better for a cost-minimizing project. Both use the same AWS SDK v3. Switch the `endpoint` config. |
| SSE (native) | Pusher / Ably / Socket.io | Only if you need bi-directional real-time (e.g., live chat between tenant and admin). Notifications are one-directional, so SSE is sufficient and free. |
| `qrcode` npm | UploadThing's QR | `qrcode` is standalone server-side generation. Use it for generating invite QR codes printed in physical letters — no UI needed. |
| shadcn/ui + Tailwind | Chakra UI / MUI | shadcn/ui has no runtime overhead (components are copied into your project). MUI and Chakra add runtime CSS-in-JS costs. Tailwind v4 is faster. Shadcn has admin dashboard templates with active maintenance. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Auth.js / NextAuth v5 for new projects | The maintainers recommend starting with Better Auth for new projects. Auth.js will merge into Better Auth. Credentials provider in Auth.js requires manual security hardening (rate limiting, lockout) vs. Better Auth's built-in protections. | Better Auth 1.4.x |
| Prisma on Neon serverless | Prisma's engine binary has significant cold-start overhead in serverless environments; Drizzle has zero overhead. Drizzle also produces smaller bundles (~7.4kb vs Prisma's ~40mb binary). | Drizzle ORM |
| `multer` / storing files in the DB | Storing binary files in PostgreSQL is expensive (storage, bandwidth, query performance). `multer` on the Next.js server means all upload data flows through the app, creating memory pressure. | Presigned S3 URLs for direct browser-to-S3 uploads |
| Socket.io / WebSockets for notifications | Overcomplicated for one-directional notification feed. Requires a persistent server (conflicts with Vercel serverless deployment). SSE is the correct primitive. | Server-Sent Events via Next.js Route Handlers |
| `moment.js` | Deprecated, massive bundle size (67kb), mutable API. | `date-fns` 3.x (tree-shakeable, immutable, TypeScript-native) |
| Client-side Stripe Secret Key | Exposes the Stripe secret key in the browser — a critical security vulnerability. | All Stripe secret key usage in Server Actions or Route Handlers only. Use `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` on the client. |
| Pages Router | Next.js App Router is stable, has been the recommended approach since Next.js 13.4, and is the foundation for all new Next.js features (Server Actions, Server Components, Node.js middleware). | App Router exclusively |
| Next.js 16 (yet) | As of Feb 2026, Next.js 16 exists with an upgrade guide but is newly released. Next.js 15.5 is stable and battle-tested. Unless the project requires specific Next.js 16 features, start on 15.5.x. | Next.js 15.5.x |

---

## Stack Patterns by Variant

**For the tenant-facing portal (public, mobile-first):**
- Use Next.js App Router with Server Components for all read-only views (rent status, maintenance history)
- Use Client Components only where user interaction is required (payment form, maintenance submission)
- Tailwind responsive classes + shadcn/ui for mobile-first layouts

**For the admin portal (internal, desktop-primary):**
- shadcn/ui data tables with server-side pagination (Drizzle queries, not client-side filtering)
- Server Actions for all mutations (mark payment, close request)
- Same Next.js app, different route group `/admin`

**For payment flows:**
- Never trust prices from the client — fetch rent amounts from DB in Server Actions before creating a Stripe PaymentIntent
- Use Stripe Checkout Sessions for initial setup; Payment Intents for subsequent payments
- Verify all Stripe webhooks with `stripe.webhooks.constructEvent` using the webhook signing secret

**For file uploads:**
- Server generates presigned URL (5-minute expiry) via `/api/upload-url` Route Handler
- Client uploads directly to S3/R2 using the presigned URL
- Server stores only the S3 key (not the URL) in the database; reconstruct URLs on demand

**For QR code onboarding:**
- Generate a unique time-limited invite token per unit, store in DB
- Encode `https://yourdomain.com/onboard?token=<token>` as QR code using `qrcode` npm
- Print to PDF for physical letters
- On scan, validate token, pre-fill unit information, require email + password to complete

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| Next.js 15.5.x | React 19.x | Next.js 15.5 requires React 19 when using App Router |
| Better Auth 1.4.x | Next.js 15.x, Drizzle ORM 0.45.x | Better Auth has official Drizzle adapter — use it for session/account tables |
| Drizzle ORM 0.45.x | `@neondatabase/serverless` latest | Use `drizzle-orm/neon-http` or `drizzle-orm/neon-serverless` driver |
| Tailwind CSS 4.x | Next.js 15.x (via `@tailwindcss/postcss`) | shadcn/ui components require Tailwind v4 in latest shadcn releases |
| stripe 20.3.x | Node.js 18+ | Verify your Node.js runtime matches (Vercel defaults to Node 20) |
| `@react-email/components` latest | React 19, Next.js 16 | Per official release notes; backward compatible with Next.js 15 |

---

## Sources

- [Next.js 15.5 Official Blog Post](https://nextjs.org/blog/next-15-5) — Current stable version, Node.js middleware stable, Turbopack builds beta. Published Aug 18, 2025. **HIGH confidence.**
- [Next.js Docs — Authentication Guide](https://nextjs.org/docs/app/guides/authentication) — Official guidance on auth library selection. **HIGH confidence.**
- [Better Auth V1.0 Release](https://www.better-auth.com/v1) — Stable production release announcement. **HIGH confidence.**
- [Better Auth Blog — Auth.js Joins Better Auth](https://www.better-auth.com/blog/authjs-joins-better-auth) — Auth.js team officially recommends Better Auth for new projects. **HIGH confidence.**
- [Neon Docs — Connect Drizzle to Neon](https://neon.com/docs/guides/drizzle) — Official Drizzle + Neon integration guide. **HIGH confidence.**
- [Drizzle ORM — Get Started with Neon](https://orm.drizzle.team/docs/get-started/neon-new) — Official first-class Neon integration. **HIGH confidence.**
- [Drizzle ORM npm](https://www.npmjs.com/package/drizzle-orm) — Current stable version 0.45.x confirmed. **HIGH confidence.**
- [Tailwind CSS v4.0 Release](https://tailwindcss.com/blog/tailwindcss-v4) — Stable January 2025, CSS-first config, 5x faster builds. **HIGH confidence.**
- [Stripe Payment Element Docs](https://docs.stripe.com/payments/payment-element) — 100+ payment methods, Payment Element recommended approach. **HIGH confidence.**
- [Stripe Node.js SDK — GitHub Releases](https://github.com/stripe/stripe-node/releases) — v20.3.x current. **HIGH confidence.**
- [Resend + Next.js Docs](https://resend.com/docs/send-with-nextjs) — Official Resend Next.js App Router integration. **HIGH confidence.**
- [React Email 5.0 Release](https://resend.com/blog/react-email-5) — React 19 + Next.js 16 support confirmed. **HIGH confidence.**
- [Neon vs Supabase comparison — Bytebase](https://www.bytebase.com/blog/neon-vs-supabase/) — Neon recommended for pure PostgreSQL + Next.js/Vercel. **MEDIUM confidence** (community source, consistent with official positioning).
- [Better Auth vs NextAuth — BetterStack](https://betterstack.com/community/guides/scaling-nodejs/better-auth-vs-nextauth-authjs-vs-autho/) — Comparison analysis; consistent with official auth.js recommendation to use Better Auth for new projects. **MEDIUM confidence.**
- [Drizzle vs Prisma — Bytebase](https://www.bytebase.com/blog/drizzle-vs-prisma/) — Drizzle preferred for serverless/Vercel due to bundle size and cold-start. **MEDIUM confidence.**
- [Twilio SMS Pricing US](https://www.twilio.com/en-us/sms/pricing/us) — $0.0083/SMS + $1.15/month phone number. **HIGH confidence.**

---

*Stack research for: Property management portal (RentalMgmt — 5-unit residential building)*
*Researched: 2026-02-25*
