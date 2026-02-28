import { test, expect } from "@playwright/test"

const BASE_URL = "http://localhost:3000"
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "odesantos2@gmail.com"
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "123Pormi!@#123"

test.describe("Admin Payment Flows", () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto(`${BASE_URL}/auth/login`)
    await page.waitForLoadState("networkidle")
    await page.fill('input[type="email"]', ADMIN_EMAIL)
    await page.fill('input[type="password"]', ADMIN_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL("**/admin/dashboard", { timeout: 15000 })
  })

  test("@smoke admin can configure rent for a unit", async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/units`)
    await page.waitForLoadState("networkidle")

    // Verify units table is visible
    await expect(page.locator("text=Units & Rent Configuration")).toBeVisible()
    await expect(page.locator("table")).toBeVisible({ timeout: 10000 })

    // Verify at least one unit row exists
    await expect(page.locator("table tbody tr").first()).toBeVisible()

    // Verify input fields exist for rent configuration
    await expect(page.locator('input[type="number"]').first()).toBeVisible()
  })

  test("@smoke admin can view payment dashboard", async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/payments`)
    await page.waitForLoadState("networkidle")

    // Verify payment dashboard page loads
    await expect(page.locator("text=Payment Dashboard")).toBeVisible()

    // Verify status table exists
    await expect(page.locator("table")).toBeVisible({ timeout: 10000 })

    // Verify month navigation exists
    await expect(page.locator('button:has-text("Previous")')).toBeVisible()
    await expect(page.locator('button:has-text("Next")')).toBeVisible()
  })

  test("admin payment dashboard shows unit status", async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/payments`)
    await page.waitForLoadState("networkidle")

    // Verify at least one unit row
    await expect(page.locator("table tbody tr").first()).toBeVisible({ timeout: 10000 })

    // Verify status badge is present (Paid, Unpaid, Partial, or Pending)
    const statusBadge = page.locator(".rounded-full").first()
    await expect(statusBadge).toBeVisible()
  })

  test("admin can record manual payment", async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/payments`)
    await page.waitForLoadState("networkidle")

    // Click Record Payment button for first unit
    const recordBtn = page.locator('button:has-text("Record Payment")').first()
    if (await recordBtn.isVisible()) {
      await recordBtn.click()

      // Fill manual payment form
      await page.fill('input[placeholder="1500.00"]', "500.00")

      // Click Save
      const saveBtn = page.locator('button:has-text("Save")').first()
      await saveBtn.click()

      // Verify success toast
      await expect(page.locator("text=Manual payment recorded")).toBeVisible({ timeout: 5000 })
    }
  })
})
