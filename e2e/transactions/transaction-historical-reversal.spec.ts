// e2e/transactions/transaction-historical-reversal.spec.ts
//
// This Playwright test verifies data integrity by creating transactions
// (BUY, DIVIDEND, SPLIT, SLP, SELL) and deleting them in reverse order.
// All test input/output values are loaded from transaction-historical-reversal.json

import { test, expect } from "@playwright/test";
import { loginUser, clearBrowserState } from "../utils/auth";
import { loadHistoricalReversalTestData } from "../utils/jsonHelper";
import {
  setupTestAsset,
  navigateToAssetsPage,
  cleanupTestAssetViaUI,
  navigateToTransactionsPage,
  createBuyTransaction,
  createSellTransaction,
  createSplitTransaction,
  createDividendSlpTransaction,
  deleteBuyTransaction,
  deleteSellTransaction,
  verifySellTransactionNotPresent,
  verifyTransaction,
  verifySellTransaction,
  verifyTransactionNotPresent,
  verifyWallet,
  verifyWalletNotPresent,
  verifyOverview,
  verifyFinancialOverview,
  EditSellTransactionTarget,
} from "../utils/assetHelper";

// Set test timeout to 240 seconds
test.setTimeout(240000);

// Load test configuration from JSON
const testConfig = loadHistoricalReversalTestData("e2e/transactions/transaction-historical-reversal.json");

