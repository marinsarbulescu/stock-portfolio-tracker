// e2e/assets/asset-crud.spec.ts
//
// This Playwright test verifies the CRUD operations for assets.
// All test input/output values are loaded from asset-crud.json
//
// Test flow:
// 1. Login to the application
// 2. Navigate to Assets page
// 3. Clean up any existing test assets (from JSON config)
// 4. CREATE: Fill form and submit
// 5. Verify created asset in table
// 6. EDIT: Navigate to edit page, update values, submit
// 7. Verify edited asset in table
// 8. DELETE: Delete the asset
// 9. Verify asset is removed from table

import { test, expect } from "@playwright/test";
import { loginUser, clearBrowserState } from "../utils/auth";
import { loadAssetCrudTestData, AssetAction } from "../utils/jsonHelper";

// Set test timeout to 90 seconds (longer for full CRUD flow)
test.setTimeout(90000);

// Load test configuration from JSON
const testConfig = loadAssetCrudTestData("e2e/assets/asset-crud.json");

// Helper function to wait for assets table to load
async function waitForAssetsTableToLoad(page: ReturnType<typeof test.step>) {
  console.log("[PageHelper] Waiting for assets table to load...");
  // First wait for the page to start loading
  await expect(
    page.locator('[data-testid="btn-new-asset"]')
  ).toBeVisible({ timeout: 15000 });
  // Then wait for loading indicator to disappear
  await expect(
    page.getByText("Loading assets...")
  ).not.toBeVisible({ timeout: 15000 });
  console.log("[PageHelper] Assets table loaded.");
}

// Helper function to navigate to Assets page
async function navigateToAssetsPage(page: ReturnType<typeof test.step>) {
  console.log("[PageHelper] Navigating to Assets page...");
  // Use page.goto for a fresh load (avoids React state caching issues)
  await page.goto("/assets");
  await expect(page).toHaveURL(/\/assets$/);
  await waitForAssetsTableToLoad(page);
  console.log("[PageHelper] Successfully navigated to Assets page.");
}

// Helper function to check if test asset exists and delete it via UI
async function cleanupTestAssetViaUI(page: ReturnType<typeof test.step>, symbol: string) {
  console.log(`[PageHelper] Checking for existing test asset: ${symbol}...`);

  // Check if asset exists in the table
  const assetLink = page.locator(`[data-testid="asset-table-symbol-${symbol}"]`);
  const assetExists = await assetLink.count() > 0;

  if (assetExists) {
    console.log(`[PageHelper] Found existing asset ${symbol}, deleting...`);

    // Click Edit link to go to edit page
    const editLink = page.locator(`[data-testid="asset-table-edit-${symbol}"]`);
    await editLink.click();

    // Wait for edit page to load
    await expect(page.locator('[data-testid="btn-delete-asset"]')).toBeVisible({
      timeout: 10000,
    });

    // Set up dialog handler for confirm dialog
    page.once("dialog", (dialog) => dialog.accept());

    // Click delete button
    await page.locator('[data-testid="btn-delete-asset"]').click();

    // Wait for redirect back to assets page
    await expect(page).toHaveURL(/\/assets$/);

    // Verify asset is deleted
    await expect(
      page.locator(`[data-testid="asset-table-symbol-${symbol}"]`)
    ).not.toBeVisible({ timeout: 5000 });

    console.log(`[PageHelper] Asset ${symbol} deleted successfully.`);
  } else {
    console.log(`[PageHelper] No existing asset ${symbol} found.`);
  }
}

// Helper function to create asset via UI
async function createAssetViaUI(
  page: ReturnType<typeof test.step>,
  input: AssetAction["input"]
) {
  console.log("[PageHelper] Creating asset via UI...");

  // Click New Asset button
  await page.locator('[data-testid="btn-new-asset"]').click();

  // Wait for new asset form to load
  await expect(page.locator('[data-testid="asset-form-symbol"]')).toBeVisible({
    timeout: 10000,
  });

  // Fill the form
  await page.locator('[data-testid="asset-form-symbol"]').fill(input.symbol);
  await page.locator('[data-testid="asset-form-name"]').fill(input.name);
  await page.locator('[data-testid="asset-form-type"]').selectOption(input.type);
  await page.locator('[data-testid="asset-form-testPrice"]').fill(input.testPrice);
  await page.locator('[data-testid="asset-form-commission"]').fill(input.commission);
  await page.locator('[data-testid="asset-form-status"]').selectOption(input.status);

  // Submit form
  await page.locator('[data-testid="asset-form-submit"]').click();

  // Wait for navigation to edit page (after successful creation)
  await expect(page).toHaveURL(/\/assets\/[^/]+$/);

  console.log("[PageHelper] Asset created successfully.");
}

