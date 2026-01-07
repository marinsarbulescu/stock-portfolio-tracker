// e2e/transactions/transaction-buy-crud.spec.ts
//
// This Playwright test verifies BUY transaction CRUD operations.
// All test input/output values are loaded from transaction-buy-crud.json
//
// The test iterates through all transactions in the JSON file.
// If a transaction has a `target` field, it's an edit operation.
// Otherwise, it's a create operation.

import { test, expect } from "@playwright/test";
import { loginUser, clearBrowserState } from "../utils/auth";
import { loadAssetBuyCrudTestData } from "../utils/jsonHelper";
import {
  setupTestAsset,
  navigateToAssetsPage,
  cleanupTestAssetViaUI,
  navigateToTransactionsPage,
  createBuyTransaction,
  editBuyTransaction,
  deleteBuyTransaction,
  verifyTransaction,
  verifyTransactionNotPresent,
  verifyWallet,
  verifyWalletNotPresent,
  verifyOverview,
  updateTestPrice,
} from "../utils/assetHelper";

// Set test timeout to 240 seconds (longer for full BUY CRUD flow with edit)
test.setTimeout(240000);

// Load test configuration from JSON
const testConfig = loadAssetBuyCrudTestData("e2e/transactions/transaction-buy-crud.json");

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

  test(`${testConfig.scenario} - BUY transaction CRUD`, async ({ page }) => {
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

    // Process each transaction in order
    const transactionEntries = Object.entries(testConfig.transactions);

    for (let i = 0; i < transactionEntries.length; i++) {
      const [txnKey, txn] = transactionEntries[i];
      const isDelete = !!txn.delete;
      const isEdit = !!txn.target && !isDelete;
      const stepNum = i + 1;
      const opType = isDelete ? 'DELETE' : isEdit ? 'EDIT' : 'CREATE';

      console.log(`[${testConfig.scenario}] === Transaction ${stepNum}/${transactionEntries.length}: ${txnKey} (${opType}) ===`);

      // Update test price if needed
      if (txn.testPriceUpdate) {
        console.log(`[${testConfig.scenario}] Updating test price to $${txn.testPriceUpdate}...`);
        await updateTestPrice(page, txn.testPriceUpdate);
      }

      // Create, Edit, or Delete transaction
      if (isDelete) {
        console.log(`[${testConfig.scenario}] Deleting transaction: ${txn.target!.signal} @ ${txn.target!.price}...`);
        await deleteBuyTransaction(page, txn.target!);
      } else if (isEdit) {
        console.log(`[${testConfig.scenario}] Editing transaction: ${txn.target!.signal} @ ${txn.target!.price}...`);
        await editBuyTransaction(page, txn.target!, txn.input!);
      } else {
        console.log(`[${testConfig.scenario}] Creating transaction: ${txn.input!.signal} @ $${txn.input!.price}...`);
        await createBuyTransaction(page, txn.input!);
      }

      // Wait for transaction to appear/update/disappear in the table
      await page.waitForTimeout(1000);

      // Verify the transaction in table (or not present for delete)
      if (isDelete) {
        console.log(`[${testConfig.scenario}] Verifying transaction deleted...`);
        await verifyTransactionNotPresent(page, txn.expected.transactionNotPresent!);
      } else {
        console.log(`[${testConfig.scenario}] Verifying transaction in table...`);
        await verifyTransaction(page, txn.expected.transaction!);
      }

      // Verify prior transactions if defined
      if (txn.expected.priorTransactions?.length) {
        console.log(`[${testConfig.scenario}] Verifying ${txn.expected.priorTransactions.length} prior transactions...`);
        for (const priorTxn of txn.expected.priorTransactions) {
          await verifyTransaction(page, priorTxn);
        }
      }

      // Verify wallets
      console.log(`[${testConfig.scenario}] Verifying ${txn.expected.wallets.length} wallets...`);
      for (const wallet of txn.expected.wallets) {
        await verifyWallet(page, wallet);
      }

      // Verify wallets NOT present (for edit operations that remove wallets)
      if (txn.expected.walletsNotPresent?.length) {
        console.log(`[${testConfig.scenario}] Verifying ${txn.expected.walletsNotPresent.length} wallets NOT present...`);
        for (const walletNotPresent of txn.expected.walletsNotPresent) {
          await verifyWalletNotPresent(page, walletNotPresent.ptPercent, walletNotPresent.price);
        }
      }

      // Verify overview
      console.log(`[${testConfig.scenario}] Verifying overview...`);
      await verifyOverview(page, txn.expected.overview);

      console.log(`[${testConfig.scenario}] Transaction ${txnKey} verified successfully.`);
    }

    // Cleanup
    console.log(`[${testConfig.scenario}] Cleaning up...`);
    await navigateToAssetsPage(page);
    await cleanupTestAssetViaUI(page, testConfig.asset.input.symbol);

    console.log(`[${testConfig.scenario}] Test completed successfully!`);
  });
});
