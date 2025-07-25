// e2e/wallets/wallet-same-price-transactions.spec.ts
import { test, expect } from '@playwright/test';
import {
    clearBrowserState,
    loginUser,
    addTransaction,
    navigateToStockWalletPage
} from '../utils/pageHelpers';
import { 
    PortfolioStockCreateData,
    createPortfolioStock,
    deletePortfolioStock,
    deleteStockWalletsForStockByStockId,
    deleteTransactionsForStockByStockId
} from '../utils/dataHelpers';
import { E2E_TEST_USER_OWNER_ID, E2E_TEST_USERNAME } from '../utils/testCredentials';
import { Amplify } from 'aws-amplify';
import amplifyOutputs from '../../amplify_outputs.json';
import {
    SHARE_PRECISION,
    CURRENCY_PRECISION,
} from '../../app/config/constants';
import { formatCurrency, formatShares } from '../../app/utils/financialCalculations';
import { formatToMDYYYY } from '../../app/utils/dateFormatter';
import { 
    loadSamePriceTransactionTestData, 
    SamePriceTransactionTestConfig,
    TransactionStep,
    WalletExpectation,
    OverviewExpectation
} from '../utils/jsonHelper';

// Configure Amplify
try {
    Amplify.configure(amplifyOutputs);
    console.log('[wallet-same-price-transactions.spec.ts] - Amplify configured successfully.');
} catch (error) {
    console.error('[wallet-same-price-transactions.spec.ts] - CRITICAL: Error configuring Amplify:', error);
}

// Set test timeout to 60 seconds for reliable execution
test.setTimeout(60000);

