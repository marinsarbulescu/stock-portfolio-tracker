// e2e/wallets/wallet-update-transactions-price.spec.ts
import { test, expect, Page } from '@playwright/test';
import { Amplify } from 'aws-amplify';
import amplifyOutputs from '../../amplify_outputs.json';

import { 
    clearBrowserState, 
    loginUser, 
    navigateToStockWalletPage,
    addTransaction,
    TransactionData
} from '../utils/pageHelpers';
import { 
    createPortfolioStock, 
    deleteStockWalletsForStockByStockId, 
    deleteTransactionsForStockByStockId, 
    deletePortfolioStock,
    type PortfolioStockCreateData
} from '../utils/dataHelpers';
import { loadTestData, TestConfig, WalletExpectation, TransactionStep } from '../utils/jsonHelper';
import { E2E_TEST_USERNAME, E2E_TEST_USER_OWNER_ID } from '../utils/testCredentials';
import { SHARE_PRECISION, CURRENCY_PRECISION } from '../../app/config/constants';

// Configuration
const TEST_EMAIL = E2E_TEST_USERNAME;

// Configure Amplify
Amplify.configure(amplifyOutputs);

// Formatting helper functions
function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}

function formatShares(amount: number, precision: number = SHARE_PRECISION): string {
    return amount.toFixed(precision);
}

// Helper function to navigate to portfolio page
async function navigateToPortfolioPage(page: Page) {
    console.log('[PageHelper] Navigating to Portfolio page...');
    await page.goto('/portfolio');
    const portfolioLink = page.locator('nav a:has-text("Portfolio")');
    await expect(portfolioLink).toBeVisible({ timeout: 15000 });
    await portfolioLink.click();
    
    const pageTitle = page.locator('[data-testid="portfolio-page-title"]');
    await expect(pageTitle).toBeVisible({ timeout: 15000 });
    await expect(pageTitle).toHaveText('Portfolio');
    console.log('[PageHelper] Successfully navigated to Portfolio page.');
}

// Helper function to verify stock in portfolio table
async function verifyStockInPortfolioTable(page: Page, symbol: string) {
    console.log('[PageHelper] Verifying stock in portfolio table...');
    
    const symbolLink = page.locator(`[data-testid="portfolio-page-table-wallet-link-${symbol}"]`);
    await expect(symbolLink).toBeVisible({ timeout: 15000 });
    await expect(symbolLink).toHaveText(symbol);
    
    console.log('[PageHelper] Stock verified in portfolio table.');
}

// Enhanced wallet verification functions
interface WalletDetails {
    buyPrice: number;
    investment: number;
    sharesLeft: number;
}

async function verifyWalletDetails(
    page: Page, 
    walletType: 'Swing' | 'Hold', 
    expectedDetails: WalletExpectation,
    description: string = ''
) {
    console.log(`[PageHelper] Verifying ${walletType} wallet details${description ? ' ' + description : ''}...`);
    console.log(`[PageHelper] Expected: Buy Price=${formatCurrency(expectedDetails.buyPrice)}, Investment=${formatCurrency(expectedDetails.investment)}, Shares=${formatShares(expectedDetails.sharesLeft)}`);
    
    const tab = page.locator(`[data-testid="wallet-tab-${walletType}"]`);
    await expect(tab).toBeVisible({ timeout: 5000 });
    await tab.click();
    await page.waitForTimeout(1000);
    
    const notFoundMessage = page.locator('[data-testid="wallet-notfound-display"]');
    await expect(notFoundMessage).not.toBeVisible({ timeout: 5000 });
    
    const walletsTable = page.locator('[data-testid="wallets-table"]');
    await expect(walletsTable).toBeVisible({ timeout: 5000 });
    
    // Find the specific wallet row with the expected price
    const walletRows = walletsTable.locator('tbody tr');
    const rowCount = await walletRows.count();
    
    console.log(`[PageHelper] Searching ${rowCount} rows for wallet with price ${formatCurrency(expectedDetails.buyPrice)}`);
    
    let found = false;
    for (let i = 0; i < rowCount; i++) {
        const row = walletRows.nth(i);
        
        // Check Buy Price first
        const buyPriceCell = row.locator('[data-testid="wallet-buyPrice-display"]');
        const buyPriceText = await buyPriceCell.textContent();
        
        console.log(`[PageHelper] Row ${i}: Buy Price = ${buyPriceText}`);
        
        if (buyPriceText === formatCurrency(expectedDetails.buyPrice)) {
            console.log(`[PageHelper] Found matching buy price wallet, now verifying investment and shares...`);
            
            // Check Total Investment
            const investmentCell = row.locator('[data-testid="wallet-totalInvestment-display"]');
            const investmentText = await investmentCell.textContent();
            console.log(`[PageHelper] Row ${i}: Investment = ${investmentText}, Expected = ${formatCurrency(expectedDetails.investment)}`);
            await expect(investmentCell).toHaveText(formatCurrency(expectedDetails.investment));
            
            // Check Remaining Shares
            const sharesCell = row.locator('[data-testid="wallet-remainingShares-display"]');
            const sharesText = await sharesCell.textContent();
            console.log(`[PageHelper] Row ${i}: Shares = ${sharesText}, Expected = ${formatShares(expectedDetails.sharesLeft)}`);
            await expect(sharesCell).toHaveText(formatShares(expectedDetails.sharesLeft));
            
            console.log(`[PageHelper] ✅ ${walletType} wallet verified: Buy Price=${buyPriceText}, Investment=${investmentText}, Shares=${sharesText}`);
            found = true;
            break;
        }
    }
    
    if (!found) {
        throw new Error(`${walletType} wallet with buy price ${formatCurrency(expectedDetails.buyPrice)} not found${description ? ' ' + description : ''}`);
    }
}

