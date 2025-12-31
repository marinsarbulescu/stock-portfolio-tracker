// e2e/assets/asset-sell-crud.spec.ts
//
// This Playwright test verifies SELL transaction CRUD operations.
// All test input/output values are loaded from asset-sell-crud.json
//
// The test iterates through all transactions in the JSON file.
// Transactions can be BUY (setup) or SELL (create/edit/delete).

import { test, expect } from "@playwright/test";
import { loginUser, clearBrowserState } from "../utils/auth";
import { loadAssetSellCrudTestData, SellTransactionAction, BuyTransactionAction } from "../utils/jsonHelper";
import {
  setupTestAsset,
  navigateToAssetsPage,
  cleanupTestAssetViaUI,
  navigateToTransactionsPage,
  createBuyTransaction,
  createSellTransaction,
  editSellTransaction,
  deleteSellTransaction,
  verifyBuyTransaction,
  verifySellTransaction,
  verifyTransactionNotPresent,
  verifySellTransactionNotPresent,
  verifyWallet,
  verifyWalletNotPresent,
  verifyOverview,
  updateTestPrice,
  toggleWalletIdColumn,
  getWalletIdFromTable,
  toggleTransactionWalletColumn,
  verifyBuyTransactionWalletAllocation,
} from "../utils/assetHelper";

// Set test timeout to 240 seconds (longer for full SELL CRUD flow)
test.setTimeout(240000);

// Load test configuration from JSON
const testConfig = loadAssetSellCrudTestData("e2e/assets/asset-sell-crud.json");

// Helper to check if action is a SELL action
function isSellAction(action: BuyTransactionAction | SellTransactionAction): action is SellTransactionAction {
  return "isSell" in action && action.isSell === true;
}

