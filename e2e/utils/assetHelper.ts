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
} from "./jsonHelper";

// Re-export types for convenience
export type { AssetCreateInput, TargetInput, TargetExpected, TransactionInput, TransactionExpected, WalletExpected, OverviewExpected, EditTransactionTarget, SellTransactionInput, SellTransactionExpected, EditSellTransactionTarget };

// ============================================================================
// Highlight Color Constants (Tailwind CSS classes used in UI)
// ============================================================================

export const HIGHLIGHT_COLORS = {
  green: "text-green-400",  // Positive %2PT highlight
  none: "",                 // No highlight (negative %2PT)
} as const;

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
}

/**
 * High-level helper to set up a test asset with optional targets.
 * This performs the common setup sequence:
 * 1. Navigate to Assets page
 * 2. Cleanup existing test asset if it exists
 * 3. Create the asset
 * 4. Create entry targets (if provided)
 * 5. Create profit targets (if provided)
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

  // Type should already be BUY (default), but ensure it
  await page.locator('[data-testid="transaction-form-type"]').selectOption("BUY");

  // Fill signal
  await page.locator('[data-testid="transaction-form-signal"]').selectOption(input.signal);

  // Fill price
  await page.locator('[data-testid="transaction-form-price"]').fill(input.price);

  // Fill investment
  await page.locator('[data-testid="transaction-form-investment"]').fill(input.investment);

  // Wait for PT allocation inputs to appear (they appear after price+investment are filled)
  await page.waitForTimeout(500);

  // Fill PT allocations
  for (const alloc of input.allocations) {
    const allocInput = page.locator(`[data-testid="transaction-pt-alloc-${alloc.ptPercent}"]`);
    await allocInput.fill(alloc.percentage);
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

  // Update signal
  await page.locator('[data-testid="transaction-form-signal"]').selectOption(input.signal);

  // Clear and update price
  await page.locator('[data-testid="transaction-form-price"]').clear();
  await page.locator('[data-testid="transaction-form-price"]').fill(input.price);

  // Clear and update investment
  await page.locator('[data-testid="transaction-form-investment"]').clear();
  await page.locator('[data-testid="transaction-form-investment"]').fill(input.investment);

  // Wait for PT allocation inputs to update
  await page.waitForTimeout(500);

  // Update PT allocations
  for (const alloc of input.allocations) {
    const allocInput = page.locator(`[data-testid="transaction-pt-alloc-${alloc.ptPercent}"]`);
    await allocInput.clear();
    await allocInput.fill(alloc.percentage);
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

  // Find rows that match the criteria
  const row = page.locator("tr")
    .filter({ hasText: target.price })
    .filter({ hasText: target.signal })
    .filter({ hasText: target.investment });

  const count = await row.count();
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

  // Find a tr that contains all three values
  const row = page.locator("tr").filter({ hasText: price }).filter({ hasText: signal }).filter({ hasText: investment });

  // Ensure we found exactly one
  const count = await row.count();
  if (count === 0) {
    throw new Error(`No transaction row found with price=${price}, signal=${signal}, investment=${investment}`);
  }
  if (count > 1) {
    console.warn(`[AssetHelper] Found ${count} matching rows, using first one`);
  }

  return row.first();
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

  // Find a tr that contains all three values
  const row = page.locator("tr").filter({ hasText: price }).filter({ hasText: signal }).filter({ hasText: amount });

  // Ensure we found exactly one
  const count = await row.count();
  if (count === 0) {
    throw new Error(`No SELL transaction row found with price=${price}, signal=${signal}, amount=${amount}`);
  }
  if (count > 1) {
    console.warn(`[AssetHelper] Found ${count} matching rows, using first one`);
  }

  return row.first();
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

  // Find the wallet row by price and click its Sell button
  const walletSection = page.locator('[data-testid="wallet-tabs"]').locator("..");
  const walletRow = walletSection.locator("tr").filter({ hasText: walletPrice });

  const sellButton = walletRow.locator('text=Sell');
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

  // Find rows that match the criteria
  const row = page.locator("tr")
    .filter({ hasText: target.price })
    .filter({ hasText: target.signal })
    .filter({ hasText: target.amount });

  const count = await row.count();
  if (count > 0) {
    throw new Error(`Expected no SELL transaction with price=${target.price}, signal=${target.signal}, amount=${target.amount}, but found ${count}`);
  }

  console.log("[AssetHelper] SELL transaction confirmed NOT present.");
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

  // Find wallet row by price and shares
  // The wallet table is within the wallets section
  const walletSection = page.locator('[data-testid="wallet-tabs"]').locator("..");
  const row = walletSection.locator("tr").filter({ hasText: price }).filter({ hasText: shares });

  const count = await row.count();
  if (count === 0) {
    throw new Error(`No wallet row found with price=${price}, shares=${shares} in PT+${ptPercent}%`);
  }

  return row.first();
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
      // Should NOT have any highlight class (green)
      await expect(pct2ptCell).not.toHaveClass(/text-green-400/);
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

  // Find wallet row by price - should not exist
  const walletSection = page.locator('[data-testid="wallet-tabs"]').locator("..");
  const row = walletSection.locator("tr").filter({ hasText: price });

  const count = await row.count();
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
