import { type Page, expect } from '@playwright/test';
import { E2E_TEST_USERNAME, E2E_TEST_PASSWORD } from './testCredentials';
import type { PortfolioStockCreateData } from './dataHelpers';

// Define a more specific interface for buy transaction data, aligning with SingleStockLifecycleScenario fields
export interface BuyTransactionParams {
    date: string; // YYYY-MM-DD
    txnType: 'Swing' | 'Hold'; // For addBuy, Split might be handled by a different helper or logic
    signal?: string;
    price: number;
    investment: number;
    // transactionAction is implicitly 'Buy' for this helper
}

/**
 * Clears browser localStorage, sessionStorage, and cookies, then navigates to the root path.
 * This is useful for ensuring a clean state before a test, especially before login.
 * @param page - The Playwright Page object.
 */
export async function clearBrowserState(page: Page) {
    await page.goto('/'); // Establish origin before clearing storage
    console.log('[PageHelper] Cleared browser state: Navigated to root.');
    await page.evaluate(() => {
        window.localStorage.clear();
        window.sessionStorage.clear();
    });
    console.log('[PageHelper] Cleared browser state: localStorage and sessionStorage cleared.');
    await page.context().clearCookies();
    console.log('[PageHelper] Cleared browser state: Cookies cleared.');
    await page.goto('/'); // Navigate to root again to ensure a clean slate for the next action
    console.log('[PageHelper] Cleared browser state: Re-navigated to root.');
}

/**
 * Logs in the test user. Uses credentials from testCredentials.ts by default.
 * @param page - The Playwright Page object.
 * @param username - The username for login (defaults to E2E_TEST_USERNAME).
 * @param password - The password for login (defaults to E2E_TEST_PASSWORD).
 */
export async function loginUser(page: Page, username = E2E_TEST_USERNAME, password = E2E_TEST_PASSWORD) {
    console.log(`[PageHelper] Attempting login as ${username}...`);
    await page.locator('input[name="username"]').fill(username);
    await page.locator('input[name="password"]').fill(password);
    const cognitoResponsePromise = page.waitForResponse(
        response => response.url().includes('cognito-idp.') && response.status() === 200,
        { timeout: 15000 }
    );
    await page.locator('button[type="submit"]:has-text("Sign In")').click();
    try {
        await cognitoResponsePromise;
        await expect(page.locator('nav a:has-text("Portfolio")')).toBeVisible({ timeout: 15000 });
        console.log(`[PageHelper] Login successful for ${username}.`);
    } catch (error) {
        console.error(`[PageHelper] Login or post-login wait failed for ${username}:`, error);
        // Consider taking a screenshot for debugging
        await page.screenshot({ path: `e2e_login_error_helper_${Date.now()}.png`, fullPage: true });
        throw new Error(`Login failed for ${username} during helper execution.`);
    }
}

/**
 * Creates a stock via the UI by filling and submitting the Add Stock form.
 * This function navigates to the Portfolio page, opens the Add Stock modal, 
 * fills all required fields, and submits the form.
 * @param page - The Playwright Page object.
 * @param stockData - The stock data to use for form filling.
 */
export async function createStockViaUI(page: Page, stockData: PortfolioStockCreateData) {
    console.log(`[PageHelper] Creating stock ${stockData.symbol} via UI...`);
    console.log(`[PageHelper] DEBUG - marketCategory: ${stockData.marketCategory}`);
    console.log(`[PageHelper] DEBUG - riskGrowthProfile: ${stockData.riskGrowthProfile}`);
    
    // Navigate to portfolio first
    await page.goto('/portfolio');
    await expect(page.locator('[data-testid="portfolio-page-title"]')).toBeVisible({ timeout: 15000 });
    
    // Click add stock button using data-testid
    const addButton = page.locator('[data-testid="portfolio-page-add-stock-button"]');
    await expect(addButton).toBeVisible({ timeout: 10000 });
    await addButton.click();
    
    // Wait for symbol field to be visible (indicating modal is ready)
    const symbolField = page.locator('[data-testid="portfolio-add-stock-symbol"]');
    await expect(symbolField).toBeVisible({ timeout: 10000 });
    
    // Fill the form using data-testid selectors
    await page.locator('[data-testid="portfolio-add-stock-symbol"]').fill(stockData.symbol);
    await page.locator('[data-testid="portfolio-add-stock-name"]').fill(stockData.name || '');
    await page.locator('[data-testid="portfolio-add-stock-type"]').selectOption(stockData.stockType);
    await page.locator('[data-testid="portfolio-add-stock-region"]').selectOption(stockData.region);
    
    // Handle required marketCategory and riskGrowthProfile fields
    if (stockData.marketCategory) {
        const marketCategoryField = page.locator('[data-testid="portfolio-add-stock-market-category"]');
        await expect(marketCategoryField).toBeVisible();
        await marketCategoryField.selectOption(stockData.marketCategory);
        console.log(`[PageHelper] Selected marketCategory: ${stockData.marketCategory}`);
    }
    if (stockData.riskGrowthProfile) {
        const riskProfileField = page.locator('[data-testid="portfolio-add-stock-risk-growth-profile"]');
        await expect(riskProfileField).toBeVisible();
        await riskProfileField.selectOption(stockData.riskGrowthProfile);
        console.log(`[PageHelper] Selected riskGrowthProfile: ${stockData.riskGrowthProfile}`);
    }
    
    // Handle optional stockTrend field
    if (stockData.stockTrend) {
        await page.locator('[data-testid="portfolio-add-stock-trend"]').selectOption(stockData.stockTrend);
    }
    
    // Handle required STP field
    await page.locator('[data-testid="portfolio-add-stock-stp"]').fill((stockData.stp ?? 9).toString());
    
    // Fill other required fields
    await page.locator('[data-testid="portfolio-add-stock-pdp"]').fill((stockData.pdp ?? 3).toString());
    await page.locator('[data-testid="portfolio-add-stock-budget"]').fill((stockData.budget ?? 1000).toString());
    await page.locator('[data-testid="portfolio-add-stock-shr"]').fill((stockData.swingHoldRatio ?? 30).toString());
    await page.locator('[data-testid="portfolio-add-stock-commission"]').fill((stockData.stockCommission ?? 1).toString());
    
    // Handle optional HTP field
    if (stockData.htp !== undefined && stockData.htp !== null) {
        await page.locator('[data-testid="portfolio-add-stock-htp"]').fill(stockData.htp.toString());
    }
    
    // Handle optional testPrice field
    if (stockData.testPrice !== undefined && stockData.testPrice !== null) {
        await page.locator('[data-testid="portfolio-add-stock-test-price"]').fill(stockData.testPrice.toString());
    }
    
    // Submit the form
    const submitButton = page.locator('[data-testid="portfolio-add-stock-submit-button"]');
    await expect(submitButton).toBeVisible();
    await submitButton.click();
    
    // Wait for modal to close (indicating stock was created successfully)
    const modal = page.locator('[data-testid="portfolio-add-stock-modal"]');
    try {
        await expect(modal).not.toBeVisible({ timeout: 10000 });
        console.log(`[PageHelper] Modal closed successfully after stock creation.`);
    } catch (error) {
        console.log(`[PageHelper] Modal did not close - form submission may have failed.`);
        await page.screenshot({ path: `debug_modal_not_closed_${stockData.symbol}_${Date.now()}.png`, fullPage: true });
        throw error;
    }
    
    // Wait a moment for backend processing
    console.log(`[PageHelper] Waiting for backend processing and UI update...`);
    await page.waitForTimeout(3000);
    
    // Wait for the stock to appear in the portfolio table
    const stockSymbolUpper = stockData.symbol.toUpperCase();
    const stockInTable = page.locator(`[data-testid="portfolio-page-table-wallet-link-${stockSymbolUpper}"]`).first();
    console.log(`[PageHelper] Looking for stock with data-testid: portfolio-page-table-wallet-link-${stockSymbolUpper}`);
    
    try {
        await expect(stockInTable).toBeVisible({ timeout: 10000 });
        console.log(`[PageHelper] ✅ Stock ${stockData.symbol} created successfully.`);
    } catch (error) {
        console.log(`[PageHelper] Stock ${stockData.symbol} did not appear in table after creation.`);
        
        // Take a screenshot to see what's on the page
        await page.screenshot({ path: `debug_portfolio_page_${stockData.symbol}_${Date.now()}.png`, fullPage: true });
        
        // Check if there are any stocks in the table at all
        const anyStockRows = page.locator('[data-testid^="portfolio-page-table-name-"]');
        const stockCount = await anyStockRows.count();
        console.log(`[PageHelper] Found ${stockCount} stocks in the portfolio table.`);
        
        // List all the stocks that are visible with their data-testids
        for (let i = 0; i < stockCount; i++) {
            const stockRow = anyStockRows.nth(i);
            const stockText = await stockRow.textContent();
            const testId = await stockRow.getAttribute('data-testid');
            console.log(`[PageHelper] Stock ${i + 1}: ${testId} - "${stockText}"`);
        }
        
        // Check if stock exists in database
        try {
            const { getPortfolioStockBySymbol } = await import('./dataHelpers');
            const stockFromDb = await getPortfolioStockBySymbol(stockData.symbol);
            if (stockFromDb) {
                console.log(`[PageHelper] Stock ${stockData.symbol} was created in database but not visible in UI. Stock ID: ${stockFromDb.id}`);
            } else {
                console.log(`[PageHelper] Stock ${stockData.symbol} was NOT created in database.`);
            }
        } catch (dbError) {
            console.log(`[PageHelper] Error checking database for stock ${stockData.symbol}:`, dbError);
        }
        
        await page.screenshot({ path: `debug_stock_not_in_table_${stockData.symbol}_${Date.now()}.png`, fullPage: true });
        throw error;
    }
}

