// e2e/utils/validationHelpers.ts

/**
 * Reusable data validation and assertion utilities
 * Centralized helpers for consistent validation patterns across E2E tests
 */

import { expect } from '@playwright/test';

/**
 * Validates table data against expected values with detailed error reporting
 * Commonly used for validating calculated values, form data, and table contents
 *
 * @param page - Playwright page object
 * @param expectedData - Object mapping data-testid to expected values
 * @param tableName - Descriptive name for the table/data being validated (for error messages)
 * @param options - Optional configuration
 *
 * @example
 * ```typescript
 * await validateTableData(page, {
 *   "portfolio-overview-region-US-maxrisk": "$3,600.00",
 *   "portfolio-overview-region-APAC-maxrisk": "$5,800.00"
 * }, "Region Table");
 * ```
 */
export async function validateTableData(
    page: any,
    expectedData: Record<string, string>,
    tableName: string,
    options: {
        timeout?: number;
        logProgress?: boolean;
        continueOnError?: boolean;
    } = {}
): Promise<void> {
    const { timeout = 10000, logProgress = false, continueOnError = false } = options;
    const validationErrors: string[] = [];

    if (logProgress) {
        console.log(`[ValidationHelper] Validating ${Object.keys(expectedData).length} items in ${tableName}...`);
    }

    for (const [testId, expectedValue] of Object.entries(expectedData)) {
        try {
            const element = page.locator(`[data-testid="${testId}"]`);
            await expect(element).toBeVisible({ timeout });
            await expect(element).toHaveText(expectedValue);

            if (logProgress) {
                console.log(`[ValidationHelper] ✅ ${testId}: ${expectedValue}`);
            }
        } catch (error) {
            const errorMessage = `${tableName} validation failed for ${testId}: Expected "${expectedValue}" but validation failed. ${error instanceof Error ? error.message : String(error)}`;

            validationErrors.push(errorMessage);

            if (!continueOnError) {
                console.error(`[ValidationHelper] ❌ ${errorMessage}`);
                throw new Error(errorMessage);
            } else {
                console.warn(`[ValidationHelper] ⚠️ ${errorMessage} (continuing validation)`);
            }
        }
    }

    if (validationErrors.length > 0) {
        const summaryMessage = `${tableName} validation completed with ${validationErrors.length} errors:\n${validationErrors.join('\n')}`;
        console.error(`[ValidationHelper] ❌ ${summaryMessage}`);
        throw new Error(summaryMessage);
    }

    if (logProgress) {
        console.log(`[ValidationHelper] ✅ ${tableName} validation completed successfully`);
    }
}

/**
 * Validates a single element's text content
 * Useful for individual field validation
 *
 * @param page - Playwright page object
 * @param testId - data-testid of the element to validate
 * @param expectedValue - Expected text content
 * @param options - Optional configuration
 */
export async function validateElementData(
    page: any,
    testId: string,
    expectedValue: string,
    options: {
        timeout?: number;
        elementName?: string;
    } = {}
): Promise<void> {
    const { timeout = 10000, elementName = testId } = options;

    try {
        const element = page.locator(`[data-testid="${testId}"]`);
        await expect(element).toBeVisible({ timeout });
        await expect(element).toHaveText(expectedValue);

        console.log(`[ValidationHelper] ✅ ${elementName}: ${expectedValue}`);
    } catch (error) {
        const errorMessage = `Element validation failed for ${elementName} (${testId}): Expected "${expectedValue}". ${error instanceof Error ? error.message : String(error)}`;
        console.error(`[ValidationHelper] ❌ ${errorMessage}`);
        throw new Error(errorMessage);
    }
}

/**
 * Validates form field values (input, select, textarea)
 * Useful for form validation tests
 *
 * @param page - Playwright page object
 * @param formData - Object mapping field data-testids to expected values
 * @param formName - Descriptive name for the form (for error messages)
 * @param options - Optional configuration
 */
