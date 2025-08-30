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
import { clearBrowserState, loginUser } from '../utils/pageHelpers';

// Import the JSON helper
import { 
    loadPortfolioCreateEditTestData,
    PortfolioCreateEditTestConfig
} from '../utils/jsonHelper';

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
    const portfolioLink = page.locator('nav a:has-text("Portfolio")');
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
        'stockTrend',
        'currentPrice',
        'pdp',
        'htp',
        'plr',
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

// Helper function to create stock via UI
async function createStockViaUI(page: any, stockData: PortfolioCreateEditTestConfig['initialStock']) {
    console.log('[PageHelper] Creating stock via UI...');
    
    // Click add stock button
    const addStockButton = page.locator('[data-testid="portfolio-page-add-stock-button"]');
    await expect(addStockButton).toBeVisible({ timeout: 10000 });
    await addStockButton.click();
    
    // Wait for symbol field to be visible (indicating modal is ready)
    const symbolField = page.locator('#symbol');
    await expect(symbolField).toBeVisible({ timeout: 10000 });
    
    // Fill form fields
    await page.locator('#symbol').fill(stockData.symbol);
    await page.locator('#type').selectOption(stockData.stockType);
    await page.locator('#region').selectOption(stockData.region);
    if (stockData.stockTrend) {
        await page.locator('#stockTrend').selectOption(stockData.stockTrend);
    }
    await page.locator('#name').fill(stockData.name);
    await page.locator('#pdp').fill(stockData.pdp.toString());
    await page.locator('#plr').fill(stockData.plr.toString());
    await page.locator('#shr').fill(stockData.swingHoldRatio.toString());
    await page.locator('#budget').fill(stockData.budget.toString());
    await page.locator('#commission').fill(stockData.stockCommission.toString());
    await page.locator('#htp').fill(stockData.htp!.toString());
    
    // Submit form
    const submitButton = page.locator('button[type="submit"]:has-text("Add Stock")');
    await submitButton.click();
    
    // Wait for modal to close by checking symbol field is no longer visible
    await expect(symbolField).not.toBeVisible({ timeout: 15000 });
    
    console.log('[PageHelper] Stock created via UI.');
}

