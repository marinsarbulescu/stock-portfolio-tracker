// e2e/utils/assetHelper.ts
//
// Shared helpers for asset-related e2e tests.
// These functions handle common operations like creating, editing, and deleting
// assets and their targets via the UI.

import { expect, Page } from "@playwright/test";
import {
  AssetCreateInput,
  TargetInput,
  TargetExpected,
  TransactionInput,
  TransactionExpected,
  WalletExpected,
  OverviewExpected,
  EditTransactionTarget,
  SellTransactionInput,
  SellTransactionExpected,
  EditSellTransactionTarget,
  FinancialOverviewExpected,
  DividendSlpInput,
} from "./jsonHelper";

// Re-export types for convenience
export type { AssetCreateInput, TargetInput, TargetExpected, TransactionInput, TransactionExpected, WalletExpected, OverviewExpected, EditTransactionTarget, SellTransactionInput, SellTransactionExpected, EditSellTransactionTarget, FinancialOverviewExpected, DividendSlpInput };

// ============================================================================
// Highlight Color Constants (Tailwind CSS classes used in UI)
// ============================================================================

export const HIGHLIGHT_COLORS = {
  green: "text-green-400",   // %2PT >= -0.005% (PT hit)
  yellow: "text-yellow-400", // -1% <= %2PT < -0.005% (close to PT)
  none: "",                  // %2PT < -1% (far from PT)
} as const;

// ============================================================================
// Form Helpers
// ============================================================================

/**
 * Robustly select a dropdown option with verification and retry.
 * Handles race conditions where React hasn't finished rendering options.
 */
async function selectDropdownOption(
  page: Page,
  selectTestId: string,
  value: string,
  maxRetries: number = 3
): Promise<void> {
  const selectLocator = page.locator(`[data-testid="${selectTestId}"]`);
  const optionLocator = page.locator(`[data-testid="${selectTestId}"] option[value="${value}"]`);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    // Wait for option to be in DOM
    await optionLocator.waitFor({ state: 'attached', timeout: 5000 });

    // Select the option
    await selectLocator.selectOption(value);

    // Verify the selection took effect
    const selectedValue = await selectLocator.inputValue();
    if (selectedValue === value) {
      return; // Success
    }

    console.warn(`[AssetHelper] Dropdown selection attempt ${attempt} failed: expected "${value}", got "${selectedValue}"`);

    if (attempt < maxRetries) {
      await page.waitForTimeout(100); // Brief delay before retry
    }
  }

  throw new Error(`Failed to select "${value}" in dropdown "${selectTestId}" after ${maxRetries} attempts`);
}

/**
 * Fill an allocation input with retry logic to handle React re-renders.
 * The allocation inputs can get detached from DOM when totalShares recalculates.
 * Similar pattern to selectDropdownOption but for text/number inputs.
 */
async function fillAllocationInput(
  page: Page,
  testId: string,
  value: string,
  maxRetries: number = 3
): Promise<void> {
  const locator = page.locator(`[data-testid="${testId}"]`);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Wait for element to be attached and stable
      await locator.waitFor({ state: 'attached', timeout: 5000 });

      // Clear and fill
      await locator.clear();
      await locator.fill(value);

      // Verify the value was set
      const actualValue = await locator.inputValue();
      if (actualValue === value) {
        return; // Success
      }

      console.warn(`[AssetHelper] Allocation fill attempt ${attempt}: expected "${value}", got "${actualValue}"`);
    } catch (error) {
      console.warn(`[AssetHelper] Allocation fill attempt ${attempt} failed:`, error);
    }

    if (attempt < maxRetries) {
      await page.waitForTimeout(200); // Allow React to settle
    }
  }

  throw new Error(`Failed to fill allocation ${testId} with "${value}" after ${maxRetries} attempts`);
}

// ============================================================================
// Navigation & Page Helpers
// ============================================================================

/**
 * Wait for the assets table to fully load (loading indicator disappears).
 */
export async function waitForAssetsTableToLoad(page: Page): Promise<void> {
  console.log("[AssetHelper] Waiting for assets table to load...");
  await expect(page.locator('[data-testid="btn-new-asset"]')).toBeVisible({ timeout: 15000 });
  // Wait for loading indicator to disappear
  await expect(page.locator('[data-testid="assets-loading"]')).not.toBeVisible({ timeout: 15000 });
  console.log("[AssetHelper] Assets table loaded.");
}

/**
 * Navigate to the Assets page (/assets).
 */
export async function navigateToAssetsPage(page: Page): Promise<void> {
  console.log("[AssetHelper] Navigating to Assets page...");
  await page.goto("/assets");
  await expect(page).toHaveURL(/\/assets$/);
  await waitForAssetsTableToLoad(page);
  console.log("[AssetHelper] Successfully navigated to Assets page.");
}

/**
 * Navigate to the asset edit page by clicking the Edit link in the table.
 */
export async function navigateToAssetEditPage(page: Page, symbol: string): Promise<void> {
  console.log(`[AssetHelper] Navigating to edit page for ${symbol}...`);
  await navigateToAssetsPage(page);
  const editLink = page.locator(`[data-testid="asset-table-edit-${symbol}"]`);
  await editLink.click();
  await expect(page.locator('[data-testid="asset-form-symbol"]')).toBeVisible({ timeout: 10000 });
  console.log("[AssetHelper] On asset edit page.");
}

/**
 * Navigate to the transactions page for an asset.
 */
export async function navigateToTransactionsPage(page: Page): Promise<void> {
  console.log("[AssetHelper] Navigating to Transactions page...");
  await page.locator('[data-testid="link-transactions"]').click();
  await expect(page).toHaveURL(/\/transactions$/);
  // Wait for the page to fully load (button appears after data loads)
  await expect(page.locator('[data-testid="btn-new-transaction"]')).toBeVisible({ timeout: 10000 });
  console.log("[AssetHelper] On Transactions page.");
}

/**
 * Navigate back to the asset edit page from transactions.
 */
export async function navigateBackToEditPage(page: Page): Promise<void> {
  console.log("[AssetHelper] Navigating back to Edit page...");
  await page.locator('[data-testid="link-edit-asset"]').click();
  await expect(page.locator('[data-testid="asset-form-symbol"]')).toBeVisible({ timeout: 10000 });
  console.log("[AssetHelper] On asset edit page.");
}

/**
 * Update the test price of an asset. Call this from the transactions page.
 * Navigates to edit page, updates price, saves, and returns to transactions.
 */
export async function updateTestPrice(page: Page, newPrice: string): Promise<void> {
  console.log(`[AssetHelper] Updating test price to ${newPrice}...`);

  // Navigate back to edit page
  await navigateBackToEditPage(page);

  // Update test price field
  await page.locator('[data-testid="asset-form-testPrice"]').clear();
  await page.locator('[data-testid="asset-form-testPrice"]').fill(newPrice);

  // Submit form
  await page.locator('[data-testid="asset-form-submit"]').click();

  // Wait for save to complete
  await expect(page.locator('[data-testid="asset-form-submit"]')).toHaveText("Save Changes", { timeout: 10000 });

  // Navigate back to transactions
  await navigateToTransactionsPage(page);

  console.log("[AssetHelper] Test price updated successfully.");
}

