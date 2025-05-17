import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

const envPath = path.resolve(__dirname, '.env');
const dotenvResult = dotenv.config({ path: envPath });
if (dotenvResult.error) { console.warn(`---> Playwright Config: Error loading .env file from ${envPath}: ${dotenvResult.error.message}`); }
else { console.log(`---> Playwright Config: .env file loaded. Key is ${process.env.AMPLIFY_API_KEY ? 'SET' : 'NOT SET'}`); }


// Define the port your local dev server runs on
const PORT = process.env.PORT || 3000;
// Define the base URL
const baseURL = `http://localhost:${PORT}`;

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './e2e',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: 1,//process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: baseURL,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npm run dev', // Command to start your dev server
    url: baseURL, // URL to poll to ensure the server is ready
    timeout: 120 * 1000, // Increase timeout for server start if needed (milliseconds)
    reuseExistingServer: !process.env.CI, // Allow reusing server if already running locally
    // Optional: Define environment variables for the dev server if needed
    // env: {
    //   SOME_VARIABLE: 'some-value'
    // }
  },
});
