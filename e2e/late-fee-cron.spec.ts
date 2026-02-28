import { test, expect } from "@playwright/test"

test.describe("Late Fee Cron Endpoint", () => {
  test("unauthorized request returns 401", async ({ request }) => {
    const response = await request.post("/api/cron/late-fees")
    expect(response.status()).toBe(401)

    const data = await response.json()
    expect(data.error).toBe("Unauthorized")
  })

  test("invalid bearer token returns 401", async ({ request }) => {
    const response = await request.post("/api/cron/late-fees", {
      headers: {
        authorization: "Bearer wrong-secret",
      },
    })
    expect(response.status()).toBe(401)
  })

  test("valid CRON_SECRET returns summary JSON", async ({ request }) => {
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
    expect(data).toHaveProperty("assessed")
    expect(data).toHaveProperty("skipped")
    expect(data).toHaveProperty("errors")
    expect(typeof data.assessed).toBe("number")
    expect(typeof data.skipped).toBe("number")
    expect(typeof data.errors).toBe("number")
  })

  test("cron response has no errors on clean run", async ({ request }) => {
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
    expect(data.errors).toBe(0)
  })
})
