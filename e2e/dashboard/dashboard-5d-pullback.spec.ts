// e2e/dashboard/dashboard-5d-pullback.spec.ts
//
// This Playwright test verifies 5D Pullback calculation with simulated historical closes.
// All test input/output values are loaded from dashboard-5d-pullback.json

import { test, expect } from "@playwright/test";
import { loginUser, clearBrowserState } from "../utils/auth";
import { loadFiveDPullbackTestData } from "../utils/jsonHelper";
import {
  navigateToAssetsPage,
  navigateToAssetEditPage,
  cleanupTestAssetViaUI,
  createAssetViaUI,
  createTarget,
  updateTestPriceAndHistoricalCloses,
} from "../utils/assetHelper";

// Set test timeout to 180 seconds
test.setTimeout(180000);

// Load test configuration from JSON
const testConfig = loadFiveDPullbackTestData("e2e/dashboard/dashboard-5d-pullback.json");

// Test Suite
test.describe("Dashboard - 5D Pullback (JSON-driven)", () => {
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

  test(`${testConfig.scenario} - Verify 5D Pullback calculations`, async ({ page }) => {
    console.log(`[${testConfig.scenario}] Starting test...`);
    console.log(`[${testConfig.scenario}] ${testConfig.description}`);

    // Step 1: Navigate and cleanup any existing test asset
    console.log(`[${testConfig.scenario}] Step 1: Navigate and clean up...`);
    await navigateToAssetsPage(page);
    await cleanupTestAssetViaUI(page, testConfig.asset.input.symbol);

    // Step 2: Create the test asset
    console.log(`[${testConfig.scenario}] Step 2: Create test asset...`);
    await createAssetViaUI(page, testConfig.asset.input);

    // Step 3: Create Entry Target (required for 5D Pullback calculation)
    console.log(`[${testConfig.scenario}] Step 3: Create Entry Target...`);
    await createTarget(page, "entry", testConfig.entryTarget.input);

    // Step 4: Run through each scenario
    console.log(`[${testConfig.scenario}] Step 4: Running ${testConfig.scenarios.length} scenarios...`);

    for (let i = 0; i < testConfig.scenarios.length; i++) {
      const scenario = testConfig.scenarios[i];
      console.log(`[${testConfig.scenario}] === Scenario ${i + 1}/${testConfig.scenarios.length}: ${scenario.name} ===`);

      // Navigate to edit page if not already there
      if (i > 0) {
        // From Dashboard, go to Assets page, then to edit page
        await navigateToAssetsPage(page);
        await navigateToAssetEditPage(page, testConfig.asset.input.symbol);
      }

      // Update test price and historical closes together (single form submission)
      const historicalClosesJson = JSON.stringify(scenario.testHistoricalCloses);
      console.log(`[${testConfig.scenario}] Setting test price to ${scenario.testPrice} and testHistoricalCloses...`);
      await updateTestPriceAndHistoricalCloses(page, scenario.testPrice, historicalClosesJson);

      // Navigate to Dashboard with a hard refresh to clear any cached data
      console.log(`[${testConfig.scenario}] Navigating to Dashboard...`);
      await page.goto("/dashboard");
      await expect(page).toHaveURL(/\/dashboard$/);
      // Hard refresh to ensure fresh data is loaded
      await page.reload();
      await page.waitForTimeout(1500); // Wait for data to load

      // Verify 5D Pullback value
      const symbol = testConfig.asset.input.symbol;
      const expectedValue = scenario.expected.fiveDPullback;
      console.log(`[${testConfig.scenario}] Verifying 5D Pullback for ${symbol}: expecting ${expectedValue}...`);

      const fiveDPullbackCell = page.locator(`[data-testid="dashboard-5d-pullback-${symbol}"]`);
      await expect(fiveDPullbackCell).toBeVisible({ timeout: 10000 });
      await expect(fiveDPullbackCell).toHaveText(expectedValue);

      console.log(`[${testConfig.scenario}] Scenario "${scenario.name}" verified successfully.`);
    }

    // Cleanup
    console.log(`[${testConfig.scenario}] Cleaning up...`);
    await navigateToAssetsPage(page);
    await cleanupTestAssetViaUI(page, testConfig.asset.input.symbol);

    console.log(`[${testConfig.scenario}] Test completed successfully!`);
  });
});