/**
 * Update the test price of an asset. Call this when already on the Edit page.
 * Just updates the price field and saves. Does not navigate.
 */
export async function updateTestPriceOnEditPage(page: Page, newPrice: string): Promise<void> {
  console.log(`[AssetHelper] Updating test price to ${newPrice}...`);

  // Update test price field
  await page.locator('[data-testid="asset-form-testPrice"]').clear();
  await page.locator('[data-testid="asset-form-testPrice"]').fill(newPrice);

  // Submit form
  await page.locator('[data-testid="asset-form-submit"]').click();

  // Wait for save to complete
  await expect(page.locator('[data-testid="asset-form-submit"]')).toHaveText("Save Changes", { timeout: 10000 });

  console.log("[AssetHelper] Test price updated successfully.");
}

// ============================================================================
// Asset CRUD Helpers
// ============================================================================

/**
 * Check if a test asset exists and delete it via UI if found.
 * Call this from the Assets page.
 */
export async function cleanupTestAssetViaUI(page: Page, symbol: string): Promise<void> {
  console.log(`[AssetHelper] Checking for existing test asset: ${symbol}...`);

  const assetLink = page.locator(`[data-testid="asset-table-symbol-${symbol}"]`);
  const assetExists = (await assetLink.count()) > 0;

  if (assetExists) {
    console.log(`[AssetHelper] Found existing asset ${symbol}, deleting...`);

    // Click Edit link to go to edit page
    const editLink = page.locator(`[data-testid="asset-table-edit-${symbol}"]`);
    await editLink.click();

    // Wait for edit page to load
    await expect(page.locator('[data-testid="btn-delete-asset"]')).toBeVisible({ timeout: 10000 });

    // Set up dialog handler for confirm dialog
    page.once("dialog", (dialog) => dialog.accept());

    // Click delete button
    await page.locator('[data-testid="btn-delete-asset"]').click();

    // Wait for redirect back to assets page
    await expect(page).toHaveURL(/\/assets$/, { timeout: 10000 });

    // Verify asset is deleted
    await expect(
      page.locator(`[data-testid="asset-table-symbol-${symbol}"]`)
    ).not.toBeVisible({ timeout: 5000 });

    console.log(`[AssetHelper] Asset ${symbol} deleted successfully.`);
  } else {
    console.log(`[AssetHelper] No existing asset ${symbol} found.`);
  }
}

/**
 * Create an asset via UI. Call this from the Assets page.
 * After creation, the page will be on the asset edit page.
 */
export async function createAssetViaUI(page: Page, input: AssetCreateInput): Promise<void> {
  console.log(`[AssetHelper] Creating asset ${input.symbol} via UI...`);

  // Click New Asset button
  await page.locator('[data-testid="btn-new-asset"]').click();

  // Wait for new asset form to load
  await expect(page.locator('[data-testid="asset-form-symbol"]')).toBeVisible({ timeout: 10000 });

  // Fill the form
  await page.locator('[data-testid="asset-form-symbol"]').fill(input.symbol);
  await page.locator('[data-testid="asset-form-name"]').fill(input.name);
  await page.locator('[data-testid="asset-form-type"]').selectOption(input.type);
  await page.locator('[data-testid="asset-form-testPrice"]').fill(input.testPrice);
  await page.locator('[data-testid="asset-form-commission"]').fill(input.commission);
  await page.locator('[data-testid="asset-form-status"]').selectOption(input.status);

  // Submit form
  await page.locator('[data-testid="asset-form-submit"]').click();

  // Wait for navigation to edit page (after successful creation)
  await expect(page).toHaveURL(/\/assets\/[^/]+$/);

  console.log("[AssetHelper] Asset created successfully.");
}

/**
 * Edit an asset via UI. Call this from the Assets page.
 * After editing, the page will be on the asset edit page.
 */
export async function editAssetViaUI(
  page: Page,
  currentSymbol: string,
  input: AssetCreateInput
): Promise<void> {
  console.log(`[AssetHelper] Editing asset ${currentSymbol} via UI...`);

  // Find and click the Edit link for the asset
  const editLink = page.locator(`[data-testid="asset-table-edit-${currentSymbol}"]`);
  await editLink.click();

  // Wait for edit form to load
  await expect(page.locator('[data-testid="asset-form-symbol"]')).toBeVisible({
    timeout: 10000,
  });

  // Clear and fill the form with new values
  await page.locator('[data-testid="asset-form-symbol"]').clear();
  await page.locator('[data-testid="asset-form-symbol"]').fill(input.symbol);

  await page.locator('[data-testid="asset-form-name"]').clear();
  await page.locator('[data-testid="asset-form-name"]').fill(input.name);

  await page.locator('[data-testid="asset-form-type"]').selectOption(input.type);

  await page.locator('[data-testid="asset-form-testPrice"]').clear();
  await page.locator('[data-testid="asset-form-testPrice"]').fill(input.testPrice);

  await page.locator('[data-testid="asset-form-commission"]').clear();
  await page.locator('[data-testid="asset-form-commission"]').fill(input.commission);

  await page.locator('[data-testid="asset-form-status"]').selectOption(input.status);

  // Submit form
  await page.locator('[data-testid="asset-form-submit"]').click();

  // Wait for form to save (button text changes from "Saving..." back to "Save Changes")
  await expect(page.locator('[data-testid="asset-form-submit"]')).toHaveText("Save Changes", {
    timeout: 10000,
  });

  console.log("[AssetHelper] Asset edited successfully.");
}

/**
 * Delete the currently viewed asset via UI. Call this from the asset edit page.
 */
export async function deleteAssetViaUI(page: Page): Promise<void> {
  console.log("[AssetHelper] Deleting asset...");
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator('[data-testid="btn-delete-asset"]').click();
  await expect(page).toHaveURL(/\/assets$/);
  console.log("[AssetHelper] Asset deleted successfully.");
}

/**
 * Verify that an asset exists in the table with expected values.
 * Call this from the Assets page.
 */
export async function verifyAssetInTable(
  page: Page,
  expected: { symbol: string; name: string; type: string; commission: string; status: string }
): Promise<void> {
  console.log(`[AssetHelper] Verifying asset ${expected.symbol} in table...`);

  const symbolCell = page.locator(`[data-testid="asset-table-symbol-${expected.symbol}"]`);
  await expect(symbolCell).toBeVisible({ timeout: 10000 });
  await expect(symbolCell).toHaveText(expected.symbol);

  const nameCell = page.locator(`[data-testid="asset-table-name-${expected.symbol}"]`);
  await expect(nameCell).toHaveText(expected.name);

  const typeCell = page.locator(`[data-testid="asset-table-type-${expected.symbol}"]`);
  await expect(typeCell).toHaveText(expected.type);

  const commissionCell = page.locator(`[data-testid="asset-table-commission-${expected.symbol}"]`);
  await expect(commissionCell).toHaveText(expected.commission);

  const statusCell = page.locator(`[data-testid="asset-table-status-${expected.symbol}"]`);
  await expect(statusCell).toHaveText(expected.status);

  console.log("[AssetHelper] Asset verified successfully in table.");
}

