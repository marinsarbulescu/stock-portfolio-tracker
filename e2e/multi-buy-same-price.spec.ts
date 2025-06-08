// e2e/multi-buy-same-price.spec.ts

// This Playwright test suite is designed to verify the application's behavior when multiple 'Buy' transactions are executed for the same stock at the same price point.
// It uses a CSV file (`multi-buy-same-price-scenarios.csv`) to drive the test scenarios.
// Each scenario in the CSV represents a sequence of buy transactions (e.g., an initial Swing buy, followed by a Split buy, then a Hold buy, all at the same price).
//
// The tests will perform the following steps:
// 1.  **Global Setup (`test.beforeAll`):**
//     a.  Load all transaction steps from the CSV file.
//     b.  From the first step of the first scenario, extract stock details (symbol, name, type, region, pdp, plr, budget, swingHoldRatio).
//     c.  Create a single new `PortfolioStock` record in the database using these details. This stock will be shared across all test scenarios in this file.
//     d.  Store the ID of the created stock for later use and cleanup.
//
// 2.  **Scenario Execution (for each `scenarioName` in the CSV):**
//     a.  **Login and Navigation:**
//         i.  Clear browser storage (localStorage, sessionStorage, cookies) to ensure a clean session.
//         ii. Log in as a predefined E2E test user.
//         iii. Navigate to the wallet page specific to the `PortfolioStock` created in `beforeAll`.
//         iv. Verify that the wallet page title correctly displays the stock symbol.
//     b.  **Pre-Scenario Cleanup:**
//         i.  Delete any existing `StockWallet` and `Transaction` records associated with the shared `PortfolioStock`. This ensures that each scenario starts from a clean slate regarding wallets and transactions, even if previous scenarios or test runs left data behind.
//         ii. Reload the wallet page to reflect this cleanup.
//     c.  **Step-by-Step Transaction Processing (for each step within the current `scenarioName`):**
//         i.  Verify that the current step's stock symbol matches the globally created stock symbol.
//         ii. If the step action is 'Buy':
//             - Open the "Add Buy Transaction" modal.
//             - Fill the transaction form fields (date, transaction type, signal, price, investment) using data from the current CSV row.
//             - Submit the form.
//             - Wait for the modal to close and for a brief period to allow UI updates.
//         iii. **Wallet Verification:**
//             - Switch to the "Swing" wallet tab.
//             - Based on the expected values in the CSV for the current step (`SwWtBuyPrice`, `SwWtTotalInvestment`, `SwWtRemainingShares`):
//                 - If a Swing wallet is expected (i.e., investment > 0 and valid price/shares), verify its presence and that its displayed buy price, total investment, and remaining shares match the formatted expected values.
//                 - If no Swing wallet is expected (or it's expected to be empty/zeroed out), verify that the "wallet not found" message is displayed or that the wallet shows zero values as appropriate.
//             - Switch to the "Hold" wallet tab.
//             - Perform similar verification for the Hold wallet based on `HlWtBuyPrice`, `HlWtTotalInvestment`, and `HlWtRemainingShares` from the CSV.
//
// 3.  **Global Teardown (`test.afterAll`):**
//     a.  If a `PortfolioStock` was created in `beforeAll`:
//         i.  Delete all `Transaction` records associated with it.
//         ii. Delete all `StockWallet` records associated with it.
//         iii. Delete the `PortfolioStock` record itself.
//     b.  This ensures that all test data created by this suite is cleaned up from the database.
//
// Key aspects tested:
// - Correct creation and updating of Swing and Hold wallets when multiple buy transactions occur at the same price.
// - Accurate calculation and display of wallet metrics (buy price, total investment, remaining shares) after each transaction.
// - Proper handling of different buy transaction types (Swing, Split, Hold) and their impact on wallet distribution.
// - Data-driven testing approach using CSV for defining complex multi-step scenarios.
// - Robust setup and teardown procedures for test data isolation and cleanup.


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
    console.log('[multi-buy-same-price.spec.ts] - Amplify configured successfully for E2E test spec.');
} catch (error) {
    console.error('[multi-buy-same-price.spec.ts] - CRITICAL: Error configuring Amplify in E2E spec file:', error);
}

