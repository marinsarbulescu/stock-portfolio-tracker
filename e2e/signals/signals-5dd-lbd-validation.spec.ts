// e2e/signals/signals-5dd-lbd-comprehensive.spec.ts

// Comprehensive E2E test for 5DD (Five Day Dip) and LBD (Last Buy Dip) validation
// Tests both SignalsTable and WalletsTransactionsTable components
// Follows portfolio-overview test patterns with scenario-based approach

import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { test, expect } from '@playwright/test';
import amplifyOutputs from '../../amplify_outputs.json';
import type { Schema } from '../../amplify/data/resource';

import {
    createPortfolioStock,
    deletePortfolioStock,
    createTransaction,
    type PortfolioStockCreateData,
    type TransactionCreateData,
} from '../utils/dataHelpers';
import { E2E_TEST_USER_OWNER_ID, E2E_TEST_USERNAME } from '../utils/testCredentials';
import { clearBrowserState, loginUser } from '../utils/pageHelpers';
import { cleanupTestStocks } from '../utils/cleanupHelper';
import { handleTestFailure, executeTestStep } from '../utils/testHelpers';

// Configure Amplify
try {
    Amplify.configure(amplifyOutputs);
    console.log('[5DD-LBD-validation] Amplify configured successfully.');
} catch (error) {
    console.error('[5DD-LBD-validation] CRITICAL: Error configuring Amplify:', error);
}

// Load test configuration
const testConfig = require('./signals-5dd-lbd-validation.json');

