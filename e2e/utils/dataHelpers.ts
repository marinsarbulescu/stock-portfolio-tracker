// e2e/utils/dataHelpers.ts
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';
import { Amplify } from 'aws-amplify';
import amplifyOutputs from '@/amplify_outputs.json';

try {
    Amplify.configure(amplifyOutputs, {
        // Optional: If using SSR with Amplify, you might need to specify this
        // SSR: true // Uncomment if your app uses SSR and data helpers need to be SSR-aware
    });
    console.log('Amplify configured successfully for E2E tests.');
} catch (error) {
    console.error('Error configuring Amplify for E2E tests:', error);
    // You might want to throw the error to stop tests if config fails
    // throw error;
}

const client = generateClient<Schema>();

// Type for creating a PortfolioStock (adjust based on your actual schema, omitting relationship fields)
export type PortfolioStockCreateData = Omit<Schema['PortfolioStock']['type'], 'id' | 'createdAt' | 'updatedAt' | 'owner' | 'transactions' | 'stockWallets'>;
// Type for creating a Transaction (adjust as needed)
export type TransactionCreateData = Omit<Schema['Transaction']['type'], 'id' | 'createdAt' | 'updatedAt' | 'owner' | 'portfolioStock'> & { portfolioStockId: string }; // Ensure portfolioStockId is included


export async function createPortfolioStock(stockData: PortfolioStockCreateData): Promise<Schema['PortfolioStock']['type']> {
    console.log('[DataHelper] Creating PortfolioStock:', stockData.symbol);
    const { data, errors } = await client.models.PortfolioStock.create(stockData); // Keep this destructuring

    if (errors || !data) { // Check if data exists
        console.error('[DataHelper] Error creating PortfolioStock:', errors);
        throw new Error(`Failed to create PortfolioStock: ${errors?.[0]?.message || 'No data returned from create operation'}`);
    }

    // Explicitly type newStock after checking data exists
    const newStock: Schema['PortfolioStock']['type'] = data;

    // These lines should now be type-safe
    console.log('[DataHelper] PortfolioStock created:', newStock.id, newStock.symbol);
    return newStock;
}

export async function deletePortfolioStock(stockId: string): Promise<void> {
    console.log('[DataHelper] Deleting PortfolioStock:', stockId);
    const { errors } = await client.models.PortfolioStock.delete({ id: stockId });
    if (errors) {
        console.error('[DataHelper] Error deleting PortfolioStock:', errors);
        // Don't throw if it's just "not found" during cleanup, but log it.
        if (!errors.some(err => err.message.includes('conditional request failed'))) { // Example check
             console.warn(`Attempted to delete PortfolioStock ${stockId} but failed: ${errors?.[0]?.message}`);
        }
    } else {
        console.log('[DataHelper] PortfolioStock deleted:', stockId);
    }
}

export async function createTransaction(transactionData: TransactionCreateData): Promise<Schema['Transaction']['type']> {
    console.log('[DataHelper] Creating Transaction for stock ID:', transactionData.portfolioStockId);
    // Ensure portfolioStockId is passed correctly for the relationship
    const payload = {
        ...transactionData,
        // If your schema links transactions via an object like:
        // portfolioStock: { id: transactionData.portfolioStockId }
        // then adjust the payload accordingly.
        // For a simple string ID relationship:
        // portfolioStockTransactionsId: transactionData.portfolioStockId // Or whatever your schema calls the foreign key
    };
    // If your schema expects the foreign key directly on the transaction input:
    // For example, if Transaction has a 'portfolioStockId' field for the relationship
    // and create input accepts it directly. Let's assume it's like this for now.

     // Destructure data and errors
     const { data, errors } = await client.models.Transaction.create(payload as any);

     // Check for errors OR if data is missing
     if (errors || !data) {
         console.error('[DataHelper] Error creating Transaction:', errors);
         throw new Error(`Failed to create Transaction: ${errors?.[0]?.message || 'No data returned from create operation'}`);
     }
 
     // --- Add Explicit Type Here ---
     // Now that we know 'data' exists, assign it to newTransaction with the correct type
     const newTransaction: Schema['Transaction']['type'] = data;
     // --- End Change ---
    
    console.log('[DataHelper] Transaction created:', newTransaction.id);
    return newTransaction;
}

// Helper to get a stock by symbol to find its ID for cleanup or verification
export async function getPortfolioStockBySymbol(symbol: string): Promise<Schema['PortfolioStock']['type'] | null> {
    console.log('[DataHelper] Getting PortfolioStock by symbol:', symbol);
    // Note: DataStore list operations might not support complex filters on non-indexed fields
    // directly in the same way as a GraphQL API. You might need to list all and filter client-side,
    // or ensure your schema/API supports filtering by symbol.
    // This is a simplified example.
    const { data: stocks, errors } = await client.models.PortfolioStock.list({
        // filter: { symbol: { eq: symbol } } // This filter might not work depending on your DataStore/GraphQL setup
    });
    if (errors) {
        console.error('[DataHelper] Error listing stocks to find by symbol:', errors);
        return null;
    }
    const foundStock = stocks.find(s => s.symbol === symbol);
    return foundStock || null;
}

export async function deleteTransactionsForStock(portfolioStockId: string): Promise<void> {
    console.log('[DataHelper] Deleting all transactions for stock ID:', portfolioStockId);
    const { data: transactions, errors: listErrors } = await client.models.Transaction.list({
        // filter: { portfolioStockTransactionsId: { eq: portfolioStockId } } // Adjust filter to your schema
         filter: { portfolioStockId: { eq: portfolioStockId } } // Assuming direct portfolioStockId field
    });

    if (listErrors) {
        console.error('[DataHelper] Error listing transactions for deletion:', listErrors);
        return;
    }

    for (const transaction of transactions) {
        console.log('[DataHelper] Deleting transaction:', transaction.id);
        const { errors: deleteErrors } = await client.models.Transaction.delete({ id: transaction.id });
        if (deleteErrors) {
            console.warn(`[DataHelper] Failed to delete transaction ${transaction.id}:`, deleteErrors);
        }
    }
    console.log('[DataHelper] Finished deleting transactions for stock ID:', portfolioStockId);
}