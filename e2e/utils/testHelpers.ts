// e2e/utils/testHelpers.ts

/**
 * Test execution utilities, error handling, and debugging helpers
 * Centralized utilities for consistent test execution patterns across E2E tests
 */

/**
 * Enhanced error handling with context, screenshots, and structured reporting
 * Provides consistent failure reporting across all tests
 *
 * @param page - Playwright page object
 * @param testPhase - Descriptive phase where the error occurred
 * @param error - The original error that occurred
 * @param options - Optional configuration
 * @throws Never returns - always throws an enhanced error
 *
 * @example
 * ```typescript
 * try {
 *   await someTestOperation();
 * } catch (error) {
 *   await handleTestFailure(page, 'Stock Creation', error);
 * }
 * ```
 */
export async function handleTestFailure(
    page: any,
    testPhase: string,
    error: any,
    options: {
        takeScreenshot?: boolean;
        includePageInfo?: boolean;
        screenshotPrefix?: string;
    } = {}
): Promise<never> {
    const {
        takeScreenshot = true,
        includePageInfo = true,
        screenshotPrefix = 'test-failure'
    } = options;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    let screenshotPath = '';
    let pageInfo = '';

    // Take screenshot for debugging
    if (takeScreenshot) {
        screenshotPath = `${screenshotPrefix}-${testPhase.toLowerCase().replace(/\s+/g, '-')}-${timestamp}.png`;
        try {
            await page.screenshot({
                path: screenshotPath,
                fullPage: true
            });
        } catch (screenshotError) {
            console.warn(`[TestHelper] ⚠️ Could not take screenshot: ${screenshotError}`);
            screenshotPath = '(screenshot failed)';
        }
    }

    // Gather page context information
    if (includePageInfo) {
        try {
            const url = page.url();
            const title = await page.title().catch(() => 'Unknown');
            pageInfo = `\n📄 Page: ${title} (${url})`;
        } catch (pageInfoError) {
            pageInfo = '\n📄 Page: (info unavailable)';
        }
    }

    // Construct enhanced error message
    const enhancedMessage = `Test failed in ${testPhase}${pageInfo}${
        screenshotPath ? `\n📸 Screenshot: ${screenshotPath}` : ''
    }\n❌ Original error: ${error instanceof Error ? error.message : String(error)}`;

    console.error(`[TestHelper] ${enhancedMessage}`);
    throw new Error(enhancedMessage);
}

/**
 * Takes a debug screenshot with consistent naming convention
 * Useful for debugging specific test points without failing the test
 *
 * @param page - Playwright page object
 * @param screenshotName - Descriptive name for the screenshot
 * @param options - Optional configuration
 * @returns Promise<string> - Path to the saved screenshot
 */