/**
 * Navigates to the stock-specific wallet page and verifies the page title.
 * @param page - The Playwright Page object.
 * @param stockId - The ID of the stock whose wallet page to navigate to.
 * @param stockSymbol - The symbol of the stock, used to verify the page title.
 */
export async function navigateToStockWalletPage(page: Page, stockId: string, stockSymbol: string) {
    if (!stockId) {
        throw new Error("[PageHelper] stockId is required to navigate to the wallet page.");
    }
    if (!stockSymbol) {
        throw new Error("[PageHelper] stockSymbol is required to verify the wallet page title.");
    }
    const walletPageUrl = `/wallets/${stockId}`;
    console.log(`[PageHelper] Navigating to wallet page: ${walletPageUrl} for stock ${stockSymbol}`);
    await page.goto(walletPageUrl);
    const titleElement = page.locator('[data-testid="wallet-page-title"]');
    await expect(titleElement).toBeVisible({ timeout: 15000 });
    await expect(titleElement).toContainText(stockSymbol.toUpperCase(), { timeout: 5000 });
    console.log(`[PageHelper] Successfully on wallet page for ${stockSymbol}.`);
}

/**
 * Adds a new Buy transaction from the stock's wallet page.
 * Assumes the page is already on or navigated to the specific stock's wallet page.
 * @param page - The Playwright Page object.
 * @param stockId - The ID of the stock for which to add the transaction.
 * @param buyData - An object containing the data for the buy transaction.
 */
export async function addBuyTransaction(page: Page, stockId: string, buyData: BuyTransactionParams) {
    console.log(`[PageHelper] Attempting to add BUY transaction for stock ID ${stockId}:`, buyData);

    const addNewTransactionButtonLocator = page.locator('[data-testid="add-transaction-button"]');
    await expect(addNewTransactionButtonLocator).toBeVisible({ timeout: 10000 });
    await addNewTransactionButtonLocator.click();
    console.log('[PageHelper] Clicked "Add New Transaction" button.');

    await page.waitForURL(`**/txns/${stockId}/add`, { timeout: 10000 });
    console.log('[PageHelper] Navigated to add transaction page.');
    await expect(page.locator('[data-testid="transaction-form-title"]')).toBeVisible({timeout: 5000});

    if (buyData.date) {
        await page.locator('[data-testid="transaction-form-date-input"]').fill(buyData.date);
        console.log(`[PageHelper] Filled date: ${buyData.date}`);
    }

    // Transaction Type (Swing/Hold)
    // The form might default to 'Swing' or require explicit selection.
    // This assumes radio buttons with data-testid like "transaction-form-type-swing"
    if (buyData.txnType === 'Swing' || buyData.txnType === 'Hold') {
        await page.locator(`[data-testid="transaction-form-type-${buyData.txnType.toLowerCase()}"]`).click();
        console.log(`[PageHelper] Selected transaction type: ${buyData.txnType}`);
    } else {
        // This case should ideally not be hit if CSV data is clean and helper is used correctly.
        console.warn(`[PageHelper] Invalid or missing txnType for Buy: '${buyData.txnType}'. Form defaults will apply if any.`);
    }
    
    if (buyData.signal) {
        await page.locator('[data-testid="transaction-form-signal-input"]').fill(buyData.signal);
        console.log(`[PageHelper] Filled signal: ${buyData.signal}`);
    }

    if (buyData.price !== undefined) {
        await page.locator('[data-testid="transaction-form-price-input"]').fill(buyData.price.toString());
        console.log(`[PageHelper] Filled price: ${buyData.price}`);
    }

    if (buyData.investment !== undefined) {
        await page.locator('[data-testid="transaction-form-investment-input"]').fill(buyData.investment.toString());
        console.log(`[PageHelper] Filled investment: ${buyData.investment}`);
    }
    
    const saveTransactionButtonLocator = page.locator('[data-testid="transaction-form-save-button"]');
    await expect(saveTransactionButtonLocator).toBeEnabled({ timeout: 5000 });
    await saveTransactionButtonLocator.click();
    console.log('[PageHelper] Clicked "Save Transaction" button.');

    await page.waitForURL(`**/wallets/${stockId}`, { timeout: 15000 });
    console.log(`[PageHelper] Successfully submitted transaction and returned to wallet page for stock ID ${stockId}.`);
}


/**
 * Clears all transaction data for a specific stock to ensure test isolation.
 * This function will navigate to the stock's wallet page and delete all transactions.
 * NOTE: This assumes that deleting transactions is straightforward and doesn't have complex dependencies
 * that would prevent deletion from the UI (e.g., sells linked to buys that must be deleted first in a specific order).
 * It also assumes a confirmation dialog for deletion which it will accept.
 * @param page - The Playwright Page object.
 * @param stockId - The ID of the stock to clear data for.
 * @param stockSymbol - The symbol of the stock (for navigation and logging).
 */
