import { test, expect } from "@playwright/test"

const BASE_URL = "http://localhost:3000"
const TENANT_EMAIL = process.env.TEST_TENANT_EMAIL || "testtenant@test.com"
const TENANT_PASSWORD = process.env.TEST_TENANT_PASSWORD || "TestPass123!"

test.describe("Autopay", () => {
  test.beforeEach(async ({ page }) => {
    // Login as tenant
    await page.goto(`${BASE_URL}/auth/login`)
    await page.waitForLoadState("networkidle")
    await page.fill('input[type="email"]', TENANT_EMAIL)
    await page.fill('input[type="password"]', TENANT_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL("**/tenant/dashboard", { timeout: 15000 })
  })

  test("@smoke autopay page loads and shows heading", async ({ page }) => {
    await page.goto(`${BASE_URL}/tenant/autopay`)
    await page.waitForLoadState("networkidle")

    // Should show autopay heading
    await expect(page.locator("h1:has-text('Autopay')")).toBeVisible({
      timeout: 10000,
    })
  })

  test("autopay status card shown on dashboard", async ({ page }) => {
    // After seeding, dashboard should show autopay-related content
    await page.goto(`${BASE_URL}/tenant/dashboard`)
    await page.waitForLoadState("networkidle")

    // Look for autopay-related content (status card)
    const autopaySection = page.locator("text=/autopay/i").first()
    await expect(autopaySection).toBeVisible({ timeout: 10000 })
  })

  test("autopay page shows cancellation option when enrolled", async ({
    page,
  }) => {
    // Requires seed:autopay-test to have been run
    await page.goto(`${BASE_URL}/tenant/autopay`)
    await page.waitForLoadState("networkidle")

    // Should see cancel button if enrolled with active status
    const cancelButton = page.locator("text=/cancel/i").first()
    // The test validates the page loads without error and shows enrollment content
    await expect(page).toHaveURL(/\/tenant\/autopay/)
    // If enrolled, cancel button should be visible
    await expect(cancelButton).toBeVisible({ timeout: 10000 })
  })

  test("autopay page shows fee transparency", async ({ page }) => {
    await page.goto(`${BASE_URL}/tenant/autopay`)
    await page.waitForLoadState("networkidle")

    // Should show processing fee information when enrolled
    const feeInfo = page.locator("text=/processing fee/i").first()
    // Page should load without error
    await expect(page).toHaveURL(/\/tenant\/autopay/)
    // If enrolled, fee info should be visible
    await expect(feeInfo).toBeVisible({ timeout: 10000 })
  })

  test("autopay page shows payment method details when enrolled", async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/tenant/autopay`)
    await page.waitForLoadState("networkidle")

    // Should show Visa ending in 4242 from seeded data
    const paymentMethod = page.locator("text=/4242/").first()
    await expect(paymentMethod).toBeVisible({ timeout: 10000 })
  })
})
