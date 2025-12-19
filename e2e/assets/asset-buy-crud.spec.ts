// e2e/assets/asset-buy-crud.spec.ts
//
// This Playwright test verifies BUY transaction CRUD operations.
// All test input/output values are loaded from asset-buy-crud.json
//
// Test flow:
// 1. Login to the application
// 2. Create test asset with ET and PTs
// 3. Navigate to transactions page
// 4. Create BUY transaction (BuyA)
// 5. Verify transaction in table
// 6. Verify wallets for each PT
// 7. Verify overview section
// 8. Cleanup: delete asset

import { test, expect } from "@playwright/test";
import { loginUser, clearBrowserState } from "../utils/auth";
import { loadAssetBuyCrudTestData } from "../utils/jsonHelper";
import {
  setupTestAsset,
  navigateToAssetsPage,
  cleanupTestAssetViaUI,
  navigateToTransactionsPage,
  createBuyTransaction,
  verifyTransaction,
  verifyWallet,
  verifyOverview,
} from "../utils/assetHelper";

// Set test timeout to 180 seconds (longer for full BUY CRUD flow)
test.setTimeout(180000);

// Load test configuration from JSON
const testConfig = loadAssetBuyCrudTestData("e2e/assets/asset-buy-crud.json");

// Test Suite
test.describe("Assets - BUY Transaction CRUD (JSON-driven)", () => {
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
      await cleanupTestAssetViaUI(page, testConfig.asset.input.symbol);
    } catch (error) {
      console.warn("[AFTER EACH] Cleanup failed:", error);
    }
  });

  test(`${testConfig.scenario} - Create BUY transaction and verify`, async ({ page }) => {
    console.log(`[${testConfig.scenario}] Starting test...`);
    console.log(`[${testConfig.scenario}] ${testConfig.description}`);

    // Step 1: Setup test asset with ET and PTs
    console.log(`[${testConfig.scenario}] Step 1: Setting up test asset...`);
    await setupTestAsset(page, {
      asset: testConfig.asset.input,
      entryTargets: testConfig.entryTargets.map(et => et.input),
      profitTargets: testConfig.profitTargets.map(pt => pt.input),
    });

    // Step 2: Navigate to transactions page
    console.log(`[${testConfig.scenario}] Step 2: Navigating to transactions page...`);
    await navigateToTransactionsPage(page);

    // Wait for page to load
    await expect(page.locator('[data-testid="btn-new-transaction"]')).toBeVisible({ timeout: 10000 });

    // Step 3: Create BuyA transaction
    console.log(`[${testConfig.scenario}] Step 3: Creating BuyA transaction...`);
    const buyA = testConfig.transactions.buyA;
    await createBuyTransaction(page, buyA.input);

    // Wait for transaction to appear in the table
    await page.waitForTimeout(1000);

    // Step 4: Verify transaction in table
    console.log(`[${testConfig.scenario}] Step 4: Verifying transaction in table...`);
    await verifyTransaction(page, buyA.expected.transaction);

    // Step 5: Verify wallets for each PT
    console.log(`[${testConfig.scenario}] Step 5: Verifying wallets...`);
    for (const walletExpected of buyA.expected.wallets) {
      await verifyWallet(page, walletExpected);
    }

    // Step 6: Verify overview section
    console.log(`[${testConfig.scenario}] Step 6: Verifying overview...`);
    await verifyOverview(page, buyA.expected.overview);

    // Step 7: Cleanup - navigate to assets and delete
    console.log(`[${testConfig.scenario}] Step 7: Cleaning up...`);
    await navigateToAssetsPage(page);
    await cleanupTestAssetViaUI(page, testConfig.asset.input.symbol);

    console.log(`[${testConfig.scenario}] Test completed successfully!`);
  });
});
