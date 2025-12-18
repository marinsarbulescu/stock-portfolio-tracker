// e2e/utils/assetHelper.ts
//
// Shared helpers for asset-related e2e tests.
// These functions handle common operations like creating, editing, and deleting
// assets and their targets via the UI.

import { expect, Page } from "@playwright/test";
import { AssetCreateInput, TargetInput, TargetExpected } from "./jsonHelper";

// Re-export types for convenience
export type { AssetCreateInput, TargetInput, TargetExpected };

// ============================================================================
// Navigation & Page Helpers
// ============================================================================

/**
 * Wait for the assets table to fully load (loading indicator disappears).
 */
export async function waitForAssetsTableToLoad(page: Page): Promise<void> {
  console.log("[AssetHelper] Waiting for assets table to load...");
  await expect(page.locator('[data-testid="btn-new-asset"]')).toBeVisible({ timeout: 15000 });
  // Check both possible loading indicators
  await expect(page.getByText("Loading assets...")).not.toBeVisible({ timeout: 15000 });
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
    await expect(page).toHaveURL(/\/assets$/);

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

  // Click Add button
  await page.locator(`[data-testid="${type}-target-add-btn"]`).click();
  await expect(page.locator(`[data-testid="${type}-target-new-row"]`)).toBeVisible({ timeout: 5000 });

  // Fill form
  await page.locator(`[data-testid="${type}-target-new-name"]`).fill(input.name);
  await page.locator(`[data-testid="${type}-target-new-percent"]`).fill(input.targetPercent);
  if (type === "profit" && input.allocationPercent) {
    await page.locator(`[data-testid="${type}-target-new-alloc"]`).fill(input.allocationPercent);
  }
  await page.locator(`[data-testid="${type}-target-new-order"]`).clear();
  await page.locator(`[data-testid="${type}-target-new-order"]`).fill(input.sortOrder);

  // Submit
  await page.locator(`[data-testid="${type}-target-new-submit"]`).click();

  // Wait for row to appear
  await expect(page.locator(`[data-testid="${type}-target-row-${input.sortOrder}"]`)).toBeVisible({ timeout: 5000 });
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