export async function clearStockData(page: Page, stockId: string, stockSymbol: string) {
    console.log(`[PageHelper] Starting to clear data for stock: ${stockSymbol} (ID: ${stockId})`);
    await navigateToStockWalletPage(page, stockId, stockSymbol);

    const transactionDeleteButtonSelector = '[data-testid^="transaction-delete-button-"]'; // Example: transaction-delete-button-TXN_ID

    // Loop to delete transactions as long as delete buttons are found
    // eslint-disable-next-line no-constant-condition
    while (true) {
        const deleteButtons = await page.locator(transactionDeleteButtonSelector).all();
        if (deleteButtons.length === 0) {
            console.log(`[PageHelper] No more transaction delete buttons found for ${stockSymbol}.`);
            break;
        }

        console.log(`[PageHelper] Found ${deleteButtons.length} transaction delete button(s) for ${stockSymbol}. Attempting to delete the first one.`);
        
        // Handle confirmation dialogs: Playwright can auto-accept simple dialogs
        // or you can explicitly handle them if they are custom modals.
        // For standard browser confirm dialogs:
        page.once('dialog', dialog => {
            console.log(`[PageHelper] Dialog message: "${dialog.message()}". Accepting.`);
            dialog.accept().catch(e => console.error("[PageHelper] Error accepting dialog:", e));
        });

        await deleteButtons[0].click();
        
        // Wait for a moment to allow the UI to update after deletion.
        // This might need to be a more specific wait, e.g., waiting for a success message or for the element to be removed.
        await page.waitForTimeout(1000); // Adjust timeout as necessary, or use a more robust wait
        console.log(`[PageHelper] Clicked a delete button for ${stockSymbol}. Checking for more...`);
    }

    // After deleting all transactions, verify that the transaction list is empty.
    // This selector would depend on how your application indicates an empty list.
    const emptyTransactionListIndicator = '[data-testid="empty-transactions-list"]'; // Example selector
    try {
        await expect(page.locator(emptyTransactionListIndicator)).toBeVisible({ timeout: 5000 });
        console.log(`[PageHelper] Successfully cleared all transactions for stock ${stockSymbol}. Empty list indicator is visible.`);
    } catch (error) {
        console.warn(`[PageHelper] Could not verify empty transaction list for ${stockSymbol}, or no such indicator exists. Proceeding.`);
        // You might want to take a screenshot here if verification fails
        await page.screenshot({ path: `e2e_clear_stock_data_verification_fail_${stockSymbol}_${Date.now()}.png`, fullPage: true });
    }
    console.log(`[PageHelper] Finished clearing data for stock: ${stockSymbol}`);
}

/**
 * Mocks the current stock price by intercepting GraphQL requests to 'getYfinanceData'.
 * This function sets up a route handler that will modify the response for a specific stock symbol.
 * @param page - The Playwright Page object.
 * @param stockSymbol - The stock symbol (e.g., "AAPL") whose price is to be mocked.
 * @param newPrice - The new price to be returned for the stock.
 */
export async function mockCurrentStockPrice(page: Page, stockSymbol: string, newPrice: number) {
    const graphqlEndpoint = '**/graphql'; // Common endpoint for GraphQL, adjust if different

    console.log(`[PageHelper] Setting up mock for ${stockSymbol} to price ${newPrice}`);

    // It's important to handle potential existing routes or to ensure this is called appropriately.
    // For simplicity, this example will add a new route. If called multiple times for different
    // symbols or prices, ensure page.unroute is used correctly if overwriting is not desired.
    await page.route(graphqlEndpoint, async (route, request) => {
        if (request.method() === 'POST') {
            const requestBody = request.postDataJSON();
            // Check if it's the query we're interested in (getYfinanceData for the specific symbol)
            if (requestBody.operationName === 'getYfinanceData' && requestBody.variables && requestBody.variables.symbol === stockSymbol) {
                console.log(`[PageHelper] Intercepted getYfinanceData for ${stockSymbol}. Responding with mocked price: ${newPrice}`);
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        data: {
                            getYfinanceData: {
                                price: newPrice.toString(),
                                __typename: 'YFinanceData' // Ensure typename matches if your GQL client expects it
                            }
                        }
                    })
                });
                return; // Stop processing this route handler
            }
        }
        // For any other request, or if the conditions are not met, continue as normal
        await route.continue();
    });
    console.log(`[PageHelper] Mock route set up for ${stockSymbol} at price ${newPrice}. Subsequent fetches for this symbol will use the mock.`);
}

/**
 * Updates the test price for a stock by opening the edit modal from the Wallets page
 * @param page - The Playwright Page object
 * @param stockSymbol - The stock symbol to update
 * @param newTestPrice - The new test price to set
 */
export async function updateStockTestPrice(page: Page, stockSymbol: string, newTestPrice: number) {
    console.log(`[PageHelper] Updating test price for ${stockSymbol} to $${newTestPrice}`);
    
    // Click on the stock symbol in the wallets header to open the edit modal
    const stockSymbolLink = page.locator('[data-testid="wallet-page-title"]');
    await expect(stockSymbolLink).toBeVisible({ timeout: 10000 });
    await stockSymbolLink.click();
    
    // Wait for test price field to be visible (instead of arbitrary timeout)
    const testPriceField = page.locator('#testPrice');
    await expect(testPriceField).toBeVisible({ timeout: 10000 });
    await testPriceField.clear();
    await testPriceField.fill(newTestPrice.toString());
    
    // Submit the form
    const submitButton = page.locator('button[type="submit"]:has-text("Update")');
    await expect(submitButton).toBeVisible({ timeout: 10000 });
    await submitButton.click();
    
    // Wait for modal to close by checking it's not visible
    const modal = page.locator('[role="dialog"], .modal, [data-testid*="modal"]').first();
    await expect(modal).not.toBeVisible({ timeout: 10000 });
    
    // Refresh the page to show the updated test price
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    console.log(`[PageHelper] Test price updated for ${stockSymbol} to $${newTestPrice} and page refreshed`);
}

/**
 * Verifies the current test price for a stock by checking the portfolio table
 * @param page - The Playwright Page object
 * @param stockSymbol - The stock symbol to verify
 * @param expectedPrice - The expected test price
 */
export async function verifyStockTestPrice(page: Page, stockSymbol: string, expectedPrice: number) {
    console.log(`[PageHelper] Verifying test price for ${stockSymbol} is $${expectedPrice}`);
    
    // Ensure we're on the wallets page and wait for it to load
    await page.waitForLoadState('networkidle');
    
    // Look for the price element using the test ID
    const priceElement = page.locator('[data-testid="wallets-header-price"]');
    await expect(priceElement).toBeVisible({ timeout: 10000 });
    
    // Format the expected price as currency
    const expectedFormattedPrice = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(expectedPrice);

    await expect(priceElement).toHaveText(expectedFormattedPrice);
    
    // Verify the price is displayed in purple (test price indicator)
    const priceColor = await priceElement.evaluate(el => getComputedStyle(el).color);
    console.log(`[PageHelper] Price color: ${priceColor}`);
    
    // Purple color should be rgb(159, 79, 150) which is #9f4f96
    // Note: Different browsers may report colors differently, so we check for purple-ish values
    const isPurple = priceColor.includes('159') || priceColor.includes('9f4f96') || priceColor.includes('purple');
    if (!isPurple) {
        console.warn(`[PageHelper] Warning: Price color ${priceColor} doesn't appear to be purple (test price indicator)`);
    }
    
    console.log(`[PageHelper] ✅ Test price verified: ${expectedFormattedPrice} (${isPurple ? 'purple' : 'not purple'})`);
}

