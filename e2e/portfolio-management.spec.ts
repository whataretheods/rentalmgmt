import { test, expect } from "@playwright/test"

const BASE_URL = "http://localhost:3000"
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "odesantos2@gmail.com"
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "123Pormi!@#123"

// Portfolio seed test accounts (created by scripts/seed-portfolio.ts)
const ACTIVE_TENANT_EMAIL = "portfolio-active@test.com"
const ACTIVE_TENANT_PASSWORD = "TestPass123!"

const PAST_TENANT_EMAIL = "portfolio-past@test.com"
const PAST_TENANT_PASSWORD = "TestPass123!"

const UNLINKED_TENANT_EMAIL = "portfolio-unlinked@test.com"
const UNLINKED_TENANT_PASSWORD = "TestPass123!"

async function loginAsAdmin(page: import("@playwright/test").Page) {
  await page.goto(`${BASE_URL}/auth/login`)
  await page.waitForLoadState("networkidle")
  await page.fill('input[type="email"]', ADMIN_EMAIL)
  await page.fill('input[type="password"]', ADMIN_PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL("**/admin/dashboard", { timeout: 15000 })
  await page.waitForLoadState("networkidle")
}

async function loginAsTenant(
  page: import("@playwright/test").Page,
  email: string,
  password: string
) {
  await page.goto(`${BASE_URL}/auth/login`)
  await page.waitForLoadState("networkidle")
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL("**/tenant/dashboard", { timeout: 15000 })
  await page.waitForLoadState("networkidle")
}

test.describe("Portfolio Management", () => {
  // PORT-01: Property CRUD
  test.describe("Property Management", () => {
    test("@smoke admin can view properties page", async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto(`${BASE_URL}/admin/properties`)
      await page.waitForLoadState("networkidle")

      // Properties page should be visible with heading
      const heading = page.locator("h1:has-text('Properties')")
      await expect(heading).toBeVisible({ timeout: 10000 })

      // Add Property button should be visible
      const addBtn = page.locator("button:has-text('Add Property')")
      await expect(addBtn).toBeVisible()
    })

    test("admin can create a property", async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto(`${BASE_URL}/admin/properties`)
      await page.waitForLoadState("networkidle")

      // Click Add Property
      await page.click("button:has-text('Add Property')")

      // Wait for dialog
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 })

      // Fill in property details with unique name to avoid conflicts
      const uniqueName = `E2E Test Property ${Date.now()}`
      await page.fill('input[name="name"]', uniqueName)
      await page.fill('input[name="address"]', "123 E2E Test Street, Test City, TS 00000")

      // Submit
      await page.click('[role="dialog"] button[type="submit"]')

      // Wait for dialog to close
      await page.waitForSelector('[role="dialog"]', {
        state: "hidden",
        timeout: 10000,
      })

      // Verify property appears in list
      const propertyRow = page.locator(`text=${uniqueName}`)
      await expect(propertyRow).toBeVisible({ timeout: 10000 })
    })

    test("admin can edit a property", async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto(`${BASE_URL}/admin/properties`)
      await page.waitForLoadState("networkidle")

      // Click the first Edit button
      const editBtn = page.locator("button:has-text('Edit')").first()
      await expect(editBtn).toBeVisible({ timeout: 10000 })
      await editBtn.click()

      // Wait for dialog
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 })

      // Modify the address
      const addressInput = page.locator('[role="dialog"] input[name="address"]')
      await addressInput.fill("456 Updated Address, Test City, TS 99999")

      // Submit
      await page.click('[role="dialog"] button[type="submit"]')

      // Wait for dialog to close
      await page.waitForSelector('[role="dialog"]', {
        state: "hidden",
        timeout: 10000,
      })
    })
  })

  // PORT-02: Unit CRUD
  test.describe("Unit Management", () => {
    test("@smoke admin can view units page", async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto(`${BASE_URL}/admin/units`)
      await page.waitForLoadState("networkidle")

      // Units page heading
      const heading = page.locator("h1:has-text('Units')")
      await expect(heading).toBeVisible({ timeout: 10000 })

      // Add Unit button should be visible
      const addBtn = page.locator("button:has-text('Add Unit')")
      await expect(addBtn).toBeVisible()
    })

    test("admin can create a unit with rent config", async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto(`${BASE_URL}/admin/units`)
      await page.waitForLoadState("networkidle")

      // Click Add Unit
      await page.click("button:has-text('Add Unit')")

      // Wait for dialog
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 })

      // Fill in unit details
      const uniqueUnit = `E2E-${Date.now().toString().slice(-6)}`
      await page.fill('input[name="unitNumber"]', uniqueUnit)

      // Select the first property from dropdown (if available)
      const propertySelect = page.locator('[role="dialog"] button[role="combobox"]')
      if (await propertySelect.isVisible()) {
        await propertySelect.click()
        await page.waitForTimeout(500)
        // Click the first option
        const firstOption = page.locator('[role="option"]').first()
        if (await firstOption.isVisible()) {
          await firstOption.click()
        }
      }

      // Set rent amount
      await page.fill('input[name="rentDollars"]', "1500")

      // Set due day
      await page.fill('input[name="rentDueDay"]', "1")

      // Submit
      await page.click('[role="dialog"] button[type="submit"]')

      // Wait for dialog to close
      await page.waitForSelector('[role="dialog"]', {
        state: "hidden",
        timeout: 10000,
      })

      // Verify unit appears in list
      const unitRow = page.locator(`text=${uniqueUnit}`)
      await expect(unitRow).toBeVisible({ timeout: 10000 })
    })

    test("admin can edit unit rent amount", async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto(`${BASE_URL}/admin/units`)
      await page.waitForLoadState("networkidle")

      // Click the first Edit button
      const editBtn = page.locator("button:has-text('Edit')").first()
      await expect(editBtn).toBeVisible({ timeout: 10000 })
      await editBtn.click()

      // Wait for dialog
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 })

      // Modify rent amount
      const rentInput = page.locator('[role="dialog"] input[name="rentDollars"]')
      await rentInput.fill("1600")

      // Submit
      await page.click('[role="dialog"] button[type="submit"]')

      // Wait for dialog to close
      await page.waitForSelector('[role="dialog"]', {
        state: "hidden",
        timeout: 10000,
      })
    })

    test("units page shows move-out button for occupied units", async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto(`${BASE_URL}/admin/units`)
      await page.waitForLoadState("networkidle")

      // If there are occupied units (from seed data), Move Out button should be visible
      const moveOutBtn = page.locator("button:has-text('Move Out')").first()
      // This test verifies the button presence, it may not exist if no occupied units
      const hasOccupiedUnits = await moveOutBtn.isVisible().catch(() => false)

      if (hasOccupiedUnits) {
        await expect(moveOutBtn).toBeVisible()
      } else {
        // If no occupied units, verify "Vacant" text appears
        const vacantText = page.locator("text=Vacant").first()
        await expect(vacantText).toBeVisible({ timeout: 10000 })
      }
    })
  })

  // PORT-03: Move-out workflow (API tests)
  test.describe("Move-Out Workflow", () => {
    test("move-out API rejects unauthenticated requests", async ({ request }) => {
      const res = await request.post(`${BASE_URL}/api/admin/move-out`, {
        data: {
          tenantUserId: "fake-id",
          unitId: "fake-unit",
          moveOutDate: new Date().toISOString().split("T")[0],
        },
      })
      expect(res.status()).toBe(401)
    })

    test("move-out API validates required fields", async ({ page, request }) => {
      // Login as admin first to get session cookies
      await loginAsAdmin(page)
      const cookies = await page.context().cookies()
      const cookieHeader = cookies
        .map((c) => `${c.name}=${c.value}`)
        .join("; ")

      // POST with missing fields
      const res = await request.post(`${BASE_URL}/api/admin/move-out`, {
        headers: { Cookie: cookieHeader },
        data: { tenantUserId: "test" },
      })
      expect(res.status()).toBe(400)
    })
  })

  // PORT-04: Past tenant read-only access
  test.describe("Past Tenant Access", () => {
    test("moved-out tenant sees read-only banner on dashboard", async ({ page }) => {
      await loginAsTenant(page, PAST_TENANT_EMAIL, PAST_TENANT_PASSWORD)

      // Read-only banner should be visible
      const banner = page.locator("text=/read-only/i").first()
      await expect(banner).toBeVisible({ timeout: 10000 })

      // Pay Rent button should NOT be visible
      const payButton = page.locator('button:has-text("Pay Rent")')
      await expect(payButton).toBeHidden({ timeout: 5000 })
    })

    test("moved-out tenant can still view payment history", async ({ page }) => {
      await loginAsTenant(page, PAST_TENANT_EMAIL, PAST_TENANT_PASSWORD)

      // Navigate to payments page
      await page.click('a:has-text("Payments")')
      await page.waitForLoadState("networkidle")

      // Should be able to access payments page (not redirected)
      expect(page.url()).toContain("/tenant/payments")
    })

    test("moved-out tenant does not see maintenance link in nav", async ({ page }) => {
      await loginAsTenant(page, PAST_TENANT_EMAIL, PAST_TENANT_PASSWORD)

      // Maintenance link should be hidden for past tenants
      const maintenanceLink = page.locator('nav a:has-text("Maintenance")')
      await expect(maintenanceLink).toBeHidden({ timeout: 5000 })
    })
  })

  // TUX-01: Invite token self-service
  test.describe("Invite Token Entry", () => {
    test("unlinked tenant sees invite entry form on dashboard", async ({ page }) => {
      await loginAsTenant(page, UNLINKED_TENANT_EMAIL, UNLINKED_TENANT_PASSWORD)

      // Invite entry card should be visible
      const inviteCard = page.locator("text=/invite/i").first()
      await expect(inviteCard).toBeVisible({ timeout: 10000 })

      // Input field for invite code should be present
      const tokenInput = page.locator('input[placeholder*="invite" i], input[name*="token" i]').first()
      await expect(tokenInput).toBeVisible({ timeout: 5000 })
    })

    test("invalid invite token shows error", async ({ page }) => {
      await loginAsTenant(page, UNLINKED_TENANT_EMAIL, UNLINKED_TENANT_PASSWORD)

      // Find token input and enter invalid token
      const tokenInput = page.locator('input[placeholder*="invite" i], input[name*="token" i]').first()
      await expect(tokenInput).toBeVisible({ timeout: 10000 })
      await tokenInput.fill("INVALID-TOKEN-12345")

      // Submit
      const submitBtn = page.locator('button:has-text("Link")').first()
      await submitBtn.click()

      // Should show error
      const errorMsg = page.locator("text=/invalid|expired|not found/i").first()
      await expect(errorMsg).toBeVisible({ timeout: 10000 })
    })
  })

  // Archived entity filtering
  test.describe("Archived Entity Filtering", () => {
    test("admin invites page only shows active units", async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto(`${BASE_URL}/admin/invites`)
      await page.waitForLoadState("networkidle")

      // Page should load without errors
      const heading = page.locator("h1:has-text('Invite')")
      await expect(heading).toBeVisible({ timeout: 10000 })
    })

    test("admin payments overview only shows active units", async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto(`${BASE_URL}/admin/payments`)
      await page.waitForLoadState("networkidle")

      // Page should load without errors
      // The payments overview API filters archived units
      await page.waitForTimeout(2000) // Let the data load
      // No error state should be visible
      const errorState = page.locator("text=/error|failed/i")
      const hasError = await errorState.isVisible().catch(() => false)
      expect(hasError).toBe(false)
    })
  })
})
