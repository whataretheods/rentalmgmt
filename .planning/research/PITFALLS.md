# Pitfalls Research

**Domain:** Self-hosted property management portal (5-unit residential, single landlord)
**Researched:** 2026-02-25
**Confidence:** MEDIUM — Findings drawn from Stripe official docs, verified web sources, and domain-specific community discussions. Domain-specific pitfalls for small self-hosted portals are less documented than enterprise SaaS; some findings extrapolated from adjacent domains.

---

## Critical Pitfalls

### Pitfall 1: Stripe Webhook Reliability — Trusting the Redirect Instead of the Webhook

**What goes wrong:**
Payment success is confirmed by the redirect URL after checkout, not by a verified webhook. When a tenant closes their browser tab before the redirect completes, the payment appears to fail on the portal even though Stripe collected money. Rent shows as unpaid in the dashboard when it was actually charged.

**Why it happens:**
The redirect-based success flow is what Stripe's quickstart docs show. It works 95% of the time in demos. The 5% failure (browser closed, poor connection) is invisible in development and only appears in production when a tenant calls saying they paid but the portal shows them delinquent.

**How to avoid:**
Design rent payment status as webhook-driven from day one. The flow must be: tenant pays → Stripe sends `payment_intent.succeeded` webhook → portal marks rent paid → tenant sees confirmation on next page load. Never use redirect URL as the source of truth for payment status. Webhook handlers must be idempotent — store processed `event.id` values and skip duplicates because Stripe retries webhooks for up to 72 hours.

**Warning signs:**
- Payment success handler reads from redirect query params like `?session_id=...`
- No webhook endpoint exists in the codebase
- Rent payment status is updated synchronously in the checkout success route

**Phase to address:**
Payment integration phase. This is a foundational architecture decision — retrofitting webhook-first payment state after the fact requires rewriting payment confirmation logic throughout the app.

---

### Pitfall 2: Stripe Webhook Idempotency — Duplicate Rent Charges or Double-Processed Events

**What goes wrong:**
A webhook fires, the handler starts processing, the database write times out or errors, the handler returns a non-200 response, Stripe retries the webhook — and now the same event is processed twice. This results in duplicate "paid" records, doubled notification sends, or incorrect ledger entries. In rare cases where the retry triggers a new charge attempt, a tenant can be double-charged.

**Why it happens:**
Developers handle the webhook, do the database work, then return 200. Any failure between "start processing" and "return 200" causes Stripe to retry. Stripe does not guarantee exactly-once delivery — it guarantees at-least-once.

**How to avoid:**
Store the Stripe `event.id` in the database on first receipt. At the start of every webhook handler, check if that event ID has already been processed — if yes, return 200 immediately and do nothing else. Use database transactions so the event ID insert and the business logic (marking rent paid, sending notification) succeed or fail together. Return 200 within 20 seconds or Stripe considers the delivery failed; use a background job queue for slow operations.

**Warning signs:**
- Webhook handler has no event deduplication check
- Multiple "payment received" notifications sent for a single payment
- Webhook handler performs slow operations (email sends, file writes) synchronously before returning 200

**Phase to address:**
Payment integration phase, specifically webhook handler design.

---

### Pitfall 3: Idempotency Keys Omitted on Stripe API Writes

**What goes wrong:**
A network timeout causes your server to retry a Stripe API call to create a payment or charge. Without an idempotency key, Stripe treats each retry as a new request and creates multiple charges for the same rent payment.

**Why it happens:**
Idempotency keys are optional in Stripe's API — the SDK works without them. Developers skip them during initial implementation and discover the problem only after a production timeout causes a tenant to be charged twice.

**How to avoid:**
Pass an idempotency key on every Stripe write operation. The key should be derived from a stable identifier — for rent payments, use a combination of `tenant_id + unit_id + billing_period` (e.g., `rent_tenant123_unit4_202603`). This guarantees that retrying the same rent payment creation always returns the same Stripe result rather than creating a new charge.

**Warning signs:**
- Stripe API calls in codebase lack `idempotencyKey` parameter
- No retry logic exists for Stripe API calls (meaning failures silently drop rather than retry safely)

**Phase to address:**
Payment integration phase.

---

