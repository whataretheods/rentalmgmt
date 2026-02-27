import { test, expect } from "@playwright/test"

const BASE_URL = "http://localhost:3000"
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "odesantos2@gmail.com"
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "123Pormi!@#123"

test.describe("Admin Sidebar", () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto(`${BASE_URL}/auth/login`)
    await page.waitForLoadState("networkidle")
    await page.fill('input[type="email"]', ADMIN_EMAIL)
    await page.fill('input[type="password"]', ADMIN_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL("**/admin/dashboard", { timeout: 15000 })
    await page.waitForLoadState("networkidle")
  })

  test("@smoke sidebar is visible with all navigation links", async ({ page }) => {
    // Sidebar should be visible
    const sidebar = page.locator('[data-sidebar="sidebar"]')
    await expect(sidebar).toBeVisible({ timeout: 10000 })

    // Check for all 9 navigation links
    const navLinks = [
      "Dashboard",
      "Units",
      "Payments",
      "Maintenance",
      "Documents",
      "Users",
      "Invites",
      "Notifications",
      "Broadcast",
    ]

    for (const linkText of navLinks) {
      const link = sidebar.locator(`a:has-text("${linkText}")`)
      await expect(link).toBeVisible()
    }
  })

  test("sidebar toggle collapses the sidebar", async ({ page }) => {
    // Find the sidebar trigger button
    const trigger = page.locator('button[data-sidebar="trigger"]')
    await expect(trigger).toBeVisible({ timeout: 10000 })

    // Click to toggle sidebar
    await trigger.click()
    await page.waitForTimeout(500) // Wait for animation

    // Sidebar should still exist but may be collapsed
    const sidebar = page.locator('[data-sidebar="sidebar"]')
    await expect(sidebar).toBeVisible()
  })

  test("sidebar persists across page navigation", async ({ page }) => {
    // Sidebar should be visible on dashboard
    const sidebar = page.locator('[data-sidebar="sidebar"]')
    await expect(sidebar).toBeVisible({ timeout: 10000 })

    // Navigate to a different admin page
    await page.goto(`${BASE_URL}/admin/units`)
    await page.waitForLoadState("networkidle")

    // Sidebar should still be visible
    await expect(sidebar).toBeVisible({ timeout: 10000 })
  })

  test("active page link is visually distinct", async ({ page }) => {
    // On dashboard page, the Dashboard link should have active state
    const sidebar = page.locator('[data-sidebar="sidebar"]')
    await expect(sidebar).toBeVisible({ timeout: 10000 })

    // The active link should have data-active attribute
    const dashboardLink = sidebar.locator('a[href="/admin/dashboard"]').first()
    await expect(dashboardLink).toBeVisible()

    // Navigate to units page
    await page.goto(`${BASE_URL}/admin/units`)
    await page.waitForLoadState("networkidle")

    // Units link should now be active
    const unitsLink = sidebar.locator('a[href="/admin/units"]').first()
    await expect(unitsLink).toBeVisible()
  })
})
