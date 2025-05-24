import { type Page, expect } from '@playwright/test';
import { E2E_TEST_USERNAME, E2E_TEST_PASSWORD } from './testCredentials';

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
