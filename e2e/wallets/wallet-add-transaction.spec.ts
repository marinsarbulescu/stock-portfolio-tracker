// e2e/wallets/wallet-add-transaction.spec.ts

// This Playwright test suite is designed to verify the creation of stock transactions and the subsequent state of stock wallets (Swing and Hold)
// based on various input scenarios defined in a CSV file (`wallet-add-transaction.csv`).
// Updated to work with the new portfolio structure where stocks-listing has been renamed to portfolio.
//
// The suite performs the following operations:
//
// 1.  **Global Setup (`test.beforeAll`):**
//     a.  Loads all transaction scenarios from the specified CSV file. Each row in the CSV represents a distinct test case or a step in a more complex scenario.
//     b.  Reads stock creation parameters (symbol, name, type, region, pdp, plr, budget, swingHoldRatio) from the *first* scenario in the CSV.
//     c.  Creates a single `PortfolioStock` record in the database using these parameters. This stock is intended to be shared across all test scenarios defined in this file.
//     d.  Stores the ID of this newly created `PortfolioStock` for use in subsequent tests and for cleanup in `test.afterAll`.
//
// 2.  **Per-Test Setup (`test.beforeEach`):**
//     a.  **Session Cleanup:** Clears browser localStorage, sessionStorage, and cookies to ensure each test starts with a clean, unauthenticated session.
//     b.  **Login:** Navigates to the application's root, then logs in as a predefined E2E test user (credentials imported from `testCredentials.ts`).
//     c.  **Navigation:** After successful login, navigates directly to the wallet page for the `PortfolioStock` created in `test.beforeAll`.
//     d.  **Page Verification:** Confirms that the wallet page has loaded correctly by checking for the visibility and content of the page title, ensuring it matches the symbol of the shared stock.
//
// 3.  **Test Execution (Dynamically generated for each scenario in the CSV):**
//     For each row (scenario) in `wallet-add-transaction.csv`:
//     a.  **Pre-Scenario Data Cleanup (within the test itself):**
//         i.  Deletes any existing `StockWallet` and `Transaction` records associated with the shared `PortfolioStock`. This step is crucial for test isolation, ensuring that the outcome of one scenario does not affect subsequent ones.
//         ii. Reloads the wallet page to reflect this cleanup and ensure the UI is in a known state.
//     b.  **Transaction Form Interaction (if action is 'Buy'):**
//         i.  Clicks the "Add Buy Transaction" button to open the transaction modal.
//         ii. Fills the transaction form fields (date, transaction type, signal, price, investment) using data from the current CSV row.
//         iii. Submits the transaction form.
//         iv. Waits for the modal to close and for a brief period to allow UI updates.
//     c.  **Wallet State Verification (if action is 'Buy'):**
//         i.  **Swing Wallet:**
//             - Navigates to the "Swing" wallet tab.
//             - Based on the expected values in the CSV for the current scenario (`SwWtBuyPrice`, `SwWtTotalInvestment`, `SwWtRemainingShares`):
//                 - If a Swing wallet is expected (i.e., `txnType` is 'Swing' or 'Split' and `SwWtBuyPrice` > 0), it verifies:
//                     - The "wallet not found" message is NOT visible.
//                     - The displayed buy price, total investment, and remaining shares in the Swing wallet table match the (formatted) expected values from the CSV.
//                 - If no Swing wallet is expected (or it's expected to be empty/zeroed out), it verifies that the "wallet not found" message IS visible.
//         ii. **Hold Wallet:**
//             - Navigates to the "Hold" wallet tab.
//             - Performs similar verification for the Hold wallet based on `HlWtBuyPrice`, `HlWtTotalInvestment`, and `HlWtRemainingShares` from the CSV.
//                 - If a Hold wallet is expected (i.e., `txnType` is 'Hold' or 'Split' and `HlWtBuyPrice` > 0), it verifies its presence and correct data.
//                 - If no Hold wallet is expected, it verifies the "wallet not found" message.
//
// 4.  **Global Teardown (`test.afterAll`):**
//     a.  If a `PortfolioStock` was created in `test.beforeAll`:
//         i.  Deletes all `Transaction` records associated with it.
//         ii. Delete all `StockWallet` records associated with it.
//         iii. Deletes the `PortfolioStock` record itself.
//     b.  This ensures that all test-generated data is cleaned up from the database, maintaining a clean state for subsequent test runs or other development activities.
//
// Key aspects tested:
// - Correct creation of Buy transactions (Swing, Hold, Split).
// - Accurate creation and updating of Swing and Hold wallets based on transaction details.
// - Correct calculation and display of wallet metrics (buy price, total investment, remaining shares).
// - Data-driven testing approach using CSV to define a variety of transaction inputs and expected outcomes.
// - Robust setup, teardown, and per-test cleanup procedures for test data isolation and reliable execution.
// - User authentication and navigation to specific parts of the application.


