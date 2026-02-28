import { describe, it, expect } from "vitest"
import { daysSinceRentDue, getLocalDate } from "@/lib/timezone"

const TZ = "America/New_York"

describe("getLocalDate", () => {
  it("returns correct year, month, day for a known reference date", () => {
    const result = getLocalDate(TZ, new Date(2026, 0, 15, 12, 0, 0)) // Jan 15, 2026 noon local
    expect(result.year).toBe(2026)
    expect(result.month).toBe(1)
    expect(result.day).toBe(15)
  })

  it("handles timezone offset near midnight (UTC vs ET)", () => {
    // Jan 1 00:30 UTC = Dec 31 19:30 ET (previous day)
    const utcMidnightJan1 = new Date(Date.UTC(2026, 0, 1, 0, 30, 0))
    const result = getLocalDate(TZ, utcMidnightJan1)
    expect(result.year).toBe(2025)
    expect(result.month).toBe(12)
    expect(result.day).toBe(31)
  })
})

describe("daysSinceRentDue", () => {
  it("returns 0 on the due day itself", () => {
    // Jan 28, 2026
    const result = daysSinceRentDue(28, TZ, new Date(2026, 0, 28, 12, 0, 0))
    expect(result).toBe(0)
  })

  it("returns 0 on due day = 1st", () => {
    // Jan 1, 2026
    const result = daysSinceRentDue(1, TZ, new Date(2026, 0, 1, 12, 0, 0))
    expect(result).toBe(0)
  })

  it("returns correct positive value for same-month check", () => {
    // Due day = 1, current day = 15 Jan 2026 -> 14 days since
    const result = daysSinceRentDue(1, TZ, new Date(2026, 0, 15, 12, 0, 0))
    expect(result).toBe(14)
  })

  it("returns correct positive value across month boundary (due 28, now Feb 2)", () => {
    // Due day = 28, current = Feb 2, 2026
    // Jan has 31 days, so Jan 28 -> Feb 2 = 5 days
    const result = daysSinceRentDue(28, TZ, new Date(2026, 1, 2, 12, 0, 0))
    expect(result).toBe(5)
  })

  it("handles before due day by using last month's occurrence", () => {
    // Due day = 20, current = Feb 5, 2026
    // Last occurrence was Jan 20 -> Feb 5 = 16 days
    const result = daysSinceRentDue(20, TZ, new Date(2026, 1, 5, 12, 0, 0))
    expect(result).toBe(16)
  })

  it("handles February clamping for due day 31", () => {
    // Due day = 31, current = Feb 15, 2026 (non-leap year)
    // Feb has 28 days, so due day clamps to Jan 31 (since 15 < 31, goes to previous month)
    // Jan has 31 days, due day = 31. Jan 31 -> Feb 15 = 15 days
    const result = daysSinceRentDue(31, TZ, new Date(2026, 1, 15, 12, 0, 0))
    expect(result).toBe(15)
  })

  it("handles February clamping for due day 29 in non-leap year", () => {
    // Due day = 29, current = Mar 5, 2026
    // March due day = 29 but day is 5, so 5 >= 29 is false -> uses previous month (Feb)
    // Feb 2026 has 28 days, clamp to 28. Feb 28 -> Mar 5 = 5 days
    const result = daysSinceRentDue(29, TZ, new Date(2026, 2, 5, 12, 0, 0))
    expect(result).toBe(5)
  })

  it("handles leap year February correctly", () => {
    // Due day = 29, current = Mar 5, 2028 (leap year)
    // 5 < 29, use previous month (Feb). Feb 2028 has 29 days. Feb 29 -> Mar 5 = 5 days
    const result = daysSinceRentDue(29, TZ, new Date(2028, 2, 5, 12, 0, 0))
    expect(result).toBe(5)
  })

  it("handles year boundary (due 28, now Jan 2)", () => {
    // Due day = 28, current = Jan 2, 2026
    // 2 < 28, use previous month (Dec 2025). Dec has 31 days, due = 28.
    // Dec 28 -> Jan 2 = 5 days
    const result = daysSinceRentDue(28, TZ, new Date(2026, 0, 2, 12, 0, 0))
    expect(result).toBe(5)
  })
})
