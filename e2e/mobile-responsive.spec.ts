import { test, expect } from "@playwright/test"

const BASE_URL = "http://localhost:3000"
const TENANT_EMAIL = process.env.TEST_TENANT_EMAIL || "testtenant@test.com"
const TENANT_PASSWORD = process.env.TEST_TENANT_PASSWORD || "TestPass123!"

// All tests run at 375px width (iPhone SE/small mobile)
test.use({ viewport: { width: 375, height: 812 } })

test.describe("Mobile Responsiveness (375px)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/auth/login`)
    await page.waitForLoadState("networkidle")
    await page.fill('input[type="email"]', TENANT_EMAIL)
    await page.fill('input[type="password"]', TENANT_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL("**/tenant/dashboard", { timeout: 15000 })
  })

  const tenantPages = [
    { name: "Dashboard", path: "/tenant/dashboard" },
    { name: "Payments", path: "/tenant/payments" },
    { name: "Maintenance", path: "/tenant/maintenance" },
    { name: "Documents", path: "/tenant/documents" },
    { name: "Profile", path: "/tenant/profile" },
    { name: "Notifications", path: "/tenant/notifications" },
    { name: "Autopay", path: "/tenant/autopay" },
  ]

  for (const { name, path } of tenantPages) {
    test(`${name} page renders without horizontal overflow at 375px`, async ({
      page,
    }) => {
      await page.goto(`${BASE_URL}${path}`)
      await page.waitForLoadState("networkidle")

      // Check that the page doesn't have horizontal overflow
      const hasOverflow = await page.evaluate(() => {
        return (
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth
        )
      })
      expect(hasOverflow).toBe(false)

      // Check that the page body is visible
      const body = page.locator("body")
      await expect(body).toBeVisible()

      // Verify no content is cut off (page height should be reasonable)
      const height = await page.evaluate(() => document.body.scrollHeight)
      expect(height).toBeGreaterThan(100)
    })
  }
})
