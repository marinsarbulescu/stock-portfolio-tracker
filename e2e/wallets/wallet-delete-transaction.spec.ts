// e2e/wallets/wallet-delete-transaction.spec.ts

// This Playwright test suite verifies the deletion of stock transactions and the subsequent state of stock wallets (Swing and Hold).
// The suite uses JSON configuration (wallet-delete-transaction.json) to define test scenarios with:
// 1. Adding a transaction
// 2. Deleting the transaction via UI
// 3. Verifying the wallet state after deletion
//
// Test Flow:
// 1. **Global Setup (`test.beforeAll`):**
//    - Loads JSON configuration for delete transaction scenarios
//    - Creates a single `PortfolioStock` record to be shared across all test scenarios
//    - Stores the ID for use in subsequent tests and cleanup
//
// 2. **Per-Test Setup (`test.beforeEach`):**
//    - Clears browser state for clean session
//    - Logs in as E2E test user
//    - Navigates to the wallet page for the test stock
//    - Cleans up any existing wallets/transactions for test isolation
//
// 3. **Test Execution (for each transaction type):**
//    - Creates a transaction of the specified type using JSON configuration
//    - Verifies the wallet(s) are created correctly based on JSON expectations
//    - Deletes the transaction via UI
//    - Verifies the wallet(s) are removed/updated correctly based on JSON expectations
//
// 4. **Global Teardown (`test.afterAll`):**
//    - Cleans up all test data (transactions, wallets, stock)

import { test, expect } from '@playwright/test';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import amplifyOutputs from '../../amplify_outputs.json';
import { Amplify } from 'aws-amplify';

import {
    createPortfolioStock,
    deleteStockWalletsForStockByStockId,
    deletePortfolioStock,
    deleteTransactionsForStockByStockId,
    getPortfolioStockBySymbol,
} from '../utils/dataHelpers';
import { E2E_TEST_USER_OWNER_ID, E2E_TEST_USERNAME, E2E_TEST_PASSWORD } from '../utils/testCredentials';
import { clearBrowserState, loginUser, navigateToStockWalletPage, addTransaction, deleteTransaction, createStockViaUI } from '../utils/pageHelpers';
import { loadDeleteTransactionTestData, type DeleteTransactionTestConfig, type TransactionStep, type WalletExpectation, type OverviewExpectation } from '../utils/jsonHelper';

import {
    SHARE_PRECISION,
    CURRENCY_PRECISION,
} from '../../app/config/constants';
import { formatCurrency, formatShares } from '../../app/utils/financialCalculations';

// Configure Amplify
try {
    Amplify.configure(amplifyOutputs);
    console.log('[BEFORE ALL] Amplify configured successfully for E2E test spec.');
} catch (error) {
    console.error('[BEFORE ALL] CRITICAL: Error configuring Amplify in E2E spec file:', error);
}

// Set test timeout to 60 seconds for reliable execution
test.setTimeout(60000);

// Load test configuration from JSON
const testConfig: DeleteTransactionTestConfig = loadDeleteTransactionTestData('e2e/wallets/wallet-delete-transaction.json');

// Data client for cleanup operations
const client = generateClient<Schema>();