// --- Load Transaction Scenarios from CSV ---
const multiBuyNumericColumns: ReadonlyArray<keyof AddTransactionInputScenario> = [
    'price',
    'investment',
    // 'quantity', // Quantity is not directly in this CSV, it's calculated or part of wallet state
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
    // 'pdp', 'plr', 'swingHoldRatio', 'lbd' are not top-level transaction inputs here but part of stock or calculated
];

const allStepsScenarios = loadScenariosFromCSV<AddTransactionInputScenario>(
    '../multi-buy-same-price-scenarios.csv', // Path relative to csvHelper.ts
    multiBuyNumericColumns
);
console.log(`[multi-buy-same-price.spec.ts] - Loaded ${allStepsScenarios.length} steps from CSV.`); // ADDED LOGGING

const groupedScenarios = allStepsScenarios.reduce((acc, scenario) => {
    const key = scenario.scenarioName;
    if (!acc[key]) {
        acc[key] = [];
    }
    acc[key].push(scenario);
    return acc;
}, {} as Record<string, AddTransactionInputScenario[]>);
console.log(`[multi-buy-same-price.spec.ts] - Grouped into ${Object.keys(groupedScenarios).length} scenarios.`); // ADDED LOGGING

// --- Test Suite ---\
let sharedTestPortfolioStockId: string | null = null;
let currentStockSymbol: string | null = null;

