// e2e/assets/asset-et-crud.spec.ts
//
// This Playwright test verifies Entry Target CRUD operations and how ET changes
// affect BUY transactions and Dashboard pullback display.
//
// Test flow:
// 1. Create asset with PTs and budget
// 2. Create ET -2%, verify in table
// 3. Edit ET to -4%, verify in table
// 4. Delete ET, verify confirmation dialog and deletion
// 5. Navigate to Transactions - verify New Transaction button is hidden
// 6. Back to Asset, recreate ET -2%
// 7. Create BuyA transaction (Initial @ $100, $200)
// 8. Update price to $110, create BuyB transaction (Custom @ $110, $300)
// 9. Update price to $90
// 10. Edit ET to -4%, verify transactions are updated with new ET values
// 11. Navigate to Dashboard, verify Pullback value

import { test, expect } from "@playwright/test";
import { loginUser, clearBrowserState } from "../utils/auth";
import { loadAssetETCrudTestData } from "../utils/jsonHelper";
import {
  waitForAssetsTableToLoad,
  navigateToAssetsPage,
  cleanupTestAssetViaUI,
  createAssetViaUI,
  createTarget,
  verifyTarget,
  editTarget,
  deleteTarget,
  navigateToTransactionsPage,
  navigateBackToEditPage,
  navigateToDashboard,
  createBuyTransaction,
  verifyTransaction,
  verifyWallet,
  verifyOverview,
  verifyNewTransactionButtonHidden,
  verifyDashboardPullback,
  verifyEntryTargetColumnHeader,
  verifyTransactionEntryTarget,
  updateTestPriceOnEditPage,
  createBudget,
} from "../utils/assetHelper";

// Set test timeout to 240 seconds (longer for full ET CRUD flow + transactions + dashboard)
test.setTimeout(240000);

// Load test configuration from JSON
const testConfig = loadAssetETCrudTestData("e2e/assets/asset-et-crud.json");

