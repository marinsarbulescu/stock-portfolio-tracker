// e2e/wallets/wallet-delete-transaction.spec.ts

// This Playwright test suite verifies the deletion of stock transactions and the subsequent state of stock wallets (Swing and Hold).
// The suite tests each transaction type (Split, Swing, Hold) by:
// 1. Creating a transaction
// 2. Deleting the transaction via UI
// 3. Verifying the wallet state after deletion
//
// Test Flow:
// 1. **Global Setup (`test.beforeAll`):**
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
//    - Creates a transaction of the specified type
//    - Verifies the wallet(s) are created correctly
//    - Deletes the transaction via UI
//    - Verifies the wallet(s) are removed/updated correctly
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
} from '../utils/dataHelpers';
import { E2E_TEST_USER_OWNER_ID, E2E_TEST_USERNAME, E2E_TEST_PASSWORD } from '../utils/testCredentials';
import { clearBrowserState, loginUser, navigateToStockWalletPage } from '../utils/pageHelpers';

import {
    SHARE_PRECISION,
    CURRENCY_PRECISION,
} from '../../app/config/constants';
import { formatCurrency, formatShares } from '../../app/utils/financialCalculations';

// Configure Amplify
try {
    Amplify.configure(amplifyOutputs);
    console.log('[wallet-delete-transaction.spec.ts] - Amplify configured successfully for E2E test spec.');
} catch (error) {
    console.error('[wallet-delete-transaction.spec.ts] - CRITICAL: Error configuring Amplify in E2E spec file:', error);
}

// Test data for different transaction types
const transactionScenarios = [
    {
        name: 'Split Transaction',
        type: 'Split',
        signal: 'Initial',
        price: 10.00,
        investment: 200.00,
        expectedSwingShares: 10, // 50% of 20 shares
        expectedHoldShares: 10,  // 50% of 20 shares
        expectedSwingInvestment: 100, // 50% of $200
        expectedHoldInvestment: 100,  // 50% of $200
    },
    {
        name: 'Swing Transaction',
        type: 'Swing',
        signal: 'Cust',
        price: 25.00,
        investment: 500.00,
        expectedSwingShares: 20, // All shares go to Swing
        expectedHoldShares: 0,   // No shares to Hold
        expectedSwingInvestment: 500, // All investment to Swing
        expectedHoldInvestment: 0,    // No investment to Hold
    },
    {
        name: 'Hold Transaction',
        type: 'Hold',
        signal: 'EOM',
        price: 7.00,
        investment: 350.00,
        expectedSwingShares: 0,  // No shares to Swing
        expectedHoldShares: 50,  // All shares go to Hold (350/7 = 50)
        expectedSwingInvestment: 0,   // No investment to Swing
        expectedHoldInvestment: 350,  // All investment to Hold
    },
];

// Global test state
let sharedTestPortfolioStockId: string | null = null;
let currentStockSymbol: string | null = null;
const client = generateClient<Schema>();

