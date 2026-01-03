// e2e/assets/dashboard-signals.spec.ts
//
// This Playwright test verifies %2PT color logic (green/yellow/default) in both
// the Dashboard table and the Wallets table on the Transactions page.
//
// Color thresholds:
// - green: %2PT >= -0.005% (PT hit or rounded to 0.00%)
// - yellow: -1% <= %2PT < -0.005% (close to PT)
// - default (no color): %2PT < -1% (far from PT)

import { test, expect } from "@playwright/test";
import { loginUser, clearBrowserState } from "../utils/auth";
import { loadDashboardSignalsTestData } from "../utils/jsonHelper";
import {
  setupTestAsset,
  navigateToAssetsPage,
  cleanupTestAssetViaUI,
  navigateToTransactionsPage,
  navigateToDashboard,
  createBuyTransaction,
  createSellTransaction,
  verifyTransaction,
  verifySellTransaction,
  verifyWallet,
  verifyWalletNotPresent,
  verifyOverview,
  verifyDashboardRow,
  updateTestPriceOnEditPage,
  navigateToAssetEditPage,
} from "../utils/assetHelper";

// Set test timeout to 180 seconds
test.setTimeout(180000);

// Load test configuration from JSON
const testConfig = loadDashboardSignalsTestData("e2e/assets/dashboard-signals.json");