// Helper function to edit asset via UI
async function editAssetViaUI(
  page: ReturnType<typeof test.step>,
  currentSymbol: string,
  input: AssetAction["input"]
) {
  console.log(`[PageHelper] Editing asset ${currentSymbol} via UI...`);

  // Find and click the Edit link for the asset
  const editLink = page.locator(`[data-testid="asset-table-edit-${currentSymbol}"]`);
  await editLink.click();

  // Wait for edit form to load
  await expect(page.locator('[data-testid="asset-form-symbol"]')).toBeVisible({
    timeout: 10000,
  });

  // Clear and fill the form with new values
  await page.locator('[data-testid="asset-form-symbol"]').clear();
  await page.locator('[data-testid="asset-form-symbol"]').fill(input.symbol);

  await page.locator('[data-testid="asset-form-name"]').clear();
  await page.locator('[data-testid="asset-form-name"]').fill(input.name);

  await page.locator('[data-testid="asset-form-type"]').selectOption(input.type);

  await page.locator('[data-testid="asset-form-testPrice"]').clear();
  await page.locator('[data-testid="asset-form-testPrice"]').fill(input.testPrice);

  await page.locator('[data-testid="asset-form-commission"]').clear();
  await page.locator('[data-testid="asset-form-commission"]').fill(input.commission);

  await page.locator('[data-testid="asset-form-status"]').selectOption(input.status);

  // Submit form
  await page.locator('[data-testid="asset-form-submit"]').click();

  // Wait for form to save (button text changes from "Saving..." back to "Save Changes")
  await expect(page.locator('[data-testid="asset-form-submit"]')).toHaveText("Save Changes", {
    timeout: 10000,
  });

  console.log("[PageHelper] Asset edited successfully.");
}

// Helper function to delete asset via UI
async function deleteAssetViaUI(
  page: ReturnType<typeof test.step>,
  symbol: string
) {
  console.log(`[PageHelper] Deleting asset ${symbol} via UI...`);

  // Find and click the Edit link for the asset
  const editLink = page.locator(`[data-testid="asset-table-edit-${symbol}"]`);
  await editLink.click();

  // Wait for edit page to load
  await expect(page.locator('[data-testid="btn-delete-asset"]')).toBeVisible({
    timeout: 10000,
  });

  // Set up dialog handler for confirm dialog
  page.once("dialog", (dialog) => dialog.accept());

  // Click delete button
  await page.locator('[data-testid="btn-delete-asset"]').click();

  // Wait for redirect back to assets page
  await expect(page).toHaveURL(/\/assets$/);

  console.log("[PageHelper] Asset deleted successfully.");
}

// Helper function to verify asset in table
async function verifyAssetInTable(
  page: ReturnType<typeof test.step>,
  expected: AssetAction["expected"]
) {
  console.log("[PageHelper] Verifying asset in table...");

  // Verify symbol
  const symbolCell = page.locator(
    `[data-testid="asset-table-symbol-${expected.symbol}"]`
  );
  await expect(symbolCell).toBeVisible({ timeout: 10000 });
  await expect(symbolCell).toHaveText(expected.symbol);

  // Verify name
  const nameCell = page.locator(
    `[data-testid="asset-table-name-${expected.symbol}"]`
  );
  await expect(nameCell).toHaveText(expected.name);

  // Verify type
  const typeCell = page.locator(
    `[data-testid="asset-table-type-${expected.symbol}"]`
  );
  await expect(typeCell).toHaveText(expected.type);

  // Verify commission
  const commissionCell = page.locator(
    `[data-testid="asset-table-commission-${expected.symbol}"]`
  );
  await expect(commissionCell).toHaveText(expected.commission);

  // Verify status
  const statusCell = page.locator(
    `[data-testid="asset-table-status-${expected.symbol}"]`
  );
  await expect(statusCell).toHaveText(expected.status);

  console.log("[PageHelper] Asset verified successfully in table.");
}