test.describe('Wallet Page - Delete Transactions and Verify Wallets', () => {
    
    test.beforeAll(async () => {
        console.log('[wallet-delete-transaction.spec.ts] - BEFORE ALL: Starting test setup...');
        
        // Create a shared test stock
        const testStockSymbol = 'E2EDEL';
        const testStockName = 'E2E Delete Test Stock';
        currentStockSymbol = testStockSymbol;
        
        console.log(`[wallet-delete-transaction.spec.ts] - BEFORE ALL: Setting up PortfolioStock: ${testStockSymbol} for owner: ${E2E_TEST_USER_OWNER_ID}`);
        
        try {
            const stockInput = {
                symbol: testStockSymbol,
                name: testStockName,
                owner: E2E_TEST_USER_OWNER_ID,
                stockType: 'Stock' as const,
                region: 'US' as const,
                pdp: 5,
                plr: 2,
                budget: 600,
                swingHoldRatio: 50,
            };
            
            console.log('[wallet-delete-transaction.spec.ts] - BEFORE ALL: Creating PortfolioStock with input:', stockInput);
            
            const portfolioStock = await createPortfolioStock(stockInput);
            sharedTestPortfolioStockId = portfolioStock.id;
            
            console.log(`[wallet-delete-transaction.spec.ts] - BEFORE ALL: PortfolioStock ${testStockSymbol} (ID: ${sharedTestPortfolioStockId}) created successfully.`);
        } catch (error) {
            console.error(`[wallet-delete-transaction.spec.ts] - BEFORE ALL: PortfolioStock setup for ${testStockSymbol} failed:`, error);
            throw error;
        }
    });

    test.afterAll(async () => {
        if (sharedTestPortfolioStockId) {
            console.log(`[wallet-delete-transaction.spec.ts] - AFTER ALL: Starting cleanup for PortfolioStock ID: ${sharedTestPortfolioStockId} (${currentStockSymbol})`);
            try {
                console.log(`[wallet-delete-transaction.spec.ts] - AFTER ALL: Deleting transactions...`);
                await deleteTransactionsForStockByStockId(sharedTestPortfolioStockId);
                
                console.log(`[wallet-delete-transaction.spec.ts] - AFTER ALL: Deleting stock wallets...`);
                await deleteStockWalletsForStockByStockId(sharedTestPortfolioStockId);
                
                console.log(`[wallet-delete-transaction.spec.ts] - AFTER ALL: Deleting portfolio stock...`);
                await deletePortfolioStock(sharedTestPortfolioStockId);
                
                console.log(`[wallet-delete-transaction.spec.ts] - AFTER ALL: Full cleanup completed successfully for ${sharedTestPortfolioStockId}.`);
            } catch (error) {
                console.error(`[wallet-delete-transaction.spec.ts] - AFTER ALL: Error during test cleanup for ${sharedTestPortfolioStockId}:`, error);
            }
        } else {
            console.log('[wallet-delete-transaction.spec.ts] - AFTER ALL: No sharedTestPortfolioStockId found for cleanup.');
        }
    });

    test.beforeEach(async ({ page }) => {
        console.log(`[wallet-delete-transaction.spec.ts] - BEFORE EACH: Starting fresh session setup...`);
        
        // Clear browser state
        await clearBrowserState(page);
        console.log(`[wallet-delete-transaction.spec.ts] - BEFORE EACH: Browser state cleared.`);
        
        // Login
        console.log(`[wallet-delete-transaction.spec.ts] - BEFORE EACH: Attempting login as ${E2E_TEST_USERNAME}...`);
        await loginUser(page, E2E_TEST_USERNAME, E2E_TEST_PASSWORD);
        console.log(`[wallet-delete-transaction.spec.ts] - BEFORE EACH: Login successful.`);
        
        // Navigate to wallet page
        if (!sharedTestPortfolioStockId || !currentStockSymbol) {
            throw new Error("Test setup failed: Missing stock ID or symbol");
        }
        
        console.log(`[wallet-delete-transaction.spec.ts] - BEFORE EACH: Navigating to wallet page for ${currentStockSymbol} (ID: ${sharedTestPortfolioStockId})...`);
        await navigateToStockWalletPage(page, sharedTestPortfolioStockId, currentStockSymbol);
        console.log(`[wallet-delete-transaction.spec.ts] - BEFORE EACH: Successfully on wallet page for ${currentStockSymbol}.`);
        
        // Clean up any existing data for test isolation
        if (sharedTestPortfolioStockId) {
            try {
                await deleteStockWalletsForStockByStockId(sharedTestPortfolioStockId);
                await deleteTransactionsForStockByStockId(sharedTestPortfolioStockId);
                
                // Reload page to reflect cleanup
                await page.reload();
                
                // Wait for page to be ready after reload
                const titleElement = page.locator('[data-testid="wallet-page-title"]');
                await expect(titleElement).toBeVisible({ timeout: 15000 });
                await expect(titleElement).toContainText(currentStockSymbol.toUpperCase(), { timeout: 5000 });
                
                console.log(`[wallet-delete-transaction.spec.ts] - BEFORE EACH: Data cleanup and page reload completed.`);
            } catch (error) {
                console.warn(`[wallet-delete-transaction.spec.ts] - BEFORE EACH: Warning during cleanup:`, error);
            }
        }
    });

    // Generate test for each transaction type
    transactionScenarios.forEach((scenario) => {
        test(`Delete ${scenario.name} - Create, Delete, Verify Wallet State`, async ({ page }) => {
            const scenarioName = `Delete${scenario.type}`;
            console.log(`[${scenarioName}] Starting test for ${scenario.name}.`);
            
            // Step 1: Create the transaction
            console.log(`[${scenarioName}] Step 1: Creating ${scenario.type} transaction.`);
            
            // Open Add Transaction modal
            const addTransactionButton = page.locator('[data-testid="add-buy-transaction-button"]');
            await expect(addTransactionButton).toBeVisible({ timeout: 10000 });
            await addTransactionButton.click();
              const transactionModal = page.locator('[data-testid="add-buy-transaction-form-modal"]');
            await expect(transactionModal).toBeVisible({ timeout: 10000 });
            console.log(`[${scenarioName}] Add Transaction modal opened.`);
            
            // Fill transaction form
            const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
            await page.locator('[data-testid="txn-form-date"]').fill(today);
            await page.locator('[data-testid="txn-form-price"]').fill(scenario.price.toString());
            await page.locator('[data-testid="txn-form-investment"]').fill(scenario.investment.toString());
              // Select transaction type using radio buttons
            console.log(`[${scenarioName}] Selecting transaction type: ${scenario.type}`);
            if (scenario.type === 'Swing') {
                const swingRadio = page.locator('[data-testid="txn-form-txnType-swing"]');
                await expect(swingRadio).toBeVisible({ timeout: 5000 });
                await swingRadio.click();
            } else if (scenario.type === 'Hold') {
                const holdRadio = page.locator('[data-testid="txn-form-txnType-hold"]');
                await expect(holdRadio).toBeVisible({ timeout: 5000 });
                await holdRadio.click();
            } else if (scenario.type === 'Split') {
                const splitRadio = page.locator('[data-testid="txn-form-txnType-split"]');
                await expect(splitRadio).toBeVisible({ timeout: 5000 });
                await splitRadio.click();
            }
            
            // Select signal
            await page.locator('[data-testid="txn-form-signal"]').selectOption(scenario.signal);
            
            console.log(`[${scenarioName}] Form filled: Date=${today}, Type=${scenario.type}, Signal=${scenario.signal}, Price=${scenario.price}, Investment=${scenario.investment}`);
            
            // Submit the form
            const submitButton = page.locator('[data-testid="txn-form-submit-button"]');
            await submitButton.click();
            
            // Wait for modal to close
            await expect(transactionModal).not.toBeVisible({ timeout: 15000 });
            console.log(`[${scenarioName}] Transaction created successfully.`);
            
            // Wait for UI to update
            await page.waitForTimeout(3000);
            
            // Step 2: Verify wallets were created correctly
            console.log(`[${scenarioName}] Step 2: Verifying wallet creation.`);
            
            // Verify Swing Wallet
            const swingTab = page.locator('[data-testid="wallet-tab-Swing"]');
            await expect(swingTab).toBeVisible({ timeout: 5000 });
            await swingTab.click();
            await page.waitForTimeout(1000);
            
            if (scenario.expectedSwingShares > 0) {
                console.log(`[${scenarioName}] Verifying Swing wallet exists with ${scenario.expectedSwingShares} shares.`);
                
                const swingNotFoundMessage = page.locator('text=No Swing wallets with shares found for this stock.');
                await expect(swingNotFoundMessage).not.toBeVisible();
                
                const swingBuyPrice = page.locator('[data-testid="wallet-buyPrice-display"]').first();
                const swingTotalInvestment = page.locator('[data-testid="wallet-totalInvestment-display"]').first();
                const swingRemainingShares = page.locator('[data-testid="wallet-remainingShares-display"]').first();
                
                await expect(swingBuyPrice).toContainText(formatCurrency(scenario.price));
                await expect(swingTotalInvestment).toContainText(formatCurrency(scenario.expectedSwingInvestment));
                await expect(swingRemainingShares).toContainText(formatShares(scenario.expectedSwingShares, SHARE_PRECISION));
                
                console.log(`[${scenarioName}] Swing wallet verified successfully.`);
            } else {
                console.log(`[${scenarioName}] Verifying NO Swing wallet exists.`);
                const swingNotFoundMessage = page.locator('text=No Swing wallets with shares found for this stock.');
                await expect(swingNotFoundMessage).toBeVisible();
                console.log(`[${scenarioName}] No Swing wallet confirmed.`);
            }
            
            // Verify Hold Wallet
            const holdTab = page.locator('[data-testid="wallet-tab-Hold"]');
            await expect(holdTab).toBeVisible({ timeout: 5000 });
            await holdTab.click();
            await page.waitForTimeout(1000);
            
            if (scenario.expectedHoldShares > 0) {
                console.log(`[${scenarioName}] Verifying Hold wallet exists with ${scenario.expectedHoldShares} shares.`);
                
                const holdNotFoundMessage = page.locator('text=No Hold wallets with shares found for this stock.');
                await expect(holdNotFoundMessage).not.toBeVisible();
                
                const holdBuyPrice = page.locator('[data-testid="wallet-buyPrice-display"]').first();
                const holdTotalInvestment = page.locator('[data-testid="wallet-totalInvestment-display"]').first();
                const holdRemainingShares = page.locator('[data-testid="wallet-remainingShares-display"]').first();
                
                await expect(holdBuyPrice).toContainText(formatCurrency(scenario.price));
                await expect(holdTotalInvestment).toContainText(formatCurrency(scenario.expectedHoldInvestment));
                await expect(holdRemainingShares).toContainText(formatShares(scenario.expectedHoldShares, SHARE_PRECISION));
                
                console.log(`[${scenarioName}] Hold wallet verified successfully.`);
            } else {
                console.log(`[${scenarioName}] Verifying NO Hold wallet exists.`);
                const holdNotFoundMessage = page.locator('text=No Hold wallets with shares found for this stock.');
                await expect(holdNotFoundMessage).toBeVisible();
                console.log(`[${scenarioName}] No Hold wallet confirmed.`);
            }
            
            // Step 3: Delete the transaction
            console.log(`[${scenarioName}] Step 3: Deleting the transaction.`);
            
            // Navigate to transactions section (scroll down if needed)
            const transactionsSection = page.locator('text=Transactions').first();
            await transactionsSection.scrollIntoViewIfNeeded();
            await page.waitForTimeout(1000);
            
            // Find the delete button for the transaction (should be the first/only one)
            const deleteButton = page.locator('[data-testid^="transaction-delete-button-"]').first();
            await expect(deleteButton).toBeVisible({ timeout: 10000 });
            console.log(`[${scenarioName}] Delete button found, clicking...`);
            
            // Handle the confirmation dialog
            page.once('dialog', async dialog => {
                console.log(`[${scenarioName}] Confirmation dialog appeared: ${dialog.message()}`);
                await dialog.accept();
            });
            
            await deleteButton.click();
            console.log(`[${scenarioName}] Transaction deletion confirmed.`);
            
            // Wait for deletion to process
            await page.waitForTimeout(3000);
            
            // Step 4: Verify wallets are removed/cleared after deletion
            console.log(`[${scenarioName}] Step 4: Verifying wallet state after deletion.`);
            
            // Check Swing Wallet
            await swingTab.click();
            await page.waitForTimeout(1000);
            
            const swingNotFoundAfterDelete = page.locator('text=No Swing wallets with shares found for this stock.');
            await expect(swingNotFoundAfterDelete).toBeVisible();
            console.log(`[${scenarioName}] Swing wallet removed after deletion.`);
            
            // Check Hold Wallet
            await holdTab.click();
            await page.waitForTimeout(1000);
            
            const holdNotFoundAfterDelete = page.locator('text=No Hold wallets with shares found for this stock.');
            await expect(holdNotFoundAfterDelete).toBeVisible();
            console.log(`[${scenarioName}] Hold wallet removed after deletion.`);
              // Verify no transactions remain
            const noTransactionsMessage = page.locator('[data-testid="no-transactions-message"]');
            await expect(noTransactionsMessage).toBeVisible();
            await expect(noTransactionsMessage).toContainText('No transactions found for this stock.');
            console.log(`[${scenarioName}] Transaction removal confirmed.`);
            
            console.log(`[${scenarioName}] Test completed successfully.`);
        });
    });
});
