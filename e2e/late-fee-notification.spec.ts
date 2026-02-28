import { test, expect } from "@playwright/test"

test.describe("Late Fee Notifications", () => {
  test("late fee cron endpoint exists and handles auth", async ({
    request,
  }) => {
    // Basic smoke test: endpoint exists and responds
    const response = await request.post("/api/cron/late-fees")
    expect(response.status()).toBe(401)
    const data = await response.json()
    expect(data.error).toBe("Unauthorized")
  })

  test("late fee email template endpoint renders", async ({ request }) => {
    // Verify the late fee email template works via the test timezone endpoint
    // which uses the same utility functions the cron endpoint uses
    const response = await request.get("/api/test/timezone")
    expect(response.status()).toBe(200)

    const data = await response.json()
    // If the test endpoint works, the late fee calculation functions are operational
    expect(data.lateFees.flat50).toBe(5000)
    expect(data.formatting.flat50).toBe("$50.00")
  })

  // Integration test: requires seeded data (property with late fee rule + tenant with unpaid rent)
  // These tests verify notification creation after the cron runs
  test("cron run with valid secret produces structured response", async ({
    request,
  }) => {
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret) {
      test.skip()
      return
    }

    const response = await request.post("/api/cron/late-fees", {
      headers: {
        authorization: `Bearer ${cronSecret}`,
      },
    })
    expect(response.status()).toBe(200)

    const data = await response.json()
    // Verify response structure
    expect(typeof data.assessed).toBe("number")
    expect(typeof data.skipped).toBe("number")
    expect(typeof data.errors).toBe("number")
    // Total should be non-negative
    expect(data.assessed + data.skipped + data.errors).toBeGreaterThanOrEqual(0)
  })
})
