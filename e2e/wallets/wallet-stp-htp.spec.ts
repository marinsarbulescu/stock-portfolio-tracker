// e2e/wallets/wallet-stp-htp-new.spec.ts

// Comprehensive E2E test for STP and HTP validation with commission calculations
// Tests division method formula for both STP and HTP
// Validates Signals page and Wallets page across different price points

import { Amplify } from 'aws-amplify';
import { test, expect } from '@playwright/test';
import amplifyOutputs from '../../amplify_outputs.json';

import {
    createPortfolioStock,
    deletePortfolioStock,
    createTransaction,
    type PortfolioStockCreateData,
    type TransactionCreateData,
} from '../utils/dataHelpers';
import { E2E_TEST_USER_OWNER_ID, E2E_TEST_USERNAME } from '../utils/testCredentials';
import { clearBrowserState, loginUser, editTransactionByPrice } from '../utils/pageHelpers';
import { cleanupTestStocks } from '../utils/cleanupHelper';

// Configure Amplify
try {
    Amplify.configure(amplifyOutputs);
    console.log('[STP-HTP-New] Amplify configured successfully.');
} catch (error) {
    console.error('[STP-HTP-New] CRITICAL: Error configuring Amplify:', error);
}

// Load test configuration
const testConfig = require('./wallet-stp-htp.json');

// Set test timeout
test.setTimeout(180000); // 3 minutes for comprehensive validation

// Helper function to navigate to signals page
async function navigateToSignalsPage(page: any) {
    console.log('[NavigationHelper] Navigating to Signals page...');
    await page.goto('/signals');
    await expect(page.locator('[data-testid="signals-page-title"]')).toBeVisible({ timeout: 15000 });
    console.log('[NavigationHelper] Successfully navigated to Signals page.');
}

// Helper function to navigate to wallets page
async function navigateToWalletsPage(page: any, stockId: string) {
    console.log(`[NavigationHelper] Navigating to Wallets page for stock ${stockId}...`);
    await page.goto(`/wallets/${stockId}`);
    await page.waitForLoadState('networkidle');
    console.log('[NavigationHelper] Successfully navigated to Wallets page.');
}

// Helper function to create stock from config
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
        isHidden: false,
        archived: false
    };

    const createdStock = await createPortfolioStock(stockData);
    console.log(`[StockHelper] ✅ Stock ${stockConfig.symbol} created with ID: ${createdStock.id}`);
    console.log(`[StockHelper] Test price: $${stockConfig.testPrice}`);
    console.log(`[StockHelper] STP: ${stockConfig.stp}%, HTP: ${stockConfig.htp}%, Commission: ${stockConfig.stockCommission}%`);

    return createdStock;
}

// Helper function to create transaction via UI
async function createTransactionViaUI(page: any, transactionConfig: any) {
    console.log(`[TransactionHelper] Creating transaction via UI: ${transactionConfig.action} at $${transactionConfig.price}...`);

    // Click Add Transaction button
    const addButton = page.locator('[data-testid="add-transaction-button"]');
    await expect(addButton).toBeVisible({ timeout: 10000 });
    await addButton.click();

    // Wait for modal
    const modal = page.locator('[data-testid="transaction-form-modal"]');
    await expect(modal).toBeVisible({ timeout: 10000 });

    // Fill form fields
    await page.locator('[data-testid="txn-form-date"]').fill(transactionConfig.date);
    await page.locator('[data-testid="txn-form-price"]').fill(transactionConfig.price.toString());
    await page.locator('[data-testid="txn-form-investment"]').fill(transactionConfig.investment.toString());

    // Select transaction type
    const txnTypeRadio = page.locator(`[data-testid="txn-form-txnType-${transactionConfig.txnType.toLowerCase()}"]`);
    await expect(txnTypeRadio).toBeVisible({ timeout: 5000 });
    await txnTypeRadio.click();

    // Select signal
    await page.locator('[data-testid="txn-form-signal"]').selectOption(transactionConfig.signal);

    // Submit
    const submitButton = page.locator('[data-testid="txn-form-submit-button"]');
    await submitButton.click();
    await expect(modal).not.toBeVisible({ timeout: 15000 });

    console.log(`[TransactionHelper] ✅ Transaction created via UI: ${transactionConfig.action} $${transactionConfig.investment} at $${transactionConfig.price}`);
}

