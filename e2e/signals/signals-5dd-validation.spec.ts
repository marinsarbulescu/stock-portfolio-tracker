// e2e/signals/signals-5dd-validation.spec.ts

// This E2E test validates the 5DD (Five Day Dip) column logic in SignalsTable:
// Test Case 1: Shows 5DD percentage when no recent buys (last buy > 5 days ago)
// Test Case 2: Hides 5DD when recent buy exists (last buy ≤ 5 days ago)

import { Amplify } from 'aws-amplify';
import { test, expect } from '@playwright/test';
import amplifyOutputs from '../../amplify_outputs.json';

import {
    createPortfolioStock,
    deletePortfolioStock,
    createTransaction,
    getPortfolioStockBySymbol,
    type PortfolioStockCreateData,
    type TransactionCreateData,
} from '../utils/dataHelpers';
import { E2E_TEST_USER_OWNER_ID, E2E_TEST_USERNAME } from '../utils/testCredentials';
import { clearBrowserState, loginUser, createStockViaUI } from '../utils/pageHelpers';
import { cleanupTestStocks } from '../utils/cleanupHelper';
import { loadFiveDDTestData, type FiveDDValidationConfig, type FiveDDTestCase } from '../utils/jsonHelper';

// Configure Amplify
try {
    Amplify.configure(amplifyOutputs);
    console.log('[signals-5dd-validation.spec.ts] - Amplify configured successfully.');
} catch (error) {
    console.error('[signals-5dd-validation.spec.ts] - CRITICAL: Error configuring Amplify:', error);
}

// Load test configuration
const testConfig: FiveDDValidationConfig = loadFiveDDTestData('e2e/signals/signals-5dd-validation.json');

// Helper function to navigate to signals page using proper testids
async function navigateToSignalsPage(page: any) {
    console.log('[PageHelper] Navigating to Signals page...');
    await page.goto('/');
    
    // Use proper testid for navigation
    const signalsLink = page.locator('[data-testid="nav-home-link"]');
    await expect(signalsLink).toBeVisible({ timeout: 15000 });
    await signalsLink.click();
    
    // Wait for signals page to load using testid
    await expect(page.locator('[data-testid="signals-page-title"]')).toBeVisible({ timeout: 15000 });
    console.log('[PageHelper] Successfully navigated to Signals page.');
}

// Helper function to create stock with test historical data
async function createStockWithTestData(page: any, testCase: FiveDDTestCase) {
    console.log(`[5DD Helper] Creating stock ${testCase.stock.symbol} with test historical data...`);
    
    // First, create stock without testHistoricalCloses to test base functionality
    const stockData = {
        symbol: testCase.stock.symbol,
        name: testCase.stock.name,
        stockType: testCase.stock.stockType as any,
        region: testCase.stock.region as any,
        pdp: testCase.stock.pdp,
        stp: testCase.stock.stp,
        htp: testCase.stock.htp,
        budget: testCase.stock.budget,
        swingHoldRatio: testCase.stock.swingHoldRatio,
        stockCommission: testCase.stock.stockCommission,
        owner: E2E_TEST_USER_OWNER_ID,
        testPrice: testCase.stock.testPrice,
        // Try converting the array to JSON string
        testHistoricalCloses: JSON.stringify(testCase.stock.testHistoricalCloses),
        isHidden: false,
        archived: false
    };
    
    console.log(`[5DD Helper] testHistoricalCloses data:`, JSON.stringify(testCase.stock.testHistoricalCloses));
    
    const createdStock = await createPortfolioStock(stockData);
    
    console.log(`[5DD Helper] ✅ Stock ${testCase.stock.symbol} created with ID: ${createdStock.id}`);
    console.log(`[5DD Helper] Test price: $${testCase.stock.testPrice}`);
    console.log(`[5DD Helper] Historical closes: ${testCase.stock.testHistoricalCloses?.length} data points`);
    
    return createdStock;
}

// Helper function to add transaction (using API for simplicity)
async function addTransaction(stockId: string, testCase: FiveDDTestCase) {
    console.log(`[Transaction Helper] Adding transaction for ${testCase.stock.symbol}...`);
    
    const transactionData: TransactionCreateData = {
        portfolioStockId: stockId,
        owner: E2E_TEST_USER_OWNER_ID,
        action: testCase.transaction.action as any, // Fixed: use 'action' not 'transactionAction'
        txnType: testCase.transaction.txnType as any,
        signal: testCase.transaction.signal || '',
        price: testCase.transaction.price,
        investment: testCase.transaction.investment,
        date: testCase.transaction.date
    };
    
    const transaction = await createTransaction(transactionData);
    console.log(`[Transaction Helper] ✅ Transaction added: ${transaction.action} $${transaction.investment} at $${transaction.price}`);
    console.log(`[Transaction Helper] Transaction date: ${transaction.date} (${testCase.expected.lastBuyDays} days ago)`);
    console.log(`[Transaction Helper] Expected 5DD visibility: ${testCase.expected.shouldShow5DD ? 'SHOW' : 'HIDE'}`);
    
    return transaction;
}

