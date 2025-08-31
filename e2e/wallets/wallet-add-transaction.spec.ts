// e2e/wallets/wallet-add-transaction-json.spec.ts
import { test, expect, Page } from '@playwright/test';
import { Amplify } from 'aws-amplify';
import amplifyOutputs from '../../amplify_outputs.json';

import { 
    clearBrowserState, 
    loginUser, 
    navigateToStockWalletPage,
    addTransaction,
    updateStockTestPrice,
    verifyStockTestPrice,
    refreshWalletsPage,
    createStockViaUI
} from '../utils/pageHelpers';
import { 
    createPortfolioStock, 
    deleteStockWalletsForStockByStockId, 
    deletePortfolioStock, 
    deleteTransactionsForStockByStockId,
    getPortfolioStockBySymbol,
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

/**
 * Adds an SLP or Dividend transaction via the UI modal.
 * @param page - The Playwright Page object.
 * @param transactionData - The transaction data containing action and amount.
 */
async function addIncomeTransaction(page: Page, transactionData: { action: 'SLP' | 'Div', amount: number, date?: string }) {
    console.log(`[PageHelper] Adding ${transactionData.action} income transaction:`, transactionData);
    
    // Open Add Transaction modal
    const addTransactionButton = page.locator('[data-testid="add-transaction-button"]');
    await expect(addTransactionButton).toBeVisible({ timeout: 10000 });
    await addTransactionButton.click();
    
    // Wait for the transaction modal to appear
    const transactionModal = page.locator('[data-testid="transaction-form-modal"]');
    await expect(transactionModal).toBeVisible({ timeout: 10000 });
    console.log(`[PageHelper] Add Transaction modal opened.`);
    
    // Fill transaction form
    const date = transactionData.date ? transactionData.date.split('T')[0] : new Date().toISOString().split('T')[0]; // Extract date part only
    await page.locator('[data-testid="txn-form-date"]').fill(date);
    
    // Select action (SLP or Div)
    await page.locator('[data-testid="txn-form-action"]').selectOption(transactionData.action);
    
    // Fill amount field (for SLP) or investment field (for Div)
    if (transactionData.action === 'SLP') {
        await page.locator('[data-testid="txn-form-amount"]').fill(transactionData.amount.toString());
    } else { // Div
        await page.locator('[data-testid="txn-form-investment"]').fill(transactionData.amount.toString());
    }
    
    console.log(`[PageHelper] Form filled: Date=${date}, Action=${transactionData.action}, Amount=${transactionData.amount}`);
    
    // Submit the form
    const submitButton = page.locator('[data-testid="txn-form-submit-button"]');
    await submitButton.click();
    
    // Wait for modal to close
    await expect(transactionModal).not.toBeVisible({ timeout: 15000 });
    console.log(`[PageHelper] ${transactionData.action} transaction created successfully.`);
    
    // Wait for transaction table to update instead of arbitrary timeout
    const transactionTable = page.locator('[data-testid*="wallets-transaction-table"], table').first();
    await expect(transactionTable).toBeVisible({ timeout: 10000 });
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
    
    // Verify Unrealized P/L section
    console.log(`[OverviewHelper] Verifying Unrealized P/L section...`);
    await expect(page.locator('[data-testid="overview-unrealized-swing-pl-dollars"]')).toHaveText(expectedOverview.unrealizedPL.swingDollars);
    await expect(page.locator('[data-testid="overview-unrealized-swing-pl-percent"]')).toHaveText(expectedOverview.unrealizedPL.swingPercent);
    await expect(page.locator('[data-testid="overview-unrealized-hold-pl-dollars"]')).toHaveText(expectedOverview.unrealizedPL.holdDollars);
    await expect(page.locator('[data-testid="overview-unrealized-hold-pl-percent"]')).toHaveText(expectedOverview.unrealizedPL.holdPercent);
    await expect(page.locator('[data-testid="overview-unrealized-stock-pl-dollars"]')).toHaveText(expectedOverview.unrealizedPL.stockDollars);
    await expect(page.locator('[data-testid="overview-unrealized-stock-pl-percent"]')).toHaveText(expectedOverview.unrealizedPL.stockPercent);
    console.log(`[OverviewHelper] ✅ Unrealized P/L section verified`);

    // Verify Combined P/L section
    console.log(`[OverviewHelper] Verifying Combined P/L section...`);
    await expect(page.locator('[data-testid="overview-combined-swing-pl-dollars"]')).toHaveText(expectedOverview.combinedPL.swingDollars);
    await expect(page.locator('[data-testid="overview-combined-swing-pl-percent"]')).toHaveText(expectedOverview.combinedPL.swingPercent);
    await expect(page.locator('[data-testid="overview-combined-hold-pl-dollars"]')).toHaveText(expectedOverview.combinedPL.holdDollars);
    await expect(page.locator('[data-testid="overview-combined-hold-pl-percent"]')).toHaveText(expectedOverview.combinedPL.holdPercent);
    await expect(page.locator('[data-testid="overview-combined-stock-pl-dollars"]')).toHaveText(expectedOverview.combinedPL.stockDollars);
    await expect(page.locator('[data-testid="overview-combined-stock-pl-percent"]')).toHaveText(expectedOverview.combinedPL.stockPercent);
    await expect(page.locator('[data-testid="overview-combined-income-pl-dollars"]')).toHaveText(expectedOverview.combinedPL.incomeDollars);
    console.log(`[OverviewHelper] ✅ Combined P/L section verified`);
    
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
    await expect(page.locator('[data-testid="overview-settings-stp"]')).toHaveText(`${stockConfig.stp}%`);
    await expect(page.locator('[data-testid="overview-settings-htp"]')).toHaveText(stockConfig.htp != null && stockConfig.htp > 0 ? `${stockConfig.htp}%` : '-');
    
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
        console.log('[BEFORE ALL] Test data loaded successfully.');
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
        
        // Get test data scenario
        const scenario = testData;
        
        // Clean up any existing test stock first
        try {
            const existingStock = await getPortfolioStockBySymbol(scenario.stock.symbol.toUpperCase());
            if (existingStock) {
                console.log(`[BEFORE EACH] Cleaning up existing stock ${scenario.stock.symbol}...`);
                await deleteStockWalletsForStockByStockId(existingStock.id);
                await deleteTransactionsForStockByStockId(existingStock.id);
                await deletePortfolioStock(existingStock.id);
                console.log(`[BEFORE EACH] Existing stock cleaned up.`);
            }
        } catch (error) {
            console.log(`[BEFORE EACH] No existing stock to clean up.`);
        }
        
        // Create stock via UI
        console.log(`[BEFORE EACH] Creating test stock ${scenario.stock.symbol} via UI...`);
        console.log(`[BEFORE EACH] Creating test stock ${scenario.stock.symbol} via UI...`);
        
        // Navigate to portfolio page first
        await page.goto('/portfolio');
        await page.waitForLoadState('networkidle');
        
        // Create stock using UI method
        await createStockViaUI(page, { 
            ...scenario.stock, 
            owner: E2E_TEST_USER_OWNER_ID 
        } as any);
        
        // Get the created stock ID for use in the test
        const createdStock = await getPortfolioStockBySymbol(scenario.stock.symbol.toUpperCase());
        if (!createdStock) {
            throw new Error(`[BEFORE EACH] Failed to find created stock ${scenario.stock.symbol}`);
        }
        stockId = createdStock.id;
        console.log(`[BEFORE EACH] Stock created via UI with ID: ${stockId}`);
    });

    test.afterEach(async () => {
        console.log('[AFTER EACH] Starting cleanup...');
        
        if (stockId) {
            console.log(`[AFTER EACH] Deleting wallets for stock ID ${stockId}...`);
            await deleteStockWalletsForStockByStockId(stockId);
            
            console.log(`[AFTER EACH] Deleting transactions for stock ID ${stockId}...`);
            await deleteTransactionsForStockByStockId(stockId);
            
            console.log(`[AFTER EACH] Deleting stock ${stockId}...`);
            await deletePortfolioStock(stockId);
            
            console.log('[AFTER EACH] Cleanup completed successfully.');
        }
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
        
        // Step 3: Set initial test price and verify initial state
        const initialPrice = scenario.testPriceUpdates.initialPrice;
        console.log(`[AddTransaction] ${initialPrice.step}: ${initialPrice.description}`);
        await updateStockTestPrice(page, scenario.stock.symbol, initialPrice.price);
        await verifyStockTestPrice(page, scenario.stock.symbol, initialPrice.price);
        console.log(`[AddTransaction] ✅ Initial test price set to $${initialPrice.price}`);
        
        // Verify no transactions or wallets exist initially
        console.log('[AddTransaction] Step 4: Verifying no transactions or wallets exist...');
        
        // Check Swing wallet count initially
        await verifyWalletCounts(page, 'Swing', 0, 'initially');
        
        // Check Hold wallet count initially
        await verifyWalletCounts(page, 'Hold', 0, 'initially');
        
        // Verify initial settings in Overview section
        console.log('[AddTransaction] Step 5: Verifying initial settings in Overview section...');
        await verifyInitialSettings(page, scenario.stock);
        
        // Step 6: Execute SplitBuyInitial transaction at $100
        console.log('[AddTransaction] Step 6: Adding SplitBuyInitial transaction...');
        const splitBuyStep = scenario.transactions.SplitBuyInitial;
        await addTransaction(page, {
            date: splitBuyStep.input.date,
            type: splitBuyStep.input.type!,
            signal: splitBuyStep.input.signal!,
            price: splitBuyStep.input.price!,
            investment: splitBuyStep.input.investment!
        });
        
        console.log('[AddTransaction] Step 7: Verifying wallets after SplitBuyInitial...');
        await verifyTransactionStepWallets(page, splitBuyStep, 'SplitBuyInitial');
        
        console.log('[AddTransaction] Step 8: Verifying overview after SplitBuyInitial...');
        await verifyOverview(page, splitBuyStep.output.overview!, 'SplitBuyInitial');
        
        // Step 9: Add SLP Income transaction (still at $100)
        console.log('[AddTransaction] Step 9: Adding SLP Income transaction...');
        const slpStep = scenario.transactions.SlpIncome;
        await addIncomeTransaction(page, {
            action: 'SLP',
            amount: slpStep.input.amount!,
            date: slpStep.input.date
        });
        
        console.log('[AddTransaction] Step 10: Verifying overview after SLP Income...');
        await verifyOverview(page, slpStep.output.overview!, 'SlpIncome');
        
        // Step 11: Update test price for next transaction
        const afterSlpPrice = scenario.testPriceUpdates.afterSlpIncome;
        console.log(`[AddTransaction] ${afterSlpPrice.step}: ${afterSlpPrice.description}`);
        await updateStockTestPrice(page, scenario.stock.symbol, afterSlpPrice.price);
        await verifyStockTestPrice(page, scenario.stock.symbol, afterSlpPrice.price);
        console.log(`[AddTransaction] ✅ Test price updated to $${afterSlpPrice.price}`);
        
        // Step 12: Execute SwingBuyCust transaction at $300
        console.log('[AddTransaction] Step 12: Adding SwingBuyCust transaction...');
        const swingBuyStep = scenario.transactions.SwingBuyCust;
        await addTransaction(page, {
            date: swingBuyStep.input.date,
            type: swingBuyStep.input.type!,
            signal: swingBuyStep.input.signal!,
            price: swingBuyStep.input.price!,
            investment: swingBuyStep.input.investment!
        });
        
        console.log('[AddTransaction] Step 13: Verifying wallets after SwingBuyCust...');
        await verifyTransactionStepWallets(page, swingBuyStep, 'SwingBuyCust');
        
        console.log('[AddTransaction] Step 14: Verifying overview after SwingBuyCust...');
        await verifyOverview(page, swingBuyStep.output.overview!, 'SwingBuyCust');
        
        // Step 15: Update test price for next transaction
        const afterSwingPrice = scenario.testPriceUpdates.afterSwingBuy;
        console.log(`[AddTransaction] ${afterSwingPrice.step}: ${afterSwingPrice.description}`);
        await updateStockTestPrice(page, scenario.stock.symbol, afterSwingPrice.price);
        await verifyStockTestPrice(page, scenario.stock.symbol, afterSwingPrice.price);
        console.log(`[AddTransaction] ✅ Test price updated to $${afterSwingPrice.price}`);
        
        // Step 16: Execute HoldBuyEOM transaction at $910
        console.log('[AddTransaction] Step 16: Adding HoldBuyEOM transaction...');
        const holdBuyStep = scenario.transactions.HoldBuyEOM;
        await addTransaction(page, {
            date: holdBuyStep.input.date,
            type: holdBuyStep.input.type!,
            signal: holdBuyStep.input.signal!,
            price: holdBuyStep.input.price!,
            investment: holdBuyStep.input.investment!
        });
        
        console.log('[AddTransaction] Step 17: Verifying wallets after HoldBuyEOM...');
        await verifyTransactionStepWallets(page, holdBuyStep, 'HoldBuyEOM');
        
        console.log('[AddTransaction] Step 18: Verifying overview after HoldBuyEOM...');
        await verifyOverview(page, holdBuyStep.output.overview!, 'HoldBuyEOM');
        
        // Step 19: Add Dividend Income transaction (still at $910)
        console.log('[AddTransaction] Step 19: Adding Dividend Income transaction...');
        const dividendStep = scenario.transactions.DividendIncome;
        await addIncomeTransaction(page, {
            action: 'Div',
            amount: dividendStep.input.investment!, // Dividend uses investment field
            date: dividendStep.input.date
        });
        
        console.log('[AddTransaction] Step 20: Verifying overview after Dividend Income...');
        await verifyOverview(page, dividendStep.output.overview!, 'DividendIncome');
        
        // Step 21: Update test price for final transaction
        const afterDividendPrice = scenario.testPriceUpdates.afterDividend;
        console.log(`[AddTransaction] ${afterDividendPrice.step}: ${afterDividendPrice.description}`);
        await updateStockTestPrice(page, scenario.stock.symbol, afterDividendPrice.price);
        await verifyStockTestPrice(page, scenario.stock.symbol, afterDividendPrice.price);
        console.log(`[AddTransaction] ✅ Test price updated to $${afterDividendPrice.price}`);
        
        // Step 22: Execute AnotherSplitBuy transaction at $510
        console.log('[AddTransaction] Step 22: Adding AnotherSplitBuy transaction...');
        const anotherSplitStep = scenario.transactions.AnotherSplitBuy;
        await addTransaction(page, {
            date: anotherSplitStep.input.date,
            type: anotherSplitStep.input.type!,
            signal: anotherSplitStep.input.signal!,
            price: anotherSplitStep.input.price!,
            investment: anotherSplitStep.input.investment!
        });
        
        console.log('[AddTransaction] Step 23: Verifying wallets after AnotherSplitBuy...');
        await verifyTransactionStepWallets(page, anotherSplitStep, 'AnotherSplitBuy');
        
        console.log('[AddTransaction] Step 24: Verifying final overview after AnotherSplitBuy...');
        await verifyOverview(page, anotherSplitStep.output.overview!, 'AnotherSplitBuy');
        
        console.log('[AddTransaction] ✅ Test completed successfully with comprehensive P/L verification!');
    });
});
