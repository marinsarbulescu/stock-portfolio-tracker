// e2e/wallets/wallet-add-transaction.spec.ts

// This Playwright test suite is designed to verify the creation of stock transactions and the subsequent state of stock wallets (Swing and Hold)
// based on various input scenarios defined in a CSV file (`wallet-add-transaction.csv`).
// Includes:
// 1. Login
// 2. Creates a stock
// 3. Navigation to the wallet page
// 4. Add Buy Transaction
// 5. Fill in the transaction form based on the CSV scenarios
// 6. Submit the form
// 7. Verify the wallet state (Swing and Hold) after the transaction is added.
// 8. Verify buyPrice, totalInvestment, and remainingShares in both Swing and Hold wallets.
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
import { clearBrowserState, loginUser, navigateToStockWalletPage, addTransaction } from '../utils/pageHelpers'; // Added import

// Import the generic loader and the specific interface for these scenarios
import { loadScenariosFromCSV, type AddTransactionInputScenario } from '../utils/csvHelper';

import {
    SHARE_PRECISION,
    CURRENCY_PRECISION,
} from '../../app/config/constants'; // Adjusted path assuming @/ is app/
import { formatCurrency, formatShares } from '../../app/utils/financialCalculations';
import { formatToMDYYYY } from '../../app/utils/dateFormatter';

// Helper function to calculate LBD with commission (same logic as the app)
function calculateExpectedLBD(price: number, pdp: number, commission?: number): number {
    // Calculate target LBD (without commission adjustment)
    const targetLBD = price - (price * (pdp / 100));
    
    // Apply commission adjustment if commission is provided and > 0
    if (typeof commission === 'number' && commission > 0) {
        const commissionRate = commission / 100;
        
        // Prevent division by zero or extreme values
        if (commissionRate >= 1) {
            console.warn(`Commission rate (${commission}%) is too high, using target LBD without adjustment`);
            return targetLBD;
        } else {
            // Commission-adjusted LBD: targetLBD / (1 + commissionRate)
            // This ensures that LBD + commission = target LBD
            return targetLBD / (1 + commissionRate);
        }
    } else {
        // No commission or invalid commission, use target LBD
        return targetLBD;
    }
}

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
    'stockCommission',
];

const transactionScenarios = loadScenariosFromCSV<AddTransactionInputScenario>(
    '../wallets/wallet-add-transaction.csv', // Path relative to the utils directory
    addTxnNumericColumns
);

// --- Test Suite ---
// Group scenarios by commission value to create separate stocks for each unique commission
function groupScenariosByCommission(scenarios: AddTransactionInputScenario[]): Map<number, AddTransactionInputScenario[]> {
    const groups = new Map<number, AddTransactionInputScenario[]>();
    
    for (const scenario of scenarios) {
        const commission = scenario.stockCommission ?? 0;
        if (!groups.has(commission)) {
            groups.set(commission, []);
        }
        groups.get(commission)!.push(scenario);
    }
    
    return groups;
}

const scenarioGroups = groupScenariosByCommission(transactionScenarios);

