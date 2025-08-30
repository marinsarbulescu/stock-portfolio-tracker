// e2e/wallets/wallet-add-split-transaction.spec.ts
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
    refreshWalletsPage
} from '../utils/pageHelpers';
import { 
    createPortfolioStock, 
    deleteStockWalletsForStockByStockId, 
    deletePortfolioStock, 
    deleteTransactionsForStockByStockId,
    type PortfolioStockCreateData
} from '../utils/dataHelpers';
import { E2E_TEST_USERNAME, E2E_TEST_USER_OWNER_ID } from '../utils/testCredentials';
import { SHARE_PRECISION, CURRENCY_PRECISION } from '../../app/config/constants';

// Configuration
const TEST_EMAIL = E2E_TEST_USERNAME;

// Configure Amplify
Amplify.configure(amplifyOutputs);

// Set test timeout to 60 seconds for reliable execution
test.setTimeout(60000);

// Load test data from JSON
import testData from './wallet-add-split-transaction.json';

// Type definitions for test data
interface StockSplitTestConfig {
  scenario: string;
  testPriceUpdates: {
    [key: string]: {
      step: string;
      description: string;
      price: number;
      timing: string;
    };
  };
  stock: {
    symbol: string;
    name: string;
    stockType: string;
    region: string;
    pdp: number;
    stp: number;
    budget: number;
    swingHoldRatio: number;
    stockCommission: number;
    htp: number;
  };
  transactions: {
    [key: string]: {
      testPriceContext: {
        priceAtTransaction: number;
        expectedUnrealizedPL: string;
      };
      input: {
        date: string;
        action: string;
        type?: string;
        signal?: string;
        price?: number;
        investment?: number;
        splitRatio?: number;
      };
      output: {
        overview: OverviewExpectation;
        wallets: WalletExpectations;
        transactionTable: TransactionTableExpectation;
      };
    };
  };
}

interface OverviewExpectation {
  settings: {
    budget: number;
    invested: number;
    pdp: string;
    shr: string;
    stp: string;
    htp: string;
  };
  txnsAndShares: {
    buys: number;
    totalSells: number;
    swingSells: number;
    holdSells: number;
    swingShares: string;
    holdShares: string;
    totalShares: string;
  };
  realizedPL: {
    swingDollars: string;
    swingPercent: string;
    holdDollars: string;
    holdPercent: string;
    stockDollars: string;
    stockPercent: string;
  };
  unrealizedPL: {
    swingDollars: string;
    swingPercent: string;
    holdDollars: string;
    holdPercent: string;
    stockDollars: string;
    stockPercent: string;
  };
  combinedPL: {
    swingDollars: string;
    swingPercent: string;
    holdDollars: string;
    holdPercent: string;
    stockDollars: string;
    stockPercent: string;
  };
}

interface WalletExpectations {
  swing?: { [key: string]: WalletExpectation };
  hold?: { [key: string]: WalletExpectation };
}

interface WalletExpectation {
  buyPrice: number;
  investment: number;
  sharesLeft: number;
  splitAdjustedBuyPrice?: number;
  splitAdjustedShares?: number;
}

interface TransactionTableExpectation {
  transactions: Array<{
    action: string;
    type: string;
    signal: string;
    price: string;
    lbd: string;
    inv: string;
    sellDollars: string;
    qty: string;
    splitRatio?: string;
    note?: string;
  }>;
}

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
 * Helper function to add a stock split transaction
 */
async function addStockSplitTransaction(
    page: Page,
    date: string,
    splitRatio: number
): Promise<void> {
    console.log(`[SplitHelper] Adding stock split transaction with ratio ${splitRatio}...`);
    
    // Click Add Transaction button
    await page.locator('[data-testid="add-transaction-button"]').click();
    await page.waitForLoadState('networkidle');
    
    // Wait for modal to be visible
    await expect(page.locator('[data-testid="transaction-form-modal"]')).toBeVisible();
    
    // Fill in the form
    await page.locator('[data-testid="txn-form-date"]').fill(date);
    await page.selectOption('[data-testid="txn-form-action"]', 'StockSplit');
    
    // Wait for split ratio field to appear and fill it
    await expect(page.locator('[data-testid="txn-form-split-ratio"]')).toBeVisible();
    await page.locator('[data-testid="txn-form-split-ratio"]').fill(splitRatio.toString());
    
    // Submit the transaction
    await page.locator('[data-testid="txn-form-submit-button"]').click();
    await page.waitForLoadState('networkidle');
    
    // Wait for modal to close
    await expect(page.locator('[data-testid="transaction-form-modal"]')).not.toBeVisible();
    
    console.log(`[SplitHelper] ✅ Stock split transaction added successfully`);
}

/**
 * Helper function to verify the overview section
 */
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
    console.log(`[OverviewHelper] ✅ Combined P/L section verified`);
    
    console.log(`[OverviewHelper] ✅ All overview sections verified successfully for ${stepName}`);
}

/**
 * Helper function to verify transaction table
 */
async function verifyTransactionTable(
    page: Page,
    expectedTransactions: TransactionTableExpectation,
    stepName: string
): Promise<void> {
    console.log(`[TransactionHelper] Verifying transaction table for ${stepName}...`);
    
    // Wait for transaction table to be visible
    await expect(page.locator('[data-testid*="wallets-transaction-table"], table').first()).toBeVisible();
    
    console.log(`[TransactionHelper] ✅ Transaction table is visible for ${stepName}`);
    
    // For now, just verify the table exists. Individual row verification can be added later
    // once we confirm the exact test-ids used in the transaction table rows
}