### Pitfall 4: QR Code Onboarding with No One-Time-Use Enforcement

**What goes wrong:**
QR codes printed on physical letters encode a URL like `/onboard?unit=4`. If the link is reusable and not tied to a specific invitation token, anyone who finds the letter — a previous tenant, a neighbor, a stranger — can create an account claiming to be the tenant of unit 4. The landlord's first interaction with a real tenant is now contaminated by a fraudulent account.

**Why it happens:**
QR codes are often generated as static deep links for simplicity. Making them single-use requires generating a unique token, storing it server-side with an expiry, and invalidating it on first use — more work than a static URL.

**How to avoid:**
Every QR code must encode a unique, single-use, time-limited token. Flow: admin generates invitation for unit → system creates `invitation` record with a UUID token (expires in 30 days) → QR code encodes `/onboard?token=<UUID>` → on scan, server validates token exists, is unexpired, and is unclaimed → after account creation, token is marked used. Never reuse tokens across tenants or units.

**Warning signs:**
- QR code URL contains only unit ID or unit number with no secret token
- No `invitations` table or equivalent in the data model
- No expiry enforcement on onboarding links

**Phase to address:**
Tenant onboarding phase. This is the first feature tenants interact with — a compromised onboarding flow poisons all downstream data.

---

### Pitfall 5: Cross-Tenant Data Leakage — One Tenant Seeing Another's Data

**What goes wrong:**
A tenant in unit 2 can access payment records, documents, or maintenance requests belonging to the tenant in unit 5 by manipulating URL parameters or API request IDs. For example, changing `/maintenance/42` to `/maintenance/43` reveals another tenant's request.

**Why it happens:**
Authorization checks are implemented at the route level (is the user logged in?) but not at the resource level (does this user own this resource?). This is Insecure Direct Object Reference (IDOR) — one of the most common web application vulnerabilities.

**How to avoid:**
Every database query for a tenant-owned resource must scope by the authenticated user's tenant ID. Never look up `WHERE id = :requestId` alone — always `WHERE id = :requestId AND tenant_id = :currentTenantId`. Implement a reusable authorization layer that enforces ownership on every resource fetch. Test this explicitly: log in as tenant A, try to access tenant B's resource IDs.

**Warning signs:**
- API handlers look up records by ID only, without joining/filtering on the current user's tenant context
- No automated tests that verify a logged-in tenant cannot access another tenant's data
- Authorization logic is duplicated across route handlers rather than centralized

**Phase to address:**
Authentication and data model phase — authorization scoping must be built into the data access layer from the start.

---

### Pitfall 6: SMS Notifications Without TCPA Consent Tracking

**What goes wrong:**
The portal sends SMS rent reminders or payment confirmations without recording that tenants explicitly opted in to receive texts. After April 11, 2025, TCPA (Telephone Consumer Protection Act) requires businesses to honor opt-out requests within 10 business days. Sending texts without consent or failing to honor STOP replies exposes the landlord to per-message fines starting at $500.

**Why it happens:**
SMS feels like a convenience feature bolted on late. Consent management gets treated as a checkbox — "we'll add it later" — and never gets the proper data model treatment. Developers ship SMS sends without tracking consent because the notifications "obviously benefit" tenants.

**How to avoid:**
During tenant onboarding, explicitly collect SMS consent as a separate, affirmative opt-in (not pre-checked). Store consent status, consent timestamp, and consent method in the database per tenant. Implement STOP keyword handling: any inbound "STOP" message must immediately set `sms_opted_in = false` for that phone number. Use a provider like Twilio that handles STOP/START/HELP keywords automatically. Never send marketing or non-transactional texts to tenants who haven't opted in.

**Warning signs:**
- No `sms_consent` or `notification_preferences` field in the tenant data model
- SMS sending logic does not check consent before sending
- No inbound message webhook configured to handle opt-out keywords

