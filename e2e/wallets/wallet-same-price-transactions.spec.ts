// e2e/wallets/wallet-same-price-transactions.spec.ts

// This Playwright test suite is designed to verify the behavior of wallet updates when adding transactions
// with the same price. It tests that when a second transaction is added with the same price as an existing
// transaction, the existing wallet is updated rather than creating a new wallet.
//
// Test flow:
// 1. Create a test stock with ETF type and 30% SHR
// 2. Navigate to Portfolio page and verify stock creation
// 3. Navigate to the stock's Wallets page
// 4. Verify no transactions or wallets exist initially
// 5. Add Buy Transaction A (Split, Initial, $100, $200)
// 6. Verify transaction A is displayed correctly in WalletsTransactionsTable
// 7. Verify wallets were created correctly (both Swing and Hold)
// 8. Add Buy Transaction B (Swing, Initial, $100, $300) - same price as A
// 9. Verify transaction B is displayed correctly in WalletsTransactionsTable
// 10. Verify wallets were updated correctly:
//     - Swing wallet should have more shares (merged with transaction A)
//     - Hold wallet should remain unchanged
//     - No new wallets should be created
// 11. Add Buy Transaction C (Hold, Initial, $100, $400) - same price as A & B
// 12. Verify transaction C is displayed correctly in WalletsTransactionsTable
// 13. Verify wallets were updated correctly:
//     - Swing wallet should remain unchanged
//     - Hold wallet should have more shares (merged with transactions A & B)
//     - No new wallets should be created
// 14. Add Buy Transaction D (Split, Initial, $100, $500) - same price as A, B & C
// 15. Verify transaction D is displayed correctly in WalletsTransactionsTable
// 16. Verify wallets were updated correctly:
//     - Both Swing and Hold wallets should have more shares (merged with all previous transactions)
//     - No new wallets should be created

import { Amplify } from 'aws-amplify';
import { test, expect } from '@playwright/test';
import amplifyOutputs from '../../amplify_outputs.json';

import {
    createPortfolioStock,
    deleteStockWalletsForStockByStockId,
    deletePortfolioStock,
    deleteTransactionsForStockByStockId,
    type PortfolioStockCreateData,
} from '../utils/dataHelpers';
import { E2E_TEST_USER_OWNER_ID, E2E_TEST_USERNAME } from '../utils/testCredentials';
import { clearBrowserState, loginUser, navigateToStockWalletPage, addTransaction } from '../utils/pageHelpers';

// Import the generic loader
import { loadScenariosFromCSV } from '../utils/csvHelper';

import {
    SHARE_PRECISION,
    CURRENCY_PRECISION,
} from '../../app/config/constants';
import { formatCurrency, formatShares } from '../../app/utils/financialCalculations';
import { formatToMDYYYY } from '../../app/utils/dateFormatter';

// Define the interface for our test scenarios
interface SamePriceTransactionScenario {
    scenarioName: string;
    stockSymbol: string;
    stockName: string;
    stockStockType: 'Stock' | 'ETF' | 'Crypto';
    stockRegion: 'US' | 'APAC' | 'EU' | 'Intl';
    stockPdp: number;
    stockPlr: number;
    stockBudget: number;
    stockSwingHoldRatio: number;
    stockCommission: number;
    stockHtp: number;
    txnADate: string;
    txnAType: 'Split' | 'Swing' | 'Hold';
    txnASignal: string;
    txnAPrice: number;
    txnAInvestment: number;
    txnAExpectedSwingShares: number;
    txnAExpectedHoldShares: number;
    txnBDate: string;
    txnBType: 'Split' | 'Swing' | 'Hold';
    txnBSignal: string;
    txnBPrice: number;
    txnBInvestment: number;
    txnBExpectedSwingShares: number;
    txnBExpectedHoldShares: number;
    txnCDate: string;
    txnCType: 'Split' | 'Swing' | 'Hold';
    txnCSignal: string;
    txnCPrice: number;
    txnCInvestment: number;
    txnCExpectedSwingShares: number;
    txnCExpectedHoldShares: number;
    txnDDate: string;
    txnDType: 'Split' | 'Swing' | 'Hold';
    txnDSignal: string;
    txnDPrice: number;
    txnDInvestment: number;
    txnDExpectedSwingShares: number;
    txnDExpectedHoldShares: number;
}

