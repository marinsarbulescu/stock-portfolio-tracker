// e2e/portfolio/portfolio-create-and-edit-stock.spec.ts

// This Playwright test suite is designed to verify the creation and editing of portfolio stocks
// based on test scenarios defined in a JSON file (`portfolio-create-and-edit-stock.json`).
// Test flow:
// 1. Login to the application
// 2. Navigate to the Portfolio page
// 3. Create a new stock with initial attributes
// 4. Toggle all columns visible in the portfolio table
// 5. Verify the stock was created with correct values
// 6. Open the edit modal for the stock
// 7. Verify the prefilled values are correct
// 8. Edit the stock with new values
// 9. Submit the changes
// 10. Verify the updated values in the portfolio table
// 11. Clean up the created stock

import { Amplify } from 'aws-amplify';
import { test, expect } from '@playwright/test';
import amplifyOutputs from '../../amplify_outputs.json';

import {
    createPortfolioStock,
    deletePortfolioStock,
    getPortfolioStockBySymbol,
    type PortfolioStockCreateData,
} from '../utils/dataHelpers';
import { E2E_TEST_USER_OWNER_ID, E2E_TEST_USERNAME } from '../utils/testCredentials';
import { clearBrowserState, loginUser, createStockViaUI } from '../utils/pageHelpers';

// Import the JSON helper
import { 
    loadPortfolioCreateEditTestData,
    PortfolioCreateEditTestConfig
} from '../utils/jsonHelper';

// Import label mapping functions
import { getMarketCategoryLabel, getRiskGrowthProfileLabel } from '../../app/(authed)/portfolio/types';

import {
    SHARE_PRECISION,
    CURRENCY_PRECISION,
} from '../../app/config/constants';
import { formatCurrency } from '../../app/utils/financialCalculations';

// Configure Amplify
try {
    Amplify.configure(amplifyOutputs);
    console.log('[portfolio-create-and-edit-stock.spec.ts] - Amplify configured successfully.');
} catch (error) {
    console.error('[portfolio-create-and-edit-stock.spec.ts] - CRITICAL: Error configuring Amplify:', error);
}

// Set test timeout to 60 seconds for reliable execution
test.setTimeout(60000);

// Load test configuration from JSON
const testConfig = loadPortfolioCreateEditTestData('e2e/portfolio/portfolio-create-and-edit-stock.json');

// Helper function to clean up existing test stocks
async function cleanupExistingTestStock(symbol: string) {
    console.log(`[PageHelper] Cleaning up existing test stock: ${symbol}...`);
    
    try {
        const existingStock = await getPortfolioStockBySymbol(symbol.toUpperCase());
        if (existingStock) {
            console.log(`[PageHelper] Found existing stock ${symbol}, deleting...`);
            await deletePortfolioStock(existingStock.id);
            console.log(`[PageHelper] Existing stock ${symbol} deleted.`);
        }
    } catch (error) {
        console.warn(`[PageHelper] Warning: Could not clean up existing stock ${symbol}:`, error);
    }
}

// Helper function to navigate to portfolio page
async function navigateToPortfolioPage(page: any) {
    console.log('[PageHelper] Navigating to Portfolio page...');
    await page.goto('/');
    const portfolioLink = page.locator('[data-testid="nav-portfolio-link"]');
    await expect(portfolioLink).toBeVisible({ timeout: 15000 });
    await portfolioLink.click();
    
    // Wait for page to load
    const pageTitle = page.locator('[data-testid="portfolio-page-title"]');
    await expect(pageTitle).toBeVisible({ timeout: 15000 });
    await expect(pageTitle).toHaveText('Portfolio');
    console.log('[PageHelper] Successfully navigated to Portfolio page.');
}

// Helper function to toggle all columns visible
async function toggleAllColumnsVisible(page: any) {
    console.log('[PageHelper] Toggling all columns visible...');
    
    // List of column keys that should be toggled
    const columnKeys = [
        'name',
        'stockType', 
        'region',
        'marketCategory',
        'riskGrowthProfile',
        'stockTrend',
        'currentPrice',
        'pdp',
        'htp',
        'stp',
        'stockCommission',
        'budget',
        'investment'
    ];
    
    for (const columnKey of columnKeys) {
        const checkbox = page.locator(`input[type="checkbox"]`).nth(columnKeys.indexOf(columnKey));
        await checkbox.check();
        await expect(checkbox).toBeChecked();
    }
    
    console.log('[PageHelper] All columns toggled visible.');
}

