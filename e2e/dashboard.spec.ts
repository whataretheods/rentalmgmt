import { test, expect } from "@playwright/test"

const BASE_URL = "http://localhost:3000"
const TENANT_EMAIL = process.env.TEST_TENANT_EMAIL || "testtenant@test.com"
const TENANT_PASSWORD = process.env.TEST_TENANT_PASSWORD || "TestPass123!"

test.describe("Dashboard Consolidation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/auth/login`)
    await page.waitForLoadState("networkidle")
    await page.fill('input[type="email"]', TENANT_EMAIL)
    await page.fill('input[type="password"]', TENANT_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL("**/tenant/dashboard", { timeout: 15000 })
  })

  test("@smoke dashboard shows payment summary section", async ({ page }) => {
    // Payment section should be at the top (payment-first layout)
    // PaymentSummaryCard shows rent amount, due date, last payment
    const rentAmount = page.locator("text=/\\$1,500/").first()
    await expect(rentAmount).toBeVisible({ timeout: 10000 })

    // Verify due date section exists
    const dueDate = page.locator("text=Next Due Date").first()
    await expect(dueDate).toBeVisible()

    // Verify last payment section exists
    const lastPayment = page.locator("text=/Last Payment/i").first()
    await expect(lastPayment).toBeVisible()
  })

  test("@smoke dashboard shows pay rent button", async ({ page }) => {
    const payButton = page.locator('button:has-text("Pay Rent")')
    await expect(payButton).toBeVisible({ timeout: 10000 })
  })

  test("@smoke dashboard has autopay section", async ({ page }) => {
    // AutopayStatusCard should be visible on dashboard
    const autopayContent = page.locator("text=/autopay/i").first()
    await expect(autopayContent).toBeVisible({ timeout: 10000 })
  })

  test("dashboard has maintenance section", async ({ page }) => {
    // Should show maintenance section (may be empty state)
    const maintenanceContent = page.locator("text=/maintenance/i").first()
    await expect(maintenanceContent).toBeVisible({ timeout: 10000 })
  })

  test("dashboard has notifications section", async ({ page }) => {
    const notifContent = page.locator("text=/notification/i").first()
    await expect(notifContent).toBeVisible({ timeout: 10000 })
  })

  test("dashboard renders correctly at mobile width", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(`${BASE_URL}/tenant/dashboard`)
    await page.waitForLoadState("networkidle")

    // No horizontal overflow
    const hasOverflow = await page.evaluate(() => {
      return (
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth
      )
    })
    expect(hasOverflow).toBe(false)

    // Verify key sections are still visible at mobile width
    const rentAmount = page.locator("text=/\\$1,500/").first()
    await expect(rentAmount).toBeVisible({ timeout: 10000 })
  })
})
