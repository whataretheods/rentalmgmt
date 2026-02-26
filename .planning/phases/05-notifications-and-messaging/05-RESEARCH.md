# Phase 5: Notifications and Messaging - Research

**Researched:** 2026-02-26
**Domain:** Multi-channel notifications (email, SMS, in-app), scheduled jobs, TCPA compliance
**Confidence:** HIGH

## Summary

Phase 5 introduces three notification channels (email via Resend, SMS via Twilio, in-app via database-backed inbox) plus automated rent reminders triggered by a scheduled job. The project already has Resend integrated for transactional emails (payment confirmations, password reset, email change verification) and has `smsOptIn`/`smsOptInAt` fields on the user schema from Phase 4. The primary new infrastructure pieces are: (1) Twilio for SMS with TCPA-compliant opt-in/opt-out, (2) a `notifications` database table powering the in-app inbox, (3) a cron-triggered API route for automated rent reminders, and (4) an admin bulk messaging interface.

The key technical challenge is the cron/scheduling mechanism for a self-hosted Next.js app. Since the app runs on a persistent Node.js process (not serverless), the simplest approach is a system crontab entry that calls a secured API route with a bearer token. This avoids adding Redis/BullMQ infrastructure for what amounts to a daily check across 5 units.

**Primary recommendation:** Use system crontab calling a CRON_SECRET-protected API route for reminders, Twilio Programmable Messaging with a Messaging Service for SMS, Resend batch API for bulk email, and a `notifications` table with Drizzle for the in-app inbox.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| NOTIF-01 | System sends automated payment reminders (3-5 days before, day-of, overdue) | Cron-triggered API route queries units/payments, sends via Resend + Twilio per tenant preference. Notification records persisted to `notifications` table. |
| NOTIF-03 | System sends SMS notifications for urgent items with TCPA-compliant opt-in and STOP handling | Twilio Programmable Messaging with Messaging Service handles STOP/START keywords automatically. Inbound webhook syncs opt-out state to `user.smsOptIn`. SMS opt-in UI on tenant profile page. |
| NOTIF-04 | Tenant and admin can view in-app notifications via notification inbox | `notifications` table with `userId`, `type`, `channel`, `title`, `body`, `readAt`. API route serves paginated list. Bell icon in layout headers with unread count badge. |
| NOTIF-05 | Admin can send bulk messages to all tenants via email and SMS | Admin compose form with recipient filter (all tenants / specific units). Resend batch API (up to 100 per call) for email. Twilio `messages.create()` loop for SMS. Each send creates `notifications` records. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `twilio` | ^5.x | SMS sending and webhook validation | Official Twilio Node.js SDK, industry standard for programmable SMS |
| `resend` | ^6.9.2 | Email sending (already installed) | Already in use for payment confirmations and auth emails |
| `drizzle-orm` | ^0.45.1 | Database queries for notifications table | Already the project ORM, no new dependency |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@react-email/components` | ^1.0.8 | Email templates (already installed) | For building styled reminder and broadcast email templates |
| `zod` | ^4.3.6 | Input validation (already installed) | Validating admin compose form, webhook payloads, cron secret |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| System crontab | GitHub Actions cron | Free but 5-min minimum interval, UTC only, not guaranteed timing -- overkill for a self-hosted app |
| System crontab | node-cron in-process | Works for persistent server but couples scheduling to app process lifecycle -- harder to debug |
| System crontab | BullMQ + Redis | Robust job queue but adds Redis dependency for 5-unit daily checks -- massive overkill |
| Twilio | Amazon SNS | Cheaper per-message but no built-in STOP/opt-out handling, more compliance burden |

**Installation:**
```bash
npm install twilio
```

No other new packages needed -- Resend, Drizzle, Zod, and React Email are already installed.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/
│   ├── api/
│   │   ├── cron/
│   │   │   └── rent-reminders/
│   │   │       └── route.ts          # Cron-triggered reminder endpoint
│   │   ├── notifications/
│   │   │   └── route.ts              # GET (list) notifications for current user
│   │   ├── admin/
│   │   │   ├── notifications/
│   │   │   │   └── route.ts          # GET admin notifications
│   │   │   └── broadcast/
│   │   │       └── route.ts          # POST admin bulk message
│   │   └── webhooks/
│   │       └── twilio/
│   │           └── route.ts          # Twilio inbound SMS webhook
│   ├── (tenant)/tenant/
│   │   └── notifications/
│   │       └── page.tsx              # Tenant notification inbox page
│   └── (admin)/admin/
│       ├── notifications/
│       │   └── page.tsx              # Admin notification inbox page
│       └── broadcast/
│           └── page.tsx              # Admin compose/send broadcast page
├── components/
│   ├── tenant/
│   │   └── SmsOptInToggle.tsx        # TCPA-compliant SMS opt-in checkbox
│   ├── admin/
│   │   └── BroadcastForm.tsx         # Admin bulk message compose form
│   └── ui/
│       └── NotificationBell.tsx      # Bell icon with unread count badge
├── db/schema/
│   └── domain.ts                     # Add notifications table here
└── lib/
    ├── twilio.ts                     # Twilio client (lazy proxy pattern)
    ├── notifications.ts              # Notification creation/query helpers
    └── resend.ts                     # Already exists
```