// Helper function to verify wallet details
async function verifyWalletDetails(page: any, walletType: 'swing' | 'hold', walletKey: string, expected: WalletExpectation, stepName: string) {
    console.log(`[PageHelper] Verifying ${walletType} wallet details ${walletKey} for ${stepName}...`);
    console.log(`[PageHelper] Expected: Buy Price=$${expected.buyPrice.toFixed(2)}, Investment=$${expected.investment.toFixed(2)}, Shares=${expected.sharesLeft.toFixed(5)}`);
    
    const tabSelector = `[data-testid="wallet-tab-${walletType}"]`;
    const tab = page.locator(tabSelector);
    await expect(tab).toBeVisible({ timeout: 5000 });
    await tab.click();
    
    // Wait for tab content to load
    const walletTable = page.locator('[data-testid="wallets-table"]');
    await expect(walletTable).toBeVisible({ timeout: 10000 });
    
    const tableRows = walletTable.locator('tbody tr');
    const rowCount = await tableRows.count();
    console.log(`[PageHelper] Searching ${rowCount} rows for wallet with price $${expected.buyPrice.toFixed(2)}`);
    
    let foundWallet = false;
    for (let i = 0; i < rowCount; i++) {
        const row = tableRows.nth(i);
        const buyPriceElement = row.locator('[data-testid="wallet-buyPrice-display"]');
        const buyPriceText = await buyPriceElement.textContent();
        console.log(`[PageHelper] Row ${i}: Buy Price = ${buyPriceText}`);
        
        if (buyPriceText && buyPriceText.includes(`$${expected.buyPrice.toFixed(2)}`)) {
            console.log(`[PageHelper] Found matching buy price wallet, now verifying investment and shares...`);
            
            const investmentElement = row.locator('[data-testid="wallet-totalInvestment-display"]');
            const sharesElement = row.locator('[data-testid="wallet-remainingShares-display"]');
            
            const investmentText = await investmentElement.textContent();
            const sharesText = await sharesElement.textContent();
            
            console.log(`[PageHelper] Row ${i}: Investment = ${investmentText}, Expected = $${expected.investment.toFixed(2)}`);
            console.log(`[PageHelper] Row ${i}: Shares = ${sharesText}, Expected = ${expected.sharesLeft.toFixed(5)}`);
            
            await expect(investmentElement).toContainText(`$${expected.investment.toFixed(2)}`);
            await expect(sharesElement).toContainText(expected.sharesLeft.toFixed(5));
            
            foundWallet = true;
            break;
        }
    }
    
    if (!foundWallet) {
        throw new Error(`[PageHelper] Could not find ${walletType} wallet with buy price $${expected.buyPrice.toFixed(2)} for ${stepName}`);
    }
    
    console.log(`[PageHelper] ✅ ${walletType} wallet verified: Buy Price=$${expected.buyPrice.toFixed(2)}, Investment=$${expected.investment.toFixed(2)}, Shares=${expected.sharesLeft.toFixed(5)}`);
}

// Helper function to verify wallet counts
async function verifyWalletCounts(page: any, walletType: 'swing' | 'hold', expectedCount: number, stepName: string) {
    console.log(`[PageHelper] Verifying ${walletType} wallet count for ${stepName}...`);
    
    const tabSelector = `[data-testid="wallet-tab-${walletType}"]`;
    const tab = page.locator(tabSelector);
    await expect(tab).toBeVisible({ timeout: 5000 });
    await tab.click();
    
    if (expectedCount === 0) {
        const notFoundSelector = '[data-testid="wallet-notfound-display"]';
        const notFoundMessage = page.locator(notFoundSelector);
        const expectedMessage = walletType === 'swing' ? 'No Swing wallets with shares found for this stock.' : 'No Hold wallets with shares found for this stock.';
        await expect(notFoundMessage).toContainText(expectedMessage, { timeout: 5000 });
        console.log(`[PageHelper] ✅ Confirmed no ${walletType} wallets exist for ${stepName}`);
    } else {
        // Use the correct selector pattern from the working add transaction test
        const walletTable = page.locator('[data-testid="wallets-table"]');
        await expect(walletTable).toBeVisible({ timeout: 10000 });
        await expect(walletTable).toBeVisible({ timeout: 10000 });
        
        const tableRows = walletTable.locator('tbody tr');
        const actualCount = await tableRows.count();
        
        if (actualCount !== expectedCount) {
            throw new Error(`[PageHelper] Expected ${expectedCount} ${walletType} wallets but found ${actualCount} for ${stepName}`);
        }
        
        console.log(`[PageHelper] ✅ ${walletType} wallet count verified: ${actualCount} wallets for ${stepName}`);
    }
}

// Helper function to verify transaction step wallets
async function verifyTransactionStepWallets(page: any, step: TransactionStep, stepName: string) {
    console.log(`[DeleteTransaction] Verifying wallets for ${stepName}...`);
    
    // Verify Swing wallets
    const swingWallets = step.output.wallets.swing;
    const swingCount = Object.keys(swingWallets).length;
    await verifyWalletCounts(page, 'swing', swingCount, stepName);
    
    for (const [walletKey, walletExpectation] of Object.entries(swingWallets)) {
        await verifyWalletDetails(page, 'swing', walletKey, walletExpectation, stepName);
    }
    
    // Verify Hold wallets
    const holdWallets = step.output.wallets.hold;
    const holdCount = Object.keys(holdWallets).length;
    await verifyWalletCounts(page, 'hold', holdCount, stepName);
    
    for (const [walletKey, walletExpectation] of Object.entries(holdWallets)) {
        await verifyWalletDetails(page, 'hold', walletKey, walletExpectation, stepName);
    }
    
    console.log(`[DeleteTransaction] ✅ All wallet verifications passed for ${stepName}`);
}

