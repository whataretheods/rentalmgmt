import { test, expect } from "@playwright/test"

const BASE_URL = "http://localhost:3000"
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "odesantos2@gmail.com"
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "123Pormi!@#123"

test.describe("Admin KPI Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/auth/login`)
    await page.waitForLoadState("networkidle")
    await page.fill('input[type="email"]', ADMIN_EMAIL)
    await page.fill('input[type="password"]', ADMIN_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL("**/admin/dashboard", { timeout: 15000 })
    await page.waitForLoadState("networkidle")
  })

  test("@smoke displays all 5 KPI metric cards", async ({ page }) => {
    await expect(page.getByText("Collection Rate")).toBeVisible({ timeout: 10000 })
    await expect(page.getByText("Total Outstanding")).toBeVisible()
    await expect(page.getByText("Occupancy Rate")).toBeVisible()
    await expect(page.getByText("Open Requests")).toBeVisible()
    await expect(page.getByText("Overdue Tenants")).toBeVisible()
  })

  test("KPI cards show formatted values", async ({ page }) => {
    // Collection rate should contain a percentage
    const collectionCard = page.locator("text=Collection Rate").locator("..")
    await expect(collectionCard.locator("text=/%/")).toBeVisible({ timeout: 10000 })

    // Outstanding balance should contain a dollar sign
    const outstandingCard = page.locator("text=Total Outstanding").locator("..")
    await expect(outstandingCard.locator("text=/\\$/")).toBeVisible()

    // Occupancy rate should contain a percentage
    const occupancyCard = page.locator("text=Occupancy Rate").locator("..")
    await expect(occupancyCard.locator("text=/%/")).toBeVisible()
  })

  test("dashboard shows current month in subtitle", async ({ page }) => {
    const monthName = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })
    await expect(page.getByText(monthName)).toBeVisible({ timeout: 10000 })
  })

  test("quick action links are present", async ({ page }) => {
    await expect(page.getByRole("link", { name: "View Users" })).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole("link", { name: "Manage Units" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Payment Dashboard" })).toBeVisible()
  })
})
