import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import amplifyOutputs from '../amplify_outputs.json' with { type: 'json' };

// Configure Amplify
Amplify.configure(amplifyOutputs, {
    Auth: {
        credentialsProvider: {
            getCredentialsAndIdentityId: async () => ({
                credentials: {
                    accessKeyId: 'test',
                    secretAccessKey: 'test',
                },
            }),
            clearCredentialsAndIdentityId: () => {
                // noop
            },
        },
    },
});

const client = generateClient({
    authMode: 'apiKey',
});

async function updateOwnersWithApiKey(newOwnerId) {
    try {
        console.log('🚀 Updating owner fields using API Key...');
        console.log('👤 New owner ID:', newOwnerId);
        console.log('');
        
        // Update Portfolio Stocks
        console.log('📈 Updating Portfolio Stocks...');
        const stocksResult = await client.models.PortfolioStock.list();
        let stockUpdateCount = 0;
        
        for (const stock of stocksResult.data || []) {
            if (stock.owner !== newOwnerId) {
                try {
                    await client.models.PortfolioStock.update({
                        id: stock.id,
                        owner: newOwnerId
                    });
                    stockUpdateCount++;
                    if (stockUpdateCount % 10 === 0) {
                        console.log(`  Updated ${stockUpdateCount} stocks...`);
                    }
                } catch (error) {
                    console.error(`  ❌ Failed to update stock ${stock.symbol}:`, error);
                }
            }
        }
        console.log(`✅ Updated ${stockUpdateCount} portfolio stocks`);
        
        // Update Stock Wallets
        console.log('\n💰 Updating Stock Wallets...');
        const walletsResult = await client.models.StockWallet.list({
            limit: 5000 // Get more wallets
        });
        let walletUpdateCount = 0;
        
        for (const wallet of walletsResult.data || []) {
            if (wallet.owner !== newOwnerId) {
                try {
                    await client.models.StockWallet.update({
                        id: wallet.id,
                        owner: newOwnerId
                    });
                    walletUpdateCount++;
                    if (walletUpdateCount % 50 === 0) {
                        console.log(`  Updated ${walletUpdateCount} wallets...`);
                    }
                } catch (error) {
                    console.error(`  ❌ Failed to update wallet ${wallet.id}:`, error);
                }
            }
        }
        console.log(`✅ Updated ${walletUpdateCount} stock wallets`);
        
        // Update Transactions
        console.log('\n💸 Updating Transactions...');
        let transactionUpdateCount = 0;
        let allTransactions = [];
        let nextToken = null;
        
        // Paginate through all transactions
        do {
            const txnResult = await client.models.Transaction.list({
                nextToken,
                limit: 100
            });
            allTransactions.push(...(txnResult.data || []));
            nextToken = txnResult.nextToken;
        } while (nextToken);
        
        console.log(`Found ${allTransactions.length} total transactions`);
        
        for (const transaction of allTransactions) {
            if (transaction.owner !== newOwnerId) {
                try {
                    await client.models.Transaction.update({
                        id: transaction.id,
                        owner: newOwnerId
                    });
                    transactionUpdateCount++;
                    if (transactionUpdateCount % 100 === 0) {
                        console.log(`  Updated ${transactionUpdateCount} transactions...`);
                    }
                } catch (error) {
                    console.error(`  ❌ Failed to update transaction ${transaction.id}:`, error);
                }
            }
        }
        console.log(`✅ Updated ${transactionUpdateCount} transactions`);
        
        console.log('\n🎉 Owner field updates completed!');
        console.log('📊 Summary:');
        console.log(`  📈 Portfolio Stocks: ${stockUpdateCount} updated`);
        console.log(`  💰 Stock Wallets: ${walletUpdateCount} updated`);
        console.log(`  💸 Transactions: ${transactionUpdateCount} updated`);
        console.log('\n✅ The signals page should now show your imported data!');
        
    } catch (error) {
        console.error('❌ Error updating owner fields:', error);
    }
}

// Get the new owner ID from command line argument
const newOwnerId = process.argv[2];

if (!newOwnerId) {
    console.error('❌ Please provide the new owner ID as an argument');
    console.log('📝 Usage: node scripts/update-owners-api.mjs <your-user-id>');
    console.log('');
    console.log('💡 To get your user ID:');
    console.log('   1. Start dev server: npm run dev');
    console.log('   2. Open browser console on signals page');  
    console.log('   3. Look for "[Signals] Current user session info" log');
    console.log('   4. Copy the "userId" value');
    console.log('');
    console.log('🔍 Or check what the current owner ID should be by running the app and checking the logs');
    process.exit(1);
}

console.log('🚀 Updating owner fields for imported production data...');
console.log('📝 This will change all records to be owned by the specified user');
console.log('');

await updateOwnersWithApiKey(newOwnerId);