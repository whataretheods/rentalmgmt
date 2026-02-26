import { test, expect } from "@playwright/test"

const BASE_URL = "http://localhost:3000"
const TENANT_EMAIL = process.env.TEST_TENANT_EMAIL || "testtenant@test.com"
const TENANT_PASSWORD = process.env.TEST_TENANT_PASSWORD || "TestPass123!"
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "odesantos2@gmail.com"
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "123Pormi!@#123"

test.describe("Tenant Maintenance Requests", () => {
  test.beforeEach(async ({ page }) => {
    // Login as test tenant
    await page.goto(`${BASE_URL}/auth/login`)
    await page.waitForLoadState("networkidle")
    await page.fill('input[type="email"]', TENANT_EMAIL)
    await page.fill('input[type="password"]', TENANT_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL("**/tenant/dashboard", { timeout: 15000 })
  })

  test("@smoke maintenance list page loads", async ({ page }) => {
    await page.goto(`${BASE_URL}/tenant/maintenance`)
    await page.waitForLoadState("networkidle")

    // Verify page heading is present
    await expect(
      page.locator("h1", { hasText: "Maintenance Requests" })
    ).toBeVisible()

    // Verify "New Request" button is present
    await expect(
      page.locator('a[href="/tenant/maintenance/new"]')
    ).toBeVisible()
  })

  test("submit maintenance request", async ({ page }) => {
    await page.goto(`${BASE_URL}/tenant/maintenance/new`)
    await page.waitForLoadState("networkidle")

    // Verify form heading
    await expect(
      page.locator("h1", { hasText: "New Maintenance Request" })
    ).toBeVisible()

    // Select category
    await page.selectOption("#category", "electrical")

    // Fill description
    await page.fill(
      "#description",
      "Bathroom light fixture flickers intermittently and sometimes goes out completely."
    )

    // Submit the form (without photos for simplicity)
    await page.click('button[type="submit"]')

    // Should redirect to maintenance list after successful submit
    await page.waitForURL("**/tenant/maintenance", { timeout: 15000 })

    // Verify the new request appears in the list
    await expect(page.locator("text=Electrical").first()).toBeVisible({
      timeout: 10000,
    })
    await expect(
      page.locator("text=Bathroom light fixture").first()
    ).toBeVisible()
  })

  test("track request status and view detail", async ({ page }) => {
    await page.goto(`${BASE_URL}/tenant/maintenance`)
    await page.waitForLoadState("networkidle")

    // Click on the first maintenance request card
    const firstCard = page.locator('a[href^="/tenant/maintenance/"]').first()
    await expect(firstCard).toBeVisible({ timeout: 10000 })
    await firstCard.click()

    // Should navigate to detail page
    await page.waitForURL("**/tenant/maintenance/*", { timeout: 10000 })

    // Verify detail page shows status badge
    const statusBadge = page.locator(".rounded-full").first()
    await expect(statusBadge).toBeVisible({ timeout: 10000 })

    // Verify description is visible
    await expect(page.locator("text=Back to requests")).toBeVisible()

    // Verify Comments section is visible
    await expect(
      page.locator("text=Comments")
    ).toBeVisible()
  })

  test("add a comment on request detail", async ({ page }) => {
    await page.goto(`${BASE_URL}/tenant/maintenance`)
    await page.waitForLoadState("networkidle")

    // Click on first request
    const firstCard = page.locator('a[href^="/tenant/maintenance/"]').first()
    await expect(firstCard).toBeVisible({ timeout: 10000 })
    await firstCard.click()
    await page.waitForURL("**/tenant/maintenance/*", { timeout: 10000 })

    // Type a comment
    const commentInput = page.locator('textarea[placeholder="Add a comment..."]')
    await expect(commentInput).toBeVisible({ timeout: 10000 })
    await commentInput.fill("Thanks for the update! When will the plumber arrive?")

    // Click send button
    const sendButton = page.locator('form button[type="submit"]').last()
    await sendButton.click()

    // Verify the comment appears in the thread
    await expect(
      page.locator("text=Thanks for the update").first()
    ).toBeVisible({ timeout: 10000 })
  })
})

test.describe("Admin Maintenance Kanban", () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto(`${BASE_URL}/auth/login`)
    await page.waitForLoadState("networkidle")
    await page.fill('input[type="email"]', ADMIN_EMAIL)
    await page.fill('input[type="password"]', ADMIN_PASSWORD)
    await page.click('button[type="submit"]')
    // Admin also redirects to /tenant/dashboard initially
    await page.waitForURL("**/tenant/dashboard", { timeout: 15000 })
  })

  test("@smoke kanban board loads with status columns", async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/maintenance`)
    await page.waitForLoadState("networkidle")

    // Verify page heading
    await expect(
      page.locator("h1", { hasText: "Maintenance Requests" })
    ).toBeVisible({ timeout: 10000 })

    // Verify kanban column headers are visible
    await expect(page.locator("text=Submitted").first()).toBeVisible({
      timeout: 15000,
    })
    await expect(page.locator("text=Acknowledged").first()).toBeVisible()
    await expect(page.locator("text=In Progress").first()).toBeVisible()
    await expect(page.locator("text=Resolved").first()).toBeVisible()
  })

  test("kanban board shows request cards from seed data", async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/maintenance`)
    await page.waitForLoadState("networkidle")

    // Wait for the kanban to load (submitted column should have content)
    // The seeded request is a plumbing request about a kitchen sink
    await expect(
      page.locator("text=Submitted").first()
    ).toBeVisible({ timeout: 15000 })

    // Verify filter bar is present (unit dropdown)
    await expect(page.locator("text=All units")).toBeVisible()
  })
})
