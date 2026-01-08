// e2e/transactions/transaction-split.spec.ts
//
// This Playwright test verifies BUY, SELL, and SPLIT transaction operations
// with wallet, overview, and financial overview verification.
// All test input/output values are loaded from transaction-split.json

import { test, expect } from "@playwright/test";
import { loginUser, clearBrowserState } from "../utils/auth";
import { loadTransactionSplitTestData } from "../utils/jsonHelper";
import {
  setupTestAsset,
  navigateToAssetsPage,
  cleanupTestAssetViaUI,
  navigateToTransactionsPage,
  createBuyTransaction,
  createSellTransaction,
  createSplitTransaction,
  verifyTransaction,
  verifySellTransaction,
  verifyWallet,
  verifyWalletNotPresent,
  verifyOverview,
  verifyFinancialOverview,
  updateTestPrice,
} from "../utils/assetHelper";

// Set test timeout to 240 seconds
test.setTimeout(240000);

// Load test configuration from JSON
const testConfig = loadTransactionSplitTestData("e2e/transactions/transaction-split.json");

// Test Suite
test.describe("Transactions - Split (JSON-driven)", () => {
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

  test(`${testConfig.scenario} - BUY, SELL, SPLIT transactions`, async ({ page }) => {
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

      // Determine transaction type for logging
      let txnType = 'BUY';
      if (isSell) txnType = 'SELL';
      if (isSplit) txnType = 'SPLIT';

      console.log(`[${testConfig.scenario}] === Transaction ${stepNum}/${transactionEntries.length}: ${txnKey} (${txnType}) ===`);

      // Update test price if needed
      if (txn.testPriceUpdate) {
        console.log(`[${testConfig.scenario}] Updating test price to $${txn.testPriceUpdate}...`);
        await updateTestPrice(page, txn.testPriceUpdate);
      }

      // Create transaction (BUY, SELL, or SPLIT)
      if (isSplit && txn.splitInput) {
        console.log(`[${testConfig.scenario}] Creating SPLIT transaction: ${txn.splitInput.splitRatio}:1...`);
        // Provide expected wallet for robust polling
        const expectedWallet = txn.expected.wallets[0];
        await createSplitTransaction(page, txn.splitInput.splitRatio, {
          ptPercent: expectedWallet.ptPercent,
          shares: expectedWallet.shares,
        });
      } else if (isSell && txn.input) {
        const sellInput = txn.input as { ptPercent: string; walletPrice: string; signal: string; price: string; quantity: string };
        console.log(`[${testConfig.scenario}] Creating SELL transaction: ${sellInput.signal} @ $${sellInput.price}...`);
        await createSellTransaction(page, sellInput.ptPercent, sellInput.walletPrice, {
          signal: sellInput.signal,
          price: sellInput.price,
          quantity: sellInput.quantity,
        });
      } else if (txn.input && 'investment' in txn.input) {
        console.log(`[${testConfig.scenario}] Creating BUY transaction: ${txn.input.signal} @ $${txn.input.price}...`);
        await createBuyTransaction(page, txn.input);
      }

      // Wait for transaction to appear in the table
      await page.waitForTimeout(1000);

      // Verify the transaction in table (if defined)
      if (txn.expected.transaction && 'type' in txn.expected.transaction) {
        if (txn.expected.transaction.type === 'Split') {
          // For SPLIT, just verify the split row exists with ratio
          console.log(`[${testConfig.scenario}] Verifying SPLIT transaction in table...`);
          const splitRow = page.locator('tr').filter({ hasText: /\d+:\d+/ });
          await expect(splitRow).toBeVisible();
        } else if (txn.expected.transaction.type === 'Sell') {
          // For SELL, use verifySellTransaction
          console.log(`[${testConfig.scenario}] Verifying SELL transaction in table...`);
          await verifySellTransaction(page, txn.expected.transaction as any);
        } else {
          console.log(`[${testConfig.scenario}] Verifying BUY transaction in table...`);
          await verifyTransaction(page, txn.expected.transaction as any);
        }
      }

      // Verify prior transactions if defined
      if (txn.expected.priorTransactions?.length) {
        console.log(`[${testConfig.scenario}] Verifying ${txn.expected.priorTransactions.length} prior transactions...`);
        for (const priorTxn of txn.expected.priorTransactions) {
          if (priorTxn.type === 'Sell') {
            await verifySellTransaction(page, priorTxn as any);
          } else {
            await verifyTransaction(page, priorTxn as any);
          }
        }
      }

      // Verify wallets
      console.log(`[${testConfig.scenario}] Verifying ${txn.expected.wallets.length} wallets...`);
      for (const wallet of txn.expected.wallets) {
        await verifyWallet(page, wallet);
      }

      // Verify wallets NOT present
      if (txn.expected.walletsNotPresent?.length) {
        console.log(`[${testConfig.scenario}] Verifying ${txn.expected.walletsNotPresent.length} wallets NOT present...`);
        for (const walletNotPresent of txn.expected.walletsNotPresent) {
          await verifyWalletNotPresent(page, walletNotPresent.ptPercent, walletNotPresent.price);
        }
      }

      // Verify overview
      console.log(`[${testConfig.scenario}] Verifying overview...`);
      await verifyOverview(page, txn.expected.overview);

      // Verify financial overview
      console.log(`[${testConfig.scenario}] Verifying financial overview...`);
      await verifyFinancialOverview(page, txn.expected.financialOverview);

      console.log(`[${testConfig.scenario}] Transaction ${txnKey} verified successfully.`);
    }

    // Cleanup
    console.log(`[${testConfig.scenario}] Cleaning up...`);
    await navigateToAssetsPage(page);
    await cleanupTestAssetViaUI(page, testConfig.asset.input.symbol);

    console.log(`[${testConfig.scenario}] Test completed successfully!`);
  });
});