/**
 * Refreshes the wallets page to ensure test price changes are reflected
 * @param page - The Playwright Page object
 * @param stockId - The stock ID
 * @param stockSymbol - The stock symbol
 */
export async function refreshWalletsPage(page: Page, stockId: string, stockSymbol: string) {
    console.log(`[PageHelper] Refreshing wallets page for ${stockSymbol}`);
    
    // Navigate to the wallets page
    await navigateToStockWalletPage(page, stockId, stockSymbol);
    
    // Wait for page to fully load using network idle instead of arbitrary timeout
    await page.waitForLoadState('networkidle');
    
    console.log(`[PageHelper] Wallets page refreshed for ${stockSymbol}`);
}

/**
 * Interface for parameters to update an existing Buy transaction.
 * All fields are optional.
 */
export interface UpdateBuyTransactionParams {
    date?: string; // YYYY-MM-DD
    txnType?: 'Swing' | 'Hold';
    signal?: string;
    price?: number;
    investment?: number;
    // Note: If quantity is derived from price and investment,
    // updating one or both of these should suffice.
    // If quantity is directly editable, add 'quantity?: number;'
}

/**
 * Updates an existing Buy transaction.
 * Assumes the page is already on or can be navigated to the specific stock's wallet page.
 * The transaction to be updated is identified by transactionId.
 * @param page - The Playwright Page object.
 * @param stockId - The ID of the stock to which the transaction belongs.
 * @param transactionId - The unique ID of the transaction to update.
 * @param updateData - An object containing the fields to update.
 */
export async function updateBuyTransaction(page: Page, stockId: string, transactionId: string, updateData: UpdateBuyTransactionParams) {
    console.log(`[PageHelper] Attempting to update Buy transaction ID ${transactionId} for stock ID ${stockId}:`, updateData);

    // Ensure we are on the wallet page, or navigate if needed (optional, depends on test structure)
    // For now, assumes the calling test manages navigation to the wallet page first.
    // Example: await navigateToStockWalletPage(page, stockId, 'SOME_SYMBOL'); // Symbol might be needed if that helper is used

    const editButtonLocator = page.locator(`[data-testid="transaction-edit-button-${transactionId}"]`);
    await expect(editButtonLocator).toBeVisible({ timeout: 10000 });
    await editButtonLocator.click();
    console.log(`[PageHelper] Clicked edit button for transaction ID ${transactionId}.`);

    // Wait for navigation to the edit form. Adjust URL pattern as needed.
    await page.waitForURL(`**/txns/${stockId}/edit/${transactionId}`, { timeout: 10000 });
    console.log('[PageHelper] Navigated to edit transaction page.');
    await expect(page.locator('[data-testid="transaction-form-title"]')).toBeVisible({timeout: 5000}); // Assuming same form title data-testid

    if (updateData.date !== undefined) {
        await page.locator('[data-testid="transaction-form-date-input"]').fill(updateData.date);
        console.log(`[PageHelper] Updated date to: ${updateData.date}`);
    }

    if (updateData.txnType !== undefined) {
        await page.locator(`[data-testid="transaction-form-type-${updateData.txnType.toLowerCase()}"]`).click();
        console.log(`[PageHelper] Updated transaction type to: ${updateData.txnType}`);
    }

    if (updateData.signal !== undefined) {
        await page.locator('[data-testid="transaction-form-signal-input"]').fill(updateData.signal);
        console.log(`[PageHelper] Updated signal to: ${updateData.signal}`);
    }

    if (updateData.price !== undefined) {
        await page.locator('[data-testid="transaction-form-price-input"]').fill(updateData.price.toString());
        console.log(`[PageHelper] Updated price to: ${updateData.price}`);
    }

    if (updateData.investment !== undefined) {
        await page.locator('[data-testid="transaction-form-investment-input"]').fill(updateData.investment.toString());
        console.log(`[PageHelper] Updated investment to: ${updateData.investment}`);
    }

    const saveTransactionButtonLocator = page.locator('[data-testid="transaction-form-save-button"]');
    await expect(saveTransactionButtonLocator).toBeEnabled({ timeout: 5000 });
    await saveTransactionButtonLocator.click();
    console.log('[PageHelper] Clicked "Save Transaction" button for update.');

    await page.waitForURL(`**/wallets/${stockId}`, { timeout: 15000 });
    console.log(`[PageHelper] Successfully updated transaction ID ${transactionId} and returned to wallet page for stock ID ${stockId}.`);
}

/**
 * Interface for parameters to create a new Sell transaction.
 */
export interface SellTransactionParams {
    date: string; // YYYY-MM-DD
    txnType: 'Swing' | 'Hold'; // Sell is typically against a prior Buy's type
    signal?: string;
    price: number;
    quantity: number; // For sell, quantity is usually directly specified
    // transactionAction is implicitly 'Sell' for this helper
}

/**
 * Creates a new Sell transaction from the stock's wallet page.
 * This function assumes that there are existing buy transactions to sell against.
 * The specific buy transaction to link the sell to might be automatically determined by the backend
 * or might need to be selected if the UI provides such an option (not handled here).
 * @param page - The Playwright Page object.
 * @param stockId - The ID of the stock for which to add the sell transaction.
 * @param sellData - An object containing the data for the sell transaction.
 */
