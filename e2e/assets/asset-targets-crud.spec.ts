// e2e/assets/asset-targets-crud.spec.ts
//
// This Playwright test verifies Entry Target and Profit Target CRUD operations.
// All test input/output values are loaded from asset-targets-crud.json
//
// Test flow:
// 1. Login to the application
// 2. Navigate to Assets page and clean up test asset
// 3. Create prerequisite asset
// 4. Entry Target: Create, verify, edit, verify, delete
// 5. Profit Targets: Create 3, verify
// 6. Navigate to Transactions page, verify PT wallet tabs exist
// 7. Edit one Profit Target, verify
// 8. Navigate to Transactions page, verify PT tabs reflect the edit
// 9. Delete all Profit Targets
// 10. Navigate to Transactions page, verify no PT tabs
// 11. Delete the asset (cleanup)

import { test, expect, Page } from "@playwright/test";
import { loginUser, clearBrowserState } from "../utils/auth";
import { loadAssetTargetsTestData } from "../utils/jsonHelper";
import {
  waitForAssetsTableToLoad,
  navigateToAssetsPage,
  cleanupTestAssetViaUI,
  createAssetViaUI,
  deleteAssetViaUI,
  createTarget,
  verifyTarget,
  editTarget,
  deleteTarget,
} from "../utils/assetHelper";

// Set test timeout to 180 seconds (longer for full ET/PT CRUD flow + transactions page navigation)
test.setTimeout(180000);

// Load test configuration from JSON
const testConfig = loadAssetTargetsTestData("e2e/assets/asset-targets-crud.json");

// Helper: Navigate to Transactions page from asset edit page
async function navigateToTransactionsPage(page: Page) {
  console.log("[AssetTargets] Navigating to Transactions page...");
  await page.locator('[data-testid="link-transactions"]').click();
  await expect(page).toHaveURL(/\/transactions$/);
  // Wait for page to load - use the Edit Asset link which is always visible
  await expect(page.locator('[data-testid="link-edit-asset"]')).toBeVisible({ timeout: 10000 });
  console.log("[AssetTargets] On Transactions page.");
}

// Helper: Navigate back to asset edit page from Transactions page
async function navigateBackToEditPage(page: Page) {
  console.log("[AssetTargets] Navigating back to Edit Asset page...");
  await page.locator('[data-testid="link-edit-asset"]').click();
  await expect(page).toHaveURL(/\/assets\/[^/]+$/);
  await expect(page.locator('[data-testid="asset-form-symbol"]')).toBeVisible({ timeout: 10000 });
  console.log("[AssetTargets] Back on Edit Asset page.");
}

// Helper: Verify wallet tabs on Transactions page
async function verifyWalletTabs(page: Page, expectedPTPercents: string[]) {
  console.log(`[AssetTargets] Verifying wallet tabs: All + ${expectedPTPercents.join(", ")}...`);

  // Always expect "All" tab
  await expect(page.locator('[data-testid="wallet-tab-all"]')).toBeVisible({ timeout: 5000 });

  // Verify each expected PT tab exists
  for (const ptPercent of expectedPTPercents) {
    const tabLocator = page.locator(`[data-testid="wallet-tab-pt-${ptPercent}"]`);
    await expect(tabLocator).toBeVisible({ timeout: 5000 });
    console.log(`[AssetTargets] Found PT tab for +${ptPercent}%`);
  }

  console.log("[AssetTargets] Wallet tabs verified successfully.");
}

// Helper: Verify NO PT wallet tabs (only All or no tabs section)
async function verifyNoPTWalletTabs(page: Page) {
  console.log("[AssetTargets] Verifying no PT wallet tabs...");

  // The wallet-tabs container should either not exist or only contain "All" tab
  const tabsContainer = page.locator('[data-testid="wallet-tabs"]');
  const tabsExist = await tabsContainer.count() > 0;

  if (tabsExist) {
    // If tabs exist, only "All" should be there
    await expect(page.locator('[data-testid="wallet-tab-all"]')).toBeVisible();
    // PT tabs should not exist
    const ptTabs = page.locator('[data-testid^="wallet-tab-pt-"]');
    await expect(ptTabs).toHaveCount(0);
  }

  console.log("[AssetTargets] No PT wallet tabs confirmed.");
}