/**
 * Verify that an asset is NOT in the table.
 * Call this from the Assets page.
 */
export async function verifyAssetNotInTable(page: Page, symbol: string): Promise<void> {
  console.log(`[AssetHelper] Verifying asset ${symbol} is NOT in table...`);
  const symbolCell = page.locator(`[data-testid="asset-table-symbol-${symbol}"]`);
  await expect(symbolCell).not.toBeVisible({ timeout: 5000 });
  console.log(`[AssetHelper] Asset ${symbol} confirmed not in table.`);
}

// ============================================================================
// Target CRUD Helpers (Entry Targets & Profit Targets)
// ============================================================================

/**
 * Create a target (entry or profit) via UI.
 * Call this from the asset edit page.
 */
export async function createTarget(
  page: Page,
  type: "entry" | "profit",
  input: TargetInput
): Promise<void> {
  console.log(`[AssetHelper] Creating ${type} target: ${input.name}...`);

  // Wait for any previous form to be hidden first
  const newRowLocator = page.locator(`[data-testid="${type}-target-new-row"]`);
  const isNewRowVisible = await newRowLocator.isVisible();
  if (isNewRowVisible) {
    console.log(`[AssetHelper] Waiting for previous form to close...`);
    await expect(newRowLocator).not.toBeVisible({ timeout: 5000 });
  }

  // Click Add button to show form
  console.log(`[AssetHelper] Clicking Add button...`);
  await page.locator(`[data-testid="${type}-target-add-btn"]`).click();
  await expect(newRowLocator).toBeVisible({ timeout: 5000 });
  console.log(`[AssetHelper] Form visible, filling fields...`);

  // Fill form
  await page.locator(`[data-testid="${type}-target-new-name"]`).fill(input.name);
  await page.locator(`[data-testid="${type}-target-new-percent"]`).fill(input.targetPercent);
  if (type === "profit" && input.allocationPercent) {
    await page.locator(`[data-testid="${type}-target-new-alloc"]`).fill(input.allocationPercent);
  }
  await page.locator(`[data-testid="${type}-target-new-order"]`).clear();
  await page.locator(`[data-testid="${type}-target-new-order"]`).fill(input.sortOrder);

  // Wait for submit button to be enabled and click
  const submitBtn = page.locator(`[data-testid="${type}-target-new-submit"]`);
  await expect(submitBtn).toBeEnabled({ timeout: 5000 });
  console.log(`[AssetHelper] Clicking submit button...`);
  await submitBtn.click();

  // Wait for form to close (indicates save started)
  await expect(newRowLocator).not.toBeVisible({ timeout: 10000 });
  console.log(`[AssetHelper] Form closed, waiting for row...`);

  // Wait for row to appear
  await expect(page.locator(`[data-testid="${type}-target-row-${input.sortOrder}"]`)).toBeVisible({ timeout: 10000 });
  console.log(`[AssetHelper] ${type} target created successfully.`);
}

/**
 * Verify a target exists in the table with expected values.
 * Call this from the asset edit page.
 */
export async function verifyTarget(
  page: Page,
  type: "entry" | "profit",
  expected: TargetExpected
): Promise<void> {
  console.log(`[AssetHelper] Verifying ${type} target: ${expected.name}...`);

  const nameCell = page.locator(`[data-testid="${type}-target-name-${expected.sortOrder}"]`);
  await expect(nameCell).toHaveText(expected.name);

  const percentCell = page.locator(`[data-testid="${type}-target-percent-${expected.sortOrder}"]`);
  await expect(percentCell).toHaveText(expected.targetPercent);

  if (type === "profit" && expected.allocationPercent) {
    const allocCell = page.locator(`[data-testid="${type}-target-alloc-${expected.sortOrder}"]`);
    await expect(allocCell).toHaveText(expected.allocationPercent);
  }

  const orderCell = page.locator(`[data-testid="${type}-target-order-${expected.sortOrder}"]`);
  await expect(orderCell).toHaveText(expected.sortOrder);

  console.log(`[AssetHelper] ${type} target verified successfully.`);
}

/**
 * Edit a target via UI.
 * Call this from the asset edit page.
 */
export async function editTarget(
  page: Page,
  type: "entry" | "profit",
  sortOrder: string,
  input: TargetInput
): Promise<void> {
  console.log(`[AssetHelper] Editing ${type} target at sortOrder ${sortOrder}...`);

  // Click Edit button
  await page.locator(`[data-testid="${type}-target-edit-btn-${sortOrder}"]`).click();

  // Wait for edit mode
  await expect(page.locator(`[data-testid="${type}-target-edit-name-${sortOrder}"]`)).toBeVisible({ timeout: 5000 });

  // Clear and fill
  await page.locator(`[data-testid="${type}-target-edit-name-${sortOrder}"]`).clear();
  await page.locator(`[data-testid="${type}-target-edit-name-${sortOrder}"]`).fill(input.name);

  await page.locator(`[data-testid="${type}-target-edit-percent-${sortOrder}"]`).clear();
  await page.locator(`[data-testid="${type}-target-edit-percent-${sortOrder}"]`).fill(input.targetPercent);

  if (type === "profit" && input.allocationPercent) {
    await page.locator(`[data-testid="${type}-target-edit-alloc-${sortOrder}"]`).clear();
    await page.locator(`[data-testid="${type}-target-edit-alloc-${sortOrder}"]`).fill(input.allocationPercent);
  }

  await page.locator(`[data-testid="${type}-target-edit-order-${sortOrder}"]`).clear();
  await page.locator(`[data-testid="${type}-target-edit-order-${sortOrder}"]`).fill(input.sortOrder);

  // Save
  await page.locator(`[data-testid="${type}-target-edit-save-${sortOrder}"]`).click();

  // Wait for edit mode to close
  await expect(page.locator(`[data-testid="${type}-target-edit-save-${sortOrder}"]`)).not.toBeVisible({ timeout: 5000 });

  console.log(`[AssetHelper] ${type} target edited successfully.`);
}

/**
 * Delete a target via UI.
 * Call this from the asset edit page.
 */
export async function deleteTarget(
  page: Page,
  type: "entry" | "profit",
  sortOrder: string
): Promise<void> {
  console.log(`[AssetHelper] Deleting ${type} target at sortOrder ${sortOrder}...`);

  // Set up dialog handler
  page.once("dialog", (dialog) => dialog.accept());

  // Click Delete button
  await page.locator(`[data-testid="${type}-target-delete-btn-${sortOrder}"]`).click();

  // Wait for row to disappear
  await expect(page.locator(`[data-testid="${type}-target-row-${sortOrder}"]`)).not.toBeVisible({ timeout: 5000 });

  console.log(`[AssetHelper] ${type} target deleted successfully.`);
}

// ============================================================================
// Wallet Tab Helpers (for verifying PT tabs on transactions page)
// ============================================================================

/**
 * Verify that wallet tabs exist for given profit target percentages.
 * Call this from the transactions page.
 */