// Helper function to verify asset is NOT in table
async function verifyAssetNotInTable(
  page: ReturnType<typeof test.step>,
  symbol: string
) {
  console.log(`[PageHelper] Verifying asset ${symbol} is NOT in table...`);

  const symbolCell = page.locator(
    `[data-testid="asset-table-symbol-${symbol}"]`
  );
  await expect(symbolCell).not.toBeVisible({ timeout: 5000 });

  console.log(`[PageHelper] Asset ${symbol} confirmed not in table.`);
}

// Test Suite
test.describe("Assets - CRUD Operations (JSON-driven)", () => {
  test.beforeEach(async ({ page }) => {
    console.log("[BEFORE EACH] Starting fresh session setup...");

    // Clear browser state and establish clean session
    await clearBrowserState(page);
    console.log("[BEFORE EACH] Browser state cleared.");

    // Login with test credentials
    await loginUser(page);
    console.log("[BEFORE EACH] Login successful.");
  });

  test.afterEach(async ({ page }) => {
    console.log("[AFTER EACH] Starting cleanup...");

    try {
      // Navigate to assets page
      await page.goto("/assets");
      await expect(page).toHaveURL(/\/assets$/);
      await waitForAssetsTableToLoad(page);

      // Clean up both possible test assets (in case test failed mid-way)
      await cleanupTestAssetViaUI(page, testConfig.create.input.symbol);
      await cleanupTestAssetViaUI(page, testConfig.edit.input.symbol);
    } catch (error) {
      console.warn("[AFTER EACH] Cleanup failed:", error);
    }
  });

  test(`${testConfig.scenario} - Create, Edit, and Delete asset`, async ({
    page,
  }) => {
    console.log(`[${testConfig.scenario}] Starting test...`);
    console.log(`[${testConfig.scenario}] ${testConfig.description}`);

    // Step 1: Navigate to Assets page
    console.log(`[${testConfig.scenario}] Step 1: Navigating to Assets page...`);
    await navigateToAssetsPage(page);

    // Step 2: Clean up any existing test assets
    console.log(`[${testConfig.scenario}] Step 2: Cleaning up existing test assets...`);
    await cleanupTestAssetViaUI(page, testConfig.create.input.symbol);
    await cleanupTestAssetViaUI(page, testConfig.edit.input.symbol);

    // Step 3: Create asset via UI
    console.log(`[${testConfig.scenario}] Step 3: Creating asset via UI...`);
    await createAssetViaUI(page, testConfig.create.input);

    // Step 4: Navigate to Assets page and verify created asset
    console.log(`[${testConfig.scenario}] Step 4: Verifying created asset in table...`);
    await navigateToAssetsPage(page);
    await verifyAssetInTable(page, testConfig.create.expected);

    // Step 5: Edit asset via UI
    console.log(`[${testConfig.scenario}] Step 5: Editing asset via UI...`);
    await editAssetViaUI(page, testConfig.create.expected.symbol, testConfig.edit.input);

    // Step 6: Navigate to Assets page and verify edited asset
    console.log(`[${testConfig.scenario}] Step 6: Verifying edited asset in table...`);
    await navigateToAssetsPage(page);
    await verifyAssetInTable(page, testConfig.edit.expected);

    // Step 7: Delete asset via UI
    console.log(`[${testConfig.scenario}] Step 7: Deleting asset via UI...`);
    await deleteAssetViaUI(page, testConfig.edit.expected.symbol);

    // Step 8: Verify asset is deleted
    console.log(`[${testConfig.scenario}] Step 8: Verifying asset is deleted...`);
    await waitForAssetsTableToLoad(page);
    await verifyAssetNotInTable(page, testConfig.edit.expected.symbol);

    console.log(`[${testConfig.scenario}] Test completed successfully!`);
  });
});
