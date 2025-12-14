import { type Page, expect } from "@playwright/test";

// Test credentials for beta environment
const E2E_TEST_USERNAME = "marin.sarbulescu@gmail.com";
const E2E_TEST_PASSWORD = "T5u#PW4&!9wm4SzG";

/**
 * Clears browser localStorage, sessionStorage, and cookies.
 * Ensures a clean state before login.
 */
export async function clearBrowserState(page: Page) {
  await page.goto("/");
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.context().clearCookies();
  await page.goto("/");
}

/**
 * Logs in the test user using AWS Amplify Authenticator.
 * After successful login, verifies redirect to dashboard.
 */
export async function loginUser(
  page: Page,
  username = E2E_TEST_USERNAME,
  password = E2E_TEST_PASSWORD
) {
  // Clear state and navigate to login
  await clearBrowserState(page);
  await page.goto("/login");

  // Wait for Amplify Authenticator form to be ready
  await expect(page.locator('input[name="username"]')).toBeVisible({
    timeout: 10000,
  });

  // Fill credentials
  await page.locator('input[name="username"]').fill(username);
  await page.locator('input[name="password"]').fill(password);

  // Wait for Cognito response after clicking sign in
  const cognitoResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("cognito-idp.") && response.status() === 200,
    { timeout: 15000 }
  );

  // Click sign in button
  await page.locator('button[type="submit"]:has-text("Sign in")').click();

  // Wait for successful authentication
  await cognitoResponsePromise;

  // Verify we're redirected to dashboard and nav is visible
  await expect(page.locator('nav a:has-text("Dashboard")')).toBeVisible({
    timeout: 15000,
  });
}
