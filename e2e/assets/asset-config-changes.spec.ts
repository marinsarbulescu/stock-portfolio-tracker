// e2e/assets/asset-config-changes.spec.ts
//
// This Playwright test verifies transactions remain correct when asset configuration
// (Entry Target, Profit Target allocations, Commission) is modified between transactions.
//
// Test flow:
// 1. Setup asset with initial config (ET: -2%, PT allocs: 50/30/20, Commission: 1%)
// 2. Create BUY A - verify wallets/overview
// 3. Edit Entry Target to -4%
// 4. Create BUY B - verify new ET is used
// 5. Edit PT allocations to 40/40/20
// 6. Create BUY C - verify new allocations
// 7. Edit Commission to 0.5%
// 8. Verify wallet PT prices recalculated
// 9. Create SELL A - verify new commission applied
// 10. Edit BUY A - verify wallet recalculation
// 11. Delete BUY B - verify cleanup

import { test, expect } from "@playwright/test";
import { loginUser, clearBrowserState } from "../utils/auth";
import {
  loadAssetConfigChangesTestData,
  BuyTransactionAction,
  SellTransactionAction,
  VerificationOnlyAction,
} from "../utils/jsonHelper";
import {
  setupTestAsset,
  navigateToAssetsPage,
  cleanupTestAssetViaUI,
  navigateToTransactionsPage,
  createBuyTransaction,
  editBuyTransaction,
  deleteBuyTransaction,
  createSellTransaction,
  verifyBuyTransaction,
  verifySellTransaction,
  verifyTransactionNotPresent,
  verifyWallet,
  verifyWalletNotPresent,
  verifyOverview,
  updateTestPrice,
  editCommission,
  editEntryTargetPercent,
  editProfitTargetAllocation,
} from "../utils/assetHelper";

// Set test timeout to 300 seconds (longer for full config changes flow)
test.setTimeout(300000);

// Load test configuration from JSON
const testConfig = loadAssetConfigChangesTestData("e2e/assets/asset-config-changes.json");

// Helper type guards
function isSellAction(action: BuyTransactionAction | SellTransactionAction | VerificationOnlyAction): action is SellTransactionAction {
  return "isSell" in action && action.isSell === true;
}

function isVerificationOnly(action: BuyTransactionAction | SellTransactionAction | VerificationOnlyAction): action is VerificationOnlyAction {
  return "isVerificationOnly" in action && action.isVerificationOnly === true;
}

// Test Suite
test.describe("Assets - Config Changes with Transactions (JSON-driven)", () => {
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

  test(`${testConfig.scenario} - Config changes between transactions`, async ({ page }) => {
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

    // Process transactions in a specific order with config changes between them
    const transactionKeys = Object.keys(testConfig.transactions);
    let etEdited = false;
    let ptAllocEdited = false;
    let commissionEdited = false;

    for (let i = 0; i < transactionKeys.length; i++) {
      const txnKey = transactionKeys[i];
      const txn = testConfig.transactions[txnKey];
      const stepNum = i + 1;

      console.log(`[${testConfig.scenario}] === Step ${stepNum}/${transactionKeys.length}: ${txnKey} ===`);

      // Check if we need to perform config changes before this transaction
      // Edit ET after buyA
      if (txnKey === "buyB" && !etEdited && testConfig.configChanges.editET) {
        console.log(`[${testConfig.scenario}] Editing Entry Target before ${txnKey}...`);
        await editEntryTargetPercent(
          page,
          testConfig.configChanges.editET.targetSortOrder,
          testConfig.configChanges.editET.newTargetPercent
        );
        etEdited = true;
      }

      // Edit PT allocations after buyB
      if (txnKey === "buyC" && !ptAllocEdited && testConfig.configChanges.editPTAlloc) {
        console.log(`[${testConfig.scenario}] Editing PT allocations before ${txnKey}...`);
        for (const [key, change] of Object.entries(testConfig.configChanges.editPTAlloc)) {
          await editProfitTargetAllocation(page, change.sortOrder, change.newAllocationPercent);
        }
        ptAllocEdited = true;
      }

      // Edit commission after buyC (before verification-only step)
      if (txnKey === "afterCommissionEdit" && !commissionEdited && testConfig.configChanges.editCommission) {
        console.log(`[${testConfig.scenario}] Editing commission before ${txnKey}...`);
        await editCommission(page, testConfig.configChanges.editCommission.newCommission);
        commissionEdited = true;
      }

      // Handle verification-only actions (just verify wallets, no transaction)
      if (isVerificationOnly(txn)) {
        console.log(`[${testConfig.scenario}] Verification-only step: verifying ${txn.expected.wallets.length} wallets...`);
        for (const wallet of txn.expected.wallets) {
          await verifyWallet(page, wallet);
        }
        console.log(`[${testConfig.scenario}] Verification-only step completed.`);
        continue;
      }

      // Update test price if needed
      if (txn.testPriceUpdate) {
        console.log(`[${testConfig.scenario}] Updating test price to $${txn.testPriceUpdate}...`);
        await updateTestPrice(page, txn.testPriceUpdate);
      }

      // Determine operation type
      const isSell = isSellAction(txn);
      const isDelete = !!txn.delete;
      const isEdit = !!txn.target && !isDelete;
      const txnType = isSell ? "SELL" : "BUY";
      const opType = isDelete ? "DELETE" : isEdit ? "EDIT" : "CREATE";

      console.log(`[${testConfig.scenario}] ${txnType} ${opType}`);

      // Execute the operation
      if (isSell) {
        const sellTxn = txn as SellTransactionAction;
        if (isDelete) {
          // SELL delete not implemented in this test
        } else if (isEdit) {
          // SELL edit not implemented in this test
        } else {
          console.log(`[${testConfig.scenario}] Creating SELL from PT${sellTxn.input!.ptPercent}% wallet @ ${sellTxn.input!.walletPrice}...`);
          await createSellTransaction(page, sellTxn.input!.ptPercent, sellTxn.input!.walletPrice, sellTxn.input!);
        }
      } else {
        const buyTxn = txn as BuyTransactionAction;
        if (isDelete) {
          console.log(`[${testConfig.scenario}] Deleting BUY: ${buyTxn.target!.signal} @ ${buyTxn.target!.price}...`);
          await deleteBuyTransaction(page, buyTxn.target!);
        } else if (isEdit) {
          console.log(`[${testConfig.scenario}] Editing BUY: ${buyTxn.target!.signal} @ ${buyTxn.target!.price}...`);
          await editBuyTransaction(page, buyTxn.target!, buyTxn.input!);
        } else {
          console.log(`[${testConfig.scenario}] Creating BUY: ${buyTxn.input!.signal} @ $${buyTxn.input!.price}...`);
          await createBuyTransaction(page, buyTxn.input!);
        }
      }

      // Wait for transaction to appear/update/disappear in the table
      await page.waitForTimeout(1000);

      // Verify the transaction in table (or not present for delete)
      if (isDelete) {
        const buyTxn = txn as BuyTransactionAction;
        console.log(`[${testConfig.scenario}] Verifying transaction deleted...`);
        await verifyTransactionNotPresent(page, buyTxn.expected.transactionNotPresent!);
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

      console.log(`[${testConfig.scenario}] Step ${txnKey} verified successfully.`);
    }

    // Cleanup
    console.log(`[${testConfig.scenario}] Cleaning up...`);
    await navigateToAssetsPage(page);
    await cleanupTestAssetViaUI(page, testConfig.asset.input.symbol);

    console.log(`[${testConfig.scenario}] Test completed successfully!`);
  });
});
