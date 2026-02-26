---
phase: 4
slug: maintenance-documents-and-profiles
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-02-26
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright 1.58.x (E2E) |
| **Config file** | playwright.config.ts |
| **Quick run command** | `npm run build` |
| **Full suite command** | `npx playwright test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run build`
- **After every plan wave:** Run `npx playwright test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | MAINT-01, MAINT-02, MAINT-03, DOC-01, DOC-02, TMGMT-01 | build | `npm run build` | N/A | pending |
| 04-01-02 | 01 | 1 | MAINT-01, MAINT-02, MAINT-03, DOC-01, DOC-02, TMGMT-01 | build | `npm run build` | N/A | pending |
| 04-02-01 | 02 | 1 | MAINT-01 | build | `npm run build` | N/A | pending |
| 04-02-02 | 02 | 1 | MAINT-01, MAINT-02 | build | `npm run build` | N/A | pending |
| 04-03-01 | 03 | 1 | DOC-01, DOC-02 | build | `npm run build` | N/A | pending |
| 04-03-02 | 03 | 1 | DOC-01, DOC-02 | build | `npm run build` | N/A | pending |
| 04-04-01 | 04 | 2 | MAINT-03 | build | `npm run build` | N/A | pending |
| 04-04-02 | 04 | 2 | MAINT-03 | build | `npm run build` | N/A | pending |
| 04-05-01 | 05 | 2 | TMGMT-01 | build | `npm run build` | N/A | pending |
| 04-05-02 | 05 | 2 | TMGMT-01 | build | `npm run build` | N/A | pending |
| 04-06-01 | 06 | 3 | ALL | E2E | `npx playwright test e2e/phase4.spec.ts` | Wave 0 | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `e2e/maintenance.spec.ts` -- covers MAINT-01, MAINT-02
- [ ] `e2e/admin-maintenance.spec.ts` -- covers MAINT-03
- [ ] `e2e/documents.spec.ts` -- covers DOC-01, DOC-02
- [ ] `e2e/profile.spec.ts` -- covers TMGMT-01

*Note: E2E tests will be created as part of the final verification plan.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Drag-and-drop kanban feels responsive | MAINT-03 | DnD interaction quality is subjective | Drag cards between columns, verify smooth animation |
| Photo thumbnail preview renders correctly | MAINT-01 | Visual rendering quality check | Upload various image types, verify thumbnails display |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
