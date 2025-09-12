// e2e/wallets/wallet-stp-htp.spec.ts
import { test, expect, Page } from '@playwright/test';
import { Amplify } from 'aws-amplify';
import amplifyOutputs from '../../amplify_outputs.json';

import { 
    clearBrowserState, 
    loginUser, 
    navigateToStockWalletPage,
    updateStockTestPrice,
    verifyStockTestPrice,
    createStockViaUI
} from '../utils/pageHelpers';
import { 
    deleteStockWalletsForStockByStockId, 
    deletePortfolioStock, 
    deleteTransactionsForStockByStockId,
    getPortfolioStockBySymbol,
    type PortfolioStockCreateData
} from '../utils/dataHelpers';
import { E2E_TEST_USERNAME, E2E_TEST_USER_OWNER_ID } from '../utils/testCredentials';

// Configuration
const TEST_EMAIL = E2E_TEST_USERNAME;

// Configure Amplify
Amplify.configure(amplifyOutputs);

// Set test timeout to 60 seconds for reliable execution
test.setTimeout(60000);

// Load test data from JSON
import testData from './wallet-stp-htp.json';

// Type definitions for test data
interface StpHtpTestConfig {
  scenario: string;
  testPriceUpdates: {
    initialPrice: {
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
    htp: number;
    budget: number;
    swingHoldRatio: number;
    stockCommission: number;
  };
  transaction: {
    action: string;
    txnType: string;
    signal: string;
    price: number;
    investment: number;
    date: string;
  };
  expectedOverviewSettings: {
    stp: string;
    htp: string;
  };
  expectedSignalsValues: {
    percentToStp: string;
    percentToHtp: string;
    colorValidation: {
      percentToStp: string;
      percentToHtp: string;
    };
  };
  expectedWalletOverview: {
    stpValue: string;
    htpValue: string;
  };
  expectedWalletTabs: {
    swing: {
      stpValue: string;
      percentToStp: string;
      colorValidation: {
        stpValue: string;
        percentToStp: string;
      };
    };
    hold: {
      stpValue: string;
      percentToStp: string;
      htpValue: string;
      percentToHtp: string;
      colorValidation: {
        stpValue: string;
        percentToStp: string;
        htpValue: string;
        percentToHtp: string;
      };
    };
  };
}

/**
 * Helper function to verify wallet overview settings (STP/HTP percentages)
 */
async function verifyWalletOverviewSettings(
    page: Page, 
    config: StpHtpTestConfig
): Promise<void> {
    console.log('[WalletOverviewHelper] Expanding overview section...');
    
    // Use specific test ID for the overview toggle
    const overviewToggle = page.locator('[data-testid="overview-toggle"]');
    await expect(overviewToggle).toBeVisible();
    
    // Check if overview is collapsed by testing visibility of inner elements
    // Use EXACT same approach as working test - check for budget element first
    const overviewExpanded = await page.locator('[data-testid="overview-settings-budget"]').isVisible().catch(() => false);
    if (!overviewExpanded) {
        console.log('[WalletOverviewHelper] Overview is collapsed, clicking to expand...');
        await overviewToggle.click();
        await page.waitForLoadState('networkidle');
    } else {
        console.log('[WalletOverviewHelper] Overview is already expanded');
    }    console.log('[WalletOverviewHelper] Verifying STP and HTP settings...');
    
    // Verify STP setting using the test ID
    const stpSetting = page.locator('[data-testid="overview-settings-stp"]');
    await expect(stpSetting).toBeVisible({ timeout: 10000 });
    await expect(stpSetting).toHaveText(config.expectedOverviewSettings.stp);
    console.log(`[WalletOverviewHelper] ✅ STP setting verified: ${config.expectedOverviewSettings.stp}`);
    
    // Verify HTP setting using the test ID
    const htpSetting = page.locator('[data-testid="overview-settings-htp"]');
    await expect(htpSetting).toBeVisible({ timeout: 10000 });
    await expect(htpSetting).toHaveText(config.expectedOverviewSettings.htp);
    console.log(`[WalletOverviewHelper] ✅ HTP setting verified: ${config.expectedOverviewSettings.htp}`);
}

/**
 * Helper function to add a Buy transaction
 */
async function addBuyTransaction(page: Page, transaction: any): Promise<void> {
    console.log('[TransactionHelper] Opening Add Transaction modal...');
    
    // Use the same approach as existing addTransaction helper
    const addTransactionButton = page.locator('[data-testid="add-transaction-button"]');
    await expect(addTransactionButton).toBeVisible({ timeout: 10000 });
    await addTransactionButton.click();
    
    const transactionModal = page.locator('[data-testid="transaction-form-modal"]');
    await expect(transactionModal).toBeVisible({ timeout: 10000 });
    console.log('[TransactionHelper] Add Transaction modal opened');
    
    console.log('[TransactionHelper] Filling transaction form...');
    
    // Fill form fields using the same test IDs as existing helper
    const date = transaction.date || new Date().toISOString().split('T')[0];
    await page.locator('[data-testid="txn-form-date"]').fill(date);
    await page.locator('[data-testid="txn-form-price"]').fill(transaction.price.toString());
    await page.locator('[data-testid="txn-form-investment"]').fill(transaction.investment.toString());
    
    // Select transaction type using radio buttons (same as existing helper)
    console.log(`[TransactionHelper] Selecting transaction type: Split`);
    const splitRadio = page.locator('[data-testid="txn-form-txnType-split"]');
    await expect(splitRadio).toBeVisible({ timeout: 5000 });
    await splitRadio.click();
    
    // Select signal
    await page.locator('[data-testid="txn-form-signal"]').selectOption('Initial');
    
    console.log(`[TransactionHelper] Form filled: Date=${date}, Type=Split, Signal=Initial, Price=${transaction.price}, Investment=${transaction.investment}`);
    
    // Submit the form
    const submitButton = page.locator('[data-testid="txn-form-submit-button"]');
    await submitButton.click();
    
    // Wait for modal to close
    await expect(transactionModal).not.toBeVisible({ timeout: 15000 });
    console.log('[TransactionHelper] Transaction created successfully');
    
    // Wait for transaction table to update
    const transactionTable = page.locator('[data-testid*="wallets-transaction-table"], table').first();
    await expect(transactionTable).toBeVisible({ timeout: 10000 });
    
    console.log('[TransactionHelper] ✅ Transaction added successfully');
}

/**
 * Helper function to verify color styling is default (not green)
 */
async function verifyDefaultColor(page: Page, element: any, fieldName: string): Promise<void> {
    await expect(element).toBeVisible();
    
    // Get computed styles
    const backgroundColor = await element.evaluate((el: Element) => {
        return window.getComputedStyle(el).backgroundColor;
    });
    
    const color = await element.evaluate((el: Element) => {
        return window.getComputedStyle(el).color;
    });
    
    console.log(`[ColorValidation] ${fieldName} - Background: ${backgroundColor}, Color: ${color}`);
    
    // Verify it's NOT green (green would typically be rgb(0, 128, 0) or similar)
    // Default should be transparent, inherit, or standard text colors
    expect(backgroundColor).not.toContain('rgb(0, 128, 0)');
    expect(backgroundColor).not.toContain('green');
    expect(color).not.toContain('rgb(0, 128, 0)');
    
    console.log(`[ColorValidation] ✅ ${fieldName} has default coloring`);
}

/**
 * Helper function to navigate to Signals page and verify values
 */
async function verifySignalsPageValues(
    page: Page, 
    config: StpHtpTestConfig
): Promise<void> {
    console.log('[SignalsHelper] Navigating to Signals page...');
    
    // Navigate to signals page
    await page.goto('/signals');
    await page.waitForLoadState('networkidle');
    
    // Wait for signals table to be visible
    await expect(page.locator('table').first()).toBeVisible({ timeout: 15000 });
    console.log('[SignalsHelper] Signals table is visible');
    
    // Find the row with our test stock ticker using the test ID
    const tickerCell = page.locator(`[data-testid="signals-table-ticker-${config.stock.symbol}"]`);
    await expect(tickerCell).toBeVisible({ timeout: 10000 });
    console.log(`[SignalsHelper] Found ticker ${config.stock.symbol} in table`);
    
    // Verify %2STP value using the test ID
    const stpCell = page.locator(`[data-testid="signals-table-percent-stp-${config.stock.symbol}"]`);
    await expect(stpCell).toHaveText(config.expectedSignalsValues.percentToStp);
    console.log(`[SignalsHelper] ✅ %2STP value verified: ${config.expectedSignalsValues.percentToStp}`);
    
    // Verify %2HTP value using the test ID  
    const htpCell = page.locator(`[data-testid="signals-table-percent-htp-${config.stock.symbol}"]`);
    await expect(htpCell).toHaveText(config.expectedSignalsValues.percentToHtp);
    console.log(`[SignalsHelper] ✅ %2HTP value verified: ${config.expectedSignalsValues.percentToHtp}`);
    
    // Verify default colors for %2STP and %2HTP
    if (config.expectedSignalsValues.colorValidation.percentToStp === 'default') {
        await verifyDefaultColor(page, stpCell, '%2STP in Signals');
    }
    
    if (config.expectedSignalsValues.colorValidation.percentToHtp === 'default') {
        await verifyDefaultColor(page, htpCell, '%2HTP in Signals');
    }
    
    console.log('[SignalsHelper] ✅ Signals page validation completed');
}

/**
 * Helper function to verify wallet overview section
 */
async function verifyWalletOverview(
    page: Page, 
    config: StpHtpTestConfig
): Promise<void> {
    console.log('[OverviewHelper] Verifying wallet overview section...');
    
    // Expand the WalletsOverview section if not already expanded
    const overviewToggle = page.locator('p:has-text("Overview")');
    await expect(overviewToggle).toBeVisible({ timeout: 10000 });
    await overviewToggle.click();
    await page.waitForTimeout(500); // Wait for expansion animation
    
    // Verify STP value using the test ID we added
    const stpValueElement = page.locator('[data-testid="overview-stp-value"]');
    await expect(stpValueElement).toBeVisible();
    await expect(stpValueElement).toHaveText(config.expectedWalletOverview.stpValue);
    console.log(`[OverviewHelper] ✅ STP value verified: ${config.expectedWalletOverview.stpValue}`);
    
    // Verify HTP value using the test ID we added
    const htpValueElement = page.locator('[data-testid="overview-htp-value"]');
    await expect(htpValueElement).toBeVisible();
    await expect(htpValueElement).toHaveText(config.expectedWalletOverview.htpValue);
    console.log(`[OverviewHelper] ✅ HTP value verified: ${config.expectedWalletOverview.htpValue}`);
    
    console.log('[OverviewHelper] ✅ Wallet overview validation completed');
}

/**
 * Helper function to verify Swing wallet tab
 */
async function verifySwingWalletTab(
    page: Page, 
    config: StpHtpTestConfig
): Promise<void> {
    console.log('[SwingWalletHelper] Verifying Swing wallet tab...');
    
    // Click on Swing wallet tab
    const swingTab = page.locator('[data-testid="wallet-tab-Swing"]');
    await expect(swingTab).toBeVisible({ timeout: 10000 });
    await swingTab.click();
    await page.waitForLoadState('networkidle');
    
    // Wait for swing wallet content to be visible
    await page.waitForTimeout(1000); // Small wait for tab transition
    
    // Verify STP value using the proper test ID
    const stpValueElement = page.locator('[data-testid="wallet-tpValue-display"]');
    await expect(stpValueElement).toBeVisible();
    await expect(stpValueElement).toHaveText(config.expectedWalletTabs.swing.stpValue);
    console.log(`[SwingWalletHelper] ✅ STP value verified: ${config.expectedWalletTabs.swing.stpValue}`);
    
    // Verify %2STP value using the proper test ID
    const percentStpElement = page.locator('[data-testid="wallet-percentToStp-display"]');
    await expect(percentStpElement).toBeVisible();
    await expect(percentStpElement).toHaveText(config.expectedWalletTabs.swing.percentToStp);
    console.log(`[SwingWalletHelper] ✅ %2STP value verified: ${config.expectedWalletTabs.swing.percentToStp}`);
    
    // Verify default colors if specified
    if (config.expectedWalletTabs.swing.colorValidation.stpValue === 'default') {
        await verifyDefaultColor(page, stpValueElement, 'STP in Swing wallet');
    }
    
    if (config.expectedWalletTabs.swing.colorValidation.percentToStp === 'default') {
        await verifyDefaultColor(page, percentStpElement, '%2STP in Swing wallet');
    }
    
    console.log('[SwingWalletHelper] ✅ Swing wallet validation completed');
}

/**
 * Helper function to verify Hold wallet tab
 */
async function verifyHoldWalletTab(
    page: Page, 
    config: StpHtpTestConfig
): Promise<void> {
    console.log('[HoldWalletHelper] Verifying Hold wallet tab...');
    
    // Click on Hold wallet tab
    const holdTab = page.locator('[data-testid="wallet-tab-Hold"]');
    await expect(holdTab).toBeVisible({ timeout: 10000 });
    await holdTab.click();
    await page.waitForLoadState('networkidle');
    
    // Wait for hold wallet content to be visible
    await page.waitForTimeout(1000); // Small wait for tab transition
    
    // Make HTP and %2HTP columns visible by checking the column visibility checkboxes
    console.log('[HoldWalletHelper] Ensuring HTP and %2HTP columns are visible...');
    
    // Enable HTP column by finding its checkbox with exact text match
    const htpColumnLabel = page.locator('label').filter({ hasText: /^HTP$/ });
    if (await htpColumnLabel.isVisible()) {
        const htpCheckbox = htpColumnLabel.locator('input[type="checkbox"]');
        const isChecked = await htpCheckbox.isChecked();
        if (!isChecked) {
            await htpCheckbox.check();
            console.log('[HoldWalletHelper] Enabled HTP column visibility');
        }
    }
    
    // Enable %2HTP column with exact text match
    const htpPercentLabel = page.locator('label').filter({ hasText: /^%2HTP$/ });
    if (await htpPercentLabel.isVisible()) {
        const htpPercentCheckbox = htpPercentLabel.locator('input[type="checkbox"]');
        const isChecked = await htpPercentCheckbox.isChecked();
        if (!isChecked) {
            await htpPercentCheckbox.check();
            console.log('[HoldWalletHelper] Enabled %2HTP column visibility');
        }
    }
    
    // Wait longer for table to update after enabling columns
    await page.waitForTimeout(2000);
    
    // Verify STP value using the proper test ID (now available in Hold wallets too)
    const stpValueElement = page.locator('[data-testid="wallet-tpValue-display"]');
    await expect(stpValueElement).toBeVisible({ timeout: 10000 });
    await expect(stpValueElement).toHaveText(config.expectedWalletTabs.hold.stpValue);
    console.log(`[HoldWalletHelper] ✅ STP value verified: ${config.expectedWalletTabs.hold.stpValue}`);
    
    // Verify %2STP value using the proper test ID (now available in Hold wallets too)
    const percentStpElement = page.locator('[data-testid="wallet-percentToStp-display"]');
    await expect(percentStpElement).toBeVisible();
    await expect(percentStpElement).toHaveText(config.expectedWalletTabs.hold.percentToStp);
    console.log(`[HoldWalletHelper] ✅ %2STP value verified: ${config.expectedWalletTabs.hold.percentToStp}`);
    
    // Verify HTP value using the proper test ID
    const htpValueElement = page.locator('[data-testid="wallet-htpValue-display"]');
    await expect(htpValueElement).toBeVisible({ timeout: 10000 });
    await expect(htpValueElement).toHaveText(config.expectedWalletTabs.hold.htpValue);
    console.log(`[HoldWalletHelper] ✅ HTP value verified: ${config.expectedWalletTabs.hold.htpValue}`);
    
    // Verify %2HTP value using the proper test ID
    const percentHtpElement = page.locator('[data-testid="wallet-htp-display"]');
    await expect(percentHtpElement).toBeVisible();
    await expect(percentHtpElement).toHaveText(config.expectedWalletTabs.hold.percentToHtp);
    console.log(`[HoldWalletHelper] ✅ %2HTP value verified: ${config.expectedWalletTabs.hold.percentToHtp}`);
    
    // Verify default colors for STP values if specified
    if (config.expectedWalletTabs.hold.colorValidation.stpValue === 'default') {
        await verifyDefaultColor(page, stpValueElement, 'STP in Hold wallet');
    }
    
    if (config.expectedWalletTabs.hold.colorValidation.percentToStp === 'default') {
        await verifyDefaultColor(page, percentStpElement, '%2STP in Hold wallet');
    }
    
    // Verify default colors for HTP values if specified
    if (config.expectedWalletTabs.hold.colorValidation.htpValue === 'default') {
        await verifyDefaultColor(page, htpValueElement, 'HTP in Hold wallet');
    }
    
    if (config.expectedWalletTabs.hold.colorValidation.percentToHtp === 'default') {
        await verifyDefaultColor(page, percentHtpElement, '%2HTP in Hold wallet');
    }
    
    console.log('[HoldWalletHelper] ✅ Hold wallet validation completed');
}

test.describe('STP HTP Validation E2E Test', () => {
    const config = testData as any as StpHtpTestConfig;
    let stockId: string;
    let page: Page;

    test.beforeEach(async ({ page: testPage }) => {
        page = testPage;
        console.log('🧹 Clearing browser state...');
        await clearBrowserState(page);
        
        console.log('🔐 Logging in user...');
        await loginUser(page, TEST_EMAIL);
        
        // Clean up any existing test stock first
        try {
            const existingStock = await getPortfolioStockBySymbol(config.stock.symbol.toUpperCase());
            if (existingStock) {
                console.log(`🧹 Cleaning up existing stock ${config.stock.symbol}...`);
                await deleteStockWalletsForStockByStockId(existingStock.id);
                await deleteTransactionsForStockByStockId(existingStock.id);
                await deletePortfolioStock(existingStock.id);
                console.log(`✅ Existing stock cleaned up.`);
            }
        } catch (error) {
            console.log(`ℹ️ No existing stock to clean up.`);
        }
        
        console.log('📈 Creating test stock via UI...');
        
        // Navigate to portfolio page first
        await page.goto('/portfolio');
        await page.waitForLoadState('networkidle');
        
        // Create stock using UI method
        await createStockViaUI(page, { 
            ...config.stock, 
            owner: E2E_TEST_USER_OWNER_ID 
        } as any);
        
        // Get the created stock ID for use in the test
        const createdStock = await getPortfolioStockBySymbol(config.stock.symbol.toUpperCase());
        if (!createdStock) {
            throw new Error(`❌ Failed to find created stock ${config.stock.symbol}`);
        }
        stockId = createdStock.id;
        console.log(`✅ Test stock created via UI with ID: ${stockId}`);
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

    test('should validate STP and HTP values and colors across Signals page and Wallet tabs', async () => {
        console.log('🚀 Starting STP HTP validation test...');
        
        // Step 1: Set initial test price to $100 and navigate to wallet page
        console.log('\n📍 Step 1: Setting initial test price to $100...');
        await navigateToStockWalletPage(page, stockId, config.stock.symbol);
        await updateStockTestPrice(page, config.stock.symbol, config.testPriceUpdates.initialPrice.price);
        await verifyStockTestPrice(page, config.stock.symbol, config.testPriceUpdates.initialPrice.price);
        console.log('✅ Step 1 completed');

        // Step 2: Go to Signals page and click ticker to return to wallet page
        console.log('\n📍 Step 2: Going to Signals page and clicking ticker...');
        await page.goto('/signals');
        await page.waitForLoadState('networkidle');
        const tickerLink = page.locator(`a:has-text("${config.stock.symbol}")`);
        await expect(tickerLink).toBeVisible();
        await tickerLink.click();
        await page.waitForLoadState('networkidle');
        console.log('✅ Step 2 completed');

        // Step 3: Verify WalletsOverview section shows STP and HTP settings
        console.log('\n📍 Step 3: Verifying WalletsOverview settings...');
        await verifyWalletOverviewSettings(page, config);
        console.log('✅ Step 3 completed');

        // Step 4: Add Buy transaction (Split, Initial, $100 price, $200 investment)
        console.log('\n📍 Step 4: Adding Buy transaction...');
        await addBuyTransaction(page, config.transaction);
        console.log('✅ Step 4 completed');

        // Step 5: Verify Swing wallet tab STP and %2STP values and colors
        console.log('\n📍 Step 5: Verifying Swing wallet tab...');
        await verifySwingWalletTab(page, config);
        console.log('✅ Step 5 completed');

        // Step 6: Verify Hold wallet tab HTP and %2HTP values and colors
        console.log('\n📍 Step 6: Verifying Hold wallet tab...');
        await verifyHoldWalletTab(page, config);
        console.log('✅ Step 6 completed');

        // Step 7: Go to Signals page and verify %2STP and %2HTP values and colors
        console.log('\n📍 Step 7: Verifying Signals page values...');
        await verifySignalsPageValues(page, config);
        console.log('✅ Step 7 completed');

        console.log('\n🎉 STP HTP validation test completed successfully!');
    });
});
