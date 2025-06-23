import { type Page, expect } from '@playwright/test';
import { E2E_TEST_USERNAME, E2E_TEST_PASSWORD } from './testCredentials';

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

    const addNewTransactionButtonLocator = page.locator('[data-testid="add-buy-transaction-button"]');
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
    const addTransactionButton = page.locator('[data-testid="add-buy-transaction-button"]');
    await expect(addTransactionButton).toBeVisible({ timeout: 10000 });
    await addTransactionButton.click();
    
    const transactionModal = page.locator('[data-testid="add-buy-transaction-form-modal"]');
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
    
    // Wait for UI to update
    await page.waitForTimeout(3000);
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
    await page.waitForTimeout(1000);
    
    // Find the delete button for the transaction (should be the first/only one)
    const deleteButton = page.locator('[data-testid^="transaction-delete-button-"]').first();
    await expect(deleteButton).toBeVisible({ timeout: 10000 });
    console.log(`[PageHelper] Delete button found, clicking...`);
    
    // Handle the confirmation dialog
    page.once('dialog', async dialog => {
        console.log(`[PageHelper] Confirmation dialog appeared: ${dialog.message()}`);
        await dialog.accept();
    });
    
    await deleteButton.click();
    console.log(`[PageHelper] Transaction deletion confirmed.`);
    
    // Wait for deletion to process
    await page.waitForTimeout(3000);
    console.log(`[PageHelper] Transaction deleted successfully.`);
}