export async function verifyWalletTabs(page: Page, ptPercents: string[]): Promise<void> {
  console.log(`[AssetHelper] Verifying wallet tabs for PTs: ${ptPercents.join(", ")}...`);

  // Verify each PT tab
  for (const pct of ptPercents) {
    await expect(page.locator(`[data-testid="wallet-tab-pt-${pct}"]`)).toBeVisible({ timeout: 5000 });
  }

  console.log("[AssetHelper] Wallet tabs verified.");
}

/**
 * Verify that no PT wallet tabs exist.
 * Call this from the transactions page.
 */
export async function verifyNoPTWalletTabs(page: Page): Promise<void> {
  console.log("[AssetHelper] Verifying no PT wallet tabs exist...");
  const ptTabs = page.locator('[data-testid^="wallet-tab-pt-"]');
  await expect(ptTabs).toHaveCount(0, { timeout: 5000 });
  console.log("[AssetHelper] No PT wallet tabs confirmed.");
}

// ============================================================================
// High-Level Setup Helper
// ============================================================================

export interface SetupTestAssetOptions {
  asset: AssetCreateInput;
  entryTargets?: TargetInput[];
  profitTargets?: TargetInput[];
  budget?: { year: string; amount: string };
}

/**
 * High-level helper to set up a test asset with optional targets and budget.
 * This performs the common setup sequence:
 * 1. Navigate to Assets page
 * 2. Cleanup existing test asset if it exists
 * 3. Create the asset
 * 4. Create entry targets (if provided)
 * 5. Create profit targets (if provided)
 * 6. Create budget (if provided)
 *
 * After this function, the page will be on the asset edit page.
 */
export async function setupTestAsset(page: Page, options: SetupTestAssetOptions): Promise<void> {
  console.log(`[AssetHelper] Setting up test asset: ${options.asset.symbol}...`);

  // 1. Navigate to assets page
  await navigateToAssetsPage(page);

  // 2. Cleanup existing test asset
  await cleanupTestAssetViaUI(page, options.asset.symbol);

  // 3. Create asset (this leaves us on the edit page)
  await createAssetViaUI(page, options.asset);

  // 4. Create entry targets (if provided)
  if (options.entryTargets && options.entryTargets.length > 0) {
    for (const et of options.entryTargets) {
      await createTarget(page, "entry", et);
    }
  }

  // 5. Create profit targets (if provided)
  if (options.profitTargets && options.profitTargets.length > 0) {
    for (const pt of options.profitTargets) {
      await createTarget(page, "profit", pt);
    }
  }

  // 6. Create budget (if provided)
  if (options.budget) {
    await createBudget(page, options.budget.year, options.budget.amount);
  }

  console.log(`[AssetHelper] Test asset ${options.asset.symbol} setup complete.`);
}

// ============================================================================
// BUY Transaction CRUD Helpers
// ============================================================================

/**
 * Create a BUY transaction via the modal.
 * Call this from the transactions page.
 */
export async function createBuyTransaction(
  page: Page,
  input: TransactionInput
): Promise<void> {
  console.log(`[AssetHelper] Creating BUY transaction: price=${input.price}, investment=${input.investment}...`);

  // Click New Transaction button
  await page.locator('[data-testid="btn-new-transaction"]').click();

  // Wait for modal to open
  await expect(page.locator('[data-testid="transaction-form-signal"]')).toBeVisible({ timeout: 5000 });

  // Wait for asset dropdown to be populated (has a non-empty value)
  await expect(page.locator('[data-testid="transaction-form-asset"]')).toHaveValue(/.+/, { timeout: 5000 });

  // Type should already be BUY (default), but ensure it
  await page.locator('[data-testid="transaction-form-type"]').selectOption("BUY");

  // Select signal with verification and retry
  await selectDropdownOption(page, "transaction-form-signal", input.signal);

  // Fill price
  await page.locator('[data-testid="transaction-form-price"]').fill(input.price);

  // Fill investment
  await page.locator('[data-testid="transaction-form-investment"]').fill(input.investment);

  // Wait for PT allocation inputs to appear (they appear after price+investment are filled)
  // Wait for the first allocation input to be visible before filling any
  if (input.allocations.length > 0) {
    const firstAllocTestId = `transaction-pt-alloc-${input.allocations[0].ptPercent}`;
    await expect(page.locator(`[data-testid="${firstAllocTestId}"]`)).toBeVisible({ timeout: 10000 });
  }

  // Fill PT allocations (with retry logic to handle React re-renders)
  for (const alloc of input.allocations) {
    await fillAllocationInput(
      page,
      `transaction-pt-alloc-${alloc.ptPercent}`,
      alloc.percentage
    );
  }

  // Submit
  await page.locator('[data-testid="transaction-form-submit"]').click();

  // Wait for modal to close
  await expect(page.locator('[data-testid="transaction-form-submit"]')).not.toBeVisible({ timeout: 10000 });

  console.log("[AssetHelper] BUY transaction created successfully.");
}

/**
 * Edit a BUY transaction via the modal.
 * Call this from the transactions page.
 * @param target - The transaction to find and edit (by signal, price, investment)
 * @param input - The new values to set
 */
export async function editBuyTransaction(
  page: Page,
  target: EditTransactionTarget,
  input: TransactionInput
): Promise<void> {
  console.log(`[AssetHelper] Editing BUY transaction: ${target.signal} @ ${target.price}...`);

  // Wait for the transactions page to be fully loaded
  await expect(page.locator('[data-testid="btn-new-transaction"]')).toBeVisible({ timeout: 10000 });

  // Wait a moment for the table to render
  await page.waitForTimeout(500);

  // Find the transaction row
  const row = await findTransactionRow(page, target.price, target.signal, target.investment);

  // Click on the edit button within this row (data-testid starts with "transaction-edit-")
  const editButton = row.locator('[data-testid^="transaction-edit-"]');
  await editButton.click();

  // Wait for modal to open in edit mode
  await expect(page.locator('[data-testid="transaction-form-signal"]')).toBeVisible({ timeout: 5000 });

  // Select signal with verification and retry
  await selectDropdownOption(page, "transaction-form-signal", input.signal);

  // Clear and update price
  await page.locator('[data-testid="transaction-form-price"]').clear();
  await page.locator('[data-testid="transaction-form-price"]').fill(input.price);

  // Clear and update investment
  await page.locator('[data-testid="transaction-form-investment"]').clear();
  await page.locator('[data-testid="transaction-form-investment"]').fill(input.investment);

  // Wait for PT allocation inputs to be visible before updating
  if (input.allocations.length > 0) {
    const firstAllocTestId = `transaction-pt-alloc-${input.allocations[0].ptPercent}`;
    await expect(page.locator(`[data-testid="${firstAllocTestId}"]`)).toBeVisible({ timeout: 10000 });
  }

  // Update PT allocations (with retry logic to handle React re-renders)
  for (const alloc of input.allocations) {
    await fillAllocationInput(
      page,
      `transaction-pt-alloc-${alloc.ptPercent}`,
      alloc.percentage
    );
  }

  // Submit
  await page.locator('[data-testid="transaction-form-submit"]').click();

  // Wait for modal to close
  await expect(page.locator('[data-testid="transaction-form-submit"]')).not.toBeVisible({ timeout: 10000 });

  console.log("[AssetHelper] BUY transaction edited successfully.");
}

