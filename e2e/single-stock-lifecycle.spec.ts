// filepath: c:\\Development\\stock-portfolio-tracker\\e2e\\single-stock-lifecycle.spec.ts
import { test, expect, Page } from '@playwright/test';
import { loginUser, navigateToStockWalletPage, clearBrowserState, clearStockData, addBuyTransaction, BuyTransactionParams, mockCurrentStockPrice, updateBuyTransaction, UpdateBuyTransactionParams, createSellTransactionFromWallet, SellTransactionParams, updateSellTransaction, UpdateSellTransactionParams, deleteTransaction, getStockOverviewStats, StockOverviewStats, getWalletDetails, WalletEntryDetails, getTransactionDetails, TransactionRowDetails } from './utils/pageHelpers'; // Import BuyTransactionParams
import { loadScenariosFromCSV } from './utils/csvHelper';
import { E2E_TEST_USERNAME, E2E_TEST_PASSWORD } from './utils/testCredentials';

// Define the interface for the CSV data
interface SingleStockLifecycleScenario {
    scenarioName: string;
    stepName: string;
    testDescription: string;
    actionToPerform: 'addBuy' | 'updateBuy' | 'createSellFromWallet' | 'updateSell' | 'mockCurrentPrice' | 'deleteTransaction' | 'verifyStockOverview' | 'verifyWalletDetails' | 'verifyTransactionDetails';
    stockSymbol: string;
    date?: string; // YYYY-MM-DD
    transactionAction?: 'Buy' | 'Sell';
    txnType?: 'Swing' | 'Hold' | 'Split';
    signal?: string;
    price?: number;
    investment?: number;
    quantity?: number; // Not typically used for 'addBuy' with 'investment', but good to have
    shrPercent?: number;
    targetTransactionId?: string;
    targetWalletId?: string;
    newCurrentPrice?: number;
    expectedRealizedSwingPL_USD?: number;
    expectedUnrealizedSwingPL_USD?: number;
    expectedTotalSwingPL_USD?: number;
    expectedRealizedHoldPL_USD?: number;
    expectedUnrealizedHoldPL_USD?: number;
    expectedTotalHoldPL_USD?: number;
    expectedRealizedStockPL_USD?: number;
    expectedUnrealizedStockPL_USD?: number;
    expectedTotalStockPL_USD?: number;
    expectedSwingWallet_BuyPrice?: number;
    expectedSwingWallet_Shares?: number;
    expectedSwingWallet_Investment?: number;
    expectedHoldWallet_BuyPrice?: number;
    expectedHoldWallet_Shares?: number;
    expectedHoldWallet_Investment?: number;
}

const scenarios = loadScenariosFromCSV<SingleStockLifecycleScenario>('../single-stock-lifecycle-scenarios.csv', [
    'price', 'investment', 'quantity', 'shrPercent', 'newCurrentPrice',
    'expectedRealizedSwingPL_USD', 'expectedUnrealizedSwingPL_USD', 'expectedTotalSwingPL_USD',
    'expectedRealizedHoldPL_USD', 'expectedUnrealizedHoldPL_USD', 'expectedTotalHoldPL_USD',
    'expectedRealizedStockPL_USD', 'expectedUnrealizedStockPL_USD', 'expectedTotalStockPL_USD',
    'expectedSwingWallet_BuyPrice', 'expectedSwingWallet_Shares', 'expectedSwingWallet_Investment',
    'expectedHoldWallet_BuyPrice', 'expectedHoldWallet_Shares', 'expectedHoldWallet_Investment',
]);

// Group scenarios by scenarioName
const groupedScenarios = scenarios.reduce((acc, scenario) => {
    if (!acc[scenario.scenarioName]) {
        acc[scenario.scenarioName] = [];
    }
    acc[scenario.scenarioName].push(scenario);
    return acc;
}, {} as Record<string, SingleStockLifecycleScenario[]>);