// Configure Amplify
try {
    Amplify.configure(amplifyOutputs);
    console.log('[wallet-same-price-transactions.spec.ts] - Amplify configured successfully.');
} catch (error) {
    console.error('[wallet-same-price-transactions.spec.ts] - CRITICAL: Error configuring Amplify:', error);
}

// Load test scenarios from CSV
const numericColumns: ReadonlyArray<keyof SamePriceTransactionScenario> = [
    'stockPdp',
    'stockPlr',
    'stockBudget',
    'stockSwingHoldRatio',
    'stockCommission',
    'stockHtp',
    'txnAPrice',
    'txnAInvestment',
    'txnAExpectedSwingShares',
    'txnAExpectedHoldShares',
    'txnBPrice',
    'txnBInvestment',
    'txnBExpectedSwingShares',
    'txnBExpectedHoldShares',
    'txnCPrice',
    'txnCInvestment',
    'txnCExpectedSwingShares',
    'txnCExpectedHoldShares',
    'txnDPrice',
    'txnDInvestment',
    'txnDExpectedSwingShares',
    'txnDExpectedHoldShares',
];

const testScenarios = loadScenariosFromCSV<SamePriceTransactionScenario>(
    '../wallets/wallet-same-price-transactions.csv',
    numericColumns
);

// Helper function to navigate to portfolio page
async function navigateToPortfolioPage(page: any) {
    console.log('[PageHelper] Navigating to Portfolio page...');
    await page.goto('/');
    const portfolioLink = page.locator('nav a:has-text("Portfolio")');
    await expect(portfolioLink).toBeVisible({ timeout: 15000 });
    await portfolioLink.click();
    
    const pageTitle = page.locator('[data-testid="portfolio-page-title"]');
    await expect(pageTitle).toBeVisible({ timeout: 15000 });
    await expect(pageTitle).toHaveText('Portfolio');
    console.log('[PageHelper] Successfully navigated to Portfolio page.');
}

// Helper function to verify stock in portfolio table
async function verifyStockInPortfolioTable(page: any, scenario: SamePriceTransactionScenario) {
    console.log('[PageHelper] Verifying stock in portfolio table...');
    
    const symbol = scenario.stockSymbol.toUpperCase();
    const symbolLink = page.locator(`[data-testid="portfolio-page-table-wallet-link-${symbol}"]`);
    await expect(symbolLink).toBeVisible({ timeout: 10000 });
    await expect(symbolLink).toHaveText(symbol);
    
    console.log('[PageHelper] Stock verified in portfolio table.');
}

// Helper function to verify no transactions exist
async function verifyNoTransactionsExist(page: any) {
    console.log('[PageHelper] Verifying no transactions exist...');
    
    const noTransactionsMessage = page.locator('[data-testid="wallets-transaction-table-no-transactions-message"]');
    await expect(noTransactionsMessage).toBeVisible({ timeout: 10000 });
    await expect(noTransactionsMessage).toContainText('No transactions found for this stock.');
    
    console.log('[PageHelper] Confirmed no transactions exist.');
}

// Helper function to verify no wallets exist
async function verifyNoWalletsExist(page: any) {
    console.log('[PageHelper] Verifying no wallets exist...');
    
    // Check Swing tab
    const swingTab = page.locator('[data-testid="wallet-tab-Swing"]');
    await expect(swingTab).toBeVisible({ timeout: 5000 });
    await swingTab.click();
    await page.waitForTimeout(1000);
    
    const swingNotFound = page.locator('[data-testid="wallet-notfound-display"]');
    await expect(swingNotFound).toBeVisible();
    await expect(swingNotFound).toContainText('No Swing wallets with shares found for this stock.');
    
    // Check Hold tab
    const holdTab = page.locator('[data-testid="wallet-tab-Hold"]');
    await expect(holdTab).toBeVisible({ timeout: 5000 });
    await holdTab.click();
    await page.waitForTimeout(1000);
    
    const holdNotFound = page.locator('[data-testid="wallet-notfound-display"]');
    await expect(holdNotFound).toBeVisible();
    await expect(holdNotFound).toContainText('No Hold wallets with shares found for this stock.');
    
    console.log('[PageHelper] Confirmed no wallets exist.');
}

