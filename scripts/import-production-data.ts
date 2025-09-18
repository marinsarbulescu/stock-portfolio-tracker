/**
 * Import Production Data Script
 * 
 * This script imports production data to the development environment.
 * 
 * Usage:
 *   npm run import:production <path-to-json-file>
 * 
 * Example:
 *   npm run import:production ./production-export-2024.json
 * 
 * The script will:
 * 1. Clear all existing data in development
 * 2. Import stocks, wallets, transactions, and goals from the JSON file
 * 3. Re-map all IDs to maintain relationships
 */

import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { Schema } from '../amplify/data/resource';

// Get directory paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = dirname(dirname(__dirname));

// Load development amplify outputs
const amplifyOutputs = JSON.parse(readFileSync(join(projectRoot, 'amplify_outputs.json'), 'utf8'));

// Configure Amplify for development environment
Amplify.configure(amplifyOutputs);
const client = generateClient<Schema>();

async function importProductionData(jsonFilePath: string) {
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
                const { data: createdStock, errors } = await client.models.PortfolioStock.create(stockData);
                if (errors || !createdStock) {
                    console.error(`   ❌ Failed to create stock ${stockData.symbol}:`, errors);
                } else {
                    // Type assertion to help TypeScript understand the structure
                    const stockRecord = createdStock as Schema['PortfolioStock']['type'];
                    stockIdMap.set(id, stockRecord.id);
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
                    const { data: createdWallet, errors } = await client.models.StockWallet.create({
                        ...walletData,
                        portfolioStockId: newStockId
                    });
                    if (errors || !createdWallet) {
                        console.error(`   ❌ Failed to create wallet:`, errors);
                    } else {
                        console.log(`   ✅ Created wallet for stock ID: ${newStockId.substring(0, 8)}...`);
                    }
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
                    const { data: createdTransaction, errors } = await client.models.Transaction.create({
                        ...transactionData,
                        portfolioStockId: newStockId
                    });
                    if (errors || !createdTransaction) {
                        console.error(`   ❌ Failed to create transaction:`, errors);
                    } else {
                        console.log(`   ✅ Created transaction for stock ID: ${newStockId.substring(0, 8)}...`);
                    }
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
                const { data: createdGoal, errors } = await client.models.PortfolioGoals.create(goalData);
                if (errors || !createdGoal) {
                    console.error(`   ❌ Failed to create goal:`, errors);
                } else {
                    console.log(`   ✅ Created portfolio goal`);
                }
            } catch (error) {
                console.error(`   ❌ Failed to create goal:`, error);
            }
        }
        
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
            client.models.Transaction.list({ limit: 5000 }),
            client.models.StockWallet.list({ limit: 2000 }),
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

// Get the JSON file path from command line argument
const jsonFilePath = process.argv[2];

if (!jsonFilePath) {
    console.error('❌ Please provide the path to your exported JSON file');
    console.error('📝 Usage: npm run import-production-data path/to/your/exported-file.json');
    process.exit(1);
}

importProductionData(jsonFilePath);