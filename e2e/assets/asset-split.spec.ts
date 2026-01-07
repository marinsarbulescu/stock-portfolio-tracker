// e2e/assets/asset-split.spec.ts
//
// This Playwright test verifies SPLIT transaction functionality.
// Tests that splits correctly adjust wallet shares and prices.
// All test input/output values are loaded from asset-split.json

import { test, expect } from "@playwright/test";
import { loginUser, clearBrowserState } from "../utils/auth";
import { loadAssetSplitTestData, SplitStepTransaction, TransactionInput, SplitTransactionInput } from "../utils/jsonHelper";
import {
  setupTestAsset,
  cleanupTestAssetViaUI,
  navigateToAssetsPage,
  navigateToTransactionsPage,
  createBuyTransaction,
  createSplitTransaction,
  deleteSplitTransaction,
  verifyWallet,
} from "../utils/assetHelper";

// Set test timeout
test.setTimeout(180000);

// Load test configuration from JSON
const testConfig = loadAssetSplitTestData("e2e/assets/asset-split.json");

test.describe("Assets - Stock Split (JSON-driven)", () => {
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

  test(`${testConfig.scenario} - Stock split transactions`, async ({ page }) => {
    console.log(`[${testConfig.scenario}] Starting test...`);
    console.log(`[${testConfig.scenario}] ${testConfig.description}`);

    const stepEntries = Object.entries(testConfig.steps);

    for (let stepIndex = 0; stepIndex < stepEntries.length; stepIndex++) {
      const [stepKey, step] = stepEntries[stepIndex];
      console.log(`\n[${testConfig.scenario}] === Step ${stepIndex + 1}/${stepEntries.length}: ${stepKey} ===`);
      console.log(`[${testConfig.scenario}] ${step.description}`);

      // Setup fresh asset for each step (since steps are independent scenarios)
      console.log(`[${testConfig.scenario}] Setting up test asset...`);
      await setupTestAsset(page, {
        asset: testConfig.asset.input,
        entryTargets: testConfig.entryTargets.map(et => et.input),
        profitTargets: testConfig.profitTargets.map(pt => pt.input),
      });

      // Navigate to transactions page
      await navigateToTransactionsPage(page);
      await expect(page.locator('[data-testid="btn-new-transaction"]')).toBeVisible({ timeout: 10000 });

      // Process each transaction in this step
      for (let txnIndex = 0; txnIndex < step.transactions.length; txnIndex++) {
        const txn = step.transactions[txnIndex] as SplitStepTransaction;
        console.log(`[${testConfig.scenario}] Transaction ${txnIndex + 1}/${step.transactions.length}: ${txn.type}`);

        if (txn.type === "BUY") {
          const buyInput = txn.input as TransactionInput;
          console.log(`[${testConfig.scenario}] Creating BUY: ${buyInput.signal} @ $${buyInput.price}...`);
          await createBuyTransaction(page, buyInput);
        } else if (txn.type === "SPLIT") {
          const splitInput = txn.input as SplitTransactionInput;
          console.log(`[${testConfig.scenario}] Creating SPLIT: ${splitInput.splitRatio}:1...`);
          // Extract expected wallet for robust waiting (if defined)
          const expectedWallet = txn.expected?.wallets?.[0]
            ? { ptPercent: txn.expected.wallets[0].ptPercent, shares: txn.expected.wallets[0].shares }
            : undefined;
          await createSplitTransaction(page, splitInput.splitRatio, expectedWallet);
        } else if (txn.type === "DELETE_SPLIT") {
          console.log(`[${testConfig.scenario}] Attempting to delete SPLIT...`);
          await deleteSplitTransaction(page);

          // Verify error message appears
          if (txn.expected?.errorMessage) {
            console.log(`[${testConfig.scenario}] Verifying error message...`);
            await expect(page.locator(`text=/${txn.expected.errorMessage}/i`)).toBeVisible({ timeout: 5000 });
            console.log(`[${testConfig.scenario}] Error message verified.`);
          }
        }

        // Verify wallets if expected
        if (txn.expected?.wallets) {
          console.log(`[${testConfig.scenario}] Verifying ${txn.expected.wallets.length} wallet(s)...`);
          for (const wallet of txn.expected.wallets) {
            await verifyWallet(page, wallet);
          }
          console.log(`[${testConfig.scenario}] Wallets verified.`);
        }
      }

      console.log(`[${testConfig.scenario}] Step ${stepKey} completed.`);

      // Cleanup asset before next step
      console.log(`[${testConfig.scenario}] Cleaning up before next step...`);
      await navigateToAssetsPage(page);
      await cleanupTestAssetViaUI(page, testConfig.asset.input.symbol);
    }

    console.log(`\n[${testConfig.scenario}] All steps completed successfully!`);
  });
});
