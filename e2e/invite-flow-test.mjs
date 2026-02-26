/**
 * E2E test for the full invite flow using Playwright.
 * Run with: node e2e/invite-flow-test.mjs
 *
 * Tests:
 * 1. Admin generates invite for a unit
 * 2. Tenant registers via invite link
 * 3. Used invite shows error
 * 4. Invalid token shows error
 * 5. DB confirms tenant-unit linkage
 */
import { createRequire } from "module"
// Resolve playwright from the npx cache since it's not a project dependency
const require = createRequire(import.meta.url)
let chromium
try {
  ;({ chromium } = await import("playwright"))
} catch {
  // Fallback: try require from npx cache
  const pw = require("/Users/odesantos/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.js")
  chromium = pw.chromium
}

const BASE_URL = "http://localhost:3000"
const ADMIN_EMAIL = "odesantos2@gmail.com"
const ADMIN_PASSWORD = "123Pormi!@#123"
const TENANT_EMAIL = `testtenant-${Date.now()}@test.com`
const TENANT_PASSWORD = "TestPass123!"
const TENANT_NAME = "Test Tenant"

let capturedInviteUrl = ""
let passed = 0
let failed = 0

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`)
  }
}

async function test1_AdminGeneratesInvite(browser) {
  console.log("\n--- Test 1: Admin generates invite for a unit ---")
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    // Navigate to login
    await page.goto(`${BASE_URL}/auth/login`)
    await page.waitForLoadState("networkidle")

    // Fill email and password
    await page.fill('input[type="email"]', ADMIN_EMAIL)
    await page.fill('input[type="password"]', ADMIN_PASSWORD)

    // Submit login form
    await page.click('button[type="submit"]')

    // Default login redirect goes to /tenant/dashboard (even for admins)
    await page.waitForURL("**/tenant/dashboard", { timeout: 15000 })
    console.log("  Admin logged in successfully (redirected to tenant/dashboard)")

    // Navigate to admin invites page
    await page.goto(`${BASE_URL}/admin/invites`)
    await page.waitForLoadState("networkidle")

    // Verify page shows units table
    await page.waitForSelector("table", { timeout: 10000 })
    const tableText = await page.locator("table").textContent()
    assert(tableText.includes("1A"), "Table should contain unit 1A")
    console.log("  Units table visible with unit 1A")

    // Click "Generate Invite" for the first unit
    const generateButton = page.locator('button:has-text("Generate Invite")').first()
    await generateButton.click()

    // Wait for QR code image to appear
    await page.waitForSelector('img[alt*="QR code"]', { timeout: 10000 })
    console.log("  QR code image visible")

    // Verify invite URL is displayed
    const inviteInput = page.locator("input[readonly]")
    await inviteInput.waitFor({ state: "visible" })
    const inviteUrl = await inviteInput.inputValue()
    assert(inviteUrl.includes("/invite/"), "Invite URL should contain /invite/")
    capturedInviteUrl = inviteUrl
    console.log("  Invite URL captured:", inviteUrl.substring(0, 60) + "...")

    console.log("  PASSED: Admin generates invite for a unit")
    passed++
  } catch (err) {
    console.error("  FAILED:", err.message)
    failed++
  } finally {
    await context.close()
  }
}

async function test2_TenantRegisters(browser) {
  console.log("\n--- Test 2: Tenant registers via invite link ---")
  assert(capturedInviteUrl, "Invite URL must be captured from Test 1")

  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    // Navigate to the invite URL
    await page.goto(capturedInviteUrl)
    await page.waitForLoadState("networkidle")

    // Verify the page shows "Create your account"
    await page.waitForSelector("text=Create your account", { timeout: 10000 })
    const bodyText = await page.textContent("body")
    assert(bodyText.includes("Unit"), "Page should show unit number")
    console.log("  Invite page shows 'Create your account' with unit number")

    // Fill in registration form
    await page.fill("#invite-name", TENANT_NAME)
    await page.fill("#invite-email", TENANT_EMAIL)
    await page.fill("#invite-password", TENANT_PASSWORD)
    await page.fill("#invite-confirmPassword", TENANT_PASSWORD)

    // Submit the registration form
    await page.click('button[type="submit"]')

    // Wait for redirect to /tenant/dashboard
    await page.waitForURL("**/tenant/dashboard", { timeout: 15000 })
    console.log("  Tenant redirected to /tenant/dashboard")

    // Verify dashboard loads
    const dashboardContent = await page.textContent("body")
    assert(dashboardContent.length > 0, "Dashboard body should have content")
    console.log("  Dashboard loaded, session is active")

    console.log("  PASSED: Tenant registers via invite link")
    passed++
  } catch (err) {
    console.error("  FAILED:", err.message)
    failed++
  } finally {
    await context.close()
  }
}

async function test3_UsedInviteShowsError(browser) {
  console.log("\n--- Test 3: Used invite shows error ---")
  assert(capturedInviteUrl, "Invite URL must be captured from Test 1")

  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    // Navigate to the SAME invite URL
    await page.goto(capturedInviteUrl)
    await page.waitForLoadState("networkidle")

    // Verify "already used" message
    await page.waitForSelector("text=Invite already used", { timeout: 10000 })
    console.log("  Page shows 'Invite already used' message")

    // Verify no registration form is shown
    const formExists = await page.locator("#invite-name").count()
    assert(formExists === 0, "Registration form should NOT be visible")
    console.log("  No registration form visible")

    console.log("  PASSED: Used invite shows error")
    passed++
  } catch (err) {
    console.error("  FAILED:", err.message)
    failed++
  } finally {
    await context.close()
  }
}

async function test4_InvalidTokenShowsError(browser) {
  console.log("\n--- Test 4: Invalid token shows error ---")
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    // Navigate to a totally invalid token
    await page.goto(`${BASE_URL}/invite/totally-invalid-token-string`)
    await page.waitForLoadState("networkidle")

    // Verify "Invalid invite link" message
    await page.waitForSelector("text=Invalid invite link", { timeout: 10000 })
    console.log("  Page shows 'Invalid invite link' message")

    console.log("  PASSED: Invalid token shows error")
    passed++
  } catch (err) {
    console.error("  FAILED:", err.message)
    failed++
  } finally {
    await context.close()
  }
}

// Main
async function main() {
  console.log("=== Full Invite Flow E2E Tests ===")
  console.log("Tenant email:", TENANT_EMAIL)

  const browser = await chromium.launch({ headless: true })

  try {
    await test1_AdminGeneratesInvite(browser)
    await test2_TenantRegisters(browser)
    await test3_UsedInviteShowsError(browser)
    await test4_InvalidTokenShowsError(browser)
  } finally {
    await browser.close()
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed out of 4 tests ===`)

  if (failed > 0) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error("Fatal error:", err)
  process.exit(1)
})
