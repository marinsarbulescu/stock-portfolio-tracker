import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get directory paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = dirname(__dirname);

// Load development amplify outputs
const amplifyOutputs = JSON.parse(readFileSync(join(projectRoot, 'amplify_outputs.json'), 'utf8'));

// Configure Amplify for development environment
Amplify.configure(amplifyOutputs);
const client = generateClient({
    authMode: 'apiKey',
    apiKey: amplifyOutputs.data.api_key
});

async function importAllProductionData(jsonFilePath, targetOwnerId) {
    console.log('🚀 Starting comprehensive import of production data to development environment...');
    
    try {
        // Read the production data
        const data = JSON.parse(readFileSync(jsonFilePath, 'utf8'));
        console.log(`📁 Loaded export from: ${data.exportDate}`);
        console.log(`📊 Records to import:`);
        console.log(`   - Portfolio Stocks: ${data.portfolioStocks.length}`);
        console.log(`   - Stock Wallets: ${data.stockWallets.length}`);
        console.log(`   - Transactions: ${data.transactions.length}`);
        console.log(`   - Portfolio Goals: ${data.portfolioGoals.length}`);
        
        if (targetOwnerId) {
            console.log(`👤 Target owner ID: ${targetOwnerId}`);
        } else {
            console.log('⚠️  No target owner ID provided - using original owner values');
        }
        
        // Clear existing data in proper order (dependencies first)
        console.log('\n🗑️  Clearing existing development data...');
        await clearAllData();
        
        // Track stock ID mappings for relationships
        const stockIdMap = new Map();
        
        // Step 1: Import PortfolioStock records first (no dependencies)
        console.log('\n📈 Importing Portfolio Stocks...');
        const stockResults = await importPortfolioStocks(data.portfolioStocks, stockIdMap, targetOwnerId);
        
        // Step 2: Import StockWallet records (depend on stocks)
        console.log('\n💰 Importing Stock Wallets...');
        const walletResults = await importStockWallets(data.stockWallets, stockIdMap, targetOwnerId);
        
        // Step 3: Import Transaction records (depend on stocks)
        console.log('\n💸 Importing Transactions...');
        const transactionResults = await importTransactions(data.transactions, stockIdMap, targetOwnerId);
        
        // Step 4: Import PortfolioGoals records (no dependencies)
        console.log('\n🎯 Importing Portfolio Goals...');
        const goalsResults = await importPortfolioGoals(data.portfolioGoals, targetOwnerId);
        
        // Final summary
        console.log('\n📊 Import Summary:');
        console.log(`   📈 Portfolio Stocks: ${stockResults.success}/${stockResults.total} imported`);
        console.log(`   💰 Stock Wallets: ${walletResults.success}/${walletResults.total} imported`);
        console.log(`   💸 Transactions: ${transactionResults.success}/${transactionResults.total} imported`);
        console.log(`   🎯 Portfolio Goals: ${goalsResults.success}/${goalsResults.total} imported`);
        
        // Final count verification
        await countFinalRecords();
        
        console.log('\n🎉 Production data import completed successfully!');
        console.log('💡 Your development environment now has comprehensive production data');
        console.log('🧪 You can now test your migration scripts on real data!');
        
    } catch (error) {
        console.error('❌ Import failed:', error);
        process.exit(1);
    }
}

async function clearAllData() {
    try {
        // Clear in dependency order: transactions -> wallets -> goals -> stocks
        console.log('   Clearing transactions...');
        const transactions = await client.models.Transaction.list({ limit: 2000 });
        if (transactions.data && transactions.data.length > 0) {
            for (const txn of transactions.data) {
                await client.models.Transaction.delete({ id: txn.id });
            }
            console.log(`   ✅ Cleared ${transactions.data.length} transactions`);
        }
        
        console.log('   Clearing stock wallets...');
        const wallets = await client.models.StockWallet.list({ limit: 1000 });
        if (wallets.data && wallets.data.length > 0) {
            for (const wallet of wallets.data) {
                await client.models.StockWallet.delete({ id: wallet.id });
            }
            console.log(`   ✅ Cleared ${wallets.data.length} stock wallets`);
        }
        
        console.log('   Clearing portfolio goals...');
        const goals = await client.models.PortfolioGoals.list({ limit: 100 });
        if (goals.data && goals.data.length > 0) {
            for (const goal of goals.data) {
                await client.models.PortfolioGoals.delete({ id: goal.id });
            }
            console.log(`   ✅ Cleared ${goals.data.length} portfolio goals`);
        }
        
        console.log('   Clearing portfolio stocks...');
        const stocks = await client.models.PortfolioStock.list({ limit: 1000 });
        if (stocks.data && stocks.data.length > 0) {
            for (const stock of stocks.data) {
                await client.models.PortfolioStock.delete({ id: stock.id });
            }
            console.log(`   ✅ Cleared ${stocks.data.length} portfolio stocks`);
        }
        
        console.log('   ✅ All existing data cleared successfully');
    } catch (error) {
        console.error('   ⚠️  Error clearing data:', error.message);
    }
}