export async function validateFormData(
    page: any,
    formData: Record<string, string>,
    formName: string,
    options: {
        timeout?: number;
        logProgress?: boolean;
    } = {}
): Promise<void> {
    const { timeout = 10000, logProgress = false } = options;

    if (logProgress) {
        console.log(`[ValidationHelper] Validating ${Object.keys(formData).length} fields in ${formName}...`);
    }

    for (const [fieldTestId, expectedValue] of Object.entries(formData)) {
        try {
            const field = page.locator(`[data-testid="${fieldTestId}"]`);
            await expect(field).toBeVisible({ timeout });

            // Handle different input types
            const tagName = await field.evaluate((el) => el.tagName.toLowerCase());

            if (tagName === 'input' || tagName === 'textarea') {
                await expect(field).toHaveValue(expectedValue);
            } else if (tagName === 'select') {
                await expect(field).toHaveValue(expectedValue);
            } else {
                // For other elements, check text content
                await expect(field).toHaveText(expectedValue);
            }

            if (logProgress) {
                console.log(`[ValidationHelper] ✅ ${fieldTestId}: ${expectedValue}`);
            }
        } catch (error) {
            const errorMessage = `${formName} field validation failed for ${fieldTestId}: Expected "${expectedValue}". ${error instanceof Error ? error.message : String(error)}`;
            console.error(`[ValidationHelper] ❌ ${errorMessage}`);
            throw new Error(errorMessage);
        }
    }

    if (logProgress) {
        console.log(`[ValidationHelper] ✅ ${formName} form validation completed successfully`);
    }
}

/**
 * Validates that elements are visible on the page
 * Useful for checking that UI components have loaded correctly
 *
 * @param page - Playwright page object
 * @param testIds - Array of data-testids to check for visibility
 * @param options - Optional configuration
 */
export async function validateElementsVisible(
    page: any,
    testIds: string[],
    options: {
        timeout?: number;
        elementDescription?: string;
        logProgress?: boolean;
    } = {}
): Promise<void> {
    const { timeout = 10000, elementDescription = 'elements', logProgress = false } = options;

    if (logProgress) {
        console.log(`[ValidationHelper] Checking visibility of ${testIds.length} ${elementDescription}...`);
    }

    for (const testId of testIds) {
        try {
            const element = page.locator(`[data-testid="${testId}"]`);
            await expect(element).toBeVisible({ timeout });

            if (logProgress) {
                console.log(`[ValidationHelper] ✅ ${testId} is visible`);
            }
        } catch (error) {
            const errorMessage = `Element visibility check failed for ${testId}: ${error instanceof Error ? error.message : String(error)}`;
            console.error(`[ValidationHelper] ❌ ${errorMessage}`);
            throw new Error(errorMessage);
        }
    }

    if (logProgress) {
        console.log(`[ValidationHelper] ✅ All ${testIds.length} ${elementDescription} are visible`);
    }
}

/**
 * Validates that expected elements are NOT visible on the page
 * Useful for checking that modals have closed, error messages are gone, etc.
 *
 * @param page - Playwright page object
 * @param testIds - Array of data-testids that should not be visible
 * @param options - Optional configuration
 */
export async function validateElementsNotVisible(
    page: any,
    testIds: string[],
    options: {
        timeout?: number;
        elementDescription?: string;
        logProgress?: boolean;
    } = {}
): Promise<void> {
    const { timeout = 10000, elementDescription = 'elements', logProgress = false } = options;

    if (logProgress) {
        console.log(`[ValidationHelper] Checking that ${testIds.length} ${elementDescription} are not visible...`);
    }

    for (const testId of testIds) {
        try {
            const element = page.locator(`[data-testid="${testId}"]`);
            await expect(element).not.toBeVisible({ timeout });

            if (logProgress) {
                console.log(`[ValidationHelper] ✅ ${testId} is not visible (as expected)`);
            }
        } catch (error) {
            const errorMessage = `Element invisibility check failed for ${testId}: Element should not be visible. ${error instanceof Error ? error.message : String(error)}`;
            console.error(`[ValidationHelper] ❌ ${errorMessage}`);
            throw new Error(errorMessage);
        }
    }

    if (logProgress) {
        console.log(`[ValidationHelper] ✅ All ${testIds.length} ${elementDescription} are not visible (as expected)`);
    }
}