### Pattern 1: Notification Dispatch Abstraction
**What:** A unified `sendNotification()` function that creates a DB record and dispatches to the appropriate channel(s) based on user preferences.
**When to use:** Every time the system generates a notification (reminders, broadcasts, system events).
**Example:**
```typescript
// src/lib/notifications.ts
import { db } from "@/db"
import { notifications, user } from "@/db/schema"
import { eq } from "drizzle-orm"
import { resend } from "@/lib/resend"
import { getTwilioClient } from "@/lib/twilio"

interface NotificationPayload {
  userId: string
  type: "rent_reminder" | "payment_confirmation" | "broadcast" | "system"
  title: string
  body: string
  emailHtml?: string      // optional rich HTML for email
  channels: ("in_app" | "email" | "sms")[]
}

export async function sendNotification(payload: NotificationPayload) {
  // 1. Always create in-app notification record
  const [record] = await db.insert(notifications).values({
    userId: payload.userId,
    type: payload.type,
    title: payload.title,
    body: payload.body,
  }).returning()

  // 2. Fetch user for contact info
  const [recipient] = await db.select().from(user).where(eq(user.id, payload.userId))
  if (!recipient) return record

  // 3. Send email if channel includes email
  if (payload.channels.includes("email")) {
    void resend.emails.send({
      from: "RentalMgmt <noreply@rentalmgmt.com>",
      to: recipient.email,
      subject: payload.title,
      html: payload.emailHtml ?? `<p>${payload.body}</p>`,
    })
  }

  // 4. Send SMS if channel includes sms AND user has opted in
  if (payload.channels.includes("sms") && recipient.smsOptIn && recipient.phone) {
    const twilio = getTwilioClient()
    void twilio.messages.create({
      body: payload.body,
      to: recipient.phone,
      messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
    })
  }

  return record
}
```

### Pattern 2: Cron-Secured API Route
**What:** An API route protected by a `CRON_SECRET` bearer token, callable by system crontab.
**When to use:** For the daily rent reminder check.
**Example:**
```typescript
// src/app/api/cron/rent-reminders/route.ts
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // ... reminder logic: query units, check due dates, send notifications
  return NextResponse.json({ sent: count })
}
```

System crontab entry:
```bash
# Run daily at 9am local time
0 9 * * * curl -s -X POST http://localhost:3000/api/cron/rent-reminders \
  -H "Authorization: Bearer $CRON_SECRET" > /var/log/rent-reminders.log 2>&1
```

### Pattern 3: Twilio Lazy Client (matching existing patterns)
**What:** Lazy proxy for Twilio client, matching the Resend and DB client patterns.
**When to use:** All Twilio interactions.
**Example:**
```typescript
// src/lib/twilio.ts
import Twilio from "twilio"

let _client: ReturnType<typeof Twilio> | null = null

export function getTwilioClient() {
  if (!_client) {
    _client = Twilio(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!
    )
  }
  return _client
}
```