export async function createSellTransactionFromWallet(page: Page, stockId: string, sellData: SellTransactionParams) {
    console.log(`[PageHelper] Attempting to add SELL transaction for stock ID ${stockId}:`, sellData);

    // Ensure we are on the wallet page, or navigate if needed
    // await navigateToStockWalletPage(page, stockId, 'SOME_SYMBOL'); // Symbol might be needed

    const addNewTransactionButtonLocator = page.locator('[data-testid="add-new-transaction-button"]');
    await expect(addNewTransactionButtonLocator).toBeVisible({ timeout: 10000 });
    await addNewTransactionButtonLocator.click();
    console.log('[PageHelper] Clicked "Add New Transaction" button for sell.');

    await page.waitForURL(`**/txns/${stockId}/add`, { timeout: 10000 });
    console.log('[PageHelper] Navigated to add transaction page for sell.');
    await expect(page.locator('[data-testid="transaction-form-title"]')).toBeVisible({timeout: 5000});

    // Select the 'Sell' tab/option in the form
    // This assumes a radio button or tab with a specific data-testid
    await page.locator('[data-testid="transaction-form-action-sell"]').click(); // Example selector
    console.log('[PageHelper] Selected "Sell" transaction action.');

    if (sellData.date) {
        await page.locator('[data-testid="transaction-form-date-input"]').fill(sellData.date);
        console.log(`[PageHelper] Filled sell date: ${sellData.date}`);
    }

    // Transaction Type (Swing/Hold) - for sell, this usually aligns with the buy being sold
    if (sellData.txnType === 'Swing' || sellData.txnType === 'Hold') {
        await page.locator(`[data-testid="transaction-form-type-${sellData.txnType.toLowerCase()}"]`).click();
        console.log(`[PageHelper] Selected sell transaction type: ${sellData.txnType}`);
    }

    if (sellData.signal) {
        await page.locator('[data-testid="transaction-form-signal-input"]').fill(sellData.signal);
        console.log(`[PageHelper] Filled sell signal: ${sellData.signal}`);
    }

    if (sellData.price !== undefined) {
        await page.locator('[data-testid="transaction-form-price-input"]').fill(sellData.price.toString());
        console.log(`[PageHelper] Filled sell price: ${sellData.price}`);
    }

    if (sellData.quantity !== undefined) {
        // For sell, the field might be named 'quantity' or 'shares'
        await page.locator('[data-testid="transaction-form-quantity-input"]').fill(sellData.quantity.toString()); // Example selector
        console.log(`[PageHelper] Filled sell quantity: ${sellData.quantity}`);
    }
    
    const saveTransactionButtonLocator = page.locator('[data-testid="transaction-form-save-button"]');
    await expect(saveTransactionButtonLocator).toBeEnabled({ timeout: 5000 });
    await saveTransactionButtonLocator.click();
    console.log('[PageHelper] Clicked "Save Transaction" button for sell.');

    await page.waitForURL(`**/wallets/${stockId}`, { timeout: 15000 });
    console.log(`[PageHelper] Successfully submitted SELL transaction and returned to wallet page for stock ID ${stockId}.`);
}


/**
 * Interface for parameters to update an existing Sell transaction.
 * All fields are optional.
 */
export interface UpdateSellTransactionParams {
    date?: string; // YYYY-MM-DD
    txnType?: 'Swing' | 'Hold';
    signal?: string;
    price?: number;
    quantity?: number;
}

/**
 * Updates an existing Sell transaction.
 * Assumes the page is already on or can be navigated to the specific stock's wallet page.
 * The transaction to be updated is identified by transactionId.
 * @param page - The Playwright Page object.
 * @param stockId - The ID of the stock to which the transaction belongs.
 * @param transactionId - The unique ID of the transaction to update.
 * @param updateData - An object containing the fields to update.
 */
export async function updateSellTransaction(page: Page, stockId: string, transactionId: string, updateData: UpdateSellTransactionParams) {
    console.log(`[PageHelper] Attempting to update Sell transaction ID ${transactionId} for stock ID ${stockId}:`, updateData);

    const editButtonLocator = page.locator(`[data-testid="transaction-edit-button-${transactionId}"]`);
    await expect(editButtonLocator).toBeVisible({ timeout: 10000 });
    await editButtonLocator.click();
    console.log(`[PageHelper] Clicked edit button for sell transaction ID ${transactionId}.`);

    await page.waitForURL(`**/txns/${stockId}/edit/${transactionId}`, { timeout: 10000 });
    console.log('[PageHelper] Navigated to edit transaction page for sell.');
    await expect(page.locator('[data-testid="transaction-form-title"]')).toBeVisible({timeout: 5000});
    // Ensure the form is in 'Sell' mode if it's a shared form. 
    // If 'Buy'/'Sell' is determined by the transaction being edited, this might not be needed.
    // await expect(page.locator('[data-testid="transaction-form-action-sell"]')).toBeChecked(); // or .toHaveClass(/active/)

    if (updateData.date !== undefined) {
        await page.locator('[data-testid="transaction-form-date-input"]').fill(updateData.date);
        console.log(`[PageHelper] Updated sell date to: ${updateData.date}`);
    }

    if (updateData.txnType !== undefined) {
        await page.locator(`[data-testid="transaction-form-type-${updateData.txnType.toLowerCase()}"]`).click();
        console.log(`[PageHelper] Updated sell transaction type to: ${updateData.txnType}`);
    }

    if (updateData.signal !== undefined) {
        await page.locator('[data-testid="transaction-form-signal-input"]').fill(updateData.signal);
        console.log(`[PageHelper] Updated sell signal to: ${updateData.signal}`);
    }

    if (updateData.price !== undefined) {
        await page.locator('[data-testid="transaction-form-price-input"]').fill(updateData.price.toString());
        console.log(`[PageHelper] Updated sell price to: ${updateData.price}`);
    }

    if (updateData.quantity !== undefined) {
        await page.locator('[data-testid="transaction-form-quantity-input"]').fill(updateData.quantity.toString());
        console.log(`[PageHelper] Updated sell quantity to: ${updateData.quantity}`);
    }

    const saveTransactionButtonLocator = page.locator('[data-testid="transaction-form-save-button"]');
    await expect(saveTransactionButtonLocator).toBeEnabled({ timeout: 5000 });
    await saveTransactionButtonLocator.click();
    console.log('[PageHelper] Clicked "Save Transaction" button for sell update.');

    await page.waitForURL(`**/wallets/${stockId}`, { timeout: 15000 });
    console.log(`[PageHelper] Successfully updated SELL transaction ID ${transactionId} and returned to wallet page for stock ID ${stockId}.`);
}


/**
 * Deletes a transaction (either Buy or Sell) from the stock's wallet page.
 * COMMENTED OUT - Replaced by simpler deleteTransaction function below
 */
// export async function deleteTransaction(page: Page, stockId: string, transactionId: string, stockSymbol: string) {
//     console.log(`[PageHelper] Attempting to delete transaction ID ${transactionId} for stock ${stockSymbol} (ID: ${stockId})`);
//     const deleteButtonLocator = page.locator(`[data-testid="transaction-delete-button-${transactionId}"]`);
//     await expect(deleteButtonLocator).toBeVisible({ timeout: 10000 });
//     page.once('dialog', async dialog => {
//         console.log(`[PageHelper] Dialog message for delete: "${dialog.message()}". Accepting.`);
//         await dialog.accept();
//     });
//     await deleteButtonLocator.click();
//     console.log(`[PageHelper] Clicked delete button for transaction ID ${transactionId}.`);
//     await page.waitForTimeout(1500);
//     await expect(deleteButtonLocator).not.toBeVisible({ timeout: 5000 });
//     console.log(`[PageHelper] Transaction ID ${transactionId} successfully deleted for stock ${stockSymbol}.`);
// }


/**
 * Interface for the financial overview statistics of a stock.
 */
export interface StockOverviewStats {
    realizedPLSwing: number | null;
    unrealizedPLSwing: number | null;
    totalPLSwing: number | null;
    realizedPLHold: number | null;
    unrealizedPLHold: number | null;
    totalPLHold: number | null;
    realizedPLStock: number | null; // Overall for the stock
    unrealizedPLStock: number | null; // Overall for the stock
    totalPLStock: number | null; // Overall for the stock
}

