---
phase: 14
slug: audit-gap-closure
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-02-28
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x |
| **Config file** | vitest.config.mts |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 14-01-01 | 01 | 1 | LEDG-03 | visual | Playwright snapshot | ✅ | ⬜ pending |
| 14-01-02 | 01 | 1 | LATE-02 | visual | Playwright snapshot | ✅ | ⬜ pending |
| 14-02-01 | 02 | 1 | INFRA-03 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 14-02-02 | 02 | 1 | OPS-02 | visual | Playwright snapshot | ✅ | ⬜ pending |
| 14-02-03 | 02 | 1 | FIN-04 | visual | Playwright snapshot | ✅ | ⬜ pending |
| 14-03-01 | 03 | 2 | AUX-02 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 14-03-02 | 03 | 2 | OPS-04 | visual | Playwright snapshot | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- Vitest already installed (Phase 13)
- Existing test infrastructure covers most requirements
- KPI query tests may need new unit test file

*Existing infrastructure covers most phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Timezone dropdown renders correctly | INFRA-03 | Visual UI element | Open property edit form, verify timezone dropdown shows US timezones |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