async function importPortfolioStocks(stocks, stockIdMap, targetOwnerId) {
    let successCount = 0;
    let errorCount = 0;
    
    for (const stock of stocks) {
        try {
            // Remove system fields that shouldn't be imported, but update owner
            const { id, createdAt, updatedAt, owner, ...stockData } = stock;
            stockData.owner = targetOwnerId;
            
            const result = await client.models.PortfolioStock.create(stockData);
            if (result.data && result.data.id) {
                stockIdMap.set(id, result.data.id);
                successCount++;
                if (successCount % 10 === 0) {
                    console.log(`   Created ${successCount}/${stocks.length} stocks...`);
                }
            } else {
                console.log(`   ⚠️  No data returned for: ${stockData.symbol}`);
                errorCount++;
            }
        } catch (error) {
            console.error(`   ❌ Failed to create ${stock.symbol}:`, error.message);
            errorCount++;
        }
    }
    
    console.log(`   ✅ Portfolio Stocks completed: ${successCount} created, ${errorCount} failed`);
    return { success: successCount, failed: errorCount, total: stocks.length };
}

async function importStockWallets(wallets, stockIdMap, targetOwnerId) {
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    
    console.log(`   Starting to import ${wallets.length} wallets...`);
    console.log(`   Stock ID mappings available: ${stockIdMap.size}`);
    
    for (const wallet of wallets) {
        try {
            const { id, createdAt, updatedAt, portfolioStockId, owner, ...walletData } = wallet;
            const newStockId = stockIdMap.get(portfolioStockId);
            
            if (newStockId) {
                // Create clean wallet data with proper field mapping and owner
                const cleanWalletData = {
                    portfolioStockId: newStockId,
                    walletType: walletData.walletType,
                    buyPrice: walletData.buyPrice,
                    totalSharesQty: walletData.totalSharesQty,
                    totalInvestment: walletData.totalInvestment,
                    sharesSold: walletData.sharesSold,
                    sellTxnCount: walletData.sellTxnCount,
                    // Optional fields
                    remainingShares: walletData.remainingShares,
                    archived: walletData.archived,
                    archivedAt: walletData.archivedAt,
                    realizedPl: walletData.realizedPl,
                    realizedPlPercent: walletData.realizedPlPercent,
                    // Both tpValue and stpValue are supported
                    tpValue: walletData.tpValue,
                    stpValue: walletData.tpValue, // Map tpValue to stpValue
                    owner: targetOwnerId
                };
                
                const result = await client.models.StockWallet.create(cleanWalletData);
                if (result.data && result.data.id) {
                    successCount++;
                    if (successCount % 20 === 0) {
                        console.log(`   Created ${successCount}/${wallets.length} wallets...`);
                    }
                } else {
                    console.error(`   ❌ No data returned for wallet: ${JSON.stringify(cleanWalletData).substring(0, 100)}...`);
                    if (result.errors && result.errors.length > 0) {
                        console.error(`   Error details:`, result.errors[0]);
                    }
                    errorCount++;
                }
            } else {
                console.log(`   ⚠️  Skipped wallet - stock ID not found: ${portfolioStockId}`);
                skippedCount++;
                if (skippedCount % 50 === 0) {
                    console.log(`   Skipped ${skippedCount} wallets (stock not found)...`);
                }
            }
        } catch (error) {
            console.error(`   ❌ Failed to create wallet:`, error.message);
            console.error(`   Wallet data: ${JSON.stringify(wallet).substring(0, 200)}...`);
            errorCount++;
            if (errorCount <= 5) { // Only show first few detailed errors
                console.error(`   Full error:`, error);
            }
        }
    }
    
    console.log(`   ✅ Stock Wallets completed: ${successCount} created, ${errorCount} failed, ${skippedCount} skipped`);
    return { success: successCount, failed: errorCount, skipped: skippedCount, total: wallets.length };
}

