import { test, expect } from "@playwright/test"

const BASE_URL = "http://localhost:3000"
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "odesantos2@gmail.com"
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "123Pormi!@#123"

test.describe.serial("Vendor Directory (OPS-01)", () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto(`${BASE_URL}/auth/login`)
    await page.waitForLoadState("networkidle")
    await page.fill('input[type="email"]', ADMIN_EMAIL)
    await page.fill('input[type="password"]', ADMIN_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL("**/tenant/dashboard", { timeout: 15000 })
  })

  test("admin can view vendor list page", async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/vendors`)
    await page.waitForLoadState("networkidle")

    await expect(
      page.locator("h1", { hasText: "Vendor Directory" })
    ).toBeVisible({ timeout: 10000 })
  })

  test("admin can add a new vendor", async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/vendors`)
    await page.waitForLoadState("networkidle")

    // Click Add Vendor button
    await page.click("button:has-text('Add Vendor')")

    // Fill the form
    await page.fill('#companyName', "E2E Test Plumbing Co")
    await page.fill('#contactName', "Test Contact")
    await page.fill('#email', "e2etest@plumbing.com")
    await page.fill('#phone', "+15559999999")

    // Select specialty
    await page.click('#specialty')
    await page.click('div[role="option"]:has-text("Plumbing")')

    // Submit
    await page.click("button:has-text('Add Vendor')")

    // Verify vendor appears in list
    await expect(
      page.locator("td", { hasText: "E2E Test Plumbing Co" })
    ).toBeVisible({ timeout: 10000 })
  })

  test("admin can edit a vendor", async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/vendors`)
    await page.waitForLoadState("networkidle")

    // Wait for vendor list to load
    await expect(
      page.locator("td", { hasText: "E2E Test Plumbing Co" })
    ).toBeVisible({ timeout: 10000 })

    // Click Edit on the E2E test vendor row
    const row = page.locator("tr", { hasText: "E2E Test Plumbing Co" })
    await row.locator("button:has-text('Edit')").click()

    // Change contact name
    await page.fill('#contactName', "Updated Contact Name")

    // Save
    await page.click("button:has-text('Update Vendor')")

    // Verify updated name appears
    await expect(
      page.locator("td", { hasText: "Updated Contact Name" })
    ).toBeVisible({ timeout: 10000 })
  })

  test("admin can deactivate a vendor", async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/vendors`)
    await page.waitForLoadState("networkidle")

    // Wait for vendor list to load
    await expect(
      page.locator("td", { hasText: "E2E Test Plumbing Co" })
    ).toBeVisible({ timeout: 10000 })

    // Click Deactivate on the E2E test vendor row
    const row = page.locator("tr", { hasText: "E2E Test Plumbing Co" })
    await row.locator("button:has-text('Deactivate')").click()

    // Verify status changes to inactive
    await expect(
      row.locator("span", { hasText: "inactive" })
    ).toBeVisible({ timeout: 10000 })
  })
})