// Enhanced overview verification function
async function verifyOverview(
    page: any,
    expectedOverview: OverviewExpectation,
    stepName: string
): Promise<void> {
    console.log(`[OverviewHelper] Verifying overview for ${stepName}...`);
    
    // Ensure overview section is expanded
    const overviewHeader = page.locator('[data-testid="overview-toggle"]');
    await expect(overviewHeader).toBeVisible();
    
    // Check if overview is collapsed and expand it if needed
    const overviewExpanded = await page.locator('[data-testid="overview-settings-budget"]').isVisible().catch(() => false);
    if (!overviewExpanded) {
        await overviewHeader.click();
        await page.waitForLoadState('networkidle');
    }
    
    // Verify Settings section
    console.log(`[OverviewHelper] Verifying Settings section...`);
    await expect(page.locator('[data-testid="overview-settings-budget"]')).toHaveText(formatCurrency(expectedOverview.settings.budget));
    await expect(page.locator('[data-testid="overview-settings-invested"]')).toHaveText(formatCurrency(expectedOverview.settings.invested));
    await expect(page.locator('[data-testid="overview-settings-pdp"]')).toHaveText(expectedOverview.settings.pdp);
    await expect(page.locator('[data-testid="overview-settings-shr"]')).toHaveText(expectedOverview.settings.shr);
    await expect(page.locator('[data-testid="overview-settings-stp"]')).toHaveText(expectedOverview.settings.stp);
    await expect(page.locator('[data-testid="overview-settings-htp"]')).toHaveText(expectedOverview.settings.htp);
    console.log(`[OverviewHelper] ✅ Settings section verified`);
    
    // Verify Transactions & Shares section  
    console.log(`[OverviewHelper] Verifying Transactions & Shares section...`);
    await expect(page.locator('[data-testid="overview-txns-buys"]')).toHaveText(expectedOverview.txnsAndShares.buys.toString());
    await expect(page.locator('[data-testid="overview-txns-total-sells"]')).toHaveText(expectedOverview.txnsAndShares.totalSells.toString());
    await expect(page.locator('[data-testid="overview-txns-swing-sells"]')).toHaveText(expectedOverview.txnsAndShares.swingSells.toString());
    await expect(page.locator('[data-testid="overview-txns-hold-sells"]')).toHaveText(expectedOverview.txnsAndShares.holdSells.toString());
    await expect(page.locator('[data-testid="overview-shares-swing"]')).toHaveText(expectedOverview.txnsAndShares.swingShares);
    await expect(page.locator('[data-testid="overview-shares-hold"]')).toHaveText(expectedOverview.txnsAndShares.holdShares);
    await expect(page.locator('[data-testid="overview-shares-total"]')).toHaveText(expectedOverview.txnsAndShares.totalShares);
    console.log(`[OverviewHelper] ✅ Transactions & Shares section verified`);
    
    // Verify Realized P/L section
    console.log(`[OverviewHelper] Verifying Realized P/L section...`);
    await expect(page.locator('[data-testid="overview-realized-swing-pl-dollars"]')).toHaveText(expectedOverview.realizedPL.swingDollars);
    await expect(page.locator('[data-testid="overview-realized-swing-pl-percent"]')).toHaveText(expectedOverview.realizedPL.swingPercent);
    await expect(page.locator('[data-testid="overview-realized-hold-pl-dollars"]')).toHaveText(expectedOverview.realizedPL.holdDollars);
    await expect(page.locator('[data-testid="overview-realized-hold-pl-percent"]')).toHaveText(expectedOverview.realizedPL.holdPercent);
    await expect(page.locator('[data-testid="overview-realized-stock-pl-dollars"]')).toHaveText(expectedOverview.realizedPL.stockDollars);
    await expect(page.locator('[data-testid="overview-realized-stock-pl-percent"]')).toHaveText(expectedOverview.realizedPL.stockPercent);
    console.log(`[OverviewHelper] ✅ Realized P/L section verified`);
    
    console.log(`[OverviewHelper] ✅ All overview verifications passed for ${stepName}`);
}