// CSV Scenarios
// SplitBuyInitial. Split buy, check if Swing and Hold wallets are created correctly.
// SwingBuyCust. Swing buy, check if Swing wallet is created correctly.
// HoldBuyEOM. Hold buy, check if Hold wallet is created correctly.
// AnotherSplitBuy. Another split buy, check if Swing and Hold wallets are created correctly.


import { Amplify } from 'aws-amplify';
import { test, expect } from '@playwright/test';
import amplifyOutputs from '../../amplify_outputs.json'; // Adjust path if necessary

import {
    createPortfolioStock,
    deleteStockWalletsForStockByStockId,
    deletePortfolioStock,
    deleteTransactionsForStockByStockId,
    type PortfolioStockCreateData,
} from '../utils/dataHelpers'; // Adjust path if needed
import { E2E_TEST_USER_OWNER_ID, E2E_TEST_USERNAME, E2E_TEST_PASSWORD } from '../utils/testCredentials'; // Added import
import { clearBrowserState, loginUser, navigateToStockWalletPage } from '../utils/pageHelpers'; // Added import

// Import the generic loader and the specific interface for these scenarios
import { loadScenariosFromCSV, type AddTransactionInputScenario } from '../utils/csvHelper';

import {
    SHARE_PRECISION,
    CURRENCY_PRECISION,
} from '../../app/config/constants'; // Adjusted path assuming @/ is app/
import { formatCurrency, formatShares } from '../../app/utils/financialCalculations';

// Configure Amplify (should run once per test worker)
try {
    Amplify.configure(amplifyOutputs);
    console.log('[wallet-add-transaction.spec.ts] - Amplify configured successfully for E2E test spec.');
} catch (error) {
    console.error('[wallet-add-transaction.spec.ts] - CRITICAL: Error configuring Amplify in E2E spec file:', error);
}

// --- Load Transaction Scenarios from CSV ---
// Define which columns in your AddTransactionInputScenario CSV are numeric
const addTxnNumericColumns: ReadonlyArray<keyof AddTransactionInputScenario> = [
    'price',
    'investment',
    'quantity',
    'pdp',
    'plr',
    'swingHoldRatio',
    'lbd',
    'SwWtBuyPrice',
    'SwWtTotalInvestment',
    'SwWtRemainingShares',
    'HlWtBuyPrice',
    'HlWtTotalInvestment',
    'HlWtRemainingShares',
    'stockPdp',
    'stockPlr',
    'stockBudget',
    'stockSwingHoldRatio',
];

const transactionScenarios = loadScenariosFromCSV<AddTransactionInputScenario>(
    '../wallets/wallet-add-transaction.csv', // Path relative to the utils directory
    addTxnNumericColumns
);

// --- Test Suite ---
// A single stock will be created for all transaction scenarios in this file.
// const testStockSymbolForTransactions = 'E2ETXCSV'; // Now read from CSV
let sharedTestPortfolioStockId: string | null = null;
let currentStockSymbol: string | null = null; // To track the current stock being tested

