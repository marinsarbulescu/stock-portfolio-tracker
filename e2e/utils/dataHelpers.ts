// e2e/utils/dataHelpers.ts
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';

let client: ReturnType<typeof generateClient<Schema>>; // Declare client variable

// Function to get or initialize the client
function getAmplifyClient() {
    if (!client) {
        // This check now happens on first use of a dataHelper function
        if (!process.env.AMPLIFY_API_KEY) {
            const errorMessage = "[dataHelpers.ts] - CRITICAL: AMPLIFY_API_KEY environment variable is not set. Data helper functions will fail authentication. Ensure .env is loaded via playwright.config.ts or globalSetup.";
            console.error(errorMessage);
            throw new Error(errorMessage); // Fail hard if key is missing when needed
        }
        console.log('[dataHelpers.ts] - Initializing Amplify client with API Key...');
        client = generateClient<Schema>({
            authMode: 'apiKey',
            apiKey: process.env.AMPLIFY_API_KEY
        });
    }
    return client;
}

// Type for creating a PortfolioStock (adjust based on your actual schema, omitting relationship fields)
export type PortfolioStockCreateData = Omit<Schema['PortfolioStock']['type'], 'id' | 'createdAt' | 'updatedAt' | 'transactions' | 'stockWallets'> & { owner: string }; // Ensure owner can be passed
// Type for creating a Transaction (adjust as needed)
export type TransactionCreateData = Omit<Schema['Transaction']['type'], 'id' | 'createdAt' | 'updatedAt' | 'owner' | 'portfolioStock'> & { portfolioStockId: string, owner: string; }; // Ensure portfolioStockId is included


export async function createPortfolioStock(stockData: PortfolioStockCreateData): Promise<Schema['PortfolioStock']['type']> {
    const localClient = getAmplifyClient();
    console.log('[dataHelpers.ts] - Creating PortfolioStock:', stockData.symbol);
    const { data, errors } = await localClient.models.PortfolioStock.create(stockData); // Keep this destructuring

    if (errors || !data) { // Check if data exists
        console.error('[dataHelpers.ts] - Error creating PortfolioStock:', errors);
        throw new Error(`Failed to create PortfolioStock: ${errors?.[0]?.message || 'No data returned from create operation'}`);
    }

    // Explicitly type newStock after checking data exists
    const newStock: Schema['PortfolioStock']['type'] = data;

    // These lines should now be type-safe
    console.log('[dataHelpers.ts] - PortfolioStock created:', newStock.id, newStock.symbol);
    return newStock;
}

export async function deletePortfolioStock(stockId: string): Promise<void> {
    const localClient = getAmplifyClient();
    console.log('[dataHelpers.ts] - Deleting PortfolioStock:', stockId);
    const { errors } = await localClient.models.PortfolioStock.delete({ id: stockId });
    if (errors) {
        console.error('[dataHelpers.ts] - Error deleting PortfolioStock:', errors);
        // Don't throw if it's just "not found" during cleanup, but log it.
        if (!errors.some(err => err.message.includes('conditional request failed'))) { // Example check
             console.warn(`Attempted to delete PortfolioStock ${stockId} but failed: ${errors?.[0]?.message}`);
        }
    } else {
        console.log('[dataHelpers.ts] - PortfolioStock deleted:', stockId);
    }
}

export async function createTransaction(transactionData: TransactionCreateData): Promise<Schema['Transaction']['type']> {
    const localClient = getAmplifyClient();
    console.log('[dataHelpers.ts] - Creating Transaction for stock ID:', transactionData.portfolioStockId, 'owned by', transactionData.owner);
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
     const { data, errors } = await localClient.models.Transaction.create(payload as any);

     // Check for errors OR if data is missing
     if (errors || !data) {
         console.error('[dataHelpers.ts] - Error creating Transaction:', errors);
         throw new Error(`Failed to create Transaction: ${errors?.[0]?.message || 'No data returned from create operation'}`);
     }
 
     // --- Add Explicit Type Here ---
     // Now that we know 'data' exists, assign it to newTransaction with the correct type
     const newTransaction: Schema['Transaction']['type'] = data;
     // --- End Change ---
    
    console.log('[dataHelpers.ts] - Transaction created:', newTransaction.id);
    return newTransaction;
}

// Helper to get a stock by symbol to find its ID for cleanup or verification
export async function getPortfolioStockBySymbol(symbol: string): Promise<Schema['PortfolioStock']['type'] | null> {
    const localClient = getAmplifyClient();
    console.log('[dataHelpers.ts] - Getting PortfolioStock by symbol:', symbol);
    // Note: DataStore list operations might not support complex filters on non-indexed fields
    // directly in the same way as a GraphQL API. You might need to list all and filter client-side,
    // or ensure your schema/API supports filtering by symbol.
    // This is a simplified example.
    const { data: stocks, errors } = await localClient.models.PortfolioStock.list({
        // filter: { symbol: { eq: symbol } } // This filter might not work depending on your DataStore/GraphQL setup
    });
    if (errors) {
        console.error('[dataHelpers.ts] - Error listing stocks to find by symbol:', errors);
        return null;
    }
    const foundStock = stocks.find(s => s.symbol === symbol);
    return foundStock || null;
}