// Helper function to calculate dynamic transaction date based on days ago
function calculateTransactionDate(daysAgo: number): string {
    const today = new Date();
    const transactionDate = new Date(today);
    transactionDate.setDate(today.getDate() - daysAgo);

    // Use local date to avoid timezone issues with frontend calculation
    const year = transactionDate.getFullYear();
    const month = String(transactionDate.getMonth() + 1).padStart(2, '0');
    const day = String(transactionDate.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`; // Return YYYY-MM-DD format in local timezone
}

// Helper function to navigate to signals page
async function navigateToSignalsPage(page: any) {
    console.log('[NavigationHelper] Navigating to Signals page...');
    await page.goto('/');

    // Use proper testid for navigation
    const signalsLink = page.locator('[data-testid="nav-home-link"]');
    await expect(signalsLink).toBeVisible({ timeout: 15000 });
    await signalsLink.click();

    // Wait for signals page to load using testid
    await expect(page.locator('[data-testid="signals-page-title"]')).toBeVisible({ timeout: 15000 });
    console.log('[NavigationHelper] Successfully navigated to Signals page.');
}

// Helper function to navigate to wallets page for a specific stock
async function navigateToWalletsPage(page: any, stockId: string) {
    console.log(`[NavigationHelper] Navigating to Wallets page for stock ${stockId}...`);
    await page.goto(`/wallets/${stockId}`);

    // Wait for wallets page to load
    await page.waitForTimeout(2000); // Allow data to load
    console.log('[NavigationHelper] Successfully navigated to Wallets page.');
}

// Helper function to create stock with test data
async function createStockFromConfig(stockKey: string) {
    const stockConfig = testConfig.testData.stocks[stockKey];
    console.log(`[StockHelper] Creating stock ${stockConfig.symbol} with test data...`);

    const stockData: PortfolioStockCreateData = {
        symbol: stockConfig.symbol,
        name: stockConfig.name,
        stockType: stockConfig.stockType as any,
        region: stockConfig.region as any,
        marketCategory: stockConfig.marketCategory as any,
        riskGrowthProfile: stockConfig.riskGrowthProfile as any,
        budget: stockConfig.budget,
        swingHoldRatio: stockConfig.swingHoldRatio,
        pdp: stockConfig.pdp,
        stp: stockConfig.stp,
        htp: stockConfig.htp,
        stockCommission: stockConfig.stockCommission,
        owner: E2E_TEST_USER_OWNER_ID,
        testPrice: stockConfig.testPrice,
        testHistoricalCloses: stockConfig.testHistoricalCloses ? JSON.stringify(stockConfig.testHistoricalCloses) : undefined,
        isHidden: false,
        archived: false
    };

    const createdStock = await createPortfolioStock(stockData);
    console.log(`[StockHelper] ✅ Stock ${stockConfig.symbol} created with ID: ${createdStock.id}`);

    if (stockConfig.testPrice) {
        console.log(`[StockHelper] Test price: $${stockConfig.testPrice}`);
    }
    if (stockConfig.testHistoricalCloses) {
        console.log(`[StockHelper] Historical closes: ${stockConfig.testHistoricalCloses.length} data points`);
    }

    return createdStock;
}

// Helper function to create transaction from config
async function createTransactionFromConfig(stockId: string, transactionConfig: any) {
    console.log(`[TransactionHelper] Creating transaction: ${transactionConfig.action} at $${transactionConfig.price}...`);

    // Calculate dynamic transaction date based on expected days ago
    const dynamicDate = calculateTransactionDate(transactionConfig.daysAgo);

    // Calculate LBD for Buy transactions (matching UI business logic)
    let lbdValue: number | null = null;
    if (transactionConfig.action === 'Buy') {
        try {
            const client = generateClient<Schema>({
                authMode: 'apiKey',
                apiKey: process.env.AMPLIFY_API_KEY
            });

            // Fetch stock details to get PDP and stockCommission
            const { data: stock } = await client.models.PortfolioStock.get(
                { id: stockId },
                { selectionSet: ['pdp', 'stp', 'stockCommission'] }
            );

            const pdp = (stock as unknown as { pdp?: number })?.pdp;
            const stp = (stock as unknown as { stp?: number })?.stp;
            const stockCommission = (stock as unknown as { stockCommission?: number })?.stockCommission;
            const price = transactionConfig.price;

            // Calculate LBD using the same formula as WalletsAddEditTransactionModal.tsx
            if (typeof pdp === 'number' && typeof stp === 'number' && price) {
                // Calculate target LBD (without commission adjustment)
                const targetLBD = price - (price * (pdp / 100));

                // LBD does not include commission adjustment
                // This ensures consistency with LBD Signal (%) which also doesn't consider commission
                const lbd_raw = targetLBD;

                // Round to 2 decimal places (CURRENCY_PRECISION)
                lbdValue = parseFloat(lbd_raw.toFixed(2));
                console.log(`[TransactionHelper] Calculated LBD: $${lbdValue}`);
            }
        } catch (error) {
            console.error('[TransactionHelper] Error calculating LBD:', error);
        }
    }

    const transactionData: TransactionCreateData = {
        portfolioStockId: stockId,
        owner: E2E_TEST_USER_OWNER_ID,
        action: transactionConfig.action as any,
        txnType: transactionConfig.txnType as any,
        signal: transactionConfig.signal || '',
        price: transactionConfig.price,
        investment: transactionConfig.investment,
        date: dynamicDate,
        lbd: lbdValue
    };

    const transaction = await createTransaction(transactionData);
    console.log(`[TransactionHelper] ✅ Transaction created: ${transaction.action} $${transaction.investment} at $${transaction.price}`);
    console.log(`[TransactionHelper] Transaction date: ${dynamicDate} (${transactionConfig.daysAgo} days ago)`);

    return transaction;
}

// Test Suite - Configured for isolated execution
test.describe.configure({ mode: 'serial' });
test.describe('5DD and LBD Validation', () => {
    let createdStockIds: string[] = [];

    test.beforeEach(async ({ page }) => {
        // Clean up test stocks before each test to ensure clean state
        const allSymbols = testConfig.cleanupSymbols || [];
        await cleanupTestStocks(allSymbols);

        // Clear browser state and login
        // Note: We clear and login for each test to ensure a clean, authenticated state
        // This is necessary because navigation between tests can affect session state
        await clearBrowserState(page);
        await loginUser(page);
    });

    test.afterEach(async () => {
        // Clean up created stocks
        if (createdStockIds.length > 0) {
            for (const stockId of createdStockIds) {
                try {
                    await deletePortfolioStock(stockId);
                } catch (error) {
                    console.warn(`[Cleanup] Could not delete stock ${stockId}:`, error);
                }
            }
        }

        // Clean up by symbols as backup
        const allSymbols = Object.values(testConfig.testData.stocks).map((stock: any) => stock.symbol);
        await cleanupTestStocks(allSymbols);
        createdStockIds = [];
    });

    // Scenario 1: 5DD Display with Old Buy Transaction
    test('Scenario 1: 5DD shows when last buy > 5 days ago', async ({ page }) => {
        test.setTimeout(120000); // 2 minutes timeout

        const scenario = testConfig.scenarios.find((s: any) => s.id === '5dd_shows_with_old_buy');
        console.log(`\n🚀 Starting Scenario 1: ${scenario.name}...`);

        try {
            // Phase 1: Create stock with test data
            await executeTestStep(page, 'Create Stock with Test Data', async () => {
                const stock = await createStockFromConfig(scenario.setup.stock);
                createdStockIds.push(stock.id);

                // Store stock ID for transaction creation
                (scenario as any).createdStockId = stock.id;
            });

            // Phase 2: Add old buy transaction
            await executeTestStep(page, 'Add Old Buy Transaction', async () => {
                const transaction = scenario.setup.transactions[0];
                await createTransactionFromConfig((scenario as any).createdStockId, transaction);
            });

            // Phase 3: Navigate to Signals page and validate
            await executeTestStep(page, 'Navigate to Signals and Validate', async () => {
                await navigateToSignalsPage(page);
                await page.waitForTimeout(2000); // Allow data to load

                const stockConfig = testConfig.testData.stocks[scenario.setup.stock];
                const symbol = stockConfig.symbol.toUpperCase();

                // Verify stock row exists
                const tickerCell = page.locator(`[data-testid="signals-table-ticker-${symbol}"]`);
                await expect(tickerCell).toBeVisible({ timeout: 10000 });
                console.log(`[Validation] Found ticker cell for ${symbol}`);

                // Validate 5DD column
                const validation = scenario.validations.signalsTable;
                if (validation['5dd']) {
                    const fiveDDCell = page.locator(`[data-testid="signals-table-5dd-${symbol}"]`);
                    await expect(fiveDDCell).toBeVisible({ timeout: 10000 });

                    const fiveDDText = await fiveDDCell.textContent();
                    console.log(`[Validation] 5DD actual: "${fiveDDText}", expected: "${validation['5dd']}"`);
                    expect(fiveDDText?.trim()).toBe(validation['5dd']);
                }

                // Validate Last Buy column
                if (validation.lastBuy) {
                    const lastBuyCell = page.locator(`[data-testid="signals-table-last-buy-${symbol}"]`);
                    await expect(lastBuyCell).toBeVisible({ timeout: 10000 });

                    const lastBuyText = await lastBuyCell.textContent();
                    console.log(`[Validation] Last Buy actual: "${lastBuyText}", expected: "${validation.lastBuy}"`);
                    expect(lastBuyText?.trim()).toBe(validation.lastBuy);
                }

                // Validate LBD column (should be null/dash for this scenario)
                if (validation.lbd === null) {
                    const lbdCell = page.locator(`[data-testid="signals-table-lbd-${symbol}"]`);
                    if (await lbdCell.count() > 0) {
                        const lbdText = await lbdCell.textContent();
                        console.log(`[Validation] LBD actual: "${lbdText}", expected: "-" (null)`);
                        expect(lbdText?.trim()).toBe('-');
                    }
                }

                console.log('✅ Scenario 1 validation completed successfully');
            });

        } catch (error) {
            await handleTestFailure(page, 'Scenario 1 - 5DD Display with Old Buy', error);
        }
    });

    // Scenario 2: 5DD Hidden with Recent Buy
    test('Scenario 2: 5DD hidden when last buy ≤ 5 days ago', async ({ page }) => {
        test.setTimeout(120000); // 2 minutes timeout

        const scenario = testConfig.scenarios.find((s: any) => s.id === '5dd_hidden_with_recent_buy');
        console.log(`\n🚀 Starting Scenario 2: ${scenario.name}...`);

        try {
            // Phase 1: Create stock with test data (can reuse same stock as Scenario 1)
            await executeTestStep(page, 'Create Stock with Test Data', async () => {
                const stock = await createStockFromConfig(scenario.setup.stock);
                createdStockIds.push(stock.id);
                (scenario as any).createdStockId = stock.id;
            });

            // Phase 2: Add recent buy transaction (3 days ago)
            await executeTestStep(page, 'Add Recent Buy Transaction', async () => {
                const transaction = scenario.setup.transactions[0];
                await createTransactionFromConfig((scenario as any).createdStockId, transaction);
            });

            // Phase 3: Navigate to Signals page and validate
            await executeTestStep(page, 'Navigate to Signals and Validate', async () => {
                await navigateToSignalsPage(page);
                await page.waitForTimeout(2000); // Allow data to load

                const stockConfig = testConfig.testData.stocks[scenario.setup.stock];
                const symbol = stockConfig.symbol.toUpperCase();

                // Verify stock row exists
                const tickerCell = page.locator(`[data-testid="signals-table-ticker-${symbol}"]`);
                await expect(tickerCell).toBeVisible({ timeout: 10000 });
                console.log(`[Validation] Found ticker cell for ${symbol}`);

                // Validate 5DD column - should be hidden (showing dash)
                const validation = scenario.validations.signalsTable;
                if (validation['5dd'] === null) {
                    const fiveDDCell = page.locator(`[data-testid="signals-table-5dd-${symbol}"]`);
                    await expect(fiveDDCell).toBeVisible({ timeout: 10000 });

                    const fiveDDText = await fiveDDCell.textContent();
                    console.log(`[Validation] 5DD actual: "${fiveDDText}", expected: "-" (hidden due to recent buy)`);
                    expect(fiveDDText?.trim()).toBe('-');
                }

                // Validate Last Buy column
                if (validation.lastBuy) {
                    const lastBuyCell = page.locator(`[data-testid="signals-table-last-buy-${symbol}"]`);
                    await expect(lastBuyCell).toBeVisible({ timeout: 10000 });

                    const lastBuyText = await lastBuyCell.textContent();
                    console.log(`[Validation] Last Buy actual: "${lastBuyText}", expected: "${validation.lastBuy}"`);
                    expect(lastBuyText?.trim()).toBe(validation.lastBuy);
                }

                // Validate LBD column (should be null/dash for this scenario)
                if (validation.lbd === null) {
                    const lbdCell = page.locator(`[data-testid="signals-table-lbd-${symbol}"]`);
                    if (await lbdCell.count() > 0) {
                        const lbdText = await lbdCell.textContent();
                        console.log(`[Validation] LBD actual: "${lbdText}", expected: "-" (null)`);
                        expect(lbdText?.trim()).toBe('-');
                    }
                }

                console.log('✅ Scenario 2 validation completed successfully');
            });

        } catch (error) {
            await handleTestFailure(page, 'Scenario 2 - 5DD Hidden with Recent Buy', error);
        }
    });

    // Scenario 3: LBD with Multiple Buy Transactions
    test('Scenario 3: LBD uses most recent buy with multiple transactions', async ({ page }) => {
        test.setTimeout(120000); // 2 minutes timeout

        const scenario = testConfig.scenarios.find((s: any) => s.id === 'lbd_uses_most_recent_buy');
        console.log(`\n🚀 Starting Scenario 3: ${scenario.name}...`);

        try {
            // Phase 1: Create stock with test data
            await executeTestStep(page, 'Create Stock with Test Data', async () => {
                const stock = await createStockFromConfig(scenario.setup.stock);
                createdStockIds.push(stock.id);
                (scenario as any).createdStockId = stock.id;
            });

            // Phase 2: Add multiple buy transactions
            await executeTestStep(page, 'Add Multiple Buy Transactions', async () => {
                for (const transaction of scenario.setup.transactions) {
                    await createTransactionFromConfig((scenario as any).createdStockId, transaction);
                }
            });

            // Phase 3: Navigate to Signals page and validate LBD from most recent buy
            await executeTestStep(page, 'Validate Signals Table LBD', async () => {
                await navigateToSignalsPage(page);
                await page.waitForTimeout(3000); // Allow data to load

                const stockConfig = testConfig.testData.stocks[scenario.setup.stock];
                const symbol = stockConfig.symbol.toUpperCase();

                // Verify stock row exists
                const tickerCell = page.locator(`[data-testid="signals-table-ticker-${symbol}"]`);
                await expect(tickerCell).toBeVisible({ timeout: 10000 });
                console.log(`[Validation] Found ticker cell for ${symbol}`);

                // Validate LBD column - should show -28.57% from most recent buy
                const validation = scenario.validations.signalsTable;
                if (validation.lbd) {
                    // Since LBD doesn't have a testid, find it by position in the row
                    // LBD is typically the 5th column (after r-Inv, Available, Ticker, 5DD)
                    const stockRow = page.locator(`[data-testid="signals-table-row-${symbol}"]`);
                    const lbdCell = stockRow.locator('td').nth(4); // 0-indexed, so 4 = 5th column

                    const lbdText = await lbdCell.textContent();
                    console.log(`[Validation] LBD actual: "${lbdText}", expected: "${validation.lbd}"`);
                    expect(lbdText?.trim()).toBe(validation.lbd);
                }

                // Validate Last Buy column
                if (validation.lastBuy) {
                    const lastBuyCell = page.locator(`[data-testid="signals-table-last-buy-${symbol}"]`);
                    await expect(lastBuyCell).toBeVisible({ timeout: 10000 });

                    const lastBuyText = await lastBuyCell.textContent();
                    console.log(`[Validation] Last Buy actual: "${lastBuyText}", expected: "${validation.lastBuy}"`);
                    expect(lastBuyText?.trim()).toBe(validation.lastBuy);
                }

                console.log('✅ Signals Table LBD validation completed');
            });

            // Phase 4: Navigate to Wallets page and validate transaction LBD values
            await executeTestStep(page, 'Validate Wallets Transactions Table', async () => {
                await navigateToWalletsPage(page, (scenario as any).createdStockId);

                // Wait for transactions table to load
                const transactionsHeader = page.locator('[data-testid="wallets-transactions-section-header"]');
                await expect(transactionsHeader).toBeVisible({ timeout: 10000 });

                // Get all transaction rows
                const txnRows = page.locator('table').last().locator('tbody tr');
                const rowCount = await txnRows.count();

                console.log(`[Validation] Found ${rowCount} transaction rows`);

                // Validate we have the expected number of transactions
                const expectedCount = scenario.validations.walletsTransactionsTable.expectedTransactions;
                expect(rowCount).toBe(expectedCount);

                // Validate each transaction's LBD value
                // Transactions should appear in reverse chronological order (newest first)
                const expectedBuys = ['buy3', 'buy2', 'buy1']; // Order they should appear in table

                for (let i = 0; i < expectedBuys.length; i++) {
                    const buyKey = expectedBuys[i];
                    const expectedData = scenario.validations.walletsTransactionsTable[buyKey];
                    const row = txnRows.nth(i);

                    // Get price from row
                    const priceCell = row.locator('[data-testid="wallets-transaction-table-price-display"]');
                    const priceText = await priceCell.textContent();
                    console.log(`[Validation] Row ${i} - Price actual: "${priceText}", expected: "${expectedData.price}"`);
                    expect(priceText?.trim()).toBe(expectedData.price);

                    // Get LBD from row
                    const lbdCell = row.locator('[data-testid="wallets-transaction-table-lbd-display"]');
                    const lbdText = await lbdCell.textContent();
                    console.log(`[Validation] Row ${i} - LBD actual: "${lbdText}", expected: "${expectedData.lbd}"`);
                    expect(lbdText?.trim()).toBe(expectedData.lbd);

                    // Get signal from row
                    const signalCell = row.locator('[data-testid="wallets-transaction-table-signal-display"]');
                    const signalText = await signalCell.textContent();
                    console.log(`[Validation] Row ${i} - Signal actual: "${signalText}", expected: "${expectedData.signal}"`);
                    expect(signalText?.trim()).toBe(expectedData.signal);
                }

                console.log('✅ Wallets Transactions Table validation completed');
            });

        } catch (error) {
            await handleTestFailure(page, 'Scenario 3 - LBD with Multiple Buys', error);
        }
    });

    // Scenario 4: LBD Edge Case - Most recent buy doesn't meet threshold
    test('Scenario 4: LBD hidden when most recent buy doesn\'t meet threshold', async ({ page }) => {
        test.setTimeout(120000); // 2 minutes timeout

        const scenario = testConfig.scenarios.find((s: any) => s.id === 'lbd_hidden_when_threshold_not_met');
        console.log(`\n🚀 Starting Scenario 4: ${scenario.name}...`);

        try {
            // Phase 1: Create stock with test data (same as Scenario 3)
            await executeTestStep(page, 'Create Stock with Test Data', async () => {
                const stock = await createStockFromConfig(scenario.setup.stock);
                createdStockIds.push(stock.id);
                (scenario as any).createdStockId = stock.id;
            });

            // Phase 2: Add the first 3 buy transactions from Scenario 3
            await executeTestStep(page, 'Add Initial Buy Transactions', async () => {
                // Get the transactions from the referenced scenario
                const baseScenario = testConfig.scenarios.find((s: any) => s.id === scenario.dependsOn);
                for (const transaction of baseScenario.setup.transactions) {
                    await createTransactionFromConfig((scenario as any).createdStockId, transaction);
                }
            });

            // Phase 3: Add the 4th buy transaction that doesn't meet threshold
            await executeTestStep(page, 'Add 4th Buy Transaction (Edge Case)', async () => {
                const additionalTxn = scenario.setup.additionalTransactions[0];
                await createTransactionFromConfig((scenario as any).createdStockId, additionalTxn);
            });

            // Phase 4: Navigate to Signals page and validate LBD is now hidden
            await executeTestStep(page, 'Validate Signals Table - LBD Hidden', async () => {
                await navigateToSignalsPage(page);
                await page.waitForTimeout(3000); // Allow data to load

                const stockConfig = testConfig.testData.stocks[scenario.setup.stock];
                const symbol = stockConfig.symbol.toUpperCase();

                // Verify stock row exists
                const tickerCell = page.locator(`[data-testid="signals-table-ticker-${symbol}"]`);
                await expect(tickerCell).toBeVisible({ timeout: 10000 });
                console.log(`[Validation] Found ticker cell for ${symbol}`);

                // Validate LBD column - should be hidden (showing dash)
                const validation = scenario.validations.signalsTable;
                if (validation.lbd === null) {
                    // Find LBD cell by position in row
                    const stockRow = page.locator(`[data-testid="signals-table-row-${symbol}"]`);
                    const lbdCell = stockRow.locator('td').nth(4); // 0-indexed, so 4 = 5th column

                    const lbdText = await lbdCell.textContent();
                    console.log(`[Validation] LBD actual: "${lbdText}", expected: "-" (hidden - threshold not met)`);
                    expect(lbdText?.trim()).toBe('-');
                }

                // Validate Last Buy column - should show 1 d
                if (validation.lastBuy) {
                    const lastBuyCell = page.locator(`[data-testid="signals-table-last-buy-${symbol}"]`);
                    await expect(lastBuyCell).toBeVisible({ timeout: 10000 });

                    const lastBuyText = await lastBuyCell.textContent();
                    console.log(`[Validation] Last Buy actual: "${lastBuyText}", expected: "${validation.lastBuy}"`);
                    expect(lastBuyText?.trim()).toBe(validation.lastBuy);
                }

                console.log('✅ Signals Table validation completed - LBD correctly hidden');
            });

            // Phase 5: Navigate to Wallets page and validate the 4th transaction
            await executeTestStep(page, 'Validate 4th Transaction in Wallets Table', async () => {
                await navigateToWalletsPage(page, (scenario as any).createdStockId);

                // Wait for transactions table to load
                const transactionsHeader = page.locator('[data-testid="wallets-transactions-section-header"]');
                await expect(transactionsHeader).toBeVisible({ timeout: 10000 });

                // Get all transaction rows
                const txnRows = page.locator('table').last().locator('tbody tr');
                const rowCount = await txnRows.count();

                console.log(`[Validation] Found ${rowCount} transaction rows`);

                // Validate we have 4 transactions now
                const expectedCount = scenario.validations.walletsTransactionsTable.expectedTransactions;
                expect(rowCount).toBe(expectedCount);

                // Validate the newest transaction (buy4) which should be first
                const buy4Data = scenario.validations.walletsTransactionsTable.buy4;
                const firstRow = txnRows.nth(0);

                // Get price from row
                const priceCell = firstRow.locator('[data-testid="wallets-transaction-table-price-display"]');
                const priceText = await priceCell.textContent();
                console.log(`[Validation] Buy4 - Price actual: "${priceText}", expected: "${buy4Data.price}"`);
                expect(priceText?.trim()).toBe(buy4Data.price);

                // Get LBD from row
                const lbdCell = firstRow.locator('[data-testid="wallets-transaction-table-lbd-display"]');
                const lbdText = await lbdCell.textContent();
                console.log(`[Validation] Buy4 - LBD actual: "${lbdText}", expected: "${buy4Data.lbd}"`);
                expect(lbdText?.trim()).toBe(buy4Data.lbd);

                // Get signal from row
                const signalCell = firstRow.locator('[data-testid="wallets-transaction-table-signal-display"]');
                const signalText = await signalCell.textContent();
                console.log(`[Validation] Buy4 - Signal actual: "${signalText}", expected: "${buy4Data.signal}"`);
                expect(signalText?.trim()).toBe(buy4Data.signal);

                console.log('✅ Wallets Table validation completed - 4th transaction verified');
            });

        } catch (error) {
            await handleTestFailure(page, 'Scenario 4 - LBD Edge Case', error);
        }
    });

    // Scenario 5: Combined 5DD and LBD
    test('Scenario 5: Combined 5DD and LBD validation', async ({ page }) => {
        test.setTimeout(120000); // 2 minutes timeout

        const scenario = testConfig.scenarios.find((s: any) => s.id === 'combined_5dd_and_lbd');
        console.log(`\n🚀 Starting Scenario 5: ${scenario.name}...`);

        try {
            // Phase 1: Create stock with test data (reuse 5DD_TEST_STOCK with historical data)
            await executeTestStep(page, 'Create Stock with Test Data', async () => {
                const stock = await createStockFromConfig(scenario.setup.stock);
                createdStockIds.push(stock.id);
                (scenario as any).createdStockId = stock.id;
            });

            // Phase 2: Add buy transaction 7 days ago
            await executeTestStep(page, 'Add Buy Transaction (7 days ago)', async () => {
                const transaction = scenario.setup.transactions[0];
                await createTransactionFromConfig((scenario as any).createdStockId, transaction);
            });

            // Phase 3: Navigate to Signals page and validate both 5DD and LBD show
            await executeTestStep(page, 'Validate Combined 5DD and LBD Display', async () => {
                await navigateToSignalsPage(page);
                await page.waitForTimeout(3000); // Allow data to load

                const stockConfig = testConfig.testData.stocks[scenario.setup.stock];
                const symbol = stockConfig.symbol.toUpperCase();

                // Verify stock row exists
                const tickerCell = page.locator(`[data-testid="signals-table-ticker-${symbol}"]`);
                await expect(tickerCell).toBeVisible({ timeout: 10000 });
                console.log(`[Validation] Found ticker cell for ${symbol}`);

                const validation = scenario.validations.signalsTable;
                const stockRow = page.locator(`[data-testid="signals-table-row-${symbol}"]`);

                // Validate 5DD column - should show -7.41%
                if (validation['5dd']) {
                    const fiveDDCell = page.locator(`[data-testid="signals-table-5dd-${symbol}"]`);
                    await expect(fiveDDCell).toBeVisible({ timeout: 10000 });

                    const fiveDDText = await fiveDDCell.textContent();
                    console.log(`[Validation] 5DD actual: "${fiveDDText}", expected: "${validation['5dd']}"`);
                    expect(fiveDDText?.trim()).toBe(validation['5dd']);
                }

                // Validate LBD column - should show -5.26%
                if (validation.lbd) {
                    // Find LBD cell by position in row (5th column)
                    const lbdCell = stockRow.locator('td').nth(4);

                    const lbdText = await lbdCell.textContent();
                    console.log(`[Validation] LBD actual: "${lbdText}", expected: "${validation.lbd}"`);
                    expect(lbdText?.trim()).toBe(validation.lbd);
                }

                // Validate Last Buy column
                if (validation.lastBuy) {
                    const lastBuyCell = page.locator(`[data-testid="signals-table-last-buy-${symbol}"]`);
                    await expect(lastBuyCell).toBeVisible({ timeout: 10000 });

                    const lastBuyText = await lastBuyCell.textContent();
                    console.log(`[Validation] Last Buy actual: "${lastBuyText}", expected: "${validation.lastBuy}"`);
                    expect(lastBuyText?.trim()).toBe(validation.lastBuy);
                }

                console.log('✅ Combined 5DD and LBD validation completed successfully');
                console.log(`   Both signals display: 5DD=${validation['5dd']}, LBD=${validation.lbd}`);
            });

        } catch (error) {
            await handleTestFailure(page, 'Scenario 5 - Combined 5DD and LBD', error);
        }
    });
});