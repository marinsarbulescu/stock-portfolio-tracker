// e2e/assets/asset-split.spec.ts
//
// This Playwright test verifies SPLIT transaction functionality.
// Tests that splits correctly adjust wallet shares and prices.

import { test, expect } from "@playwright/test";
import { loginUser, clearBrowserState } from "../utils/auth";
import {
  setupTestAsset,
  cleanupTestAssetViaUI,
  navigateToTransactionsPage,
  createBuyTransaction,
  verifyWallet,
} from "../utils/assetHelper";

// Set test timeout
test.setTimeout(120000);

test.describe("Stock Split Transactions", () => {
  const ASSET_SYMBOL = "E2E-SPLIT-TEST";

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
      await cleanupTestAssetViaUI(page, ASSET_SYMBOL);
    } catch (error) {
      console.warn("[AFTER EACH] Cleanup failed:", error);
    }
  });

  test("2:1 split doubles shares and halves prices", async ({ page }) => {
    console.log("[SPLIT TEST] Setting up test asset...");

    // Setup asset with one profit target
    await setupTestAsset(page, {
      asset: {
        symbol: ASSET_SYMBOL,
        name: "Split Test Asset",
        type: "STOCK",
        testPrice: "100",
        commission: "0.5",
        status: "ACTIVE",
      },
      entryTargets: [{ name: "ET1", targetPercent: "2", sortOrder: "1" }],
      profitTargets: [{ name: "PT1", targetPercent: "8", allocationPercent: "100", sortOrder: "1" }],
    });

    await navigateToTransactionsPage(page);

    // Create initial BUY transaction: 100 shares @ $10
    console.log("[SPLIT TEST] Creating BUY transaction: 100 shares @ $10...");
    await createBuyTransaction(page, {
      signal: "INITIAL",
      price: "10",
      investment: "1000",
      allocations: [{ ptPercent: "8", percentage: "100" }],
    });

    // Verify initial wallet
    console.log("[SPLIT TEST] Verifying initial wallet...");
    await verifyWallet(page, {
      ptPercent: "8",
      price: "$10.00",
      shares: "100.00000",
      investment: "$1000.00",
    });

    // Create 2:1 SPLIT transaction
    console.log("[SPLIT TEST] Creating 2:1 SPLIT transaction...");
    await page.click('[data-testid="btn-new-transaction"]');
    await page.selectOption('[data-testid="transaction-form-type"]', "SPLIT");
    await page.fill('[data-testid="transaction-form-splitRatio"]', "2");
    await page.click('[data-testid="transaction-form-submit"]');

    // Wait for modal to close
    await expect(page.locator('[data-testid="transaction-form-submit"]')).not.toBeVisible({ timeout: 10000 });

    // Verify wallet after split: should have 200 shares @ $5
    console.log("[SPLIT TEST] Verifying wallet after 2:1 split...");
    await verifyWallet(page, {
      ptPercent: "8",
      price: "$5.00",
      shares: "200.00000",
      investment: "$1000.00",
    });

    console.log("[SPLIT TEST] 2:1 split test passed!");
  });

  test("Split only affects wallets created before split date", async ({ page }) => {
    console.log("[SPLIT TEST] Setting up test asset...");

    await setupTestAsset(page, {
      asset: {
        symbol: ASSET_SYMBOL,
        name: "Split Test Asset",
        type: "STOCK",
        testPrice: "100",
        commission: "0.5",
        status: "ACTIVE",
      },
      entryTargets: [{ name: "ET1", targetPercent: "2", sortOrder: "1" }],
      profitTargets: [{ name: "PT1", targetPercent: "8", allocationPercent: "100", sortOrder: "1" }],
    });

    await navigateToTransactionsPage(page);

    // Create BUY before split: 100 shares @ $10
    console.log("[SPLIT TEST] Creating BUY before split: 100 shares @ $10...");
    await createBuyTransaction(page, {
      signal: "INITIAL",
      price: "10",
      investment: "1000",
      allocations: [{ ptPercent: "8", percentage: "100" }],
    });

    // Create 2:1 SPLIT
    console.log("[SPLIT TEST] Creating 2:1 SPLIT...");
    await page.click('[data-testid="btn-new-transaction"]');
    await page.selectOption('[data-testid="transaction-form-type"]', "SPLIT");
    await page.fill('[data-testid="transaction-form-splitRatio"]', "2");
    await page.click('[data-testid="transaction-form-submit"]');
    await expect(page.locator('[data-testid="transaction-form-submit"]')).not.toBeVisible({ timeout: 10000 });

    // Create BUY after split: 50 shares @ $5 (should NOT be split-adjusted)
    console.log("[SPLIT TEST] Creating BUY after split: 50 shares @ $5...");
    await createBuyTransaction(page, {
      signal: "CUSTOM",
      price: "5",
      investment: "250",
      allocations: [{ ptPercent: "8", percentage: "100" }],
    });

    // Should have combined wallet: 250 shares @ $5 (200 from split + 50 new)
    console.log("[SPLIT TEST] Verifying combined wallet...");
    await verifyWallet(page, {
      ptPercent: "8",
      price: "$5.00",
      shares: "250.00000",
      investment: "$1250.00",
    });

    console.log("[SPLIT TEST] Date-based split test passed!");
  });

  test("Deleting split is prevented if subsequent transactions exist", async ({ page }) => {
    console.log("[SPLIT TEST] Setting up test asset...");

    await setupTestAsset(page, {
      asset: {
        symbol: ASSET_SYMBOL,
        name: "Split Test Asset",
        type: "STOCK",
        testPrice: "100",
        commission: "0.5",
        status: "ACTIVE",
      },
      entryTargets: [{ name: "ET1", targetPercent: "2", sortOrder: "1" }],
      profitTargets: [{ name: "PT1", targetPercent: "8", allocationPercent: "100", sortOrder: "1" }],
    });

    await navigateToTransactionsPage(page);

    // Create BUY, then SPLIT, then another BUY
    await createBuyTransaction(page, {
      signal: "INITIAL",
      price: "10",
      investment: "1000",
      allocations: [{ ptPercent: "8", percentage: "100" }],
    });

    await page.click('[data-testid="btn-new-transaction"]');
    await page.selectOption('[data-testid="transaction-form-type"]', "SPLIT");
    await page.fill('[data-testid="transaction-form-splitRatio"]', "2");
    await page.click('[data-testid="transaction-form-submit"]');
    await expect(page.locator('[data-testid="transaction-form-submit"]')).not.toBeVisible({ timeout: 10000 });

    await createBuyTransaction(page, {
      signal: "CUSTOM",
      price: "5",
      investment: "250",
      allocations: [{ ptPercent: "8", percentage: "100" }],
    });

    // Try to delete the SPLIT - should show error
    console.log("[SPLIT TEST] Attempting to delete SPLIT with subsequent transaction...");

    // Find and click delete button for SPLIT transaction (should be visible in table)
    const splitRow = page.locator('tr').filter({ hasText: '2:1' });
    await splitRow.locator('[data-testid*="delete"]').click();

    // Confirm deletion
    page.once('dialog', dialog => dialog.accept());

    // Should show error message
    await expect(page.locator('text=/Cannot delete.*subsequent transactions/i')).toBeVisible({ timeout: 5000 });

    console.log("[SPLIT TEST] Delete prevention test passed!");
  });
});