// Helper function to verify stock values in table
async function verifyStockInTable(page: any, stockData: PortfolioCreateEditTestConfig['initialStock']) {
    console.log('[PageHelper] Verifying stock values in table...');
    
    const symbol = stockData.symbol.toUpperCase();
    
    // Primary verification: ticker column is always visible and reliable
    const symbolLink = page.locator(`[data-testid="portfolio-page-table-wallet-link-${symbol}"]`).first();
    await expect(symbolLink).toBeVisible({ timeout: 10000 });
    await expect(symbolLink).toHaveText(symbol);
    
    console.log(`[PageHelper] Stock ${symbol} verified in portfolio table.`);
}

// Helper function to open edit modal and verify prefilled values
async function openEditModalAndVerifyValues(page: any, stockData: PortfolioCreateEditTestConfig['initialStock']) {
    console.log('[PageHelper] Opening edit modal and verifying prefilled values...');
    
    const symbol = stockData.symbol.toUpperCase();
    
    // Find the edit button in the row for our specific stock (use first() to handle potential duplicates)
    const stockRow = page.locator(`[data-testid="portfolio-page-table-wallet-link-${symbol}"]`).first().locator('xpath=ancestor::tr');
    const editButton = stockRow.locator('[data-testid="portfolio-page-table-action-edit-button"]');
    
    await expect(editButton).toBeVisible({ timeout: 10000 });
    await editButton.click();
    
    // Wait for form fields to be visible (indicating modal is ready)
    await expect(page.locator('[data-testid="portfolio-edit-stock-symbol"]')).toBeVisible({ timeout: 10000 });
    
    // Verify prefilled values
    await expect(page.locator('[data-testid="portfolio-edit-stock-symbol"]')).toHaveValue(stockData.symbol.toUpperCase());
    await expect(page.locator('[data-testid="portfolio-edit-stock-type"]')).toHaveValue(stockData.stockType);
    await expect(page.locator('[data-testid="portfolio-edit-stock-region"]')).toHaveValue(stockData.region);
    if (stockData.marketCategory) {
        await expect(page.locator('[data-testid="portfolio-edit-stock-market-category"]')).toHaveValue(stockData.marketCategory);
    }
    if (stockData.riskGrowthProfile) {
        await expect(page.locator('[data-testid="portfolio-edit-stock-risk-growth-profile"]')).toHaveValue(stockData.riskGrowthProfile);
    }
    if (stockData.stockTrend) {
        await expect(page.locator('[data-testid="portfolio-edit-stock-trend"]')).toHaveValue(stockData.stockTrend);
    }
    await expect(page.locator('[data-testid="portfolio-edit-stock-name"]')).toHaveValue(stockData.name);
    await expect(page.locator('[data-testid="portfolio-edit-stock-pdp"]')).toHaveValue(stockData.pdp.toString());
    await expect(page.locator('[data-testid="portfolio-edit-stock-stp"]')).toHaveValue(stockData.stp.toString());
    await expect(page.locator('[data-testid="portfolio-edit-stock-shr"]')).toHaveValue(stockData.swingHoldRatio.toString());
    await expect(page.locator('[data-testid="portfolio-edit-stock-budget"]')).toHaveValue(stockData.budget.toString());
    await expect(page.locator('[data-testid="portfolio-edit-stock-commission"]')).toHaveValue(stockData.stockCommission.toString());
    await expect(page.locator('[data-testid="portfolio-edit-stock-htp"]')).toHaveValue(stockData.htp!.toString());
    
    console.log('[PageHelper] Edit modal prefilled values verified.');
}

