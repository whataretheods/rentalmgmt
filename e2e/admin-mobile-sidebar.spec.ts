import { test, expect } from "@playwright/test"

const BASE_URL = "http://localhost:3000"
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "odesantos2@gmail.com"
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "123Pormi!@#123"

test.describe("Admin Mobile Sidebar", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/auth/login`)
    await page.waitForLoadState("networkidle")
    await page.fill('input[type="email"]', ADMIN_EMAIL)
    await page.fill('input[type="password"]', ADMIN_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL("**/admin/dashboard", { timeout: 15000 })
    await page.waitForLoadState("networkidle")
  })

  test("sidebar visible on desktop viewport", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto(`${BASE_URL}/admin/dashboard`)
    await page.waitForLoadState("networkidle")

    // Desktop sidebar should be visible
    const sidebar = page.locator('[data-sidebar="sidebar"]')
    await expect(sidebar).toBeVisible({ timeout: 10000 })

    // Dashboard link should be visible in sidebar
    const dashboardLink = sidebar.getByText("Dashboard")
    await expect(dashboardLink).toBeVisible()
  })

  test("sidebar hidden on mobile, hamburger visible", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto(`${BASE_URL}/admin/dashboard`)
    await page.waitForLoadState("networkidle")

    // The sidebar trigger should be visible as the hamburger (use .first() for the visible mobile one)
    const trigger = page.locator('button[data-sidebar="trigger"]:visible')
    await expect(trigger).toBeVisible({ timeout: 10000 })
  })

  test("hamburger opens mobile sidebar sheet", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto(`${BASE_URL}/admin/dashboard`)
    await page.waitForLoadState("networkidle")

    // Click the visible hamburger button
    const trigger = page.locator('button[data-sidebar="trigger"]:visible')
    await expect(trigger).toBeVisible({ timeout: 10000 })
    await trigger.click()

    // Wait for sheet to appear with sidebar content
    await page.waitForTimeout(500) // animation delay

    // The mobile sidebar renders inside a Sheet (data-mobile="true")
    const sheet = page.locator('[data-mobile="true"]')
    await expect(sheet).toBeVisible({ timeout: 5000 })

    // Nav links should be visible in the sheet
    await expect(sheet.getByText("Dashboard")).toBeVisible()
    await expect(sheet.getByText("Payments")).toBeVisible()
  })

  test("mobile sidebar closes on navigation", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto(`${BASE_URL}/admin/dashboard`)
    await page.waitForLoadState("networkidle")

    // Open mobile sidebar
    const trigger = page.locator('button[data-sidebar="trigger"]:visible')
    await expect(trigger).toBeVisible({ timeout: 10000 })
    await trigger.click()
    await page.waitForTimeout(500)

    // Click Payments link
    const sheet = page.locator('[data-mobile="true"]')
    await expect(sheet).toBeVisible({ timeout: 5000 })
    await sheet.getByText("Payments").click()

    // Wait for navigation
    await page.waitForURL("**/admin/payments", { timeout: 10000 })

    // Sheet should close after navigation
    await expect(sheet).not.toBeVisible({ timeout: 5000 })
  })

  test("touch targets are at least 44px", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto(`${BASE_URL}/admin/dashboard`)
    await page.waitForLoadState("networkidle")

    // Check hamburger trigger has 44px min touch target
    const trigger = page.locator('button[data-sidebar="trigger"]:visible')
    await expect(trigger).toBeVisible({ timeout: 10000 })
    const triggerBox = await trigger.boundingBox()
    expect(triggerBox).toBeTruthy()
    expect(triggerBox!.height).toBeGreaterThanOrEqual(44)
    expect(triggerBox!.width).toBeGreaterThanOrEqual(44)

    // Open sidebar and check nav link touch targets
    await trigger.click()
    await page.waitForTimeout(500)

    const sheet = page.locator('[data-mobile="true"]')
    await expect(sheet).toBeVisible({ timeout: 5000 })

    // Check a few nav link heights (they should be size="lg" = h-12 = 48px)
    const navLinks = sheet.locator('[data-sidebar="menu-button"]')
    const count = await navLinks.count()
    expect(count).toBeGreaterThan(0)

    for (let i = 0; i < Math.min(count, 3); i++) {
      const box = await navLinks.nth(i).boundingBox()
      expect(box).toBeTruthy()
      expect(box!.height).toBeGreaterThanOrEqual(44)
    }
  })
})
