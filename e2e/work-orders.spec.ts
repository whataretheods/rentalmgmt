import { test, expect } from "@playwright/test"

const BASE_URL = "http://localhost:3000"
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "odesantos2@gmail.com"
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "123Pormi!@#123"

test.describe("Work Orders", () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto(`${BASE_URL}/auth/login`)
    await page.waitForLoadState("networkidle")
    await page.fill('input[type="email"]', ADMIN_EMAIL)
    await page.fill('input[type="password"]', ADMIN_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL("**/admin/dashboard", { timeout: 15000 })
  })

  test("admin can view work order list page", async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/work-orders`)
    await page.waitForLoadState("networkidle")

    await expect(
      page.locator("h1", { hasText: "Work Orders" })
    ).toBeVisible({ timeout: 10000 })
  })

  test("admin can create a work order via API and see it in list", async ({
    page,
  }) => {
    // First get a maintenance request ID via API
    const maintRes = await page.request.get(
      `${BASE_URL}/api/admin/maintenance`
    )
    const maintData = await maintRes.json()

    if (!maintData.requests || maintData.requests.length === 0) {
      test.skip(true, "No maintenance requests available")
      return
    }

    const requestId = maintData.requests[0].id

    // Get an active vendor
    const vendorRes = await page.request.get(
      `${BASE_URL}/api/admin/vendors?status=active`
    )
    const vendorData = await vendorRes.json()

    // Create work order via API
    const createRes = await page.request.post(
      `${BASE_URL}/api/admin/work-orders`,
      {
        data: {
          maintenanceRequestId: requestId,
          vendorId:
            vendorData.vendors?.length > 0
              ? vendorData.vendors[0].id
              : undefined,
          priority: "high",
          notes: "E2E test work order",
        },
      }
    )

    expect(createRes.status()).toBe(201)
    const createData = await createRes.json()
    expect(createData.workOrder).toBeTruthy()
    expect(createData.workOrder.vendorAccessToken).toBeTruthy()

    // Navigate to work orders list and verify it appears
    await page.goto(`${BASE_URL}/admin/work-orders`)
    await page.waitForLoadState("networkidle")

    await expect(
      page.locator("td", { hasText: "high" }).first()
    ).toBeVisible({ timeout: 10000 })
  })

  test("invalid magic link token shows 404", async ({ page }) => {
    // Navigate to an invalid magic link -- no login needed for vendor page
    await page.goto(`${BASE_URL}/vendor/work-order/invalid-token-12345`)
    await page.waitForLoadState("networkidle")

    // Should show 404 page
    await expect(
      page.locator("text=404").or(page.locator("text=not found")).or(page.locator("text=Not Found"))
    ).toBeVisible({ timeout: 10000 })
  })
})

test.describe("Vendor Magic Link (OPS-03)", () => {
  test("magic link shows request details without tenant PII", async ({
    page,
  }) => {
    // Login as admin to create a work order first
    await page.goto(`${BASE_URL}/auth/login`)
    await page.waitForLoadState("networkidle")
    await page.fill('input[type="email"]', ADMIN_EMAIL)
    await page.fill('input[type="password"]', ADMIN_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL("**/admin/dashboard", { timeout: 15000 })

    // Get maintenance request with tenant info
    const maintRes = await page.request.get(
      `${BASE_URL}/api/admin/maintenance`
    )
    const maintData = await maintRes.json()

    if (!maintData.requests || maintData.requests.length === 0) {
      test.skip(true, "No maintenance requests available")
      return
    }

    const request = maintData.requests[0]
    const tenantEmail = request.tenantEmail
    const tenantName = request.tenantName

    // Create a work order to get a vendor access token
    const createRes = await page.request.post(
      `${BASE_URL}/api/admin/work-orders`,
      {
        data: {
          maintenanceRequestId: request.id,
          priority: "medium",
          notes: "PII test work order",
        },
      }
    )

    expect(createRes.status()).toBe(201)
    const createData = await createRes.json()
    const token = createData.workOrder.vendorAccessToken

    // Navigate to the vendor magic link (no auth needed)
    await page.goto(`${BASE_URL}/vendor/work-order/${token}`)
    await page.waitForLoadState("networkidle")

    // Verify maintenance request details ARE visible
    await expect(
      page.locator("text=Work Order").first()
    ).toBeVisible({ timeout: 10000 })

    await expect(
      page.locator("text=Maintenance Request Details").first()
    ).toBeVisible()

    // Verify NO tenant PII is shown
    const pageContent = await page.content()

    if (tenantEmail) {
      expect(pageContent).not.toContain(tenantEmail)
    }
    if (tenantName && tenantName !== "admin") {
      expect(pageContent).not.toContain(tenantName)
    }
  })
})

test.describe("Cost Tracking (OPS-04)", () => {
  test("admin can add and view cost on work order", async ({ page }) => {
    // Login as admin
    await page.goto(`${BASE_URL}/auth/login`)
    await page.waitForLoadState("networkidle")
    await page.fill('input[type="email"]', ADMIN_EMAIL)
    await page.fill('input[type="password"]', ADMIN_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL("**/admin/dashboard", { timeout: 15000 })

    // Get existing work orders
    const woRes = await page.request.get(
      `${BASE_URL}/api/admin/work-orders`
    )
    const woData = await woRes.json()

    if (!woData.workOrders || woData.workOrders.length === 0) {
      test.skip(true, "No work orders available")
      return
    }

    const workOrderId = woData.workOrders[0].id

    // Navigate to work order detail
    await page.goto(`${BASE_URL}/admin/work-orders/${workOrderId}`)
    await page.waitForLoadState("networkidle")

    // Wait for cost section to load
    await expect(
      page.locator("text=Costs").first()
    ).toBeVisible({ timeout: 10000 })

    // Fill cost form
    await page.fill('input[placeholder="Description"]', "E2E test labor cost")
    await page.fill('input[placeholder="Amount ($)"]', "150.00")

    // Submit cost
    await page.click("button:has-text('Add Cost')")

    // Verify cost appears in the list
    await expect(
      page.locator("text=E2E test labor cost")
    ).toBeVisible({ timeout: 10000 })

    // Verify amount is displayed
    await expect(
      page.locator("text=$150.00").first()
    ).toBeVisible()
  })

  test("per-unit expense rollup API returns data", async ({ page }) => {
    // Login as admin
    await page.goto(`${BASE_URL}/auth/login`)
    await page.waitForLoadState("networkidle")
    await page.fill('input[type="email"]', ADMIN_EMAIL)
    await page.fill('input[type="password"]', ADMIN_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL("**/admin/dashboard", { timeout: 15000 })

    // Call the expense rollup API
    const res = await page.request.get(
      `${BASE_URL}/api/admin/reports/unit-expenses`
    )

    expect(res.status()).toBe(200)
    const data = await res.json()
    expect(data.expenses).toBeDefined()
    expect(typeof data.grandTotalCents).toBe("number")
  })
})