**Phase to address:**
Notification system phase — build consent tracking into the data model before building the SMS sender.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Static QR code URLs (no token) | Simpler to generate and print | Anyone with the URL can claim a unit; no audit trail | Never |
| Redirect-based payment confirmation | Simpler flow, no webhook setup | Silent payment failures when browser closes; delinquent records for paid tenants | Never |
| Skipping idempotency keys on Stripe writes | Faster initial implementation | Potential duplicate charges on network timeouts | Never |
| Hardcoding per-unit rent amounts in config | Quick to ship | Cannot change amounts without a code deploy; no history of rent changes | Only if you accept that changing rent requires a deployment |
| Sending same notification across all channels simultaneously | Simpler notification logic | Notification fatigue; tenants opt out; TCPA exposure for unconsented SMS | Never |
| Storing uploaded files in the web root or public directory | Easy to serve | Any tenant can guess another tenant's document URL and download it | Never |
| No file type allowlist on document uploads | Tenants can upload anything | Malicious file execution risk if server ever processes uploads | Never |
| Polling for payment status instead of webhooks | No webhook infrastructure needed | Misses payments when browser tab closes; polling adds unnecessary load | Never for payment-critical state |

---

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Stripe Webhooks | Not verifying the `Stripe-Signature` header on incoming webhooks | Always verify the signature using your webhook secret before processing any event — unsigned events are forgeries |
| Stripe Webhooks | Returning non-200 before processing completes (causes retry storm) | Return 200 immediately after signature verification; process the event asynchronously via background job |
| Stripe Webhooks | Assuming events arrive in chronological order | Events can arrive out of order; always fetch current state from Stripe API rather than inferring state from event sequence |
| Stripe ACH | Not communicating the 1-4 business day ACH settlement delay to tenants | Inform tenants at payment time that ACH/bank transfer takes 1-4 days to confirm; avoid "payment confirmed" messaging until `payment_intent.succeeded` fires |
| Stripe ACH | Not building a failed payment flow (ACH has ~5-10% failure rate vs ~2% for cards) | Show a clear "payment failed" state; notify tenant via email + in-app; provide re-payment path |
| SMS Provider (Twilio, etc.) | Not configuring inbound webhook for STOP/opt-out handling | Register an inbound message webhook so STOP responses automatically update tenant consent status |
| Email Provider | Not setting up SPF/DKIM/DMARC records for your sending domain | Emails sent without proper DNS authentication land in spam; configure these before the first email goes out |
| File Storage | Serving uploaded documents via public URLs without access control | Files must require an authenticated request or be served via short-lived signed URLs; never expose storage bucket URLs directly |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Loading all tenant payment history on dashboard render | Dashboard is slow; admin waits 5+ seconds | Paginate payment history; default to current month view | At ~50-100 payment records per tenant |
| Sending all notifications synchronously in the request/response cycle | Rent due reminder causes a 10-second page load | Move all notification sends to a background job queue | First time you send to all 5 tenants simultaneously |
| N+1 queries on the admin dashboard (unit list → payment status per unit) | Admin dashboard slows down as units/tenants grow | Eager load payment status with units in a single query | At 10+ units (relevant for portfolio growth) |
| Generating PDF payment receipts synchronously | Receipt download times out for tenants | Generate PDFs asynchronously, store result, serve the cached file | First PDF that takes >2 seconds to generate |

Note: At 5 units, most of these won't manifest. The column "When It Breaks" is relevant only if the portfolio grows. Don't over-engineer for hypothetical scale now — but do not use patterns that make scaling impossible later.

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| No file type allowlist on document uploads | Tenant uploads a PHP/EXE file; if server processes it, arbitrary code execution | Accept only: PDF, JPG, JPEG, PNG, HEIC. Validate by MIME type, not just file extension. |
| Serving uploaded files from web-accessible paths | Any authenticated (or unauthenticated) user can guess another tenant's document URL | Store files outside the web root or in private cloud storage (S3 private bucket). Serve via signed URLs with 15-minute expiry. |
| Reusable QR code onboarding links | A person who finds a letter (prior tenant, neighbor) can claim a unit | Use single-use, expiring invitation tokens (see Pitfall 4) |
| Tenant can access other tenants' payment, maintenance, or document records via ID manipulation | Privacy violation; Fair Housing Act concern if data reveals protected class information | Enforce resource-level authorization scoping on every query (see Pitfall 5) |
| Admin portal exposed to the internet without rate limiting | Brute-force credential attacks against the landlord's login | Rate limit login attempts; implement account lockout after N failures; consider IP allowlisting for admin |
| Storing sensitive tenant PII (SSN, bank account numbers) in the portal database | Data breach exposes tenants to identity theft | Do not collect or store SSNs or full bank account numbers — Stripe handles payment credential storage; store only Stripe customer IDs |
| No audit log for admin actions | Landlord cannot prove what happened if a tenant disputes a record modification | Log all admin create/update/delete operations with timestamp and admin user ID |

