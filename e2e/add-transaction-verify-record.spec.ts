// e2e/add-transaction-verify-record.spec.ts

// This Playwright test suite is designed to verify the creation of stock transactions and the subsequent state of stock wallets (Swing and Hold)
// based on various input scenarios defined in a CSV file (`add-transaction-input-scenarios.csv`).
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
//     For each row (scenario) in `add-transaction-input-scenarios.csv`:
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

import { Amplify } from 'aws-amplify';
import { test, expect } from '@playwright/test';
import amplifyOutputs from '../amplify_outputs.json'; // Adjust path if necessary

import {
    createPortfolioStock,
    deleteStockWalletsForStockByStockId,
    deletePortfolioStock,
    deleteTransactionsForStockByStockId,
    type PortfolioStockCreateData,
} from './utils/dataHelpers'; // Adjust path if needed
import { E2E_TEST_USER_OWNER_ID, E2E_TEST_USERNAME, E2E_TEST_PASSWORD } from './utils/testCredentials'; // Added import
import { clearBrowserState, loginUser, navigateToStockWalletPage } from './utils/pageHelpers'; // Added import

// Import the generic loader and the specific interface for these scenarios
import { loadScenariosFromCSV, type AddTransactionInputScenario } from './utils/csvHelper';

import {
    SHARE_PRECISION,
    CURRENCY_PRECISION,
} from '../app/config/constants'; // Adjusted path assuming @/ is app/
import { formatCurrency, formatShares } from '../app/utils/financialCalculations';

