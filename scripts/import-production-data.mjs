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
const client = generateClient();

async function importProductionData(jsonFilePath) {
    console.log('🚀 Starting import of production data to development environment...');
    
    try {
        // Read the production data
        const data = JSON.parse(readFileSync(jsonFilePath, 'utf8'));
        console.log(`📁 Loaded export from: ${data.exportDate}`);
        console.log(`📊 Records found:`);
        console.log(`   - Stocks: ${data.portfolioStocks.length}`);
        console.log(`   - Transactions: ${data.transactions.length}`);
        console.log(`   - Wallets: ${data.stockWallets.length}`);
        console.log(`   - Goals: ${data.portfolioGoals.length}`);
        
        // Clear existing development data first
        console.log('\n🗑️  Clearing existing development data...');
        await clearDevData();
        
        // Import PortfolioStocks first (they are referenced by other tables)
        console.log('\n📥 Importing Portfolio Stocks...');
        const stockIdMap = new Map(); // Map old IDs to new IDs
        
        for (const stock of data.portfolioStocks) {
            const { id, createdAt, updatedAt, ...stockData } = stock;
            
            try {
                const result = await client.models.PortfolioStock.create(stockData);
                if (result.data && result.data.id) {
                    stockIdMap.set(id, result.data.id);
                    console.log(`   ✅ Created stock: ${stockData.symbol}`);
                }
            } catch (error) {
                console.error(`   ❌ Failed to create stock ${stockData.symbol}:`, error);
            }
        }
        
        // Import StockWallets
        console.log('\n📥 Importing Stock Wallets...');
        for (const wallet of data.stockWallets) {
            const { id, createdAt, updatedAt, portfolioStockId, ...walletData } = wallet;
            const newStockId = stockIdMap.get(portfolioStockId);
            
            if (newStockId) {
                try {
                    await client.models.StockWallet.create({
                        ...walletData,
                        portfolioStockId: newStockId
                    });
                    console.log(`   ✅ Created wallet for stock ID: ${newStockId.substring(0, 8)}...`);
                } catch (error) {
                    console.error(`   ❌ Failed to create wallet:`, error);
                }
            } else {
                console.warn(`   ⚠️  Skipped wallet - stock ID not found: ${portfolioStockId}`);
            }
        }
        
        // Import Transactions
        console.log('\n📥 Importing Transactions...');
        for (const transaction of data.transactions) {
            const { id, createdAt, updatedAt, portfolioStockId, ...transactionData } = transaction;
            const newStockId = stockIdMap.get(portfolioStockId);
            
            if (newStockId) {
                try {
                    await client.models.Transaction.create({
                        ...transactionData,
                        portfolioStockId: newStockId
                    });
                    console.log(`   ✅ Created transaction for stock ID: ${newStockId.substring(0, 8)}...`);
                } catch (error) {
                    console.error(`   ❌ Failed to create transaction:`, error);
                }
            } else {
                console.warn(`   ⚠️  Skipped transaction - stock ID not found: ${portfolioStockId}`);
            }
        }
        
        // Import PortfolioGoals
        console.log('\n📥 Importing Portfolio Goals...');
        for (const goal of data.portfolioGoals) {
            const { id, createdAt, updatedAt, ...goalData } = goal;
            
            try {
                await client.models.PortfolioGoals.create(goalData);
                console.log(`   ✅ Created portfolio goal`);
            } catch (error) {
                console.error(`   ❌ Failed to create goal:`, error);
            }
        }
        
        // Count final records in development environment
        console.log('\n📊 Counting records in development environment...');
        const finalCounts = await countRecords();
        
        console.log('\n🎉 Production data import completed successfully!');
        console.log('💡 Your development environment now has production data');
        console.log('🧪 You can now test your migration scripts on real data!');
        
    } catch (error) {
        console.error('❌ Import failed:', error);
        process.exit(1);
    }
}

async function clearDevData() {
    try {
        // Clear in reverse dependency order
        const [transactions, wallets, goals, stocks] = await Promise.all([
            client.models.Transaction.list({ limit: 1000 }),
            client.models.StockWallet.list({ limit: 1000 }),
            client.models.PortfolioGoals.list({ limit: 100 }),
            client.models.PortfolioStock.list({ limit: 1000 })
        ]);
        
        // Delete transactions first
        for (const transaction of transactions.data || []) {
            await client.models.Transaction.delete({ id: transaction.id });
        }
        
        // Delete wallets
        for (const wallet of wallets.data || []) {
            await client.models.StockWallet.delete({ id: wallet.id });
        }
        
        // Delete goals
        for (const goal of goals.data || []) {
            await client.models.PortfolioGoals.delete({ id: goal.id });
        }
        
        // Delete stocks last
        for (const stock of stocks.data || []) {
            await client.models.PortfolioStock.delete({ id: stock.id });
        }
        
        console.log('✅ Cleared existing development data');
    } catch (error) {
        console.error('⚠️  Error clearing data:', error);
    }
}

async function countRecords() {
    try {
        const [stocks, transactions, wallets, goals] = await Promise.all([
            client.models.PortfolioStock.list({ limit: 1000 }),
            client.models.Transaction.list({ limit: 2000 }),
            client.models.StockWallet.list({ limit: 1000 }),
            client.models.PortfolioGoals.list({ limit: 100 })
        ]);
        
        console.log(`📈 Final counts in development database:`);
        console.log(`   - Portfolio Stocks: ${stocks.data?.length || 0}`);
        console.log(`   - Transactions: ${transactions.data?.length || 0}`);
        console.log(`   - Stock Wallets: ${wallets.data?.length || 0}`);
        console.log(`   - Portfolio Goals: ${goals.data?.length || 0}`);
        
        return {
            stocks: stocks.data?.length || 0,
            transactions: transactions.data?.length || 0,
            wallets: wallets.data?.length || 0,
            goals: goals.data?.length || 0
        };
    } catch (error) {
        console.error('⚠️  Error counting records:', error);
        return { stocks: 0, transactions: 0, wallets: 0, goals: 0 };
    }
}

// Get the JSON file path from command line argument
const jsonFilePath = process.argv[2];

if (!jsonFilePath) {
    console.error('❌ Please provide the path to your exported JSON file');
    console.error('📝 Usage: node scripts/import-production-data.mjs path/to/your/exported-file.json');
    process.exit(1);
}

importProductionData(jsonFilePath);