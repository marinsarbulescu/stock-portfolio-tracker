// e2e/utils/portfolioHelpers.ts

/**
 * Portfolio-specific operations and stock management utilities
 * Centralized helpers for portfolio-related E2E test operations
 */

import { expect } from '@playwright/test';
import {
    createPortfolioStock,
    deletePortfolioStock,
    type PortfolioStockCreateData,
} from './dataHelpers';
import { E2E_TEST_USER_OWNER_ID } from './testCredentials';

/**
 * Interface for stock data input (matches JSON test data structure)
 */
export interface StockDataInput {
    symbol: string;
    name: string;
    stockType: string;
    region: string;
    marketCategory: string;
    riskGrowthProfile: string;
    pdp: number;
    stp: number;
    htp: number;
    budget: number;
    swingHoldRatio: number;
    stockCommission?: number; // Optional - will use undefined if not provided
}

/**
 * Creates a stock via API with consistent defaults and error handling
 *
 * @param stockData - Stock data input (from JSON or test configuration)
 * @param options - Optional configuration
 * @returns Promise<Created stock record with ID>
 *
 * @example
 * ```typescript
 * const stock = await createStockViaAPI({
 *   symbol: "AAPL",
 *   name: "Apple Inc.",
 *   stockType: "Stock",
 *   region: "US",
 *   marketCategory: "Technology",
 *   riskGrowthProfile: "Hare",
 *   pdp: 5,
 *   stp: 10,
 *   htp: 20,
 *   budget: 1000,
 *   swingHoldRatio: 50
 * });
 * ```
 */
