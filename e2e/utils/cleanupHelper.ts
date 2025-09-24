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
 * Complete database cleanup - deletes ALL portfolio stocks, transactions, and wallets
 * Use with caution - this will remove all data for the user
 */
export async function cleanupAllData(): Promise<void> {
    const client = generateClient<Schema>({
        authMode: 'apiKey',
        apiKey: process.env.AMPLIFY_API_KEY
    });
    console.log('[cleanupHelper] Starting COMPLETE database cleanup...');

    try {
        // 1. Delete all transactions first (due to foreign key constraints)
        console.log('[cleanupHelper] Step 1: Deleting all transactions...');
        const { data: allTransactions, errors: txnErrors } = await client.models.Transaction.list({} as any);

        if (txnErrors) {
            console.error('[cleanupHelper] Error listing transactions:', txnErrors);
        } else {
            console.log(`[cleanupHelper] Found ${allTransactions.length} transactions to delete`);
            for (const txn of allTransactions) {
                try {
                    await client.models.Transaction.delete({ id: txn.id });
                    console.log(`[cleanupHelper] ✅ Deleted transaction: ${txn.id}`);
                } catch (error) {
                    console.warn(`[cleanupHelper] Warning deleting transaction ${txn.id}:`, error);
                }
            }
        }

        // 2. Delete all stock wallets
        console.log('[cleanupHelper] Step 2: Deleting all stock wallets...');
        const { data: allWallets, errors: walletErrors } = await client.models.StockWallet.list({} as any);

        if (walletErrors) {
            console.error('[cleanupHelper] Error listing wallets:', walletErrors);
        } else {
            console.log(`[cleanupHelper] Found ${allWallets.length} wallets to delete`);
            for (const wallet of allWallets) {
                try {
                    await client.models.StockWallet.delete({ id: wallet.id });
                    console.log(`[cleanupHelper] ✅ Deleted wallet: ${wallet.id}`);
                } catch (error) {
                    console.warn(`[cleanupHelper] Warning deleting wallet ${wallet.id}:`, error);
                }
            }
        }

        // 3. Delete all portfolio stocks
        console.log('[cleanupHelper] Step 3: Deleting all portfolio stocks...');
        const { data: allStocks, errors: stockErrors } = await client.models.PortfolioStock.list({} as any);

        if (stockErrors) {
            console.error('[cleanupHelper] Error listing stocks:', stockErrors);
        } else {
            console.log(`[cleanupHelper] Found ${allStocks.length} stocks to delete`);
            for (const stock of allStocks) {
                try {
                    await client.models.PortfolioStock.delete({ id: stock.id });
                    console.log(`[cleanupHelper] ✅ Deleted stock: ${stock.symbol} (${stock.id})`);
                } catch (error) {
                    console.warn(`[cleanupHelper] Warning deleting stock ${stock.symbol}:`, error);
                }
            }
        }

        console.log('[cleanupHelper] ✅ COMPLETE database cleanup completed');
    } catch (error) {
        console.error('[cleanupHelper] Error during complete cleanup:', error);
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