// Helper function to update test price from Wallets page
async function updateTestPrice(page: any, stockSymbol: string, newPrice: number, stockId: string) {
    console.log(`[PriceHelper] Updating test price for ${stockSymbol} to $${newPrice}...`);

    // Navigate to wallets page for this stock
    await navigateToWalletsPage(page, stockId);

    // Click the edit button in the wallets header
    const editButton = page.locator('[data-testid="wallet-page-title"]');
    await expect(editButton).toBeVisible({ timeout: 10000 });
    await editButton.click();

    // Wait for modal (PortfolioAddEditStockModal in edit mode)
    const modal = page.locator('[data-testid="portfolio-edit-stock-modal"]');
    await expect(modal).toBeVisible({ timeout: 10000 });

    // Update test price
    const testPriceInput = page.locator('[data-testid="portfolio-edit-stock-test-price"]');
    await testPriceInput.fill(newPrice.toString());

    // Submit
    const submitButton = page.locator('[data-testid="portfolio-edit-stock-submit-button"]');
    await submitButton.click();
    await expect(modal).not.toBeVisible({ timeout: 10000 });

    console.log(`[PriceHelper] ✅ Test price updated to $${newPrice}`);
}


// Helper function to verify color
async function verifyColor(page: any, element: any, expectedColor: string, fieldName: string) {
    const colorDefinitions = testConfig.colorDefinitions;
    const expectedRgb = colorDefinitions[expectedColor];

    const backgroundColor = await element.evaluate((el: Element) => {
        return window.getComputedStyle(el).backgroundColor;
    });

    const color = await element.evaluate((el: Element) => {
        return window.getComputedStyle(el).color;
    });

    console.log(`[ColorValidation] ${fieldName} - Expected: ${expectedColor} (${expectedRgb})`);
    console.log(`[ColorValidation] ${fieldName} - Actual BG: ${backgroundColor}, Color: ${color}`);

    const matchesBackground = backgroundColor.includes(expectedRgb);
    const matchesColor = color.includes(expectedRgb);

    expect(matchesBackground || matchesColor).toBe(true);
    console.log(`[ColorValidation] ✅ ${fieldName} has correct color: ${expectedColor}`);
}

// Helper function to verify wallets overview
async function verifyWalletsOverview(page: any, validations: any, stockSymbol: string) {
    console.log('[OverviewHelper] Verifying wallets overview...');

    // Expand overview if needed
    const overviewToggle = page.locator('[data-testid="overview-toggle"]');
    await expect(overviewToggle).toBeVisible({ timeout: 10000 });

    const isExpanded = await page.locator('[data-testid="overview-settings-stp"]').isVisible().catch(() => false);
    if (!isExpanded) {
        await overviewToggle.click();
        await page.waitForTimeout(500);
    }

    // Verify STP setting percentage
    const stpSetting = page.locator('[data-testid="overview-settings-stp"]');
    await expect(stpSetting).toHaveText(validations.stpSetting);
    console.log(`[OverviewHelper] ✅ STP Setting: ${validations.stpSetting}`);

    // Verify HTP setting percentage
    const htpSetting = page.locator('[data-testid="overview-settings-htp"]');
    await expect(htpSetting).toHaveText(validations.htpSetting);
    console.log(`[OverviewHelper] ✅ HTP Setting: ${validations.htpSetting}`);

    console.log(`[OverviewHelper] ✅ Overview validation completed`);
}

