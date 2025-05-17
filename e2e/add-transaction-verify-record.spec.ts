// e2e/add-transaction-verify-record.spec.ts
import { test, expect } from '@playwright/test';
import { Amplify } from 'aws-amplify';
import amplifyOutputs from '../amplify_outputs.json'; // Adjust path if necessary

import {
    createPortfolioStock,
    deletePortfolioStock,
    deleteTransactionsForStock, // Assuming a helper to delete txns
    type PortfolioStockCreateData,
} from './utils/dataHelpers'; // Adjust path if needed

// Import the generic loader and the specific interface for these scenarios
import { loadScenariosFromCSV, type AddTransactionInputScenario } from './utils/csvHelper';

import {
    SHARE_PRECISION,
    CURRENCY_PRECISION,
    // PERCENT_PRECISION,
    // SHARE_EPSILON,
    // CURRENCY_EPSILON,
    // FETCH_LIMIT_FOR_UNIQUE_WALLET
} from '@/app/config/constants';

// Configure Amplify (should run once per test worker)
try {
    Amplify.configure(amplifyOutputs);
    console.log('[add-transaction-verify-record.spec.ts] - Amplify configured successfully for E2E test spec.');
} catch (error) {
    console.error('[add-transaction-verify-record.spec.ts] - CRITICAL: Error configuring Amplify in E2E spec file:', error);
}

const TEST_USER_COGNITO_SUB = "e10b55e0-9031-70db-23f9-cdf5d997659c"; // marin.sarbulescu@gmail.com user is in local, used for testing
const E2E_TEST_USER_OWNER_ID = `${TEST_USER_COGNITO_SUB}::${TEST_USER_COGNITO_SUB}`;

const E2E_TEST_USERNAME = 'marin.sarbulescu@gmail.com';
const E2E_TEST_PASSWORD = 'T5u#PW4&!9wm4SzG';

// --- Load Transaction Scenarios from CSV ---
// Define which columns in your AddTransactionInputScenario CSV are numeric
const addTxnNumericColumns: ReadonlyArray<keyof AddTransactionInputScenario> = [
    'price',
    'investment',
    'quantity'
];

const transactionScenarios = loadScenariosFromCSV<AddTransactionInputScenario>(
    '../add-transaction-input-scenarios.csv', // Adjust this path as needed
    addTxnNumericColumns
);

// --- Test Suite ---
// A single stock will be created for all transaction scenarios in this file.
const testStockSymbolForTransactions = 'E2ETXCSV'; // You can make this dynamic or use one from CSV if needed
let sharedTestPortfolioStockId: string | null = null;