// Initial settings verification function (after stock creation)
async function verifyInitialSettings(
    page: any,
    stockConfig: any
): Promise<void> {
    console.log(`[OverviewHelper] Verifying initial settings after stock creation...`);
    
    // Ensure overview section is expanded
    const overviewHeader = page.locator('[data-testid="overview-toggle"]');
    await expect(overviewHeader).toBeVisible();
    
    // Check if overview is collapsed and expand it if needed
    const overviewExpanded = await page.locator('[data-testid="overview-settings-budget"]').isVisible().catch(() => false);
    if (!overviewExpanded) {
        await overviewHeader.click();
        await page.waitForLoadState('networkidle');
    }
    
    // Verify initial settings match stock configuration
    await expect(page.locator('[data-testid="overview-settings-budget"]')).toHaveText(formatCurrency(stockConfig.budget));
    await expect(page.locator('[data-testid="overview-settings-invested"]')).toHaveText(formatCurrency(0)); // Should be $0.00 initially
    await expect(page.locator('[data-testid="overview-settings-pdp"]')).toHaveText(`${stockConfig.pdp}%`);
    await expect(page.locator('[data-testid="overview-settings-shr"]')).toHaveText(`${stockConfig.swingHoldRatio}% Swing`);
    await expect(page.locator('[data-testid="overview-settings-stp"]')).toHaveText(`${stockConfig.stp}%`);
    await expect(page.locator('[data-testid="overview-settings-htp"]')).toHaveText(stockConfig.htp != null && stockConfig.htp > 0 ? `${stockConfig.htp}%` : '-');
    
    // Verify initial transaction counts are zero
    await expect(page.locator('[data-testid="overview-txns-buys"]')).toHaveText('0');
    await expect(page.locator('[data-testid="overview-txns-total-sells"]')).toHaveText('0');
    await expect(page.locator('[data-testid="overview-shares-total"]')).toHaveText('0.00000');
    
    console.log(`[OverviewHelper] ✅ Initial settings verification completed`);
}