// Load test configuration from JSON
const testConfig = loadSamePriceTransactionTestData('e2e/wallets/wallet-same-price-transactions.json');

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
async function verifyStockInPortfolioTable(page: any, stockSymbol: string) {
    console.log('[PageHelper] Verifying stock in portfolio table...');
    
    const symbol = stockSymbol.toUpperCase();
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

// Helper function to verify transaction count
async function verifyTransactionCount(page: any, expectedCount: number) {
    console.log(`[PageHelper] Verifying transaction count: ${expectedCount}...`);
    
    if (expectedCount === 0) {
        await verifyNoTransactionsExist(page);
    } else {
        const transactionRows = page.locator('[data-testid="wallets-transaction-table-transaction-row"]');
        await expect(transactionRows).toHaveCount(expectedCount);
    }
    
    console.log(`[PageHelper] Transaction count verified: ${expectedCount}`);
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

// Helper function to verify wallet details
async function verifyWalletDetails(page: any, walletType: 'Swing' | 'Hold', expectedWallets: Record<string, WalletExpectation>) {
    console.log(`[PageHelper] Verifying ${walletType} wallet details...`);
    
    const tab = page.locator(`[data-testid="wallet-tab-${walletType}"]`);
    await expect(tab).toBeVisible({ timeout: 5000 });
    await tab.click();
    await page.waitForTimeout(1000);
    
    const walletKeys = Object.keys(expectedWallets);
    
    if (walletKeys.length === 0) {
        const notFoundMessage = page.locator('[data-testid="wallet-notfound-display"]');
        await expect(notFoundMessage).toBeVisible({ timeout: 10000 });
        await expect(notFoundMessage).toContainText(`No ${walletType} wallets with shares found for this stock.`);
        console.log(`[PageHelper] Confirmed no ${walletType} wallets exist.`);
        return;
    }
    
    const walletsTable = page.locator('[data-testid="wallets-table"]');
    await expect(walletsTable).toBeVisible({ timeout: 5000 });
    
    for (let i = 0; i < walletKeys.length; i++) {
        const walletKey = walletKeys[i];
        const expectedWallet = expectedWallets[walletKey];
        
        console.log(`[PageHelper] Verifying ${walletType} wallet ${i + 1}: Buy Price $${expectedWallet.buyPrice}, Shares ${expectedWallet.sharesLeft}`);
        
        const walletRow = walletsTable.locator('tbody tr').nth(i);
        await expect(walletRow).toBeVisible({ timeout: 5000 });
        
        const buyPriceCell = walletRow.locator('[data-testid="wallet-buyPrice-display"]');
        await expect(buyPriceCell).toHaveText(formatCurrency(expectedWallet.buyPrice));
        
        const remainingSharesCell = walletRow.locator('[data-testid="wallet-remainingShares-display"]');
        await expect(remainingSharesCell).toHaveText(formatShares(expectedWallet.sharesLeft, SHARE_PRECISION));
    }
    
    console.log(`[PageHelper] ${walletType} wallet details verified successfully.`);
}

// Helper function to verify wallet counts
async function verifyWalletCounts(page: any, expectedSwingCount: number, expectedHoldCount: number) {
    console.log(`[PageHelper] Verifying wallet counts - Swing: ${expectedSwingCount}, Hold: ${expectedHoldCount}...`);
    
    const actualSwingCount = await countWalletRows(page, 'Swing');
    const actualHoldCount = await countWalletRows(page, 'Hold');
    
    expect(actualSwingCount).toBe(expectedSwingCount);
    expect(actualHoldCount).toBe(expectedHoldCount);
    
    console.log(`[PageHelper] Wallet counts verified successfully.`);
}

// Helper function to verify transaction step wallets
async function verifyTransactionStepWallets(page: any, step: TransactionStep) {
    console.log('[PageHelper] Verifying transaction step wallet state...');
    
    await verifyWalletDetails(page, 'Swing', step.output.wallets.swing);
    await verifyWalletDetails(page, 'Hold', step.output.wallets.hold);
    
    const expectedSwingCount = Object.keys(step.output.wallets.swing).length;
    const expectedHoldCount = Object.keys(step.output.wallets.hold).length;
    await verifyWalletCounts(page, expectedSwingCount, expectedHoldCount);
    
    console.log('[PageHelper] Transaction step wallet state verified successfully.');
}

// Enhanced overview verification function
async function verifyOverview(
    page: any,
    expectedOverview: OverviewExpectation,
    stepName: string
): Promise<void> {
    console.log(`[OverviewHelper] Verifying overview for ${stepName}...`);
    
    // Ensure overview section is expanded
    const overviewHeader = page.locator('p').filter({ hasText: 'Overview' });
    await expect(overviewHeader).toBeVisible();
    
    // Check if overview is collapsed and expand it if needed
    const overviewExpanded = await page.locator('[data-testid="overview-settings-budget"]').isVisible().catch(() => false);
    if (!overviewExpanded) {
        await overviewHeader.click();
        await page.waitForLoadState('networkidle');
    }
    
    // Verify Settings section
    console.log(`[OverviewHelper] Verifying Settings section...`);
    await expect(page.locator('[data-testid="overview-settings-budget"]')).toContainText(`${expectedOverview.settings.budget.toFixed(0)}`);
    await expect(page.locator('[data-testid="overview-settings-invested"]')).toContainText(`${expectedOverview.settings.invested.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`);
    await expect(page.locator('[data-testid="overview-settings-pdp"]')).toContainText(`${expectedOverview.settings.pdp}%`);
    await expect(page.locator('[data-testid="overview-settings-shr"]')).toContainText(`${expectedOverview.settings.shr}%`);
    await expect(page.locator('[data-testid="overview-settings-plr"]')).toContainText(`${expectedOverview.settings.plr}`);
    await expect(page.locator('[data-testid="overview-settings-htp"]')).toContainText(`${expectedOverview.settings.htp}`);
    console.log(`[OverviewHelper] ✅ Settings section verified`);
    
    // Verify Transactions & Shares section
    console.log(`[OverviewHelper] Verifying Transactions & Shares section...`);
    await expect(page.locator('[data-testid="overview-txns-buys"]')).toContainText(`${expectedOverview.txnsAndShares.buys}`);
    await expect(page.locator('[data-testid="overview-txns-total-sells"]')).toContainText(`${expectedOverview.txnsAndShares.totalSells}`);
    await expect(page.locator('[data-testid="overview-txns-swing-sells"]')).toContainText(`${expectedOverview.txnsAndShares.swingSells}`);
    await expect(page.locator('[data-testid="overview-txns-hold-sells"]')).toContainText(`${expectedOverview.txnsAndShares.holdSells}`);
    await expect(page.locator('[data-testid="overview-shares-swing"]')).toContainText(`${expectedOverview.txnsAndShares.swingShares}`);
    await expect(page.locator('[data-testid="overview-shares-hold"]')).toContainText(`${expectedOverview.txnsAndShares.holdShares}`);
    await expect(page.locator('[data-testid="overview-shares-total"]')).toContainText(`${expectedOverview.txnsAndShares.totalShares}`);
    console.log(`[OverviewHelper] ✅ Transactions & Shares section verified`);
    
    // Verify Realized P/L section
    console.log(`[OverviewHelper] Verifying Realized P/L section...`);
    await expect(page.locator('[data-testid="overview-realized-swing-pl-dollars"]')).toContainText(`${expectedOverview.realizedPL.swingDollars}`);
    await expect(page.locator('[data-testid="overview-realized-hold-pl-dollars"]')).toContainText(`${expectedOverview.realizedPL.holdDollars}`);
    await expect(page.locator('[data-testid="overview-realized-stock-pl-dollars"]')).toContainText(`${expectedOverview.realizedPL.stockDollars}`);
    console.log(`[OverviewHelper] ✅ Realized P/L section verified`);
    
    console.log(`[OverviewHelper] ✅ All overview verifications passed for ${stepName}`);
}

// Helper function to verify initial settings after stock creation
async function verifyInitialSettings(page: any, stockConfig: any): Promise<void> {
    console.log('[OverviewHelper] Verifying initial settings after stock creation...');
    
    // Ensure overview section is expanded
    const overviewHeader = page.locator('p').filter({ hasText: 'Overview' });
    await expect(overviewHeader).toBeVisible();
    
    // Check if overview is collapsed and expand it if needed
    const overviewExpanded = await page.locator('[data-testid="overview-settings-budget"]').isVisible().catch(() => false);
    if (!overviewExpanded) {
        await overviewHeader.click();
        await page.waitForLoadState('networkidle');
    }
    
    // Verify initial settings match stock configuration
    await expect(page.locator('[data-testid="overview-settings-budget"]')).toContainText(`$${stockConfig.budget.toFixed(2)}`);
    await expect(page.locator('[data-testid="overview-settings-invested"]')).toContainText('$0.00');
    await expect(page.locator('[data-testid="overview-settings-pdp"]')).toContainText(`${stockConfig.pdp}%`);
    await expect(page.locator('[data-testid="overview-settings-shr"]')).toContainText(`${stockConfig.swingHoldRatio}%`);
    await expect(page.locator('[data-testid="overview-settings-plr"]')).toContainText(`${stockConfig.plr}`);
    await expect(page.locator('[data-testid="overview-settings-htp"]')).toContainText(`${stockConfig.htp}`);
    
    console.log('[OverviewHelper] ✅ Initial settings verification completed');
}

// Test Suite
test.describe('Wallet Same Price Transactions (JSON-driven)', () => {
    let testPortfolioStockId: string | null = null;
    let testStockSymbol: string | null = null;

    test.beforeAll(async () => {
        console.log('[BEFORE ALL] Starting test setup...');
        
        testStockSymbol = testConfig.stock.symbol;
        
        console.log(`[BEFORE ALL] Creating test stock ${testStockSymbol}...`);
        
        const stockData: PortfolioStockCreateData = {
            owner: E2E_TEST_USER_OWNER_ID,
            symbol: testConfig.stock.symbol,
            name: testConfig.stock.name,
            stockType: testConfig.stock.stockType,
            region: testConfig.stock.region,
            pdp: testConfig.stock.pdp,
            plr: testConfig.stock.plr,
            budget: testConfig.stock.budget,
            swingHoldRatio: testConfig.stock.swingHoldRatio,
            stockCommission: testConfig.stock.stockCommission,
            htp: testConfig.stock.htp
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

    test(`${testConfig.scenario} - Test Same Price Transaction Behavior`, async ({ page }) => {
        console.log(`[${testConfig.scenario}] Starting test...`);

        // Clean up any existing data for this stock
        if (testPortfolioStockId) {
            try {
                await deleteStockWalletsForStockByStockId(testPortfolioStockId);
                await deleteTransactionsForStockByStockId(testPortfolioStockId);
            } catch (error) {
                console.warn(`[${testConfig.scenario}] Warning during cleanup:`, error);
            }
        }

        // Step 1: Navigate to Portfolio page and verify stock creation
        console.log(`[${testConfig.scenario}] Step 1: Navigating to Portfolio page...`);
        await navigateToPortfolioPage(page);
        await verifyStockInPortfolioTable(page, testConfig.stock.symbol);

        // Step 2: Navigate to stock's Wallets page
        console.log(`[${testConfig.scenario}] Step 2: Navigating to stock's Wallets page...`);
        if (!testPortfolioStockId || !testStockSymbol) {
            throw new Error('Stock not created properly');
        }
        await navigateToStockWalletPage(page, testPortfolioStockId, testStockSymbol);

        // Step 3: Verify no transactions or wallets exist
        console.log(`[${testConfig.scenario}] Step 3: Verifying no transactions or wallets exist...`);
        await verifyNoTransactionsExist(page);
        await verifyNoWalletsExist(page);

        // Step 3.5: Verify initial settings in Overview section
        console.log(`[${testConfig.scenario}] Step 3.5: Verifying initial settings in Overview section...`);
        await verifyInitialSettings(page, testConfig.stock);

        // Execute all transactions sequentially
        const transactionKeys = Object.keys(testConfig.transactions);
        let transactionCount = 0;

        for (let i = 0; i < transactionKeys.length; i++) {
            const transactionKey = transactionKeys[i];
            const transaction = testConfig.transactions[transactionKey];
            transactionCount++;

            console.log(`[${testConfig.scenario}] Step ${4 + i * 2}: Adding ${transactionKey}...`);
            await addTransaction(page, {
                date: transaction.input.date,
                type: transaction.input.type,
                signal: transaction.input.signal,
                price: transaction.input.price!,
                investment: transaction.input.investment!
            });

            console.log(`[${testConfig.scenario}] Step ${5 + i * 2}: Verifying ${transactionKey} results...`);
            
            // Verify transaction count
            await verifyTransactionCount(page, transactionCount);
            
            // Verify wallet states
            await verifyTransactionStepWallets(page, transaction);
            
            // Verify overview after transaction
            if (transaction.output.overview) {
                console.log(`[${testConfig.scenario}] Step ${5 + i * 2}.5: Verifying overview after ${transactionKey}...`);
                await verifyOverview(page, transaction.output.overview, transactionKey);
            }

            // For transactions after the first, verify wallet counts haven't increased (same price consolidation)
            if (i > 0) {
                const expectedSwingCount = Object.keys(transaction.output.wallets.swing).length;
                const expectedHoldCount = Object.keys(transaction.output.wallets.hold).length;
                const firstTransactionSwingCount = Object.keys(testConfig.transactions[transactionKeys[0]].output.wallets.swing).length;
                const firstTransactionHoldCount = Object.keys(testConfig.transactions[transactionKeys[0]].output.wallets.hold).length;
                
                console.log(`[${testConfig.scenario}] Verifying no new wallets created for ${transactionKey}...`);
                expect(expectedSwingCount).toBe(firstTransactionSwingCount);
                expect(expectedHoldCount).toBe(firstTransactionHoldCount);
                console.log(`[${testConfig.scenario}] Confirmed wallet consolidation for ${transactionKey}.`);
            }
        }

        console.log(`[${testConfig.scenario}] Test completed successfully!`);
    });
});