test.describe(`Wallet Page - Add Transactions from CSV for Stock: ${testStockSymbolForTransactions}`, () => {
    test.beforeAll(async () => {
        // REMINDER: Ensure TEST_USER_COGNITO_SUB is not the placeholder value.
        // if (TEST_USER_COGNITO_SUB === 'your-actual-e2e-user-cognito-sub' || TEST_USER_COGNITO_SUB === '') {
        //     console.error("CRITICAL: TEST_USER_COGNITO_SUB placeholder needs to be updated in the E2E spec file.");
        //     throw new Error("TEST_USER_COGNITO_SUB is not set. Halting tests.");
        // }

        console.log(`[add-transaction-verify-record.spec.ts] - BEFORE ALL (Outer Describe): Setting up PortfolioStock: ${testStockSymbolForTransactions} for owner: ${E2E_TEST_USER_OWNER_ID}`);
        try {
            const stockInput: PortfolioStockCreateData = {
                symbol: testStockSymbolForTransactions,
                name: `${testStockSymbolForTransactions} Global Ventures`,
                owner: E2E_TEST_USER_OWNER_ID,
                stockType: 'Stock',
                region: 'US',
                pdp: 10, // Example values, can also be from CSV if stock setup varies per scenario group
                plr: 2,
                budget: 10000,
                swingHoldRatio: 50,
            };
            const createdStock = await createPortfolioStock(stockInput);
            sharedTestPortfolioStockId = createdStock.id;
            if (!sharedTestPortfolioStockId) {
                throw new Error('Failed to create PortfolioStock or get its ID.');
            }
            console.log(`[add-transaction-verify-record.spec.ts] - BEFORE ALL (Outer Describe): PortfolioStock ${testStockSymbolForTransactions} (ID: ${sharedTestPortfolioStockId}) created.`);
        } catch (error) {
            console.error('[add-transaction-verify-record.spec.ts] - BEFORE ALL (Outer Describe) - PortfolioStock setup failed:', error);
            throw error; // Fail fast if the shared stock can't be created
        }
    });


    test.afterAll(async () => {
        if (sharedTestPortfolioStockId) {
            console.log(`[add-transaction-verify-record.spec.ts] - AFTER ALL (Outer Describe): Cleaning up data for PortfolioStock ID: ${sharedTestPortfolioStockId}`);
            try {
                // This will delete all transactions associated with this stock, created by any test in the loop
                await deleteTransactionsForStock(sharedTestPortfolioStockId);
                await deletePortfolioStock(sharedTestPortfolioStockId);
                console.log(`[add-transaction-verify-record.spec.ts] - AFTER ALL (Outer Describe): Cleanup finished for ${sharedTestPortfolioStockId}.`);
            } catch (error) {
                console.error(`[add-transaction-verify-record.spec.ts] - AFTER ALL (Outer Describe) - Error during cleanup for ${sharedTestPortfolioStockId}:`, error);
            } finally {
                sharedTestPortfolioStockId = null;
            }
        } else {
            console.log('[add-transaction-verify-record.spec.ts] - AFTER ALL (Outer Describe): No sharedTestPortfolioStockId found for cleanup.');
        }
    });


    // This beforeEach runs before each `test` case generated by the loop below
    test.beforeEach(async ({ page }) => {
        // 1. Go to the app's base URL to establish an origin for storage operations
        await page.goto('/'); // Or your app's base URL e.g. http://localhost:3000
        console.log('BEFORE EACH: Navigated to app root. Attempting to clear storage...');

        // 2. Clear storage for the current origin
        try {
            await page.evaluate(() => {
                localStorage.clear();
                sessionStorage.clear();
                console.log('localStorage and sessionStorage cleared via page.evaluate.');
            });
        } catch (e) {
            console.warn("BEFORE EACH: Could not clear localStorage/sessionStorage on current page, proceeding. Error:", e);
            // This might happen if the page immediately redirects or has other restrictions.
            // Cookies are more critical for Cognito sessions usually.
        }

        // 3. Clear cookies for the entire browser context
        await page.context().clearCookies();
        console.log('BEFORE EACH: Cookies cleared.');

        // 4. Navigate to '/' again. After clearing storage/cookies, the app should
        //    now definitely present the login form or redirect to it.
        await page.goto('/');

        console.log(`BEFORE EACH: Re-navigated to '/'. Attempting login as ${E2E_TEST_USERNAME}...`);
        console.log(`[add-transaction-verify-record.spec.ts] - BEFORE EACH: Attempting login as ${E2E_TEST_USERNAME}...`);
        await page.locator('input[name="username"]').fill(E2E_TEST_USERNAME);
        await page.locator('input[name="password"]').fill(E2E_TEST_PASSWORD);
        const cognitoResponsePromise = page.waitForResponse(
            response => response.url().includes('cognito-idp.') && response.status() === 200,
            { timeout: 15000 }
        );
        await page.locator('button[type="submit"]:has-text("Sign In")').click(); // Adjust main Sign In button selector if needed
        try {
            await cognitoResponsePromise;
            await expect(page.locator('nav a:has-text("Portfolio")')).toBeVisible({ timeout: 15000 }); // Adjust auth confirmation selector
            console.log('[add-transaction-verify-record.spec.ts] - BEFORE EACH: Login successful.');
        } catch (error) {
            console.error("[add-transaction-verify-record.spec.ts] - BEFORE EACH: Login or post-login wait failed:", error);
            await page.screenshot({ path: `e2e_login_error_csv_driven_${Date.now()}.png` });
            throw new Error("Login failed during beforeEach setup.");
        }

        if (!sharedTestPortfolioStockId) {
            throw new Error("sharedTestPortfolioStockId is not set; cannot navigate to wallet page.");
        }
        // Navigate to the specific stock's wallet page for each test
        const walletPageUrl = `/wallets/${sharedTestPortfolioStockId}`;
        console.log(`[add-transaction-verify-record.spec.ts] - BEFORE EACH: Navigating to wallet page: ${walletPageUrl} for stock ${testStockSymbolForTransactions}`);
        await page.goto(walletPageUrl);
        const titleElement = page.locator('[data-testid="wallet-page-title"]'); // Assuming you added this data-testid
        await expect(titleElement).toBeVisible({ timeout: 15000 });
        await expect(titleElement).toContainText(testStockSymbolForTransactions.toUpperCase(), { timeout: 5000 });
        console.log(`[add-transaction-verify-record.spec.ts] - BEFORE EACH: Successfully on wallet page for ${testStockSymbolForTransactions}.`);
    });

    // --- Loop through each scenario from the CSV and create a test case ---
    for (const transactionInput of transactionScenarios) {
        test(`Scenario: ${transactionInput.scenarioName} - Add ${transactionInput.action} (${transactionInput.signal})`, async ({ page }) => {
            // --- Ensure necessary columns are visible ---
            console.log(`[add-transaction-verify-record.spec.ts] - TEST [${transactionInput.scenarioName}]: Ensuring 'Date' column is visible...`);
            const dateColumnToggle = page.locator('[data-testid="toggle-txn-col-date"]');
            // Check if the toggle is not already checked before clicking
            // .check() is idempotent: it only checks if not already checked.
            await dateColumnToggle.check(); 
            // Add an assertion to confirm it's checked if needed, or wait for column header to be visible
            await expect(dateColumnToggle).toBeChecked();
            console.log(`[add-transaction-verify-record.spec.ts] - TEST [${transactionInput.scenarioName}]: 'date' column toggle should now be checked.`);

            console.log(`[add-transaction-verify-record.spec.ts] - TEST [${transactionInput.scenarioName}]: Ensuring 'action' column is visible...`);
            const actionColumnToggle = page.locator('[data-testid="toggle-txn-col-action"]');
            await actionColumnToggle.check(); 
            await expect(actionColumnToggle).toBeChecked();
            console.log(`[add-transaction-verify-record.spec.ts] - TEST [${transactionInput.scenarioName}]: 'action' column toggle should now be checked.`);

            console.log(`[add-transaction-verify-record.spec.ts] - TEST [${transactionInput.scenarioName}]: Ensuring 'txnType' column is visible...`);
            const txnTypeColumnToggle = page.locator('[data-testid="toggle-txn-col-txnType"]');
            await txnTypeColumnToggle.check(); 
            await expect(txnTypeColumnToggle).toBeChecked();
            console.log(`[add-transaction-verify-record.spec.ts] - TEST [${transactionInput.scenarioName}]: 'txnType' column toggle should now be checked.`);

            console.log(`[add-transaction-verify-record.spec.ts] - TEST [${transactionInput.scenarioName}]: Ensuring 'signal' column is visible...`);
            const signalColumnToggle = page.locator('[data-testid="toggle-txn-col-signal"]');
            await signalColumnToggle.check(); 
            await expect(signalColumnToggle).toBeChecked();
            console.log(`[add-transaction-verify-record.spec.ts] - TEST [${transactionInput.scenarioName}]: 'signal' column toggle should now be checked.`);

            console.log(`[add-transaction-verify-record.spec.ts] - TEST [${transactionInput.scenarioName}]: Ensuring 'price' column is visible...`);
            const priceColumnToggle = page.locator('[data-testid="toggle-txn-col-price"]');
            await priceColumnToggle.check(); 
            await expect(priceColumnToggle).toBeChecked();
            console.log(`[add-transaction-verify-record.spec.ts] - TEST [${transactionInput.scenarioName}]: 'price' column toggle should now be checked.`);

            console.log(`[add-transaction-verify-record.spec.ts] - TEST [${transactionInput.scenarioName}]: Ensuring 'lbd' column is visible...`);
            const lbdColumnToggle = page.locator('[data-testid="toggle-txn-col-lbd"]');
            await lbdColumnToggle.check(); 
            await expect(lbdColumnToggle).toBeChecked();
            console.log(`[add-transaction-verify-record.spec.ts] - TEST [${transactionInput.scenarioName}]: 'lbd' column toggle should now be checked.`);

            console.log(`[add-transaction-verify-record.spec.ts] - TEST [${transactionInput.scenarioName}]: Ensuring 'investment' column is visible...`);
            const investmentColumnToggle = page.locator('[data-testid="toggle-txn-col-investment"]');
            await investmentColumnToggle.check(); 
            await expect(investmentColumnToggle).toBeChecked();
            console.log(`[add-transaction-verify-record.spec.ts] - TEST [${transactionInput.scenarioName}]: 'investment' column toggle should now be checked.`);

            console.log(`[add-transaction-verify-record.spec.ts] - TEST [${transactionInput.scenarioName}]: Ensuring 'quantity' column is visible...`);
            const quantityColumnToggle = page.locator('[data-testid="toggle-txn-col-quantity"]');
            await quantityColumnToggle.check(); 
            await expect(quantityColumnToggle).toBeChecked();
            console.log(`[add-transaction-verify-record.spec.ts] - TEST [${transactionInput.scenarioName}]: 'quantity' column toggle should now be checked.`);

            console.log(`[add-transaction-verify-record.spec.ts] - TEST [${transactionInput.scenarioName}]: Ensuring 'proceeds' column is visible...`);
            const proceedsColumnToggle = page.locator('[data-testid="toggle-txn-col-proceeds"]');
            await proceedsColumnToggle.check(); 
            await expect(proceedsColumnToggle).toBeChecked();
            console.log(`[add-transaction-verify-record.spec.ts] - TEST [${transactionInput.scenarioName}]: 'proceeds' column toggle should now be checked.`);

            console.log(`[add-transaction-verify-record.spec.ts] - TEST [${transactionInput.scenarioName}]: Ensuring 'txnProfit' column is visible...`);
            const txnProfitColumnToggle = page.locator('[data-testid="toggle-txn-col-txnProfit"]');
            await txnProfitColumnToggle.check(); 
            await expect(txnProfitColumnToggle).toBeChecked();
            console.log(`[add-transaction-verify-record.spec.ts] - TEST [${transactionInput.scenarioName}]: 'txnProfit' column toggle should now be checked.`);

            console.log(`[add-transaction-verify-record.spec.ts] - TEST [${transactionInput.scenarioName}]: Ensuring 'txnProfitPercent' column is visible...`);
            const txnProfitPercentColumnToggle = page.locator('[data-testid="toggle-txn-col-txnProfitPercent"]');
            await txnProfitPercentColumnToggle.check(); 
            await expect(txnProfitPercentColumnToggle).toBeChecked();
            console.log(`[add-transaction-verify-record.spec.ts] - TEST [${transactionInput.scenarioName}]: 'txnProfitPercent' column toggle should now be checked.`);

            console.log(`[add-transaction-verify-record.spec.ts] - TEST [${transactionInput.scenarioName}]: Ensuring 'completedTxnId' column is visible...`);
            const completedTxnIdColumnToggle = page.locator('[data-testid="toggle-txn-col-completedTxnId"]');
            await completedTxnIdColumnToggle.check(); 
            await expect(completedTxnIdColumnToggle).toBeChecked();
            console.log(`[add-transaction-verify-record.spec.ts] - TEST [${transactionInput.scenarioName}]: 'completedTxnId' column toggle should now be checked.`);

            
            console.log(`[add-transaction-verify-record.spec.ts] - TEST [${transactionInput.scenarioName}]: Clicking "Add Transaction" button...`);
            await page.locator('[data-testid="wallet-page-add-transaction-button"]').click();

            console.log(`[add-transaction-verify-record.spec.ts] - TEST [${transactionInput.scenarioName}]: Filling transaction form with data:`, transactionInput);
            await page.locator('[data-testid="txn-form-date"]').fill(transactionInput.date);

            // Action field is static ('Buy') in the modal if forceAction='Buy' is used by the component opening the modal.
            // If your modal is generic and action can be selected:
            // await page.locator('[data-testid="txn-form-action"]').selectOption({ label: transactionInput.action });

            // For Buy Type radio buttons
            if (transactionInput.action.toUpperCase() === 'BUY') { // Ensure case consistency
                 const typeToSelect = transactionInput.txnType.toLowerCase(); // e.g., "split", "swing", "hold"
                 await page.locator(`[data-testid="txn-form-txnType-${typeToSelect}"]`).check();
            }

            // Assuming 'signal' is a dropdown
            await page.locator('[data-testid="txn-form-signal"]').selectOption(transactionInput.signal);
            await page.locator('[data-testid="txn-form-price"]').fill(String(transactionInput.price));
            await page.locator('[data-testid="txn-form-investment"]').fill(String(transactionInput.investment));
            
            // Quantity might be auto-calculated from price & investment by your form.
            // If it's a separate input field that your test should fill:
            // await page.locator('[data-testid="txn-form-quantity"]').fill(String(transactionInput.quantity));

            console.log(`[add-transaction-verify-record.spec.ts] - TEST [${transactionInput.scenarioName}]: Submitting transaction form...`);
            await page.locator('[data-testid="txn-form-submit-button"]').click();

            // Wait for the transaction to appear in the list.
            // The locator for the row might need to be more specific if signals/dates aren't unique enough quickly.
            console.log(`[add-transaction-verify-record.spec.ts] - TEST [${transactionInput.scenarioName}]: Verifying transaction in the list...`);
            const transactionRow = page.locator(
                `[data-testid="transaction-row"]:has-text("${transactionInput.signal}"):has-text("${transactionInput.displayDate}")`
            ).last(); // Or .first() if new transactions appear at the top

            await expect(transactionRow).toBeVisible({ timeout: 15000 });

            // Assertions for each relevant field in the transaction row
            await expect(transactionRow.locator('[data-testid="transaction-date-display"]'))
                .toHaveText(transactionInput.displayDate);
            
            await expect(transactionRow.locator('[data-testid="transaction-action-display"]'))
                .toHaveText(transactionInput.action);

            if (transactionInput.action.toUpperCase() === 'BUY') {
                await expect(transactionRow.locator('[data-testid="transaction-txnType-display"]'))
                    .toHaveText(transactionInput.txnType);
            }
            
            await expect(transactionRow.locator('[data-testid="transaction-signal-display"]'))
                .toHaveText(transactionInput.signal);

            // For 'transaction-price-display'
            const priceValue = Number(transactionInput.price);
            const expectedPriceString = priceValue.toLocaleString(undefined, {
                minimumFractionDigits: CURRENCY_PRECISION, // Assuming CURRENCY_PRECISION is 2
                maximumFractionDigits: CURRENCY_PRECISION,
            });
            // Escape special regex characters like '.' and also ensure commas are handled.
            // A simple way for numbers with toLocaleString is to build the regex to expect the locale-formatted number.
            const priceRegExp = new RegExp(`^\\$?${expectedPriceString.replace('.', '\\.')}$`);
            await expect(transactionRow.locator('[data-testid="transaction-price-display"]'))
                .toHaveText(priceRegExp);
            
            const expectedDisplayQuantity = Number(transactionInput.quantity).toFixed(SHARE_PRECISION);
            await expect(transactionRow.locator('[data-testid="transaction-quantity-display"]'))
                .toHaveText(expectedDisplayQuantity);

            // For 'transaction-investment-display' (this is the one that failed)
            const investmentValue = Number(transactionInput.investment);
            const expectedInvestmentString = investmentValue.toLocaleString(undefined, {
                minimumFractionDigits: CURRENCY_PRECISION, // Assuming CURRENCY_PRECISION is 2
                maximumFractionDigits: CURRENCY_PRECISION,
            }); // For 1000, this will give "1,000.00" in many locales
            const investmentRegExp = new RegExp(`^\\$?${expectedInvestmentString.replace('.', '\\.')}$`);
            // The ^ and $ ensure the entire string matches.
            // The \? makes the dollar sign optional.
            await expect(transactionRow.locator('[data-testid="transaction-investment-display"]'))
                .toHaveText(investmentRegExp); // Use the new RegExp

            console.log(`[add-transaction-verify-record.spec.ts] - TEST [${transactionInput.scenarioName}]: Transaction verification successful!`);
        });
    }



    // const testStockSymbol = 'E2ETXN';
    // let testPortfolioStockId: string | null = null;

    // const transactionInput = {
    //     date: '2025-05-15', // Use YYYY-MM-DD for <input type="date">
    //     displayDate: '05/15/2025', // Or however your app displays it
    //     action: 'Buy',
    //     txnType: 'Split',
    //     signal: 'Initial',
    //     price: 10,
    //     investment: 200,
    //     quantity: 20, // 200 / 10
    // };

    // test.beforeAll(async () => {
    //     console.log(`BEFORE ALL: Setting up PortfolioStock: ${testStockSymbol}`);
    //     try {
    //         const stockInput: PortfolioStockCreateData = {
    //             symbol: testStockSymbol,
    //             name: `${testStockSymbol} Industries`,
    //             owner: E2E_TEST_USER_OWNER_ID,
    //             stockType: 'Stock',
    //             region: 'US',
    //             pdp: 10, // Example
    //             plr: 2, // Example
    //             budget: 5000,
    //             swingHoldRatio: 50,
    //         };
    //         const createdStock = await createPortfolioStock(stockInput);
    //         testPortfolioStockId = createdStock.id;
    //         if (!testPortfolioStockId) {
    //             throw new Error('Failed to create PortfolioStock or get its ID.');
    //         }
    //         console.log(`BEFORE ALL: PortfolioStock ${testStockSymbol} (ID: ${testPortfolioStockId}) created.`);
    //     } catch (error) {
    //         console.error('BEFORE ALL - Data setup failed:', error);
    //         throw error; // Fail fast
    //     }
    // });

    // test.afterAll(async () => {
    //     if (testPortfolioStockId) {
    //         console.log(`AFTER ALL: Cleaning up data for test stock ID: ${testPortfolioStockId}`);
    //         try {
    //             await deleteTransactionsForStock(testPortfolioStockId);
    //             await deletePortfolioStock(testPortfolioStockId);
    //         } catch (error) {
    //             console.error("AFTER ALL - Error during test cleanup:", error); 
    //         }
    //         finally { 
    //             testPortfolioStockId = null; 
    //         }
            
    //         console.log('AFTER ALL: Test data cleanup finished.');
    //     } else { console.log('AFTER ALL: No test stock ID found for cleanup.'); }
    // });

    // // --- Runs BEFORE EACH test case ---
    // test.beforeEach(async ({ page }) => {
    //     // Login and navigate to a consistent starting point (e.g., the stocks list)
    //     await page.goto('/');
    //     console.log('BEFORE EACH: Attempting login...');
    //     await page.locator('input[name="username"]').fill(E2E_TEST_USERNAME); // USE YOUR CREDENTIALS
    //     await page.locator('input[type="password"]').fill(E2E_TEST_PASSWORD);        // USE YOUR CREDENTIALS
    //     const cognitoResponsePromise = page.waitForResponse(r => r.url().includes('cognito-idp.') && r.ok(), { timeout: 15000 });
    //     await page.locator('button[type="submit"]:has-text("Sign In")').click(); // USE YOUR BUTTON TEXT/SELECTOR
    //     try {
    //         await cognitoResponsePromise;
    //         // Wait for authorized homepage state (replace selector)
    //         await expect(page.locator('nav a:has-text("Portfolio")')).toBeVisible({ timeout: 15000 });
    //         console.log('BEFORE EACH: Login successful, authorized homepage element found.');
    //     } catch (error) {
    //         console.error("BEFORE EACH: Login or subsequent wait failed:", error);
    //         await page.screenshot({ path: 'e2e_login_error_beforeEach.png' });
    //         throw new Error("Login failed during beforeEach setup.");
    //     }             
    
    //     // Navigate to the starting page for tests IF needed after login
    //     console.log('BEFORE EACH: Navigating to /stocks-listing...');
    //     await page.goto('/stocks-listing');
    //     await expect(page.locator('h2:has-text("Portfolio")')).toBeVisible({ timeout: 10000 });
    //     console.log('BEFORE EACH: Setup complete, on /stocks-listing page.');
    //     // Navigate to the specific stock's wallet page
        
    //     if (!testPortfolioStockId) {
    //         throw new Error("testPortfolioStockId is not set; cannot navigate to wallet page.");
    //     }
    //     const walletPageUrl = `/wallets/${testPortfolioStockId}`;
    //     console.log(`BEFORE EACH: Navigating to wallet page: ${walletPageUrl}`);
    //     await page.goto(walletPageUrl);
        
    //     const titleElement = page.locator('[data-testid="wallet-page-title"]');
    //     await expect(titleElement).toBeVisible({ timeout: 15000 }); // Adjust selector
    //     await expect(titleElement).toContainText(`${testStockSymbol.toUpperCase()}`, { timeout: 5000 })
    //     console.log(`BEFORE EACH: Successfully on wallet page for ${testStockSymbol}.`);
    // });

    // test('Add a Split Buy transaction and verify its record in the list', async ({ page }) => {
    //     // --- Act: Add the transaction ---
    //     console.log('TEST: Clicking "Add Transaction" button...');
    //     // Replace with your actual selector for the "Add Transaction" button on the wallet page
    //     await page.locator('[data-testid="wallet-page-add-transaction-button"]').click();

    //     console.log('TEST: Filling transaction form...');
    //     // Replace data-testid attributes with your actual ones
    //     await page.locator('[data-testid="txn-form-date"]').fill(transactionInput.date);
    //     //await page.locator('[data-testid="txn-form-action"]').selectOption({ label: transactionInput.action });
    //     const typeToSelect = transactionInput.txnType.toLowerCase(); // e.g., "split", "swing", "hold"
    //     await page.locator(`[data-testid="txn-form-txnType-${typeToSelect}"]`).check();
    //     await page.locator('[data-testid="txn-form-signal"]').selectOption(transactionInput.signal);
    //     await page.locator('[data-testid="txn-form-price"]').fill(String(transactionInput.price));
    //     await page.locator('[data-testid="txn-form-investment"]').fill(String(transactionInput.investment));
    //     // Quantity might auto-calculate or be an input. If it's an input:
    //     // await page.locator('[data-testid="txn-form-quantity"]').fill(String(transactionInput.quantity));

    //     console.log('TEST: Submitting transaction form...');
    //     await page.locator('[data-testid="txn-form-submit-button"]').click();

    //     // Wait for submission to process - e.g., modal closes, or a success message, or transaction list updates.
    //     // Example: wait for modal to disappear if it's a modal form
    //     // await expect(page.locator('[data-testid="transaction-form-modal"]')).not.toBeVisible({ timeout: 10000 });
    //     // Or, more robustly, wait for the transaction to appear in the list (see below)

    //     // --- Assert: Verify the transaction in the list ---
    //     console.log('TEST: Verifying transaction in the list...');

    //     // Locate the transaction row. This needs robust selectors.
    //     // We'll assume each transaction row can be uniquely identified or we find the newest one.
    //     // This example tries to find a row that contains several matching pieces of data.
    //     // A more robust way is to have a data-testid for the row itself once it's created,
    //     // or iterate through rows and find the one with matching date, price, and investment.

    //     // For simplicity, let's assume the list displays new transactions clearly
    //     // and you can target elements within a specific transaction item/row.
    //     // You might need to adjust selectors based on your transaction list's HTML structure.

    //     // Example: Target the most recent transaction or a transaction that matches key details
    //     // This locator strategy will need to be adapted to your specific UI.
    //     // It's often better to look for a container of transactions and then find the specific one.
    //     const transactionRow = page.locator('[data-testid="transaction-row"]:has-text("Initial")').last();
    //      // This selector looks for a row with data-testid starting with "transaction-row-"
    //      // that contains the text "Initial" (our signal) and takes the last one (newest).
    //      // This is an example; your actual structure will dictate the best selector.

    //     await expect(transactionRow).toBeVisible({ timeout: 15000 }); // Wait for the row to appear

    //     // Verify details within that row. Ensure these data-testid attributes exist within each transaction row.
    //     // await expect(transactionRow.locator('[data-testid="transaction-date-display"]'))
    //     //     .toHaveText(transactionInput.displayDate);
    //     await expect(transactionRow.locator('[data-testid="transaction-action-display"]'))
    //         .toHaveText(transactionInput.action); // "Buy"
    //     await expect(transactionRow.locator('[data-testid="transaction-txnType-display"]'))
    //         .toHaveText(transactionInput.txnType); // "Split"
    //     await expect(transactionRow.locator('[data-testid="transaction-signal-display"]'))
    //         .toHaveText(transactionInput.signal); // "Initial"

    //     // For numeric values, ensure consistent formatting (e.g., with or without $, .00)
    //     // Using a RegExp for flexibility with currency symbols or minor formatting differences is often good.
    //     await expect(transactionRow.locator('[data-testid="transaction-price-display"]'))
    //         .toHaveText(new RegExp(`\\$?${transactionInput.price}(\\.00)?`)); // e.g., "$10.00" or "10"
        
    //     const expectedDisplayQuantity = Number(transactionInput.quantity).toFixed(SHARE_PRECISION);
    //     await expect(transactionRow.locator('[data-testid="transaction-quantity-display"]'))
    //         .toHaveText(expectedDisplayQuantity); // "20"
    //     await expect(transactionRow.locator('[data-testid="transaction-investment-display"]'))
    //         .toHaveText(new RegExp(`\\$?${transactionInput.investment}(\\.00)?`)); // e.g., "$200.00" or "200"

    //     console.log('TEST: Transaction verification successful!');
    // });
});