/**
 * Delete a BUY transaction via the UI.
 * Call this from the transactions page.
 * @param target - The transaction to find and delete (by signal, price, investment)
 */
export async function deleteBuyTransaction(
  page: Page,
  target: EditTransactionTarget
): Promise<void> {
  console.log(`[AssetHelper] Deleting BUY transaction: ${target.signal} @ ${target.price}...`);

  // Wait for the transactions page to be fully loaded
  await expect(page.locator('[data-testid="btn-new-transaction"]')).toBeVisible({ timeout: 10000 });

  // Wait a moment for the table to render
  await page.waitForTimeout(500);

  // Find the transaction row
  const row = await findTransactionRow(page, target.price, target.signal, target.investment);

  // Set up dialog handler for confirm dialog
  page.once("dialog", (dialog) => dialog.accept());

  // Click on the delete button within this row
  const deleteButton = row.locator('[data-testid^="transaction-delete-"]');
  await deleteButton.click();

  // Wait for the row to actually disappear from the DOM
  await expect(row).not.toBeVisible({ timeout: 10000 });

  console.log("[AssetHelper] BUY transaction deleted successfully.");
}

/**
 * Verify a transaction is NOT present in the table.
 * Call this from the transactions page.
 */
export async function verifyTransactionNotPresent(
  page: Page,
  target: EditTransactionTarget
): Promise<void> {
  console.log(`[AssetHelper] Verifying transaction NOT present: ${target.signal} @ ${target.price}...`);

  // Find rows that match the criteria using data-testid pattern
  const rows = page.locator('tr[data-testid^="transaction-row-"]');
  const matchingRow = rows
    .filter({ hasText: target.price })
    .filter({ hasText: target.signal })
    .filter({ hasText: target.investment });

  const count = await matchingRow.count();
  if (count > 0) {
    throw new Error(`Expected no transaction with price=${target.price}, signal=${target.signal}, investment=${target.investment}, but found ${count}`);
  }

  console.log("[AssetHelper] Transaction confirmed NOT present.");
}

/**
 * Find a transaction row by unique combination of price, signal, and investment.
 * Returns a locator for the row.
 */
export async function findTransactionRow(
  page: Page,
  price: string,
  signal: string,
  investment: string
): Promise<import("@playwright/test").Locator> {
  console.log(`[AssetHelper] Finding transaction row: price=${price}, signal=${signal}, investment=${investment}...`);

  // Find row using data-testid pattern and filter by content
  const rows = page.locator('tr[data-testid^="transaction-row-"]');
  const matchingRow = rows.filter({ hasText: price }).filter({ hasText: signal }).filter({ hasText: investment });

  // Ensure we found exactly one
  const count = await matchingRow.count();
  if (count === 0) {
    throw new Error(`No transaction row found with price=${price}, signal=${signal}, investment=${investment}`);
  }
  if (count > 1) {
    console.warn(`[AssetHelper] Found ${count} matching rows, using first one`);
  }

  return matchingRow.first();
}

/**
 * Verify BUY transaction values in the table.
 * Finds the transaction by price+signal+investment and checks all expected values.
 */
export async function verifyBuyTransaction(
  page: Page,
  expected: TransactionExpected
): Promise<void> {
  console.log(`[AssetHelper] Verifying BUY transaction: type=${expected.type}, signal=${expected.signal}...`);

  const row = await findTransactionRow(page, expected.price, expected.signal, expected.investment);

  // Verify each expected value is in the row
  await expect(row).toContainText(expected.type);
  await expect(row).toContainText(expected.signal);
  await expect(row).toContainText(expected.price);
  await expect(row).toContainText(expected.quantity);
  await expect(row).toContainText(expected.investment);
  await expect(row).toContainText(expected.entryTarget);

  // P/L fields may be "-" for BUY transactions
  if (expected.profitLoss !== "-") {
    await expect(row).toContainText(expected.profitLoss);
  }
  if (expected.profitLossPercent !== "-") {
    await expect(row).toContainText(expected.profitLossPercent);
  }

  console.log("[AssetHelper] BUY transaction verified successfully.");
}

/**
 * Alias for backward compatibility
 * @deprecated Use verifyBuyTransaction instead
 */
export const verifyTransaction = verifyBuyTransaction;

// ============================================================================
// SELL Transaction CRUD Helpers
// ============================================================================

/**
 * Find a SELL transaction row by price, signal, and amount.
 * Returns a locator for the row.
 */
export async function findSellTransactionRow(
  page: Page,
  price: string,
  signal: string,
  amount: string
): Promise<import("@playwright/test").Locator> {
  console.log(`[AssetHelper] Finding SELL transaction row: price=${price}, signal=${signal}, amount=${amount}...`);

  // Find row using data-testid pattern and filter by content
  const rows = page.locator('tr[data-testid^="transaction-row-"]');
  const matchingRow = rows.filter({ hasText: price }).filter({ hasText: signal }).filter({ hasText: amount });

  // Ensure we found exactly one
  const count = await matchingRow.count();
  if (count === 0) {
    throw new Error(`No SELL transaction row found with price=${price}, signal=${signal}, amount=${amount}`);
  }
  if (count > 1) {
    console.warn(`[AssetHelper] Found ${count} matching rows, using first one`);
  }

  return matchingRow.first();
}

/**
 * Create a SELL transaction via the SellModal.
 * Call this from the transactions page.
 * @param ptPercent - The PT tab containing the wallet to sell from
 * @param walletPrice - The price of the wallet to sell from
 * @param input - The SELL transaction input (signal, price, quantity)
 */
export async function createSellTransaction(
  page: Page,
  ptPercent: string,
  walletPrice: string,
  input: SellTransactionInput
): Promise<void> {
  console.log(`[AssetHelper] Creating SELL transaction: PT=${ptPercent}%, wallet=$${walletPrice}, qty=${input.quantity}...`);

  // Click the PT tab to show the wallet
  await page.locator(`[data-testid="wallet-tab-pt-${ptPercent}"]`).click();
  await page.waitForTimeout(300);

  // Find the wallet row by data-testid pattern and filter by price
  const walletRows = page.locator('tr[data-testid^="wallet-row-"]');
  const walletRow = walletRows.filter({ hasText: walletPrice }).first();

  // Get the wallet ID from the row's data-testid
  const testId = await walletRow.getAttribute("data-testid");
  if (!testId) {
    throw new Error(`No wallet row found with price=${walletPrice}`);
  }
  const walletId = testId.replace("wallet-row-", "");

  // Click the Sell button using its data-testid
  const sellButton = page.locator(`[data-testid="wallet-sell-${walletId}"]`);
  await sellButton.click();

  // Wait for SellModal to open
  await expect(page.locator('[data-testid="sell-form-signal"]')).toBeVisible({ timeout: 5000 });

  // Fill signal
  await page.locator('[data-testid="sell-form-signal"]').selectOption(input.signal);

  // Fill price
  await page.locator('[data-testid="sell-form-price"]').clear();
  await page.locator('[data-testid="sell-form-price"]').fill(input.price);

  // Fill quantity
  await page.locator('[data-testid="sell-form-quantity"]').clear();
  await page.locator('[data-testid="sell-form-quantity"]').fill(input.quantity);

  // Submit
  await page.locator('[data-testid="sell-form-submit"]').click();

  // Wait for modal to close
  await expect(page.locator('[data-testid="sell-form-submit"]')).not.toBeVisible({ timeout: 10000 });

  console.log("[AssetHelper] SELL transaction created successfully.");
}

