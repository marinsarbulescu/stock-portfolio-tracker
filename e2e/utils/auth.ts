import { type Page, expect } from "@playwright/test";

// Test credentials from environment variables
const E2E_TEST_USERNAME = process.env.E2E_TEST_USERNAME;
const E2E_TEST_PASSWORD = process.env.E2E_TEST_PASSWORD;

function getCredentials() {
  if (!E2E_TEST_USERNAME || !E2E_TEST_PASSWORD) {
    throw new Error(
      "E2E_TEST_USERNAME and E2E_TEST_PASSWORD environment variables must be set"
    );
  }
  return { username: E2E_TEST_USERNAME, password: E2E_TEST_PASSWORD };
}

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
  username?: string,
  password?: string
) {
  const credentials = getCredentials();
  const user = username ?? credentials.username;
  const pass = password ?? credentials.password;
  // Clear state and navigate to login
  await clearBrowserState(page);
  await page.goto("/login");

  // Wait for Amplify Authenticator form to be ready
  await expect(page.locator('input[name="username"]')).toBeVisible({
    timeout: 10000,
  });

  // Fill credentials
  await page.locator('input[name="username"]').fill(user);
  await page.locator('input[name="password"]').fill(pass);

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
  await expect(page.locator('[data-testid="nav-dashboard"]')).toBeVisible({
    timeout: 15000,
  });
}