// Configure Amplify (should run once per test worker)
try {
    Amplify.configure(amplifyOutputs);
    console.log('[add-transaction-verify-record.spec.ts] - Amplify configured successfully for E2E test spec.');
} catch (error) {
    console.error('[add-transaction-verify-record.spec.ts] - CRITICAL: Error configuring Amplify in E2E spec file:', error);
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
    '../add-transaction-input-scenarios.csv', // Corrected path to be relative to csvHelper.ts
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
        // Assuming all scenarios in the CSV are for the SAME stock, defined by the first scenario.
        // If different stocks are needed per scenario, this beforeAll needs to be inside the loop or managed differently.
        if (transactionScenarios.length === 0) {
            throw new Error("No transaction scenarios loaded from CSV.");
        }
        const firstScenario = transactionScenarios[0];
        currentStockSymbol = firstScenario.stockSymbol;

        console.log(`[add-transaction-verify-record.spec.ts] - BEFORE ALL (Outer Describe): Setting up PortfolioStock: ${currentStockSymbol} for owner: ${E2E_TEST_USER_OWNER_ID}`);
        try {
            const stockInput: PortfolioStockCreateData = {
                symbol: firstScenario.stockSymbol,
                name: firstScenario.stockName,
                owner: E2E_TEST_USER_OWNER_ID,
                stockType: (firstScenario.stockStockType as PortfolioStockCreateData['stockType']) || 'Stock',
                region: (firstScenario.stockRegion as PortfolioStockCreateData['region']) || 'US',
                pdp: firstScenario.stockPdp ?? 5, // Use CSV or default
                plr: firstScenario.stockPlr ?? 2,
                budget: firstScenario.stockBudget ?? 600,
                swingHoldRatio: firstScenario.stockSwingHoldRatio ?? 50,
            };
            const createdStock = await createPortfolioStock(stockInput);
            sharedTestPortfolioStockId = createdStock.id;
            if (!sharedTestPortfolioStockId) {
                throw new Error('Failed to create PortfolioStock or get its ID.');
            }
            console.log(`[add-transaction-verify-record.spec.ts] - BEFORE ALL (Outer Describe): PortfolioStock ${currentStockSymbol} (ID: ${sharedTestPortfolioStockId}) created.`);
        } catch (error) {
            console.error(`[add-transaction-verify-record.spec.ts] - BEFORE ALL (Outer Describe) - PortfolioStock setup for ${currentStockSymbol} failed:`, error);
            throw error; // Fail fast if the shared stock can't be created
        }
    });

    test.afterAll(async () => {
        if (sharedTestPortfolioStockId) {
            console.log(`[add-transaction-verify-record.spec.ts] - AFTER ALL (Outer Describe): Cleaning up data for PortfolioStock ID: ${sharedTestPortfolioStockId} (${currentStockSymbol})`);
            try {
                // Order of deletion is important:
                // 1. Transactions (which might reference StockWallets via completedTxnId, though direct DB link is to PortfolioStock)
                // 2. StockWallets (which are direct children of PortfolioStock)
                // 3. PortfolioStock (the parent record)

                await deleteTransactionsForStockByStockId(sharedTestPortfolioStockId);
                await deleteStockWalletsForStockByStockId(sharedTestPortfolioStockId); // <<< CALL THE NEW HELPER HERE
                await deletePortfolioStock(sharedTestPortfolioStockId);

                console.log(`AFTER ALL (Outer Describe): Full cleanup finished for ${sharedTestPortfolioStockId}.`);
            } catch (error) {
                console.error(`AFTER ALL (Outer Describe) - Error during test cleanup for ${sharedTestPortfolioStockId}:`, error);
                // Consider re-throwing or failing the test suite if cleanup is critical
            } finally {
                sharedTestPortfolioStockId = null;
            }
        } else {
            console.log('[add-transaction-verify-record.spec.ts] - AFTER ALL (Outer Describe): No sharedTestPortfolioStockId found for cleanup.');
        }
    });


    // This beforeEach runs before each `test` case generated by the loop below
    test.beforeEach(async ({ page }) => {
        // 1. Go to the app\'s base URL to establish an origin for storage operations
        await clearBrowserState(page); // Use helper
        console.log(`[add-transaction-verify-record.spec.ts] - BEFORE EACH: Browser state cleared.`);

        // 4. Navigate to \'/\' again. After clearing storage/cookies, the app should
        //    now definitely present the login form or redirect to it.
        // await page.goto(\'/\'); // Already handled by clearBrowserState

        console.log(`[add-transaction-verify-record.spec.ts] - BEFORE EACH: Attempting login as ${E2E_TEST_USERNAME}...`);
        await loginUser(page); // Use helper
        console.log(`[add-transaction-verify-record.spec.ts] - BEFORE EACH: Login successful.`);

        if (!sharedTestPortfolioStockId) {
            throw new Error("sharedTestPortfolioStockId is not set; cannot navigate to wallet page.");
        }
        // Navigate to the specific stock\'s wallet page for each test
        // Use currentStockSymbol for logging
        if (!currentStockSymbol) throw new Error("currentStockSymbol is not set in beforeEach");
        await navigateToStockWalletPage(page, sharedTestPortfolioStockId, currentStockSymbol); // Use helper
        console.log(`[add-transaction-verify-record.spec.ts] - BEFORE EACH: Successfully on wallet page for ${currentStockSymbol}.`);
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
            }

            // Pre-test cleanup for isolation
            if (sharedTestPortfolioStockId) {
                console.log(`[${transactionInput.scenarioName}] Cleaning wallets and transactions for stock ID ${sharedTestPortfolioStockId}`);
                await deleteStockWalletsForStockByStockId(sharedTestPortfolioStockId);
                await deleteTransactionsForStockByStockId(sharedTestPortfolioStockId); // Ensure this helper exists and works
                
                // Reload page to reflect cleanup and ensure fresh state for wallet view
                await page.reload();
                // Wait for page to be ready after reload
                const titleElement = page.locator('[data-testid="wallet-page-title"]');
                await expect(titleElement).toBeVisible({ timeout: 15000 });
                if (!currentStockSymbol) throw new Error("currentStockSymbol is not set in test body");
                await expect(titleElement).toContainText(currentStockSymbol.toUpperCase(), { timeout: 5000 });
                console.log(`[${transactionInput.scenarioName}] Page reloaded and verified after cleanup.`);
            }

            // --- Ensure necessary transaction list columns are visible (optional, if needed for visual debugging) ---
            // console.log(`[add-transaction-verify-record.spec.ts] - TEST [${transactionInput.scenarioName}]: Ensuring 'Date' column is visible...`);
            // const dateColumnToggle = page.locator('[data-testid="toggle-txn-col-date"]');
            // await dateColumnToggle.check(); 
            // await expect(dateColumnToggle).toBeChecked();
            // console.log(`[add-transaction-verify-record.spec.ts] - TEST [${transactionInput.scenarioName}]: 'date' column toggle should now be checked.`);
            // (Add for other txn list columns if necessary)

            // --- Form Filling and Submission (Only for 'Buy' actions as per current CSV focus) ---
            if (transactionInput.action === 'Buy') {
                console.log(`[${transactionInput.scenarioName}] Opening Add Transaction modal.`);
                await page.locator('[data-testid="add-buy-transaction-button"]').click(); // Assumed test ID

                const transactionModal = page.locator('[data-testid="add-buy-transaction-form-modal"]'); // Assumed test ID
                await expect(transactionModal).toBeVisible({ timeout: 5000 });
                console.log(`[${transactionInput.scenarioName}] Add Transaction modal is visible.`);

                console.log(`[${transactionInput.scenarioName}] Filling form: Date=${transactionInput.date}, Action=${transactionInput.action}, Type=${transactionInput.txnType}, Signal=${transactionInput.signal}, Price=${transactionInput.price}, Qty=${transactionInput.quantity}`);
                
                await transactionModal.locator('[data-testid="txn-form-date"]').fill(transactionInput.date);
                
                // Action is implicitly 'Buy' due to clicking "add-buy-transaction-button"

                // Select Buy Type (txnType)
                if (transactionInput.txnType === 'Swing') {
                    await page.click('[data-testid="txn-form-txnType-swing"]');
                } else if (transactionInput.txnType === 'Hold') {
                    await page.click('[data-testid="txn-form-txnType-hold"]');
                } else if (transactionInput.txnType === 'Split') {
                    await page.click('[data-testid="txn-form-txnType-split"]');
                }

                if (transactionInput.signal) {
                    await page.selectOption('[data-testid="txn-form-signal"]', transactionInput.signal);
                }
                await page.fill('[data-testid="txn-form-price"]', String(transactionInput.price));
                await page.fill('[data-testid="txn-form-investment"]', String(transactionInput.investment));
                // LBD is calculated, not entered by user in this form.
                // await page.fill('[data-testid="txn-lbd-input"]', String(transactionInput.lbd));


                // Submit the form
                await transactionModal.locator('[data-testid="txn-form-submit-button"]').click();

                await expect(transactionModal).not.toBeVisible({ timeout: 10000 });
                console.log(`[${transactionInput.scenarioName}] Transaction form submitted and modal closed.`);
                
                // Wait for UI to update after submission. Consider waiting for a specific element that indicates data refresh.
                await page.waitForTimeout(3000); // Increased wait time, ideally replace with a more deterministic wait
            }

            // --- Wallet Verification (Only for 'Buy' actions as per current CSV focus) ---
            if (transactionInput.action === 'Buy') {
                console.log(`[${transactionInput.scenarioName}] Starting wallet verification.`);

                // Verify Swing Wallet
                console.log(`[${transactionInput.scenarioName}] Verifying Swing Wallet.`);
                await page.locator('[data-testid="wallet-tab-Swing"]').click();
                await page.waitForTimeout(500); // Allow tab content to load

                const expectSwingWallet = (transactionInput.txnType === 'Split' || transactionInput.txnType === 'Swing') && transactionInput.SwWtBuyPrice !== undefined && transactionInput.SwWtBuyPrice > 0;

                if (expectSwingWallet) {
                    console.log(`[${transactionInput.scenarioName}] Expecting Swing Wallet to be present.`);
                    await expect(page.locator('[data-testid="wallet-notfound-display"]')).not.toBeVisible({ timeout: 5000 });
                    const swingWalletRow = page.locator('[data-testid="wallets-table"] tbody tr').first(); // Updated selector
                    
                    await expect(swingWalletRow.locator('[data-testid="wallet-buyPrice-display"]'))
                        .toHaveText(`$${formatShares(transactionInput.SwWtBuyPrice!, CURRENCY_PRECISION)}`, { timeout: 5000 });
                    await expect(swingWalletRow.locator('[data-testid="wallet-totalInvestment-display"]'))
                        .toHaveText(`$${formatShares(transactionInput.SwWtTotalInvestment!, CURRENCY_PRECISION)}`);
                    await expect(swingWalletRow.locator('[data-testid="wallet-remainingShares-display"]'))
                        .toHaveText(formatShares(transactionInput.SwWtRemainingShares!, SHARE_PRECISION));
                    console.log(`[${transactionInput.scenarioName}] Swing Wallet verified successfully.`);
                } else {
                    console.log(`[${transactionInput.scenarioName}] Expecting NO Swing Wallet or 'Not Found' message.`);
                    await expect(page.locator('[data-testid="wallet-notfound-display"]')).toBeVisible({ timeout: 5000 });
                    await expect(page.locator('[data-testid="wallet-notfound-display"]')).toContainText('No Swing wallets found');
                    console.log(`[${transactionInput.scenarioName}] 'No Swing wallets found' message verified.`);
                }

                // Verify Hold Wallet
                console.log(`[${transactionInput.scenarioName}] Verifying Hold Wallet.`);
                await page.locator('[data-testid="wallet-tab-Hold"]').click();
                await page.waitForTimeout(500); // Allow tab content to load

                const expectHoldWallet = (transactionInput.txnType === 'Split' || transactionInput.txnType === 'Hold') && transactionInput.HlWtBuyPrice !== undefined && transactionInput.HlWtBuyPrice > 0;

                if (expectHoldWallet) {
                    console.log(`[${transactionInput.scenarioName}] Expecting Hold Wallet to be present.`);
                    await expect(page.locator('[data-testid="wallet-notfound-display"]')).not.toBeVisible({ timeout: 5000 });
                    const holdWalletRow = page.locator('[data-testid="wallets-table"] tbody tr').first(); // Updated selector
                    
                    await expect(holdWalletRow.locator('[data-testid="wallet-buyPrice-display"]'))
                        .toHaveText(`$${formatShares(transactionInput.HlWtBuyPrice!, CURRENCY_PRECISION)}`, { timeout: 5000 });
                    await expect(holdWalletRow.locator('[data-testid="wallet-totalInvestment-display"]'))
                        .toHaveText(`$${formatShares(transactionInput.HlWtTotalInvestment!, CURRENCY_PRECISION)}`);
                    await expect(holdWalletRow.locator('[data-testid="wallet-remainingShares-display"]'))
                        .toHaveText(formatShares(transactionInput.HlWtRemainingShares!, SHARE_PRECISION));
                    console.log(`[${transactionInput.scenarioName}] Hold Wallet verified successfully.`);
                } else {
                    console.log(`[${transactionInput.scenarioName}] Expecting NO Hold Wallet or 'Not Found' message.`);
                    await expect(page.locator('[data-testid="wallet-notfound-display"]')).toBeVisible({ timeout: 5000 });
                    await expect(page.locator('[data-testid="wallet-notfound-display"]')).toContainText('No Hold wallets found');
                    console.log(`[${transactionInput.scenarioName}] 'No Hold wallets found' message verified.`);
                }
            }
            console.log(`[${transactionInput.scenarioName}] Test completed.`);
        });
    }
});