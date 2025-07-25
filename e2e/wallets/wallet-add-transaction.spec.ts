// e2e/wallets/wallet-add-transaction-json.spec.ts
import { test, expect, Page } from '@playwright/test';
import { Amplify } from 'aws-amplify';
import amplifyOutputs from '../../amplify_outputs.json';

import { 
    clearBrowserState, 
    loginUser, 
    navigateToStockWalletPage,
    addTransaction
} from '../utils/pageHelpers';
import { 
    createPortfolioStock, 
    deleteStockWalletsForStockByStockId, 
    deletePortfolioStock, 
    deleteTransactionsForStockByStockId,
    type PortfolioStockCreateData
} from '../utils/dataHelpers';
import { loadAddTransactionTestData, AddTransactionTestConfig, WalletExpectation, TransactionStep, OverviewExpectation } from '../utils/jsonHelper';
import { E2E_TEST_USERNAME, E2E_TEST_USER_OWNER_ID } from '../utils/testCredentials';
import { SHARE_PRECISION, CURRENCY_PRECISION } from '../../app/config/constants';

// Configuration
const TEST_EMAIL = E2E_TEST_USERNAME;

// Configure Amplify
Amplify.configure(amplifyOutputs);

// Set test timeout to 60 seconds for reliable execution
test.setTimeout(60000);

// Formatting helper functions
function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
}

function formatShares(shares: number): string {
    return shares.toFixed(SHARE_PRECISION);
}

// Enhanced overview verification function
async function verifyOverview(
    page: Page,
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
    await expect(page.locator('[data-testid="overview-settings-budget"]')).toHaveText(formatCurrency(expectedOverview.settings.budget));
    await expect(page.locator('[data-testid="overview-settings-invested"]')).toHaveText(formatCurrency(expectedOverview.settings.invested));
    await expect(page.locator('[data-testid="overview-settings-pdp"]')).toHaveText(expectedOverview.settings.pdp);
    await expect(page.locator('[data-testid="overview-settings-shr"]')).toHaveText(expectedOverview.settings.shr);
    await expect(page.locator('[data-testid="overview-settings-plr"]')).toHaveText(expectedOverview.settings.plr);
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
    page: Page,
    stockConfig: any
): Promise<void> {
    console.log(`[OverviewHelper] Verifying initial settings after stock creation...`);
    
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
    await expect(page.locator('[data-testid="overview-settings-budget"]')).toHaveText(formatCurrency(stockConfig.budget));
    await expect(page.locator('[data-testid="overview-settings-invested"]')).toHaveText(formatCurrency(0)); // Should be $0.00 initially
    await expect(page.locator('[data-testid="overview-settings-pdp"]')).toHaveText(`${stockConfig.pdp}%`);
    await expect(page.locator('[data-testid="overview-settings-shr"]')).toHaveText(`${stockConfig.swingHoldRatio}% Swing`);
    await expect(page.locator('[data-testid="overview-settings-plr"]')).toHaveText(stockConfig.plr.toString());
    await expect(page.locator('[data-testid="overview-settings-htp"]')).toHaveText(`${stockConfig.htp || 0}%`);
    
    // Verify initial transaction counts are zero
    await expect(page.locator('[data-testid="overview-txns-buys"]')).toHaveText('0');
    await expect(page.locator('[data-testid="overview-txns-total-sells"]')).toHaveText('0');
    await expect(page.locator('[data-testid="overview-shares-total"]')).toHaveText('0.00000');
    
    console.log(`[OverviewHelper] ✅ Initial settings verification completed`);
}