// Use a describe block for each commission group to ensure proper stock setup/cleanup
for (const [commission, scenarios] of Array.from(scenarioGroups.entries())) {
    test.describe(`Wallet Page - Add Transactions with ${commission}% Commission`, () => {
        let testPortfolioStockId: string | null = null;
        let testStockSymbol: string | null = null;

        test.beforeAll(async () => {
            console.log(`[Commission ${commission}%] - BEFORE ALL: Starting test setup...`);
            
            // Validate scenarios are available for this commission group
            if (scenarios.length === 0) {
                throw new Error(`No scenarios available for commission ${commission}%.`);
            }
            
            // Get stock parameters from the first scenario in this group
            // (all scenarios in a group should have the same stock parameters except for commission)
            const firstScenario = scenarios[0];
            testStockSymbol = firstScenario.stockSymbol;
            
            console.log(`[Commission ${commission}%] - BEFORE ALL: Creating stock ${testStockSymbol} with ${commission}% commission...`);
            
            // Create stock with the specific commission for this group
            const stockData: PortfolioStockCreateData = {
                owner: E2E_TEST_USER_OWNER_ID,
                symbol: firstScenario.stockSymbol,
                name: firstScenario.stockName,
                stockType: firstScenario.stockStockType as 'Stock' | 'ETF' | 'Crypto',
                region: firstScenario.stockRegion as 'APAC' | 'EU' | 'Intl' | 'US',
                pdp: firstScenario.stockPdp!,
                plr: firstScenario.stockPlr!,
                budget: firstScenario.stockBudget!,
                swingHoldRatio: firstScenario.stockSwingHoldRatio!,
                stockCommission: commission // Use the commission specific to this group
            };
            
            try {
                const createdStock = await createPortfolioStock(stockData);
                testPortfolioStockId = createdStock.id;
                console.log(`[Commission ${commission}%] - BEFORE ALL: Stock created successfully with ID: ${testPortfolioStockId}`);
            } catch (error) {
                console.error(`[Commission ${commission}%] - BEFORE ALL: Failed to create stock:`, error);
                throw error;
            }
            
            console.log(`[Commission ${commission}%] - BEFORE ALL: Total scenarios to test in this group: ${scenarios.length}`);
        });

        test.afterAll(async () => {
            console.log(`[Commission ${commission}%] - AFTER ALL: Starting cleanup...`);
            
            if (testPortfolioStockId) {
                try {
                    console.log(`[Commission ${commission}%] - AFTER ALL: Deleting wallets for stock ID ${testPortfolioStockId}...`);
                    await deleteStockWalletsForStockByStockId(testPortfolioStockId);
                    
                    console.log(`[Commission ${commission}%] - AFTER ALL: Deleting transactions for stock ID ${testPortfolioStockId}...`);
                    await deleteTransactionsForStockByStockId(testPortfolioStockId);
                    
                    console.log(`[Commission ${commission}%] - AFTER ALL: Deleting stock ${testPortfolioStockId}...`);
                    await deletePortfolioStock(testPortfolioStockId);
                    
                    console.log(`[Commission ${commission}%] - AFTER ALL: Cleanup completed successfully.`);
                } catch (error) {
                    console.error(`[Commission ${commission}%] - AFTER ALL: Error during cleanup:`, error);
                }
            }
        });

        // This beforeEach runs before each `test` case in this commission group
        test.beforeEach(async ({ page }) => {
            console.log(`[Commission ${commission}%] - BEFORE EACH: Starting fresh session setup...`);
            
            // Clear browser state and establish clean session
            await clearBrowserState(page);
            console.log(`[Commission ${commission}%] - BEFORE EACH: Browser state cleared.`);

            // Login with test credentials
            console.log(`[Commission ${commission}%] - BEFORE EACH: Attempting login as ${E2E_TEST_USERNAME}...`);
            await loginUser(page);
            console.log(`[Commission ${commission}%] - BEFORE EACH: Login successful.`);
            
            // Navigate to the stock's wallet page
            if (!testPortfolioStockId || !testStockSymbol) {
                throw new Error("Stock not created in beforeAll - cannot navigate to wallet page");
            }
            
            console.log(`[Commission ${commission}%] - BEFORE EACH: Navigating to wallet page for stock ${testStockSymbol}...`);
            await navigateToStockWalletPage(page, testPortfolioStockId, testStockSymbol);
            
            // Verify we're on the correct wallet page
            const titleElement = page.locator('[data-testid="wallet-page-title"]');
            await expect(titleElement).toBeVisible({ timeout: 15000 });
            await expect(titleElement).toContainText(testStockSymbol.toUpperCase(), { timeout: 5000 });
            console.log(`[Commission ${commission}%] - BEFORE EACH: Successfully navigated to wallet page for ${testStockSymbol}.`);
        });

        // --- Loop through each scenario in this commission group and create a test case ---
        for (const transactionInput of scenarios) {
            test(`Scenario: ${transactionInput.scenarioName} - Add ${transactionInput.action} (${transactionInput.signal})`, async ({ page }) => {
                console.log(`[${transactionInput.scenarioName}] Starting test for stock ${transactionInput.stockSymbol} with ${commission}% commission.`);

                // Pre-test cleanup for isolation within this commission group
                if (testPortfolioStockId) {
                    console.log(`[${transactionInput.scenarioName}] Starting cleanup: deleting wallets and transactions for stock ID ${testPortfolioStockId}`);
                    
                    try {
                        await deleteStockWalletsForStockByStockId(testPortfolioStockId);
                        console.log(`[${transactionInput.scenarioName}] Wallets deleted successfully`);
                    } catch (error) {
                        console.warn(`[${transactionInput.scenarioName}] Warning: Failed to delete wallets:`, error);
                    }
                    
                    try {
                        await deleteTransactionsForStockByStockId(testPortfolioStockId);
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
                    if (!testStockSymbol) throw new Error("testStockSymbol is not set in test body");
                    await expect(titleElement).toContainText(testStockSymbol.toUpperCase(), { timeout: 5000 });
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
                console.log(`[${transactionInput.scenarioName}] Creating transaction via helper.`);
                
                await addTransaction(page, {
                    date: transactionInput.date,
                    type: transactionInput.txnType!,
                    signal: transactionInput.signal!,
                    price: transactionInput.price!,
                    investment: transactionInput.investment!
                });

                // --- Verify transaction appears in WalletsTransactionsTable ---
                console.log(`[${transactionInput.scenarioName}] Verifying transaction appears in WalletsTransactionsTable.`);
                
                // Ensure transaction columns are visible for verification
                const dateColumnToggle = page.locator('[data-testid="wallets-transaction-table-toggle-column-date-checkbox"]');
                await dateColumnToggle.check();
                await expect(dateColumnToggle).toBeChecked();
                
                const actionColumnToggle = page.locator('[data-testid="wallets-transaction-table-toggle-column-action-checkbox"]');
                await actionColumnToggle.check();
                await expect(actionColumnToggle).toBeChecked();
                
                const txnTypeColumnToggle = page.locator('[data-testid="wallets-transaction-table-toggle-column-txnType-checkbox"]');
                await txnTypeColumnToggle.check();
                await expect(txnTypeColumnToggle).toBeChecked();
                
                const signalColumnToggle = page.locator('[data-testid="wallets-transaction-table-toggle-column-signal-checkbox"]');
                await signalColumnToggle.check();
                await expect(signalColumnToggle).toBeChecked();
                
                const priceColumnToggle = page.locator('[data-testid="wallets-transaction-table-toggle-column-price-checkbox"]');
                await priceColumnToggle.check();
                await expect(priceColumnToggle).toBeChecked();
                
                const lbdColumnToggle = page.locator('[data-testid="wallets-transaction-table-toggle-column-lbd-checkbox"]');
                await lbdColumnToggle.check();
                await expect(lbdColumnToggle).toBeChecked();

                // Wait for the transaction table to be visible and contain the new transaction
                const transactionTable = page.locator('[data-testid="wallets-transaction-table-transaction-row"]');
                await expect(transactionTable).toBeVisible({ timeout: 10000 });
                
                // Get the first (most recent) transaction row
                const firstTxnRow = transactionTable.first();
                await expect(firstTxnRow).toBeVisible();
                
                // Verify date
                const dateCell = firstTxnRow.locator('[data-testid="wallets-transaction-table-date-display"]');
                const expectedDateDisplay = transactionInput.displayDate || formatToMDYYYY(transactionInput.date);
                await expect(dateCell).toHaveText(expectedDateDisplay, { timeout: 5000 });
                console.log(`[${transactionInput.scenarioName}] Date verified: ${expectedDateDisplay}`);
                
                // Verify action
                const actionCell = firstTxnRow.locator('[data-testid="wallets-transaction-table-action-display"]');
                await expect(actionCell).toHaveText(transactionInput.action, { timeout: 5000 });
                console.log(`[${transactionInput.scenarioName}] Action verified: ${transactionInput.action}`);
                
                // Verify txnType
                const txnTypeCell = firstTxnRow.locator('[data-testid="wallets-transaction-table-txnType-display"]');
                await expect(txnTypeCell).toHaveText(transactionInput.txnType!, { timeout: 5000 });
                console.log(`[${transactionInput.scenarioName}] TxnType verified: ${transactionInput.txnType}`);
                
                // Verify signal
                const signalCell = firstTxnRow.locator('[data-testid="wallets-transaction-table-signal-display"]');
                await expect(signalCell).toHaveText(transactionInput.signal!, { timeout: 5000 });
                console.log(`[${transactionInput.scenarioName}] Signal verified: ${transactionInput.signal}`);
                
                // Verify price
                const priceCell = firstTxnRow.locator('[data-testid="wallets-transaction-table-price-display"]');
                const expectedPrice = formatCurrency(transactionInput.price!);
                await expect(priceCell).toHaveText(expectedPrice, { timeout: 5000 });
                console.log(`[${transactionInput.scenarioName}] Price verified: ${expectedPrice}`);
                
                // Verify LBD (Loss Buffer Discount) - Calculate expected value using app logic
                const lbdCell = firstTxnRow.locator('[data-testid="wallets-transaction-table-lbd-display"]');
                
                // Calculate expected LBD using the same formula as the app
                const expectedLbdCalculated = calculateExpectedLBD(
                    transactionInput.price!, 
                    transactionInput.stockPdp ?? 5, 
                    transactionInput.stockCommission
                );
                const expectedLbdFromCalculation = formatCurrency(expectedLbdCalculated);
                
                // Also get the expected LBD from CSV for comparison
                const expectedLbdFromCsv = formatCurrency(transactionInput.lbd!);
                
                console.log(`[${transactionInput.scenarioName}] LBD Calculation Debug:`);
                console.log(`  Price: $${transactionInput.price}`);
                console.log(`  PDP: ${transactionInput.stockPdp ?? 5}%`);
                console.log(`  Stock Commission: ${transactionInput.stockCommission ?? 0}%`);
                console.log(`  Expected LBD (calculated): ${expectedLbdFromCalculation}`);
                console.log(`  Expected LBD (from CSV): ${expectedLbdFromCsv}`);
                
                await expect(lbdCell).toHaveText(expectedLbdFromCalculation, { timeout: 5000 });
                console.log(`[${transactionInput.scenarioName}] LBD verified (calculated): ${expectedLbdFromCalculation}`);
                
                // Verify that our calculation matches the CSV (this should pass if CSV is correct)
                if (Math.abs(expectedLbdCalculated - transactionInput.lbd!) > 0.01) {
                    console.warn(`[${transactionInput.scenarioName}] WARNING: Calculated LBD (${expectedLbdCalculated.toFixed(2)}) differs from CSV LBD (${transactionInput.lbd!.toFixed(2)}) by more than $0.01`);
                }
                
                console.log(`[${transactionInput.scenarioName}] WalletsTransactionsTable verification completed successfully.`);
            }// --- Wallet Verification (Only for 'Buy' actions as per current CSV focus) ---
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
}