async function verifyWalletCount(page: Page, walletType: 'Swing' | 'Hold', expectedCount: number, description: string = '') {
    console.log(`[PageHelper] Verifying ${walletType} wallet count${description ? ' ' + description : ''}...`);
    
    const tab = page.locator(`[data-testid="wallet-tab-${walletType}"]`);
    await expect(tab).toBeVisible({ timeout: 5000 });
    await tab.click();
    await page.waitForTimeout(1000);
    
    if (expectedCount === 0) {
        const notFoundMessage = page.locator('[data-testid="wallet-notfound-display"]');
        await expect(notFoundMessage).toBeVisible({ timeout: 5000 });
        console.log(`[PageHelper] ✅ Confirmed no ${walletType} wallets exist${description ? ' ' + description : ''}`);
        return;
    }
    
    const notFoundMessage = page.locator('[data-testid="wallet-notfound-display"]');
    await expect(notFoundMessage).not.toBeVisible({ timeout: 5000 });
    
    const walletsTable = page.locator('[data-testid="wallets-table"]');
    await expect(walletsTable).toBeVisible({ timeout: 5000 });
    
    const walletRows = walletsTable.locator('tbody tr');
    const actualCount = await walletRows.count();
    
    expect(actualCount).toBe(expectedCount);
    console.log(`[PageHelper] ✅ ${walletType} wallet count verified: ${actualCount} wallets${description ? ' ' + description : ''}`);
}

async function verifyWalletDoesNotExistWithPrice(page: Page, walletType: 'Swing' | 'Hold', price: number, description: string = '') {
    console.log(`[PageHelper] Verifying ${walletType} wallet with price ${formatCurrency(price)} does not exist${description ? ' ' + description : ''}...`);
    
    const tab = page.locator(`[data-testid="wallet-tab-${walletType}"]`);
    await expect(tab).toBeVisible({ timeout: 5000 });
    await tab.click();
    await page.waitForTimeout(1000);
    
    const notFoundMessage = page.locator('[data-testid="wallet-notfound-display"]');
    const isNotFoundVisible = await notFoundMessage.isVisible();
    
    if (isNotFoundVisible) {
        console.log(`[PageHelper] ✅ No ${walletType} wallets exist, so wallet with price ${formatCurrency(price)} definitely doesn't exist${description ? ' ' + description : ''}`);
        return;
    }
    
    const walletsTable = page.locator('[data-testid="wallets-table"]');
    const isTableVisible = await walletsTable.isVisible();
    
    if (!isTableVisible) {
        console.log(`[PageHelper] ✅ No ${walletType} wallets table, so wallet with price ${formatCurrency(price)} doesn't exist${description ? ' ' + description : ''}`);
        return;
    }
    
    const walletRows = walletsTable.locator('tbody tr');
    const rowCount = await walletRows.count();
    
    for (let i = 0; i < rowCount; i++) {
        const row = walletRows.nth(i);
        const buyPriceCell = row.locator('[data-testid="wallet-buyPrice-display"]');
        const priceText = await buyPriceCell.textContent();
        
        if (priceText === formatCurrency(price)) {
            throw new Error(`${walletType} wallet with price ${formatCurrency(price)} should not exist but was found${description ? ' ' + description : ''}`);
        }
    }
    
    console.log(`[PageHelper] ✅ Confirmed ${walletType} wallet with price ${formatCurrency(price)} does not exist${description ? ' ' + description : ''}`);
}