export async function deleteTransactionsForStockByStockId(portfolioStockId: string): Promise<void> {
    const localClient = getAmplifyClient();
    console.log('[dataHelpers.ts] - Deleting all transactions for stock ID:', portfolioStockId);
    const { data: transactions, errors: listErrors } = await localClient.models.Transaction.list({
        // filter: { portfolioStockTransactionsId: { eq: portfolioStockId } } // Adjust filter to your schema
         filter: { portfolioStockId: { eq: portfolioStockId } } // Assuming direct portfolioStockId field
    });

    if (listErrors) {
        console.error('[dataHelpers.ts] - Error listing transactions for deletion:', listErrors);
        return;
    }

    for (const transaction of transactions) {
        console.log('[dataHelpers.ts] - Deleting transaction:', transaction.id);
        const { errors: deleteErrors } = await localClient.models.Transaction.delete({ id: transaction.id });
        if (deleteErrors) {
            console.warn(`[dataHelpers.ts] - Failed to delete transaction ${transaction.id}:`, deleteErrors);
        }
    }
    console.log('[dataHelpers.ts] - Finished deleting transactions for stock ID:', portfolioStockId);
}

export async function updatePortfolioStock(stockId: string, updateData: Partial<Omit<Schema['PortfolioStock']['type'], 'id' | 'createdAt' | 'updatedAt'>>): Promise<Schema['PortfolioStock']['type']> {
    const localClient = getAmplifyClient();
    console.log('[dataHelpers.ts] - Updating PortfolioStock:', stockId, updateData);
    
    const { data, errors } = await localClient.models.PortfolioStock.update({
        id: stockId,
        ...updateData
    });

    if (errors || !data) {
        console.error('[dataHelpers.ts] - Error updating PortfolioStock:', errors);
        throw new Error(`Failed to update PortfolioStock: ${errors?.[0]?.message || 'No data returned from update operation'}`);
    }

    const updatedStock: Schema['PortfolioStock']['type'] = data;
    console.log('[dataHelpers.ts] - PortfolioStock updated:', updatedStock.id, updatedStock.symbol);
    return updatedStock;
}

export async function deleteStockWalletsForStockByStockId(portfolioStockId: string): Promise<void> {
    const localClient = getAmplifyClient();
    console.log(`[dataHelpers.ts] - Attempting to delete all StockWallets for stock ID: ${portfolioStockId}`);
    try {
        // 1. List all StockWallets for the given portfolioStockId
        // We only need the 'id' of each wallet to delete it.
        const { data: wallets, errors: listErrors } = await localClient.models.StockWallet.list({
            filter: { portfolioStockId: { eq: portfolioStockId } },
            selectionSet: ['id'], // Only fetch IDs
            // Set a limit high enough for test scenarios; default is 100.
            // If a single test stock could somehow generate >1000 wallets (highly unlikely), this needs pagination.
            limit: 1000
        });

        if (listErrors) {
            console.error('[dataHelpers.ts] - Error listing StockWallets for deletion:', listErrors);
            // Depending on your test strategy, you might throw or just log and continue
            throw listErrors;
        }

        if (!wallets || wallets.length === 0) {
            console.log(`[dataHelpers.ts] - No StockWallets found for stock ID ${portfolioStockId} to delete.`);
            return;
        }

        console.log(`[dataHelpers.ts] - Found ${wallets.length} StockWallets to delete for stock ID ${portfolioStockId}.`);

        // 2. Delete each StockWallet found
        // Use Promise.all to run deletions in parallel for efficiency, but handle individual errors.
        const deletePromises = wallets.map(async (wallet) => {
            if (wallet.id) {
                console.log(`[dataHelpers.ts] - Deleting StockWallet: ${wallet.id}`);
                const { errors: deleteErrors } = await localClient.models.StockWallet.delete({ id: wallet.id });
                if (deleteErrors) {
                    console.error(`[dataHelpers.ts] - Error deleting StockWallet ${wallet.id}:`, deleteErrors);
                    // Optionally, collect errors instead of throwing immediately to attempt all deletions
                    return { id: wallet.id, error: deleteErrors };
                }
                return { id: wallet.id, error: null };
            }
            return null;
        });

        const results = await Promise.all(deletePromises);
        const failedDeletions = results.filter(r => r && r.error);

        if (failedDeletions.length > 0) {
            console.warn(`[dataHelpers.ts] - Failed to delete ${failedDeletions.length} StockWallets for stock ID ${portfolioStockId}.`);
            // You might want to throw an error here if any sub-deletion fails to make the test suite aware
            // throw new Error(`Partial failure in deleting StockWallets: ${JSON.stringify(failedDeletions)}`);
        }

        console.log(`[dataHelpers.ts] - Finished attempting to delete StockWallets for stock ID: ${portfolioStockId}`);

    } catch (error) {
        console.error(`[dataHelpers.ts] - Critical error in deleteStockWalletsForStockByStockId for ${portfolioStockId}:`, error);
        // Re-throw to ensure the test framework knows cleanup might have failed
        throw error;
    }
}