// Helper function to parse currency strings (e.g., \\"$1,234.56\\", \\"($500.00)\\", \\"-\\", \\"N/A\\") to numbers
export function parseCurrency(value: string | null): number | null {
    if (value === null || value.trim() === '' || value.trim().toLowerCase() === 'n/a' || value.trim() === '-') {
        return null;
    }
    const isNegative = value.includes('(') && value.includes(')');
    // Remove $, ,, whitespace, (, )
    const numericString = value.replace(/[$,\\s()]/g, '');
    const number = parseFloat(numericString);

    if (isNaN(number)) {
        console.warn(`[PageHelper] Could not parse currency value after cleaning: '${value}' (cleaned: '${numericString}')`);
        return null;
    }
    return isNegative ? -number : number;
}

/**
 * Retrieves the financial overview statistics (Realized P/L, Unrealized P/L, Total P/L)
 * for Swing, Hold, and overall Stock categories from the stock's wallet page.
 * @param page - The Playwright Page object.
 * @param stockId - The ID of the stock.
 * @param stockSymbol - The symbol of the stock (used for navigation and logging).
 * @returns An object of type StockOverviewStats containing the parsed P/L values.
 */
export async function getStockOverviewStats(page: Page, stockId: string, stockSymbol: string): Promise<StockOverviewStats> {
    console.log(`[PageHelper] Attempting to retrieve stock overview stats for ${stockSymbol} (ID: ${stockId})`);
    await navigateToStockWalletPage(page, stockId, stockSymbol); // Ensure we are on the correct page

    const getStatValue = async (dataTestId: string): Promise<number | null> => {
        try {
            const locator = page.locator(`[data-testid="${dataTestId}"]`);
            // Wait for the element to be attached and potentially visible, but don't fail if it's legitimately not rendered (e.g. N/A)
            await locator.waitFor({ state: 'attached', timeout: 7000 }); 
            const textContent = await locator.textContent();
            return parseCurrency(textContent);
        } catch (error) {
            // This can happen if a section (e.g. Swing) has no data and thus its stat elements aren'rendered.
            console.log(`[PageHelper] Stat element with data-testid '${dataTestId}' not found or text not extractable. Assuming null.`);
            // await page.screenshot({ path: `e2e_get_stat_error_${dataTestId.replace(/-/g, '\_')}_${Date.now()}.png` });
            return null;
        }
    };

    const stats: StockOverviewStats = {
        realizedPLSwing: await getStatValue('financial-overview-realized-pl-swing'),
        unrealizedPLSwing: await getStatValue('financial-overview-unrealized-pl-swing'),
        totalPLSwing: await getStatValue('financial-overview-total-pl-swing'),

        realizedPLHold: await getStatValue('financial-overview-realized-pl-hold'),
        unrealizedPLHold: await getStatValue('financial-overview-unrealized-pl-hold'),
        totalPLHold: await getStatValue('financial-overview-total-pl-hold'),

        realizedPLStock: await getStatValue('financial-overview-realized-pl-stock'),
        unrealizedPLStock: await getStatValue('financial-overview-unrealized-pl-stock'),
        totalPLStock: await getStatValue('financial-overview-total-pl-stock'),
    };

    console.log(`[PageHelper] Retrieved stock overview stats for ${stockSymbol}:`, stats);
    return stats;
}


/**
 * Interface for the details of a single "TP Wallet" (an individual buy lot/wallet).
 */
export interface WalletEntryDetails {
    id: string; // The wallet's own ID (e.g., from data-testid="wallet-row-WALLET_ID")
    buyPrice: number | null;
    totalInvestment: number | null;
    tpValue: number | null; // Target Price Value
    sellTxnCount: number | null;
    sharesSold: number | null;
    realizedPl: number | null;
    realizedPlPercent: number | null; // As a percentage, e.g., 10.5 for 10.5%
    remainingShares: number | null;
    walletType: 'Swing' | 'Hold' | string | null; // Added walletType
}

/**
 * Retrieves the details for all "TP Wallets" (individual buy lots) listed on the stock's wallet page.
 * It assumes that each wallet entry is identifiable and its data points have specific data-testid attributes.
 * @param page - The Playwright Page object.
 * @param stockId - The ID of the stock (for navigation/verification).
 * @param stockSymbol - The symbol of the stock (for navigation/logging).
 * @returns A Promise that resolves to an array of WalletEntryDetails objects.
 */
export async function getWalletDetails(page: Page, stockId: string, stockSymbol: string): Promise<WalletEntryDetails[]> {
    console.log(`[PageHelper] Attempting to retrieve all wallet entry details for ${stockSymbol} (ID: ${stockId})`);
    await navigateToStockWalletPage(page, stockId, stockSymbol); // Ensure we are on the correct page

    const walletEntries: WalletEntryDetails[] = [];
    // Assuming each wallet row has a data-testid like "wallet-row-{wallet.id}"
    // This selector needs to be confirmed from the actual implementation in page.tsx
    const walletRowLocator = page.locator('[data-testid^="wallet-row-"]');
    const count = await walletRowLocator.count();
    console.log(`[PageHelper] Found ${count} wallet rows.`);

    for (let i = 0; i < count; i++) {
        const row = walletRowLocator.nth(i);
        const fullId = await row.getAttribute('data-testid');
        const walletSystemId = fullId?.replace('wallet-row-', '') || `unknown-id-${i}`;

        // Helper to get text and parse, assuming data-testid attributes within each row
        // e.g., data-testid="wallet-buyPrice-{wallet.id}"
        const getCellText = async (colName: string): Promise<string | null> => {
            try {
                // Adjusted to look for a more generic cell data-testid pattern first, then specific
                // This pattern data-testid=`wallet-cell-${columnKey}-${walletSystemId}` is an assumption
                let cellLocator = row.locator(`[data-testid="wallet-cell-${colName.toLowerCase()}-${walletSystemId}"]`);
                if (await cellLocator.count() === 0) {
                    // Fallback to a simpler pattern if the above is not found - this also needs to be verified
                    // e.g. wallet-buyPrice, wallet-totalInvestment inside the row
                    cellLocator = row.locator(`[data-testid="wallet-${colName}"]`);
                }
                if (await cellLocator.count() > 0) {
                    return await cellLocator.first().textContent();
                }
                console.warn(`[PageHelper] Cell for ${colName} in wallet ${walletSystemId} not found with tested patterns.`);
                return null;
            } catch (e) {
                console.warn(`[PageHelper] Error getting cell text for ${colName} in wallet ${walletSystemId}:`, e);
                return null;
            }
        };

        const parseNumeric = (text: string | null): number | null => {
            if (text === null) return null;
            // Handles numbers like "10", "10.5", but not currency. For currency, use parseCurrency.
            const num = parseFloat(text.replace(/[^\\d.-]/g, '')); // Keep decimal and minus sign
            return isNaN(num) ? null : num;
        };

        const walletTypeRaw = await getCellText('walletType');

        walletEntries.push({
            id: walletSystemId,
            buyPrice: parseCurrency(await getCellText('buyPrice')),
            totalInvestment: parseCurrency(await getCellText('totalInvestment')),
            tpValue: parseCurrency(await getCellText('tpValue')),
            sellTxnCount: parseNumeric(await getCellText('sellTxnCount')),
            sharesSold: parseNumeric(await getCellText('sharesSold')),
            realizedPl: parseCurrency(await getCellText('realizedPl')),
            realizedPlPercent: parseNumeric(await getCellText('realizedPlPercent')), // Assuming this is just a number like 10.5
            remainingShares: parseNumeric(await getCellText('remainingShares')),
            walletType: walletTypeRaw === 'Swing' || walletTypeRaw === 'Hold' ? walletTypeRaw : walletTypeRaw, // Basic validation
        });
    }

    console.log(`[PageHelper] Retrieved details for ${walletEntries.length} wallet entries for ${stockSymbol}.`);
    return walletEntries;
}

