// e2e/assets/asset-roi.spec.ts
//
// This Playwright test verifies ROI calculations including OOP, Market Value, ROI, and Available.
// All test input/output values are loaded from asset-roi.json
//
// Note: This test focuses only on financial metrics. Transaction table, wallets, and overview
// verifications are covered by other tests (asset-buy-crud, asset-sell-crud).

import { test, expect } from "@playwright/test";
import { loginUser, clearBrowserState } from "../utils/auth";
import { loadRoiTestData } from "../utils/jsonHelper";
import {
  setupTestAsset,
  navigateToAssetsPage,
  cleanupTestAssetViaUI,
  navigateToTransactionsPage,
  navigateToDashboard,
  createBuyTransaction,
  createSellTransaction,
  createDividendSlpTransaction,
  updateTestPrice,
  verifyFinancialOverview,
  verifyDashboardAvailable,
  verifyDashboardRowGrayedOut,
} from "../utils/assetHelper";

// Set test timeout to 180 seconds
test.setTimeout(180000);

// Load test configuration from JSON
const testConfig = loadRoiTestData("e2e/assets/asset-roi.json");

// Test Suite
test.describe("ROI Calculation Tests (JSON-driven)", () => {
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

  test(`${testConfig.scenario} - ROI calculation verification`, async ({ page }) => {
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

      // Determine transaction type for logging
      let txnType = 'BUY';
      if (isSell) txnType = 'SELL';
      if (isDividendOrSlp && txn.dividendSlpInput) txnType = txn.dividendSlpInput.type;

      console.log(`[${testConfig.scenario}] === Transaction ${stepNum}/${transactionEntries.length}: ${txnKey} (${txnType}) ===`);

      // Update test price if needed
      if (txn.testPriceUpdate) {
        console.log(`[${testConfig.scenario}] Updating test price to $${txn.testPriceUpdate}...`);
        await updateTestPrice(page, txn.testPriceUpdate);
      }

      // Create transaction (BUY, SELL, DIVIDEND, or SLP)
      if (isDividendOrSlp && txn.dividendSlpInput) {
        console.log(`[${testConfig.scenario}] Creating ${txn.dividendSlpInput.type} transaction: $${txn.dividendSlpInput.amount}...`);
        await createDividendSlpTransaction(page, txn.dividendSlpInput);
      } else if (isSell && txn.sellInput) {
        console.log(`[${testConfig.scenario}] Creating SELL transaction: ${txn.sellInput.signal} @ $${txn.sellInput.price}...`);
        await createSellTransaction(page, txn.sellInput.ptPercent, txn.sellInput.walletPrice, txn.sellInput);
      } else if (txn.input) {
        console.log(`[${testConfig.scenario}] Creating BUY transaction: ${txn.input.signal} @ $${txn.input.price}...`);
        await createBuyTransaction(page, txn.input);
      }

      // Wait for transaction to appear in the table
      await page.waitForTimeout(1000);

      // Verify financial overview (OOP, Market Value, ROI, Available)
      console.log(`[${testConfig.scenario}] Verifying financial overview (OOP, Market Value, ROI, Available)...`);
      await verifyFinancialOverview(page, txn.expected.financialOverview);

      // Navigate to Dashboard and verify Available
      console.log(`[${testConfig.scenario}] Navigating to Dashboard...`);
      await navigateToDashboard(page);

      console.log(`[${testConfig.scenario}] Verifying Dashboard Available...`);
      await verifyDashboardAvailable(page, txn.expected.dashboard.symbol, txn.expected.dashboard.available);

      // Verify gray row styling if expected
      if (txn.expected.dashboard.isGrayedOut !== undefined) {
        console.log(`[${testConfig.scenario}] Verifying Dashboard row gray state...`);
        await verifyDashboardRowGrayedOut(page, txn.expected.dashboard.symbol, txn.expected.dashboard.isGrayedOut);
      }

      console.log(`[${testConfig.scenario}] Transaction ${txnKey} verified successfully.`);

      // Navigate back to transactions page for next transaction (if any)
      if (i < transactionEntries.length - 1) {
        await navigateToAssetsPage(page);
        const editLink = page.locator(`[data-testid="asset-table-edit-${testConfig.asset.input.symbol}"]`);
        await editLink.click();
        await navigateToTransactionsPage(page);
      }
    }

    // Cleanup
    console.log(`[${testConfig.scenario}] Cleaning up...`);
    await navigateToAssetsPage(page);
    await cleanupTestAssetViaUI(page, testConfig.asset.input.symbol);

    console.log(`[${testConfig.scenario}] Test completed successfully!`);
  });
});