---

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Tenant sees "payment failed" with no explanation or next step | Tenant panics, calls landlord, relationship damaged | Show the failure reason (insufficient funds, card expired, etc.) and a clear CTA to retry or update payment method |
| No payment confirmation screen or receipt | Tenant is unsure if their rent went through; calls landlord | Always show a confirmation screen after successful payment; send email receipt immediately |
| Maintenance request submitted but tenant gets no acknowledgment | Tenant assumes it was lost; submits duplicate; calls landlord | Send immediate in-app + email confirmation when a maintenance request is received; include a request number |
| Notification fatigue — sending SMS + email + in-app simultaneously for every event | Tenant opts out of all notifications | Send through one primary channel per event type; use channel fallback only when primary is undeliverable |
| Onboarding flow with too many steps before tenant can pay rent | Tenant abandons setup; landlord's core goal (collecting rent) is blocked | Minimize mandatory onboarding fields; let tenants complete their profile after they've paid once |
| Mobile-hostile payment flow | Tenant on phone (the primary device) can't pay | Design and test payment flow on mobile first; Stripe Checkout is mobile-optimized out of the box |
| No clear "what happens next" after submitting a maintenance request | Tenant doesn't know if anyone saw it | Show estimated response time; notify tenant when status changes (acknowledged, in progress, resolved) |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Stripe payment integration:** Looks done when checkout flow works — verify webhook handler exists, processes `payment_intent.succeeded`, is idempotent, and marks rent paid in the database independently of the redirect
- [ ] **QR code onboarding:** Looks done when the QR code opens a signup form — verify the token is single-use, time-limited, unit-specific, and marked consumed after account creation
- [ ] **Document uploads:** Looks done when files appear in the UI — verify files are stored in private storage (not public URL), only the owning tenant can retrieve them, and file type validation rejects executables
- [ ] **SMS notifications:** Looks done when texts are sent — verify TCPA opt-in consent is collected at onboarding, STOP keyword handling updates consent status in the DB, and no SMS is sent to opted-out tenants
- [ ] **Admin payment dashboard:** Looks done when payments show up — verify the dashboard reflects webhook-confirmed payments (not optimistic redirect state), and that partial payments and failures are surfaced clearly
- [ ] **Maintenance requests:** Looks done when the form submits — verify the admin gets notified of new requests, tenants get confirmation, and status changes notify tenants
- [ ] **Multi-channel notifications:** Looks done when emails send — verify SPF/DKIM/DMARC DNS records are configured, emails don't land in spam, and the provider is configured with your sending domain (not a default sandbox domain)
- [ ] **Tenant data isolation:** Looks done when each tenant only sees their own UI — verify API endpoints return 403/404 when a tenant tries to access another tenant's resource ID directly

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Webhook not idempotent — duplicate payment records created | MEDIUM | Query Stripe API for actual payment state; reconcile portal DB against Stripe records; identify and delete duplicate entries; notify affected tenants |
| Duplicate Stripe charges created (missing idempotency key) | HIGH | Issue Stripe refunds immediately; notify affected tenants proactively; audit all payments in the affected time window; add idempotency keys and redeploy |
| Tenant data leakage discovered (IDOR vulnerability) | HIGH | Immediately patch the authorization check; audit access logs to identify which records were accessed by which users; notify affected tenants if sensitive data was exposed |
| QR code was reusable — fraudulent account created for a unit | MEDIUM | Disable the fraudulent account; issue new single-use QR codes to legitimate tenants; audit which unit the fraudulent account attempted to access |
| SMS sent to non-consenting tenants | MEDIUM | Stop SMS sends immediately; send written apology; document the incident; implement consent checks before restarting |
| Uploaded files are publicly accessible (no auth on storage) | HIGH | Immediately move files to private storage; invalidate existing public URLs; audit who accessed which files; assess whether any PII documents were exposed |
| Payment status out of sync (redirect-based, not webhook-based) | MEDIUM | Manually reconcile portal payment status against Stripe dashboard; correct affected records; implement webhooks before any further payments are processed |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Webhook-first payment state | Payment integration phase | Test by completing a payment and closing the browser before redirect — rent must show as paid |
| Webhook idempotency | Payment integration phase | Send the same webhook payload twice — verify rent is only marked paid once, notification sent once |
| Idempotency keys on Stripe writes | Payment integration phase | Review all Stripe API write calls in code for presence of idempotency key |
| QR code single-use tokens | Tenant onboarding phase | Try scanning the same QR code twice — second attempt must fail with "invitation already used" |
| Cross-tenant data isolation | Auth and data model phase | Log in as tenant A, attempt to fetch tenant B's resource IDs via API — must return 403 or 404 |
| SMS TCPA consent tracking | Notification system phase | Verify `notifications_preferences` table exists with consent fields; send STOP to the test number and verify DB updates |
| File type allowlist on uploads | Document management phase | Attempt to upload a .php file — must be rejected before reaching storage |
| Private file storage with signed URLs | Document management phase | Obtain the file URL for tenant A's document while authenticated as tenant B — must be inaccessible |
| Admin rate limiting | Admin portal phase | Run a brute-force simulation against the login endpoint — must lock out after N attempts |
| SPF/DKIM/DMARC on email domain | Notification system phase | Use MXToolbox or mail-tester.com to verify DNS records before first production email send |
| Audit log for admin actions | Admin portal phase | Perform an admin edit and verify the action appears in the audit log with timestamp and user |