### Pattern 4: Twilio Webhook for STOP/START
**What:** An API route that receives Twilio inbound SMS webhooks and syncs opt-out state.
**When to use:** When tenant texts STOP or START to the Twilio number.
**Example:**
```typescript
// src/app/api/webhooks/twilio/route.ts
import { NextResponse } from "next/server"
import Twilio from "twilio"
import { db } from "@/db"
import { user } from "@/db/schema"
import { eq } from "drizzle-orm"

export async function POST(req: Request) {
  // 1. Validate Twilio signature
  const signature = req.headers.get("x-twilio-signature") ?? ""
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/twilio`
  const formData = await req.formData()
  const params: Record<string, string> = {}
  formData.forEach((v, k) => { params[k] = v.toString() })

  const isValid = Twilio.validateRequest(
    process.env.TWILIO_AUTH_TOKEN!,
    signature,
    url,
    params
  )
  if (!isValid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 })
  }

  // 2. Handle opt-out/opt-in
  const optOutType = params.OptOutType  // "STOP", "START", or "HELP"
  const from = params.From              // tenant phone number

  if (optOutType === "STOP") {
    await db.update(user)
      .set({ smsOptIn: false })
      .where(eq(user.phone, from))
  } else if (optOutType === "START") {
    await db.update(user)
      .set({ smsOptIn: true, smsOptInAt: new Date().toISOString() })
      .where(eq(user.phone, from))
  }

  // Return empty TwiML response
  return new Response(
    '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
    { headers: { "Content-Type": "text/xml" } }
  )
}
```

### Anti-Patterns to Avoid
- **Sending SMS without checking smsOptIn:** Always check `user.smsOptIn === true` AND `user.phone` is not null before sending SMS. TCPA violations carry fines of $500-$1,500 per message.
- **Blocking webhook responses on email/SMS sends:** Follow the existing pattern of fire-and-forget (`void`) for outbound sends in webhook handlers.
- **Storing notification preferences separately from user table:** The `smsOptIn` field is already on the `user` table -- do not create a separate preferences table for 5 users.
- **Using node-cron in the Next.js process:** Couples scheduling to the app process lifecycle. If the app restarts during a scheduled run, the job is lost. System crontab is more reliable for a self-hosted app.
- **Polling for new notifications:** For 5 tenants, simple page refresh or navigation-based fetch is sufficient. Do not add WebSockets or Server-Sent Events for real-time notification updates.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SMS opt-out compliance | Custom STOP word parsing | Twilio Messaging Service default STOP filtering | Twilio automatically blocks messages to opted-out numbers (error 21610), handles STOP/START/HELP keywords |
| SMS delivery tracking | Custom delivery status polling | Twilio Messaging Service automatic handling | Twilio manages delivery receipts and retry logic |
| Webhook signature validation | Custom HMAC computation | `Twilio.validateRequest()` from the SDK | Parameters change without notice; SDK handles all variations |
| Batch email sending | Custom loop with rate limiting | `resend.batch.send()` | Handles up to 100 emails per call with proper rate limiting and idempotency |
| Phone number formatting | Regex-based phone parsing | E.164 format validation (simple regex `^\+1\d{10}$`) | US-only scope means E.164 is straightforward; no need for libphonenumber |

**Key insight:** Twilio's Messaging Service provides automatic STOP/START/HELP handling at the platform level. When a user texts STOP, Twilio adds them to a blocklist and all future messages from your number to that user fail with error 21610. This is the compliance layer -- your app's `smsOptIn` field is a secondary tracking layer for UI display, not the enforcement mechanism.

## Common Pitfalls

### Pitfall 1: Twilio Blocks After STOP Regardless of Your Database
**What goes wrong:** After a user texts STOP, your app updates `smsOptIn = false` in the DB. But if you later set `smsOptIn = true` without the user texting START, Twilio will still block the message (error 21610) because Twilio maintains its own blocklist.
**Why it happens:** Two independent opt-out systems: your DB and Twilio's platform-level blocklist.
**How to avoid:** The only way to re-enable SMS is for the user to text START to your Twilio number. Your UI should instruct users to text START, not just toggle a checkbox. When receiving a START webhook, update your DB to match.
**Warning signs:** Error 21610 on message send attempts.

### Pitfall 2: A2P 10DLC Registration Required for US SMS
**What goes wrong:** SMS messages are filtered/blocked by carriers because the Twilio number is not registered for A2P (Application-to-Person) messaging.
**Why it happens:** Since 2023, US carriers require 10DLC registration for business SMS. Unregistered traffic gets additional carrier fees and higher filtering.
**How to avoid:** Register for A2P 10DLC through Twilio console: Brand registration ($4-$44 one-time), Campaign registration ($15 one-time + $1.50-$10/month). For a small landlord, "Sole Proprietor" registration is the simplest path. Allow 1-2 weeks for approval.
**Warning signs:** Messages show "delivered" in Twilio but tenants report not receiving them.

### Pitfall 3: Duplicate Reminders on Cron Retries
**What goes wrong:** If the cron job runs, sends some reminders, then fails partway through, a retry sends duplicate reminders to some tenants.
**Why it happens:** No idempotency tracking for which reminders have been sent for a given date.
**How to avoid:** Track sent reminders using the `notifications` table. Before sending a reminder, check if a notification of type `rent_reminder` already exists for that user + billing period + reminder type (e.g., "3_day_before"). Skip if already sent.
**Warning signs:** Tenants receiving multiple identical reminder texts on the same day.

### Pitfall 4: Resend Free Tier Limit (3,000 emails/month)
**What goes wrong:** Hitting the Resend free tier limit of 3,000 emails/month causes email delivery failures.
**Why it happens:** With 5 tenants, even heavy usage is unlikely to hit this (5 tenants x 3 reminder types x 12 months = 180 reminder emails/year). But admin broadcasts add volume. Still well within limits.
**How to avoid:** Monitor Resend dashboard usage. For 5 units, the free tier is more than sufficient (estimated 20-50 emails/month including reminders, confirmations, and broadcasts).
**Warning signs:** Resend API returning 429 rate limit errors.

### Pitfall 5: Missing TCPA Consent Records
**What goes wrong:** Sending SMS without documented prior express consent.
**Why it happens:** TCPA requires that you maintain records of when and how consent was obtained.
**How to avoid:** The `smsOptInAt` timestamp field on the user table records when consent was given. The opt-in UI must include TCPA disclosure text ("By checking this box, you agree to receive text messages from RentalMgmt. Message and data rates may apply. Reply STOP to opt out."). Store the opt-in timestamp as the consent record.
**Warning signs:** No `smsOptInAt` value for users with `smsOptIn = true`.

### Pitfall 6: Twilio Form-Encoded Webhook vs JSON
**What goes wrong:** Trying to parse Twilio inbound webhooks as JSON.
**Why it happens:** Twilio sends inbound SMS webhooks as `application/x-www-form-urlencoded`, not JSON.
**How to avoid:** Use `req.formData()` or parse the body as URL-encoded form data in the webhook route. Do NOT use `req.json()`.
**Warning signs:** 400/500 errors on the Twilio webhook endpoint.

## Code Examples

### Database Schema: Notifications Table
```typescript
// Addition to src/db/schema/domain.ts
export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),           // Better Auth user.id
  type: text("type", {
    enum: ["rent_reminder", "payment_confirmation", "broadcast", "maintenance_update", "system"],
  }).notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  channel: text("channel", {
    enum: ["in_app", "email", "sms"],
  }).default("in_app").notNull(),
  readAt: timestamp("read_at"),                // null = unread
  createdAt: timestamp("created_at").defaultNow().notNull(),
})
```

### Rent Reminder Logic
```typescript
// Core logic for the cron-triggered reminder route
// Query all active tenant-unit links, check due dates, send appropriate reminders