// Helper function to verify all wallets in a transaction step
async function verifyTransactionStepWallets(page: Page, step: TransactionStep, stepName: string) {
    console.log(`[UpdateTransactionPrice] Verifying wallets for ${stepName}...`);
    
    // Count expected wallets (excluding deleted ones)
    const expectedSwingCount = Object.values(step.output.wallets.swing).filter(w => !w.deleted).length;
    const expectedHoldCount = Object.values(step.output.wallets.hold).filter(w => !w.deleted).length;
    
    // Verify wallet counts
    await verifyWalletCount(page, 'Swing', expectedSwingCount, `for ${stepName}`);
    await verifyWalletCount(page, 'Hold', expectedHoldCount, `for ${stepName}`);
    
    // Verify each wallet or confirm deletion
    for (const [walletKey, wallet] of Object.entries(step.output.wallets.swing)) {
        if (wallet.deleted) {
            await verifyWalletDoesNotExistWithPrice(page, 'Swing', wallet.buyPrice, `${walletKey} for ${stepName}`);
        } else {
            await verifyWalletDetails(page, 'Swing', wallet, `${walletKey} for ${stepName}`);
        }
    }
    
    for (const [walletKey, wallet] of Object.entries(step.output.wallets.hold)) {
        if (wallet.deleted) {
            await verifyWalletDoesNotExistWithPrice(page, 'Hold', wallet.buyPrice, `${walletKey} for ${stepName}`);
        } else {
            await verifyWalletDetails(page, 'Hold', wallet, `${walletKey} for ${stepName}`);
        }
    }
    
    console.log(`[UpdateTransactionPrice] ✅ All wallet verifications passed for ${stepName}`);
}

// Transaction editing helper
async function editTransactionPrice(page: Page, transactionIndex: number, newPrice: number) {
    console.log(`[PageHelper] Editing transaction ${transactionIndex + 1} price to $${newPrice}...`);
    
    // Navigate to transactions section
    const transactionsSection = page.locator('text=Transactions').first();
    await transactionsSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);
    
    // Find the transaction row
    const transactionRows = page.locator('[data-testid="wallets-transaction-table-transaction-row"]');
    const targetRow = transactionRows.nth(transactionIndex);
    await expect(targetRow).toBeVisible({ timeout: 10000 });
    
    // Click the edit button within that row
    const editButton = targetRow.locator('[data-testid*="wallets-transaction-table-txn-edit-button-"]');
    await expect(editButton).toBeVisible({ timeout: 5000 });
    await editButton.click();
    
    // Wait for the edit modal to open
    const editModal = page.locator('[data-testid="add-buy-transaction-form-modal"]');
    await expect(editModal).toBeVisible({ timeout: 10000 });
    
    // Clear and update the price field
    const priceInput = page.locator('[data-testid="txn-form-price"]');
    await expect(priceInput).toBeVisible({ timeout: 5000 });
    await priceInput.click();
    await priceInput.clear();
    await priceInput.fill(newPrice.toString());
    
    // Submit the form
    const submitButton = page.locator('[data-testid="txn-form-submit-button"]');
    await submitButton.click();
    
    // Wait for modal to close
    await expect(editModal).not.toBeVisible({ timeout: 15000 });
    
    // Wait for UI to update
    await page.waitForTimeout(3000);
    
    console.log(`[PageHelper] Transaction ${transactionIndex + 1} price updated to $${newPrice}.`);
}

// Test data
let testData: TestConfig;
let stockId: string;