// --- Helper to parse numeric string like "123.45%" or "1,234" or "-" to a number or null ---
export const parseNumeric = (text: string | null): number | null => {
    if (text === null || text.trim() === '' || text.trim() === '-') {
        return null;
    }
    // Remove %, ,, and any whitespace
    const numericString = text.replace(/[%,$,\\s]/g, '');
    const number = parseFloat(numericString);

    if (isNaN(number)) {
        console.warn(`[PageHelper] Could not parse numeric value after cleaning: '${text}' (cleaned: '${numericString}')`);
        return null;
    }
    return number;
};

export interface TransactionRowDetails {
  date: string | null; // Expected format "MM/DD/YYYY"
  action: 'Buy' | 'Sell' | 'Div' | null;
  type: 'Swing' | 'Hold' | string | null; // string for other types if any, or null
  signal: string | null;
  price: number | null;
  investment: number | null; // For Buy/Div; '-' for Sell
  proceeds: number | null;   // For Sell; '-' for Buy/Div
  quantity: number | null;
  pl: number | null;         // For Sell; '-' for Buy/Div
  plPercent: number | null;  // For Sell; '-' for Buy/Div
  walletId: string | null;   // For Sell (potentially truncated); '-' for Buy/Div
}

export async function getTransactionDetails(page: Page): Promise<TransactionRowDetails[]> {
  const requiredColumnKeys = [
    'date', 'action', 'txnType', 'signal', 'price',
    'investment', 'quantity', 'proceeds', 'txnProfit',
    'txnProfitPercent', 'completedTxnId'
  ];

  for (const key of requiredColumnKeys) {
    const checkbox = page.locator(`[data-testid="toggle-txn-col-${key}"]`);
    // Check if the checkbox locator finds an element and if it's visible
    if (await checkbox.count() > 0 && await checkbox.isVisible()) {
        if (!(await checkbox.isChecked())) {
            await checkbox.click();
        }
    } else {
        // It's possible a column doesn't have a toggle or the testid is wrong
        // For now, we'll log a warning if a toggle isn't found, but proceed.
        // Depending on strictness, this could throw an error.
        console.warn(`[getTransactionDetails] Toggle checkbox for column "${key}" not found or not visible.`);
    }
  }
  
  await page.waitForTimeout(250); // Wait for DOM updates after toggling

  const transactionRows = await page.locator('[data-testid="transaction-row"]').all();
  const detailsArray: TransactionRowDetails[] = [];

  if (transactionRows.length === 0) {
    const noTxnMessage = page.locator('[data-testid="no-transactions-message"]');
    if (await noTxnMessage.count() > 0 && await noTxnMessage.isVisible()) {
      return []; 
    }
    return []; 
  }

  for (const row of transactionRows) {
    const getCellTextContent = async (testId: string): Promise<string | null> => {
      const cell = row.locator(`[data-testid="${testId}"]`);
      if (await cell.count() > 0 && await cell.isVisible()) {
        return await cell.textContent();
      }
      return null; 
    };

    const dateText = await getCellTextContent('transaction-date-display');
    const actionText = await getCellTextContent('transaction-action-display');
    const typeText = await getCellTextContent('transaction-txnType-display');
    const signalText = await getCellTextContent('transaction-signal-display');
    const priceText = await getCellTextContent('transaction-price-display');
    const investmentText = await getCellTextContent('transaction-investment-display');
    const quantityText = await getCellTextContent('transaction-quantity-display');
    const proceedsText = await getCellTextContent('transaction-proceeds-display');
    const plText = await getCellTextContent('transaction-txnProfit-display');
    const plPercentText = await getCellTextContent('transaction-txnProfitPercent-display');
    const walletIdText = await getCellTextContent('transaction-completedTxnId-display');

    const details: TransactionRowDetails = {
      date: dateText,
      action: (actionText === 'Buy' || actionText === 'Sell' || actionText === 'Div') ? actionText : null,
      type: (typeText === '-' || typeText === null) ? null : typeText as 'Swing' | 'Hold' | string,
      signal: (signalText === '-' || signalText === null) ? null : signalText,
      price: parseCurrency(priceText),
      investment: parseCurrency(investmentText),
      quantity: parseNumeric(quantityText),
      proceeds: parseCurrency(proceedsText),
      pl: parseCurrency(plText),
      plPercent: parseNumeric(plPercentText),
      walletId: (walletIdText === '-' || walletIdText === null) ? null : walletIdText,
    };
    detailsArray.push(details);
  }

  return detailsArray;
}

/**
 * Placeholder for a logout function.
 * @param page - The Playwright Page object.
 */
/**
 * Generic navigation helper for any page in the application
 * Provides consistent navigation patterns with error handling
 *
 * @param page - The Playwright Page object
 * @param targetPath - The path to navigate to (e.g., '/portfolio', '/signals')
 * @param options - Optional configuration
 */
