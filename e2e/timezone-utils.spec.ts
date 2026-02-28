import { test, expect } from "@playwright/test"

test.describe("Timezone & Late Fee Utilities", () => {
  test("getLocalDate returns valid dates across timezones", async ({
    request,
  }) => {
    const response = await request.get("/api/test/timezone")
    expect(response.status()).toBe(200)

    const data = await response.json()

    // New York date should be valid
    expect(data.dates.newYork.year).toBeGreaterThanOrEqual(2026)
    expect(data.dates.newYork.month).toBeGreaterThanOrEqual(1)
    expect(data.dates.newYork.month).toBeLessThanOrEqual(12)
    expect(data.dates.newYork.day).toBeGreaterThanOrEqual(1)
    expect(data.dates.newYork.day).toBeLessThanOrEqual(31)

    // Honolulu date should also be valid
    expect(data.dates.honolulu.year).toBeGreaterThanOrEqual(2026)
    expect(data.dates.honolulu.month).toBeGreaterThanOrEqual(1)
    expect(data.dates.honolulu.month).toBeLessThanOrEqual(12)
    expect(data.dates.honolulu.day).toBeGreaterThanOrEqual(1)
    expect(data.dates.honolulu.day).toBeLessThanOrEqual(31)
  })

  test("getLocalBillingPeriod returns YYYY-MM format", async ({ request }) => {
    const response = await request.get("/api/test/timezone")
    expect(response.status()).toBe(200)

    const data = await response.json()
    expect(data.billingPeriod).toMatch(/^\d{4}-\d{2}$/)
  })

  test("daysSinceRentDue returns correct values", async ({ request }) => {
    const response = await request.get("/api/test/timezone")
    expect(response.status()).toBe(200)

    const data = await response.json()
    const currentDay = data.dates.newYork.day

    // Due day 1: should equal currentDay - 1
    expect(data.daysSinceRentDue.dueDay1).toBe(currentDay - 1)

    // Due day 15: should equal currentDay - 15
    expect(data.daysSinceRentDue.dueDay15).toBe(currentDay - 15)

    // Due day 28: should equal currentDay - 28
    expect(data.daysSinceRentDue.dueDay28).toBe(currentDay - 28)
  })

  test("calculateLateFee flat fee returns exact amount", async ({
    request,
  }) => {
    const response = await request.get("/api/test/timezone")
    expect(response.status()).toBe(200)

    const data = await response.json()
    // Flat $50 fee on $1500 rent = 5000 cents
    expect(data.lateFees.flat50).toBe(5000)
  })

  test("calculateLateFee percentage returns correct amount", async ({
    request,
  }) => {
    const response = await request.get("/api/test/timezone")
    expect(response.status()).toBe(200)

    const data = await response.json()
    // 5% of $1500 = $75 = 7500 cents
    expect(data.lateFees.percentage5).toBe(7500)
  })

  test("calculateLateFee percentage with cap is capped", async ({
    request,
  }) => {
    const response = await request.get("/api/test/timezone")
    expect(response.status()).toBe(200)

    const data = await response.json()
    // 10% of $1500 = $150, but capped at $100 = 10000 cents
    expect(data.lateFees.percentage10Capped100).toBe(10000)
  })

  test("US_TIMEZONES has 6 entries", async ({ request }) => {
    const response = await request.get("/api/test/timezone")
    expect(response.status()).toBe(200)

    const data = await response.json()
    expect(data.usTimezoneCount).toBe(6)

    // Verify all US timezone values are present
    const tzValues = data.usTimezones.map(
      (tz: { value: string }) => tz.value
    )
    expect(tzValues).toContain("America/New_York")
    expect(tzValues).toContain("America/Chicago")
    expect(tzValues).toContain("America/Denver")
    expect(tzValues).toContain("America/Los_Angeles")
    expect(tzValues).toContain("America/Anchorage")
    expect(tzValues).toContain("Pacific/Honolulu")
  })

  test("formatCentsAsDollars produces correct format", async ({ request }) => {
    const response = await request.get("/api/test/timezone")
    expect(response.status()).toBe(200)

    const data = await response.json()
    expect(data.formatting.flat50).toBe("$50.00")
    expect(data.formatting.percentage5).toBe("$75.00")
  })
})
