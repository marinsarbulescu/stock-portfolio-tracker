// e2e/portfolio/portfolio-overview.spec.ts

// Portfolio Overview E2E Test
// Validates Portfolio Overview functionality with centralized helpers:
// 1. Creates multiple stocks via API with different regions, market categories, and risk profiles
// 2. Validates each stock appears correctly in the Portfolio table
// 3. Verifies Portfolio Overview summary tables show correct Max Risk totals by:
//    - Region (APAC, EU, Intl, US)
//    - Market Category (APAC Index, China Index, Crypto, etc.)
//    - Risk Profile (Hare, Tortoise)

import { Amplify } from 'aws-amplify';
import { test, expect } from '@playwright/test';
import amplifyOutputs from '../../amplify_outputs.json';

import {
    deletePortfolioStock,
} from '../utils/dataHelpers';
import { E2E_TEST_USERNAME } from '../utils/testCredentials';
import { clearBrowserState, loginUser } from '../utils/pageHelpers';
import { cleanupTestStocks, cleanupAllData } from '../utils/cleanupHelper';
import {
    createStockViaAPI,
    createMultipleStocksViaAPI,
    deleteMultipleStocks,
    verifyStockInPortfolioTable,
    navigateToPortfolioPage
} from '../utils/portfolioHelpers';
import {
    validateTableData
} from '../utils/validationHelpers';
import {
    handleTestFailure,
    executeTestStep
} from '../utils/testHelpers';

// Configure Amplify
try {
    Amplify.configure(amplifyOutputs);
} catch (error) {
    console.error('[portfolio-overview-simple.spec.ts] - CRITICAL: Error configuring Amplify:', error);
}


// All helper functions now imported from centralized utilities

// Helper to expand Portfolio Overview section with smart detection
async function expandPortfolioOverview(page: any): Promise<void> {
    const expandedSection = page.locator('[data-testid="portfolio-page-overview-expanded"]');
    const isExpanded = await expandedSection.isVisible();

    if (!isExpanded) {
        const overviewToggle = page.locator('[data-testid="portfolio-page-overview-toggle"]');
        await expect(overviewToggle).toBeVisible({ timeout: 10000 });
        await overviewToggle.click();
        await page.waitForTimeout(1000);
        await expect(expandedSection).toBeVisible({ timeout: 5000 });
    }
}

// Helper to create all test stocks using centralized functions
async function createTestStocks(testData: any): Promise<string[]> {
    // Create first stock (Step 2)
    const firstStock = await createStockViaAPI(testData['Step 2'][0].input);

    // Create additional stocks (Step 5) using batch creation
    const additionalStockData = testData['Step 5'].map((stock: any) => stock.input);
    const additionalIds = await createMultipleStocksViaAPI(additionalStockData, { logProgress: false });

    return [firstStock.id, ...additionalIds];
}

// Complete Portfolio Overview validation using centralized helpers
async function validateCompletePortfolioOverview(page: any, testData: any): Promise<void> {
    await executeTestStep(page, 'Portfolio Overview Expansion', async () => {
        await expandPortfolioOverview(page);
    });

    const validationSteps = [
        { data: testData['Step 7'][0].output, name: 'Region Table' },
        { data: testData['Step 8'][0].output, name: 'Market Category Table' },
        { data: testData['Step 9'][0].output, name: 'Risk Profile Table' }
    ];

    for (const { data, name } of validationSteps) {
        await executeTestStep(page, `${name} Validation`, async () => {
            await validateTableData(page, data, name, { logProgress: false });
        });
    }
}

// Test Suite - Configured for isolated execution due to portfolio-level aggregate validation
test.describe.configure({ mode: 'serial' });
test.describe('Portfolio Overview - Complete Validation', () => {
    let createdStockIds: string[] = [];

    test.beforeEach(async ({ page }) => {
        // Step 1: Complete database cleanup (required for accurate portfolio-level aggregate validation)
        await cleanupAllData();

        // Clear browser state and login
        await clearBrowserState(page);
        await loginUser(page);
    });

    test.afterEach(async () => {
        // Clean up created stocks using centralized helper
        if (createdStockIds.length > 0) {
            await deleteMultipleStocks(createdStockIds, {
                logProgress: false,
                continueOnError: true
            });
        }

        // Load test data to get cleanup symbols
        const testData = require('./portfolio-overview.json');
        const allSymbols = [
            testData['Step 2'][0].input.symbol,
            ...testData['Step 5'].map((stock: any) => stock.input.symbol)
        ];
        await cleanupTestStocks(allSymbols);
        createdStockIds = [];
    });

    test('Portfolio Overview - Full Functionality Test', async ({ page }) => {
        test.setTimeout(120000); // 2 minutes timeout

        // Load the full test data from JSON
        const testData = require('./portfolio-overview.json');

        try {
            // Phase 1: Create all test stocks via API
            const createdIds = await createTestStocks(testData);
            createdStockIds.push(...createdIds);

            // Phase 2: Navigate to Portfolio page and verify stocks loaded
            await navigateToPortfolioPage(page);
            await page.waitForTimeout(2000);

            // Quick verification using centralized helper
            await verifyStockInPortfolioTable(page, testData['Step 2'][0].input.symbol);

            // Phase 3 & 4: Complete Portfolio Overview validation
            await validateCompletePortfolioOverview(page, testData);

        } catch (error) {
            await handleTestFailure(page, 'Main Test Flow', error);
        }
    });
});