export async function takeDebugScreenshot(
    page: any,
    screenshotName: string,
    options: {
        fullPage?: boolean;
        includeTimestamp?: boolean;
        prefix?: string;
    } = {}
): Promise<string> {
    const {
        fullPage = true,
        includeTimestamp = true,
        prefix = 'debug'
    } = options;

    const timestamp = includeTimestamp ? `-${new Date().toISOString().replace(/[:.]/g, '-')}` : '';
    const filename = `${prefix}-${screenshotName.toLowerCase().replace(/\s+/g, '-')}${timestamp}.png`;

    try {
        await page.screenshot({
            path: filename,
            fullPage
        });

        console.log(`[TestHelper] 📸 Debug screenshot saved: ${filename}`);
        return filename;
    } catch (error) {
        console.error(`[TestHelper] ❌ Failed to take debug screenshot: ${error}`);
        throw new Error(`Debug screenshot failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Waits for UI to stabilize by ensuring no network activity and DOM stability
 * More reliable than arbitrary timeouts for dynamic content
 *
 * @param page - Playwright page object
 * @param options - Optional configuration
 */
export async function waitForStableUI(
    page: any,
    options: {
        networkIdleTimeout?: number;
        domStableTimeout?: number;
        maxWaitTime?: number;
        logProgress?: boolean;
    } = {}
): Promise<void> {
    const {
        networkIdleTimeout = 1000,
        domStableTimeout = 500,
        maxWaitTime = 30000,
        logProgress = false
    } = options;

    if (logProgress) {
        console.log('[TestHelper] Waiting for UI to stabilize...');
    }

    try {
        // Wait for network to be idle
        await page.waitForLoadState('networkidle', { timeout: maxWaitTime });

        // Additional wait for any final DOM updates
        await page.waitForTimeout(domStableTimeout);

        if (logProgress) {
            console.log('[TestHelper] ✅ UI stabilized');
        }
    } catch (error) {
        console.warn(`[TestHelper] ⚠️ UI stabilization timeout after ${maxWaitTime}ms: ${error}`);
        // Don't throw - this is a "best effort" helper
    }
}

/**
 * Retries an operation with exponential backoff
 * Useful for flaky operations that may need multiple attempts
 *
 * @param operation - Async function to retry
 * @param operationName - Descriptive name for logging
 * @param options - Retry configuration
 * @returns Promise<T> - Result of the successful operation
 */
export async function retryOperation<T>(
    operation: () => Promise<T>,
    operationName: string,
    options: {
        maxAttempts?: number;
        baseDelay?: number;
        maxDelay?: number;
        logAttempts?: boolean;
    } = {}
): Promise<T> {
    const {
        maxAttempts = 3,
        baseDelay = 1000,
        maxDelay = 10000,
        logAttempts = true
    } = options;

    let lastError: any;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            if (logAttempts && attempt > 1) {
                console.log(`[TestHelper] Retrying ${operationName} (attempt ${attempt}/${maxAttempts})...`);
            }

            const result = await operation();

            if (logAttempts && attempt > 1) {
                console.log(`[TestHelper] ✅ ${operationName} succeeded on attempt ${attempt}`);
            }

            return result;
        } catch (error) {
            lastError = error;

            if (attempt === maxAttempts) {
                if (logAttempts) {
                    console.error(`[TestHelper] ❌ ${operationName} failed after ${maxAttempts} attempts`);
                }
                break;
            }

            // Exponential backoff with jitter
            const delay = Math.min(
                baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000,
                maxDelay
            );

            if (logAttempts) {
                console.warn(`[TestHelper] ⚠️ ${operationName} attempt ${attempt} failed, retrying in ${Math.round(delay)}ms...`);
            }

            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw new Error(`${operationName} failed after ${maxAttempts} attempts. Last error: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

/**
 * Waits for a condition to be met with timeout
 * More flexible than fixed timeouts for dynamic conditions
 *
 * @param condition - Function that returns true when condition is met
 * @param conditionName - Descriptive name for logging
 * @param options - Wait configuration
 * @returns Promise<void>
 */
export async function waitForCondition(
    condition: () => Promise<boolean> | boolean,
    conditionName: string,
    options: {
        timeout?: number;
        interval?: number;
        logProgress?: boolean;
    } = {}
): Promise<void> {
    const {
        timeout = 30000,
        interval = 500,
        logProgress = false
    } = options;

    const startTime = Date.now();

    if (logProgress) {
        console.log(`[TestHelper] Waiting for condition: ${conditionName}...`);
    }

    while (Date.now() - startTime < timeout) {
        try {
            const result = await condition();
            if (result) {
                if (logProgress) {
                    console.log(`[TestHelper] ✅ Condition met: ${conditionName}`);
                }
                return;
            }
        } catch (error) {
            // Condition check failed, continue waiting
            if (logProgress) {
                console.log(`[TestHelper] Condition check failed: ${error}, continuing...`);
            }
        }

        await new Promise(resolve => setTimeout(resolve, interval));
    }

    throw new Error(`Timeout waiting for condition: ${conditionName} (waited ${timeout}ms)`);
}

/**
 * Executes a test step with consistent logging and error handling
 * Provides structured test execution with automatic failure handling
 *
 * @param page - Playwright page object
 * @param stepName - Descriptive name for the test step
 * @param stepFunction - Function containing the test step logic
 * @param options - Optional configuration
 * @returns Promise<T> - Result of the step function
 */
export async function executeTestStep<T>(
    page: any,
    stepName: string,
    stepFunction: () => Promise<T>,
    options: {
        logStart?: boolean;
        logSuccess?: boolean;
        handleFailure?: boolean;
    } = {}
): Promise<T> {
    const {
        logStart = true,
        logSuccess = true,
        handleFailure = true
    } = options;

    if (logStart) {
        console.log(`[TestHelper] 🚀 Starting: ${stepName}`);
    }

    try {
        const result = await stepFunction();

        if (logSuccess) {
            console.log(`[TestHelper] ✅ Completed: ${stepName}`);
        }

        return result;
    } catch (error) {
        if (handleFailure) {
            await handleTestFailure(page, stepName, error);
        } else {
            console.error(`[TestHelper] ❌ Failed: ${stepName} - ${error}`);
            throw error;
        }
    }
}