// Helper function to verify signals table
async function verifySignalsTable(page: any, validations: any, stockSymbol: string) {
    console.log('[SignalsHelper] Verifying signals table...');

    await navigateToSignalsPage(page);

    const stpCell = page.locator(`[data-testid="signals-table-percent-stp-${stockSymbol}"]`);
    await expect(stpCell).toHaveText(validations.percentToStp);
    console.log(`[SignalsHelper] ✅ %2STP: ${validations.percentToStp}`);

    const htpCell = page.locator(`[data-testid="signals-table-percent-htp-${stockSymbol}"]`);
    await expect(htpCell).toHaveText(validations.percentToHtp);
    console.log(`[SignalsHelper] ✅ %2HTP: ${validations.percentToHtp}`);

    // Verify colors
    await verifyColor(page, stpCell, validations.stpColor, '%2STP in Signals');
    await verifyColor(page, htpCell, validations.htpColor, '%2HTP in Signals');
}

// Helper function to verify wallet tabs
async function verifyWalletTabs(page: any, validations: any, stockId: string) {
    console.log('[WalletTabsHelper] Verifying wallet tabs...');

    await navigateToWalletsPage(page, stockId);

    // Verify Swing tab
    const swingTab = page.locator('[data-testid="wallet-tab-swing"]');
    await swingTab.click();
    await page.waitForTimeout(500);

    await verifyWalletTabValues(page, validations.swing, 'Swing');

    // Verify Hold tab
    const holdTab = page.locator('[data-testid="wallet-tab-hold"]');
    await holdTab.click();
    await page.waitForTimeout(500);

    await verifyWalletTabValues(page, validations.hold, 'Hold');
}

// Helper function to verify wallet tab values
async function verifyWalletTabValues(page: any, validations: any, tabName: string) {
    console.log(`[WalletTabHelper] Verifying ${tabName} tab values...`);

    const stpValue = page.locator('[data-testid="wallet-stpValue-display"]');
    await expect(stpValue).toHaveText(validations.stpValue);
    console.log(`[WalletTabHelper] ✅ ${tabName} STP Value: ${validations.stpValue}`);

    const percentToStp = page.locator('[data-testid="wallet-percentToStp-display"]');
    await expect(percentToStp).toHaveText(validations.percentToStp);
    console.log(`[WalletTabHelper] ✅ ${tabName} %2STP: ${validations.percentToStp}`);

    const htpValue = page.locator('[data-testid="wallet-htpValue-display"]');
    await expect(htpValue).toHaveText(validations.htpValue);
    console.log(`[WalletTabHelper] ✅ ${tabName} HTP Value: ${validations.htpValue}`);

    const percentToHtp = page.locator('[data-testid="wallet-htp-display"]');
    await expect(percentToHtp).toHaveText(validations.percentToHtp);
    console.log(`[WalletTabHelper] ✅ ${tabName} %2HTP: ${validations.percentToHtp}`);

    // Verify colors
    await verifyColor(page, stpValue, validations.stpValueColor, `${tabName} STP Value`);
    await verifyColor(page, percentToStp, validations.percentToStpColor, `${tabName} %2STP`);
    await verifyColor(page, htpValue, validations.htpValueColor, `${tabName} HTP Value`);
    await verifyColor(page, percentToHtp, validations.percentToHtpColor, `${tabName} %2HTP`);
}

