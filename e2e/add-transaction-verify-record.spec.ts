// e2e/add-transaction-verify-record.spec.ts
import { test, expect } from '@playwright/test';
import { Amplify } from 'aws-amplify';
import amplifyOutputs from '../amplify_outputs.json'; // Adjust path if necessary

import {
    createPortfolioStock,
    deleteStockWalletsForStockByStockId,
    deletePortfolioStock,
    deleteTransactionsForStockByStockId, // Assuming a helper to delete txns
    type PortfolioStockCreateData,
} from './utils/dataHelpers'; // Adjust path if needed

// Import the generic loader and the specific interface for these scenarios
import { loadScenariosFromCSV, type AddTransactionInputScenario } from '@/e2e/utils/csvHelper';

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
    'quantity',
    'pdp',
    'plr',
    'swingHoldRatio',
    'lbd',
    'SwWtBuyPrice', // Added
    'SwWtTotalInvestment', // Added
    'SwWtRemainingShares', // Added
    'HlWtBuyPrice', // Added
    'HlWtTotalInvestment', // Added
    'HlWtRemainingShares', // Added
];

const transactionScenarios = loadScenariosFromCSV<AddTransactionInputScenario>(
    '../add-transaction-input-scenarios.csv', // Corrected path
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
                pdp: 5, // Example values, can also be from CSV if stock setup varies per scenario group
                plr: 2,
                budget: 600,
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
        // 1. Go to the app's base URL to establish an origin for storage operations
        await page.goto('/'); // Or your app's base URL e.g. http://localhost:3000
        console.log('BEFORE EACH: Navigated to app root. Attempting to clear storage...');

        // 2. Clear storage for the current origin
        try {
            await page.evaluate(() => {
                window.localStorage.clear();
                window.sessionStorage.clear();
                // For IndexedDB, you might need more specific logic if used directly
                // Example: const dbs = await window.indexedDB.databases();
                // dbs.forEach(db => window.indexedDB.deleteDatabase(db.name!));
            });
            console.log('BEFORE EACH: localStorage and sessionStorage cleared.');
        } catch (e) {
            console.error('BEFORE EACH: Error clearing storage:', e);
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

    // New test for the first "Buy" scenario from CSV
    const firstScenario = transactionScenarios[0];

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

            if (transactionInput.action.toUpperCase() === 'BUY') { // Ensure case consistency
                 const typeToSelect = transactionInput.txnType.toLowerCase(); // e.g., "split", "swing", "hold"
                 await page.locator(`[data-testid="txn-form-txnType-${typeToSelect}"]`).check();
            }

            await page.locator('[data-testid="txn-form-signal"]').selectOption(transactionInput.signal);
            await page.locator('[data-testid="txn-form-price"]').fill(String(transactionInput.price));
            await page.locator('[data-testid="txn-form-investment"]').fill(String(transactionInput.investment));

            console.log(`[add-transaction-verify-record.spec.ts] - TEST [${transactionInput.scenarioName}]: Submitting transaction form...`);
            await page.locator('[data-testid="txn-form-submit-button"]').click();

            console.log(`[add-transaction-verify-record.spec.ts] - TEST [${transactionInput.scenarioName}]: Verifying transaction in the list...`);
            const transactionRow = page.locator(
                `[data-testid="transaction-row"]:has-text("${transactionInput.signal}"):has-text("${transactionInput.displayDate}")`
            ).last();

            await expect(transactionRow).toBeVisible({ timeout: 15000 });

            // date
            await expect(transactionRow.locator('[data-testid="transaction-date-display"]'))
                .toHaveText(transactionInput.displayDate);
            
            // action
            await expect(transactionRow.locator('[data-testid="transaction-action-display"]'))
                .toHaveText(transactionInput.action);
            
            // txnType
            if (transactionInput.action.toUpperCase() === 'BUY') {
                await expect(transactionRow.locator('[data-testid="transaction-txnType-display"]'))
                    .toHaveText(transactionInput.txnType);
            }
            
            // signal
            await expect(transactionRow.locator('[data-testid="transaction-signal-display"]'))
                .toHaveText(transactionInput.signal);

            // price
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
            
            // quantity
            const expectedDisplayQuantity = Number(transactionInput.quantity).toFixed(SHARE_PRECISION);
            await expect(transactionRow.locator('[data-testid="transaction-quantity-display"]'))
                .toHaveText(expectedDisplayQuantity);

            // investment
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

            // lbd
            if (typeof transactionInput.pdp === 'number' && typeof transactionInput.lbd === 'number' && investmentValue) {
                const lbd_raw = transactionInput.lbd;            
                const lbdValue = parseFloat(lbd_raw.toFixed(CURRENCY_PRECISION));
                const expectedLbdString = lbdValue.toLocaleString(undefined, {
                    minimumFractionDigits: CURRENCY_PRECISION,
                    maximumFractionDigits: CURRENCY_PRECISION,
                });
                const lbdRegExp = new RegExp(`^\\$?${expectedLbdString.replace('.', '\\.')}$`);
                await expect(transactionRow.locator('[data-testid="transaction-lbd-display"]'))
                    .toHaveText(lbdRegExp);
                console.log(`[add-transaction-verify-record.spec.ts] - TEST [${transactionInput.scenarioName}]: LBD calculated as ${lbdValue} (${expectedLbdString})`);
            } else { 
                console.log(`[add-transaction-verify-record.spec.ts] - TEST [${transactionInput.scenarioName}]: Could not calculate LBD/TP (PDP/PLR invalid or price missing)`); 
            }           

            console.log(`[add-transaction-verify-record.spec.ts] - TEST [${transactionInput.scenarioName}]: Transaction verification successful!`);

            // Verifying wallets
            if (transactionInput === firstScenario) {
                console.log(`[add-transaction-verify-record.spec.ts] - TEST [${transactionInput.scenarioName}] - Verifying wallets (first scenario ONLY)...`);
                await page.waitForTimeout(2000); // Adjust as necessary, or wait for a specific element update

                // Use values from CSV for expected wallet details
                const expectedSwingBuyPrice = Number(transactionInput.SwWtBuyPrice).toFixed(CURRENCY_PRECISION);
                const expectedSwingInvestment = Number(transactionInput.SwWtTotalInvestment).toFixed(CURRENCY_PRECISION);
                const expectedSwingShares = Number(transactionInput.SwWtRemainingShares).toFixed(SHARE_PRECISION);

                const expectedHoldBuyPrice = Number(transactionInput.HlWtBuyPrice).toFixed(CURRENCY_PRECISION);
                const expectedHoldInvestment = Number(transactionInput.HlWtTotalInvestment).toFixed(CURRENCY_PRECISION);
                const expectedHoldShares = Number(transactionInput.HlWtRemainingShares).toFixed(SHARE_PRECISION);

                // Verify Swing Wallet
                console.log('Verifying Swing wallet...');
                await page.locator('[data-testid="wallet-swing-tab"]').click(); // Ensure Swing tab is active
                await expect(page.locator('[data-testid="wallet-swing-tab"]')).toContainText('Swing (1)', { timeout: 15000 });
                
                const swingWalletRow = page.locator('table tbody tr').first(); // Select the first row
                await expect(swingWalletRow.locator('[data-testid="wallet-buyPrice-display"]')).toHaveText(`$${expectedSwingBuyPrice}`);
                await expect(swingWalletRow.locator('[data-testid="wallet-totalInvestment-display"]')).toHaveText(`$${expectedSwingInvestment}`);
                await expect(swingWalletRow.locator('[data-testid="wallet-remainingShares-display"]')).toHaveText(expectedSwingShares);
                console.log('Swing wallet verified.');

                // Verify Hold Wallet
                console.log('Verifying Hold wallet...');
                await page.locator('[data-testid="wallet-hold-tab"]').click(); // Ensure Hold tab is active
                await expect(page.locator('[data-testid="wallet-hold-tab"]')).toContainText('Hold (1)', { timeout: 5000 });

                const holdWalletRow = page.locator('table tbody tr').first(); // Select the first row
                await expect(holdWalletRow.locator('[data-testid="wallet-buyPrice-display"]')).toHaveText(`$${expectedHoldBuyPrice}`);
                await expect(holdWalletRow.locator('[data-testid="wallet-totalInvestment-display"]')).toHaveText(`$${expectedHoldInvestment}`);
                await expect(holdWalletRow.locator('[data-testid="wallet-remainingShares-display"]')).toHaveText(expectedHoldShares);
                console.log('Hold wallet verified.');

                console.log(`[Test End] Wallet verification for scenario: ${firstScenario.scenarioName} complete.`);
            }
        });
    }

    

    
});