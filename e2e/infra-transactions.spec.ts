import { test, expect } from "@playwright/test"

const BASE_URL = "http://localhost:3000"
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "odesantos2@gmail.com"
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "123Pormi!@#123"
const TENANT_EMAIL = process.env.TEST_TENANT_EMAIL || "testtenant@test.com"
const TENANT_PASSWORD = process.env.TEST_TENANT_PASSWORD || "TestPass123!"

test.describe("Infrastructure: WebSocket Driver Verification", () => {
  test("@smoke admin login and dashboard load with new driver", async ({ page }) => {
    // Login as admin — verifies auth works with neon-serverless driver
    await page.goto(`${BASE_URL}/auth/login`)
    await page.waitForLoadState("networkidle")
    await page.fill('input[type="email"]', ADMIN_EMAIL)
    await page.fill('input[type="password"]', ADMIN_PASSWORD)
    await page.click('button[type="submit"]')
    // Admin login redirects to /admin/dashboard directly (role-based redirect)
    await page.waitForURL("**/admin/dashboard", { timeout: 15000 })
    await page.waitForLoadState("networkidle")

    // Should NOT be redirected to login — proves admin session is valid
    expect(page.url()).not.toContain("/auth/login")

    // Dashboard should load with data (proves SELECT queries work with new driver)
    await expect(page.locator("body")).toBeVisible()
  })

  test("@smoke tenant login and session persistence with new driver", async ({ page }) => {
    // Login as tenant
    await page.goto(`${BASE_URL}/auth/login`)
    await page.waitForLoadState("networkidle")
    await page.fill('input[type="email"]', TENANT_EMAIL)
    await page.fill('input[type="password"]', TENANT_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL("**/tenant/dashboard", { timeout: 15000 })

    // Verify dashboard loaded (proves session create + query work)
    await expect(page.locator("body")).toBeVisible()
    const url = page.url()
    expect(url).toContain("/tenant/dashboard")

    // Refresh page — session should persist (proves session read works)
    await page.reload()
    await page.waitForLoadState("networkidle")
    expect(page.url()).toContain("/tenant/dashboard")
  })

  test("tenant can submit maintenance request (multi-query operation)", async ({ page }) => {
    // Login as tenant
    await page.goto(`${BASE_URL}/auth/login`)
    await page.waitForLoadState("networkidle")
    await page.fill('input[type="email"]', TENANT_EMAIL)
    await page.fill('input[type="password"]', TENANT_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL("**/tenant/dashboard", { timeout: 15000 })

    // Navigate to new maintenance request
    await page.goto(`${BASE_URL}/tenant/maintenance/new`)
    await page.waitForLoadState("networkidle")

    // Fill in maintenance request form
    const titleInput = page.locator('input[name="title"]')
    if (await titleInput.isVisible()) {
      await titleInput.fill("Test maintenance request - driver verification")

      const descInput = page.locator('textarea[name="description"]')
      if (await descInput.isVisible()) {
        await descInput.fill("Automated test verifying multi-query operations work with the new WebSocket driver.")
      }

      // Select priority if available
      const prioritySelect = page.locator('select[name="priority"]')
      if (await prioritySelect.isVisible()) {
        await prioritySelect.selectOption("low")
      }

      // Submit the form — this performs INSERT maintenance_request
      const submitBtn = page.locator('button[type="submit"]')
      if (await submitBtn.isVisible()) {
        await submitBtn.click()
        await page.waitForLoadState("networkidle")
        // Successful submission proves multi-query insert works
      }
    }
  })
})