export async function createStockViaAPI(
    stockData: StockDataInput,
    options: {
        logCreation?: boolean;
        owner?: string;
    } = {}
) {
    const { logCreation = true, owner = E2E_TEST_USER_OWNER_ID } = options;

    if (logCreation) {
        console.log(`[PortfolioHelper] Creating stock ${stockData.symbol} via API...`);
    }

    const portfolioStockData: PortfolioStockCreateData = {
        symbol: stockData.symbol,
        name: stockData.name,
        stockType: stockData.stockType,
        region: stockData.region,
        marketCategory: stockData.marketCategory,
        riskGrowthProfile: stockData.riskGrowthProfile,
        pdp: stockData.pdp,
        stp: stockData.stp,
        htp: stockData.htp,
        budget: stockData.budget,
        swingHoldRatio: stockData.swingHoldRatio,
        stockCommission: stockData.stockCommission, // Pass undefined if not provided
        owner: owner,
        isHidden: false,
        archived: false
    };

    try {
        const createdStock = await createPortfolioStock(portfolioStockData);

        if (logCreation) {
            console.log(`[PortfolioHelper] ✅ Stock ${stockData.symbol} created with ID: ${createdStock.id}`);
        }

        return createdStock;
    } catch (error) {
        console.error(`[PortfolioHelper] ❌ Failed to create stock ${stockData.symbol}:`, error);
        throw new Error(`Failed to create stock ${stockData.symbol}: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Creates multiple stocks via API and returns their IDs
 * Useful for test setup that requires multiple stocks
 *
 * @param stockDataList - Array of stock data inputs
 * @param options - Optional configuration
 * @returns Promise<Array of created stock IDs>
 */
export async function createMultipleStocksViaAPI(
    stockDataList: StockDataInput[],
    options: {
        logProgress?: boolean;
        owner?: string;
    } = {}
): Promise<string[]> {
    const { logProgress = true, owner = E2E_TEST_USER_OWNER_ID } = options;
    const createdIds: string[] = [];

    if (logProgress) {
        console.log(`[PortfolioHelper] Creating ${stockDataList.length} stocks via API...`);
    }

    for (const [index, stockData] of stockDataList.entries()) {
        try {
            const stock = await createStockViaAPI(stockData, {
                logCreation: logProgress,
                owner
            });
            createdIds.push(stock.id);

            if (logProgress) {
                console.log(`[PortfolioHelper] Progress: ${index + 1}/${stockDataList.length} stocks created`);
            }
        } catch (error) {
            console.error(`[PortfolioHelper] Failed to create stock ${index + 1}/${stockDataList.length} (${stockData.symbol})`);
            throw error; // Re-throw to fail the test
        }
    }

    if (logProgress) {
        console.log(`[PortfolioHelper] ✅ Successfully created all ${createdIds.length} stocks`);
    }

    return createdIds;
}

/**
 * Deletes multiple stocks by ID with error handling
 * Useful for test cleanup
 *
 * @param stockIds - Array of stock IDs to delete
 * @param options - Optional configuration
 */
export async function deleteMultipleStocks(
    stockIds: string[],
    options: {
        logProgress?: boolean;
        continueOnError?: boolean;
    } = {}
): Promise<void> {
    const { logProgress = true, continueOnError = true } = options;

    if (logProgress && stockIds.length > 0) {
        console.log(`[PortfolioHelper] Deleting ${stockIds.length} stocks...`);
    }

    for (const [index, stockId] of stockIds.entries()) {
        try {
            await deletePortfolioStock(stockId);

            if (logProgress) {
                console.log(`[PortfolioHelper] ✅ Deleted stock ${index + 1}/${stockIds.length}: ${stockId}`);
            }
        } catch (error) {
            const errorMessage = `Failed to delete stock ${stockId}: ${error instanceof Error ? error.message : String(error)}`;

            if (continueOnError) {
                console.warn(`[PortfolioHelper] ⚠️ ${errorMessage} (continuing with remaining deletions)`);
            } else {
                console.error(`[PortfolioHelper] ❌ ${errorMessage}`);
                throw new Error(errorMessage);
            }
        }
    }

    if (logProgress && stockIds.length > 0) {
        console.log(`[PortfolioHelper] ✅ Completed deletion of ${stockIds.length} stocks`);
    }
}

/**
 * Verifies that a stock exists in the portfolio table
 * Common assertion pattern across portfolio tests
 *
 * @param page - Playwright page object
 * @param stockSymbol - Stock symbol to verify
 * @param options - Optional configuration
 */
export async function verifyStockInPortfolioTable(
    page: any,
    stockSymbol: string,
    options: {
        timeout?: number;
        caseSensitive?: boolean;
    } = {}
) {
    const { timeout = 10000, caseSensitive = false } = options;
    const symbolToCheck = caseSensitive ? stockSymbol : stockSymbol.toUpperCase();

    console.log(`[PortfolioHelper] Verifying stock ${symbolToCheck} exists in portfolio table...`);

    const stockLink = page.locator(`[data-testid="portfolio-page-table-wallet-link-${symbolToCheck}"]`).first();

    try {
        await expect(stockLink).toBeVisible({ timeout });
        await expect(stockLink).toHaveText(symbolToCheck);

        console.log(`[PortfolioHelper] ✅ Stock ${symbolToCheck} verified in portfolio table`);
    } catch (error) {
        console.error(`[PortfolioHelper] ❌ Stock ${symbolToCheck} not found in portfolio table`);
        throw new Error(`Stock ${symbolToCheck} not found in portfolio table: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Navigates to the Portfolio page with proper error handling
 * Centralized navigation pattern used across multiple tests
 *
 * @param page - Playwright page object
 * @param options - Optional configuration
 */
export async function navigateToPortfolioPage(
    page: any,
    options: {
        timeout?: number;
        waitForLoad?: boolean;
    } = {}
) {
    const { timeout = 15000, waitForLoad = true } = options;

    console.log(`[PortfolioHelper] Navigating to Portfolio page...`);

    try {
        await page.goto('/');

        const portfolioLink = page.locator('[data-testid="nav-portfolio-link"]');
        await expect(portfolioLink).toBeVisible({ timeout });
        await portfolioLink.click();

        if (waitForLoad) {
            // Wait for page to load completely
            const pageTitle = page.locator('[data-testid="portfolio-page-title"]');
            await expect(pageTitle).toBeVisible({ timeout });
            await expect(pageTitle).toHaveText('Portfolio');
        }

        console.log(`[PortfolioHelper] ✅ Successfully navigated to Portfolio page`);
    } catch (error) {
        console.error(`[PortfolioHelper] ❌ Failed to navigate to Portfolio page:`, error);
        throw new Error(`Navigation to Portfolio page failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}