// Enhanced wallet verification function
async function verifyWalletDetails(
    page: Page, 
    walletType: 'Swing' | 'Hold',
    expectedDetails: WalletExpectation,
    walletName: string,
    stepName: string
): Promise<void> {
    console.log(`[PageHelper] Verifying ${walletType} wallet details ${walletName} for ${stepName}...`);
    
    // Handle deleted wallets
    if (expectedDetails.deleted) {
        console.log(`[PageHelper] Verifying ${walletType} wallet with price $NaN does not exist ${walletName} for ${stepName}...`);
        const noWalletMessage = page.locator('[data-testid="wallet-notfound-display"]');
        await expect(noWalletMessage).toContainText(`No ${walletType} wallets with shares found for this stock.`, { timeout: 5000 });
        console.log(`[PageHelper] ✅ Confirmed ${walletType} wallet with price $NaN does not exist ${walletName} for ${stepName}`);
        return;
    }

    console.log(`[PageHelper] Expected: Buy Price=${formatCurrency(expectedDetails.buyPrice)}, Investment=${formatCurrency(expectedDetails.investment)}, Shares=${formatShares(expectedDetails.sharesLeft)}`);

    // Navigate to the appropriate wallet tab
    const tabButton = page.locator(`[data-testid="wallet-tab-${walletType}"]`);
    await tabButton.click();
    
    // Wait for page to settle after tab click
    await page.waitForLoadState('networkidle');

    // Get the wallet table
    const walletTable = page.locator('[data-testid="wallets-table"]');
    await expect(walletTable).toBeVisible({ timeout: 10000 });
    
    const tableRows = walletTable.locator('tbody tr');
    const rowCount = await tableRows.count();
    console.log(`[PageHelper] Searching ${rowCount} rows for wallet with price ${formatCurrency(expectedDetails.buyPrice)}`);
    
    let walletFound = false;
    
    for (let i = 0; i < rowCount; i++) {
        const row = tableRows.nth(i);
        
        // Check Buy Price
        const buyPriceCell = row.locator('[data-testid="wallet-buyPrice-display"]');
        const buyPriceText = await buyPriceCell.textContent();
        console.log(`[PageHelper] Row ${i}: Buy Price = ${buyPriceText}`);
        
        if (buyPriceText === formatCurrency(expectedDetails.buyPrice)) {
            console.log(`[PageHelper] Found matching buy price wallet, now verifying investment and shares...`);
            walletFound = true;
            
            // Check Investment
            const investmentCell = row.locator('[data-testid="wallet-totalInvestment-display"]');
            const investmentText = await investmentCell.textContent();
            console.log(`[PageHelper] Row ${i}: Investment = ${investmentText}, Expected = ${formatCurrency(expectedDetails.investment)}`);
            await expect(investmentCell).toHaveText(formatCurrency(expectedDetails.investment));
            
            // Check Remaining Shares
            const sharesCell = row.locator('[data-testid="wallet-remainingShares-display"]');
            const sharesText = await sharesCell.textContent();
            console.log(`[PageHelper] Row ${i}: Shares = ${sharesText}, Expected = ${formatShares(expectedDetails.sharesLeft)}`);
            await expect(sharesCell).toHaveText(formatShares(expectedDetails.sharesLeft));
            
            console.log(`[PageHelper] ✅ ${walletType} wallet verified: Buy Price=${formatCurrency(expectedDetails.buyPrice)}, Investment=${formatCurrency(expectedDetails.investment)}, Shares=${formatShares(expectedDetails.sharesLeft)}`);
            break;
        }
    }
    
    if (!walletFound) {
        throw new Error(`[PageHelper] ❌ ${walletType} wallet with Buy Price ${formatCurrency(expectedDetails.buyPrice)} not found for ${walletName} in ${stepName}`);
    }
}

// Helper function to verify wallet counts
async function verifyWalletCounts(
    page: Page, 
    walletType: 'Swing' | 'Hold',
    expectedCount: number,
    stepName: string
): Promise<void> {
    console.log(`[PageHelper] Verifying ${walletType} wallet count for ${stepName}...`);
    
    // Navigate to the appropriate wallet tab
    const tabButton = page.locator(`[data-testid="wallet-tab-${walletType}"]`);
    await tabButton.click();
    
    // Wait for page to settle after tab click
    await page.waitForLoadState('networkidle');

    if (expectedCount === 0) {
        // Expect no wallets message
        const noWalletMessage = page.locator('[data-testid="wallet-notfound-display"]');
        await expect(noWalletMessage).toContainText(`No ${walletType} wallets with shares found for this stock.`, { timeout: 5000 });
        console.log(`[PageHelper] ✅ Confirmed no ${walletType} wallets exist for ${stepName}`);
    } else {
        // Count actual wallets in table
        const walletTable = page.locator('[data-testid="wallets-table"]');
        await expect(walletTable).toBeVisible({ timeout: 10000 });
        
        const tableRows = walletTable.locator('tbody tr');
        const actualCount = await tableRows.count();
        
        if (actualCount !== expectedCount) {
            throw new Error(`[PageHelper] ❌ Expected ${expectedCount} ${walletType} wallets for ${stepName}, but found ${actualCount}`);
        }
        
        console.log(`[PageHelper] ✅ ${walletType} wallet count verified: ${actualCount} wallets for ${stepName}`);
    }
}

// Helper function to verify all wallets for a transaction step
async function verifyTransactionStepWallets(
    page: Page,
    step: TransactionStep,
    stepName: string
): Promise<void> {
    console.log(`[AddTransaction] Verifying wallets for ${stepName}...`);
    
    // Count expected wallets (excluding deleted ones)
    const expectedSwingWallets = Object.values(step.output.wallets.swing).filter(w => !w.deleted).length;
    const expectedHoldWallets = Object.values(step.output.wallets.hold).filter(w => !w.deleted).length;
    
    // Verify wallet counts
    await verifyWalletCounts(page, 'Swing', expectedSwingWallets, stepName);
    await verifyWalletCounts(page, 'Hold', expectedHoldWallets, stepName);
    
    // Verify individual wallet details
    for (const [walletName, expectedDetails] of Object.entries(step.output.wallets.swing)) {
        await verifyWalletDetails(page, 'Swing', expectedDetails, walletName, stepName);
    }
    
    for (const [walletName, expectedDetails] of Object.entries(step.output.wallets.hold)) {
        await verifyWalletDetails(page, 'Hold', expectedDetails, walletName, stepName);
    }
    
    console.log(`[AddTransaction] ✅ All wallet verifications passed for ${stepName}`);
}