// Helper function to verify stock values in table
async function verifyStockInTable(page: any, stockData: PortfolioCreateEditTestConfig['initialStock']) {
    console.log('[PageHelper] Verifying stock values in table...');
    
    const symbol = stockData.symbol.toUpperCase();
    
    // Verify symbol link (use first() to handle potential duplicates)
    const symbolLink = page.locator(`[data-testid="portfolio-page-table-wallet-link-${symbol}"]`).first();
    await expect(symbolLink).toBeVisible({ timeout: 10000 });
    await expect(symbolLink).toHaveText(symbol);
    
    // Verify name
    const nameCell = page.locator(`[data-testid="portfolio-page-table-name-${symbol}"]`).first();
    await expect(nameCell).toBeVisible();
    await expect(nameCell).toHaveText(stockData.name);
    
    // Verify type
    const typeCell = page.locator(`[data-testid="portfolio-page-table-type-${symbol}"]`).first();
    await expect(typeCell).toBeVisible();
    await expect(typeCell).toHaveText(stockData.stockType);
    
    // Verify region
    const regionCell = page.locator(`[data-testid="portfolio-page-table-region-${symbol}"]`).first();
    await expect(regionCell).toBeVisible();
    await expect(regionCell).toHaveText(stockData.region);
    
    // Verify trend
    const trendCell = page.locator(`[data-testid="portfolio-page-table-stockTrend-${symbol}"]`).first();
    await expect(trendCell).toBeVisible();
    await expect(trendCell).toHaveText(stockData.stockTrend || '-');
    
    // Verify PDP
    const pdpCell = page.locator(`[data-testid="portfolio-page-table-pdp-${symbol}"]`).first();
    await expect(pdpCell).toBeVisible();
    await expect(pdpCell).toHaveText(stockData.pdp.toString());
    
    // Verify HTP
    const htpCell = page.locator(`[data-testid="portfolio-page-table-htp-${symbol}"]`).first();
    await expect(htpCell).toBeVisible();
    await expect(htpCell).toHaveText(stockData.htp!.toString());
    
    // Verify PLR
    const plrCell = page.locator(`[data-testid="portfolio-page-table-plr-${symbol}"]`).first();
    await expect(plrCell).toBeVisible();
    await expect(plrCell).toHaveText(stockData.plr.toString());
    
    // Verify commission
    const commissionCell = page.locator(`[data-testid="portfolio-page-table-stockCommission-${symbol}"]`).first();
    await expect(commissionCell).toBeVisible();
    await expect(commissionCell).toHaveText(stockData.stockCommission.toString());
    
    // Verify budget
    const budgetCell = page.locator(`[data-testid="portfolio-page-table-budget-${symbol}"]`).first();
    await expect(budgetCell).toBeVisible();
    await expect(budgetCell).toHaveText(formatCurrency(stockData.budget));
    
    console.log('[PageHelper] Stock values verified in table.');
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
    await expect(page.locator('#symbol')).toBeVisible({ timeout: 10000 });
    
    // Verify prefilled values
    await expect(page.locator('#symbol')).toHaveValue(stockData.symbol.toUpperCase());
    await expect(page.locator('#type')).toHaveValue(stockData.stockType);
    await expect(page.locator('#region')).toHaveValue(stockData.region);
    if (stockData.stockTrend) {
        await expect(page.locator('#stockTrend')).toHaveValue(stockData.stockTrend);
    }
    await expect(page.locator('#name')).toHaveValue(stockData.name);
    await expect(page.locator('#pdp')).toHaveValue(stockData.pdp.toString());
    await expect(page.locator('#plr')).toHaveValue(stockData.plr.toString());
    await expect(page.locator('#shr')).toHaveValue(stockData.swingHoldRatio.toString());
    await expect(page.locator('#budget')).toHaveValue(stockData.budget.toString());
    await expect(page.locator('#commission')).toHaveValue(stockData.stockCommission.toString());
    await expect(page.locator('#htp')).toHaveValue(stockData.htp!.toString());
    
    console.log('[PageHelper] Edit modal prefilled values verified.');
}

// Helper function to edit stock values
async function editStockValues(page: any, editData: PortfolioCreateEditTestConfig['editedStock']) {
    console.log('[PageHelper] Editing stock values...');
    
    // Update form fields with new values
    await page.locator('#type').selectOption(editData.stockType);
    await page.locator('#region').selectOption(editData.region);
    if (editData.stockTrend) {
        await page.locator('#stockTrend').selectOption(editData.stockTrend);
    }
    await page.locator('#pdp').fill(editData.pdp.toString());
    await page.locator('#plr').fill(editData.plr.toString());
    await page.locator('#shr').fill(editData.swingHoldRatio.toString());
    await page.locator('#budget').fill(editData.budget.toString());
    await page.locator('#commission').fill(editData.stockCommission.toString());
    await page.locator('#htp').fill(editData.htp!.toString());
    
    // Submit form
    const submitButton = page.locator('button[type="submit"]:has-text("Update")');
    await submitButton.click();
    
    // Wait for modal to close by checking form fields are no longer visible
    await expect(page.locator('#symbol')).not.toBeVisible({ timeout: 15000 });
    
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
    
    // Verify PLR
    const plrCell = page.locator(`[data-testid="portfolio-page-table-plr-${symbol}"]`).first();
    await expect(plrCell).toBeVisible();
    await expect(plrCell).toHaveText(editData.plr.toString());
    
    // Verify commission
    const commissionCell = page.locator(`[data-testid="portfolio-page-table-stockCommission-${symbol}"]`).first();
    await expect(commissionCell).toBeVisible();
    await expect(commissionCell).toHaveText(editData.stockCommission.toString());
    
    // Verify budget
    const budgetCell = page.locator(`[data-testid="portfolio-page-table-budget-${symbol}"]`).first();
    await expect(budgetCell).toBeVisible();
    await expect(budgetCell).toHaveText(formatCurrency(editData.budget));
    
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
        await createStockViaUI(page, testConfig.initialStock);

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
