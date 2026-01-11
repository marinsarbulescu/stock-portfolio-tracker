// e2e/transactions/transaction-cash-crud.spec.ts
//
// This Playwright test verifies DIVIDEND/SLP transaction postdating, editing, and deleting.
// Tests that historical cash transactions can be inserted, modified, and removed with correct
// financial recalculation (OOP, Market Value, ROI, Available).
//
// All test input/output values are loaded from transaction-cash-crud.json

import { test, expect } from "@playwright/test";
import { loginUser, clearBrowserState } from "../utils/auth";
import { loadCashCrudTestData } from "../utils/jsonHelper";
import {
  setupTestAsset,
  navigateToAssetsPage,
  cleanupTestAssetViaUI,
  navigateToTransactionsPage,
  createBuyTransaction,
  createSellTransaction,
  createDividendSlpTransaction,
  editDividendSlpTransaction,
  deleteDividendSlpTransaction,
  updateTestPrice,
  verifyFinancialOverview,
  navigateToAssetEditPage,
} from "../utils/assetHelper";

// Set test timeout to 180 seconds
test.setTimeout(180000);

// Load test configuration from JSON
const testConfig = loadCashCrudTestData("e2e/transactions/transaction-cash-crud.json");

// Test Suite
test.describe("Cash Transaction CRUD (JSON-driven)", () => {
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

  test(`${testConfig.scenario} - Verify postdating, edit, and delete of cash transactions`, async ({ page }) => {
    console.log(`[${testConfig.scenario}] Starting test...`);
    console.log(`[${testConfig.scenario}] ${testConfig.description}`);

    // Step 1: Setup test asset with ET, PTs, and Budget
    console.log(`[${testConfig.scenario}] Setting up test asset with budget...`);
    await setupTestAsset(page, {
      asset: testConfig.asset.input,
      entryTargets: testConfig.entryTargets.map(et => et.input),
      profitTargets: testConfig.profitTargets.map(pt => pt.input),
      budget: testConfig.asset.budget,
    });

    // Step 2: Navigate to transactions page
    console.log(`[${testConfig.scenario}] Navigating to transactions page...`);
    await navigateToTransactionsPage(page);
    await expect(page.locator('[data-testid="btn-new-transaction"]')).toBeVisible({ timeout: 10000 });

    // Step 3: Create all setup transactions
    console.log(`[${testConfig.scenario}] Creating setup transactions...`);
    const setupEntries = Object.entries(testConfig.setupTransactions);

    for (let i = 0; i < setupEntries.length; i++) {
      const [txnKey, txn] = setupEntries[i];
      console.log(`[${testConfig.scenario}] Setup ${i + 1}/${setupEntries.length}: ${txnKey}`);

      // Update test price if needed
      if (txn.testPriceUpdate) {
        console.log(`[${testConfig.scenario}] Updating test price to $${txn.testPriceUpdate}...`);
        await updateTestPrice(page, txn.testPriceUpdate);
      }

      // Create transaction
      if (txn.isSell && txn.sellInput) {
        console.log(`[${testConfig.scenario}] Creating SELL: ${txn.sellInput.quantity} shares @ $${txn.sellInput.price}...`);
        await createSellTransaction(page, txn.sellInput.ptPercent, txn.sellInput.walletPrice, txn.sellInput);
      } else if (txn.input) {
        console.log(`[${testConfig.scenario}] Creating BUY: $${txn.input.investment} @ $${txn.input.price}...`);
        await createBuyTransaction(page, txn.input);
      }

      await page.waitForTimeout(500);
    }

    console.log(`[${testConfig.scenario}] All setup transactions created.`);

    // Step 4: Process each checkpoint
    console.log(`[${testConfig.scenario}] Processing ${testConfig.checkpoints.length} checkpoints...`);

    for (let i = 0; i < testConfig.checkpoints.length; i++) {
      const checkpoint = testConfig.checkpoints[i];
      console.log(`\n[${testConfig.scenario}] ========================================`);
      console.log(`[${testConfig.scenario}] Checkpoint ${i + 1}/${testConfig.checkpoints.length}: ${checkpoint.name}`);
      console.log(`[${testConfig.scenario}] ========================================`);

      // Execute the action
      if (checkpoint.action === "create" && checkpoint.editInput) {
        console.log(`[${testConfig.scenario}] Creating ${checkpoint.editInput.type}: $${checkpoint.editInput.amount}...`);
        await createDividendSlpTransaction(page, checkpoint.editInput);
      } else if (checkpoint.action === "edit" && checkpoint.target && checkpoint.editInput) {
        console.log(`[${testConfig.scenario}] Editing ${checkpoint.target.type}: ${checkpoint.target.amount} -> $${checkpoint.editInput.amount}...`);
        await editDividendSlpTransaction(page, checkpoint.target, checkpoint.editInput);
      } else if (checkpoint.action === "delete" && checkpoint.target) {
        console.log(`[${testConfig.scenario}] Deleting ${checkpoint.target.type}: ${checkpoint.target.amount}...`);
        await deleteDividendSlpTransaction(page, checkpoint.target);
      }

      // Wait for recalculation
      await page.waitForTimeout(1000);

      // Verify financial overview
      console.log(`[${testConfig.scenario}] Verifying financial overview...`);
      await verifyFinancialOverview(page, checkpoint.expected.financialOverview);

      console.log(`[${testConfig.scenario}] Checkpoint "${checkpoint.name}" verified successfully.`);
    }

    // Cleanup
    console.log(`\n[${testConfig.scenario}] Cleaning up...`);
    await navigateToAssetsPage(page);
    await cleanupTestAssetViaUI(page, testConfig.asset.input.symbol);

    console.log(`[${testConfig.scenario}] Test completed successfully!`);
  });
});