test.describe('Stock Split Transaction E2E Test', () => {
    const config = testData as StockSplitTestConfig;
    let stockId: string;
    let page: Page;

    test.beforeEach(async ({ page: testPage }) => {
        page = testPage;
        console.log('🧹 Clearing browser state...');
        await clearBrowserState(page);
        
        console.log('🔐 Logging in user...');
        await loginUser(page, TEST_EMAIL);
        
        console.log('📈 Creating test stock...');
        const stockData: PortfolioStockCreateData = {
            symbol: config.stock.symbol,
            name: config.stock.name,
            stockType: config.stock.stockType as "Stock" | "ETF" | "Crypto",
            region: config.stock.region as "US" | "EU" | "Intl" | "APAC",
            owner: E2E_TEST_USER_OWNER_ID,
            pdp: config.stock.pdp,
            stp: config.stock.stp,
            budget: config.stock.budget,
            swingHoldRatio: config.stock.swingHoldRatio,
            stockCommission: config.stock.stockCommission,
            htp: config.stock.htp
        };

        const createdStock = await createPortfolioStock(stockData);
        stockId = createdStock.id;
        console.log(`✅ Test stock created with ID: ${stockId}`);
        
        console.log('🧭 Navigating to stock wallet page...');
        await navigateToStockWalletPage(page, stockId, config.stock.symbol);
    });

    test.afterEach(async () => {
        if (stockId) {
            console.log('🧹 Cleaning up test data...');
            try {
                await deleteTransactionsForStockByStockId(stockId);
                await deleteStockWalletsForStockByStockId(stockId);
                await deletePortfolioStock(stockId);
                console.log('✅ Test data cleaned up successfully');
            } catch (error) {
                console.error('⚠️ Error during cleanup:', error);
            }
        }
    });

    test('should handle stock split transactions and adjust P/L calculations correctly', async () => {
        console.log('🚀 Starting stock split transaction test...');
        
        // Step 1: Set initial test price to $200
        console.log('\n📍 Step 1: Setting initial test price to $200...');
        await updateStockTestPrice(page, config.stock.symbol, config.testPriceUpdates.initialPrice.price);
        await verifyStockTestPrice(page, config.stock.symbol, config.testPriceUpdates.initialPrice.price);
        console.log('✅ Step 1 completed');

        // Step 2: Add initial buy transaction
        console.log('\n📍 Step 2: Adding initial buy transaction...');
        const initialBuyData = config.transactions.InitialBuy;
        await addTransaction(page, {
            date: initialBuyData.input.date,
            type: initialBuyData.input.type! as "Split" | "Swing" | "Hold",
            signal: initialBuyData.input.signal!,
            price: initialBuyData.input.price!,
            investment: initialBuyData.input.investment!
        });
        await refreshWalletsPage(page, stockId, config.stock.symbol);
        console.log('✅ Step 2 completed');

        // Step 3: Verify overview metrics after initial buy
        console.log('\n📍 Step 3: Verifying overview metrics after initial buy...');
        await verifyOverview(page, initialBuyData.output.overview, 'Initial Buy');
        await verifyTransactionTable(page, initialBuyData.output.transactionTable, 'Initial Buy');
        console.log('✅ Step 3 completed');

        // Step 4: Add stock split transaction (2:1)
        console.log('\n📍 Step 4: Adding 2:1 stock split transaction...');
        const stockSplitData = config.transactions.StockSplit;
        await addStockSplitTransaction(
            page,
            stockSplitData.input.date,
            stockSplitData.input.splitRatio!
        );
        await refreshWalletsPage(page, stockId, config.stock.symbol);
        console.log('✅ Step 4 completed');

        // Step 5: Update test price to $100 to simulate split effect
        console.log('\n📍 Step 5: Updating test price to $100 to simulate split effect...');
        await updateStockTestPrice(page, config.stock.symbol, config.testPriceUpdates.postSplitPrice.price);
        await verifyStockTestPrice(page, config.stock.symbol, config.testPriceUpdates.postSplitPrice.price);
        console.log('✅ Step 5 completed');

        // Step 6: Verify split-adjusted P/L calculations
        console.log('\n📍 Step 6: Verifying split-adjusted P/L calculations...');
        await verifyOverview(page, stockSplitData.output.overview, 'After Stock Split');
        await verifyTransactionTable(page, stockSplitData.output.transactionTable, 'After Stock Split');
        console.log('✅ Step 6 completed');

        // Step 7: Add post-split buy transaction
        console.log('\n📍 Step 7: Adding post-split buy transaction...');
        const postSplitBuyData = config.transactions.PostSplitBuy;
        await addTransaction(page, {
            date: postSplitBuyData.input.date,
            type: postSplitBuyData.input.type! as "Split" | "Swing" | "Hold",
            signal: postSplitBuyData.input.signal!,
            price: postSplitBuyData.input.price!,
            investment: postSplitBuyData.input.investment!
        });
        await refreshWalletsPage(page, stockId, config.stock.symbol);
        console.log('✅ Step 7 completed');

        // Step 8: Final verification with both pre and post-split transactions
        console.log('\n📍 Step 8: Final verification with pre and post-split transactions...');
        await verifyOverview(page, postSplitBuyData.output.overview, 'Final State');
        await verifyTransactionTable(page, postSplitBuyData.output.transactionTable, 'Final State');
        console.log('✅ Step 8 completed');

        console.log('\n🎉 Stock split transaction test completed successfully!');
    });
});
