import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from 'uuid'; // For generating unique Wallet IDs

// --- Configuration ---
// Best Practice: Get these from environment variables set on the Lambda function
// Amplify might inject these automatically, check process.env in CloudWatch logs first.
// If not injected, configure them in amplify/backend.ts or the function's resource.ts
const SINGLE_OWNER_ID = '41cba5b0-1021-7096-098d-35d33590a2e6';
const OWNER_ID_TO_SET = `${SINGLE_OWNER_ID}::${SINGLE_OWNER_ID}`;
const region = process.env.AWS_REGION || 'us-west-2'; // Replace default if needed
const apiId = process.env.AMPLIFY_GRAPHQL_API_ID || 'l5ngx5jw55c3fm6fvsnd36wsly'; // Replace placeholder or ensure env var is set
const envName = process.env.AMPLIFY_ENV || 'NONE'; // Replace placeholder or ensure env var is set (e.g., 'main', 'prod')

if (apiId === 'l5ngx5jw55c3fm6fvsnd36wsly' || envName === 'NONE') {
    console.error("FATAL: API ID or Environment Name placeholders not replaced. Update environment variables or script.");
    // Consider throwing an error to prevent execution with placeholder values in production
    // throw new Error("API ID or Environment Name not configured.");
}

// if (SINGLE_OWNER_ID === 'USER_SUB_ID_HERE' /* Or whatever placeholder you used */) {
//     console.error("FATAL: SINGLE_OWNER_ID placeholder not replaced in script.");
//     throw new Error("SINGLE_OWNER_ID not configured.");
// }

// Construct Table Names (Ensure these match your DynamoDB table names exactly)
const stockTableName = `PortfolioStock-${apiId}-${envName}`;
const transactionTableName = `Transaction-${apiId}-${envName}`;
const stockWalletTableName = `StockWallet-${apiId}-${envName}`;
// --- End Configuration ---

// Initialize DynamoDB Document Client
const ddbClient = new DynamoDBClient({ region });
const marshallOptions = { removeUndefinedValues: true }; // Remove undefined values during marshalling
const unmarshallOptions = {};
const translateConfig = { marshallOptions, unmarshallOptions };
const docClient = DynamoDBDocumentClient.from(ddbClient, translateConfig);

// Define basic types needed within the function
interface PortfolioStock { id: string; pdp?: number | null; plr?: number | null; symbol?: string | null; [key: string]: any; }
interface Transaction { id: string; portfolioStockId: string; action: string; price?: number | null; investment?: number | null; quantity?: number | null; [key: string]: any;}
// Define StockWallet type based on your schema, including all fields for creation
interface StockWalletInput {
    id: string; // Primary Key - we generate this
    portfolioStockId: string;
    buyPrice: number;
    totalInvestment: number;
    totalSharesQty: number;
    sharesSold: number;
    remainingShares: number;
    realizedPl: number;
    sellTxnCount: number; // Required field
    tpValue?: number | null; // Optional fields
    tpPercent?: number | null;
    realizedPlPercent?: number | null;
    createdAt: string; // Add timestamp
    updatedAt: string; // Add timestamp
    __typename: "StockWallet"; // Important for GraphQL API consistency
    owner?: string | null | undefined;
}


/**
 * Helper function using AWS SDK Scan for pagination
 */
async function fetchAllWithScan<T>(tableName: string): Promise<T[]> {
    console.log(`Scanning all data for ${tableName}...`);
    let allItems: T[] = [];
    let lastEvaluatedKey: Record<string, any> | undefined = undefined;
    let page = 0;
    const maxPages = 500; // Increase if needed, but watch Lambda timeout

    do {
        page++;
        if (page > maxPages) throw new Error(`Exceeded max pages (${maxPages}) scanning ${tableName}`);
        console.log(`Scanning page ${page} for ${tableName}`);

        const params: any = {
            TableName: tableName,
            ExclusiveStartKey: lastEvaluatedKey
        };

        try {
            const command = new ScanCommand(params);
            const result = await docClient.send(command);
            if (result.Items) {
                allItems = [...allItems, ...(result.Items as T[])];
            }
            lastEvaluatedKey = result.LastEvaluatedKey;
            console.log(`Scanned page ${page}. Items on page: ${result.Count ?? 0}. Total fetched so far: ${allItems.length}`);
        } catch (error: any) {
            console.error(`Error on page ${page} scanning ${tableName}:`, error);
            throw error; // Stop migration on scan error
        }
        // Optional: Add a small delay between pages if needed to avoid throttling
        // await new Promise(resolve => setTimeout(resolve, 50));
    } while (lastEvaluatedKey);

    console.log(`Finished scanning ${tableName}. Total items: ${allItems.length}`);
    return allItems;
}


