// e2e/utils/cleanupHelper.ts
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';

/**
 * Clean up all test stocks by symbol patterns
 * This helps ensure no leftover test data between test runs
 */
export async function cleanupTestStocks(symbols: string[] = ['AAPL', 'BTC-USD', 'E2ETST', 'E2ESPLIT', 'E2EATXJSON']): Promise<void> {
    const client = generateClient<Schema>({
        authMode: 'apiKey',
        apiKey: process.env.AMPLIFY_API_KEY
    });
    console.log('[cleanupHelper] Starting cleanup of test stocks...');
    
    try {
        // Get all portfolio stocks
        const { data: allStocks, errors } = await client.models.PortfolioStock.list({} as any);
        
        if (errors) {
            console.error('[cleanupHelper] Error listing stocks for cleanup:', errors);
            return;
        }
        
        // Filter to test stocks only
        const testStocks = allStocks.filter((stock: Schema['PortfolioStock']['type']) => 
            symbols.some(symbol => stock.symbol === symbol)
        );
        
        console.log(`[cleanupHelper] Found ${testStocks.length} test stocks to clean up`);
        
        // Delete each test stock
        for (const stock of testStocks) {
            try {
                console.log(`[cleanupHelper] Deleting test stock: ${stock.symbol} (${stock.id})`);
                const { errors: deleteErrors } = await client.models.PortfolioStock.delete({ id: stock.id });
                
                if (deleteErrors) {
                    console.warn(`[cleanupHelper] Warning deleting ${stock.symbol}:`, deleteErrors);
                } else {
                    console.log(`[cleanupHelper] ✅ Deleted test stock: ${stock.symbol}`);
                }
            } catch (error) {
                console.warn(`[cleanupHelper] Exception deleting ${stock.symbol}:`, error);
            }
        }
        
        console.log('[cleanupHelper] Test stock cleanup completed');
    } catch (error) {
        console.error('[cleanupHelper] Error during cleanup:', error);
    }
}

/**
 * Enhanced cleanup that also waits for UI to reflect changes
 */
export async function cleanupTestStocksWithWait(page: any, symbols: string[] = ['AAPL', 'BTC-USD']): Promise<void> {
    console.log('[cleanupHelper] Starting enhanced cleanup with UI wait...');
    
    // First, clean up from database
    await cleanupTestStocks(symbols);
    
    // Then navigate to signals page and wait for UI to refresh
    if (page) {
        try {
            console.log('[cleanupHelper] Refreshing signals page to ensure UI reflects cleanup...');
            await page.goto('/');
            await page.waitForTimeout(2000); // Give time for any async operations
            
            // Check if any test stocks are still visible
            for (const symbol of symbols) {
                const stockRows = page.locator(`tr:has(td:has-text("${symbol}"))`);
                const count = await stockRows.count();
                
                if (count > 0) {
                    console.warn(`[cleanupHelper] Warning: ${count} rows for ${symbol} still visible in UI after cleanup`);
                } else {
                    console.log(`[cleanupHelper] ✅ Confirmed ${symbol} not visible in UI`);
                }
            }
        } catch (error) {
            console.warn('[cleanupHelper] Error during UI verification:', error);
        }
    }
}