// Test Suite
test.describe.configure({ mode: 'serial' });
test.describe('STP and HTP Commission Validation', () => {
    let createdStockIds: string[] = [];
    let stockMap: Map<string, any> = new Map();

    test.beforeAll(async () => {
        // Clean up any existing test stocks
        await cleanupTestStocks(testConfig.cleanupSymbols || []);
    });

    test.beforeEach(async ({ page }) => {
        await clearBrowserState(page);
        await loginUser(page, E2E_TEST_USERNAME);
    });

    test.afterAll(async () => {
        // Clean up all created stocks
        for (const stockId of createdStockIds) {
            try {
                await deletePortfolioStock(stockId);
                console.log(`[Cleanup] ✅ Deleted stock ${stockId}`);
            } catch (error) {
                console.error(`[Cleanup] ⚠️ Error deleting stock ${stockId}:`, error);
            }
        }
    });

    // Single combined test for all scenarios with price progression
    test('STP and HTP Commission Validation - Combined', async ({ page }) => {
        console.log('\n🧪 Running combined STP/HTP validation test');

        for (const scenario of testConfig.scenarios) {
            console.log(`\n📝 Scenario: ${scenario.name}`);
            console.log(`   Description: ${scenario.description}`);

            try {
                // Setup: Create stock
                let stock: any;
                const stockKey = scenario.setup.stock;

                // Create new stock
                stock = await createStockFromConfig(stockKey);
                createdStockIds.push(stock.id);
                stockMap.set(stockKey, stock);

                // Create initial transactions if provided
                if (scenario.setup.transactions) {
                    // Navigate to wallets page first
                    await navigateToWalletsPage(page, stock.id);

                    // Create transactions via UI
                    for (const txnConfig of scenario.setup.transactions) {
                        await createTransactionViaUI(page, txnConfig);
                    }

                    // Wait for wallets to be created
                    await page.waitForTimeout(2000);
                }

                // Update transactions if provided
                if (scenario.transactionUpdates) {
                    // Navigate to wallets page first
                    await navigateToWalletsPage(page, stock.id);

                    // Update transactions via UI
                    for (const updateConfig of scenario.transactionUpdates) {
                        console.log(`   📝 ${updateConfig.label}`);
                        await editTransactionByPrice(page, updateConfig.oldPrice, updateConfig.newPrice);
                    }

                    // Wait for updates to propagate
                    await page.waitForTimeout(2000);
                }

                // If this scenario has price progression, test each price point
                if (scenario.priceProgression) {
                    for (const priceStep of scenario.priceProgression) {
                        console.log(`\n   💰 Testing at ${priceStep.label}`);

                        // Update transactions if provided for this price step
                        if (priceStep.transactionUpdates) {
                            await navigateToWalletsPage(page, stock.id);
                            for (const updateConfig of priceStep.transactionUpdates) {
                                console.log(`   📝 ${updateConfig.label}`);
                                await editTransactionByPrice(page, updateConfig.oldPrice, updateConfig.newPrice);
                            }
                            await page.waitForTimeout(2000);
                        }

                        // Update price if not the first one (first one should already be set)
                        if (priceStep.price !== testConfig.testData.stocks[stockKey].testPrice) {
                            await updateTestPrice(page, stock.symbol, priceStep.price, stock.id);
                        }

                        // Run validations for this price point
                        const validations = priceStep.validations;

                        if (validations.walletsOverview) {
                            await navigateToWalletsPage(page, stock.id);
                            await verifyWalletsOverview(page, validations.walletsOverview, stock.symbol);
                        }

                        if (validations.signalsTable) {
                            await verifySignalsTable(page, validations.signalsTable, stock.symbol);
                        }

                        if (validations.walletTabs) {
                            await verifyWalletTabs(page, validations.walletTabs, stock.id);
                        }

                        console.log(`      ✅ Price point ${priceStep.label} validated`);
                    }
                } else {
                    // Old structure - single validation
                    const validations = scenario.validations;

                    if (validations.walletsOverview) {
                        await navigateToWalletsPage(page, stock.id);
                        await verifyWalletsOverview(page, validations.walletsOverview, stock.symbol);
                    }

                    if (validations.signalsTable) {
                        await verifySignalsTable(page, validations.signalsTable, stock.symbol);
                    }

                    if (validations.walletTabs) {
                        await verifyWalletTabs(page, validations.walletTabs, stock.id);
                    }
                }

                console.log(`   ✅ Scenario completed successfully`);

            } catch (error) {
                console.error(`   ❌ Scenario "${scenario.name}" failed:`, error);
                throw error;
            }
        }

        console.log('\n🎉 All scenarios completed successfully!\n');
    });
});
