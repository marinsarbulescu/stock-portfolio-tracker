// e2e/portfolio/signals-price-fetch.spec.ts

// This Playwright test suite verifies the signals page price fetching functionality:
// 1. Creates AAPL and BTC-USD stocks
// 2. Navigates to Signals page
// 3. Toggles on the Price column visibility
// 4. Verifies stocks don't have existing price values (shows '-')
// 5. Fetches prices using the "Fetch Prices" button
// 6. Verifies that price values are now displayed
// 7. Cleans up by deleting the created stocks

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

// Configure Amplify
try {
    Amplify.configure(amplifyOutputs);
    console.log('[signals-price-fetch.spec.ts] - Amplify configured successfully.');
} catch (error) {
    console.error('[signals-price-fetch.spec.ts] - CRITICAL: Error configuring Amplify:', error);
}

// Define test data type
interface SignalsPriceFetchTestConfig {
    scenario: string;
    stocks: PortfolioStockCreateData[];
}

// Load test data
const testData: SignalsPriceFetchTestConfig = require('./signals-price-fetch.json');

// Helper function to navigate to signals page
async function navigateToSignalsPage(page: any) {
    console.log('[PageHelper] Navigating to Signals page...');
    await page.goto('/');
    const signalsLink = page.locator('nav a:has-text("Home")'); // "Home" link goes to signals
    await expect(signalsLink).toBeVisible({ timeout: 15000 });
    await signalsLink.click();
    
    // Wait for signals page to load
    await expect(page.locator('h2:has-text("Signals")')).toBeVisible({ timeout: 15000 });
    console.log('[PageHelper] Successfully navigated to Signals page.');
}

// Helper function to toggle Price column visibility
async function togglePriceColumnVisible(page: any) {
    console.log('[PageHelper] Toggling Price column visible...');
    
    // Look for the checkbox next to the "Price" label in the column visibility controls
    const priceLabel = page.locator('label:has-text("Price")');
    await expect(priceLabel).toBeVisible({ timeout: 10000 });
    
    const priceCheckbox = priceLabel.locator('input[type="checkbox"]');
    
    // Check if checkbox is currently checked
    const isChecked = await priceCheckbox.isChecked();
    if (!isChecked) {
        await priceCheckbox.click();
        console.log('[PageHelper] Price column checkbox checked.');
    } else {
        console.log('[PageHelper] Price column was already visible.');
    }
    
    // Verify Price column header is now visible in the table
    await expect(page.locator('th:has-text("Price")')).toBeVisible({ timeout: 10000 });
    console.log('[PageHelper] Price column is now visible in the table.');
}

// Helper function to verify stock has no price value
async function verifyStockHasNoPrice(page: any, stockSymbol: string) {
    console.log(`[PageHelper] Verifying ${stockSymbol} has no price value...`);
    
    // Find the row for this stock symbol
    const stockRow = page.locator(`tr:has(td:has-text("${stockSymbol}"))`);
    await expect(stockRow).toBeVisible({ timeout: 10000 });
    
    // Find the price cell in this row (assuming Price is one of the columns)
    const priceCell = stockRow.locator('td').nth(await getPriceCellIndex(page));
    
    // Verify it shows '-' or empty
    const priceCellText = await priceCell.textContent();
    expect(priceCellText?.trim()).toMatch(/^-$|^$|^N\/A$/);
    console.log(`[PageHelper] ✅ Confirmed ${stockSymbol} has no price value (shows '${priceCellText?.trim()}')`);
}

// Helper function to get the index of the Price column
async function getPriceCellIndex(page: any): Promise<number> {
    const headers = await page.locator('th').allTextContents();
    const priceIndex = headers.findIndex((header: string) => header.includes('Price'));
    if (priceIndex === -1) {
        throw new Error('Price column not found in table headers');
    }
    return priceIndex;
}