// Test Suite
test.describe("Assets - Entry Target CRUD (JSON-driven)", () => {
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

  test(`${testConfig.scenario} - Entry Target CRUD and Transaction Updates`, async ({ page }) => {
    console.log(`[${testConfig.scenario}] Starting test...`);
    console.log(`[${testConfig.scenario}] ${testConfig.description}`);

    // Step 1: Navigate to Assets page and clean up
    console.log(`[${testConfig.scenario}] Step 1: Navigate and clean up...`);
    await navigateToAssetsPage(page);
    await cleanupTestAssetViaUI(page, testConfig.asset.input.symbol);

    // Step 2: Create prerequisite asset
    console.log(`[${testConfig.scenario}] Step 2: Create prerequisite asset...`);
    await createAssetViaUI(page, testConfig.asset.input);

    // Step 3: Create Profit Targets
    console.log(`[${testConfig.scenario}] Step 3: Create Profit Targets...`);
    for (const pt of testConfig.profitTargets) {
      await createTarget(page, "profit", pt.input);
    }

    // Step 4: Create budget if specified
    if (testConfig.asset.budget) {
      console.log(`[${testConfig.scenario}] Step 4: Create budget...`);
      await createBudget(page, testConfig.asset.budget.year, testConfig.asset.budget.amount);
    }

    // Step 5: Create Entry Target
    console.log(`[${testConfig.scenario}] Step 5: Create Entry Target...`);
    await createTarget(page, "entry", testConfig.steps.createET.input);
    await verifyTarget(page, "entry", testConfig.steps.createET.expected);

    // Step 6: Edit Entry Target
    console.log(`[${testConfig.scenario}] Step 6: Edit Entry Target to -4%...`);
    await editTarget(page, "entry", testConfig.steps.createET.input.sortOrder, testConfig.steps.editET.input);
    await verifyTarget(page, "entry", testConfig.steps.editET.expected);

    // Step 7: Delete Entry Target
    console.log(`[${testConfig.scenario}] Step 7: Delete Entry Target...`);
    // Note: The deleteTarget function handles the confirmation dialog automatically
    await deleteTarget(page, "entry", testConfig.steps.editET.input.sortOrder);
    console.log(`[${testConfig.scenario}] Entry Target deleted.`);

    // Step 8: Verify ET is deleted (Add button should be visible)
    console.log(`[${testConfig.scenario}] Step 8: Verify ET is deleted...`);
    await expect(page.locator('[data-testid="entry-target-add-btn"]')).toBeVisible({ timeout: 5000 });

    // Step 9: Navigate to Transactions - verify New Transaction button is hidden
    console.log(`[${testConfig.scenario}] Step 9: Verify New Transaction button is hidden without ET...`);
    // Navigate directly since navigateToTransactionsPage expects the button to be visible
    await page.locator('[data-testid="link-transactions"]').click();
    await expect(page).toHaveURL(/\/transactions$/);
    // Wait for page to load (give it time to render)
    await page.waitForTimeout(2000);
    await verifyNewTransactionButtonHidden(page);

    // Step 10: Back to Asset, recreate ET -2%
    console.log(`[${testConfig.scenario}] Step 10: Recreate Entry Target...`);
    await navigateBackToEditPage(page);
    await createTarget(page, "entry", testConfig.steps.recreateET.input);
    await verifyTarget(page, "entry", testConfig.steps.recreateET.expected);

    // Step 11: Navigate to Transactions and create BuyA
    console.log(`[${testConfig.scenario}] Step 11: Create BuyA transaction...`);
    await navigateToTransactionsPage(page);
    const buyAAction = testConfig.steps.transactions.buyA;
    if (buyAAction.input) {
      await createBuyTransaction(page, buyAAction.input);
      // Wait for page to reload and loading to complete
      await page.waitForTimeout(1000);
      // Wait for loading indicator to disappear
      await page.waitForSelector('text="Loading..."', { state: 'hidden', timeout: 15000 }).catch(() => {});
      // Wait for transaction row to appear
      await page.waitForSelector('tr[data-testid^="transaction-row-"]', { timeout: 10000 });

      if (buyAAction.expected.transaction) {
        console.log(`[${testConfig.scenario}] Verifying BuyA transaction...`);
        await verifyTransaction(page, buyAAction.expected.transaction);
      }

      console.log(`[${testConfig.scenario}] Verifying wallets after BuyA...`);
      for (const wallet of buyAAction.expected.wallets) {
        await verifyWallet(page, wallet);
      }

      console.log(`[${testConfig.scenario}] Verifying overview after BuyA...`);
      await verifyOverview(page, buyAAction.expected.overview);
    }

    // Step 12: Update price to $110 and create BuyB
    console.log(`[${testConfig.scenario}] Step 12: Create BuyB transaction...`);
    const buyBAction = testConfig.steps.transactions.buyB;
    if (buyBAction.testPriceUpdate) {
      await navigateBackToEditPage(page);
      await updateTestPriceOnEditPage(page, buyBAction.testPriceUpdate);
      await navigateToTransactionsPage(page);
    }
    if (buyBAction.input) {
      await createBuyTransaction(page, buyBAction.input);
      // Wait for page to reload and loading to complete
      await page.waitForTimeout(1000);
      // Wait for loading indicator to disappear
      await page.waitForSelector('text="Loading..."', { state: 'hidden', timeout: 15000 }).catch(() => {});
      // Wait for transaction row to appear
      await page.waitForSelector('tr[data-testid^="transaction-row-"]', { timeout: 10000 });

      if (buyBAction.expected.transaction) {
        console.log(`[${testConfig.scenario}] Verifying BuyB transaction...`);
        await verifyTransaction(page, buyBAction.expected.transaction);
      }

      console.log(`[${testConfig.scenario}] Verifying wallets after BuyB...`);
      for (const wallet of buyBAction.expected.wallets) {
        await verifyWallet(page, wallet);
      }

      console.log(`[${testConfig.scenario}] Verifying overview after BuyB...`);
      await verifyOverview(page, buyBAction.expected.overview);
    }

    // Step 13: Update price to $90
    console.log(`[${testConfig.scenario}] Step 13: Update price to $90...`);
    const priceUpdateAction = testConfig.steps.transactions.priceUpdate;
    if (priceUpdateAction.testPriceUpdate) {
      await navigateBackToEditPage(page);
      await updateTestPriceOnEditPage(page, priceUpdateAction.testPriceUpdate);
    }

    // Step 14: Edit ET to -4%
    console.log(`[${testConfig.scenario}] Step 14: Edit ET to -4%...`);
    const editETAfter = testConfig.steps.editETAfterTransactions;
    await editTarget(page, "entry", "1", editETAfter.input);
    await verifyTarget(page, "entry", editETAfter.expected);

    // Step 15: Navigate to Transactions and verify ET column header and values
    console.log(`[${testConfig.scenario}] Step 15: Verify transactions updated with new ET values...`);
    await navigateToTransactionsPage(page);

    // Verify column header
    await verifyEntryTargetColumnHeader(page, editETAfter.expectedColumnHeader);

    // Verify each transaction's ET value
    for (const txn of editETAfter.expectedTransactions) {
      await verifyTransactionEntryTarget(page, txn.price, txn.signal, txn.entryTarget);
    }

    // Step 16: Navigate to Dashboard and verify Pullback
    console.log(`[${testConfig.scenario}] Step 16: Verify Dashboard Pullback...`);
    const dashboardVerification = testConfig.steps.dashboardVerification;
    await navigateToDashboard(page);
    await verifyDashboardPullback(page, dashboardVerification.symbol, dashboardVerification.pullback);

    // Cleanup
    console.log(`\n[${testConfig.scenario}] Cleaning up...`);
    await navigateToAssetsPage(page);
    await cleanupTestAssetViaUI(page, testConfig.asset.input.symbol);

    console.log(`[${testConfig.scenario}] Test completed successfully!`);
  });
});