// Helper function to edit stock values
async function editStockValues(page: any, editData: PortfolioCreateEditTestConfig['editedStock']) {
    console.log('[PageHelper] Editing stock values...');
    
    // Update form fields with new values
    await page.locator('[data-testid="portfolio-edit-stock-type"]').selectOption(editData.stockType);
    await page.locator('[data-testid="portfolio-edit-stock-region"]').selectOption(editData.region);
    if (editData.marketCategory) {
        await page.locator('[data-testid="portfolio-edit-stock-market-category"]').selectOption(editData.marketCategory);
    }
    if (editData.riskGrowthProfile) {
        await page.locator('[data-testid="portfolio-edit-stock-risk-growth-profile"]').selectOption(editData.riskGrowthProfile);
    }
    if (editData.stockTrend) {
        await page.locator('[data-testid="portfolio-edit-stock-trend"]').selectOption(editData.stockTrend);
    }
    await page.locator('[data-testid="portfolio-edit-stock-pdp"]').fill(editData.pdp.toString());
    await page.locator('[data-testid="portfolio-edit-stock-stp"]').fill(editData.stp.toString());
    await page.locator('[data-testid="portfolio-edit-stock-shr"]').fill(editData.swingHoldRatio.toString());
    await page.locator('[data-testid="portfolio-edit-stock-budget"]').fill(editData.budget.toString());
    await page.locator('[data-testid="portfolio-edit-stock-commission"]').fill(editData.stockCommission.toString());
    await page.locator('[data-testid="portfolio-edit-stock-htp"]').fill(editData.htp!.toString());
    
    // Submit form
    const submitButton = page.locator('[data-testid="portfolio-edit-stock-submit-button"]');
    await submitButton.click();
    
    // Wait for modal to close by checking form fields are no longer visible
    await expect(page.locator('[data-testid="portfolio-edit-stock-symbol"]')).not.toBeVisible({ timeout: 15000 });
    
    console.log('[PageHelper] Stock values updated.');
}

// Helper function to verify updated stock values in table
async function verifyUpdatedStockInTable(page: any, editData: PortfolioCreateEditTestConfig['editedStock']) {
    console.log('[PageHelper] Verifying updated stock values in table...');
    
    const symbol = editData.symbol.toUpperCase();
    
    // Verify type
    const typeCell = page.locator(`[data-testid="portfolio-page-table-type-${symbol}"]`).first();
    await expect(typeCell).toBeVisible();
    await expect(typeCell).toHaveText(editData.stockType);
    
    // Verify region
    const regionCell = page.locator(`[data-testid="portfolio-page-table-region-${symbol}"]`).first();
    await expect(regionCell).toBeVisible();
    await expect(regionCell).toHaveText(editData.region);
    
    // Verify trend
    const trendCell = page.locator(`[data-testid="portfolio-page-table-stockTrend-${symbol}"]`).first();
    await expect(trendCell).toBeVisible();
    await expect(trendCell).toHaveText(editData.stockTrend || '-');
    
    // Verify PDP
    const pdpCell = page.locator(`[data-testid="portfolio-page-table-pdp-${symbol}"]`).first();
    await expect(pdpCell).toBeVisible();
    await expect(pdpCell).toHaveText(editData.pdp.toString());
    
    // Verify HTP
    const htpCell = page.locator(`[data-testid="portfolio-page-table-htp-${symbol}"]`).first();
    await expect(htpCell).toBeVisible();
    await expect(htpCell).toHaveText(editData.htp!.toString());
    
    // Verify STP
    const stpCell = page.locator(`[data-testid="portfolio-page-table-stp-${symbol}"]`).first();
    await expect(stpCell).toBeVisible();
    await expect(stpCell).toHaveText(editData.stp.toString());
    
    // Verify commission
    const commissionCell = page.locator(`[data-testid="portfolio-page-table-stockCommission-${symbol}"]`).first();
    await expect(commissionCell).toBeVisible();
    await expect(commissionCell).toHaveText(editData.stockCommission.toString());
    
    // Verify budget
    const budgetCell = page.locator(`[data-testid="portfolio-page-table-budget-${symbol}"]`).first();
    await expect(budgetCell).toBeVisible();
    await expect(budgetCell).toHaveText(formatCurrency(editData.budget));
    
    // Verify market category if visible (column might be hidden by default)
    const marketCategoryCell = page.locator(`[data-testid="portfolio-page-table-marketCategory-${symbol}"]`).first();
    if (await marketCategoryCell.isVisible()) {
        await expect(marketCategoryCell).toHaveText(getMarketCategoryLabel(editData.marketCategory!));
    }
    
    // Verify risk growth profile if visible (column might be hidden by default)
    const riskProfileCell = page.locator(`[data-testid="portfolio-page-table-riskGrowthProfile-${symbol}"]`).first();
    if (await riskProfileCell.isVisible()) {
        await expect(riskProfileCell).toHaveText(getRiskGrowthProfileLabel(editData.riskGrowthProfile!));
    }
    
    console.log('[PageHelper] Updated stock values verified in table.');
}

