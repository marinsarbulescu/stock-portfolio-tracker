import { test, expect } from "@playwright/test";
import { loginUser, clearBrowserState } from "./utils/auth";

test.describe("Authentication", () => {
  test.beforeEach(async ({ page }) => {
    await clearBrowserState(page);
  });

  test("authentication flow - redirect, form display, and successful login", async ({ page }) => {
    // Step 1: Verify unauthenticated users are redirected to login
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);

    // Step 2: Verify login form elements are present
    await expect(page.locator('input[name="username"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(
      page.locator('button[type="submit"]:has-text("Sign in")')
    ).toBeVisible();

    // Step 3: Login successfully
    await loginUser(page);

    // Step 4: Verify redirect to dashboard and navigation is visible
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('[data-testid="nav-dashboard"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-assets"]')).toBeVisible();
  });
});
