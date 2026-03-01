# Milestones

## v2.1 Production Hardening (Shipped: 2026-03-01)

**Phases:** 15-16 | **Plans:** 4 | **Requirements:** 5/5 satisfied
**Timeline:** 2026-02-28 (1 day, 14 commits)

**Key accomplishments:**
- Balance-based late fee assessment closes partial payment loophole (HARD-01)
- UPSERT webhook handlers prevent ACH payments stuck in pending (HARD-02)
- DST-proof daysSinceRentDue with Date.UTC() and 4 boundary tests (HARD-03, HARD-04)
- Full session validation in tenant middleware — revoked/expired sessions rejected (HARD-05)
- Zero new tech debt introduced; 60 tests passing, 0 regressions

---

