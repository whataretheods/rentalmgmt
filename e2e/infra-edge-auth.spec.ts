import { test, expect } from "@playwright/test"

const BASE_URL = "http://localhost:3000"
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "odesantos2@gmail.com"
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "123Pormi!@#123"
const TENANT_EMAIL = process.env.TEST_TENANT_EMAIL || "testtenant@test.com"
const TENANT_PASSWORD = process.env.TEST_TENANT_PASSWORD || "TestPass123!"

test.describe("Infrastructure: Edge Auth Middleware", () => {
  test("@smoke unauthenticated user is redirected to login from /admin", async ({ page }) => {
    // Visit admin dashboard without logging in
    await page.goto(`${BASE_URL}/admin/dashboard`)
    await page.waitForLoadState("networkidle")

    // Should be redirected to /auth/login
    expect(page.url()).toContain("/auth/login")
  })

  test("@smoke tenant user is redirected away from /admin routes", async ({ page }) => {
    // Login as tenant
    await page.goto(`${BASE_URL}/auth/login`)
    await page.waitForLoadState("networkidle")
    await page.fill('input[type="email"]', TENANT_EMAIL)
    await page.fill('input[type="password"]', TENANT_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL("**/tenant/dashboard", { timeout: 15000 })

    // Try to visit admin dashboard
    await page.goto(`${BASE_URL}/admin/dashboard`)
    await page.waitForLoadState("networkidle")

    // Should be redirected to /tenant/dashboard (not admin)
    expect(page.url()).toContain("/tenant/dashboard")
    expect(page.url()).not.toContain("/admin")
  })

  test("@smoke admin user can access /admin routes", async ({ page }) => {
    // Login as admin
    await page.goto(`${BASE_URL}/auth/login`)
    await page.waitForLoadState("networkidle")
    await page.fill('input[type="email"]', ADMIN_EMAIL)
    await page.fill('input[type="password"]', ADMIN_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL("**/admin/dashboard", { timeout: 15000 })
    await page.waitForLoadState("networkidle")

    // Should be on admin dashboard
    expect(page.url()).toContain("/admin/dashboard")
  })

  test("unauthenticated user is redirected to login from /tenant", async ({ page }) => {
    // Visit tenant dashboard without logging in
    await page.goto(`${BASE_URL}/tenant/dashboard`)
    await page.waitForLoadState("networkidle")

    // Should be redirected to /auth/login
    expect(page.url()).toContain("/auth/login")
  })
})
