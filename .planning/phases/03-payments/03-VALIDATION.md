---
phase: 3
slug: payments
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-02-26
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright (e2e) |
| **Config file** | none — Wave 0 installs |
| **Quick run command** | `npx playwright test --grep @smoke` |
| **Full suite command** | `npx playwright test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx playwright test --grep @smoke`
- **After every plan wave:** Run `npx playwright test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | PAY-01 | unit | `npx playwright test e2e/payments.spec.ts --grep "checkout"` | -- W0 | pending |
| 03-02-01 | 02 | 1 | PAY-04 | e2e | `npx playwright test e2e/admin-payments.spec.ts --grep "rent config"` | -- W0 | pending |
| 03-03-01 | 03 | 2 | PAY-01 | e2e | `npx playwright test e2e/payments.spec.ts --grep "pay rent"` | -- W0 | pending |
| 03-03-02 | 03 | 2 | NOTIF-02 | manual | Check Resend logs for confirmation email | N/A | pending |
| 03-04-01 | 04 | 3 | PAY-03 | e2e | `npx playwright test e2e/payments.spec.ts --grep "dashboard"` | -- W0 | pending |
| 03-04-02 | 04 | 3 | PAY-02 | e2e | `npx playwright test e2e/payments.spec.ts --grep "history"` | -- W0 | pending |
| 03-05-01 | 05 | 3 | PAY-05 | e2e | `npx playwright test e2e/admin-payments.spec.ts --grep "dashboard"` | -- W0 | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] Install Playwright: `npm install -D @playwright/test && npx playwright install chromium`
- [ ] Create `playwright.config.ts` with baseURL `http://localhost:3000`
- [ ] Create `e2e/payments.spec.ts` — stubs for PAY-01, PAY-02, PAY-03
- [ ] Create `e2e/admin-payments.spec.ts` — stubs for PAY-04, PAY-05
- [ ] Seed script for payment test data (unit with rent config, tenant linked)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Email confirmation received | NOTIF-02 | Requires checking actual email delivery via Resend | 1. Make test payment 2. Check Resend dashboard for sent email 3. Verify email content |
| ACH payment flow | PAY-01 (ACH) | Stripe Financial Connections dialog cannot be automated | 1. Use Stripe test mode 2. Select ACH payment 3. Complete bank verification 4. Verify pending status in DB |
| PDF receipt download | PAY-02 | PDF content verification is visual | 1. Download receipt PDF 2. Verify it opens and contains correct payment details |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
