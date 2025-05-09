// e2e/realized-swing-pl.spec.ts

import { test, expect } from '@playwright/test';
import {
    createPortfolioStock,
    deletePortfolioStock,
    createTransaction,
    deleteTransactionsForStock,
    type PortfolioStockCreateData, // Import types if defined and exported
    type TransactionCreateData
} from './utils/dataHelpers'; // Adjust path if needed

test.describe('Wallet Page Calculations', () => {

    // --- Scenario Data ---
    const testStockSymbol = 'TEST'; // The symbol you manually set up data for
    let testPortfolioStockId: string | null = null;
    const expectedRealizedSwingPL = '$20.00'; // The expected result from your Excel for this scenario

    test.beforeAll(async () => {
        console.log(`BEFORE ALL: Setting up data for test stock: ${testStockSymbol}`);
        try {
            // Clean up potentially leftover stock first (optional, but good practice)
            // const existingStock = await getPortfolioStockBySymbol(testStockSymbol); // Assumes helper exists
            // if (existingStock) {
            //     await deleteTransactionsForStock(existingStock.id);
            //     await deletePortfolioStock(existingStock.id);
            // }

            const stockInput: PortfolioStockCreateData = {
                symbol: testStockSymbol, name: 'TEST', stockType: 'Stock', region: 'US',
                pdp: 10, plr: 1, budget: 5000, swingHoldRatio: 50,
            };
            const createdStock = await createPortfolioStock(stockInput);
            testPortfolioStockId = createdStock.id; // Store ID for cleanup
            if (!testPortfolioStockId) throw new Error("Failed to create stock or get its ID.");

            const buyTx: TransactionCreateData = {
                portfolioStockId: testPortfolioStockId, action: 'Buy', date: '2024-01-10',
                price: 100, quantity: 10, investment: 1000, swingShares: 5, holdShares: 5, txnType: 'Split'
            };
            await createTransaction(buyTx);

            const sellTx: TransactionCreateData = {
                portfolioStockId: testPortfolioStockId, action: 'Sell', date: '2024-01-15',
                price: 110, quantity: 2, txnType: 'Swing',
                investment: null, swingShares: null, holdShares: null
            };
            await createTransaction(sellTx);
            console.log('BEFORE ALL: Test data setup complete.');
        } catch (error) {
            console.error("BEFORE ALL - Data setup failed:", error);
            // If setup fails, we might want to skip tests or handle cleanup if possible
            if (testPortfolioStockId) {
                 await deleteTransactionsForStock(testPortfolioStockId);
                 await deletePortfolioStock(testPortfolioStockId);
            }
            throw new Error(`BEFORE ALL - Data setup failed: ${error}`);
        }
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

        // Navigate to the starting page for tests IF needed after login
        console.log('BEFORE EACH: Navigating to /stocks-listing...');
        await page.goto('/stocks-listing');
        await expect(page.locator('h2:has-text("Portfolio")')).toBeVisible({ timeout: 10000 });
        console.log('BEFORE EACH: Setup complete, on /stocks-listing page.');
    });
    
    
    // test.beforeEach(async ({ page }) => {
    //     await page.goto('/');
    //     console.log('Attempting login...');
    //     await page.locator('input[name="username"]').fill('marin.sarbulescu@gmail.com'); // Replace selector and email
    //     //await page.pause();
    //     await page.locator('input[name="password"]').fill('T5u#PW4&!9wm4SzG'); // Replace selector and password
    
    //     const cognitoResponsePromise = page.waitForResponse(
    //         response => response.url().includes('cognito-idp.') && response.ok(),
    //         { timeout: 15000 }
    //     );
    //     console.log('Clicking Sign In, waiting for Cognito network response...');
    //     await page.locator('button[type="submit"]:has-text("Sign In")').click(); // Replace
    
    //     try {
    //         const response = await cognitoResponsePromise;
    //         console.log(`Cognito response received: ${response.status()}`);
    //     } catch (error) {
    //         console.error("Login failed: Did not receive successful Cognito network response.", error);
    //         await page.screenshot({ path: 'login_network_error.png' });
    //         throw new Error("Login failed: Cognito response timed out or failed.");
    //     }

    //     // --- Data Setup ---
    //     console.log(`Setting up data for test stock: ${testStockSymbol}`);
    //     try {
    //         const stockInput: PortfolioStockCreateData = {
    //             symbol: testStockSymbol, name: 'E2E P/L Test Stock', stockType: 'Stock', region: 'US',
    //             pdp: 10, plr: 1, budget: 5000, swingHoldRatio: 50, // Example data
    //         };
    //         const createdStock = await createPortfolioStock(stockInput);
    //         testPortfolioStockId = createdStock.id;
    //         if (!testPortfolioStockId) { throw new Error("Failed to create stock or get its ID."); }

    //         // Create Buy Transaction (e.g., 10 shares @ $100)
    //         const buyTx: TransactionCreateData = {
    //             portfolioStockId: testPortfolioStockId, action: 'Buy', date: '2024-01-10', // Use a fixed date
    //             price: 100, quantity: 10, investment: 1000,
    //             swingShares: 5, holdShares: 5, txnType: 'Split' // Adjust based on schema/logic
    //         };
    //         await createTransaction(buyTx);

    //         // Create Swing Sell Transaction (e.g., 2 shares @ $110 for +$20 P/L)
    //         const sellTx: TransactionCreateData = {
    //             portfolioStockId: testPortfolioStockId, action: 'Sell', date: '2024-01-15', // Use a fixed date
    //             price: 110, quantity: 2,
    //             txnType: 'Swing', // MUST be Swing for this test
    //             // DO NOT include completedTxnId - let the app logic determine it
    //             investment: null, swingShares: null, holdShares: null // Null out unused fields
    //         };
    //         await createTransaction(sellTx);
    //         console.log('Test data setup complete.');

    //     } catch (error) {
    //         console.error("Data setup failed:", error);
    //         // Attempt cleanup even if setup fails
    //         if (testPortfolioStockId) {
    //             await deleteTransactionsForStock(testPortfolioStockId);
    //             await deletePortfolioStock(testPortfolioStockId);
    //         }
    //         throw new Error(`Data setup failed: ${error}`); // Fail fast
    //     }

    //     test.afterEach(async () => {
    //         if (testPortfolioStockId) {
    //             console.log(`Cleaning up data for test stock ID: ${testPortfolioStockId}`);
    //             try {
    //                 // Delete transactions first (if necessary based on relationships)
    //                 await deleteTransactionsForStock(testPortfolioStockId);
    //                 // Then delete the stock
    //                 await deletePortfolioStock(testPortfolioStockId);
    //             } catch (error) {
    //                 console.error("Error during test cleanup:", error);
    //                 // Decide if you want to throw error or just log during cleanup
    //             } finally {
    //                  testPortfolioStockId = null; // Ensure reset even if delete fails
    //             }
    //             console.log('Test data cleanup finished.');
    //         } else {
    //             console.log('No test stock ID found for cleanup.');
    //         }
    //     });
    
    //     console.log('Waiting for authorized homepage content to appear...');
    //     // ---> USE THE SELECTOR FOR YOUR AUTHORIZED HOMEPAGE STATE <---
    //     // Replace 'nav a:has-text("Portfolio")' with your actual selector
    //     await expect(page.locator('nav a:has-text("Portfolio")')).toBeVisible({ timeout: 15000 });
    //     console.log('Authorized homepage content confirmed.');
    //     // --- End Replacement ---
    
    //     // Now that we're authenticated AND authorized on the homepage, navigate to stocks listing
    //     console.log('Navigating to /stocks-listing...');
    //     await page.goto('/stocks-listing');
    
    //     console.log('Verifying landing on stocks listing page by finding heading...');
    //     await expect(page.locator('h2:has-text("Portfolio")')).toBeVisible({ timeout: 10000 });
    //     console.log('Successfully navigated to /stocks-listing and found heading.');
    // });


    // --- Test Case ---
    test('should display correct Realized Swing P/L in Overview', async ({ page }) => {

        // 1. Navigate from Portfolio to the specific Stock Wallet Page
        console.log(`Navigating to wallet page for ${testStockSymbol}...`);
        // Use a locator that reliably finds the link/row for your test stock
        // Example: Clicking a link with the text 'TEST' inside an anchor tag
        await page.locator(`a:has-text("${testStockSymbol}")`).click();

        // Wait for the wallet page header to ensure navigation is complete
        await expect(page.locator(`p:has-text("${testStockSymbol}")`)).toBeVisible({ timeout: 10000 });
        console.log('Wallet page loaded.');

        // 2. Expand the Overview section
        console.log('Expanding Overview...');
        // Find the clickable Overview header (adjust selector if needed)
        await page.locator('p:has-text("Overview")').first().click(); // Use first() if multiple elements match

        // 3. Find and assert the Realized Swing P/L value
        console.log(`Checking for Realized Swing P/L: ${expectedRealizedSwingPL}`);
        // Use the data-testid you added previously
        const swingPlElement = page.locator('[data-testid="overview-realized-swing-pl-dollars"]');

        // Wait for the element to be visible and assert its text content
        await expect(swingPlElement).toBeVisible({ timeout: 5000 }); // Wait for potential calculation delays
        await expect(swingPlElement).toHaveText(expectedRealizedSwingPL);

        console.log('Assertion passed!');
    });

});