async function importTransactions(transactions, stockIdMap, targetOwnerId) {
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    
    for (const txn of transactions) {
        try {
            const { id, createdAt, updatedAt, portfolioStockId, owner, ...txnData } = txn;
            const newStockId = stockIdMap.get(portfolioStockId);
            
            if (newStockId) {
                const result = await client.models.Transaction.create({
                    ...txnData,
                    portfolioStockId: newStockId,
                    owner: targetOwnerId
                });
                if (result.data && result.data.id) {
                    successCount++;
                    if (successCount % 50 === 0) {
                        console.log(`   Created ${successCount}/${transactions.length} transactions...`);
                    }
                } else {
                    errorCount++;
                }
            } else {
                skippedCount++;
                if (skippedCount % 100 === 0) {
                    console.log(`   Skipped ${skippedCount} transactions (stock not found)...`);
                }
            }
        } catch (error) {
            console.error(`   ❌ Failed to create transaction:`, error.message);
            errorCount++;
        }
    }
    
    console.log(`   ✅ Transactions completed: ${successCount} created, ${errorCount} failed, ${skippedCount} skipped`);
    return { success: successCount, failed: errorCount, skipped: skippedCount, total: transactions.length };
}

async function importPortfolioGoals(goals, targetOwnerId) {
    let successCount = 0;
    let errorCount = 0;
    
    for (const goal of goals) {
        try {
            const { id, createdAt, updatedAt, owner, ...goalData } = goal;
            goalData.owner = targetOwnerId;
            
            const result = await client.models.PortfolioGoals.create(goalData);
            if (result.data && result.data.id) {
                successCount++;
            } else {
                errorCount++;
            }
        } catch (error) {
            console.error(`   ❌ Failed to create goal:`, error.message);
            errorCount++;
        }
    }
    
    console.log(`   ✅ Portfolio Goals completed: ${successCount} created, ${errorCount} failed`);
    return { success: successCount, failed: errorCount, total: goals.length };
}

async function countFinalRecords() {
    console.log('\n📊 Final record counts in development database:');
    try {
        const [stocks, wallets, transactions, goals] = await Promise.all([
            client.models.PortfolioStock.list({ limit: 1000 }),
            client.models.StockWallet.list({ limit: 1000 }),
            client.models.Transaction.list({ limit: 2000 }),
            client.models.PortfolioGoals.list({ limit: 100 })
        ]);
        
        console.log(`   📈 Portfolio Stocks: ${stocks.data?.length || 0}`);
        console.log(`   💰 Stock Wallets: ${wallets.data?.length || 0}`);
        console.log(`   💸 Transactions: ${transactions.data?.length || 0}`);
        console.log(`   🎯 Portfolio Goals: ${goals.data?.length || 0}`);
    } catch (error) {
        console.error('   ⚠️  Error counting final records:', error.message);
    }
}

// Function to prompt user for owner ID
async function promptForOwnerId() {
    const { createInterface } = await import('readline');
    const readline = createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    return new Promise((resolve) => {
        console.log('\n🔐 OWNER ID REQUIRED FOR DATA IMPORT');
        console.log('   To ensure the imported data is associated with your user account,');
        console.log('   please provide your current user/owner ID.');
        console.log('');
        console.log('   💡 You can find your owner ID by:');
        console.log('   1. Opening the browser dev tools (F12)');
        console.log('   2. Going to the Console tab');
        console.log('   3. Running: localStorage.getItem("amplify::userId")');
        console.log('   4. Or checking your browser console logs on any authenticated page');
        console.log('');
        
        readline.question('📝 Enter your owner ID: ', (ownerId) => {
            readline.close();
            if (!ownerId || ownerId.trim().length === 0) {
                console.error('❌ Owner ID is required. Exiting.');
                process.exit(1);
            }
            resolve(ownerId.trim());
        });
    });
}

// Get the JSON file path from command line argument
const jsonFilePath = process.argv[2];

if (!jsonFilePath) {
    console.error('❌ Please provide the path to your exported JSON file');
    console.error('📝 Usage: node scripts/import-all-production-data.mjs path/to/your/exported-file.json');
    process.exit(1);
}

// Main execution with user prompting
(async () => {
    try {
        const targetOwnerId = await promptForOwnerId();
        console.log(`\n✅ Using owner ID: ${targetOwnerId}`);
        console.log('   All imported data will be associated with this user.\n');
        
        await importAllProductionData(jsonFilePath, targetOwnerId);
    } catch (error) {
        console.error('❌ Import failed:', error.message);
        process.exit(1);
    }
})();