// Helper function to click Fetch Prices button and wait for completion
async function fetchPricesAndWait(page: any) {
    console.log('[PageHelper] Clicking Fetch Prices button...');
    
    const fetchButton = page.locator('button:has-text("Fetch Prices")');
    await expect(fetchButton).toBeVisible({ timeout: 10000 });
    await expect(fetchButton).toBeEnabled();
    
    // Click the button
    await fetchButton.click();
    
    // Try to wait for button to show "Fetching..." but don't fail if it's too fast
    try {
        await expect(fetchButton).toHaveText('Fetching...', { timeout: 3000 });
        console.log('[PageHelper] Price fetching started...');
        
        // Wait for fetching to complete (button text changes back) - generous timeout for API delays
        await expect(fetchButton).toHaveText('Fetch Prices', { timeout: 90000 }); // Increased to 90 seconds
        console.log('[PageHelper] Price fetching completed.');
    } catch (error) {
        // If we can't catch the "Fetching..." state, just wait a bit and continue
        console.log('[PageHelper] Fetch button state change was too fast to catch, waiting for completion...');
        await page.waitForTimeout(10000); // Increased wait to 10 seconds for slower API responses
        
        // Verify button is back to "Fetch Prices" state
        await expect(fetchButton).toHaveText('Fetch Prices', { timeout: 15000 });
        console.log('[PageHelper] Price fetching completed.');
    }
    
    // Add a reasonable delay to ensure UI updates are fully reflected after API response
    console.log('[PageHelper] Waiting for UI to update with fetched prices...');
    await page.waitForTimeout(3000); // Reduced to 3 seconds to avoid test timeout
}

// Helper function to verify stock now has a price value
async function verifyStockHasPrice(page: any, stockSymbol: string) {
    console.log(`[PageHelper] Verifying ${stockSymbol} now has a price value...`);
    
    // Find the row for this stock symbol
    const stockRow = page.locator(`tr:has(td:has-text("${stockSymbol}"))`);
    await expect(stockRow).toBeVisible({ timeout: 15000 });
    
    // Find the price cell in this row
    const priceCell = stockRow.locator('td').nth(await getPriceCellIndex(page));
    
    // Wait for the price cell to update with actual price data (more generous timeout for API delays)
    await expect(priceCell).not.toHaveText('-', { timeout: 30000 }); // Wait up to 30 seconds for price to appear
    await expect(priceCell).not.toHaveText('', { timeout: 5000 }); // Ensure it's not empty
    
    // Verify it shows a currency value (starts with $ and has numbers) with retry logic
    let priceCellText = '';
    let attempts = 0;
    const maxAttempts = 5;
    
    while (attempts < maxAttempts) {
        priceCellText = (await priceCell.textContent()) || '';
        if (priceCellText.trim().match(/^\$[\d,]+\.?\d*$/)) {
            break; // Successfully found a valid price format
        }
        console.log(`[PageHelper] Attempt ${attempts + 1}: Price format not yet valid (${priceCellText.trim()}), retrying...`);
        await page.waitForTimeout(1000); // Wait 1 second before retry
        attempts++;
    }
    
    expect(priceCellText?.trim()).toMatch(/^\$[\d,]+\.?\d*$/);
    console.log(`[PageHelper] ✅ Confirmed ${stockSymbol} now has price value: ${priceCellText?.trim()}`);
}