test.describe('Wallet Page - Delete Transactions and Verify Wallets (JSON-driven)', () => {
    
    // Generate tests for Split, Swing, and Hold transactions
    const transactionTypes = ['Split', 'Swing', 'Hold'];
    
    transactionTypes.forEach((transactionType) => {
        test(`Delete ${transactionType} Transaction - Create, Delete, Verify Wallet State`, async ({ page }) => {
            const scenarioName = `Delete${transactionType}`;
            const addStepKey = `${transactionType}TransactionAdd`;
            const deleteStepKey = `${transactionType}TransactionDelete`;
            
            const addStep = testConfig.transactions[addStepKey];
            const deleteStep = testConfig.transactions[deleteStepKey];
            
            if (!addStep || !deleteStep) {
                throw new Error(`Missing configuration for ${scenarioName}: addStep=${!!addStep}, deleteStep=${!!deleteStep}`);
            }
            
            console.log(`[${scenarioName}] Starting test...`);
            
            // Create unique stock symbol for this test iteration to avoid conflicts with parallel workers
            const uniqueStockSymbol = `${testConfig.stock.symbol}${transactionType.toUpperCase()}`;
            const stockConfig = { ...testConfig.stock, symbol: uniqueStockSymbol };
            let testPortfolioStockId: string | null = null;
            
            try {
                // Setup: Clear browser state and login
                console.log(`[${scenarioName}] Setting up fresh session...`);
                await clearBrowserState(page);
                await loginUser(page, E2E_TEST_USERNAME);
                console.log(`[${scenarioName}] Login successful.`);
                
                // Create test stock for this specific iteration
                console.log(`[${scenarioName}] Creating test stock ${uniqueStockSymbol} via UI...`);
                
                await createStockViaUI(page, {
                    symbol: stockConfig.symbol,
                    name: `${stockConfig.name} ${transactionType}`,
                    stockType: stockConfig.stockType as 'Stock' | 'ETF' | 'Crypto',
                    region: stockConfig.region as 'APAC' | 'EU' | 'Intl' | 'US',
                    pdp: stockConfig.pdp,
                    stp: stockConfig.stp,
                    budget: stockConfig.budget,
                    swingHoldRatio: stockConfig.swingHoldRatio,
                    stockCommission: stockConfig.stockCommission,
                    htp: stockConfig.htp || null,
                    marketCategory: stockConfig.marketCategory,
                    riskGrowthProfile: stockConfig.riskGrowthProfile,
                    owner: E2E_TEST_USER_OWNER_ID
                } as any);
                
                const portfolioStock = await getPortfolioStockBySymbol(stockConfig.symbol);
                if (!portfolioStock) {
                    throw new Error(`Portfolio stock not found for symbol: ${stockConfig.symbol}`);
                }
                testPortfolioStockId = portfolioStock.id;
                console.log(`[${scenarioName}] Stock created via UI with ID: ${testPortfolioStockId}`);

            // Navigate to wallet page
            console.log(`[${scenarioName}] Navigating to wallet page for ${stockConfig.symbol} (ID: ${testPortfolioStockId})...`);
            await navigateToStockWalletPage(page, testPortfolioStockId!, stockConfig.symbol);
            console.log(`[${scenarioName}] Successfully on wallet page for ${stockConfig.symbol}.`);
            
            // Clean up any existing wallets/transactions first
            try {
                await deleteStockWalletsForStockByStockId(testPortfolioStockId!);
                await deleteTransactionsForStockByStockId(testPortfolioStockId!);
                await page.reload();
                
                const titleElement = page.locator('[data-testid="wallet-page-title"]');
                await expect(titleElement).toBeVisible({ timeout: 15000 });
            } catch (error) {
                console.warn(`[${scenarioName}] Warning during initial cleanup:`, error);
            }
            
            // Step 1: Verify no initial wallets or transactions exist
            console.log(`[${scenarioName}] Step 1: Verifying no transactions or wallets exist...`);
            await verifyWalletCounts(page, 'swing', 0, 'initially');
            await verifyWalletCounts(page, 'hold', 0, 'initially');
            
            // Verify initial settings in Overview section
            console.log(`[${scenarioName}] Step 1.5: Verifying initial settings in Overview section...`);
            await verifyInitialSettings(page, stockConfig);
            
            // Step 2: Add the transaction
            console.log(`[${scenarioName}] Step 2: Adding ${transactionType} transaction...`);
            
            await addTransaction(page, {
                date: addStep.input.date!,
                type: addStep.input.type!,
                signal: addStep.input.signal!,
                price: addStep.input.price!,
                investment: addStep.input.investment!
            });
            
            // Step 3: Verify wallets after transaction creation
            console.log(`[${scenarioName}] Step 3: Verifying wallets after transaction creation...`);
            
            // Reload page to ensure wallets are loaded properly
            await page.reload();
            
            // Wait for page to be ready after reload
            const titleElement = page.locator('[data-testid="wallet-page-title"]');
            await expect(titleElement).toBeVisible({ timeout: 15000 });
            await expect(titleElement).toContainText(stockConfig.symbol.toUpperCase(), { timeout: 5000 });
            
            // Wait for wallets table to be loaded or no-wallets message to appear
            const walletsTable = page.locator('[data-testid="wallets-table"]');
            const noWalletsMessage = page.locator('[data-testid="wallet-notfound-display"]');
            await Promise.race([
                expect(walletsTable).toBeVisible({ timeout: 10000 }),
                expect(noWalletsMessage).toBeVisible({ timeout: 10000 })
            ]).catch(() => {
                // If neither appears within timeout, continue - the specific wallet verification will catch any issues
                console.log('[PageHelper] Wallet content still loading, continuing with verification...');
            });
            
            await verifyTransactionStepWallets(page, addStep, `${transactionType}TransactionAdd`);
            
            // Verify overview after transaction creation
            if (addStep.output.overview) {
                console.log(`[${scenarioName}] Step 3.5: Verifying overview after transaction creation...`);
                await verifyOverview(page, addStep.output.overview, `${transactionType}TransactionAdd`);
            }
            
            // Step 4: Delete the transaction
            console.log(`[${scenarioName}] Step 4: Deleting the transaction...`);
            await deleteTransaction(page);
            
            // Step 5: Verify wallets after deletion
            console.log(`[${scenarioName}] Step 5: Verifying wallets after transaction deletion...`);
            await verifyTransactionStepWallets(page, deleteStep, `${transactionType}TransactionDelete`);
            
            // Verify overview after transaction deletion
            if (deleteStep.output.overview) {
                console.log(`[${scenarioName}] Step 5.5: Verifying overview after transaction deletion...`);
                await verifyOverview(page, deleteStep.output.overview, `${transactionType}TransactionDelete`);
            }
            
            // Step 6: Verify no transactions remain
            console.log(`[${scenarioName}] Step 6: Verifying no transactions remain...`);
            const noTransactionsMessage = page.locator('[data-testid="wallets-transaction-table-no-transactions-message"]');
            await expect(noTransactionsMessage).toBeVisible();
            await expect(noTransactionsMessage).toContainText('No transactions found for this stock.');
            console.log(`[${scenarioName}] Transaction removal confirmed.`);
            
            console.log(`[${scenarioName}] Test completed successfully!`);
            
            } finally {
                // Cleanup: Delete the test stock and its data
                if (testPortfolioStockId) {
                    console.log(`[${scenarioName}] Cleaning up test stock ${uniqueStockSymbol}...`);
                    try {
                        await deleteStockWalletsForStockByStockId(testPortfolioStockId);
                        await deleteTransactionsForStockByStockId(testPortfolioStockId);
                        await deletePortfolioStock(testPortfolioStockId);
                        console.log(`[${scenarioName}] Cleanup completed successfully.`);
                    } catch (error) {
                        console.error(`[${scenarioName}] Error during cleanup:`, error);
                    }
                }
            }
        });
    });
});
