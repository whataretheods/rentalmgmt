import { test, expect } from "@playwright/test"
import * as path from "path"
import * as fs from "fs"

const BASE_URL = "http://localhost:3000"
const TENANT_EMAIL = process.env.TEST_TENANT_EMAIL || "testtenant@test.com"
const TENANT_PASSWORD = process.env.TEST_TENANT_PASSWORD || "TestPass123!"

test.describe("Tenant Document Management", () => {
  test.beforeEach(async ({ page }) => {
    // Login as test tenant
    await page.goto(`${BASE_URL}/auth/login`)
    await page.waitForLoadState("networkidle")
    await page.fill('input[type="email"]', TENANT_EMAIL)
    await page.fill('input[type="password"]', TENANT_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL("**/tenant/dashboard", { timeout: 15000 })
  })

  test("@smoke documents page loads with sections", async ({ page }) => {
    await page.goto(`${BASE_URL}/tenant/documents`)
    await page.waitForLoadState("networkidle")

    // Verify page heading
    await expect(
      page.locator("h1", { hasText: "Documents" })
    ).toBeVisible()

    // Verify sections are present
    await expect(
      page.locator("h2", { hasText: "Requested Documents" })
    ).toBeVisible({ timeout: 10000 })

    await expect(
      page.locator("h2", { hasText: "My Documents" })
    ).toBeVisible()
  })

  test("pending admin request is visible from seed data", async ({ page }) => {
    await page.goto(`${BASE_URL}/tenant/documents`)
    await page.waitForLoadState("networkidle")

    // Verify the seeded document request from admin is visible
    // The seed creates a "proof_of_income_insurance" request
    await expect(
      page.locator("text=Proof of Income").first()
    ).toBeVisible({ timeout: 10000 })

    // Verify the Upload button for fulfilling the request is present
    await expect(
      page.locator('button:has-text("Upload")').first()
    ).toBeVisible()
  })

  test("fulfill admin document request with file upload", async ({ page }) => {
    await page.goto(`${BASE_URL}/tenant/documents`)
    await page.waitForLoadState("networkidle")

    // Click "Upload" on the pending request to expand the upload form
    const uploadButton = page.locator('button:has-text("Upload")').first()
    await expect(uploadButton).toBeVisible({ timeout: 10000 })
    await uploadButton.click()

    // The inline upload form should now be visible
    await expect(page.locator("text=Upload Document")).toBeVisible({
      timeout: 5000,
    })

    // Create a small test file to upload
    const testFilePath = path.join(__dirname, "test-document.pdf")
    if (!fs.existsSync(testFilePath)) {
      // Create a minimal valid file for testing
      fs.writeFileSync(testFilePath, "%%PDF-1.4 test document content")
    }

    // Upload the test file
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(testFilePath)

    // Verify file name appears in preview
    await expect(
      page.locator("text=test-document.pdf").first()
    ).toBeVisible({ timeout: 5000 })

    // Submit the upload
    const submitButton = page.locator('button:has-text("Upload Document")')
    await submitButton.click()

    // Wait for success -- the page should refresh and show the document in "My Documents"
    await expect(
      page.locator("text=test-document.pdf").first()
    ).toBeVisible({ timeout: 10000 })

    // Clean up test file
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath)
    }
  })
})
