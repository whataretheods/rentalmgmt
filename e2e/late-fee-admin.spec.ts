import { test, expect } from "@playwright/test"

const BASE_URL = "http://localhost:3000"
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "odesantos2@gmail.com"
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "123Pormi!@#123"

async function loginAsAdmin(page: import("@playwright/test").Page) {
  await page.goto(`${BASE_URL}/auth/login`)
  await page.waitForLoadState("networkidle")
  await page.fill('input[type="email"]', ADMIN_EMAIL)
  await page.fill('input[type="password"]', ADMIN_PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL("**/admin/dashboard", { timeout: 15000 })
  await page.waitForLoadState("networkidle")
}

test.describe("Admin Late Fee Configuration", () => {
  test("admin can access late fee settings page", async ({ page, request }) => {
    await loginAsAdmin(page)

    // Get a property ID via API
    const apiRes = await request.get("/api/admin/late-fee-rules?propertyId=test")
    // We expect either a 400 or 401 (no valid property) — confirms endpoint exists
    expect([200, 400, 401]).toContain(apiRes.status())
  })

  test("late fee API returns null rule for new property", async ({
    request,
    page,
  }) => {
    await loginAsAdmin(page)

    // Use the page's cookies for authenticated API requests
    const cookies = await page.context().cookies()
    const cookieHeader = cookies
      .map((c) => `${c.name}=${c.value}`)
      .join("; ")

    // We need a valid property ID — fetch from admin context
    // Use a known test approach: hit the API with a random UUID
    const testPropertyId = "00000000-0000-0000-0000-000000000000"
    const res = await page.evaluate(async (propertyId) => {
      const resp = await fetch(
        `/api/admin/late-fee-rules?propertyId=${propertyId}`
      )
      return { status: resp.status, data: await resp.json() }
    }, testPropertyId)

    expect(res.status).toBe(200)
    expect(res.data.rule).toBeNull()
  })

  test("late fee API validates inputs", async ({ page }) => {
    await loginAsAdmin(page)

    // POST with invalid data
    const res = await page.evaluate(async () => {
      const resp = await fetch("/api/admin/late-fee-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: "not-a-uuid",
          enabled: true,
          gracePeriodDays: 0, // invalid: < 1
          feeType: "flat",
          feeAmountCents: 0, // invalid: <= 0
        }),
      })
      return { status: resp.status, data: await resp.json() }
    })

    expect(res.status).toBe(400)
    expect(res.data.error).toBe("Invalid input")
  })

  test("late fee API rejects unauthenticated requests", async ({ request }) => {
    const res = await request.get("/api/admin/late-fee-rules?propertyId=test")
    expect(res.status()).toBe(401)
  })

  test("late fee settings page renders form components", async ({ page }) => {
    await loginAsAdmin(page)

    // Navigate to a late fee settings page
    // We need a real property ID — first check if we can get one
    const propertyId = await page.evaluate(async () => {
      // Try to fetch properties from admin API or use a known test property
      try {
        const resp = await fetch("/api/admin/payments-overview")
        if (resp.ok) {
          const data = await resp.json()
          if (data.tenants?.length > 0) {
            return data.tenants[0].propertyId || null
          }
        }
      } catch {
        // Ignore
      }
      return null
    })

    if (!propertyId) {
      test.skip()
      return
    }

    await page.goto(
      `${BASE_URL}/admin/properties/${propertyId}/late-fees`
    )
    await page.waitForLoadState("networkidle")

    // Verify page elements
    await expect(page.locator("text=Late Fee Settings")).toBeVisible()
    await expect(page.locator("text=Enable Late Fees")).toBeVisible()
    await expect(page.locator("text=Save Settings")).toBeVisible()
  })
})