/**
 * Verify SELL transaction values in the table.
 * Finds the transaction by price+signal+amount and checks all expected values.
 */
export async function verifySellTransaction(
  page: Page,
  expected: SellTransactionExpected
): Promise<void> {
  console.log(`[AssetHelper] Verifying SELL transaction: type=${expected.type}, signal=${expected.signal}...`);

  const row = await findSellTransactionRow(page, expected.price, expected.signal, expected.amount);

  // Verify each expected value is in the row
  await expect(row).toContainText(expected.type);
  await expect(row).toContainText(expected.signal);
  await expect(row).toContainText(expected.price);
  await expect(row).toContainText(expected.quantity);
  await expect(row).toContainText(expected.amount);
  await expect(row).toContainText(expected.profitLoss);
  await expect(row).toContainText(expected.profitLossPercent);

  console.log("[AssetHelper] SELL transaction verified successfully.");
}

/**
 * Verify a SELL transaction is NOT present in the table.
 * Call this from the transactions page.
 */
export async function verifySellTransactionNotPresent(
  page: Page,
  target: EditSellTransactionTarget
): Promise<void> {
  console.log(`[AssetHelper] Verifying SELL transaction NOT present: ${target.signal} @ ${target.price}...`);

  // Find rows that match the criteria using data-testid pattern
  const rows = page.locator('tr[data-testid^="transaction-row-"]');
  const matchingRow = rows
    .filter({ hasText: target.price })
    .filter({ hasText: target.signal })
    .filter({ hasText: target.amount });

  const count = await matchingRow.count();
  if (count > 0) {
    throw new Error(`Expected no SELL transaction with price=${target.price}, signal=${target.signal}, amount=${target.amount}, but found ${count}`);
  }

  console.log("[AssetHelper] SELL transaction confirmed NOT present.");
}

/**
 * Edit a SELL transaction via the edit modal.
 * Call this from the transactions page.
 * @param target - The transaction to edit (identified by signal, price, amount)
 * @param input - The new values for the transaction
 */
export async function editSellTransaction(
  page: Page,
  target: EditSellTransactionTarget,
  input: SellTransactionInput
): Promise<void> {
  console.log(`[AssetHelper] Editing SELL transaction: ${target.signal} @ ${target.price}...`);

  // Find the transaction row
  const row = await findSellTransactionRow(page, target.price, target.signal, target.amount);

  // Click the edit button on that row
  const editButton = row.locator('[data-testid^="transaction-edit-"]');
  await editButton.click();

  // Wait for the edit modal to open (TransactionModal is used for editing)
  await expect(page.locator('[data-testid="transaction-form-signal"]')).toBeVisible({ timeout: 5000 });

  // Wait for the form to load with SELL type (Quantity field only shows for SELL)
  await expect(page.locator('[data-testid="transaction-form-quantity"]')).toBeVisible({ timeout: 5000 });

  // Select signal with verification and retry
  await selectDropdownOption(page, "transaction-form-signal", input.signal);

  // Fill price
  await page.locator('[data-testid="transaction-form-price"]').clear();
  await page.locator('[data-testid="transaction-form-price"]').fill(input.price);

  // Fill quantity
  await page.locator('[data-testid="transaction-form-quantity"]').clear();
  await page.locator('[data-testid="transaction-form-quantity"]').fill(input.quantity);

  // Submit
  await page.locator('[data-testid="transaction-form-submit"]').click();

  // Wait for modal to close
  await expect(page.locator('[data-testid="transaction-form-submit"]')).not.toBeVisible({ timeout: 10000 });

  console.log("[AssetHelper] SELL transaction edited successfully.");
}

/**
 * Delete a SELL transaction.
 * Call this from the transactions page.
 * @param target - The transaction to delete (identified by signal, price, amount)
 */
export async function deleteSellTransaction(
  page: Page,
  target: EditSellTransactionTarget
): Promise<void> {
  console.log(`[AssetHelper] Deleting SELL transaction: ${target.signal} @ ${target.price}...`);

  // Find the transaction row
  const row = await findSellTransactionRow(page, target.price, target.signal, target.amount);

  // Set up dialog handler to accept the native confirm dialog
  page.once("dialog", async (dialog) => {
    console.log(`[AssetHelper] Dialog appeared: ${dialog.message()}`);
    await dialog.accept();
  });

  // Click the delete button on that row
  const deleteButton = row.locator('[data-testid^="transaction-delete-"]');
  await deleteButton.click();

  // Wait for the transaction to be removed from the table
  await page.waitForTimeout(1000);

  console.log("[AssetHelper] SELL transaction deleted successfully.");
}

/**
 * Find a wallet row by price and shares within the currently selected PT tab.
 */
export async function findWalletRow(
  page: Page,
  ptPercent: string,
  price: string,
  shares: string
): Promise<import("@playwright/test").Locator> {
  console.log(`[AssetHelper] Finding wallet row: PT=${ptPercent}%, price=${price}, shares=${shares}...`);

  // Click the PT tab
  await page.locator(`[data-testid="wallet-tab-pt-${ptPercent}"]`).click();

  // Wait for tab to be active
  await page.waitForTimeout(300);

  // Find wallet row by data-testid pattern and filter by content
  const walletRows = page.locator('tr[data-testid^="wallet-row-"]');
  const matchingRow = walletRows.filter({ hasText: price }).filter({ hasText: shares });

  const count = await matchingRow.count();
  if (count === 0) {
    throw new Error(`No wallet row found with price=${price}, shares=${shares} in PT+${ptPercent}%`);
  }

  return matchingRow.first();
}

/**
 * Verify wallet values for a given PT tab.
 * Optionally verifies %2PT highlight color.
 */
export async function verifyWallet(
  page: Page,
  expected: WalletExpected
): Promise<void> {
  console.log(`[AssetHelper] Verifying wallet: PT=${expected.ptPercent}%, price=${expected.price}...`);

  const row = await findWalletRow(page, expected.ptPercent, expected.price, expected.shares);

  // Verify each expected value
  await expect(row).toContainText(expected.price);
  await expect(row).toContainText(expected.shares);
  await expect(row).toContainText(expected.investment);
  await expect(row).toContainText(expected.pt);
  await expect(row).toContainText(expected.pct2pt);

  // Verify %2PT highlight if specified
  if (expected.pct2ptHighlight) {
    const pct2ptCell = row.locator(`text=${expected.pct2pt}`);
    const expectedClass = HIGHLIGHT_COLORS[expected.pct2ptHighlight];

    if (expectedClass) {
      // Should have the highlight class
      await expect(pct2ptCell).toHaveClass(new RegExp(expectedClass));
      console.log(`[AssetHelper] Verified %2PT highlight: ${expected.pct2ptHighlight}`);
    } else {
      // Should NOT have any highlight class (green or yellow)
      await expect(pct2ptCell).not.toHaveClass(/text-green-400/);
      await expect(pct2ptCell).not.toHaveClass(/text-yellow-400/);
      console.log(`[AssetHelper] Verified %2PT has no highlight`);
    }
  }

  console.log("[AssetHelper] Wallet verified successfully.");
}