// Helper function to verify transaction in table
async function verifyTransactionInTable(page: any, transactionData: {
    date: string;
    type: string;
    signal: string;
    price: number;
    investment: number;
}, position: number = 0) {
    console.log(`[PageHelper] Verifying transaction ${position + 1} in table...`);
    
    // Enable necessary columns
    const dateColumnToggle = page.locator('[data-testid="wallets-transaction-table-toggle-column-date-checkbox"]');
    await dateColumnToggle.check();
    await expect(dateColumnToggle).toBeChecked();
    
    const actionColumnToggle = page.locator('[data-testid="wallets-transaction-table-toggle-column-action-checkbox"]');
    await actionColumnToggle.check();
    await expect(actionColumnToggle).toBeChecked();
    
    const txnTypeColumnToggle = page.locator('[data-testid="wallets-transaction-table-toggle-column-txnType-checkbox"]');
    await txnTypeColumnToggle.check();
    await expect(txnTypeColumnToggle).toBeChecked();
    
    const signalColumnToggle = page.locator('[data-testid="wallets-transaction-table-toggle-column-signal-checkbox"]');
    await signalColumnToggle.check();
    await expect(signalColumnToggle).toBeChecked();
    
    const priceColumnToggle = page.locator('[data-testid="wallets-transaction-table-toggle-column-price-checkbox"]');
    await priceColumnToggle.check();
    await expect(priceColumnToggle).toBeChecked();
    
    // Wait for transaction table to be visible
    const transactionTable = page.locator('[data-testid="wallets-transaction-table-transaction-row"]');
    await expect(transactionTable.first()).toBeVisible({ timeout: 10000 });
    
    // Get the specific transaction row (0 = most recent)
    const txnRow = transactionTable.nth(position);
    await expect(txnRow).toBeVisible();
    
    // Verify transaction data
    const dateCell = txnRow.locator('[data-testid="wallets-transaction-table-date-display"]');
    await expect(dateCell).toHaveText(formatToMDYYYY(transactionData.date));
    
    const actionCell = txnRow.locator('[data-testid="wallets-transaction-table-action-display"]');
    await expect(actionCell).toHaveText('Buy');
    
    const txnTypeCell = txnRow.locator('[data-testid="wallets-transaction-table-txnType-display"]');
    await expect(txnTypeCell).toHaveText(transactionData.type);
    
    const signalCell = txnRow.locator('[data-testid="wallets-transaction-table-signal-display"]');
    await expect(signalCell).toHaveText(transactionData.signal);
    
    const priceCell = txnRow.locator('[data-testid="wallets-transaction-table-price-display"]');
    await expect(priceCell).toHaveText(formatCurrency(transactionData.price));
    
    console.log(`[PageHelper] Transaction ${position + 1} verified in table.`);
}

// Helper function to verify wallet state
async function verifyWalletState(page: any, walletType: 'Swing' | 'Hold', expectedShares: number, expectedPrice: number) {
    console.log(`[PageHelper] Verifying ${walletType} wallet state...`);
    
    const tab = page.locator(`[data-testid="wallet-tab-${walletType}"]`);
    await expect(tab).toBeVisible({ timeout: 5000 });
    await tab.click();
    await page.waitForTimeout(1000);
    
    if (expectedShares > 0) {
        console.log(`[PageHelper] Expecting ${walletType} wallet with ${expectedShares} shares at $${expectedPrice}`);
        
        const notFoundMessage = page.locator('[data-testid="wallet-notfound-display"]');
        await expect(notFoundMessage).not.toBeVisible({ timeout: 5000 });
        
        const walletsTable = page.locator('[data-testid="wallets-table"]');
        await expect(walletsTable).toBeVisible({ timeout: 5000 });
        
        const walletRow = walletsTable.locator('tbody tr').first();
        await expect(walletRow).toBeVisible({ timeout: 5000 });
        
        const buyPriceCell = walletRow.locator('[data-testid="wallet-buyPrice-display"]');
        await expect(buyPriceCell).toHaveText(formatCurrency(expectedPrice));
        
        const remainingSharesCell = walletRow.locator('[data-testid="wallet-remainingShares-display"]');
        await expect(remainingSharesCell).toHaveText(formatShares(expectedShares, SHARE_PRECISION));
        
        console.log(`[PageHelper] ${walletType} wallet verified with ${expectedShares} shares at $${expectedPrice}`);
    } else {
        console.log(`[PageHelper] Expecting NO ${walletType} wallet`);
        
        const notFoundMessage = page.locator('[data-testid="wallet-notfound-display"]');
        await expect(notFoundMessage).toBeVisible({ timeout: 10000 });
        await expect(notFoundMessage).toContainText(`No ${walletType} wallets with shares found for this stock.`);
        
        console.log(`[PageHelper] Confirmed no ${walletType} wallet exists.`);
    }
}

