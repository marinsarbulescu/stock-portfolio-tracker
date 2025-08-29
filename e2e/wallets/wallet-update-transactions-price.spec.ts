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
import { loadTestData, TestConfig, WalletExpectation, TransactionStep, OverviewExpectation } from '../utils/jsonHelper';
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
    
    const notFoundMessage = page.locator('[data-testid="wallet-notfound-display"]');
    await expect(notFoundMessage).not.toBeVisible({ timeout: 5000 });
    
    const walletsTable = page.locator('[data-testid="wallets-table"]');
    await expect(walletsTable).toBeVisible({ timeout: 5000 });
    
    // Find the specific wallet row with the expected price
    const walletRows = walletsTable.locator('tbody tr');
    const rowCount = await walletRows.count();
    
    console.log(`[PageHelper] Searching ${rowCount} rows for wallet with price ${formatCurrency(expectedDetails.buyPrice)}`);
    
    // Log all current wallet values for debugging
    for (let debugRow = 0; debugRow < rowCount; debugRow++) {
        const row = walletRows.nth(debugRow);
        const buyPriceCell = row.locator('[data-testid="wallet-buyPrice-display"]');
        const investmentCell = row.locator('[data-testid="wallet-totalInvestment-display"]');
        const sharesCell = row.locator('[data-testid="wallet-remainingShares-display"]');
        
        const currentBuyPrice = await buyPriceCell.textContent();
        const currentInvestment = await investmentCell.textContent();
        const currentShares = await sharesCell.textContent();
        
        console.log(`[PageHelper] DEBUG Row ${debugRow}: Price=${currentBuyPrice}, Investment=${currentInvestment}, Shares=${currentShares}`);
    }
    
    let found = false;
    for (let i = 0; i < rowCount; i++) {
        const row = walletRows.nth(i);
        
        // Check Buy Price first
        const buyPriceCell = row.locator('[data-testid="wallet-buyPrice-display"]');
        const buyPriceText = await buyPriceCell.textContent();
        
        console.log(`[PageHelper] Row ${i}: Buy Price = ${buyPriceText}`);
        
        if (buyPriceText === formatCurrency(expectedDetails.buyPrice)) {
            console.log(`[PageHelper] Found matching buy price wallet, now verifying investment and shares...`);
            
            // Check Total Investment with retry logic
            const investmentCell = row.locator('[data-testid="wallet-totalInvestment-display"]');
            
            // Wait for the investment value to stabilize and match expected value
            const investmentText = await investmentCell.textContent();
            console.log(`[PageHelper] Row ${i}: Investment = ${investmentText}, Expected = ${formatCurrency(expectedDetails.investment)}`);
            
            if (investmentText !== formatCurrency(expectedDetails.investment)) {
                throw new Error(`Investment verification failed for ${walletType} wallet with price ${formatCurrency(expectedDetails.buyPrice)}${description ? ' ' + description : ''}. Expected: ${formatCurrency(expectedDetails.investment)}, Actual: ${investmentText}. This indicates a logical error in the backend calculation, not a timing issue.`);
            }
            
            // Check Remaining Shares with retry logic
            const sharesCell = row.locator('[data-testid="wallet-remainingShares-display"]');
            
            // Wait for the shares value to stabilize and match expected value
            const sharesText = await sharesCell.textContent();
            console.log(`[PageHelper] Row ${i}: Shares = ${sharesText}, Expected = ${formatShares(expectedDetails.sharesLeft)}`);
            
            if (sharesText !== formatShares(expectedDetails.sharesLeft)) {
                throw new Error(`Shares verification failed for ${walletType} wallet with price ${formatCurrency(expectedDetails.buyPrice)}${description ? ' ' + description : ''}. Expected: ${formatShares(expectedDetails.sharesLeft)}, Actual: ${sharesText}. This indicates a logical error in the backend calculation, not a timing issue.`);
            }
            
            // Get final values for logging
            const finalInvestmentText = await investmentCell.textContent();
            const finalSharesText = await sharesCell.textContent();
            
            console.log(`[PageHelper] ✅ ${walletType} wallet verified: Buy Price=${buyPriceText}, Investment=${finalInvestmentText}, Shares=${finalSharesText}`);
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

// Global variables to store transaction IDs for reliable selection
let transactionAId: string | null = null;
let transactionBId: string | null = null;

// Helper function to capture transaction ID from browser console during creation
async function captureTransactionId(page: Page, transactionLabel: 'A' | 'B'): Promise<void> {
    // Brief wait for console messages to be processed
    await page.waitForTimeout(500);
    
    console.log(`[PageHelper] Transaction ${transactionLabel} creation completed, ID should be captured from browser console`);
}

// Transaction editing helper - ROBUST: Select by unique transaction ID
async function editTransactionById(page: Page, transactionId: string, newPrice: number, description: string = '') {
    console.log(`[PageHelper] Editing transaction ${transactionId} to price $${newPrice}... ${description}`);
    
    // Navigate to transactions section
    const transactionsSection = page.locator('text=Transactions').first();
    await transactionsSection.scrollIntoViewIfNeeded();
    
    // Find the edit button with the specific transaction ID
    const editButton = page.locator(`[data-testid="wallets-transaction-table-txn-edit-button-${transactionId}"]`);
    
    // Verify the button exists
    await expect(editButton).toBeVisible({ timeout: 10000 });
    console.log(`[PageHelper] Found edit button for transaction ${transactionId}`);
    
    // Click the edit button
    await editButton.click();
    
    // Wait for the edit modal to open
    const editModal = page.locator('[data-testid="transaction-form-modal"]');
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
    
    // Wait for wallet recalculation to complete
    await waitForWalletRecalculation(page);
    
    console.log(`[PageHelper] Transaction ${transactionId} updated to price $${newPrice}. ${description}`);
}

// MOST ROBUST approach: Select by inspecting actual transaction properties
async function editTransactionByInvestmentInspection(page: Page, targetInvestment: number, newPrice: number, description: string = '') {
    console.log(`[PageHelper] Finding and editing transaction with investment $${targetInvestment} to price $${newPrice}... ${description}`);
    
    // Navigate to transactions section
    const transactionsSection = page.locator('text=Transactions').first();
    await transactionsSection.scrollIntoViewIfNeeded();
    
    // Wait for transaction table to be visible and stable
    const transactionRows = page.locator('[data-testid="wallets-transaction-table-transaction-row"]');
    await expect(transactionRows.first()).toBeVisible({ timeout: 10000 });
    
    const rowCount = await transactionRows.count();
    console.log(`[PageHelper] DEBUG: Found ${rowCount} transactions, looking for investment $${targetInvestment}`);
    
    // Ensure we have exactly 2 transactions as expected
    if (rowCount !== 2) {
        throw new Error(`Expected exactly 2 transactions but found ${rowCount}. ${description}`);
    }
    
    let targetEditButton = null;
    let targetRowIndex = -1;
    
    // Inspect each transaction by opening its edit modal and checking the investment value
    for (let i = 0; i < rowCount; i++) {
        console.log(`[PageHelper] Inspecting transaction at row ${i}...`);
        
        const row = transactionRows.nth(i);
        const editButton = row.locator('[data-testid*="wallets-transaction-table-txn-edit-button-"]');
        
        await expect(editButton).toBeVisible({ timeout: 10000 });
        await editButton.click();
        
        // Wait for the edit modal to open
        const editModal = page.locator('[data-testid="transaction-form-modal"]');
        await expect(editModal).toBeVisible({ timeout: 10000 });
        
        // Read the investment value from the form
        const investmentInput = page.locator('[data-testid="txn-form-investment"]');
        await expect(investmentInput).toBeVisible({ timeout: 5000 });
        
        const investmentValue = await investmentInput.inputValue();
        const actualInvestment = parseFloat(investmentValue || '0');
        
        console.log(`[PageHelper] Row ${i}: Investment in form = $${actualInvestment}, looking for $${targetInvestment}`);
        
        // Check if this is the transaction we want
        if (Math.abs(actualInvestment - targetInvestment) < 0.01) {
            console.log(`[PageHelper] ✅ Found target transaction at row ${i} with investment $${actualInvestment}`);
            targetEditButton = editButton;
            targetRowIndex = i;
            
            // We're already in the edit modal for the correct transaction, so proceed with the edit
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
            
            // Wait for wallet recalculation to complete
            await waitForWalletRecalculation(page);
            
            console.log(`[PageHelper] Transaction with investment $${targetInvestment} updated to price $${newPrice}. ${description}`);
            return;
        } else {
            // This is not the transaction we want, close the modal
            console.log(`[PageHelper] Row ${i}: Not the target transaction (investment $${actualInvestment}), closing modal`);
            
            const cancelButton = page.locator('[data-testid="txn-form-cancel-button"]').or(page.locator('button:has-text("Cancel")')).or(page.locator('.modal button:has-text("×")'));
            
            // Try different ways to cancel/close the modal
            try {
                if (await cancelButton.first().isVisible({ timeout: 2000 })) {
                    await cancelButton.first().click();
                } else {
                    // Try pressing Escape key
                    await page.keyboard.press('Escape');
                }
                
                // Wait for modal to close
                await expect(editModal).not.toBeVisible({ timeout: 10000 });
                
            } catch (error) {
                console.log(`[PageHelper] Warning: Could not close modal cleanly: ${error}`);
                // Try pressing Escape as fallback
                await page.keyboard.press('Escape');
                
                // Wait for modal to close
                const modal = page.locator('[role="dialog"]').first();
                await expect(modal).not.toBeVisible({ timeout: 5000 }).catch(() => {
                    console.log('[PageHelper] Modal may still be open after Escape, continuing...');
                });
            }
        }
    }
    
    if (targetRowIndex === -1) {
        throw new Error(`Transaction with investment $${targetInvestment} not found after inspecting all ${rowCount} transactions. ${description}`);
    }
}

// Keep the old function for backwards compatibility but mark it as deprecated
async function editTransactionPrice(page: Page, transactionIndex: number, newPrice: number, expectedWallets?: {swing: any[], hold: any[]}) {
    console.log(`[PageHelper] DEPRECATED: editTransactionPrice by index is unreliable. Use editTransactionByInvestment instead.`);
    console.log(`[PageHelper] Editing transaction ${transactionIndex + 1} price to $${newPrice}...`);
    
    // Navigate to transactions section
    const transactionsSection = page.locator('text=Transactions').first();
    await transactionsSection.scrollIntoViewIfNeeded();
    
    // DEBUG: Log all visible transactions before editing
    const transactionRows = page.locator('[data-testid="wallets-transaction-table-transaction-row"]');
    await expect(transactionRows.first()).toBeVisible({ timeout: 10000 });
    const rowCount = await transactionRows.count();
    console.log(`[PageHelper] DEBUG: Found ${rowCount} transactions:`);
    
    for (let i = 0; i < rowCount; i++) {
        const row = transactionRows.nth(i);
        const dateCell = row.locator('td').nth(1); // Date column
        const typeCell = row.locator('td').nth(2); // Type column
        const signalCell = row.locator('td').nth(3); // Signal column
        const priceCell = row.locator('td').nth(4); // Price column
        const sharesCell = row.locator('td').nth(5); // Shares column
        const investmentCell = row.locator('td').nth(6); // Investment column
        
        const dateText = await dateCell.textContent();
        const typeText = await typeCell.textContent();
        const signalText = await signalCell.textContent();
        const priceText = await priceCell.textContent();
        const sharesText = await sharesCell.textContent();
        const investmentText = await investmentCell.textContent();
        
        console.log(`[PageHelper] DEBUG: Transaction ${i}: Date=${dateText}, Type=${typeText}, Signal=${signalText}, Price=${priceText}, Shares=${sharesText}, Investment=${investmentText}`);
    }
    
    console.log(`[PageHelper] DEBUG: About to edit transaction at index ${transactionIndex} (transaction ${transactionIndex + 1})`);
    
    // Find the transaction row
    const targetRow = transactionRows.nth(transactionIndex);
    await expect(targetRow).toBeVisible({ timeout: 10000 });
    
    // Click the edit button within that row
    const editButton = targetRow.locator('[data-testid*="wallets-transaction-table-txn-edit-button-"]');
    await expect(editButton).toBeVisible({ timeout: 5000 });
    await editButton.click();
    
    // Wait for the edit modal to open
    const editModal = page.locator('[data-testid="transaction-form-modal"]');
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
    
    // Wait for wallet recalculation to complete
    await waitForWalletRecalculation(page);
    
    console.log(`[PageHelper] Transaction ${transactionIndex + 1} price updated to $${newPrice}.`);
}

// Helper function to wait for wallet recalculation to complete
async function waitForWalletRecalculation(page: Page, maxWaitTime: number = 10000) {
    console.log('[PageHelper] Waiting for wallet recalculation to complete...');
    
    try {
        // Wait for network operations to settle completely
        await page.waitForLoadState('networkidle', { timeout: 8000 });
        
        console.log('[PageHelper] Wallet recalculation complete.');
    } catch (error) {
        console.log('[PageHelper] Wallet recalculation wait completed with timeout, continuing...');
    }
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
async function verifyInitialSettings(page: Page, stockConfig: any): Promise<void> {
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
    await expect(page.locator('[data-testid="overview-settings-budget"]')).toContainText(`${stockConfig.budget.toFixed(0)}`);
    await expect(page.locator('[data-testid="overview-settings-invested"]')).toContainText('0');
    await expect(page.locator('[data-testid="overview-settings-pdp"]')).toContainText(`${stockConfig.pdp}%`);
    await expect(page.locator('[data-testid="overview-settings-shr"]')).toContainText(`${stockConfig.swingHoldRatio}%`);
    await expect(page.locator('[data-testid="overview-settings-plr"]')).toContainText(`${stockConfig.plr}`);
    await expect(page.locator('[data-testid="overview-settings-htp"]')).toContainText(`${stockConfig.htp}`);
    
    console.log('[OverviewHelper] ✅ Initial settings verification completed');
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
            marketCategory: scenario.stock.marketCategory as "Crypto" | "APAC_Index" | "China_Index" | "Emerging_Index" | "Europe_Index" | "International_Index" | "Metals" | "Oil" | "Opportunity" | "US_Index",
            riskGrowthProfile: scenario.stock.riskGrowthProfile as "Hare" | "Tortoise",
            pdp: scenario.stock.pdp,
            plr: scenario.stock.plr,
            budget: scenario.stock.budget,
            swingHoldRatio: scenario.stock.swingHoldRatio,
            stockCommission: scenario.stock.stockCommission,
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
    test.setTimeout(120000); // Set timeout to 120 seconds (2 minutes)
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
        
        // Step 3.5: Verify initial settings in Overview section
        console.log('[UpdateTransactionPrice] Step 3.5: Verifying initial settings in Overview section...');
        await verifyInitialSettings(page, scenario.stock);
        
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
        
        // Wait for wallet calculations to complete after transaction creation
        await waitForWalletRecalculation(page);

        // Step 5: Verify wallets after Transaction A
        console.log('[UpdateTransactionPrice] Step 5: Verifying wallets after Transaction A...');
        await verifyTransactionStepWallets(page, scenario.transactions.AddTransactionA, 'AddTransactionA');        
        
        // Step 5.5: Verify overview after Transaction A
        if (scenario.transactions.AddTransactionA.output.overview) {
            console.log('[UpdateTransactionPrice] Step 5.5: Verifying overview after Transaction A...');
            await verifyOverview(page, scenario.transactions.AddTransactionA.output.overview, 'AddTransactionA');
        }        // Step 6: Add Transaction B (same price)
        console.log('[UpdateTransactionPrice] Step 6: Adding Transaction B (same price)...');
        const transactionB: TransactionData = {
            date: scenario.transactions.AddTransactionB.input.date,
            type: scenario.transactions.AddTransactionB.input.type as 'Split' | 'Swing' | 'Hold',
            signal: scenario.transactions.AddTransactionB.input.signal,
            price: scenario.transactions.AddTransactionB.input.price!,
            investment: scenario.transactions.AddTransactionB.input.investment!
        };
        await addTransaction(page, transactionB);
        
        // Wait for wallet calculations to complete after transaction creation
        await waitForWalletRecalculation(page);

        // Step 7: Verify wallets after Transaction B
        console.log('[UpdateTransactionPrice] Step 7: Verifying wallets after Transaction B...');
        await verifyTransactionStepWallets(page, scenario.transactions.AddTransactionB, 'AddTransactionB');        
        
        // Step 7.5: Verify overview after Transaction B
        if (scenario.transactions.AddTransactionB.output.overview) {
            console.log('[UpdateTransactionPrice] Step 7.5: Verifying overview after Transaction B...');
            await verifyOverview(page, scenario.transactions.AddTransactionB.output.overview, 'AddTransactionB');
        }        // Step 8: Edit Transaction A price
        console.log('[UpdateTransactionPrice] Step 8: Editing Transaction A price...');
        
        // Listen for console messages from the browser
        page.on('console', msg => {
            if (msg.text().includes('[WalletPriceChange]') || msg.text().includes('[WalletOp]') || msg.text().includes('[DEBUG]') || msg.text().includes('[MODAL]') || msg.text().includes('[SUBMIT]')) {
                console.log(`[BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`);
            }
        });
        
        const expectedWalletsAfterUpdateA = {
            swing: [
                { buyPrice: 10, investment: 60, sharesLeft: 6.00000 },
                { buyPrice: 100, investment: 90, sharesLeft: 0.90000 }
            ],
            hold: [
                { buyPrice: 10, investment: 140, sharesLeft: 14.00000 },
                { buyPrice: 100, investment: 210, sharesLeft: 2.10000 }
            ]
        };
        // Use the most robust approach - inspect actual transaction properties
        await editTransactionByInvestmentInspection(page, 200, scenario.transactions.UpdateTransactionA.input.newPrice!, 'Transaction A (investment=$200)');
        
        // Step 9: Verify wallets after Transaction A price change
        console.log('[UpdateTransactionPrice] Step 9: Verifying wallets after Transaction A price change...');
        
        await verifyTransactionStepWallets(page, scenario.transactions.UpdateTransactionA, 'UpdateTransactionA');
        
        // Step 9.5: Verify overview after Transaction A price update
        if (scenario.transactions.UpdateTransactionA.output.overview) {
            console.log('[UpdateTransactionPrice] Step 9.5: Verifying overview after Transaction A price update...');
            await verifyOverview(page, scenario.transactions.UpdateTransactionA.output.overview, 'UpdateTransactionA');
        }
        
        // Step 10: Edit Transaction B price
        console.log('[UpdateTransactionPrice] Step 10: Editing Transaction B price...');
        // Use the most robust approach - inspect actual transaction properties
        await editTransactionByInvestmentInspection(page, 300, scenario.transactions.UpdateTransactionB.input.newPrice!, 'Transaction B (investment=$300)');
        
        // Step 11: Verify final wallet state
        console.log('[UpdateTransactionPrice] Step 11: Verifying final wallet state...');
        await verifyTransactionStepWallets(page, scenario.transactions.UpdateTransactionB, 'UpdateTransactionB');
        
        // Step 11.5: Verify overview after Transaction B price update
        if (scenario.transactions.UpdateTransactionB.output.overview) {
            console.log('[UpdateTransactionPrice] Step 11.5: Verifying overview after Transaction B price update...');
            await verifyOverview(page, scenario.transactions.UpdateTransactionB.output.overview, 'UpdateTransactionB');
        }
        
        console.log('[UpdateTransactionPrice] Test completed successfully!');
    });
});
