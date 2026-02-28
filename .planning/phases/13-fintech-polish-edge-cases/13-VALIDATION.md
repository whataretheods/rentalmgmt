---
phase: 13
slug: fintech-polish-edge-cases
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-02-27
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | none — Wave 0 installs |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose && npx playwright test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose && npx playwright test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 13-01-01 | 01 | 0 | Infra | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 13-02-01 | 02 | 1 | Date math | unit | `npx vitest run src/lib/__tests__/timezone.test.ts` | ❌ W0 | ⬜ pending |
| 13-03-01 | 03 | 1 | Pending balance | unit | `npx vitest run src/lib/__tests__/ledger.test.ts` | ❌ W0 | ⬜ pending |
| 13-04-01 | 04 | 1 | Cookie fix | unit | `npx vitest run src/__tests__/middleware.test.ts` | ❌ W0 | ⬜ pending |
| 13-05-01 | 05 | 2 | Chargebacks | unit+e2e | `npx vitest run && npx playwright test` | ❌ W0 | ⬜ pending |
| 13-06-01 | 06 | 2 | NSF handling | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 13-07-01 | 07 | 2 | Proration | unit+e2e | `npx vitest run && npx playwright test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest` + `@vitejs/plugin-react` — install and configure
- [ ] `vitest.config.ts` — project config with path aliases
- [ ] `src/lib/__tests__/timezone.test.ts` — stubs for date math
- [ ] `src/lib/__tests__/ledger.test.ts` — stubs for balance queries

*Wave 0 installs Vitest and creates test stubs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| ACH pending balance display | Pending UX | Requires Stripe test mode ACH settlement timing | Create test payment via Stripe dashboard, verify portal shows pending |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
