// e2e/assets/asset-buy-crud.spec.ts
//
// This Playwright test verifies BUY transaction CRUD operations.
// All test input/output values are loaded from asset-buy-crud.json
//
// Test flow:
// 1. Login to the application
// 2. Create test asset with ET and PTs
// 3. Navigate to transactions page
// 4. Create BuyA transaction, verify table/wallets/overview
// 5. Create BuyB transaction, verify table/wallets/overview (cumulative)
// 6. Update test price to $120, create BuyC, verify (multiple wallet rows per PT)
// 7. Cleanup: delete asset

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
  updateTestPrice,
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

    // Step 7: Create BuyB transaction
    console.log(`[${testConfig.scenario}] Step 7: Creating BuyB transaction...`);
    const buyB = testConfig.transactions.buyB;
    await createBuyTransaction(page, buyB.input);

    // Wait for transaction to appear in the table
    await page.waitForTimeout(1000);

    // Step 8: Verify BuyB transaction in table
    console.log(`[${testConfig.scenario}] Step 8: Verifying BuyB transaction in table...`);
    await verifyTransaction(page, buyB.expected.transaction);

    // Verify prior transactions (BuyA) are still in table with correct values
    console.log(`[${testConfig.scenario}] Step 8b: Verifying prior transactions...`);
    for (const priorTxn of buyB.expected.priorTransactions || []) {
      await verifyTransaction(page, priorTxn);
    }

    // Step 9: Verify updated wallets (cumulative after BuyA + BuyB)
    console.log(`[${testConfig.scenario}] Step 9: Verifying wallets after BuyB...`);
    for (const walletExpected of buyB.expected.wallets) {
      await verifyWallet(page, walletExpected);
    }

    // Step 10: Verify updated overview
    console.log(`[${testConfig.scenario}] Step 10: Verifying overview after BuyB...`);
    await verifyOverview(page, buyB.expected.overview);

    // Step 11: Update test price to $120
    console.log(`[${testConfig.scenario}] Step 11: Updating test price to $120...`);
    const buyC = testConfig.transactions.buyC;
    await updateTestPrice(page, buyC.testPriceUpdate);

    // Step 12: Create BuyC transaction
    console.log(`[${testConfig.scenario}] Step 12: Creating BuyC transaction...`);
    await createBuyTransaction(page, buyC.input);

    // Wait for transaction to appear in the table
    await page.waitForTimeout(1000);

    // Step 13: Verify BuyC transaction in table
    console.log(`[${testConfig.scenario}] Step 13: Verifying BuyC transaction in table...`);
    await verifyTransaction(page, buyC.expected.transaction);

    // Verify prior transactions (BuyA, BuyB) are still in table with updated ET values
    console.log(`[${testConfig.scenario}] Step 13b: Verifying prior transactions...`);
    for (const priorTxn of buyC.expected.priorTransactions || []) {
      await verifyTransaction(page, priorTxn);
    }

    // Step 14: Verify all wallets (new $120 + old $100 with updated %2PT)
    console.log(`[${testConfig.scenario}] Step 14: Verifying wallets after BuyC...`);
    for (const walletExpected of buyC.expected.wallets) {
      await verifyWallet(page, walletExpected);
    }

    // Step 15: Verify updated overview
    console.log(`[${testConfig.scenario}] Step 15: Verifying overview after BuyC...`);
    await verifyOverview(page, buyC.expected.overview);

    // Step 16: Cleanup - navigate to assets and delete
    console.log(`[${testConfig.scenario}] Step 16: Cleaning up...`);
    await navigateToAssetsPage(page);
    await cleanupTestAssetViaUI(page, testConfig.asset.input.symbol);

    console.log(`[${testConfig.scenario}] Test completed successfully!`);
  });
});