// Test Suite
test.describe("Assets - Entry Target & Profit Target CRUD (JSON-driven)", () => {
  test.beforeEach(async ({ page }) => {
    console.log("[BEFORE EACH] Starting fresh session setup...");
    await clearBrowserState(page);
    await loginUser(page);
    console.log("[BEFORE EACH] Login successful.");
  });

  test.afterEach(async ({ page }) => {
    console.log("[AFTER EACH] Starting cleanup...");
    try {
      await page.goto("/assets");
      await expect(page).toHaveURL(/\/assets$/);
      await waitForAssetsTableToLoad(page);
      await cleanupTestAssetViaUI(page, testConfig.asset.input.symbol);
    } catch (error) {
      console.warn("[AFTER EACH] Cleanup failed:", error);
    }
  });

  test(`${testConfig.scenario} - Entry Target and Profit Target CRUD`, async ({ page }) => {
    console.log(`[${testConfig.scenario}] Starting test...`);
    console.log(`[${testConfig.scenario}] ${testConfig.description}`);

    // Step 1: Navigate to Assets page and clean up
    console.log(`[${testConfig.scenario}] Step 1: Navigate and clean up...`);
    await navigateToAssetsPage(page);
    await cleanupTestAssetViaUI(page, testConfig.asset.input.symbol);

    // Step 2: Create prerequisite asset
    console.log(`[${testConfig.scenario}] Step 2: Create prerequisite asset...`);
    await createAssetViaUI(page, testConfig.asset.input);

    // Step 3: Entry Target - Create
    console.log(`[${testConfig.scenario}] Step 3: Create Entry Target...`);
    await createTarget(page, "entry", testConfig.entryTarget.create.input);
    await verifyTarget(page, "entry", testConfig.entryTarget.create.expected);

    // Step 4: Entry Target - Edit
    console.log(`[${testConfig.scenario}] Step 4: Edit Entry Target...`);
    await editTarget(page, "entry", testConfig.entryTarget.create.input.sortOrder, testConfig.entryTarget.edit.input);
    await verifyTarget(page, "entry", testConfig.entryTarget.edit.expected);

    // Step 5: Entry Target - Delete
    console.log(`[${testConfig.scenario}] Step 5: Delete Entry Target...`);
    await deleteTarget(page, "entry", testConfig.entryTarget.edit.input.sortOrder);

    // Step 6: Profit Targets - Create 3
    console.log(`[${testConfig.scenario}] Step 6: Create 3 Profit Targets...`);
    for (const pt of testConfig.profitTargets.create) {
      await createTarget(page, "profit", pt.input);
      await verifyTarget(page, "profit", pt.expected);
    }

    // Step 6b: Verify PT tabs on Transactions page after creating PTs
    console.log(`[${testConfig.scenario}] Step 6b: Verify PT tabs on Transactions page...`);
    await navigateToTransactionsPage(page);
    // Expect tabs for PT percentages from JSON create inputs
    const createdPTPercents = testConfig.profitTargets.create.map(pt => pt.input.targetPercent);
    await verifyWalletTabs(page, createdPTPercents);
    await navigateBackToEditPage(page);

    // Step 7: Profit Target - Edit PT2
    console.log(`[${testConfig.scenario}] Step 7: Edit Profit Target...`);
    await editTarget(page, "profit", testConfig.profitTargets.edit.targetSortOrder, testConfig.profitTargets.edit.input);
    await verifyTarget(page, "profit", testConfig.profitTargets.edit.expected);

    // Step 7b: Verify PT tabs reflect edited percentage
    console.log(`[${testConfig.scenario}] Step 7b: Verify PT tabs after edit...`);
    await navigateToTransactionsPage(page);
    // Replace edited PT's percentage in the expected list
    const editedSortOrder = parseInt(testConfig.profitTargets.edit.targetSortOrder);
    const editedPTPercents = createdPTPercents.map((pct, idx) =>
      idx + 1 === editedSortOrder ? testConfig.profitTargets.edit.input.targetPercent : pct
    );
    await verifyWalletTabs(page, editedPTPercents);
    await navigateBackToEditPage(page);

    // Step 8: Profit Targets - Delete all (in reverse order to avoid sortOrder issues)
    console.log(`[${testConfig.scenario}] Step 8: Delete all Profit Targets...`);
    await deleteTarget(page, "profit", "3");
    await deleteTarget(page, "profit", "2");
    await deleteTarget(page, "profit", "1");

    // Step 8b: Verify no PT tabs on Transactions page after deleting all PTs
    console.log(`[${testConfig.scenario}] Step 8b: Verify no PT tabs after delete...`);
    await navigateToTransactionsPage(page);
    await verifyNoPTWalletTabs(page);
    await navigateBackToEditPage(page);

    // Step 9: Delete asset
    console.log(`[${testConfig.scenario}] Step 9: Delete asset...`);
    await deleteAssetViaUI(page);

    // Verify asset is deleted
    await waitForAssetsTableToLoad(page);
    await expect(
      page.locator(`[data-testid="asset-table-symbol-${testConfig.asset.input.symbol}"]`)
    ).not.toBeVisible({ timeout: 5000 });

    console.log(`[${testConfig.scenario}] Test completed successfully!`);
  });
});