// Test Suite
test.describe("Assets - SELL Transaction CRUD (JSON-driven)", () => {
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

  test(`${testConfig.scenario} - SELL transaction CRUD`, async ({ page }) => {
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
      const isSell = isSellAction(txn);
      const isDelete = !!txn.delete;
      const isEdit = !!txn.target && !isDelete;
      const stepNum = i + 1;
      const txnType = isSell ? "SELL" : "BUY";
      const opType = isDelete ? "DELETE" : isEdit ? "EDIT" : "CREATE";

      console.log(`[${testConfig.scenario}] === Transaction ${stepNum}/${transactionEntries.length}: ${txnKey} (${txnType} ${opType}) ===`);

      // Update test price if needed
      if (txn.testPriceUpdate) {
        console.log(`[${testConfig.scenario}] Updating test price to $${txn.testPriceUpdate}...`);
        await updateTestPrice(page, txn.testPriceUpdate);
      }

      // Handle BUY transactions (for setup)
      if (!isSell) {
        const buyTxn = txn as BuyTransactionAction;
        if (isDelete) {
          console.log(`[${testConfig.scenario}] Deleting BUY transaction...`);
          // Not implemented for SELL CRUD test - BUY delete would use deleteBuyTransaction
        } else if (isEdit) {
          console.log(`[${testConfig.scenario}] Editing BUY transaction...`);
          // Not implemented for SELL CRUD test - BUY edit would use editBuyTransaction
        } else {
          console.log(`[${testConfig.scenario}] Creating BUY transaction: ${buyTxn.input!.signal} @ $${buyTxn.input!.price}...`);
          await createBuyTransaction(page, buyTxn.input!);
        }
      }
      // Handle SELL transactions
      else {
        const sellTxn = txn as SellTransactionAction;
        if (isDelete) {
          console.log(`[${testConfig.scenario}] Deleting SELL transaction: ${sellTxn.target!.signal} @ ${sellTxn.target!.price}...`);
          await deleteSellTransaction(page, sellTxn.target!);
        } else if (isEdit) {
          console.log(`[${testConfig.scenario}] Editing SELL transaction: ${sellTxn.target!.signal} @ ${sellTxn.target!.price}...`);
          await editSellTransaction(page, sellTxn.target!, sellTxn.input!);
        } else {
          console.log(`[${testConfig.scenario}] Creating SELL transaction from PT${sellTxn.input!.ptPercent}% wallet @ $${sellTxn.input!.walletPrice}...`);
          await createSellTransaction(page, sellTxn.input!.ptPercent, sellTxn.input!.walletPrice, sellTxn.input!);
        }
      }

      // Wait for transaction to appear/update/disappear in the table
      await page.waitForTimeout(1000);

      // Verify the transaction in table (or not present for delete)
      if (isDelete) {
        if (isSell) {
          const sellTxn = txn as SellTransactionAction;
          console.log(`[${testConfig.scenario}] Verifying SELL transaction deleted...`);
          await verifySellTransactionNotPresent(page, sellTxn.expected.transactionNotPresent!);
        } else {
          const buyTxn = txn as BuyTransactionAction;
          console.log(`[${testConfig.scenario}] Verifying BUY transaction deleted...`);
          await verifyTransactionNotPresent(page, buyTxn.expected.transactionNotPresent!);
        }
      } else {
        if (isSell) {
          const sellTxn = txn as SellTransactionAction;
          console.log(`[${testConfig.scenario}] Verifying SELL transaction in table...`);
          await verifySellTransaction(page, sellTxn.expected.transaction!);
        } else {
          const buyTxn = txn as BuyTransactionAction;
          console.log(`[${testConfig.scenario}] Verifying BUY transaction in table...`);
          await verifyBuyTransaction(page, buyTxn.expected.transaction!);
        }
      }

      // Verify prior transactions if defined
      if (txn.expected.priorTransactions?.length) {
        console.log(`[${testConfig.scenario}] Verifying ${txn.expected.priorTransactions.length} prior transactions...`);
        for (const priorTxn of txn.expected.priorTransactions) {
          // Check if it's a SELL or BUY transaction by presence of 'amount' vs 'investment'
          if ("amount" in priorTxn) {
            await verifySellTransaction(page, priorTxn);
          } else {
            await verifyBuyTransaction(page, priorTxn);
          }
        }
      }

      // Verify wallets
      console.log(`[${testConfig.scenario}] Verifying ${txn.expected.wallets.length} wallets...`);
      for (const wallet of txn.expected.wallets) {
        await verifyWallet(page, wallet);
      }

      // Verify wallets NOT present (for operations that remove wallets)
      if (txn.expected.walletsNotPresent?.length) {
        console.log(`[${testConfig.scenario}] Verifying ${txn.expected.walletsNotPresent.length} wallets NOT present...`);
        for (const walletNotPresent of txn.expected.walletsNotPresent) {
          await verifyWalletNotPresent(page, walletNotPresent.ptPercent, walletNotPresent.price);
        }
      }

      // Verify overview
      console.log(`[${testConfig.scenario}] Verifying overview...`);
      await verifyOverview(page, txn.expected.overview);

      // Verify wallet ID propagation if specified (only for SELL transactions)
      if (isSell) {
        const sellTxn = txn as SellTransactionAction;
        if (sellTxn.expected.walletIdVerification) {
          const verification = sellTxn.expected.walletIdVerification;
          console.log(`[${testConfig.scenario}] Verifying wallet ID propagation...`);

          // Step 1: Show wallet ID column in wallets table
          await toggleWalletIdColumn(page, true);

          // Step 2: Get the wallet ID from the specified wallet
          const walletId = await getWalletIdFromTable(
            page,
            verification.walletPtPercent,
            verification.walletPrice
          );

          // Step 3: Show wallet column in transactions table
          await toggleTransactionWalletColumn(page, true);

          // Step 4: Verify the BUY transaction's allocation points to this wallet
          await verifyBuyTransactionWalletAllocation(
            page,
            verification.buyTransaction,
            verification.allocationPtPercent,
            walletId
          );

          console.log(`[${testConfig.scenario}] Wallet ID propagation verified: PT${verification.allocationPtPercent}% -> ${walletId}`);

          // Step 5: Clean up - hide the extra columns to restore normal UI state
          await toggleTransactionWalletColumn(page, false);
          await toggleWalletIdColumn(page, false);
          console.log(`[${testConfig.scenario}] Wallet ID verification cleanup complete.`);
        }
      }

      console.log(`[${testConfig.scenario}] Transaction ${txnKey} verified successfully.`);
    }

    // Cleanup
    console.log(`[${testConfig.scenario}] Cleaning up...`);
    await navigateToAssetsPage(page);
    await cleanupTestAssetViaUI(page, testConfig.asset.input.symbol);

    console.log(`[${testConfig.scenario}] Test completed successfully!`);
  });
});
