import { test, expect } from "@playwright/test";
import { loginUser, clearBrowserState } from "./utils/auth";

test.describe("Authentication", () => {
  test.beforeEach(async ({ page }) => {
    await clearBrowserState(page);
  });

  test("user can login successfully", async ({ page }) => {
    await loginUser(page);

    // Verify we're on the dashboard
    await expect(page).toHaveURL(/\/dashboard/);

    // Verify navigation menu is visible
    await expect(page.locator('[data-testid="nav-dashboard"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-assets"]')).toBeVisible();
  });

  test("shows login form on /login page", async ({ page }) => {
    await page.goto("/login");

    // Verify login form elements are present
    await expect(page.locator('input[name="username"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(
      page.locator('button[type="submit"]:has-text("Sign in")')
    ).toBeVisible();
  });

  test("redirects unauthenticated users to login", async ({ page }) => {
    // Try to access protected route without login
    await page.goto("/dashboard");

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });
});