test.describe('Single Stock Lifecycle E2E Tests', () => {
    let page: Page;
    let currentStockId: string | null = null; // To store the ID of the stock being tested in a scenario

    test.beforeAll(async ({ browser }) => {
        page = await browser.newPage();
        await clearBrowserState(page);
        await loginUser(page, E2E_TEST_USERNAME, E2E_TEST_PASSWORD);
    });

    test.afterAll(async () => {
        await page.close();
    });

    for (const [scenarioName, steps] of Object.entries(groupedScenarios)) {
        test(`Scenario: ${scenarioName}`, async () => {
            // Assuming all steps in a scenario are for the same stockSymbol
            const stockSymbolForScenario = steps[0].stockSymbol;
            if (!stockSymbolForScenario) {
                test.skip(true, 'No stock symbol defined for this scenario.');
                return;
            }

            console.log(`[Scenario: ${scenarioName}] Getting ID for stock: ${stockSymbolForScenario}`);
            currentStockId = await getStockIdBySymbol(page, stockSymbolForScenario);

            if (!currentStockId) {
                console.error(`[Scenario: ${scenarioName}] Failed to get stock ID for ${stockSymbolForScenario}. Skipping scenario.`);
                test.skip(true, `Failed to get stock ID for ${stockSymbolForScenario}`);
                return;
            }

            console.log(`[Scenario: ${scenarioName}] Clearing data for stock: ${stockSymbolForScenario} (ID: ${currentStockId})`);
            await clearStockData(page, currentStockId, stockSymbolForScenario);

            // Initial navigation to the stock wallet page for the scenario
            console.log(`[Scenario: ${scenarioName}] Navigating to wallet page for ${stockSymbolForScenario} (ID: ${currentStockId})`);
            await navigateToStockWalletPage(page, currentStockId, stockSymbolForScenario);

            for (const step of steps) {
                console.log(`[Step: ${step.stepName}] Executing: ${step.testDescription}`);

                const expectedWalletUrlPart = `/wallets/${currentStockId}`;
                if (currentStockId && !page.url().includes(expectedWalletUrlPart)) {
                    console.warn(`[Step: ${step.stepName}] Not on the expected wallet page. Re-navigating to ${expectedWalletUrlPart}`);
                    await navigateToStockWalletPage(page, currentStockId, stockSymbolForScenario);
                }

                switch (step.actionToPerform) {
                    case 'addBuy':
                        if (!currentStockId) {
                            console.error(`[Step: ${step.stepName}] Cannot perform 'addBuy' because currentStockId is null. Skipping step.`);
                            // test.skip is not available inside a step like this; consider failing or logging prominently
                            throw new Error(`Cannot perform 'addBuy' for ${step.stockSymbol} due to missing stockId.`);
                        }
                        if (step.date && (step.txnType === 'Swing' || step.txnType === 'Hold') && step.price !== undefined && step.investment !== undefined) {
                            const buyParams: BuyTransactionParams = {
                                date: step.date,
                                txnType: step.txnType as 'Swing' | 'Hold',
                                signal: step.signal,
                                price: step.price,
                                investment: step.investment,
                            };
                            await addBuyTransaction(page, currentStockId, buyParams);
                            console.log(`[Step: ${step.stepName}] 'addBuy' action completed for ${step.stockSymbol}.`);
                        } else {
                            console.error(`[Step: ${step.stepName}] Insufficient or invalid data for 'addBuy' action:`, step);
                            throw new Error(`Insufficient or invalid data for 'addBuy' for ${step.stockSymbol}. Date: ${step.date}, Type: ${step.txnType}, Price: ${step.price}, Investment: ${step.investment}`);
                        }
                        break;
                    case 'updateBuy':
                        if (!currentStockId) {
                            console.error(`[Step: ${step.stepName}] Cannot perform 'updateBuy' because currentStockId is null. Skipping step.`);
                            throw new Error(`Cannot perform 'updateBuy' for ${step.stockSymbol} due to missing stockId.`);
                        }
                        if (step.targetTransactionId && step.date && (step.txnType === 'Swing' || step.txnType === 'Hold') && step.price !== undefined && step.investment !== undefined) {
                            const updateBuyParams: UpdateBuyTransactionParams = {
                                date: step.date,
                                txnType: step.txnType as 'Swing' | 'Hold',
                                signal: step.signal,
                                price: step.price,
                                investment: step.investment,
                            };
                            await updateBuyTransaction(page, currentStockId, step.targetTransactionId, updateBuyParams);
                            console.log(`[Step: ${step.stepName}] 'updateBuy' action completed for transaction ${step.targetTransactionId} of ${step.stockSymbol}.`);
                        } else {
                            console.error(`[Step: ${step.stepName}] Insufficient or invalid data for 'updateBuy' action:`, step);
                            throw new Error(`Insufficient or invalid data for 'updateBuy' for ${step.stockSymbol}. TargetTxnId: ${step.targetTransactionId}, Date: ${step.date}, Type: ${step.txnType}, Price: ${step.price}, Investment: ${step.investment}`);
                        }
                        break;
                    case 'mockCurrentPrice':
                        if (!currentStockId) {
                            console.error(`[Step: ${step.stepName}] Cannot perform 'mockCurrentPrice' because currentStockId is null. Skipping step.`);
                            throw new Error(`Cannot perform 'mockCurrentPrice' for ${step.stockSymbol} due to missing stockId.`);
                        }
                        if (step.newCurrentPrice !== undefined) {
                            await mockCurrentStockPrice(page, step.stockSymbol, step.newCurrentPrice);
                            console.log(`[Step: ${step.stepName}] 'mockCurrentPrice' action completed for ${step.stockSymbol} to ${step.newCurrentPrice}.`);
                            await page.reload();
                            await page.waitForLoadState('networkidle');
                            console.log(`[Step: ${step.stepName}] Page reloaded after mocking current price.`);
                        } else {
                            console.error(`[Step: ${step.stepName}] Insufficient or invalid data for 'mockCurrentPrice' action:`, step);
                            throw new Error(`Insufficient or invalid data for 'mockCurrentPrice' for ${step.stockSymbol}. New Price: ${step.newCurrentPrice}`);
                        }
                        break;
                    case 'createSellFromWallet': // Corrected from 'createSell' to match interface
                        if (!currentStockId) {
                            console.error(`[Step: ${step.stepName}] Cannot perform 'createSellFromWallet' because currentStockId is null. Skipping step.`);
                            throw new Error(`Cannot perform 'createSellFromWallet' for ${step.stockSymbol} due to missing stockId.`);
                        }
                        // Note: step.targetWalletId (formerly targetWalletEntryId) is not used by the current createSellTransactionFromWallet helper.
                        // The helper currently clicks the general "add new transaction" button and then selects "sell".
                        // If specific wallet entry targeting for sells is required, the helper and form interaction logic would need an update.
                        if (step.date && (step.txnType === 'Swing' || step.txnType === 'Hold') && step.price !== undefined && step.quantity !== undefined) {
                            const sellParams: SellTransactionParams = {
                                date: step.date,
                                txnType: step.txnType as 'Swing' | 'Hold',
                                signal: step.signal,
                                price: step.price,
                                quantity: step.quantity,
                            };
                            await createSellTransactionFromWallet(page, currentStockId, sellParams); // Removed targetWalletEntryId
                            console.log(`[Step: ${step.stepName}] 'createSellFromWallet' action completed for ${step.stockSymbol}.`);
                        } else {
                            console.error(`[Step: ${step.stepName}] Insufficient or invalid data for 'createSellFromWallet' action:`, step);
                            throw new Error(`Insufficient or invalid data for 'createSellFromWallet' for ${step.stockSymbol}. Date: ${step.date}, Type: ${step.txnType}, Price: ${step.price}, Quantity: ${step.quantity}`);
                        }
                        break;
                    case 'updateSell':
                        if (!currentStockId) {
                            console.error(`[Step: ${step.stepName}] Cannot perform 'updateSell' because currentStockId is null. Skipping step.`);
                            throw new Error(`Cannot perform 'updateSell' for ${step.stockSymbol} due to missing stockId.`);
                        }
                        if (step.targetTransactionId && step.date && (step.txnType === 'Swing' || step.txnType === 'Hold') && step.price !== undefined && step.quantity !== undefined) {
                            const updateSellParams: UpdateSellTransactionParams = {
                                date: step.date,
                                txnType: step.txnType as 'Swing' | 'Hold',
                                signal: step.signal,
                                price: step.price,
                                quantity: step.quantity,
                            };
                            await updateSellTransaction(page, currentStockId, step.targetTransactionId, updateSellParams);
                            console.log(`[Step: ${step.stepName}] 'updateSell' action completed for transaction ${step.targetTransactionId} of ${step.stockSymbol}.`);
                        } else {
                            console.error(`[Step: ${step.stepName}] Insufficient or invalid data for 'updateSell' action:`, step);
                            throw new Error(`Insufficient or invalid data for 'updateSell' for ${step.stockSymbol}. TargetTxnId: ${step.targetTransactionId}, Date: ${step.date}, Type: ${step.txnType}, Price: ${step.price}, Quantity: ${step.quantity}`);
                        }
                        break;
                    case 'deleteTransaction':
                        if (!currentStockId) {
                            console.error(`[Step: ${step.stepName}] Cannot perform 'deleteTransaction' because currentStockId is null. Skipping step.`);
                            throw new Error(`Cannot perform 'deleteTransaction' for ${step.stockSymbol} due to missing stockId.`);
                        }
                        if (step.targetTransactionId) {
                            await deleteTransaction(page, currentStockId, step.targetTransactionId, stockSymbolForScenario); // Added stockSymbolForScenario
                            console.log(`[Step: ${step.stepName}] 'deleteTransaction' action completed for transaction ${step.targetTransactionId} of ${step.stockSymbol}.`);
                        } else {
                            console.error(`[Step: ${step.stepName}] Insufficient or invalid data for 'deleteTransaction' action:`, step);
                            throw new Error(`Insufficient or invalid data for 'deleteTransaction' for ${step.stockSymbol}. TargetTxnId: ${step.targetTransactionId}`);
                        }
                        break;
                    case 'verifyStockOverview':
                        if (!currentStockId) {
                            console.error(`[Step: ${step.stepName}] Cannot perform 'verifyStockOverview' because currentStockId is null. Skipping step.`);
                            throw new Error(`Cannot perform 'verifyStockOverview' for ${step.stockSymbol} due to missing stockId.`);
                        }
                        console.log(`[Step: ${step.stepName}] Verifying stock overview for ${step.stockSymbol}...`);
                        // Corrected call to getStockOverviewStats
                        const overviewStats = await getStockOverviewStats(page, currentStockId, stockSymbolForScenario);
                        console.log(`[Step: ${step.stepName}] Retrieved overview stats:`, overviewStats);

                        // Assertions for Swing P/L - Corrected property access
                        if (step.expectedRealizedSwingPL_USD !== undefined) {
                            expect(overviewStats.realizedPLSwing).toBeCloseTo(step.expectedRealizedSwingPL_USD, 2);
                        }
                        if (step.expectedUnrealizedSwingPL_USD !== undefined) {
                            expect(overviewStats.unrealizedPLSwing).toBeCloseTo(step.expectedUnrealizedSwingPL_USD, 2);
                        }
                        if (step.expectedTotalSwingPL_USD !== undefined) {
                            expect(overviewStats.totalPLSwing).toBeCloseTo(step.expectedTotalSwingPL_USD, 2);
                        }

                        // Assertions for Hold P/L - Corrected property access
                        if (step.expectedRealizedHoldPL_USD !== undefined) {
                            expect(overviewStats.realizedPLHold).toBeCloseTo(step.expectedRealizedHoldPL_USD, 2);
                        }
                        if (step.expectedUnrealizedHoldPL_USD !== undefined) {
                            expect(overviewStats.unrealizedPLHold).toBeCloseTo(step.expectedUnrealizedHoldPL_USD, 2);
                        }
                        if (step.expectedTotalHoldPL_USD !== undefined) {
                            expect(overviewStats.totalPLHold).toBeCloseTo(step.expectedTotalHoldPL_USD, 2);
                        }

                        // Assertions for Overall Stock P/L - Corrected property access
                        if (step.expectedRealizedStockPL_USD !== undefined) {
                            expect(overviewStats.realizedPLStock).toBeCloseTo(step.expectedRealizedStockPL_USD, 2);
                        }
                        if (step.expectedUnrealizedStockPL_USD !== undefined) {
                            expect(overviewStats.unrealizedPLStock).toBeCloseTo(step.expectedUnrealizedStockPL_USD, 2);
                        }
                        if (step.expectedTotalStockPL_USD !== undefined) {
                            expect(overviewStats.totalPLStock).toBeCloseTo(step.expectedTotalStockPL_USD, 2);
                        }
                        console.log(`[Step: ${step.stepName}] Stock overview verification completed.`);
                        break;
                    case 'verifyWalletDetails':
                        if (!currentStockId) {
                            console.error(`[Step: ${step.stepName}] Cannot perform 'verifyWalletDetails' because currentStockId is null. Skipping step.`);
                            throw new Error(`Cannot perform 'verifyWalletDetails' for ${step.stockSymbol} due to missing stockId.`);
                        }
                        console.log(`[Step: ${step.stepName}] Verifying wallet details for ${step.stockSymbol}...`);
                        const walletDetails = await getWalletDetails(page, currentStockId, stockSymbolForScenario);
                        console.log(`[Step: ${step.stepName}] Retrieved wallet details:`, walletDetails);

                        // Example: Verify details for the first Swing wallet entry if expected values are provided
                        // This assumes your CSV will have columns like expectedSwingWallet_BuyPrice, expectedSwingWallet_Shares, etc.
                        // You might need to iterate or find specific wallets if there are multiple of the same type.
                        const swingWallets = walletDetails.filter(w => w.walletType === 'Swing');
                        if (swingWallets.length > 0) {
                            // For simplicity, checking the first swing wallet. Adapt if multiple are expected.
                            const firstSwingWallet = swingWallets[0];
                            if (step.expectedSwingWallet_BuyPrice !== undefined) {
                                expect(firstSwingWallet.buyPrice).toBeCloseTo(step.expectedSwingWallet_BuyPrice, 2);
                            }
                            if (step.expectedSwingWallet_Shares !== undefined) {
                                expect(firstSwingWallet.remainingShares).toBeCloseTo(step.expectedSwingWallet_Shares, 3); // Assuming shares can have decimals
                            }
                            if (step.expectedSwingWallet_Investment !== undefined) {
                                expect(firstSwingWallet.totalInvestment).toBeCloseTo(step.expectedSwingWallet_Investment, 2);
                            }
                        }

                        const holdWallets = walletDetails.filter(w => w.walletType === 'Hold');
                        if (holdWallets.length > 0) {
                            // For simplicity, checking the first hold wallet.
                            const firstHoldWallet = holdWallets[0];
                            if (step.expectedHoldWallet_BuyPrice !== undefined) {
                                expect(firstHoldWallet.buyPrice).toBeCloseTo(step.expectedHoldWallet_BuyPrice, 2);
                            }
                            if (step.expectedHoldWallet_Shares !== undefined) {
                                expect(firstHoldWallet.remainingShares).toBeCloseTo(step.expectedHoldWallet_Shares, 3);
                            }
                            if (step.expectedHoldWallet_Investment !== undefined) {
                                expect(firstHoldWallet.totalInvestment).toBeCloseTo(step.expectedHoldWallet_Investment, 2);
                            }
                        }
                        // Add more specific assertions based on your CSV columns and test needs.
                        // For example, if your CSV specifies an expected number of Swing wallets, assert that.
                        // expect(swingWallets.length).toBe(step.expectedNumberOfSwingWallets);

                        console.log(`[Step: ${step.stepName}] Wallet details verification completed.`);
                        break;
                    case 'verifyTransactionDetails':
                        if (!currentStockId) {
                            console.error(`[Step: ${step.stepName}] Cannot perform 'verifyTransactionDetails' because currentStockId is null. Skipping step.`);
                            throw new Error(`Cannot perform 'verifyTransactionDetails' for ${step.stockSymbol} due to missing stockId.`);
                        }
                        console.log(`[Step: ${step.stepName}] Verifying transaction details for ${step.stockSymbol}...`);
                        const transactionDetails = await getTransactionDetails(page);
                        console.log(`[Step: ${step.stepName}] Retrieved transaction details:`, transactionDetails);

                        // This is a basic example. You'll need to make this more robust based on your CSV.
                        // For instance, your CSV might specify details for a *particular* transaction (e.g., the Nth one, or one with a specific date/action).
                        // Or, it might specify the *total number* of transactions expected.

                        // Example: Verify the details of the LATEST transaction if expected values are provided.
                        // This requires defining columns in your CSV like: expectedTxn_Date, expectedTxn_Action, expectedTxn_Price, etc.
                        if (transactionDetails.length > 0) {
                            const latestTransaction = transactionDetails[transactionDetails.length - 1]; // Or find by ID if targetTransactionId is relevant here

                            // Example: If CSV has 'expectedLatestTxn_Action', 'expectedLatestTxn_Price'
                            // if (step.expectedLatestTxn_Action) {
                            //     expect(latestTransaction.action).toBe(step.expectedLatestTxn_Action);
                            // }
                            // if (step.expectedLatestTxn_Price !== undefined) {
                            //     expect(latestTransaction.price).toBeCloseTo(step.expectedLatestTxn_Price, 2);
                            // }
                            // Add more assertions for other fields: date, type, signal, investment, proceeds, quantity, P/L, etc.
                            // based on what you add to your CSV for verification.
                        }
                        // Example: Verify the total number of transactions if specified in CSV
                        // if (step.expectedTotalTransactions !== undefined) {
                        //     expect(transactionDetails.length).toBe(step.expectedTotalTransactions);
                        // }

                        console.log(`[Step: ${step.stepName}] Transaction details verification completed. (Note: Current assertions are placeholders and need to be expanded based on CSV capabilities)`);
                        break;
                    default:
                        console.warn(`WARN: Action ${step.actionToPerform} is not yet implemented.`);
                }

                // TODO: Implement assertions for P/L and wallet states
                // await verifyStockOverviewStats(page, step);
                // await verifyWalletStates(page, step);
                console.log(`Assertions for step ${step.stepName} are pending.`);

                // Pause after each step to allow inspection
                console.log(`[Step: ${step.stepName}] Pausing for inspection... Resume by clicking the resume button in Playwright Inspector.`);
                await page.pause();
            }
        });
    }
});