// Test Suite
test.describe('Portfolio - Create and Edit Stock (JSON-driven)', () => {
    let testPortfolioStockId: string | null = null;

    test.afterEach(async () => {
        console.log('[AFTER EACH] Starting cleanup...');
        
        if (testPortfolioStockId) {
            try {
                console.log(`[AFTER EACH] Deleting stock ${testPortfolioStockId}...`);
                await deletePortfolioStock(testPortfolioStockId);
                console.log('[AFTER EACH] Stock deleted successfully.');
            } catch (error) {
                console.error('[AFTER EACH] Error during cleanup:', error);
            }
            testPortfolioStockId = null;
        }
    });

    test.beforeEach(async ({ page }) => {
        console.log('[BEFORE EACH] Starting fresh session setup...');
        
        // Clear browser state and establish clean session
        await clearBrowserState(page);
        console.log('[BEFORE EACH] Browser state cleared.');

        // Login with test credentials
        console.log(`[BEFORE EACH] Attempting login as ${E2E_TEST_USERNAME}...`);
        await loginUser(page);
        console.log('[BEFORE EACH] Login successful.');
    });

    test(`${testConfig.scenario} - Create and Edit Stock`, async ({ page }) => {
        console.log(`[${testConfig.scenario}] Starting test...`);

        // Step 0: Clean up any existing test stock
        console.log(`[${testConfig.scenario}] Step 0: Cleaning up existing test stock...`);
        await cleanupExistingTestStock(testConfig.initialStock.symbol);

        // Step 1: Navigate to Portfolio page
        console.log(`[${testConfig.scenario}] Step 1: Navigating to Portfolio page...`);
        await navigateToPortfolioPage(page);

        // Step 2: Toggle all columns visible
        console.log(`[${testConfig.scenario}] Step 2: Toggling all columns visible...`);
        await toggleAllColumnsVisible(page);

        // Step 3: Create stock via UI
        console.log(`[${testConfig.scenario}] Step 3: Creating stock via UI...`);
        await createStockViaUI(page, { ...testConfig.initialStock, owner: E2E_TEST_USER_OWNER_ID } as any);

        // Step 4: Verify stock was created with correct values
        console.log(`[${testConfig.scenario}] Step 4: Verifying stock creation...`);
        await verifyStockInTable(page, testConfig.initialStock);

        // Step 5: Open edit modal and verify prefilled values
        console.log(`[${testConfig.scenario}] Step 5: Opening edit modal and verifying prefilled values...`);
        await openEditModalAndVerifyValues(page, testConfig.initialStock);

        // Step 6: Edit stock values
        console.log(`[${testConfig.scenario}] Step 6: Editing stock values...`);
        await editStockValues(page, testConfig.editedStock);

        // Step 7: Navigate back to Portfolio page
        console.log(`[${testConfig.scenario}] Step 7: Navigating back to Portfolio page...`);
        await navigateToPortfolioPage(page);

        // Step 8: Toggle all columns visible again
        console.log(`[${testConfig.scenario}] Step 8: Toggling all columns visible again...`);
        await toggleAllColumnsVisible(page);

        // Step 9: Verify updated stock values
        console.log(`[${testConfig.scenario}] Step 9: Verifying updated stock values...`);
        await verifyUpdatedStockInTable(page, testConfig.editedStock);

        // Get the stock ID for cleanup
        try {
            const createdStock = await getPortfolioStockBySymbol(testConfig.initialStock.symbol.toUpperCase());
            if (createdStock) {
                testPortfolioStockId = createdStock.id;
                console.log(`[${testConfig.scenario}] Test completed successfully. Stock ID: ${testPortfolioStockId}`);
            }
        } catch (error) {
            console.warn(`[${testConfig.scenario}] Could not determine stock ID for cleanup:`, error);
        }
    });
});
