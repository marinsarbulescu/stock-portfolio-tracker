// e2e/realized-swing-pl.spec.ts
import { Amplify } from 'aws-amplify';
import amplifyOutputs from '../amplify_outputs.json';

try {
    Amplify.configure(amplifyOutputs);
    console.log('Amplify configured successfully for E2E spec file.');
} catch (error) {
    console.error('CRITICAL: Error configuring Amplify in E2E spec file:', error);
    // Optional: throw error; // This would stop tests if config fails
}

import { test, expect, type Page } from '@playwright/test';
import {
    createPortfolioStock,
    deletePortfolioStock,
    createTransaction,
    deleteTransactionsForStock,
    type PortfolioStockCreateData, // Import types if defined and exported
    type TransactionCreateData
} from './utils/dataHelpers'; // Adjust path if needed
import { loadTestScenarios, type TestScenario } from './utils/csvHelper';

const scenarios = loadTestScenarios('../test-scenarios.csv');
const TEST_USER_COGNITO_ID = "e10b55e0-9031-70db-23f9-cdf5d997659c"; // marin.sarbulescu@gmail.com user is in local, used for testing

// Helper function to add a Buy transaction via UI
// This needs access to the 'page' object, so it cannot be in beforeAll directly if beforeAll doesn't have 'page'
// We'll call this from within the test.beforeAll's page-enabled scope (if Playwright allows that)
// Or, more practically, this logic might be part of beforeAll if we pass the global browser page
// For now, let's define it conceptually. We will integrate it into beforeAll.
async function addBuyTransactionViaUI(page: Page, scenario: TestScenario, stockId: string) {
    console.log(`[UI Setup] Navigating to wallet page for stock ID: ${stockId}`);
    await page.goto(`/wallets/${stockId}`); // Assuming this is the wallet page URL structure
    await expect(page.locator(`p:has-text("${scenario.testStockSymbol}")`).first()).toBeVisible({ timeout: 15000 });

    console.log('[UI Setup] Clicking "Add Buy Transaction" button');
    // Replace with your actual selector for the "Add Buy Transaction" button
    await page.getByRole('button', { name: /Add Buy Transaction/i }).click();

    // Wait for modal to appear (replace with actual modal title/selector)
    await expect(page.locator('h3:has-text("Add Buy Transaction")')).toBeVisible({ timeout: 5000 });
    console.log('[UI Setup] Add Buy Transaction modal appeared.');

    // Fill the form (TransactionForm) - adjust selectors as per your form
    console.log('[UI Setup] Filling Buy transaction form...');
    
    
    // --- date ---
    if (scenario.date) { // Check if buyDate is provided in CSV
        await page.locator('#date').fill(scenario.date);
        console.log(`[UI Setup] Filled Date: ${scenario.date}`);
    }

    // --- txnType ---
    if (scenario.txnType) {
        // Check if this field actually exists in your "Add Buy Transaction" modal's form
        const txnTypeSelector = page.locator('#buyType'); // Or other appropriate selector
        if (await txnTypeSelector.isVisible({timeout: 1000}).catch(() => false)) { // Check if element exists
            await txnTypeSelector.selectOption({ label: scenario.txnType }); // Or by value
            console.log(`[UI Setup] Selected txnType: ${scenario.txnType}`);
        } else {
            console.log(`[UI Setup] buyType field not found in form, assuming form handles it or defaults to 'Split'.`);
            // If this field is mandatory in your form but not found by selector, the test might fail later.
        }
    } else {
        console.log('[UI Setup] No specific Buy TxnType in scenario, using form default (likely "Split").');
    }

    // --- signal ---
    if (scenario.signal) { // Check if a signal is provided in the scenario
        await page.locator('#signal').selectOption({ label: scenario.signal });
        // If your <option> tags use 'value' attributes instead of labels for matching:
        // await page.locator('#signal').selectOption({ value: scenario.buySignalValue }); // (You'd need a buySignalValue in CSV)
        console.log(`[UI Setup] Selected Signal: ${scenario.signal}`);
    } else {
        // Optional: If the form has a default signal and your scenario doesn't specify one,
        // you might not need to do anything, or you might explicitly select a default.
        // For now, we'll assume if scenario.buySignal is blank/null, no selection is made,
        // and the form's default will be used.
        console.log('[UI Setup] No specific Buy Signal in scenario, using form default if any.');
    }

    // --- price ---
    if (scenario.price !== null && scenario.price !== undefined) {
        await page.locator('#price').fill(scenario.price.toString());
        console.log(`[UI Setup] Filled Price: ${scenario.price}`);
    }

    // --- Quantity ---
    // Assuming input has id="quantity"
    // if (scenario.buyQuantity !== null && scenario.buyQuantity !== undefined) {
    //     await page.locator('#quantity').fill(scenario.buyQuantity.toString());
    //     console.log(`[UI Setup] Filled Quantity: ${scenario.buyQuantity}`);
    // }

    // --- Investment ---
    if (scenario.investment !== null && scenario.investment !== undefined) {
        await page.locator('#investment').fill(scenario.investment.toString());
        console.log(`[UI Setup] Filled Investment: ${scenario.investment}`);
    }

    // --- Swing Shares & Hold Shares (if manually entered in TransactionForm) ---
    // if (scenario.buySwingShares !== null && scenario.buySwingShares !== undefined) {
    //     // Assuming input has id="swingShares"
    //     await page.locator('#swingShares').fill(scenario.buySwingShares.toString());
    //     console.log(`[UI Setup] Filled Swing Shares: ${scenario.buySwingShares}`);
    // }
    // if (scenario.buyHoldShares !== null && scenario.buyHoldShares !== undefined) {
    //     // Assuming input has id="holdShares"
    //     // The value from CSV might be string or number based on your csvHelper cast
    //     const holdSharesValue = typeof scenario.buyHoldShares === 'number'
    //         ? scenario.buyHoldShares.toString()
    //         : scenario.buyHoldShares; // If it's already a string
    //     if (holdSharesValue) {
    //       await page.locator('#holdShares').fill(holdSharesValue);
    //       console.log(`[UI Setup] Filled Hold Shares: ${holdSharesValue}`);
    //     }
    // }

    // --- Signal (Optional Dropdown) ---
    // Assuming select has id="signal"
    // if (scenario.buySignal) { // Assuming your TestScenario interface has 'buySignal'
    //     await page.locator('#signal').selectOption({ label: scenario.buySignal }); // Or use { value: scenario.buySignalValue }
    //     console.log(`[UI Setup] Selected Signal: ${scenario.buySignal}`);
    // }

    // Click save/submit button in the modal
    // Replace with your actual selector for the modal's save button
    console.log('[UI Setup] Submitting Buy transaction form...');
    // It's good to wait for a network response that indicates the transaction was created
    const createTxnResponsePromise = page.waitForResponse(
        response => response.url().includes('/graphql') && // Assuming AppSync call
                     response.request().postData()?.includes('createTransaction') &&
                     response.ok(),
        { timeout: 10000 }
    );
    await page.getByRole('button', { name: /Add Transaction/i }).click(); // Or "Save", "Submit" etc.
    await createTxnResponsePromise;
    console.log('[UI Setup] Buy transaction submitted via UI.');

    // Optionally, wait for the modal to close
    await expect(page.locator('h3:has-text("Add Buy Transaction")')).toBeHidden({ timeout: 5000 });
}

