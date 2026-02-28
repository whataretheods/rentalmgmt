import { test, expect } from "@playwright/test"

const BASE_URL = "http://localhost:3000"
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "odesantos2@gmail.com"
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "123Pormi!@#123"

test.describe("Admin Empty States", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/auth/login`)
    await page.waitForLoadState("networkidle")
    await page.fill('input[type="email"]', ADMIN_EMAIL)
    await page.fill('input[type="password"]', ADMIN_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL("**/admin/dashboard", { timeout: 15000 })
    await page.waitForLoadState("networkidle")
  })

  test("users page has empty state or data", async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/users`)
    await page.waitForLoadState("networkidle")

    // Either UserTable with rows visible OR empty state with "No tenants yet"
    const hasData = page.locator("table tbody tr")
    const hasEmptyState = page.getByText("No tenants yet")
    await expect(hasData.first().or(hasEmptyState)).toBeVisible({ timeout: 10000 })
  })

  test("units page has empty state or data", async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/units`)
    await page.waitForLoadState("networkidle")

    // Either table rows visible OR "No units configured"
    const hasData = page.locator("table tbody tr")
    const hasEmptyState = page.getByText("No units configured")
    await expect(hasData.first().or(hasEmptyState)).toBeVisible({ timeout: 10000 })
  })

  test("payments page has empty state or data", async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/payments`)
    await page.waitForLoadState("networkidle")

    // Either payment data visible OR "No payments recorded"
    const hasData = page.locator("table").first()
    const hasEmptyState = page.getByText("No payments recorded")
    await expect(hasData.or(hasEmptyState)).toBeVisible({ timeout: 10000 })
  })

  test("invites page has empty state or data", async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/invites`)
    await page.waitForLoadState("networkidle")

    // Either invite manager visible OR "No units available for invites"
    const hasData = page.locator("button:has-text('Generate')").first()
    const hasEmptyState = page.getByText("No units available for invites")
    await expect(hasData.or(hasEmptyState)).toBeVisible({ timeout: 10000 })
  })

  test("notifications page has empty state or data", async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/notifications`)
    await page.waitForLoadState("networkidle")

    // Either notification cards visible OR "No notifications yet"
    const hasData = page.locator("[data-slot='card']").first()
    const hasEmptyState = page.getByText("No notifications yet")
    await expect(hasData.or(hasEmptyState)).toBeVisible({ timeout: 10000 })
  })

  test("empty state component has correct structure when shown", async ({ page }) => {
    // Navigate to notifications which may have empty state
    await page.goto(`${BASE_URL}/admin/notifications`)
    await page.waitForLoadState("networkidle")

    const emptyState = page.getByText("No notifications yet")
    const isEmptyStateVisible = await emptyState.isVisible().catch(() => false)

    if (isEmptyStateVisible) {
      // Verify structure: icon (SVG), title, description
      const container = emptyState.locator("..")
      await expect(container.locator("svg").first()).toBeVisible()
      await expect(
        page.getByText("System notifications will appear here")
      ).toBeVisible()
    } else {
      test.skip(true, "Data exists, empty state not visible")
    }
  })
})