// Test data
let testData: AddTransactionTestConfig;
let stockId: string;

test.describe('Wallet Add Transaction', () => {
    test.beforeAll(async () => {
        console.log('[BEFORE ALL] Starting test setup...');
        
        // Load test data from JSON
        testData = loadAddTransactionTestData('e2e/wallets/wallet-add-transaction.json');
        const scenario = testData;
        
        console.log(`[BEFORE ALL] Creating test stock ${scenario.stock.symbol}...`);
        
        const stockData: PortfolioStockCreateData = {
            symbol: scenario.stock.symbol,
            name: scenario.stock.name,
            stockType: scenario.stock.stockType,
            region: scenario.stock.region,
            pdp: scenario.stock.pdp,
            plr: scenario.stock.plr,
            budget: scenario.stock.budget,
            swingHoldRatio: scenario.stock.swingHoldRatio,
            stockCommission: scenario.stock.stockCommission,
            owner: E2E_TEST_USER_OWNER_ID,
        };
        
        const stock = await createPortfolioStock(stockData);
        stockId = stock.id;
        console.log(`[BEFORE ALL] Stock created successfully with ID: ${stockId}`);
    });

    test.beforeEach(async ({ page }) => {
        console.log('[BEFORE EACH] Starting fresh session setup...');
        
        // Clear browser state
        await clearBrowserState(page);
        console.log('[BEFORE EACH] Browser state cleared.');
        
        // Login
        console.log(`[BEFORE EACH] Attempting login as ${TEST_EMAIL}...`);
        await loginUser(page);
        console.log('[BEFORE EACH] Login successful.');
    });

    test.afterAll(async () => {
        console.log('[AFTER ALL] Starting cleanup...');
        
        console.log(`[AFTER ALL] Deleting wallets for stock ID ${stockId}...`);
        await deleteStockWalletsForStockByStockId(stockId);
        
        console.log(`[AFTER ALL] Deleting transactions for stock ID ${stockId}...`);
        await deleteTransactionsForStockByStockId(stockId);
        
        console.log(`[AFTER ALL] Deleting stock ${stockId}...`);
        await deletePortfolioStock(stockId);
        
        console.log('[AFTER ALL] Cleanup completed successfully.');
    });

    test('Add Transaction - Comprehensive Wallet Validations', async ({ page }) => {
        const scenario = testData;
        
        console.log('[AddTransaction] Starting test...');
        
        // Clean up any existing data
        await deleteStockWalletsForStockByStockId(stockId);
        await deleteTransactionsForStockByStockId(stockId);
        
        // Navigate to Portfolio page and then to Wallets page
        console.log('[AddTransaction] Step 1: Navigating to Portfolio page...');
        await page.goto('/portfolio');
        await page.waitForLoadState('networkidle');
        
        console.log('[AddTransaction] Step 2: Navigating to stock\'s Wallets page...');
        await navigateToStockWalletPage(page, stockId, scenario.stock.symbol);
        
        // Verify no transactions or wallets exist initially
        console.log('[AddTransaction] Step 3: Verifying no transactions or wallets exist...');
        
        // Check Swing wallet count initially
        await verifyWalletCounts(page, 'Swing', 0, 'initially');
        
        // Check Hold wallet count initially
        await verifyWalletCounts(page, 'Hold', 0, 'initially');
        
        // Verify initial settings in Overview section
        console.log('[AddTransaction] Step 3.5: Verifying initial settings in Overview section...');
        await verifyInitialSettings(page, scenario.stock);
        
        // Process each transaction in order
        let stepCounter = 4;
        for (const [transactionName, transactionStep] of Object.entries(scenario.transactions)) {
            console.log(`[AddTransaction] Step ${stepCounter}: Adding Transaction ${transactionName}...`);
            
            // Add the transaction
            await addTransaction(page, {
                date: transactionStep.input.date,
                type: transactionStep.input.type,
                signal: transactionStep.input.signal,
                price: transactionStep.input.price!,
                investment: transactionStep.input.investment!
            });
            
            stepCounter++;
            console.log(`[AddTransaction] Step ${stepCounter}: Verifying wallets after Transaction ${transactionName}...`);
            
            // Verify wallet state after this transaction
            await verifyTransactionStepWallets(page, transactionStep, transactionName);
            
            // Verify overview state after this transaction (if overview data exists)
            if (transactionStep.output.overview) {
                stepCounter++;
                console.log(`[AddTransaction] Step ${stepCounter}: Verifying overview after Transaction ${transactionName}...`);
                await verifyOverview(page, transactionStep.output.overview, transactionName);
            }
            
            stepCounter++;
        }
        
        console.log('[AddTransaction] Test completed successfully!');
    });
});