// --- Create a test suite for each scenario ---
for (const scenario of scenarios) {
    // Only run scenarios intended for this test (e.g., those involving Swing P/L)
    // You might want a column in your CSV like "testSuite" or filter by scenarioName pattern
    if (scenario.scenarioName.toLowerCase().includes('swing')) { // Example filter
        test.describe(`Wallet Page Calculations - ${scenario.scenarioName}`, () => {
            let testPortfolioStockId: string | null = null;
            let loggedInUserId: string | undefined; // To store the user ID

            test.beforeAll(async () => {
                console.log(`BEFORE ALL [${scenario.scenarioName}]: Setting up data for ${scenario.testStockSymbol}`);
                try {
                    const stockInput: PortfolioStockCreateData = {
                        symbol: scenario.testStockSymbol,
                        name: `${scenario.testStockSymbol} Test Stock`,
                        stockType: 'Stock', // Or make this data-driven from CSV
                        region: 'US',       // Or make this data-driven
                        pdp: scenario.stockPdp,
                        plr: scenario.stockPlr,
                        budget: 10000, // Or from CSV
                        swingHoldRatio: scenario.stockShr,
                        owner: TEST_USER_COGNITO_ID,
                    };
                    const createdStock = await createPortfolioStock(stockInput);
                    testPortfolioStockId = createdStock.id;
                    if (!testPortfolioStockId) throw new Error("Failed to create stock or get its ID.");

                    // Create Buy Transaction from scenario
                    const buyTx: TransactionCreateData = {
                        portfolioStockId: testPortfolioStockId,  
                        date: scenario.date,
                        action: 'Buy',
                        txnType: scenario.txnType || 'Split',
                        price: scenario.price, 
                        //quantity: scenario.buyQuantity, 
                        investment: scenario.investment,
                        //swingShares: scenario.buySwingShares, 
                        //holdShares: parseFloat(scenario.buyHoldShares as any), // CSV might parse as string
                        owner: TEST_USER_COGNITO_ID,
                    };
                    await createTransaction(buyTx);

                    // Create Sell Transaction from scenario (if applicable)
                    if (scenario.sellPrice !== null && scenario.sellQuantity !== null) { // Check if sell data exists
                        const sellTx: TransactionCreateData = {
                            portfolioStockId: testPortfolioStockId, action: 'Sell', date: scenario.sellDate,
                            price: scenario.sellPrice, quantity: scenario.sellQuantity,
                            txnType: scenario.sellTxnType as 'Swing' | 'Hold', // Cast to expected type
                            investment: null, swingShares: null, holdShares: null, owner: TEST_USER_COGNITO_ID,
                        };
                        await createTransaction(sellTx);
                    }
                    console.log(`BEFORE ALL [${scenario.scenarioName}]: Test data setup complete.`);
                } catch (error) { /* ... error handling and cleanup ... */ throw error; }
            });

            
            // --- Runs ONCE after all tests in this file ---
            test.afterAll(async () => {
                if (testPortfolioStockId) {
                    console.log(`AFTER ALL: Cleaning up data for test stock ID: ${testPortfolioStockId}`);
                    try {
                        await deleteTransactionsForStock(testPortfolioStockId);
                        await deletePortfolioStock(testPortfolioStockId);
                    } catch (error) { console.error("AFTER ALL - Error during test cleanup:", error); }
                    finally { testPortfolioStockId = null; }
                    console.log('AFTER ALL: Test data cleanup finished.');
                } else { console.log('AFTER ALL: No test stock ID found for cleanup.'); }
            });

    
            // --- Runs BEFORE EACH test case ---
            test.beforeEach(async ({ page }) => {
                // Login and navigate to a consistent starting point (e.g., the stocks list)
                await page.goto('/');
                console.log('BEFORE EACH: Attempting login...');
                await page.locator('input[name="username"]').fill('marin.sarbulescu@gmail.com'); // USE YOUR CREDENTIALS
                await page.locator('input[type="password"]').fill('T5u#PW4&!9wm4SzG');        // USE YOUR CREDENTIALS
                const cognitoResponsePromise = page.waitForResponse(r => r.url().includes('cognito-idp.') && r.ok(), { timeout: 15000 });
                await page.locator('button[type="submit"]:has-text("Sign In")').click(); // USE YOUR BUTTON TEXT/SELECTOR
                try {
                    await cognitoResponsePromise;
                    // Wait for authorized homepage state (replace selector)
                    await expect(page.locator('nav a:has-text("Portfolio")')).toBeVisible({ timeout: 15000 });
                    console.log('BEFORE EACH: Login successful, authorized homepage element found.');
                } catch (error) {
                    console.error("BEFORE EACH: Login or subsequent wait failed:", error);
                    await page.screenshot({ path: 'e2e_login_error_beforeEach.png' });
                    throw new Error("Login failed during beforeEach setup.");
                }             

                // Navigate to the starting page for tests IF needed after login                console.log('BEFORE EACH: Navigating to /portfolio...');
                await page.goto('/portfolio');
                await expect(page.locator('h2:has-text("Portfolio")')).toBeVisible({ timeout: 10000 });
                console.log('BEFORE EACH: Setup complete, on /portfolio page.');
            });
    

            // --- Test Case ---
            test(`should display correct Realized Swing P/L in Overview`, async ({ page }) => {                // Arrange (Data is set up by beforeAll, user is logged in by beforeEach, already on /portfolio)

                // Act
                console.log(`TEST [${scenario.scenarioName}]: Currently on /portfolio page.`);
                // ---> ADD A WAIT for the specific stock link to be visible <---
                console.log(`TEST [${scenario.scenarioName}]: Waiting for stock link "${scenario.testStockSymbol}" to appear...`);
                
                const stockLinkLocator = page.getByRole('link', { name: new RegExp(scenario.testStockSymbol, 'i') });

                await expect(stockLinkLocator).toBeVisible({ timeout: 15000 }); // Wait up to 15 seconds for the link
                console.log(`TEST [${scenario.scenarioName}]: Stock link "${scenario.testStockSymbol}" found.`);
                // ---> END WAIT <---

                console.log(`TEST [${scenario.scenarioName}]: Navigating to wallet page for ${scenario.testStockSymbol}...`);
                await stockLinkLocator.click(); // Now click the found link

                // Wait for a clear indicator of the wallet page being loaded
                await expect(page.locator(`p:has-text("${scenario.testStockSymbol}")`).first()).toBeVisible({ timeout: 15000 });
                console.log(`TEST [${scenario.scenarioName}]: Wallet page loaded.`);

                console.log(`TEST [${scenario.scenarioName}]: Expanding Overview...`);
                await page.locator('p:has-text("Overview")').first().click();

                // Assert
                console.log(`TEST [${scenario.scenarioName}]: Checking for Realized Swing P/L: ${scenario.expectedFormattedSwingPL}`);
                await page.pause();
                const swingPlElement = page.locator('[data-testid="overview-realized-swing-pl-dollars"]');
                await page.pause();
                await expect(swingPlElement).toBeVisible({ timeout: 10000 });
                await expect(swingPlElement).toHaveText(scenario.expectedFormattedSwingPL);

                console.log(`TEST [${scenario.scenarioName}]: Assertion passed!`);
            });
        });
    }
}