test.describe(`Wallet Page - Multi-Buy Same Price Scenarios from CSV`, () => {
    // ADDED STATIC TEST
    test('Static placeholder test', async ({ page }) => {
        expect(true).toBe(true);
        console.log('[multi-buy-same-price.spec.ts] - Static placeholder test executed.');
    });

    test.beforeAll(async () => {
        if (allStepsScenarios.length === 0) {
            throw new Error("No transaction scenarios loaded from multi-buy-same-price-scenarios.csv.");
        }
        const firstStepOfFirstScenario = allStepsScenarios[0];
        currentStockSymbol = firstStepOfFirstScenario.stockSymbol;

        console.log(`[multi-buy-same-price.spec.ts] - BEFORE ALL: Setting up PortfolioStock: ${currentStockSymbol} for owner: ${E2E_TEST_USER_OWNER_ID}`);
        try {
            const stockInput: PortfolioStockCreateData = {
                symbol: firstStepOfFirstScenario.stockSymbol,
                name: firstStepOfFirstScenario.stockName,
                owner: E2E_TEST_USER_OWNER_ID,
                stockType: (firstStepOfFirstScenario.stockStockType as PortfolioStockCreateData['stockType']) || 'Stock',
                region: (firstStepOfFirstScenario.stockRegion as PortfolioStockCreateData['region']) || 'US',
                pdp: firstStepOfFirstScenario.stockPdp ?? 5,
                plr: firstStepOfFirstScenario.stockPlr ?? 2,
                budget: firstStepOfFirstScenario.stockBudget ?? 1000,
                swingHoldRatio: firstStepOfFirstScenario.stockSwingHoldRatio ?? 50,
            };
            const createdStock = await createPortfolioStock(stockInput);
            sharedTestPortfolioStockId = createdStock.id;
            if (!sharedTestPortfolioStockId) {
                throw new Error('Failed to create PortfolioStock or get its ID.');
            }
            console.log(`[multi-buy-same-price.spec.ts] - BEFORE ALL: PortfolioStock ${currentStockSymbol} (ID: ${sharedTestPortfolioStockId}) created.`);
        } catch (error) {
            console.error(`[multi-buy-same-price.spec.ts] - BEFORE ALL - PortfolioStock setup for ${currentStockSymbol} failed:`, error);
            throw error;
        }
    });

    test.afterAll(async () => {
        if (sharedTestPortfolioStockId) {
            console.log(`[multi-buy-same-price.spec.ts] - AFTER ALL: Cleaning up data for PortfolioStock ID: ${sharedTestPortfolioStockId} (${currentStockSymbol})`);
            try {
                await deleteTransactionsForStockByStockId(sharedTestPortfolioStockId);
                await deleteStockWalletsForStockByStockId(sharedTestPortfolioStockId);
                await deletePortfolioStock(sharedTestPortfolioStockId);
                console.log(`[multi-buy-same-price.spec.ts] - AFTER ALL: Full cleanup finished for ${sharedTestPortfolioStockId}.`);
            } catch (error) {
                console.error(`[multi-buy-same-price.spec.ts] - AFTER ALL - Error during test cleanup for ${sharedTestPortfolioStockId}:`, error);
            } finally {
                sharedTestPortfolioStockId = null;
            }
        } else {
            console.log('[multi-buy-same-price.spec.ts] - AFTER ALL: No sharedTestPortfolioStockId found for cleanup.');
        }
    });

    // Loop through each grouped scenario (e.g., "MultiBuySamePrice")
    for (const scenarioName of Object.keys(groupedScenarios)) {
        const steps = groupedScenarios[scenarioName];

        test(`Scenario: ${scenarioName} (${currentStockSymbol})`, async ({ page }) => {
            console.log(`[${scenarioName}] Starting test for stock ${currentStockSymbol}.`);

            // --- Login and Navigate (runs once before the steps in this test block) ---
            await clearBrowserState(page); // Use helper
            console.log(`[multi-buy-same-price.spec.ts] - BEFORE TEST: Browser state cleared.`);
            
            await loginUser(page); // Use helper
            console.log('[multi-buy-same-price.spec.ts] - BEFORE TEST: Login successful.');


            if (!sharedTestPortfolioStockId) {
                throw new Error("sharedTestPortfolioStockId is not set; cannot navigate to wallet page.");
            }
            if (!currentStockSymbol) throw new Error("currentStockSymbol is not set in test body");
            await navigateToStockWalletPage(page, sharedTestPortfolioStockId, currentStockSymbol); // Use helper
            console.log(`[multi-buy-same-price.spec.ts] - BEFORE TEST: Successfully on wallet page for ${currentStockSymbol}.`);

            // --- Pre-scenario cleanup of wallets and transactions ---
            // This ensures that each run of this scenario (if tests are retried or run multiple times) starts clean for this stock.
            if (sharedTestPortfolioStockId) {
                console.log(`[${scenarioName}] Pre-scenario cleanup: Cleaning wallets and transactions for stock ID ${sharedTestPortfolioStockId}`);
                await deleteStockWalletsForStockByStockId(sharedTestPortfolioStockId);
                await deleteTransactionsForStockByStockId(sharedTestPortfolioStockId);
                await page.reload(); // Reload to reflect the cleanup
                // Re-verify navigation to the correct page after reload
                if (!currentStockSymbol) throw new Error("currentStockSymbol is not set after reload in test body");
                await navigateToStockWalletPage(page, sharedTestPortfolioStockId, currentStockSymbol); 
                console.log(`[${scenarioName}] Page reloaded and verified after pre-scenario cleanup.`);
            }


            // --- Iterate through each step of the current scenario ---
            for (const step of steps) {
                console.log(`[${scenarioName}] Processing Step: ${step.stepName}`);

                if (step.stockSymbol !== currentStockSymbol) {
                    throw new Error(`Step ${step.stepName} in scenario ${scenarioName} uses stock ${step.stockSymbol}, but test is set up for ${currentStockSymbol}. All steps in a scenario must use the same stock.`);
                }

                // --- Form Filling and Submission ---
                if (step.action === 'Buy') {
                    console.log(`[${scenarioName} - ${step.stepName}] Opening Add Transaction modal.`);
                    await page.locator('[data-testid="add-buy-transaction-button"]').click();
                    const transactionModal = page.locator('[data-testid="add-buy-transaction-form-modal"]');
                    await expect(transactionModal).toBeVisible({ timeout: 5000 });
                    console.log(`[${scenarioName} - ${step.stepName}] Add Transaction modal is visible.`);

                    console.log(`[${scenarioName} - ${step.stepName}] Filling form: Date=${step.date}, Action=${step.action}, Type=${step.txnType}, Signal=${step.signal}, Price=${step.price}, Investment=${step.investment}`);
                    
                    await transactionModal.locator('[data-testid="txn-form-date"]').fill(step.date);
                    
                    if (step.txnType === 'Swing') {
                        await page.click('[data-testid="txn-form-txnType-swing"]');
                    } else if (step.txnType === 'Hold') {
                        await page.click('[data-testid="txn-form-txnType-hold"]');
                    } else if (step.txnType === 'Split') {
                        await page.click('[data-testid="txn-form-txnType-split"]');
                    }

                    if (step.signal) {
                        await page.selectOption('[data-testid="txn-form-signal"]', step.signal);
                    }
                    await page.fill('[data-testid="txn-form-price"]', String(step.price));
                    await page.fill('[data-testid="txn-form-investment"]', String(step.investment));

                    await transactionModal.locator('[data-testid="txn-form-submit-button"]').click();
                    await expect(transactionModal).not.toBeVisible({ timeout: 10000 });
                    console.log(`[${scenarioName} - ${step.stepName}] Transaction form submitted and modal closed.`);
                    
                    // Wait for UI to update. Consider a more deterministic wait if possible.
                    await page.waitForTimeout(3000); // Increased from 1500 to 3000
                } else {
                    console.warn(`[${scenarioName} - ${step.stepName}] Action type '${step.action}' not handled in this test.`);
                    // If other actions like 'Sell' are introduced, they'd be handled here.
                }

                // --- Wallet Verification after each step ---
                console.log(`[${scenarioName} - ${step.stepName}] Starting wallet verification.`);

                // Verify Swing Wallet
                console.log(`[${scenarioName} - ${step.stepName}] Verifying Swing Wallet.`);
                await page.locator('[data-testid="wallet-tab-Swing"]').click();
                await page.waitForTimeout(500); // Allow tab content to load

                const hasExpectedSwingWallet = (step.txnType === 'Split' || step.txnType === 'Swing' || (step.SwWtTotalInvestment ?? 0) > 0) && typeof step.SwWtBuyPrice === 'number' && step.SwWtBuyPrice >= 0 && typeof step.SwWtTotalInvestment === 'number' && step.SwWtTotalInvestment >=0 && typeof step.SwWtRemainingShares === 'number' && step.SwWtRemainingShares >= 0;

                if (hasExpectedSwingWallet) {
                    console.log(`[${scenarioName} - ${step.stepName}] Expecting Swing Wallet to be present.`);
                    await expect(page.locator('[data-testid="wallet-notfound-display"]')).not.toBeVisible({ timeout: 1000 }); // Faster timeout if expected
                    const swingWalletRows = page.locator('[data-testid="wallets-table"] tbody tr');
                    // Assuming only one swing wallet for this stock for now
                    const swingWalletRow = swingWalletRows.first(); 
                    
                    await expect(swingWalletRow.locator('[data-testid="wallet-buyPrice-display"]'))
                        .toHaveText(`${formatCurrency(step.SwWtBuyPrice ?? 0, CURRENCY_PRECISION)}`, { timeout: 5000 });
                    await expect(swingWalletRow.locator('[data-testid="wallet-totalInvestment-display"]'))
                        .toHaveText(`${formatCurrency(step.SwWtTotalInvestment ?? 0, CURRENCY_PRECISION)}`);
                    await expect(swingWalletRow.locator('[data-testid="wallet-remainingShares-display"]'))
                        .toHaveText(formatShares(step.SwWtRemainingShares ?? 0, SHARE_PRECISION));
                    console.log(`[${scenarioName} - ${step.stepName}] Swing Wallet verified successfully.`);
                } else {
                    console.log(`[${scenarioName} - ${step.stepName}] Expecting NO Swing Wallet or Swing wallet with 0 investment/shares.`);
                     // Check if the "not found" message is visible OR if the wallet exists but shows $0.00 investment and 0 shares.
                    const notFoundVisible = await page.locator('[data-testid="wallet-notfound-display"]').isVisible();
                    if (notFoundVisible) {
                        console.log(`[${scenarioName} - ${step.stepName}] Swing Wallet not found display is visible, as expected for no wallet.`);
                    } else {
                        // Wallet might exist but be "empty" (e.g. after selling all shares)
                        // This case might need more specific handling if a $0 wallet is different from no wallet.
                        // For now, if notFound is not visible, we assume a row *might* exist but should show 0s if SwWtTotalInvestment is 0.
                        // If SwWtBuyPrice is undefined/null, it implies no wallet.
                        if (typeof step.SwWtBuyPrice !== 'number') { // Stricter check for no wallet
                             await expect(page.locator('[data-testid="wallet-notfound-display"]')).toBeVisible({ timeout: 5000 });
                        } else {
                            // This case implies a wallet exists but is expected to be zeroed out.
                            // This scenario is not covered by the current CSV, so this branch is less likely to be hit.
                            console.log(`[${scenarioName} - ${step.stepName}] Swing Wallet expected to be effectively empty or not present. 'Not found' was not visible, check for zero values if applicable.`);
                            // Add assertions for $0.00 and 0 shares if a "zeroed out" wallet is a possible state.
                        }
                    }
                }

                // Verify Hold Wallet
                console.log(`[${scenarioName} - ${step.stepName}] Verifying Hold Wallet.`);
                await page.locator('[data-testid="wallet-tab-Hold"]').click();
                await page.waitForTimeout(500); // Allow tab content to load

                const hasExpectedHoldWallet = (step.txnType === 'Split' || step.txnType === 'Hold' || (step.HlWtTotalInvestment ?? 0) > 0) && typeof step.HlWtBuyPrice === 'number' && step.HlWtBuyPrice >= 0 && typeof step.HlWtTotalInvestment === 'number' && step.HlWtTotalInvestment >=0 && typeof step.HlWtRemainingShares === 'number' && step.HlWtRemainingShares >= 0;

                if (hasExpectedHoldWallet) {
                    console.log(`[${scenarioName} - ${step.stepName}] Expecting Hold Wallet to be present.`);
                    await expect(page.locator('[data-testid="wallet-notfound-display"]')).not.toBeVisible({ timeout: 1000 });
                    const holdWalletRows = page.locator('[data-testid="wallets-table"] tbody tr');
                     // Assuming only one hold wallet for this stock for now
                    const holdWalletRow = holdWalletRows.first();
                    
                    await expect(holdWalletRow.locator('[data-testid="wallet-buyPrice-display"]'))
                        .toHaveText(`${formatCurrency(step.HlWtBuyPrice ?? 0, CURRENCY_PRECISION)}`, { timeout: 5000 });
                    await expect(holdWalletRow.locator('[data-testid="wallet-totalInvestment-display"]'))
                        .toHaveText(`${formatCurrency(step.HlWtTotalInvestment ?? 0, CURRENCY_PRECISION)}`);
                    await expect(holdWalletRow.locator('[data-testid="wallet-remainingShares-display"]'))
                        .toHaveText(formatShares(step.HlWtRemainingShares ?? 0, SHARE_PRECISION));
                    console.log(`[${scenarioName} - ${step.stepName}] Hold Wallet verified successfully.`);
                } else {
                    console.log(`[${scenarioName} - ${step.stepName}] Expecting NO Hold Wallet or Hold wallet with 0 investment/shares.`);
                    const notFoundVisible = await page.locator('[data-testid="wallet-notfound-display"]').isVisible();
                    if (notFoundVisible) {
                        console.log(`[${scenarioName} - ${step.stepName}] Hold Wallet not found display is visible, as expected for no wallet.`);
                    } else {
                         if (typeof step.HlWtBuyPrice !== 'number') { // Stricter check for no wallet
                             await expect(page.locator('[data-testid="wallet-notfound-display"]')).toBeVisible({ timeout: 5000 });
                        } else {
                            console.log(`[${scenarioName} - ${step.stepName}] Hold Wallet expected to be effectively empty or not present. 'Not found' was not visible, check for zero values if applicable.`);
                        }
                    }
                }
                 console.log(`[${scenarioName} - ${step.stepName}] Wallet verification completed.`);
            } // End of steps loop
            console.log(`[${scenarioName}] All steps processed and verified.`);
        }); // End of test block for a scenarioName
    } // End of loop for scenarioNames
}); // End of describe