// Helper function to navigate to Signals page and verify columns using testids
async function navigateToSignalsAndVerify(page: any, testCase: FiveDDTestCase, stockId: string) {
    console.log('[Signals Helper] Navigating to Signals page...');
    
    // Navigate to signals page using the established pattern
    await navigateToSignalsPage(page);
    
    console.log('[Signals Helper] Verifying stock data...');
    
    // Use proper testids to locate table cells for verification
    const stockSymbol = testCase.stock.symbol.toUpperCase();
    
    // Verify the stock row exists using ticker testid
    const tickerCell = page.locator(`[data-testid="signals-table-ticker-${stockSymbol}"]`);
    await expect(tickerCell).toBeVisible({ timeout: 10000 });
    console.log(`[Signals Helper] Found ticker cell for ${stockSymbol}`);
    
    // Verify Last Buy (L Buy) column using specific testid
    console.log(`[Signals Helper] Expected L Buy Days: ${testCase.expected.lastBuyDays} d`);
    const lastBuyCell = page.locator(`[data-testid="signals-table-last-buy-${stockSymbol}"]`);
    await expect(lastBuyCell).toBeVisible({ timeout: 10000 });
    
    const lastBuyText = await lastBuyCell.textContent();
    const expectedLBuyText = `${testCase.expected.lastBuyDays} d`;
    expect(lastBuyText?.trim()).toBe(expectedLBuyText);
    console.log(`[Signals Helper] ✅ L Buy verified: ${expectedLBuyText}`);

    // Verify 5DD column using specific testid
    console.log(`[Signals Helper] Expected 5DD: ${testCase.expected.shouldShow5DD ? testCase.expected.fiveDayDip : 'Hidden (-)'}`);
    const fiveDDCell = page.locator(`[data-testid="signals-table-5dd-${stockSymbol}"]`);
    await expect(fiveDDCell).toBeVisible({ timeout: 10000 });
    
    const fiveDDText = await fiveDDCell.textContent();
    
    if (testCase.expected.shouldShow5DD) {
        expect(fiveDDText?.trim()).toBe(testCase.expected.fiveDayDip);
        console.log(`[Signals Helper] ✅ 5DD shown as expected: ${testCase.expected.fiveDayDip}`);
    } else {
        expect(fiveDDText?.trim()).toBe('-');
        console.log(`[Signals Helper] ✅ 5DD hidden as expected: "-"`);
    }
}

// Test suite
test.describe('5DD Column Validation', () => {
    let createdStockIds: string[] = [];

    test.beforeEach(async ({ page }) => {
        console.log('[BEFORE EACH] Starting fresh session setup...');
        
        // Clean up any leftover test stocks first
        await cleanupTestStocks(['E2E5DD1', 'E2E5DD2']);
        
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

    test('Case 1: Shows 5DD when no recent buys (17 days ago)', async ({ page }) => {
        test.setTimeout(120000); // 2 minutes timeout following established pattern
        
        // Listen for console logs from the browser (for debugging if needed)
        page.on('console', msg => {
            if (msg.text().includes('ERROR') || msg.text().includes('Failed')) {
                console.log(`[BROWSER CONSOLE] ${msg.text()}`);
            }
        });
        
        const testCase = testConfig.testCases[0]; // First test case
        console.log(`\n🚀 Starting ${testCase.name}...`);
        console.log(`📋 ${testCase.description}`);
        
        try {
            // Step 1: Create stock with test historical data
            console.log('\n📍 Step 1: Creating stock with test historical data...');
            const stock = await createStockWithTestData(page, testCase);
            createdStockIds.push(stock.id); // Track for cleanup
            
            // Step 2: Add old transaction (17 days ago)
            console.log('\n📍 Step 2: Adding old transaction...');
            await addTransaction(stock.id, testCase);
            
            // Step 3: Navigate to Signals page and verify values
            console.log('\n📍 Step 3: Verifying Signals page values...');
            await navigateToSignalsAndVerify(page, testCase, stock.id);
            
            console.log(`\n🎉 ${testCase.name} completed successfully!`);
            
        } catch (error) {
            console.error(`❌ ${testCase.name} failed:`, error);
            throw error;
        }
    });

    test('Case 2: Hides 5DD when recent buy exists (3 days ago)', async ({ page }) => {
        test.setTimeout(120000); // 2 minutes timeout following established pattern  
        const testCase = testConfig.testCases[1]; // Second test case
        console.log(`\n🚀 Starting ${testCase.name}...`);
        console.log(`📋 ${testCase.description}`);
        
        try {
            // Step 1: Create stock with test historical data
            console.log('\n📍 Step 1: Creating stock with test historical data...');
            const stock = await createStockWithTestData(page, testCase);
            createdStockIds.push(stock.id); // Track for cleanup
            
            // Step 2: Add recent transaction (3 days ago)
            console.log('\n📍 Step 2: Adding recent transaction...');
            await addTransaction(stock.id, testCase);
            
            // Step 3: Navigate to Signals page and verify values
            console.log('\n📍 Step 3: Verifying Signals page values...');
            await navigateToSignalsAndVerify(page, testCase, stock.id);
            
            console.log(`\n🎉 ${testCase.name} completed successfully!`);
            
        } catch (error) {
            console.error(`❌ ${testCase.name} failed:`, error);
            throw error;
        }
    });
});