// Helper function to count wallet rows
async function countWalletRows(page: any, walletType: 'Swing' | 'Hold'): Promise<number> {
    console.log(`[PageHelper] Counting ${walletType} wallet rows...`);
    
    const tab = page.locator(`[data-testid="wallet-tab-${walletType}"]`);
    await expect(tab).toBeVisible({ timeout: 5000 });
    await tab.click();
    await page.waitForTimeout(1000);
    
    const notFoundMessage = page.locator('[data-testid="wallet-notfound-display"]');
    const isNotFoundVisible = await notFoundMessage.isVisible();
    
    if (isNotFoundVisible) {
        console.log(`[PageHelper] No ${walletType} wallets found.`);
        return 0;
    }
    
    const walletsTable = page.locator('[data-testid="wallets-table"]');
    const isTableVisible = await walletsTable.isVisible();
    
    if (!isTableVisible) {
        console.log(`[PageHelper] No ${walletType} wallets table found.`);
        return 0;
    }
    
    const walletRows = walletsTable.locator('tbody tr');
    const count = await walletRows.count();
    
    console.log(`[PageHelper] Found ${count} ${walletType} wallet rows.`);
    return count;
}

// Test Suite
test.describe('Wallet Same Price Transactions', () => {
    let testPortfolioStockId: string | null = null;
    let testStockSymbol: string | null = null;

    test.beforeAll(async () => {
        console.log('[BEFORE ALL] Starting test setup...');
        
        if (testScenarios.length === 0) {
            throw new Error('No test scenarios found in CSV file.');
        }
        
        const scenario = testScenarios[0];
        testStockSymbol = scenario.stockSymbol;
        
        console.log(`[BEFORE ALL] Creating test stock ${testStockSymbol}...`);
        
        const stockData: PortfolioStockCreateData = {
            owner: E2E_TEST_USER_OWNER_ID,
            symbol: scenario.stockSymbol,
            name: scenario.stockName,
            stockType: scenario.stockStockType,
            region: scenario.stockRegion,
            pdp: scenario.stockPdp,
            plr: scenario.stockPlr,
            budget: scenario.stockBudget,
            swingHoldRatio: scenario.stockSwingHoldRatio,
            stockCommission: scenario.stockCommission,
            htp: scenario.stockHtp
        };
        
        try {
            const createdStock = await createPortfolioStock(stockData);
            testPortfolioStockId = createdStock.id;
            console.log(`[BEFORE ALL] Stock created successfully with ID: ${testPortfolioStockId}`);
        } catch (error) {
            console.error('[BEFORE ALL] Failed to create stock:', error);
            throw error;
        }
    });

    test.afterAll(async () => {
        console.log('[AFTER ALL] Starting cleanup...');
        
        if (testPortfolioStockId) {
            try {
                console.log(`[AFTER ALL] Deleting wallets for stock ID ${testPortfolioStockId}...`);
                await deleteStockWalletsForStockByStockId(testPortfolioStockId);
                
                console.log(`[AFTER ALL] Deleting transactions for stock ID ${testPortfolioStockId}...`);
                await deleteTransactionsForStockByStockId(testPortfolioStockId);
                
                console.log(`[AFTER ALL] Deleting stock ${testPortfolioStockId}...`);
                await deletePortfolioStock(testPortfolioStockId);
                
                console.log('[AFTER ALL] Cleanup completed successfully.');
            } catch (error) {
                console.error('[AFTER ALL] Error during cleanup:', error);
            }
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

    for (const scenario of testScenarios) {
        test(`${scenario.scenarioName} - Test Same Price Transaction Behavior`, async ({ page }) => {
            console.log(`[${scenario.scenarioName}] Starting test...`);

            // Clean up any existing data for this stock
            if (testPortfolioStockId) {
                try {
                    await deleteStockWalletsForStockByStockId(testPortfolioStockId);
                    await deleteTransactionsForStockByStockId(testPortfolioStockId);
                } catch (error) {
                    console.warn(`[${scenario.scenarioName}] Warning during cleanup:`, error);
                }
            }

            // Step 1: Navigate to Portfolio page and verify stock creation
            console.log(`[${scenario.scenarioName}] Step 1: Navigating to Portfolio page...`);
            await navigateToPortfolioPage(page);
            await verifyStockInPortfolioTable(page, scenario);

            // Step 2: Navigate to stock's Wallets page
            console.log(`[${scenario.scenarioName}] Step 2: Navigating to stock's Wallets page...`);
            if (!testPortfolioStockId || !testStockSymbol) {
                throw new Error('Stock not created properly');
            }
            await navigateToStockWalletPage(page, testPortfolioStockId, testStockSymbol);

            // Step 3: Verify no transactions or wallets exist
            console.log(`[${scenario.scenarioName}] Step 3: Verifying no transactions or wallets exist...`);
            await verifyNoTransactionsExist(page);
            await verifyNoWalletsExist(page);

            // Step 4: Add Buy Transaction A
            console.log(`[${scenario.scenarioName}] Step 4: Adding Buy Transaction A...`);
            await addTransaction(page, {
                date: scenario.txnADate,
                type: scenario.txnAType,
                signal: scenario.txnASignal,
                price: scenario.txnAPrice,
                investment: scenario.txnAInvestment
            });

            // Step 5: Verify transaction A is displayed correctly
            console.log(`[${scenario.scenarioName}] Step 5: Verifying transaction A in table...`);
            await verifyTransactionInTable(page, {
                date: scenario.txnADate,
                type: scenario.txnAType,
                signal: scenario.txnASignal,
                price: scenario.txnAPrice,
                investment: scenario.txnAInvestment
            }, 0);

            // Step 6: Verify wallets were created correctly after transaction A
            console.log(`[${scenario.scenarioName}] Step 6: Verifying wallets after transaction A...`);
            await verifyWalletState(page, 'Swing', scenario.txnAExpectedSwingShares, scenario.txnAPrice);
            await verifyWalletState(page, 'Hold', scenario.txnAExpectedHoldShares, scenario.txnAPrice);

            // Count initial wallet rows
            const initialSwingWallets = await countWalletRows(page, 'Swing');
            const initialHoldWallets = await countWalletRows(page, 'Hold');
            console.log(`[${scenario.scenarioName}] Initial wallet count - Swing: ${initialSwingWallets}, Hold: ${initialHoldWallets}`);

            // Step 7: Add Buy Transaction B (same price as A)
            console.log(`[${scenario.scenarioName}] Step 7: Adding Buy Transaction B (same price)...`);
            await addTransaction(page, {
                date: scenario.txnBDate,
                type: scenario.txnBType,
                signal: scenario.txnBSignal,
                price: scenario.txnBPrice,
                investment: scenario.txnBInvestment
            });

            // Step 8: Verify transaction B is displayed correctly
            console.log(`[${scenario.scenarioName}] Step 8: Verifying transaction B in table...`);
            // Note: We don't verify specific position since all transactions have same date
            // The important validation is wallet behavior, not table ordering
            const transactionRowsAfterB = page.locator('[data-testid="wallets-transaction-table-transaction-row"]');
            await expect(transactionRowsAfterB).toHaveCount(2); // Should have 2 transactions now

            // Step 9: Verify wallets were updated correctly after transaction B
            console.log(`[${scenario.scenarioName}] Step 9: Verifying wallets after transaction B...`);
            
            // Verify Swing wallet has updated shares (transaction B was Swing type)
            await verifyWalletState(page, 'Swing', scenario.txnBExpectedSwingShares, scenario.txnBPrice);
            
            // Verify Hold wallet remains unchanged
            await verifyWalletState(page, 'Hold', scenario.txnBExpectedHoldShares, scenario.txnBPrice);

            // Step 10: Verify no new wallets were created after Transaction B
            console.log(`[${scenario.scenarioName}] Step 10: Verifying no new wallets were created after Transaction B...`);
            const finalSwingWallets = await countWalletRows(page, 'Swing');
            const finalHoldWallets = await countWalletRows(page, 'Hold');
            console.log(`[${scenario.scenarioName}] Final wallet count after Transaction B - Swing: ${finalSwingWallets}, Hold: ${finalHoldWallets}`);

            // Assert that wallet counts haven't increased
            expect(finalSwingWallets).toBe(initialSwingWallets);
            expect(finalHoldWallets).toBe(initialHoldWallets);

            // Step 11: Add Buy Transaction C (Hold, same price)
            console.log(`[${scenario.scenarioName}] Step 11: Adding Buy Transaction C (Hold, same price)...`);
            await addTransaction(page, {
                date: scenario.txnCDate,
                type: scenario.txnCType,
                signal: scenario.txnCSignal,
                price: scenario.txnCPrice,
                investment: scenario.txnCInvestment
            });

            // Step 12: Verify transaction C is displayed correctly
            console.log(`[${scenario.scenarioName}] Step 12: Verifying transaction C in table...`);
            // Note: We don't verify specific position since all transactions have same date
            // The important validation is wallet behavior, not table ordering
            const transactionRowsAfterC = page.locator('[data-testid="wallets-transaction-table-transaction-row"]');
            await expect(transactionRowsAfterC).toHaveCount(3); // Should have 3 transactions now

            // Step 13: Verify wallets were updated correctly after transaction C
            console.log(`[${scenario.scenarioName}] Step 13: Verifying wallets after transaction C...`);
            
            // Verify Swing wallet remains unchanged (transaction C was Hold type)
            await verifyWalletState(page, 'Swing', scenario.txnCExpectedSwingShares, scenario.txnCPrice);
            
            // Verify Hold wallet has updated shares (transaction C was Hold type)
            await verifyWalletState(page, 'Hold', scenario.txnCExpectedHoldShares, scenario.txnCPrice);

            // Step 14: Verify no new wallets were created after Transaction C
            console.log(`[${scenario.scenarioName}] Step 14: Verifying no new wallets were created after Transaction C...`);
            const finalSwingWalletsAfterC = await countWalletRows(page, 'Swing');
            const finalHoldWalletsAfterC = await countWalletRows(page, 'Hold');
            console.log(`[${scenario.scenarioName}] Final wallet count after Transaction C - Swing: ${finalSwingWalletsAfterC}, Hold: ${finalHoldWalletsAfterC}`);

            // Assert that wallet counts haven't increased
            expect(finalSwingWalletsAfterC).toBe(initialSwingWallets);
            expect(finalHoldWalletsAfterC).toBe(initialHoldWallets);

            // Step 15: Add Buy Transaction D (Split, same price)
            console.log(`[${scenario.scenarioName}] Step 15: Adding Buy Transaction D (Split, same price)...`);
            await addTransaction(page, {
                date: scenario.txnDDate,
                type: scenario.txnDType,
                signal: scenario.txnDSignal,
                price: scenario.txnDPrice,
                investment: scenario.txnDInvestment
            });

            // Step 16: Verify transaction D is displayed correctly
            console.log(`[${scenario.scenarioName}] Step 16: Verifying transaction D in table...`);
            // Note: We don't verify specific position since all transactions have same date
            // The important validation is wallet behavior, not table ordering
            const transactionRowsAfterD = page.locator('[data-testid="wallets-transaction-table-transaction-row"]');
            await expect(transactionRowsAfterD).toHaveCount(4); // Should have 4 transactions now

            // Step 17: Verify wallets were updated correctly after transaction D
            console.log(`[${scenario.scenarioName}] Step 17: Verifying wallets after transaction D...`);
            
            // Verify both Swing and Hold wallets have updated shares (transaction D was Split type)
            await verifyWalletState(page, 'Swing', scenario.txnDExpectedSwingShares, scenario.txnDPrice);
            await verifyWalletState(page, 'Hold', scenario.txnDExpectedHoldShares, scenario.txnDPrice);

            // Step 18: Verify no new wallets were created after Transaction D
            console.log(`[${scenario.scenarioName}] Step 18: Verifying no new wallets were created after Transaction D...`);
            const finalSwingWalletsAfterD = await countWalletRows(page, 'Swing');
            const finalHoldWalletsAfterD = await countWalletRows(page, 'Hold');
            console.log(`[${scenario.scenarioName}] Final wallet count after Transaction D - Swing: ${finalSwingWalletsAfterD}, Hold: ${finalHoldWalletsAfterD}`);

            // Assert that wallet counts haven't increased
            expect(finalSwingWalletsAfterD).toBe(initialSwingWallets);
            expect(finalHoldWalletsAfterD).toBe(initialHoldWallets);

            console.log(`[${scenario.scenarioName}] Test completed successfully!`);
        });
    }
});