import { db } from "@/db"
import { units, tenantUnits, payments, notifications } from "@/db/schema"
import { eq, and } from "drizzle-orm"

async function processReminders() {
  const today = new Date()
  const currentDay = today.getDate()

  // Get all active tenant-unit links with unit details
  const activeLinks = await db
    .select({
      userId: tenantUnits.userId,
      unitId: tenantUnits.unitId,
      unitNumber: units.unitNumber,
      rentAmountCents: units.rentAmountCents,
      rentDueDay: units.rentDueDay,
    })
    .from(tenantUnits)
    .innerJoin(units, eq(units.id, tenantUnits.unitId))
    .where(eq(tenantUnits.isActive, true))

  const currentPeriod = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`
  let sentCount = 0

  for (const link of activeLinks) {
    if (!link.rentDueDay || !link.rentAmountCents) continue

    const daysUntilDue = link.rentDueDay - currentDay
    let reminderType: string | null = null

    if (daysUntilDue >= 3 && daysUntilDue <= 5) {
      reminderType = "upcoming"
    } else if (daysUntilDue === 0) {
      reminderType = "due_today"
    } else if (daysUntilDue < 0) {
      reminderType = "overdue"
    }

    if (!reminderType) continue

    // Check if already sent for this period + type (idempotency)
    // ... check notifications table ...

    // Check if already paid for this period
    // ... check payments table ...

    // Send notification via sendNotification() helper
    sentCount++
  }

  return sentCount
}
```

### Admin Broadcast API
```typescript
// POST /api/admin/broadcast
// Body: { subject, body, recipients: "all" | string[], channels: ("email" | "sms")[] }

// Use resend.batch.send() for email (up to 100 per batch call)
// Loop Twilio messages.create() for SMS (5 tenants = trivial)
// Create notification records for each recipient
```

### SMS Opt-In Toggle Component Pattern
```typescript
// Tenant profile page addition
// Must include TCPA disclosure text
// Checkbox that calls API to update smsOptIn + smsOptInAt on user record
// Note: This only controls initial opt-in. Opt-out via STOP is handled by Twilio.
// Re-opt-in requires texting START to the Twilio number (cannot be done via UI alone).
```

### Notification Bell Component Pattern
```typescript
// Client component in layout header
// Fetches GET /api/notifications?unread=true&limit=5
// Shows count badge on bell icon
// Dropdown or link to full notifications page
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Direct phone number in `from` field | Messaging Service SID | Twilio best practice since 2023 | Use `messagingServiceSid` instead of `from` number for compliance and scaling |
| Manual STOP word handling | Platform-level STOP filtering | Twilio default behavior | Twilio blocks messages automatically after STOP; no app-level filtering needed |
| Unregistered 10DLC sending | A2P 10DLC registration required | Carriers enforced 2023+ | Must register brand + campaign before sending business SMS in US |
| Expanded opt-out keywords | REVOKE and OPTOUT added | April 29, 2025 | Twilio now recognizes these additional keywords alongside STOP, END, etc. |

**Deprecated/outdated:**
- Sending via bare phone numbers without Messaging Service: Still works but risks carrier filtering and lacks compliance features
- Implementing custom STOP word parsing: Unnecessary -- Twilio handles this at the platform level

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright 1.58.2 |
| Config file | `playwright.config.ts` |
| Quick run command | `npx playwright test e2e/notifications.spec.ts` |
| Full suite command | `npx playwright test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NOTIF-01 | Cron endpoint sends reminders for units with upcoming due dates | integration | `npx playwright test e2e/notifications.spec.ts -g "rent reminders"` | No - Wave 0 |
| NOTIF-03 | SMS opt-in toggle on profile, TCPA disclosure displayed | e2e | `npx playwright test e2e/notifications.spec.ts -g "sms opt-in"` | No - Wave 0 |
| NOTIF-03 | Twilio webhook processes STOP/START correctly | integration | `npx playwright test e2e/notifications.spec.ts -g "twilio webhook"` | No - Wave 0 |
| NOTIF-04 | Tenant can view notification inbox with unread count | e2e | `npx playwright test e2e/notifications.spec.ts -g "notification inbox"` | No - Wave 0 |
| NOTIF-04 | Admin can view notification inbox | e2e | `npx playwright test e2e/notifications.spec.ts -g "admin notifications"` | No - Wave 0 |
| NOTIF-05 | Admin can compose and send bulk message | e2e | `npx playwright test e2e/notifications.spec.ts -g "broadcast"` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `npx playwright test e2e/notifications.spec.ts -x`
- **Per wave merge:** `npx playwright test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `e2e/notifications.spec.ts` -- covers NOTIF-01, NOTIF-03, NOTIF-04, NOTIF-05
- [ ] `scripts/seed-notifications-test.ts` -- seed data for notification testing (units with due dates, tenant with phone + sms opt-in)
- [ ] Twilio test credentials (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN test values) for webhook simulation

### Testing Strategy Notes
- **NOTIF-01 (reminders):** Test the cron API route directly via HTTP call with CRON_SECRET header. Verify notifications table has expected records after call. Cannot test actual cron schedule in E2E.
- **NOTIF-03 (SMS):** E2E tests verify the opt-in UI and TCPA disclosure. Twilio webhook can be tested by simulating POST to `/api/webhooks/twilio` with form-encoded body. Actual SMS delivery requires manual verification with Twilio test credentials.
- **NOTIF-04 (inbox):** Standard E2E -- seed notifications, navigate to inbox page, verify list renders.
- **NOTIF-05 (broadcast):** E2E admin flow -- compose message, submit, verify notification records created.

## Open Questions

1. **Twilio Number Type: Local vs Toll-Free**
   - What we know: Local numbers cost $1.15/month, toll-free $2.15/month. Both support SMS. Local requires A2P 10DLC registration. Toll-free has simpler verification process.
   - What's unclear: Whether toll-free STOP handling differs from local (research suggests toll-free always handles STOP regardless of Advanced Opt-Out config).
   - Recommendation: Start with a local number ($1.15/month) and register for A2P 10DLC as Sole Proprietor. Total monthly cost: ~$1.15 (number) + ~$0.50 (estimated 5 tenants x ~10 messages x $0.0083). Under $5/month total.

2. **Overdue Reminder Frequency**
   - What we know: Requirements say "overdue" but don't specify how often to re-remind.
   - What's unclear: Should overdue reminders repeat daily? Weekly? Once?
   - Recommendation: Send overdue reminder on day 1 past due, day 3, and day 7. Then stop (avoid harassment). Make this configurable via constants.

3. **Admin Notifications vs Tenant Notifications**
   - What we know: NOTIF-04 says "Tenant and admin can open a notification inbox."
   - What's unclear: What notifications does admin receive? Payment received? Maintenance request submitted?
   - Recommendation: For v1, admin inbox shows: broadcast messages sent (confirmation), and system events (new tenant signup, payment received). Keep it simple -- admin inbox is secondary to the admin dashboard.

## Environment Variables Required

```bash
# Twilio (new)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxx
TWILIO_MESSAGING_SERVICE_SID=MGxxxxxxxxxx
TWILIO_PHONE_NUMBER=+1xxxxxxxxxx

# Cron (new)
CRON_SECRET=<random-32-char-string>

# App URL (may already exist, needed for Twilio webhook URL)
NEXT_PUBLIC_APP_URL=https://your-domain.com

# Existing (no changes)
RESEND_API_KEY=re_xxxxxxxxxx
DATABASE_URL=postgresql://...
```

## Cost Analysis (5-Unit Building)

| Service | Monthly Cost | Notes |
|---------|-------------|-------|
| Twilio phone number | $1.15 | Local number |
| Twilio SMS outbound | ~$0.42 | ~50 messages/month x $0.0083 (5 tenants x 3 reminder types + broadcasts) |
| Twilio SMS inbound | ~$0.04 | ~5 STOP/START messages x $0.0075 |
| Resend | $0 | Free tier: 3,000 emails/month (estimated usage: 20-50/month) |
| A2P 10DLC registration | ~$4 one-time + $1.50/month | Sole Proprietor brand + campaign |
| **Total monthly** | **~$3.11** | After one-time $19 setup ($4 brand + $15 campaign) |

## Sources

### Primary (HIGH confidence)
- Twilio official docs: SMS quickstart, Messaging Service STOP filtering, Advanced Opt-Out, webhook request format, webhook security
- Resend official docs: Batch email API reference, Node.js SDK, pricing page
- Twilio pricing page: US SMS rates ($0.0083/msg outbound, $0.0075 inbound, $1.15/month local number)
- Twilio A2P 10DLC docs: Registration requirements, Sole Proprietor path, pricing

### Secondary (MEDIUM confidence)
- Multiple sources on Next.js cron approaches for self-hosted apps (system crontab, node-cron, GitHub Actions)
- Twilio opt-out behavior: Error 21610 for blocked numbers, START keyword for re-opt-in
- FCC 2025 update adding REVOKE and OPTOUT keywords (effective April 29, 2025)

### Tertiary (LOW confidence)
- Exact A2P 10DLC approval timeline (sources say 1-2 weeks, may vary)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Twilio and Resend are well-documented, project already uses Resend
- Architecture: HIGH - Patterns follow existing project conventions (lazy proxy, webhook routes, Drizzle schema)
- Pitfalls: HIGH - TCPA/compliance pitfalls are well-documented by Twilio; cron idempotency is a standard concern
- SMS opt-out flow: HIGH - Twilio's platform-level STOP handling is well-documented and confirmed across multiple official sources
- A2P 10DLC requirements: MEDIUM - Registration process and costs are documented but timelines vary

**Research date:** 2026-02-26
**Valid until:** 2026-03-26 (stable domain, Twilio/Resend APIs are mature)
