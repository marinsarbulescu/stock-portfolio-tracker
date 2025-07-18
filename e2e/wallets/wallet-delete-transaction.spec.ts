// e2e/wallets/wallet-delete-transaction.spec.ts

// This Playwright test suite verifies the deletion of stock transactions and the subsequent state of stock wallets (Swing and Hold).
// The suite tests each transaction type (Split, Swing, Hold) using scenarios defined in a CSV file (`wallet-delete-transaction.csv`) by:
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
import { clearBrowserState, loginUser, navigateToStockWalletPage, addTransaction, deleteTransaction } from '../utils/pageHelpers';
import { loadScenariosFromCSV } from '../utils/csvHelper';

import {
    SHARE_PRECISION,
    CURRENCY_PRECISION,
} from '../../app/config/constants';
import { formatCurrency, formatShares } from '../../app/utils/financialCalculations';

// Configure Amplify
try {
    Amplify.configure(amplifyOutputs);
    console.log('[wallet-delete-transaction.spec.ts] - Amplify configured successfully for E2E test spec.');
} catch (error) {    console.error('[wallet-delete-transaction.spec.ts] - CRITICAL: Error configuring Amplify in E2E spec file:', error);
}

// Define the interface for delete transaction scenarios
interface DeleteTransactionScenario {
    name: string;
    type: 'Split' | 'Swing' | 'Hold';
    signal: string;
    price: number;
    investment: number;
    expectedSwingShares: number;
    expectedHoldShares: number;
    expectedSwingInvestment: number;
    expectedHoldInvestment: number;
}

// Load scenarios from CSV
const transactionScenarios = loadScenariosFromCSV<DeleteTransactionScenario>(
    '../wallets/wallet-delete-transaction.csv',
    ['price', 'investment', 'expectedSwingShares', 'expectedHoldShares', 'expectedSwingInvestment', 'expectedHoldInvestment']
);

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
            
            await addTransaction(page, {
                type: scenario.type,
                signal: scenario.signal,
                price: scenario.price,
                investment: scenario.investment
            });
            
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
            
            await deleteTransaction(page);
            
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
            const noTransactionsMessage = page.locator('[data-testid="wallets-transaction-table-no-transactions-message"]');
            await expect(noTransactionsMessage).toBeVisible();
            await expect(noTransactionsMessage).toContainText('No transactions found for this stock.');
            console.log(`[${scenarioName}] Transaction removal confirmed.`);
            
            console.log(`[${scenarioName}] Test completed successfully.`);
        });
    });
});
