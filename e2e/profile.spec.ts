import { test, expect } from "@playwright/test"

const BASE_URL = "http://localhost:3000"
const TENANT_EMAIL = process.env.TEST_TENANT_EMAIL || "testtenant@test.com"
const TENANT_PASSWORD = process.env.TEST_TENANT_PASSWORD || "TestPass123!"

test.describe("Tenant Profile Editing", () => {
  test.beforeEach(async ({ page }) => {
    // Login as test tenant
    await page.goto(`${BASE_URL}/auth/login`)
    await page.waitForLoadState("networkidle")
    await page.fill('input[type="email"]', TENANT_EMAIL)
    await page.fill('input[type="password"]', TENANT_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL("**/tenant/dashboard", { timeout: 15000 })
  })

  test("@smoke profile page loads with form sections", async ({ page }) => {
    await page.goto(`${BASE_URL}/tenant/profile`)
    await page.waitForLoadState("networkidle")

    // Verify page heading
    await expect(
      page.locator("h1", { hasText: "My Profile" })
    ).toBeVisible()

    // Verify all three card sections are present
    await expect(
      page.locator("text=Personal Information")
    ).toBeVisible({ timeout: 10000 })

    await expect(page.locator("text=Email Address")).toBeVisible()

    await expect(page.locator("text=Emergency Contact")).toBeVisible()
  })

  test("form pre-populates with current user data", async ({ page }) => {
    await page.goto(`${BASE_URL}/tenant/profile`)
    await page.waitForLoadState("networkidle")

    // Wait for the form to load (not skeleton)
    await expect(
      page.locator("text=Personal Information")
    ).toBeVisible({ timeout: 10000 })

    // Verify the name input has a value (from current user data)
    const nameInput = page.locator("#name")
    await expect(nameInput).toBeVisible()
    const nameValue = await nameInput.inputValue()
    expect(nameValue.length).toBeGreaterThan(0)

    // Verify the current email is shown
    await expect(
      page.locator(`text=${TENANT_EMAIL}`).first()
    ).toBeVisible()
  })

  test("update personal info (name and phone)", async ({ page }) => {
    await page.goto(`${BASE_URL}/tenant/profile`)
    await page.waitForLoadState("networkidle")

    // Wait for form to load
    await expect(page.locator("#name")).toBeVisible({ timeout: 10000 })

    // Update name
    await page.fill("#name", "Test Tenant Updated")

    // Update phone
    await page.fill("#phone", "(555) 123-4567")

    // Click save
    await page.click('button:has-text("Save Personal Info")')

    // Verify success toast
    await expect(
      page.locator("text=Personal information updated")
    ).toBeVisible({ timeout: 5000 })
  })

  test("update emergency contact", async ({ page }) => {
    await page.goto(`${BASE_URL}/tenant/profile`)
    await page.waitForLoadState("networkidle")

    // Wait for form to load
    await expect(page.locator("#ecName")).toBeVisible({ timeout: 10000 })

    // Fill emergency contact details
    await page.fill("#ecName", "Jane Emergency")
    await page.fill("#ecPhone", "(555) 987-6543")

    // Click save
    await page.click('button:has-text("Save Emergency Contact")')

    // Verify success toast
    await expect(
      page.locator("text=Emergency contact updated")
    ).toBeVisible({ timeout: 5000 })
  })

  test("phone field is editable", async ({ page }) => {
    await page.goto(`${BASE_URL}/tenant/profile`)
    await page.waitForLoadState("networkidle")

    // Wait for form
    await expect(page.locator("#phone")).toBeVisible({ timeout: 10000 })

    // Verify phone input is editable (not disabled)
    const phoneInput = page.locator("#phone")
    await expect(phoneInput).toBeEnabled()

    // Type a value to confirm editability
    await phoneInput.fill("(555) 000-1111")
    const value = await phoneInput.inputValue()
    expect(value).toBe("(555) 000-1111")
  })
})
