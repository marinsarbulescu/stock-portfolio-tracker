// e2e/assets/asset-pt-crud.spec.ts
//
// This Playwright test verifies PT-specific CRUD features:
// 1. PT delete button visibility based on wallet existence
// 2. Proportional allocation redistribution when PT is deleted
// 3. Allocation error validation in transaction modal
// 4. PT allocation editing with validation (> 100%, < 100%, = 100%)
// 5. PT sortOrder editing with duplicate detection
// 6. PT targetPercent editing with wallet recalculation
//
// Test flow:
// 1. Login and create test asset with ET + 3 PTs
// 2. Navigate to Transactions, create BUY with allocations to all PTs
// 3. Verify all PTs have delete buttons hidden (have wallets)
// 4. SELL all shares from PT3
// 5. Verify PT3 delete button now visible
// 6. Delete PT3 and verify allocation redistribution
// 7. Test allocation error validation in transaction modal
// 8. Test PT allocation editing on Asset Edit page
// 9. Test PT sortOrder editing with duplicate detection
// 10. Test PT targetPercent editing with wallet recalculation

import { test, expect } from "@playwright/test";
import { loginUser, clearBrowserState } from "../utils/auth";
import { loadAssetPTCrudTestData } from "../utils/jsonHelper";
import {
  waitForAssetsTableToLoad,
  navigateToAssetsPage,
  cleanupTestAssetViaUI,
  setupTestAsset,
  navigateToTransactionsPage,
  navigateBackToEditPage,
  verifyWalletTabs,
  createBuyTransaction,
  verifyBuyTransaction,
  verifyWallet,
  verifyWalletNotPresent,
  verifyOverview,
  createSellTransaction,
  verifySellTransaction,
  verifyPTDeleteButtonHidden,
  verifyPTDeleteButtonVisible,
  verifyPTRow,
  verifyPTRowNotPresent,
  deleteTarget,
  openNewTransactionModal,
  cancelTransactionModal,
  fillPriceAndInvestment,
  fillTransactionAllocations,
  verifyAllocationError,
  verifyAllocationInputVisible,
  verifyAllocationInputNotVisible,
  getAllocationInputValue,
  editPTAllocationAndSave,
  verifyPageError,
  dismissPageError,
  verifyPTAllocationWarning,
  verifyNoPTAllocationWarning,
  editPTSortOrderAndSave,
  editPTValueAndSave,
} from "../utils/assetHelper";

// Set test timeout to 180 seconds
test.setTimeout(180000);

// Load test configuration from JSON
const testConfig = loadAssetPTCrudTestData("e2e/assets/asset-pt-crud.json");