// Helper function to create stock via UI
async function createStockViaUI(page: any, stockData: PortfolioStockCreateData) {
    console.log(`[PageHelper] Creating stock ${stockData.symbol} via UI...`);
    
    // Navigate to portfolio first
    await page.goto('/portfolio');
    await expect(page.locator('[data-testid="portfolio-page-title"]')).toBeVisible({ timeout: 15000 });
    
    // Click add stock button using data-testid
    const addButton = page.locator('[data-testid="portfolio-page-add-stock-button"]');
    await expect(addButton).toBeVisible({ timeout: 10000 });
    await addButton.click();
    
    // Wait for symbol field to be visible (indicating modal is ready)
    const symbolField = page.locator('#symbol');
    await expect(symbolField).toBeVisible({ timeout: 10000 });
    
    // Fill the form using ID selectors
    await page.locator('#symbol').fill(stockData.symbol);
    await page.locator('#name').fill(stockData.name);
    await page.locator('#type').selectOption(stockData.stockType);
    await page.locator('#region').selectOption(stockData.region);
    await page.locator('#stockTrend').selectOption(stockData.stockTrend);
    await page.locator('#pdp').fill((stockData.pdp ?? 3).toString());
    await page.locator('#plr').fill((stockData.plr ?? 2).toString());
    await page.locator('#budget').fill((stockData.budget ?? 1000).toString());
    await page.locator('#shr').fill((stockData.swingHoldRatio ?? 30).toString());
    await page.locator('#commission').fill((stockData.stockCommission ?? 1).toString());
    await page.locator('#htp').fill((stockData.htp ?? 10).toString());
    
    // Submit the form
    const submitButton = page.locator('button[type="submit"]:has-text("Add Stock")');
    await expect(submitButton).toBeVisible();
    await submitButton.click();
    
    // Wait for modal to close (indicating stock was created successfully)
    const modal = page.locator('[role="dialog"]').first();
    await expect(modal).not.toBeVisible({ timeout: 10000 });
    console.log(`[PageHelper] ✅ Stock ${stockData.symbol} created successfully.`);
}

test.describe('Signals Price Fetch', () => {
    let createdStockIds: string[] = [];

    test.beforeEach(async ({ page }) => {
        console.log('[BEFORE EACH] Starting fresh session setup...');
        await clearBrowserState(page);
        console.log('[BEFORE EACH] Browser state cleared.');
        
        console.log(`[BEFORE EACH] Attempting login as ${E2E_TEST_USERNAME}...`);
        await loginUser(page);
        console.log('[BEFORE EACH] Login successful.');
    });

    test.afterEach(async () => {
        console.log('[AFTER EACH] Starting cleanup...');
        
        // Clean up created stocks
        for (const stockId of createdStockIds) {
            try {
                await deletePortfolioStock(stockId);
                console.log(`[AFTER EACH] Deleted stock: ${stockId}`);
            } catch (error) {
                console.error(`[AFTER EACH] Error deleting stock ${stockId}:`, error);
            }
        }
        
        createdStockIds = [];
        console.log('[AFTER EACH] Cleanup completed.');
    });

    test('Fetch Prices - Create stocks, verify price fetching in Signals page', async ({ page }) => {
        test.setTimeout(120000); // Increase test timeout to 2 minutes for API delays
        console.log('[SignalsPriceFetch] Starting test...');
        
        // Step 1: Create stocks via UI
        for (const stockData of testData.stocks) {
            console.log(`[SignalsPriceFetch] Step 1.${testData.stocks.indexOf(stockData) + 1}: Creating stock ${stockData.symbol}...`);
            await createStockViaUI(page, stockData);
            
            // Get the created stock ID for cleanup
            const createdStock = await getPortfolioStockBySymbol(stockData.symbol);
            if (createdStock) {
                createdStockIds.push(createdStock.id);
                console.log(`[SignalsPriceFetch] Stock ${stockData.symbol} created with ID: ${createdStock.id}`);
            }
        }
        
        // Step 2: Navigate to Signals page
        console.log('[SignalsPriceFetch] Step 2: Navigating to Signals page...');
        await navigateToSignalsPage(page);
        
        // Step 3: Toggle Price column visible
        console.log('[SignalsPriceFetch] Step 3: Toggling Price column visible...');
        await togglePriceColumnVisible(page);
        
        // Step 4: Verify stocks don't have existing price values
        console.log('[SignalsPriceFetch] Step 4: Verifying stocks have no price values...');
        for (const stockData of testData.stocks) {
            await verifyStockHasNoPrice(page, stockData.symbol);
        }
        
        // Step 5: Fetch prices
        console.log('[SignalsPriceFetch] Step 5: Fetching prices...');
        await fetchPricesAndWait(page);
        
        // Step 6: Verify stocks now have price values
        console.log('[SignalsPriceFetch] Step 6: Verifying stocks now have price values...');
        for (const stockData of testData.stocks) {
            await verifyStockHasPrice(page, stockData.symbol);
        }
        
        console.log('[SignalsPriceFetch] Test completed successfully!');
    });
});