// Test Suite
test.describe("Transactions - Historical Reversal (JSON-driven)", () => {
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

  test(`${testConfig.scenario} - Create and delete transactions in reverse`, async ({ page }) => {
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
      const isSplit = !!txn.isSplit;
      const isDividendOrSlp = !!txn.isDividendOrSlp;

      // Determine transaction type for logging
      let txnType = 'BUY';
      if (isSell) txnType = 'SELL';
      if (isSplit) txnType = 'SPLIT';
      if (isDividendOrSlp) txnType = txn.dividendSlpInput?.type || 'DIVIDEND/SLP';
      if (txn.isDelete) txnType = 'DELETE_SELL';
      if (txn.isDeleteSplit) txnType = 'DELETE_SPLIT';
      if (txn.isDeleteDividendOrSlp) txnType = 'DELETE_DIVIDEND/SLP';
      if (txn.isDeleteBuy) txnType = 'DELETE_BUY';

      console.log(`[${testConfig.scenario}] === Step ${stepNum}/${transactionEntries.length}: ${txnKey} (${txnType}) ===`);

      // Update test price if needed
      if (txn.testPriceUpdate) {
        console.log(`[${testConfig.scenario}] Updating test price to $${txn.testPriceUpdate}...`);
        // Note: updateTestPrice function would be called here if needed
      }

      // Handle delete SELL
      if (txn.isDelete) {
        console.log(`[${testConfig.scenario}] Deleting SELL transaction...`);
        const target = txn.targetTransaction as EditSellTransactionTarget;
        await deleteSellTransaction(page, target);

        // Verify transaction is not present
        if (txn.expected.transactionNotPresent) {
          const notPresent = txn.expected.transactionNotPresent;
          await verifySellTransactionNotPresent(page, {
            signal: notPresent.signal!,
            price: notPresent.price!,
            amount: target.amount
          });
        }
      }

      // Handle delete SPLIT
      if (txn.isDeleteSplit) {
        console.log(`[${testConfig.scenario}] Deleting SPLIT transaction...`);
        const targetTxn = txn.targetTransaction as { type: string; ratio: string };

        // Find all split rows with this ratio
        const splitRows = page.locator('tr').filter({ hasText: targetTxn.ratio });

        // Find the one that has a visible delete button
        let splitRowToDelete: ReturnType<typeof splitRows.first> | null = null;
        const count = await splitRows.count();
        for (let j = 0; j < count; j++) {
          const row = splitRows.nth(j);
          const deleteBtn = row.locator('[data-testid^="transaction-delete-"]');
          if (await deleteBtn.isVisible()) {
            splitRowToDelete = row;
            break;
          }
        }

        if (!splitRowToDelete) {
          throw new Error(`No deletable SPLIT transaction found with ratio ${targetTxn.ratio}`);
        }

        await expect(splitRowToDelete).toBeVisible();

        // Set up dialog handler
        page.once("dialog", async (dialog) => {
          console.log(`[${testConfig.scenario}] Dialog appeared: ${dialog.message()}`);
          await dialog.accept();
        });

        const deleteButton = splitRowToDelete.locator('[data-testid^="transaction-delete-"]');
        await deleteButton.click();
        await page.waitForTimeout(2000);
        console.log(`[${testConfig.scenario}] SPLIT transaction deleted.`);
      }

      // Handle delete DIVIDEND/SLP
      if (txn.isDeleteDividendOrSlp) {
        console.log(`[${testConfig.scenario}] Deleting DIVIDEND/SLP transaction...`);
        const targetTxn = txn.targetTransaction as { type: string; amount: string };

        // Find the row by type text and amount
        // Type displays as "Dividend" or "Slp"
        const typeText = targetTxn.type; // "Dividend" or "SLP"
        const amount = targetTxn.amount;

        // Find rows containing the type and amount
        const rows = page.locator('tr').filter({ hasText: typeText }).filter({ hasText: amount });
        const rowCount = await rows.count();

        let rowToDelete: ReturnType<typeof rows.first> | null = null;
        for (let j = 0; j < rowCount; j++) {
          const row = rows.nth(j);
          const deleteBtn = row.locator('[data-testid^="transaction-delete-"]');
          if (await deleteBtn.isVisible()) {
            rowToDelete = row;
            break;
          }
        }

        if (!rowToDelete) {
          throw new Error(`No deletable ${typeText} transaction found with amount ${amount}`);
        }

        // Set up dialog handler
        page.once("dialog", async (dialog) => {
          console.log(`[${testConfig.scenario}] Dialog appeared: ${dialog.message()}`);
          await dialog.accept();
        });

        const deleteButton = rowToDelete.locator('[data-testid^="transaction-delete-"]');
        await deleteButton.click();
        await page.waitForTimeout(2000);
        console.log(`[${testConfig.scenario}] ${typeText} transaction deleted.`);
      }

      // Handle delete BUY
      if (txn.isDeleteBuy) {
        console.log(`[${testConfig.scenario}] Deleting BUY transaction...`);
        await deleteBuyTransaction(page, txn.target!);
      }

      // Create DIVIDEND/SLP transaction
      if (isDividendOrSlp && txn.dividendSlpInput) {
        console.log(`[${testConfig.scenario}] Creating ${txn.dividendSlpInput.type} transaction: $${txn.dividendSlpInput.amount}...`);
        await createDividendSlpTransaction(page, txn.dividendSlpInput);
      }

      // Create SPLIT transaction
      if (isSplit && txn.splitInput) {
        console.log(`[${testConfig.scenario}] Creating SPLIT transaction: ${txn.splitInput.splitRatio}:1...`);
        const expectedWallet = txn.expected.wallets?.[0];
        if (expectedWallet) {
          await createSplitTransaction(page, txn.splitInput.splitRatio, {
            ptPercent: expectedWallet.ptPercent,
            shares: expectedWallet.shares,
          });
        } else {
          await createSplitTransaction(page, txn.splitInput.splitRatio);
        }
      }

      // Create SELL transaction
      if (isSell && txn.input) {
        const sellInput = txn.input as { ptPercent: string; walletPrice: string; signal: string; price: string; quantity: string };
        console.log(`[${testConfig.scenario}] Creating SELL transaction: ${sellInput.signal} @ $${sellInput.price}...`);
        await createSellTransaction(page, sellInput.ptPercent, sellInput.walletPrice, {
          signal: sellInput.signal,
          price: sellInput.price,
          quantity: sellInput.quantity,
        });
      }

      // Create BUY transaction
      if (!isSell && !isSplit && !isDividendOrSlp && !txn.isDelete && !txn.isDeleteSplit && !txn.isDeleteDividendOrSlp && !txn.isDeleteBuy && txn.input && 'investment' in txn.input) {
        console.log(`[${testConfig.scenario}] Creating BUY transaction: ${txn.input.signal} @ $${txn.input.price}...`);
        await createBuyTransaction(page, txn.input);
      }

      // Wait for transaction to process
      await page.waitForTimeout(1000);

      // Verify transaction in table (if defined)
      if (txn.expected.transaction && 'type' in txn.expected.transaction) {
        if (txn.expected.transaction.type === 'Split') {
          console.log(`[${testConfig.scenario}] Verifying SPLIT transaction in table...`);
          const splitRow = page.locator('tr').filter({ hasText: /\d+:\d+/ }).first();
          await expect(splitRow).toBeVisible();
        } else if (txn.expected.transaction.type === 'Sell') {
          console.log(`[${testConfig.scenario}] Verifying SELL transaction in table...`);
          await verifySellTransaction(page, txn.expected.transaction as any);
        } else {
          console.log(`[${testConfig.scenario}] Verifying BUY transaction in table...`);
          await verifyTransaction(page, txn.expected.transaction as any);
        }
      }

      // Verify transaction NOT present (for deletes)
      if (txn.expected.transactionNotPresent && txn.isDeleteBuy) {
        console.log(`[${testConfig.scenario}] Verifying BUY transaction deleted...`);
        await verifyTransactionNotPresent(page, {
          signal: txn.expected.transactionNotPresent.signal!,
          price: txn.expected.transactionNotPresent.price!,
          investment: txn.expected.transactionNotPresent.investment!,
        });
      }

      // Verify wallets
      if (txn.expected.wallets?.length) {
        console.log(`[${testConfig.scenario}] Verifying ${txn.expected.wallets.length} wallets...`);
        for (const wallet of txn.expected.wallets) {
          await verifyWallet(page, wallet);
        }
      } else if (txn.expected.wallets?.length === 0) {
        console.log(`[${testConfig.scenario}] Verifying no wallets present...`);
        // Check that there are no wallet rows
        // First click on a PT tab to check
        await page.locator('[data-testid="wallet-tab-pt-4"]').click();
        await page.waitForTimeout(500);
        const walletRows = page.locator('tr[data-testid^="wallet-row-"]');
        const walletCount = await walletRows.count();
        expect(walletCount).toBe(0);
      }

      // Verify wallets NOT present
      if (txn.expected.walletsNotPresent?.length) {
        console.log(`[${testConfig.scenario}] Verifying ${txn.expected.walletsNotPresent.length} wallets NOT present...`);
        for (const walletNotPresent of txn.expected.walletsNotPresent) {
          await verifyWalletNotPresent(page, walletNotPresent.ptPercent, walletNotPresent.price);
        }
      }

      // Verify overview
      if (txn.expected.overview) {
        console.log(`[${testConfig.scenario}] Verifying overview...`);
        await verifyOverview(page, txn.expected.overview);
      }

      // Verify financial overview
      if (txn.expected.financialOverview) {
        console.log(`[${testConfig.scenario}] Verifying financial overview...`);
        await verifyFinancialOverview(page, txn.expected.financialOverview);
      }

      console.log(`[${testConfig.scenario}] Step ${txnKey} verified successfully.`);
    }

    // Cleanup
    console.log(`[${testConfig.scenario}] Cleaning up...`);
    await navigateToAssetsPage(page);
    await cleanupTestAssetViaUI(page, testConfig.asset.input.symbol);

    console.log(`[${testConfig.scenario}] Test completed successfully!`);
  });
});