/**
 * Verify a wallet is NOT present for a given PT tab and price.
 */
export async function verifyWalletNotPresent(
  page: Page,
  ptPercent: string,
  price: string
): Promise<void> {
  console.log(`[AssetHelper] Verifying wallet NOT present: PT=${ptPercent}%, price=${price}...`);

  // Click the PT tab
  await page.locator(`[data-testid="wallet-tab-pt-${ptPercent}"]`).click();

  // Wait for tab to be active
  await page.waitForTimeout(300);

  // Find wallet row by data-testid pattern and filter by price - should not exist
  const walletRows = page.locator('tr[data-testid^="wallet-row-"]');
  const matchingRow = walletRows.filter({ hasText: price });

  const count = await matchingRow.count();
  if (count > 0) {
    throw new Error(`Expected no wallet with price=${price} in PT+${ptPercent}%, but found ${count}`);
  }

  console.log("[AssetHelper] Wallet confirmed NOT present.");
}

/**
 * Verify the overview section values.
 */
export async function verifyOverview(
  page: Page,
  expected: OverviewExpected
): Promise<void> {
  console.log(`[AssetHelper] Verifying overview: totalShares=${expected.totalShares}...`);

  // Verify total shares
  const totalSharesEl = page.locator('[data-testid="overview-total-shares"]');
  await expect(totalSharesEl).toHaveText(expected.totalShares);

  // Verify PT shares
  for (const ptShares of expected.ptShares) {
    const ptSharesEl = page.locator(`[data-testid="overview-pt-shares-${ptShares.ptPercent}"]`);
    await expect(ptSharesEl).toContainText(ptShares.shares);
  }

  console.log("[AssetHelper] Overview verified successfully.");
}

// ============================================================================
// Wallet ID Verification Helpers
// ============================================================================

/**
 * Toggle the Wallet ID column visibility in the Wallets table.
 * Call this from the transactions page.
 * @param visible - true to show the column, false to hide it
 */
export async function toggleWalletIdColumn(
  page: Page,
  visible: boolean
): Promise<void> {
  console.log(`[AssetHelper] Toggling Wallet ID column visibility to ${visible}...`);

  const checkbox = page.locator('[data-testid="column-toggle-walletId"]');
  const isCurrentlyChecked = await checkbox.isChecked();

  if (isCurrentlyChecked !== visible) {
    await checkbox.click();
    await page.waitForTimeout(300);
  }

  console.log("[AssetHelper] Wallet ID column visibility toggled.");
}

/**
 * Get the wallet ID from the Wallets table for a given PT and price.
 * Call this from the transactions page with the Wallet ID column visible.
 * @param ptPercent - The PT tab to look in
 * @param price - The price of the wallet (formatted, e.g., "$100.00")
 * @returns The short wallet ID (first 8 characters)
 */
export async function getWalletIdFromTable(
  page: Page,
  ptPercent: string,
  price: string
): Promise<string> {
  console.log(`[AssetHelper] Getting wallet ID for PT=${ptPercent}%, price=${price}...`);

  // Click the PT tab
  await page.locator(`[data-testid="wallet-tab-pt-${ptPercent}"]`).click();
  await page.waitForTimeout(300);

  // Find the wallet row by data-testid pattern and filter by price
  const walletRows = page.locator('tr[data-testid^="wallet-row-"]');
  const matchingRow = walletRows.filter({ hasText: price }).first();

  // Get the wallet ID from the data-testid attribute of the row
  const rowTestId = await matchingRow.getAttribute("data-testid");
  if (!rowTestId) {
    throw new Error(`No wallet row found for PT=${ptPercent}%, price=${price}`);
  }

  // Extract wallet ID from data-testid="wallet-row-{fullWalletId}"
  const fullWalletId = rowTestId.replace("wallet-row-", "");
  // Return the short wallet ID (first 8 characters) to match what's displayed
  const shortWalletId = fullWalletId.substring(0, 8);
  console.log(`[AssetHelper] Found wallet ID: ${shortWalletId}`);

  return shortWalletId;
}

/**
 * Verify that a BUY transaction's wallet allocation for a given PT matches the expected wallet ID.
 * Call this from the transactions page with the Wallet column visible.
 * @param buyTxnTarget - The BUY transaction to check (identified by signal, price, investment)
 * @param ptPercent - The PT percentage to check the allocation for
 * @param expectedWalletId - The expected wallet ID (short, 8 chars)
 */
export async function verifyBuyTransactionWalletAllocation(
  page: Page,
  buyTxnTarget: EditTransactionTarget,
  ptPercent: string,
  expectedWalletId: string
): Promise<void> {
  console.log(`[AssetHelper] Verifying BUY transaction wallet allocation: PT=${ptPercent}%, expectedWalletId=${expectedWalletId}...`);

  // Find the BUY transaction row
  const row = await findTransactionRow(page, buyTxnTarget.price, buyTxnTarget.signal, buyTxnTarget.investment);

  // Look for the wallet allocation element with the expected PT and wallet ID
  const expectedTestId = `txn-wallet-pt-${ptPercent}-${expectedWalletId}`;
  const walletAllocation = row.locator(`[data-testid="${expectedTestId}"]`);

  const count = await walletAllocation.count();
  if (count === 0) {
    // Get all wallet allocations for debugging
    const allAllocations = row.locator('[data-testid^="txn-wallet-pt-"]');
    const allocCount = await allAllocations.count();
    const allocTestIds: string[] = [];
    for (let i = 0; i < allocCount; i++) {
      const tid = await allAllocations.nth(i).getAttribute("data-testid");
      if (tid) allocTestIds.push(tid);
    }
    throw new Error(
      `No wallet allocation found with PT=${ptPercent}% and walletId=${expectedWalletId}. ` +
      `Found allocations: ${allocTestIds.join(", ")}`
    );
  }

  console.log(`[AssetHelper] Verified BUY transaction wallet allocation: PT=${ptPercent}% -> ${expectedWalletId}`);
}

/**
 * Toggle the Wallet column visibility in the Transactions table.
 * Call this from the transactions page.
 * @param visible - true to show the column, false to hide it
 */
export async function toggleTransactionWalletColumn(
  page: Page,
  visible: boolean
): Promise<void> {
  console.log(`[AssetHelper] Toggling Transaction Wallet column visibility to ${visible}...`);

  const checkbox = page.locator('[data-testid="column-toggle-wallet"]');
  const isCurrentlyChecked = await checkbox.isChecked();

  if (isCurrentlyChecked !== visible) {
    await checkbox.click();
    await page.waitForTimeout(300);
  }

  console.log("[AssetHelper] Transaction Wallet column visibility toggled.");
}

// ============================================================================
// Dashboard Verification Helpers
// ============================================================================

