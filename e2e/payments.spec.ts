import { test, expect } from "@playwright/test"

const BASE_URL = "http://localhost:3000"
// These match the seeded test tenant from Phase 2
// Adjust if your test tenant credentials are different
const TENANT_EMAIL = process.env.TEST_TENANT_EMAIL || "testtenant@test.com"
const TENANT_PASSWORD = process.env.TEST_TENANT_PASSWORD || "TestPass123!"

test.describe("Tenant Payment Flows", () => {
  test.beforeEach(async ({ page }) => {
    // Login as tenant
    await page.goto(`${BASE_URL}/auth/login`)
    await page.waitForLoadState("networkidle")
    await page.fill('input[type="email"]', TENANT_EMAIL)
    await page.fill('input[type="password"]', TENANT_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL("**/tenant/dashboard", { timeout: 15000 })
  })

  test("@smoke tenant dashboard shows payment summary", async ({ page }) => {
    // Verify rent amount is displayed
    await expect(page.locator("text=$1,500.00").first()).toBeVisible({ timeout: 10000 })

    // Verify due date section exists
    await expect(page.locator("text=Next Due Date").first()).toBeVisible()

    // Verify last payment section exists
    await expect(page.locator("text=Last Payment").first()).toBeVisible()
  })

  test("@smoke tenant can see Pay Rent button", async ({ page }) => {
    const payButton = page.locator('button:has-text("Pay Rent")')
    await expect(payButton).toBeVisible({ timeout: 10000 })
  })

  test("Pay Rent redirects to Stripe Checkout", async ({ page }) => {
    // Click Pay Rent
    const payButton = page.locator('button:has-text("Pay Rent")')
    await payButton.click()

    // Should redirect to Stripe Checkout (external domain)
    // We verify the URL starts with checkout.stripe.com
    await page.waitForURL(/checkout\.stripe\.com/, { timeout: 15000 })
    const url = page.url()
    expect(url).toContain("checkout.stripe.com")
  })

  test("@smoke tenant can view payment history", async ({ page }) => {
    await page.goto(`${BASE_URL}/tenant/payments`)
    await page.waitForLoadState("networkidle")

    // Verify history page loads
    await expect(page.locator("text=Payment History")).toBeVisible()

    // Verify at least one payment row exists (from seed data)
    await expect(page.locator("table tbody tr").first()).toBeVisible({ timeout: 10000 })
  })

  test("tenant can view payment detail", async ({ page }) => {
    await page.goto(`${BASE_URL}/tenant/payments`)
    await page.waitForLoadState("networkidle")

    // Click on first payment link
    const firstPaymentLink = page.locator("table tbody tr a").first()
    await firstPaymentLink.click()

    // Verify detail page loads
    await expect(page.locator("text=Payment Details")).toBeVisible({ timeout: 10000 })
    await expect(page.locator("text=$1,500.00")).toBeVisible()

    // Verify receipt download link exists (the download attribute link)
    await expect(page.locator('a[download]')).toBeVisible()
  })
})