---

## Sources

- [Stripe: Idempotent Requests](https://docs.stripe.com/api/idempotent_requests) — HIGH confidence (official Stripe docs)
- [Stripe: Automate Payment Retries / Smart Retries](https://docs.stripe.com/billing/revenue-recovery/smart-retries) — HIGH confidence (official Stripe docs)
- [Stripe: ACH Direct Debit](https://docs.stripe.com/payments/ach-direct-debit) — HIGH confidence (official Stripe docs)
- [Stigg: Stripe Webhook Integration Best Practices](https://www.stigg.io/blog-posts/best-practices-i-wish-we-knew-when-integrating-stripe-webhooks) — MEDIUM confidence (practitioner post-mortem, verified against Stripe docs)
- [BCLP Law: TCPA New Opt-Out Rules April 2025](https://www.bclplaw.com/en-US/events-insights-news/the-tcpas-new-opt-out-rules-take-effect-on-april-11-2025-what-does-this-mean-for-businesses.html) — HIGH confidence (law firm, official FCC rule)
- [ActiveProspect: TCPA Opt-Out Requirements 2025](https://activeprospect.com/blog/tcpa-opt-out-requirements/) — MEDIUM confidence (industry compliance guide)
- [Menlo Security: 5 File Upload Cybersecurity Mistakes](https://www.menlosecurity.com/blog/the-5-file-upload-vulnerability-mistakes-youre-making-right-now) — MEDIUM confidence (security vendor, consistent with OWASP)
- [Moxo: Secure Document Upload Portals](https://www.moxo.com/blog/secure-document-upload-portal) — MEDIUM confidence (SaaS vendor, consistent with industry practice)
- [Security Boulevard: Tenant Isolation in Multi-Tenant Systems](https://securityboulevard.com/2025/12/tenant-isolation-in-multi-tenant-systems-architecture-identity-and-security/) — MEDIUM confidence (multiple independent sources agree)
- [Renting Well: Data Security Risks in Property Management Software](https://rentingwell.com/2025/07/26/data-security-risks-in-property-management-software/) — LOW confidence (single source, domain-specific)
- [MagicBell: SMS Notification Best Practices 2025](https://www.magicbell.com/blog/sms-notification-best-practices) — MEDIUM confidence (practitioner guide, consistent with TCPA guidance)
- [Handling Payment Webhooks Reliably](https://medium.com/@sohail_saifii/handling-payment-webhooks-reliably-idempotency-retries-validation-69b762720bf5) — LOW confidence (single practitioner post, consistent with Stripe official docs)

---
*Pitfalls research for: Self-hosted property management portal (5-unit residential)*
*Researched: 2026-02-25*