test.describe('Wallet Update Transactions Price', () => {
    test.beforeAll(async () => {
        console.log('[BEFORE ALL] Starting test setup...');
        
        // Load test data from JSON
        testData = loadTestData('e2e/wallets/wallet-update-transactions-price.json');
        const scenario = testData;
        
        console.log(`[BEFORE ALL] Creating test stock ${scenario.stock.symbol}...`);
        
        const stockData: PortfolioStockCreateData = {
            owner: E2E_TEST_USER_OWNER_ID,
            symbol: scenario.stock.symbol,
            name: scenario.stock.name,
            stockType: scenario.stock.stockType as "Stock" | "ETF" | "Crypto",
            region: scenario.stock.region as "APAC" | "EU" | "Intl" | "US",
            pdp: scenario.stock.pdp,
            plr: scenario.stock.plr,
            budget: scenario.stock.budget,
            swingHoldRatio: scenario.stock.swingHoldRatio,
            stockCommission: scenario.stock.commission,
            htp: scenario.stock.htp
        };
        
        const createdStock = await createPortfolioStock(stockData);
        stockId = createdStock.id;
        console.log(`[BEFORE ALL] Stock created successfully with ID: ${stockId}`);
    });

    test.beforeEach(async ({ page }) => {
        console.log('[BEFORE EACH] Starting fresh session setup...');
        
        await clearBrowserState(page);
        console.log('[BEFORE EACH] Browser state cleared.');
        
        console.log(`[BEFORE EACH] Attempting login as ${TEST_EMAIL}...`);
        await loginUser(page, TEST_EMAIL);
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

    test('Update Transaction Price - Detailed Wallet Validations', async ({ page }) => {
        const scenario = testData;
        
        console.log('[UpdateTransactionPrice] Starting test...');
        
        // Clean up any existing data
        await deleteStockWalletsForStockByStockId(stockId);
        await deleteTransactionsForStockByStockId(stockId);
        
        // Step 1: Navigate to Portfolio page
        console.log('[UpdateTransactionPrice] Step 1: Navigating to Portfolio page...');
        await navigateToPortfolioPage(page);
        
        // Step 2: Navigate to stock's Wallets page
        console.log('[UpdateTransactionPrice] Step 2: Navigating to stock\'s Wallets page...');
        await navigateToStockWalletPage(page, stockId, scenario.stock.symbol);
        
        // Step 3: Verify no transactions or wallets exist
        console.log('[UpdateTransactionPrice] Step 3: Verifying no transactions or wallets exist...');
        await verifyWalletCount(page, 'Swing', 0, 'initially');
        await verifyWalletCount(page, 'Hold', 0, 'initially');
        
        // Step 4: Add Transaction A
        console.log('[UpdateTransactionPrice] Step 4: Adding Transaction A...');
        const transactionA: TransactionData = {
            date: scenario.transactions.AddTransactionA.input.date,
            type: scenario.transactions.AddTransactionA.input.type as 'Split' | 'Swing' | 'Hold',
            signal: scenario.transactions.AddTransactionA.input.signal,
            price: scenario.transactions.AddTransactionA.input.price!,
            investment: scenario.transactions.AddTransactionA.input.investment!
        };
        await addTransaction(page, transactionA);
        
        // Step 5: Verify wallets after Transaction A
        console.log('[UpdateTransactionPrice] Step 5: Verifying wallets after Transaction A...');
        await verifyTransactionStepWallets(page, scenario.transactions.AddTransactionA, 'AddTransactionA');
        
        // Step 6: Add Transaction B (same price)
        console.log('[UpdateTransactionPrice] Step 6: Adding Transaction B (same price)...');
        const transactionB: TransactionData = {
            date: scenario.transactions.AddTransactionB.input.date,
            type: scenario.transactions.AddTransactionB.input.type as 'Split' | 'Swing' | 'Hold',
            signal: scenario.transactions.AddTransactionB.input.signal,
            price: scenario.transactions.AddTransactionB.input.price!,
            investment: scenario.transactions.AddTransactionB.input.investment!
        };
        await addTransaction(page, transactionB);
        
        // Step 7: Verify wallets after Transaction B
        console.log('[UpdateTransactionPrice] Step 7: Verifying wallets after Transaction B...');
        await verifyTransactionStepWallets(page, scenario.transactions.AddTransactionB, 'AddTransactionB');
        
        // Step 8: Edit Transaction A price
        console.log('[UpdateTransactionPrice] Step 8: Editing Transaction A price...');
        await editTransactionPrice(page, 1, scenario.transactions.UpdateTransactionA.input.newPrice!); // Transaction A is index 1 (second newest)
        
        // Step 9: Verify wallets after Transaction A price change
        console.log('[UpdateTransactionPrice] Step 9: Verifying wallets after Transaction A price change...');
        await verifyTransactionStepWallets(page, scenario.transactions.UpdateTransactionA, 'UpdateTransactionA');
        
        // Step 10: Edit Transaction B price
        console.log('[UpdateTransactionPrice] Step 10: Editing Transaction B price...');
        await editTransactionPrice(page, 0, scenario.transactions.UpdateTransactionB.input.newPrice!); // Transaction B is index 0 (newest)
        
        // Step 11: Verify final wallet state
        console.log('[UpdateTransactionPrice] Step 11: Verifying final wallet state...');
        await verifyTransactionStepWallets(page, scenario.transactions.UpdateTransactionB, 'UpdateTransactionB');
        
        console.log('[UpdateTransactionPrice] Test completed successfully!');
    });
});