// Use a describe block for each stock symbol to group tests logically
// For now, we assume all scenarios in the CSV use the same stock, or we process them sequentially.
// If multiple stocks are truly needed *concurrently* in `beforeAll`, the logic would be more complex.

test.describe(`Wallet Page - Add Transactions from CSV`, () => {
    test.beforeAll(async () => {
        console.log('[wallet-add-transaction.spec.ts] - BEFORE ALL: Starting test setup...');
        
        // Validate CSV scenarios are loaded
        if (transactionScenarios.length === 0) {
            throw new Error("No transaction scenarios loaded from CSV. Please check the CSV file path and content.");
        }
        
        const firstScenario = transactionScenarios[0];
        currentStockSymbol = firstScenario.stockSymbol;

        console.log(`[wallet-add-transaction.spec.ts] - BEFORE ALL: Setting up PortfolioStock: ${currentStockSymbol} for owner: ${E2E_TEST_USER_OWNER_ID}`);
        console.log(`[wallet-add-transaction.spec.ts] - BEFORE ALL: Total scenarios to test: ${transactionScenarios.length}`);
        
        try {
            const stockInput: PortfolioStockCreateData = {
                symbol: firstScenario.stockSymbol,
                name: firstScenario.stockName || `Test Stock ${firstScenario.stockSymbol}`,
                owner: E2E_TEST_USER_OWNER_ID,
                stockType: (firstScenario.stockStockType as PortfolioStockCreateData['stockType']) || 'Stock',
                region: (firstScenario.stockRegion as PortfolioStockCreateData['region']) || 'US',
                pdp: firstScenario.stockPdp ?? 5,
                plr: firstScenario.stockPlr ?? 2,
                budget: firstScenario.stockBudget ?? 600,
                swingHoldRatio: firstScenario.stockSwingHoldRatio ?? 50,
            };
            
            console.log('[wallet-add-transaction.spec.ts] - BEFORE ALL: Creating PortfolioStock with input:', stockInput);
            const createdStock = await createPortfolioStock(stockInput);
            sharedTestPortfolioStockId = createdStock.id;
            
            if (!sharedTestPortfolioStockId) {
                throw new Error('Failed to create PortfolioStock or get its ID.');
            }
            
            console.log(`[wallet-add-transaction.spec.ts] - BEFORE ALL: PortfolioStock ${currentStockSymbol} (ID: ${sharedTestPortfolioStockId}) created successfully.`);
        } catch (error) {
            console.error(`[wallet-add-transaction.spec.ts] - BEFORE ALL: PortfolioStock setup for ${currentStockSymbol} failed:`, error);
            throw error; // Fail fast if the shared stock can't be created
        }
    });    test.afterAll(async () => {
        if (sharedTestPortfolioStockId) {
            console.log(`[wallet-add-transaction.spec.ts] - AFTER ALL: Starting cleanup for PortfolioStock ID: ${sharedTestPortfolioStockId} (${currentStockSymbol})`);
            
            try {
                // Order of deletion is important due to foreign key constraints:
                // 1. Transactions (reference PortfolioStock)
                // 2. StockWallets (reference PortfolioStock)  
                // 3. PortfolioStock (parent record)

                console.log(`[wallet-add-transaction.spec.ts] - AFTER ALL: Deleting transactions...`);
                await deleteTransactionsForStockByStockId(sharedTestPortfolioStockId);
                
                console.log(`[wallet-add-transaction.spec.ts] - AFTER ALL: Deleting stock wallets...`);
                await deleteStockWalletsForStockByStockId(sharedTestPortfolioStockId);
                
                console.log(`[wallet-add-transaction.spec.ts] - AFTER ALL: Deleting portfolio stock...`);
                await deletePortfolioStock(sharedTestPortfolioStockId);

                console.log(`[wallet-add-transaction.spec.ts] - AFTER ALL: Full cleanup completed successfully for ${sharedTestPortfolioStockId}.`);
            } catch (error) {
                console.error(`[wallet-add-transaction.spec.ts] - AFTER ALL: Error during test cleanup for ${sharedTestPortfolioStockId}:`, error);
                // Log the error but don't fail the test suite - cleanup issues shouldn't block other tests
            } finally {
                sharedTestPortfolioStockId = null;
                currentStockSymbol = null;
            }
        } else {
            console.log('[wallet-add-transaction.spec.ts] - AFTER ALL: No sharedTestPortfolioStockId found for cleanup.');
        }
    });
    // This beforeEach runs before each `test` case generated by the loop below
    test.beforeEach(async ({ page }) => {
        console.log(`[wallet-add-transaction.spec.ts] - BEFORE EACH: Starting fresh session setup...`);
        
        // Clear browser state and establish clean session
        await clearBrowserState(page);
        console.log(`[wallet-add-transaction.spec.ts] - BEFORE EACH: Browser state cleared.`);

        // Login with test credentials
        console.log(`[wallet-add-transaction.spec.ts] - BEFORE EACH: Attempting login as ${E2E_TEST_USERNAME}...`);
        await loginUser(page);
        console.log(`[wallet-add-transaction.spec.ts] - BEFORE EACH: Login successful.`);

        // Validate prerequisites
        if (!sharedTestPortfolioStockId) {
            throw new Error("sharedTestPortfolioStockId is not set; cannot navigate to wallet page.");
        }
        if (!currentStockSymbol) {
            throw new Error("currentStockSymbol is not set in beforeEach");
        }

        // Navigate to the specific stock's wallet page
        console.log(`[wallet-add-transaction.spec.ts] - BEFORE EACH: Navigating to wallet page for ${currentStockSymbol} (ID: ${sharedTestPortfolioStockId})...`);
        await navigateToStockWalletPage(page, sharedTestPortfolioStockId, currentStockSymbol);
        console.log(`[wallet-add-transaction.spec.ts] - BEFORE EACH: Successfully on wallet page for ${currentStockSymbol}.`);
    });

    // REMOVED: const firstScenario = transactionScenarios[0];

    // --- Loop through each scenario from the CSV and create a test case ---
    for (const transactionInput of transactionScenarios) {
        // Ensure the test description uses the stock symbol from the scenario for clarity if it could change
        test(`Scenario: ${transactionInput.scenarioName} (${transactionInput.stockSymbol}) - Add ${transactionInput.action} (${transactionInput.signal})`, async ({ page }) => {
            console.log(`[${transactionInput.scenarioName}] Starting test for stock ${transactionInput.stockSymbol}.`);

            // Important: If stockSymbol can change per scenario, the beforeAll/afterAll logic
            // for stock creation/deletion needs to be per-scenario or per-group.
            // For now, we assume it's the same stock, managed by the outer beforeAll/afterAll.
            if (transactionInput.stockSymbol !== currentStockSymbol) {
                throw new Error(`Scenario ${transactionInput.scenarioName} uses stock ${transactionInput.stockSymbol}, but tests are set up for ${currentStockSymbol}. This setup needs adjustment if stocks vary per scenario.`);
            }            // Pre-test cleanup for isolation
            if (sharedTestPortfolioStockId) {
                console.log(`[${transactionInput.scenarioName}] Starting cleanup: deleting wallets and transactions for stock ID ${sharedTestPortfolioStockId}`);
                
                try {
                    await deleteStockWalletsForStockByStockId(sharedTestPortfolioStockId);
                    console.log(`[${transactionInput.scenarioName}] Wallets deleted successfully`);
                } catch (error) {
                    console.warn(`[${transactionInput.scenarioName}] Warning: Failed to delete wallets:`, error);
                }
                
                try {
                    await deleteTransactionsForStockByStockId(sharedTestPortfolioStockId);
                    console.log(`[${transactionInput.scenarioName}] Transactions deleted successfully`);
                } catch (error) {
                    console.warn(`[${transactionInput.scenarioName}] Warning: Failed to delete transactions:`, error);
                }
                
                // Reload page to reflect cleanup and ensure fresh state for wallet view
                console.log(`[${transactionInput.scenarioName}] Reloading page to reflect cleanup...`);
                await page.reload();
                
                // Wait for page to be ready after reload
                const titleElement = page.locator('[data-testid="wallet-page-title"]');
                await expect(titleElement).toBeVisible({ timeout: 15000 });
                if (!currentStockSymbol) throw new Error("currentStockSymbol is not set in test body");
                await expect(titleElement).toContainText(currentStockSymbol.toUpperCase(), { timeout: 5000 });
                console.log(`[${transactionInput.scenarioName}] Page reloaded and verified after cleanup.`);
            }

            // --- Ensure necessary transaction list columns are visible (optional, if needed for visual debugging) ---
            // console.log(`[wallet-add-transaction.spec.ts] - TEST [${transactionInput.scenarioName}]: Ensuring 'Date' column is visible...`);
            // const dateColumnToggle = page.locator('[data-testid="toggle-txn-col-date"]');
            // await dateColumnToggle.check(); 
            // await expect(dateColumnToggle).toBeChecked();
            // console.log(`[wallet-add-transaction.spec.ts] - TEST [${transactionInput.scenarioName}]: 'date' column toggle should now be checked.`);
            // (Add for other txn list columns if necessary)            // --- Form Filling and Submission (Only for 'Buy' actions as per current CSV focus) ---
            if (transactionInput.action === 'Buy') {
                console.log(`[${transactionInput.scenarioName}] Opening Add Transaction modal.`);
                const addBuyButton = page.locator('[data-testid="add-buy-transaction-button"]');
                await expect(addBuyButton).toBeVisible({ timeout: 5000 });
                await addBuyButton.click();

                const transactionModal = page.locator('[data-testid="add-buy-transaction-form-modal"]');
                await expect(transactionModal).toBeVisible({ timeout: 10000 });
                console.log(`[${transactionInput.scenarioName}] Add Transaction modal is visible.`);

                console.log(`[${transactionInput.scenarioName}] Filling form: Date=${transactionInput.date}, Action=${transactionInput.action}, Type=${transactionInput.txnType}, Signal=${transactionInput.signal}, Price=${transactionInput.price}, Investment=${transactionInput.investment}`);
                
                // Fill form fields with better error handling
                const dateField = transactionModal.locator('[data-testid="txn-form-date"]');
                await expect(dateField).toBeVisible({ timeout: 5000 });
                await dateField.fill(transactionInput.date);
                
                // Action is implicitly 'Buy' due to clicking "add-buy-transaction-button"

                // Select Buy Type (txnType) with better selectors
                console.log(`[${transactionInput.scenarioName}] Selecting transaction type: ${transactionInput.txnType}`);
                if (transactionInput.txnType === 'Swing') {
                    const swingRadio = page.locator('[data-testid="txn-form-txnType-swing"]');
                    await expect(swingRadio).toBeVisible({ timeout: 5000 });
                    await swingRadio.click();
                } else if (transactionInput.txnType === 'Hold') {
                    const holdRadio = page.locator('[data-testid="txn-form-txnType-hold"]');
                    await expect(holdRadio).toBeVisible({ timeout: 5000 });
                    await holdRadio.click();
                } else if (transactionInput.txnType === 'Split') {
                    const splitRadio = page.locator('[data-testid="txn-form-txnType-split"]');
                    await expect(splitRadio).toBeVisible({ timeout: 5000 });
                    await splitRadio.click();
                }

                // Fill signal if provided
                if (transactionInput.signal) {
                    const signalSelect = page.locator('[data-testid="txn-form-signal"]');
                    await expect(signalSelect).toBeVisible({ timeout: 5000 });
                    await signalSelect.selectOption(transactionInput.signal);
                }
                
                // Fill price and investment
                const priceField = page.locator('[data-testid="txn-form-price"]');
                await expect(priceField).toBeVisible({ timeout: 5000 });
                await priceField.fill(String(transactionInput.price));
                
                const investmentField = page.locator('[data-testid="txn-form-investment"]');
                await expect(investmentField).toBeVisible({ timeout: 5000 });
                await investmentField.fill(String(transactionInput.investment));

                // Submit the form
                console.log(`[${transactionInput.scenarioName}] Submitting transaction form...`);
                const submitButton = transactionModal.locator('[data-testid="txn-form-submit-button"]');
                await expect(submitButton).toBeVisible({ timeout: 5000 });
                await expect(submitButton).toBeEnabled({ timeout: 5000 });
                await submitButton.click();

                // Wait for modal to close
                await expect(transactionModal).not.toBeVisible({ timeout: 15000 });
                console.log(`[${transactionInput.scenarioName}] Transaction form submitted and modal closed.`);
                
                // Wait for UI to update after submission
                await page.waitForTimeout(3000);
            }            // --- Wallet Verification (Only for 'Buy' actions as per current CSV focus) ---
            if (transactionInput.action === 'Buy') {
                console.log(`[${transactionInput.scenarioName}] Starting wallet verification.`);

                // Verify Swing Wallet
                console.log(`[${transactionInput.scenarioName}] Verifying Swing Wallet.`);
                const swingTab = page.locator('[data-testid="wallet-tab-Swing"]');
                await expect(swingTab).toBeVisible({ timeout: 5000 });
                await swingTab.click();
                await page.waitForTimeout(1000); // Allow tab content to load

                const expectSwingWallet = (transactionInput.txnType === 'Split' || transactionInput.txnType === 'Swing') && 
                                         transactionInput.SwWtBuyPrice !== undefined && 
                                         transactionInput.SwWtBuyPrice > 0;

                if (expectSwingWallet) {
                    console.log(`[${transactionInput.scenarioName}] Expecting Swing Wallet to be present with data.`);
                    
                    // Ensure no "not found" message is visible
                    const notFoundMessage = page.locator('[data-testid="wallet-notfound-display"]');
                    await expect(notFoundMessage).not.toBeVisible({ timeout: 5000 });
                    
                    // Verify wallet table and data
                    const walletsTable = page.locator('[data-testid="wallets-table"]');
                    await expect(walletsTable).toBeVisible({ timeout: 5000 });
                    
                    const swingWalletRow = walletsTable.locator('tbody tr').first();
                    await expect(swingWalletRow).toBeVisible({ timeout: 5000 });
                    
                    // Verify buy price
                    const buyPriceCell = swingWalletRow.locator('[data-testid="wallet-buyPrice-display"]');
                    const expectedBuyPrice = `$${formatShares(transactionInput.SwWtBuyPrice!, CURRENCY_PRECISION)}`;
                    await expect(buyPriceCell).toHaveText(expectedBuyPrice, { timeout: 10000 });
                    
                    // Verify total investment  
                    const totalInvestmentCell = swingWalletRow.locator('[data-testid="wallet-totalInvestment-display"]');
                    const expectedTotalInvestment = `$${formatShares(transactionInput.SwWtTotalInvestment!, CURRENCY_PRECISION)}`;
                    await expect(totalInvestmentCell).toHaveText(expectedTotalInvestment, { timeout: 5000 });
                    
                    // Verify remaining shares
                    const remainingSharesCell = swingWalletRow.locator('[data-testid="wallet-remainingShares-display"]');
                    const expectedRemainingShares = formatShares(transactionInput.SwWtRemainingShares!, SHARE_PRECISION);
                    await expect(remainingSharesCell).toHaveText(expectedRemainingShares, { timeout: 5000 });
                    
                    console.log(`[${transactionInput.scenarioName}] Swing Wallet verified successfully.`);
                } else {
                    console.log(`[${transactionInput.scenarioName}] Expecting NO Swing Wallet or 'Not Found' message.`);
                    const notFoundMessage = page.locator('[data-testid="wallet-notfound-display"]');
                    await expect(notFoundMessage).toBeVisible({ timeout: 10000 });
                    await expect(notFoundMessage).toContainText('No Swing wallets with shares found for this stock.', { timeout: 5000 });
                    console.log(`[${transactionInput.scenarioName}] 'No Swing wallets with shares found for this stock.' message verified.`);
                }

                // Verify Hold Wallet
                console.log(`[${transactionInput.scenarioName}] Verifying Hold Wallet.`);
                const holdTab = page.locator('[data-testid="wallet-tab-Hold"]');
                await expect(holdTab).toBeVisible({ timeout: 5000 });
                await holdTab.click();
                await page.waitForTimeout(1000); // Allow tab content to load

                const expectHoldWallet = (transactionInput.txnType === 'Split' || transactionInput.txnType === 'Hold') && 
                                        transactionInput.HlWtBuyPrice !== undefined && 
                                        transactionInput.HlWtBuyPrice > 0;

                if (expectHoldWallet) {
                    console.log(`[${transactionInput.scenarioName}] Expecting Hold Wallet to be present with data.`);
                    
                    // Ensure no "not found" message is visible
                    const notFoundMessage = page.locator('[data-testid="wallet-notfound-display"]');
                    await expect(notFoundMessage).not.toBeVisible({ timeout: 5000 });
                    
                    // Verify wallet table and data
                    const walletsTable = page.locator('[data-testid="wallets-table"]');
                    await expect(walletsTable).toBeVisible({ timeout: 5000 });
                    
                    const holdWalletRow = walletsTable.locator('tbody tr').first();
                    await expect(holdWalletRow).toBeVisible({ timeout: 5000 });
                    
                    // Verify buy price
                    const buyPriceCell = holdWalletRow.locator('[data-testid="wallet-buyPrice-display"]');
                    const expectedBuyPrice = `$${formatShares(transactionInput.HlWtBuyPrice!, CURRENCY_PRECISION)}`;
                    await expect(buyPriceCell).toHaveText(expectedBuyPrice, { timeout: 10000 });
                    
                    // Verify total investment
                    const totalInvestmentCell = holdWalletRow.locator('[data-testid="wallet-totalInvestment-display"]');
                    const expectedTotalInvestment = `$${formatShares(transactionInput.HlWtTotalInvestment!, CURRENCY_PRECISION)}`;
                    await expect(totalInvestmentCell).toHaveText(expectedTotalInvestment, { timeout: 5000 });
                    
                    // Verify remaining shares
                    const remainingSharesCell = holdWalletRow.locator('[data-testid="wallet-remainingShares-display"]');
                    const expectedRemainingShares = formatShares(transactionInput.HlWtRemainingShares!, SHARE_PRECISION);
                    await expect(remainingSharesCell).toHaveText(expectedRemainingShares, { timeout: 5000 });
                    
                    console.log(`[${transactionInput.scenarioName}] Hold Wallet verified successfully.`);
                } else {
                    console.log(`[${transactionInput.scenarioName}] Expecting NO Hold Wallet or 'Not Found' message.`);
                    const notFoundMessage = page.locator('[data-testid="wallet-notfound-display"]');
                    await expect(notFoundMessage).toBeVisible({ timeout: 10000 });
                    await expect(notFoundMessage).toContainText('No Hold wallets with shares found for this stock.', { timeout: 5000 });
                    console.log(`[${transactionInput.scenarioName}] 'No Hold wallets with shares found for this stock.' message verified.`);
                }
            }
            console.log(`[${transactionInput.scenarioName}] Test completed.`);
        });
    }
});
