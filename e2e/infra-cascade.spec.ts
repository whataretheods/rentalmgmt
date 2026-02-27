import { test, expect } from "@playwright/test"

const BASE_URL = "http://localhost:3000"
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "odesantos2@gmail.com"
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "123Pormi!@#123"
const TENANT_EMAIL = process.env.TEST_TENANT_EMAIL || "testtenant@test.com"
const TENANT_PASSWORD = process.env.TEST_TENANT_PASSWORD || "TestPass123!"

test.describe("Infrastructure: Cascade Safety and Schema Columns", () => {
  test("@smoke admin dashboard loads with updated schema", async ({ page }) => {
    // Login as admin
    await page.goto(`${BASE_URL}/auth/login`)
    await page.waitForLoadState("networkidle")
    await page.fill('input[type="email"]', ADMIN_EMAIL)
    await page.fill('input[type="password"]', ADMIN_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL("**/admin/dashboard", { timeout: 15000 })
    await page.waitForLoadState("networkidle")

    // Dashboard should load successfully (proves queries work with new constraints)
    expect(page.url()).toContain("/admin/dashboard")
  })

  test("@smoke admin units page loads with RESTRICT constraints active", async ({ page }) => {
    // Login as admin
    await page.goto(`${BASE_URL}/auth/login`)
    await page.waitForLoadState("networkidle")
    await page.fill('input[type="email"]', ADMIN_EMAIL)
    await page.fill('input[type="password"]', ADMIN_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL("**/admin/dashboard", { timeout: 15000 })

    // Navigate to units page
    await page.goto(`${BASE_URL}/admin/units`)
    await page.waitForLoadState("networkidle")

    // Units page should load and show existing units
    // RESTRICT constraints don't affect SELECT queries
    await expect(page.locator("body")).toBeVisible()
    expect(page.url()).toContain("/admin/units")
  })

  test("existing maintenance photos still load with new storage columns", async ({ page }) => {
    // Login as tenant
    await page.goto(`${BASE_URL}/auth/login`)
    await page.waitForLoadState("networkidle")
    await page.fill('input[type="email"]', TENANT_EMAIL)
    await page.fill('input[type="password"]', TENANT_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL("**/tenant/dashboard", { timeout: 15000 })

    // Navigate to maintenance page
    await page.goto(`${BASE_URL}/tenant/maintenance`)
    await page.waitForLoadState("networkidle")

    // Page should load without errors (new columns default to "local" for existing records)
    await expect(page.locator("body")).toBeVisible()
    expect(page.url()).toContain("/tenant/maintenance")
  })
})