export interface DashboardExpectedRow {
  symbol: string;
  pct2pt: string;
  pct2ptHighlight: "green" | "yellow" | "none";
}

/**
 * Navigate to the Dashboard page.
 */
export async function navigateToDashboard(page: Page): Promise<void> {
  console.log("[AssetHelper] Navigating to Dashboard...");

  await page.locator('[data-testid="nav-dashboard"]').click();
  await waitForDashboardToLoad(page);

  console.log("[AssetHelper] Dashboard navigation complete.");
}

/**
 * Wait for Dashboard to load (loading indicator disappears).
 */
export async function waitForDashboardToLoad(page: Page): Promise<void> {
  console.log("[AssetHelper] Waiting for Dashboard to load...");

  // Wait for loading text to disappear or table to appear
  await page.waitForSelector('text="Loading dashboard..."', { state: "hidden", timeout: 15000 }).catch(() => {
    // If loading text was never shown, that's fine
  });

  // Wait for the dashboard table to be visible
  await page.waitForSelector('table', { state: "visible", timeout: 15000 });

  console.log("[AssetHelper] Dashboard loaded.");
}

/**
 * Verify Dashboard row values and %2PT highlight color.
 * The asset must be ACTIVE to appear on Dashboard.
 */
export async function verifyDashboardRow(
  page: Page,
  expected: DashboardExpectedRow
): Promise<void> {
  console.log(`[AssetHelper] Verifying Dashboard row for ${expected.symbol}...`);

  // Find the row by data-testid (use first() in case of duplicates from failed tests)
  const row = page.locator(`[data-testid="dashboard-row-${expected.symbol}"]`).first();
  await expect(row).toBeVisible({ timeout: 10000 });

  // Find the %2PT cell (use first() in case of duplicates)
  const pct2ptCell = page.locator(`[data-testid="dashboard-pct2pt-${expected.symbol}"]`).first();
  await expect(pct2ptCell).toHaveText(expected.pct2pt);

  // Verify highlight color
  const expectedClass = HIGHLIGHT_COLORS[expected.pct2ptHighlight];
  if (expectedClass) {
    await expect(pct2ptCell).toHaveClass(new RegExp(expectedClass));
    console.log(`[AssetHelper] Verified Dashboard %2PT highlight: ${expected.pct2ptHighlight}`);
  } else {
    // No highlight - should NOT have green or yellow
    await expect(pct2ptCell).not.toHaveClass(/text-green-400/);
    await expect(pct2ptCell).not.toHaveClass(/text-yellow-400/);
    console.log(`[AssetHelper] Verified Dashboard %2PT has no highlight`);
  }

  console.log("[AssetHelper] Dashboard row verified successfully.");
}

// ============================================================================
// Budget Helpers
// ============================================================================

/**
 * Create a budget via the BudgetList component.
 * Call this from the asset edit page.
 */
export async function createBudget(
  page: Page,
  year: string,
  amount: string
): Promise<void> {
  console.log(`[AssetHelper] Creating budget: year=${year}, amount=${amount}...`);

  // Click Add button to show the form
  await page.locator('[data-testid="budget-add-btn"]').click();

  // Wait for the new row form to appear
  await expect(page.locator('[data-testid="budget-new-row"]')).toBeVisible({ timeout: 5000 });

  // Fill year
  await page.locator('[data-testid="budget-new-year"]').clear();
  await page.locator('[data-testid="budget-new-year"]').fill(year);

  // Fill amount
  await page.locator('[data-testid="budget-new-amount"]').fill(amount);

  // Submit
  await page.locator('[data-testid="budget-new-submit"]').click();

  // Wait for form to close (indicates save completed)
  await expect(page.locator('[data-testid="budget-new-row"]')).not.toBeVisible({ timeout: 10000 });

  // Wait for the budget row to appear
  await expect(page.locator(`[data-testid="budget-row-${year}"]`)).toBeVisible({ timeout: 5000 });

  console.log("[AssetHelper] Budget created successfully.");
}

// ============================================================================
// Financial Overview Helpers (ROI Test)
// ============================================================================

/**
 * Verify the financial overview values (OOP, Market Value, ROI, Available).
 * Call this from the transactions page.
 */
export async function verifyFinancialOverview(
  page: Page,
  expected: FinancialOverviewExpected
): Promise<void> {
  console.log(`[AssetHelper] Verifying financial overview...`);

  // Verify OOP
  const oopEl = page.locator('[data-testid="overview-oop"]');
  await expect(oopEl).toHaveText(expected.oop);
  console.log(`[AssetHelper] OOP verified: ${expected.oop}`);

  // Verify Market Value
  const marketValueEl = page.locator('[data-testid="overview-market-value"]');
  await expect(marketValueEl).toHaveText(expected.marketValue);
  console.log(`[AssetHelper] Market Value verified: ${expected.marketValue}`);

  // Verify ROI
  const roiEl = page.locator('[data-testid="overview-roi"]');
  await expect(roiEl).toHaveText(expected.roi);
  console.log(`[AssetHelper] ROI verified: ${expected.roi}`);

  // Verify Available
  const availableEl = page.locator('[data-testid="overview-available"]');
  await expect(availableEl).toHaveText(expected.available);
  console.log(`[AssetHelper] Available verified: ${expected.available}`);

  console.log("[AssetHelper] Financial overview verified successfully.");
}

/**
 * Verify the Available value in the Dashboard for a specific asset.
 * Call this from the Dashboard page.
 */
export async function verifyDashboardAvailable(
  page: Page,
  symbol: string,
  expectedAvailable: string
): Promise<void> {
  console.log(`[AssetHelper] Verifying Dashboard Available for ${symbol}...`);

  // Find the Available cell by data-testid
  const availableCell = page.locator(`[data-testid="dashboard-available-${symbol}"]`).first();
  await expect(availableCell).toHaveText(expectedAvailable);

  console.log(`[AssetHelper] Dashboard Available verified: ${expectedAvailable}`);
}

// ============================================================================
// Dividend/SLP Transaction Helpers
// ============================================================================

/**
 * Create a Dividend or SLP transaction via the TransactionModal.
 * Call this from the transactions page.
 */
export async function createDividendSlpTransaction(
  page: Page,
  input: DividendSlpInput
): Promise<void> {
  console.log(`[AssetHelper] Creating ${input.type} transaction: amount=${input.amount}...`);

  // Click New Transaction button
  await page.locator('[data-testid="btn-new-transaction"]').click();

  // Wait for modal to appear
  await expect(page.locator('[data-testid="transaction-form-type"]')).toBeVisible({ timeout: 5000 });

  // Select type (DIVIDEND or SLP)
  await page.locator('[data-testid="transaction-form-type"]').selectOption(input.type);

  // Fill amount
  await page.locator('[data-testid="transaction-form-amount"]').fill(input.amount);

  // Submit
  await page.locator('[data-testid="transaction-form-submit"]').click();

  // Wait for modal to close
  await expect(page.locator('[data-testid="transaction-form-type"]')).not.toBeVisible({ timeout: 10000 });

  console.log(`[AssetHelper] ${input.type} transaction created successfully.`);
}
