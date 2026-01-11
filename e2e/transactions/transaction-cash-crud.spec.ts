// e2e/transactions/transaction-cash-crud.spec.ts
//
// This Playwright test verifies DIVIDEND/SLP transaction postdating, editing, and deleting.
// Tests that historical cash transactions can be inserted, modified, and removed with correct
// financial recalculation (OOP, Market Value, ROI, Available).
//
// All test input/output values are loaded from transaction-cash-crud.json

import { test, expect } from "@playwright/test";
import { loginUser, clearBrowserState } from "../utils/auth";
import { loadRoiTestData } from "../utils/jsonHelper";
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
} from "../utils/assetHelper";

// Set test timeout to 180 seconds
test.setTimeout(180000);

// Load test configuration from JSON
const testConfig = loadRoiTestData("e2e/transactions/transaction-cash-crud.json");

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

    // Process each transaction in order
    const transactionEntries = Object.entries(testConfig.transactions);

    for (let i = 0; i < transactionEntries.length; i++) {
      const [txnKey, txn] = transactionEntries[i];
      const stepNum = i + 1;
      const isSell = !!txn.isSell;
      const isDividendOrSlp = !!txn.isDividendOrSlp;
      const isDelete = !!txn.delete;
      const isEdit = !!txn.target && !isDelete;

      // Determine transaction type for logging
      let txnType = 'BUY';
      if (isSell) txnType = 'SELL';
      if (isDividendOrSlp && txn.dividendSlpInput) txnType = txn.dividendSlpInput.type;
      if (isEdit) txnType = `EDIT ${txn.target?.type}`;
      if (isDelete) txnType = `DELETE ${txn.target?.type}`;

      console.log(`\n[${testConfig.scenario}] ========================================`);
      console.log(`[${testConfig.scenario}] Transaction ${stepNum}/${transactionEntries.length}: ${txnKey} (${txnType})`);
      console.log(`[${testConfig.scenario}] ========================================`);

      // Update test price if needed
      if (txn.testPriceUpdate) {
        console.log(`[${testConfig.scenario}] Updating test price to $${txn.testPriceUpdate}...`);
        await updateTestPrice(page, txn.testPriceUpdate);
      }

      // Execute the appropriate action
      if (isDelete && txn.target) {
        // DELETE operation
        console.log(`[${testConfig.scenario}] Deleting ${txn.target.type}: ${txn.target.amount}...`);
        await deleteDividendSlpTransaction(page, txn.target as { type: "DIVIDEND" | "SLP"; amount: string });
      } else if (isEdit && txn.target && txn.dividendSlpInput) {
        // EDIT operation
        console.log(`[${testConfig.scenario}] Editing ${txn.target.type}: ${txn.target.amount} -> $${txn.dividendSlpInput.amount}...`);
        await editDividendSlpTransaction(page, txn.target as { type: "DIVIDEND" | "SLP"; amount: string }, txn.dividendSlpInput);
      } else if (isDividendOrSlp && txn.dividendSlpInput) {
        // CREATE DIVIDEND/SLP
        console.log(`[${testConfig.scenario}] Creating ${txn.dividendSlpInput.type}: $${txn.dividendSlpInput.amount}...`);
        await createDividendSlpTransaction(page, txn.dividendSlpInput);
      } else if (isSell && txn.sellInput) {
        // SELL transaction
        console.log(`[${testConfig.scenario}] Creating SELL: ${txn.sellInput.quantity} shares @ $${txn.sellInput.price}...`);
        await createSellTransaction(page, txn.sellInput.ptPercent, txn.sellInput.walletPrice, txn.sellInput);
      } else if (txn.input) {
        // BUY transaction
        console.log(`[${testConfig.scenario}] Creating BUY: $${txn.input.investment} @ $${txn.input.price}...`);
        await createBuyTransaction(page, txn.input);
      }

      // Wait for recalculation
      await page.waitForTimeout(1000);

      // Verify financial overview
      console.log(`[${testConfig.scenario}] Verifying financial overview...`);
      await verifyFinancialOverview(page, txn.expected.financialOverview);

      console.log(`[${testConfig.scenario}] Transaction "${txnKey}" verified successfully.`);
    }

    // Cleanup
    console.log(`\n[${testConfig.scenario}] Cleaning up...`);
    await navigateToAssetsPage(page);
    await cleanupTestAssetViaUI(page, testConfig.asset.input.symbol);

    console.log(`[${testConfig.scenario}] Test completed successfully!`);
  });
});