export async function navigateToPage(
    page: Page,
    targetPath: string,
    options: {
        timeout?: number;
        waitForLoad?: boolean;
        expectedTitle?: string;
        expectedTitleTestId?: string;
    } = {}
): Promise<void> {
    const {
        timeout = 15000,
        waitForLoad = true,
        expectedTitle,
        expectedTitleTestId
    } = options;

    console.log(`[PageHelper] Navigating to ${targetPath}...`);

    try {
        await page.goto(targetPath, { timeout });

        if (waitForLoad) {
            await page.waitForLoadState('networkidle', { timeout });
        }

        // Optional: Verify we're on the expected page
        if (expectedTitle && expectedTitleTestId) {
            const titleElement = page.locator(`[data-testid="${expectedTitleTestId}"]`);
            await expect(titleElement).toBeVisible({ timeout });
            await expect(titleElement).toHaveText(expectedTitle);
        }

        console.log(`[PageHelper] ✅ Successfully navigated to ${targetPath}`);
    } catch (error) {
        console.error(`[PageHelper] ❌ Failed to navigate to ${targetPath}:`, error);
        throw new Error(`Navigation to ${targetPath} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Navigation helper specifically for Portfolio page
 * Uses the nav link pattern commonly used across tests
 *
 * @param page - The Playwright Page object
 * @param options - Optional configuration
 */
export async function navigateToPortfolioViaNav(
    page: Page,
    options: {
        timeout?: number;
    } = {}
): Promise<void> {
    const { timeout = 15000 } = options;

    console.log(`[PageHelper] Navigating to Portfolio via navigation link...`);

    try {
        await page.goto('/');

        const portfolioLink = page.locator('[data-testid="nav-portfolio-link"]');
        await expect(portfolioLink).toBeVisible({ timeout });
        await portfolioLink.click();

        // Wait for Portfolio page to load
        const pageTitle = page.locator('[data-testid="portfolio-page-title"]');
        await expect(pageTitle).toBeVisible({ timeout });
        await expect(pageTitle).toHaveText('Portfolio');

        console.log(`[PageHelper] ✅ Successfully navigated to Portfolio page`);
    } catch (error) {
        console.error(`[PageHelper] ❌ Failed to navigate to Portfolio page:`, error);
        throw new Error(`Navigation to Portfolio page failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export async function logoutUser(page: Page) {
    // This is a placeholder. Actual implementation will depend on your app's logout mechanism.
    // Example:
    // await page.locator('[data-testid="sign-out-button"]').click(); // Or whatever your sign out button is
    // await expect(page.locator('input[name="username"]')).toBeVisible({ timeout: 10000 }); // Expect to be back on login page
    console.warn('[PageHelper] logoutUser function called, but it is a placeholder. Implement if needed.');
}

// Transaction helper interfaces and functions
export interface TransactionData {
    date?: string; // YYYY-MM-DD format, defaults to today if not provided
    type: 'Split' | 'Swing' | 'Hold';
    signal: string;
    price: number;
    investment: number;
}

/**
 * Adds a transaction via the UI modal.
 * This function assumes the page is already on the wallet page for the stock.
 * @param page - The Playwright Page object.
 * @param transactionData - The transaction data to fill in the form.
 */
export async function addTransaction(page: Page, transactionData: TransactionData) {
    console.log(`[PageHelper] Adding ${transactionData.type} transaction:`, transactionData);
    
    // Open Add Transaction modal
    const addTransactionButton = page.locator('[data-testid="add-transaction-button"]');
    await expect(addTransactionButton).toBeVisible({ timeout: 10000 });
    await addTransactionButton.click();
    
    const transactionModal = page.locator('[data-testid="transaction-form-modal"]');
    await expect(transactionModal).toBeVisible({ timeout: 10000 });
    console.log(`[PageHelper] Add Transaction modal opened.`);
    
    // Fill transaction form
    const date = transactionData.date || new Date().toISOString().split('T')[0]; // Default to today
    await page.locator('[data-testid="txn-form-date"]').fill(date);
    await page.locator('[data-testid="txn-form-price"]').fill(transactionData.price.toString());
    await page.locator('[data-testid="txn-form-investment"]').fill(transactionData.investment.toString());
    
    // Select transaction type using radio buttons
    console.log(`[PageHelper] Selecting transaction type: ${transactionData.type}`);
    if (transactionData.type === 'Swing') {
        const swingRadio = page.locator('[data-testid="txn-form-txnType-swing"]');
        await expect(swingRadio).toBeVisible({ timeout: 5000 });
        await swingRadio.click();
    } else if (transactionData.type === 'Hold') {
        const holdRadio = page.locator('[data-testid="txn-form-txnType-hold"]');
        await expect(holdRadio).toBeVisible({ timeout: 5000 });
        await holdRadio.click();
    } else if (transactionData.type === 'Split') {
        const splitRadio = page.locator('[data-testid="txn-form-txnType-split"]');
        await expect(splitRadio).toBeVisible({ timeout: 5000 });
        await splitRadio.click();
    }
    
    // Select signal
    await page.locator('[data-testid="txn-form-signal"]').selectOption(transactionData.signal);
    
    console.log(`[PageHelper] Form filled: Date=${date}, Type=${transactionData.type}, Signal=${transactionData.signal}, Price=${transactionData.price}, Investment=${transactionData.investment}`);
    
    // Submit the form
    const submitButton = page.locator('[data-testid="txn-form-submit-button"]');
    await submitButton.click();
    
    // Wait for modal to close
    await expect(transactionModal).not.toBeVisible({ timeout: 15000 });
    console.log(`[PageHelper] Transaction created successfully.`);
    
    // Wait for transaction table to update instead of arbitrary timeout
    const transactionTable = page.locator('[data-testid*="wallets-transaction-table"], table').first();
    await expect(transactionTable).toBeVisible({ timeout: 10000 });
}

/**
 * Deletes the first transaction found on the page via the UI.
 * This function assumes the page is already on the wallet page for the stock.
 * @param page - The Playwright Page object.
 */
export async function deleteTransaction(page: Page) {
    console.log(`[PageHelper] Deleting transaction via UI.`);
    
    // Navigate to transactions section (scroll down if needed)
    const transactionsSection = page.locator('text=Transactions').first();
    await transactionsSection.scrollIntoViewIfNeeded();
    
    // Find the delete button for the transaction (should be the first/only one)
    const deleteButton = page.locator('[data-testid^="wallets-transaction-table-txn-delete-button-"]').first();
    await expect(deleteButton).toBeVisible({ timeout: 10000 });
    console.log(`[PageHelper] Delete button found, clicking...`);
    
    // Handle the confirmation dialog
    page.once('dialog', async dialog => {
        console.log(`[PageHelper] Confirmation dialog appeared: ${dialog.message()}`);
        await dialog.accept();
    });
    
    await deleteButton.click();
    console.log(`[PageHelper] Transaction deletion confirmed.`);

    // Wait for transaction to be removed from table instead of arbitrary timeout
    await expect(deleteButton).not.toBeVisible({ timeout: 10000 });
    console.log(`[PageHelper] Transaction deleted successfully.`);
}

/**
 * Updates a transaction's price by finding it via its current price value.
 * This is a robust way to identify transactions when you know the original price.
 * @param page - The Playwright Page object.
 * @param oldPrice - The current price of the transaction to find.
 * @param newPrice - The new price to set for the transaction.
 */
export async function editTransactionByPrice(page: Page, oldPrice: number, newPrice: number) {
    console.log(`[PageHelper] Updating transaction with price $${oldPrice} to $${newPrice}...`);

    // Find the transaction row with the specific price
    const priceText = `$${oldPrice.toFixed(2)}`;
    const rows = page.locator('[data-testid="wallets-transaction-table-transaction-row"]');
    const rowCount = await rows.count();

    let txnId = null;
    for (let i = 0; i < rowCount; i++) {
        const row = rows.nth(i);
        const priceCell = row.locator('[data-testid="wallets-transaction-table-price-display"]');
        const cellText = await priceCell.textContent();

        if (cellText?.trim() === priceText) {
            // Get the transaction ID from the edit button in this row
            const editBtn = row.locator('button[data-testid^="wallets-transaction-table-txn-edit-button-"]');
            const testId = await editBtn.getAttribute('data-testid');
            txnId = testId?.replace('wallets-transaction-table-txn-edit-button-', '');
            break;
        }
    }

    if (!txnId) {
        throw new Error(`Transaction with price ${priceText} not found`);
    }

    // Click the edit button using its data-testid
    const editButton = page.locator(`[data-testid="wallets-transaction-table-txn-edit-button-${txnId}"]`);
    await expect(editButton).toBeVisible({ timeout: 10000 });
    await editButton.click();

    // Wait for modal
    const modal = page.locator('[data-testid="transaction-form-modal"]');
    await expect(modal).toBeVisible({ timeout: 10000 });

    // Update price
    const priceInput = page.locator('[data-testid="txn-form-price"]');
    await priceInput.fill(newPrice.toString());

    // Submit
    const submitButton = page.locator('[data-testid="txn-form-submit-button"]');
    await submitButton.click();
    await expect(modal).not.toBeVisible({ timeout: 15000 });

    console.log(`[PageHelper] ✅ Transaction updated from $${oldPrice} to $${newPrice}`);
}