/**
 * Main Lambda Handler for Wallet Migration
 */
export const handler = async (event: any): Promise<any> => {
    console.log('Starting Wallet Migration Script using AWS SDK...');
    const targetSymbols: string[] | undefined = event?.symbols; // Check for target symbols in event
    if (targetSymbols && Array.isArray(targetSymbols) && targetSymbols.length > 0) {
         console.log(`Running migration specifically for symbols: ${targetSymbols.join(', ')}`);
    } else {
         console.log('No specific symbols provided in event.symbols, processing ALL stocks.');
    }

    let stocksProcessed = 0;
    let transactionsProcessed = 0;
    let buyGroupsFound = 0;
    let walletsChecked = 0;
    let walletsCreated = 0;
    let walletsSkipped = 0; // Already existed
    let walletsFailed = 0;

    try {
        // ====================================
        // 1. Fetch ALL Portfolio Stocks
        // ====================================
        const allStocks = await fetchAllWithScan<PortfolioStock>(stockTableName);
        const stockInfoMap = new Map<string, { id: string, pdp?: number | null, plr?: number | null, symbol?: string | null }>();
        const symbolToIdMap = new Map<string, string>();
        allStocks.forEach(stock => {
             if (stock.symbol) {
                stockInfoMap.set(stock.id, { id: stock.id, pdp: stock.pdp, plr: stock.plr, symbol: stock.symbol });
                symbolToIdMap.set(stock.symbol.toUpperCase(), stock.id);
             }
        });
        stocksProcessed = stockInfoMap.size;
        console.log(`Loaded info for ${stocksProcessed} stocks.`);

        // ====================================
        // Determine Target Stock IDs
        // ====================================
        let targetStockIds: string[] = [];
        if (targetSymbols) { // If specific symbols were requested
            targetSymbols.forEach(symbol => {
                 const stockId = symbolToIdMap.get(symbol.toUpperCase());
                 if (stockId) {
                     targetStockIds.push(stockId);
                 } else {
                     console.warn(`Target symbol "${symbol}" not found in PortfolioStock table. Skipping.`);
                 }
            });
            console.log(`Mapped target symbols to ${targetStockIds.length} stock IDs: ${targetStockIds.join(', ')}`);
            if (targetStockIds.length === 0) {
                 console.log("No valid target stock IDs found. Exiting migration.");
                 return { statusCode: 200, body: JSON.stringify({ message: "No matching stocks found for provided symbols.", /* ... counters ... */ }) };
            }
        } else { // Otherwise process all stocks found
             targetStockIds = Array.from(stockInfoMap.keys());
             console.log("Processing all portfolio stock IDs.");
        }
        const targetIdSet = new Set(targetStockIds); // Use a Set for efficient lookup

        // ====================================
        // 2. Fetch ALL Transactions (and filter)
        // ====================================
        // Fetch all - Scan does not efficiently support large 'IN' filters easily
        console.log("Fetching all transactions and filtering locally...");
        const allTransactions = await fetchAllWithScan<Transaction>(transactionTableName);
        const allRelevantTransactions = allTransactions.filter(txn =>
             txn.portfolioStockId && targetIdSet.has(txn.portfolioStockId)
        );
        transactionsProcessed = allRelevantTransactions.length;
        console.log(`Loaded ${allTransactions.length} total transactions, filtered down to ${transactionsProcessed} relevant transactions.`);

        // ====================================
        // 3. Process Buy Transactions (Use filtered list)
        // ====================================
        console.log('Processing relevant Buy transactions to identify wallets...');
        // --- Define the Map structure correctly ---
        const buyGroups = new Map<string, {
             portfolioStockId: string;
             stockSymbol: string | null | undefined; // For logging
             buyPrice: number;
             totalInvestment: number;
             totalSharesQty: number;
        }>();
        // --- End Define Map Structure ---

        for (const txn of allRelevantTransactions) { // <<< Use filtered list
            if (txn.action === 'Buy' && typeof txn.price === 'number' && typeof txn.quantity === 'number' && typeof txn.investment === 'number') {
                 const key = `${txn.portfolioStockId}_${txn.price.toFixed(4)}`; // Use fixed decimal for price key
                 const stockInfo = stockInfoMap.get(txn.portfolioStockId); // Already checked txn.portfolioStockId exists
                 const group = buyGroups.get(key) ?? {
                     portfolioStockId: txn.portfolioStockId,
                     stockSymbol: stockInfo?.symbol,
                     buyPrice: txn.price,
                     totalInvestment: 0,
                     totalSharesQty: 0,
                 };
                 group.totalInvestment += txn.investment;
                 group.totalSharesQty += txn.quantity;
                 buyGroups.set(key, group);
            }
        }
        buyGroupsFound = buyGroups.size;
        console.log(`Found ${buyGroupsFound} unique relevant Buy groups (potential wallets).`);


        // ====================================
        // 4. Calculate and Create Wallets
        // ====================================
        console.log('Calculating and creating wallets...');
        for (const [key, group] of buyGroups.entries()) {
            const stockId = group.portfolioStockId;
            const buyPrice = group.buyPrice;
            walletsChecked++;

             try {
                // Idempotency Check: Query StockWallet table directly
                 console.log(`Checking for existing wallet: Stock ${group.stockSymbol ?? stockId}, Price ${buyPrice}`);
                 const checkParams = {
                     TableName: stockWalletTableName,
                     FilterExpression: "portfolioStockId = :sid AND buyPrice = :bp",
                     ExpressionAttributeValues: { ":sid": stockId, ":bp": buyPrice },
                     Limit: 1
                 };
                 const checkResult = await docClient.send(new ScanCommand(checkParams)); // Scan is okay for check with limit 1

                 if (checkResult.Items && checkResult.Items.length > 0) {
                     console.log(`Skipping: Wallet already exists for ${group.stockSymbol ?? stockId} @ ${buyPrice}`);
                     walletsSkipped++;
                     continue; // Skip to next group
                 }

                 // Wallet doesn't exist, proceed to create
                 console.log(`Creating new wallet for ${group.stockSymbol ?? stockId} @ ${buyPrice}`);
                 const stockInfo = stockInfoMap.get(stockId);
                 const pdpValue = stockInfo?.pdp;
                 const plrValue = stockInfo?.plr;
                 let tpValue: number | null = null;
                 let tpPercent: number | null = null;

                 if (typeof pdpValue === 'number' && typeof plrValue === 'number' && buyPrice !== 0) {
                     tpValue = buyPrice + (buyPrice * (pdpValue * plrValue / 100));
                     tpPercent = pdpValue * plrValue;
                 }

                 // --- Determine Owner ID ---
                 let ownerIdToSet: string | null | undefined = null;
                 // Assuming single-user based on OWNER_ID_TO_SET constant
                 ownerIdToSet = OWNER_ID_TO_SET;

                 const nowISO = new Date().toISOString();
                 const newWalletItem: StockWalletInput = {
                     id: uuidv4(), // Generate unique ID
                     portfolioStockId: stockId,
                     buyPrice: buyPrice,
                     totalInvestment: group.totalInvestment,
                     totalSharesQty: group.totalSharesQty,
                     sharesSold: 0,
                     remainingShares: group.totalSharesQty,
                     realizedPl: 0,
                     sellTxnCount: 0, // Required field
                     tpValue: tpValue, // Use undefined if null
                     tpPercent: tpPercent, // Use undefined if null
                     realizedPlPercent: undefined, // Use undefined if null
                     __typename: "StockWallet",
                     createdAt: nowISO,
                     updatedAt: nowISO,
                     owner: OWNER_ID_TO_SET,
                 };

                 console.log(`Creating wallet with item:`, newWalletItem);
                 await docClient.send(new PutCommand({
                      TableName: stockWalletTableName,
                      Item: newWalletItem,
                 }));

                 console.log(`Successfully created wallet ${newWalletItem.id} for ${group.stockSymbol ?? stockId} @ ${buyPrice}`);
                 walletsCreated++;

             } catch (error: any) {
                 console.error(`Failed to create/check wallet for ${group.stockSymbol ?? stockId} @ ${buyPrice}:`, error);
                 walletsFailed++;
             }
        }

        console.log('Wallet Migration Script finished.');
        const summary = {
            message: 'Wallet migration process completed successfully.', // Success message
            stocksProcessed,
            transactionsProcessed,
            buyGroupsFound,
            walletsChecked,
            walletsCreated,
            walletsSkipped,
            walletsFailed,
        };
        console.log("Summary:", JSON.stringify(summary, null, 2));
        return { statusCode: 200, body: JSON.stringify(summary) };

    } catch (error: any) {
        console.error("CRITICAL ERROR during migration script:", error);
        const summary = {
            message: 'Wallet migration failed critically.', // Failure message
            error: error.message || 'Unknown error', // Include error message
            stocksProcessed,
            transactionsProcessed,
            buyGroupsFound,
            walletsChecked,
            walletsCreated,
            walletsSkipped,
            walletsFailed, // Include counts up to the point of failure
       };
        console.log("Failure Summary:", JSON.stringify(summary, null, 2));
        return { statusCode: 500, body: JSON.stringify({ /* ... error details ... */ }) };
    }
};