test.describe("Assets - PT CRUD (Delete Protection & Allocation Redistribution)", () => {
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
      await waitForAssetsTableToLoad(page);
      await cleanupTestAssetViaUI(page, testConfig.asset.input.symbol);
    } catch (error) {
      console.warn("[AFTER EACH] Cleanup failed:", error);
    }
  });

  test(`${testConfig.scenario} - PT Delete Protection and Allocation Redistribution`, async ({ page }) => {
    console.log(`[${testConfig.scenario}] Starting test...`);
    console.log(`[${testConfig.scenario}] ${testConfig.description}`);

    // ========================================================================
    // Step 1: Setup - Create asset with ET and PTs
    // ========================================================================
    console.log(`[${testConfig.scenario}] Step 1: Setting up test asset...`);
    await setupTestAsset(page, {
      asset: testConfig.asset.input,
      entryTargets: testConfig.entryTargets.map((et) => et.input),
      profitTargets: testConfig.profitTargets.map((pt) => pt.input),
    });

    // ========================================================================
    // Step 2: Navigate to Transactions and verify PT tabs
    // ========================================================================
    console.log(`[${testConfig.scenario}] Step 2: Navigate to Transactions...`);
    await navigateToTransactionsPage(page);

    const expectedPTPercents = testConfig.profitTargets.map((pt) => pt.input.targetPercent);
    await verifyWalletTabs(page, expectedPTPercents);

    // ========================================================================
    // Step 3: Create BUY transaction with allocations to all PTs
    // ========================================================================
    console.log(`[${testConfig.scenario}] Step 3: Create BUY transaction...`);
    const buyStep = testConfig.steps.createPT.buyTransaction;
    await createBuyTransaction(page, buyStep.input);

    // Verify the transaction
    await verifyBuyTransaction(page, buyStep.expected.transaction);

    // Verify wallets
    for (const wallet of buyStep.expected.wallets) {
      await verifyWallet(page, wallet);
    }

    // Verify overview
    await verifyOverview(page, buyStep.expected.overview);

    // ========================================================================
    // Step 4: Navigate to Asset Edit and verify delete buttons are hidden
    // ========================================================================
    console.log(`[${testConfig.scenario}] Step 4: Verify delete buttons hidden (have wallets)...`);
    await navigateBackToEditPage(page);

    const deleteButtonsConfig = testConfig.steps.createPT.verifyDeleteButtons;
    if (deleteButtonsConfig.hidden) {
      for (const sortOrder of deleteButtonsConfig.hidden) {
        await verifyPTDeleteButtonHidden(page, sortOrder);
      }
    }

    // ========================================================================
    // Step 5: Navigate back to Transactions and SELL all shares from PT3
    // ========================================================================
    console.log(`[${testConfig.scenario}] Step 5: SELL all shares from PT3...`);
    await navigateToTransactionsPage(page);

    const sellStep = testConfig.steps.deletePT.sellTransaction;
    await createSellTransaction(
      page,
      sellStep.input.ptPercent,
      sellStep.input.walletPrice,
      {
        signal: sellStep.input.signal,
        price: sellStep.input.price,
        quantity: sellStep.input.quantity,
        ptPercent: sellStep.input.ptPercent,
        walletPrice: sellStep.input.walletPrice,
      }
    );

    // Verify SELL transaction
    await verifySellTransaction(page, sellStep.expected.transaction);

    // Verify remaining wallets
    for (const wallet of sellStep.expected.wallets) {
      await verifyWallet(page, wallet);
    }

    // Verify PT3 wallet is gone
    for (const notPresent of sellStep.expected.walletsNotPresent) {
      await verifyWalletNotPresent(page, notPresent.ptPercent, notPresent.price);
    }

    // Verify overview
    await verifyOverview(page, sellStep.expected.overview);

    // ========================================================================
    // Step 6: Navigate to Asset Edit and verify delete button states
    // ========================================================================
    console.log(`[${testConfig.scenario}] Step 6: Verify delete button visibility after SELL...`);
    await navigateBackToEditPage(page);

    const afterSellConfig = testConfig.steps.deletePT.verifyDeleteButtonsAfterSell;
    if (afterSellConfig.hidden) {
      for (const sortOrder of afterSellConfig.hidden) {
        await verifyPTDeleteButtonHidden(page, sortOrder);
      }
    }
    if (afterSellConfig.visible) {
      for (const sortOrder of afterSellConfig.visible) {
        await verifyPTDeleteButtonVisible(page, sortOrder);
      }
    }

    // ========================================================================
    // Step 7: Delete PT3 and verify allocation redistribution
    // ========================================================================
    console.log(`[${testConfig.scenario}] Step 7: Delete PT3 and verify redistribution...`);
    await deleteTarget(page, "profit", testConfig.steps.deletePT.targetSortOrder);

    // Verify PT3 is gone
    await verifyPTRowNotPresent(page, testConfig.steps.deletePT.targetSortOrder);

    // Verify remaining PTs have correct reallocated percentages
    for (const expectedPT of testConfig.steps.deletePT.expectedPTsAfterDelete) {
      await verifyPTRow(page, expectedPT);
    }

    // ========================================================================
    // Step 8: Verify wallet tabs reflect PT deletion
    // ========================================================================
    console.log(`[${testConfig.scenario}] Step 8: Verify wallet tabs after PT delete...`);
    await navigateToTransactionsPage(page);
    await verifyWalletTabs(page, testConfig.steps.deletePT.expectedWalletTabs);

    // ========================================================================
    // Step 9: Test allocation error validation in transaction modal
    // ========================================================================
    console.log(`[${testConfig.scenario}] Step 9: Test allocation error validation...`);
    await openNewTransactionModal(page);

    // Fill price and investment FIRST to trigger allocation inputs to appear
    await fillPriceAndInvestment(page, "100", "100");

    // Verify only PT1 and PT2 allocation inputs are visible (not PT3)
    for (const tabPct of testConfig.steps.deletePT.expectedWalletTabs) {
      await verifyAllocationInputVisible(page, tabPct);
    }
    // PT3 (16%) should not be visible
    await verifyAllocationInputNotVisible(page, "16");

    // Verify default allocations match the redistributed values
    const expectedDefaults = testConfig.steps.deletePT.expectedPTsAfterDelete;
    for (const pt of expectedDefaults) {
      const actualValue = await getAllocationInputValue(page, pt.targetPercent);
      expect(actualValue).toBe(pt.allocationPercent);
    }

    // Test allocation error: less than 100%
    const lessThan100Test = testConfig.steps.deletePT.allocationErrorTests.lessThan100;
    await fillTransactionAllocations(page, lessThan100Test.allocations);
    await verifyAllocationError(page, lessThan100Test.expectedError);

    // Test allocation error: more than 100%
    const moreThan100Test = testConfig.steps.deletePT.allocationErrorTests.moreThan100;
    await fillTransactionAllocations(page, moreThan100Test.allocations);
    await verifyAllocationError(page, moreThan100Test.expectedError);

    // Cancel modal
    await cancelTransactionModal(page);

    // ========================================================================
    // Step 10: Test PT allocation editing on Asset Edit page
    // ========================================================================
    if (testConfig.steps.editPTAllocation) {
      console.log(`[${testConfig.scenario}] Step 10: Test PT allocation editing...`);
      await navigateBackToEditPage(page);

      const allocationStep = testConfig.steps.editPTAllocation;

      for (const allocationTest of allocationStep.tests) {
        console.log(`[${testConfig.scenario}] Testing allocation ${allocationTest.newAllocationPercent}% for sortOrder ${allocationTest.targetSortOrder}...`);

        const saveSucceeded = await editPTAllocationAndSave(
          page,
          allocationTest.targetSortOrder,
          allocationTest.newAllocationPercent
        );

        if (allocationTest.expectedError) {
          // Expect save to fail and error to be shown
          expect(saveSucceeded).toBe(false);
          await verifyPageError(page, allocationTest.expectedError);
          await dismissPageError(page);
        } else if (allocationTest.expectedWarning) {
          // Expect save to succeed and warning to be shown
          expect(saveSucceeded).toBe(true);
          await verifyPTAllocationWarning(page, allocationTest.expectedWarning);
        } else if (allocationTest.noWarning) {
          // Expect save to succeed and no warning
          expect(saveSucceeded).toBe(true);
          await verifyNoPTAllocationWarning(page);
        }
      }

      // Verify final allocations
      for (const expectedPT of allocationStep.expectedFinalAllocations) {
        await verifyPTRow(page, expectedPT);
      }
    }

    // ========================================================================
    // Step 11: Test PT sortOrder editing with duplicate detection
    // ========================================================================
    if (testConfig.steps.editPTOrder) {
      console.log(`[${testConfig.scenario}] Step 11: Test PT sortOrder editing...`);

      const orderStep = testConfig.steps.editPTOrder;

      // Test duplicate sortOrder (should fail)
      console.log(`[${testConfig.scenario}] Testing duplicate sortOrder...`);
      const duplicateSaveSucceeded = await editPTSortOrderAndSave(
        page,
        orderStep.duplicateOrderTest.targetSortOrder,
        orderStep.duplicateOrderTest.newSortOrder
      );
      expect(duplicateSaveSucceeded).toBe(false);
      await verifyPageError(page, orderStep.duplicateOrderTest.expectedError!);
      await dismissPageError(page);

      // Test valid sortOrder change (should succeed)
      console.log(`[${testConfig.scenario}] Testing valid sortOrder change...`);
      const validSaveSucceeded = await editPTSortOrderAndSave(
        page,
        orderStep.validOrderTest.targetSortOrder,
        orderStep.validOrderTest.newSortOrder
      );
      expect(validSaveSucceeded).toBe(true);

      // Verify PTs after sortOrder edit (table is sorted by sortOrder)
      for (const expectedPT of orderStep.expectedPTsAfterEdit) {
        await verifyPTRow(page, expectedPT);
      }

      // Navigate to Transactions and verify wallet tabs
      await navigateToTransactionsPage(page);
      await verifyWalletTabs(page, orderStep.expectedWalletTabOrder);
    }

    // ========================================================================
    // Step 12: Test PT targetPercent editing with wallet recalculation
    // ========================================================================
    if (testConfig.steps.editPTValue) {
      console.log(`[${testConfig.scenario}] Step 12: Test PT targetPercent editing...`);
      await navigateBackToEditPage(page);

      const valueStep = testConfig.steps.editPTValue;

      // Edit PT targetPercent and name (will trigger confirmation dialog)
      console.log(`[${testConfig.scenario}] Editing PT at sortOrder ${valueStep.targetSortOrder}...`);
      const saveSucceeded = await editPTValueAndSave(
        page,
        valueStep.targetSortOrder,
        valueStep.input.targetPercent,
        valueStep.input.name
      );
      expect(saveSucceeded).toBe(true);

      // Verify PT row on Asset Edit page shows updated values
      await verifyPTRow(page, valueStep.expectedPT);

      // Navigate to Transactions and verify wallet tabs changed
      await navigateToTransactionsPage(page);
      await verifyWalletTabs(page, valueStep.expectedWalletTabs);

      // Verify wallet at the updated PT has recalculated values
      console.log(`[${testConfig.scenario}] Verifying wallet recalculation...`);
      await verifyWallet(page, {
        ptPercent: valueStep.expectedWallet.ptPercent,
        price: valueStep.expectedWallet.price,
        shares: valueStep.expectedWallet.shares,
        investment: valueStep.expectedWallet.investment,
        pt: valueStep.expectedWallet.pt,
        pct2pt: valueStep.expectedWallet.pct2pt,
      });
    }

    console.log(`[${testConfig.scenario}] Test completed successfully!`);
  });
});