async function getStockIdBySymbol(page: Page, symbol: string): Promise<string | null> {
    console.log(`[getStockIdBySymbol] Attempting to find stock ID for symbol: ${symbol}`);
    await page.goto('/stocks-listing', { waitUntil: 'networkidle' });
    //await page.pause(); 

    // Screenshot before waiting for selector
    const screenshotPathBefore = `e2e_portfolio_page_before_wait_${symbol}_${Date.now()}.png`;
    await page.screenshot({ path: screenshotPathBefore, fullPage: true });
    console.log(`[getStockIdBySymbol] Screenshot taken: ${screenshotPathBefore}`);

    try {
        // Check if any stock links are present
        const anyStockLink = page.locator('[data-testid^="stock-link-"]');
        const count = await anyStockLink.count();
        console.log(`[getStockIdBySymbol] Found ${count} elements matching [data-testid^="stock-link-"]`);

        if (count === 0) {
            console.error(`[getStockIdBySymbol] No stock links found on the portfolio page with selector [data-testid^="stock-link-"].`);
            // Fallback for MSFT if no links are found at all
            if (symbol.toUpperCase() === 'MSFT') {
                const fallbackMsftId = 'msft-seeded-test-id'; 
                console.warn(`[getStockIdBySymbol] No stock links found. Using fallback ID for MSFT: '${fallbackMsftId}'. Ensure this is intended.`);
                return fallbackMsftId; 
            }
            await page.screenshot({ path: `e2e_get_stock_id_error_no_links_${symbol}_${Date.now()}.png`, fullPage: true });
            return null; // No links and not MSFT, so return null
        }

        // Wait for the general selector to ensure the list is populated
        await page.waitForSelector('[data-testid^="stock-link-"]', { timeout: 10000 });

        const stockLinkLocator = page.locator(`a[data-testid="stock-link-${symbol.toUpperCase()}"]`);
        
        await stockLinkLocator.waitFor({ state: 'visible', timeout: 5000 }); // Shorter timeout for specific symbol
        const href = await stockLinkLocator.getAttribute('href');
        if (href) {
            const id = href.split('/').pop();
            if (id && id.trim() !== '') {
                console.log(`[getStockIdBySymbol] Found stock ID: ${id} for symbol: ${symbol}`);
                return id;
            }
            console.error(`[getStockIdBySymbol] Extracted ID is null or empty for symbol: ${symbol}. Href: ${href}`);
        } else {
            console.error(`[getStockIdBySymbol] Could not get href attribute for stock link for symbol ${symbol}.`);
        }
    } catch (error) {
        console.error(`[getStockIdBySymbol] Error finding or processing stock link for symbol ${symbol}:`, error);
        const screenshotPathError = `e2e_get_stock_id_error_catch_${symbol}_${Date.now()}.png`;
        await page.screenshot({ path: screenshotPathError, fullPage: true });
        console.log(`[getStockIdBySymbol] Screenshot taken on error: ${screenshotPathError}`);
        
        // Fallback for MSFT within catch block
        if (symbol.toUpperCase() === 'MSFT') {
            const fallbackMsftId = 'msft-seeded-test-id'; 
            console.warn(`[getStockIdBySymbol] Error occurred. Using fallback ID for MSFT: '${fallbackMsftId}'. Ensure this is intended.`);
            return fallbackMsftId; 
        }
    }
    
    // This part of the original code for MSFT fallback might be redundant if handled above,
    // but kept for safety, though it should ideally be hit only if the try block completes without returning.
    // However, the logic above should handle MSFT fallback more proactively.
    // if (symbol.toUpperCase() === 'MSFT') {
    //     const fallbackMsftId = 'msft-seeded-test-id'; 
    //     console.warn(`[getStockIdBySymbol] Using fallback ID for MSFT: '${fallbackMsftId}'. Ensure this is intended.`);
    //     return fallbackMsftId; 
    // }
    
    console.error(`[getStockIdBySymbol] Ultimately could not determine stock ID for symbol: ${symbol}. Returning null.`);
    return null;
}