test.describe("Dashboard Signals - %2PT Color Logic (JSON-driven)", () => {
  test.beforeEach(async ({ page }) => {
    console.log("[BEFORE EACH] Starting fresh session setup...");
    await clearBrowserState(page);
    await loginUser(page);
    console.log("[BEFORE EACH] Login successful.");
  });

  test.afterEach(async ({ page }) => {
    console.log("[AFTER EACH] Starting cleanup...");
    try {
      await navigateToAssetsPage(page);
      await cleanupTestAssetViaUI(page, testConfig.asset.input.symbol);
    } catch (error) {
      console.warn("[AFTER EACH] Cleanup failed:", error);
    }
  });

  test(`${testConfig.scenario} - Verify %2PT colors in Dashboard and Wallets tables`, async ({ page }) => {
    console.log(`[${testConfig.scenario}] Starting test...`);
    console.log(`[${testConfig.scenario}] ${testConfig.description}`);

    // Step 1: Setup test asset with ET and PTs
    console.log(`[${testConfig.scenario}] Setting up test asset...`);
    await setupTestAsset(page, {
      asset: testConfig.asset.input,
      entryTargets: testConfig.entryTargets.map(et => et.input),
      profitTargets: testConfig.profitTargets.map(pt => pt.input),
    });

    // Step 2: Navigate to transactions page
    console.log(`[${testConfig.scenario}] Navigating to transactions page...`);
    await navigateToTransactionsPage(page);
    await expect(page.locator('[data-testid="btn-new-transaction"]')).toBeVisible({ timeout: 10000 });

    // Process each action in order
    const actionEntries = Object.entries(testConfig.actions);

    for (let i = 0; i < actionEntries.length; i++) {
      const [actionKey, action] = actionEntries[i];
      const stepNum = i + 1;
      const isBuyTransaction = !!action.input;
      const isSellTransaction = !!action.isSell && !!action.sellInput;
      const isPriceUpdateOnly = !!action.testPriceUpdate && !action.input && !action.isSell;

      console.log(`\n[${testConfig.scenario}] ========================================`);
      console.log(`[${testConfig.scenario}] Action ${stepNum}/${actionEntries.length}: ${actionKey}`);
      console.log(`[${testConfig.scenario}] ========================================`);

      // Update test price if needed (for price-only updates, navigate to edit page first)
      if (action.testPriceUpdate) {
        if (isPriceUpdateOnly) {
          // Navigate to edit page to update price
          console.log(`[${testConfig.scenario}] Navigating to edit page to update test price...`);
          await navigateToAssetsPage(page);
          await navigateToAssetEditPage(page, testConfig.asset.input.symbol);
        }

        console.log(`[${testConfig.scenario}] Updating test price to $${action.testPriceUpdate}...`);
        await updateTestPriceOnEditPage(page, action.testPriceUpdate);

        if (isPriceUpdateOnly) {
          // Navigate back to transactions page
          console.log(`[${testConfig.scenario}] Navigating back to transactions page...`);
          await navigateToTransactionsPage(page);
          await expect(page.locator('[data-testid="btn-new-transaction"]')).toBeVisible({ timeout: 10000 });
        }
      }

      // Create BUY transaction if this action has input
      if (isBuyTransaction && action.input) {
        console.log(`[${testConfig.scenario}] Creating BUY transaction: ${action.input.signal} @ $${action.input.price}...`);
        await createBuyTransaction(page, action.input);

        // Wait for transaction to appear
        await page.waitForTimeout(1000);

        // Verify the BUY transaction
        if (action.expected.transaction) {
          console.log(`[${testConfig.scenario}] Verifying BUY transaction in table...`);
          await verifyTransaction(page, action.expected.transaction);
        }
      }

      // Create SELL transaction if this is a sell action
      if (isSellTransaction && action.sellInput) {
        console.log(`[${testConfig.scenario}] Creating SELL transaction from PT${action.sellInput.ptPercent}% wallet...`);
        await createSellTransaction(page, action.sellInput.ptPercent, action.sellInput.walletPrice, action.sellInput);

        // Wait for transaction to appear
        await page.waitForTimeout(1000);

        // Verify the SELL transaction
        if (action.expected.sellTransaction) {
          console.log(`[${testConfig.scenario}] Verifying SELL transaction in table...`);
          await verifySellTransaction(page, action.expected.sellTransaction);
        }
      }

      // Verify wallets with %2PT highlights
      console.log(`[${testConfig.scenario}] Verifying ${action.expected.wallets.length} wallets with %2PT colors...`);
      for (const wallet of action.expected.wallets) {
        console.log(`[${testConfig.scenario}]   - PT ${wallet.ptPercent}%: ${wallet.pct2pt} (${wallet.pct2ptHighlight})`);
        await verifyWallet(page, wallet);
      }

      // Verify wallets NOT present (for operations that remove wallets)
      if (action.expected.walletsNotPresent?.length) {
        console.log(`[${testConfig.scenario}] Verifying ${action.expected.walletsNotPresent.length} wallets NOT present...`);
        for (const walletNotPresent of action.expected.walletsNotPresent) {
          await verifyWalletNotPresent(page, walletNotPresent.ptPercent, walletNotPresent.price);
        }
      }

      // Verify overview
      console.log(`[${testConfig.scenario}] Verifying overview...`);
      await verifyOverview(page, action.expected.overview);

      // Navigate to Dashboard and verify %2PT color
      console.log(`[${testConfig.scenario}] Navigating to Dashboard to verify %2PT...`);
      await navigateToDashboard(page);

      console.log(`[${testConfig.scenario}] Verifying Dashboard %2PT: ${action.expected.dashboard.pct2pt} (${action.expected.dashboard.pct2ptHighlight})`);
      await verifyDashboardRow(page, action.expected.dashboard);

      // Navigate back to transactions for next action
      if (i < actionEntries.length - 1) {
        console.log(`[${testConfig.scenario}] Navigating back to transactions for next action...`);
        await navigateToAssetsPage(page);
        await navigateToAssetEditPage(page, testConfig.asset.input.symbol);
        await navigateToTransactionsPage(page);
        await expect(page.locator('[data-testid="btn-new-transaction"]')).toBeVisible({ timeout: 10000 });
      }

      console.log(`[${testConfig.scenario}] Action ${actionKey} verified successfully.`);
    }

    // Cleanup
    console.log(`\n[${testConfig.scenario}] Cleaning up...`);
    await navigateToAssetsPage(page);
    await cleanupTestAssetViaUI(page, testConfig.asset.input.symbol);

    console.log(`[${testConfig.scenario}] Test completed successfully!`);
  });
});
