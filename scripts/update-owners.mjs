import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { fetchAuthSession, getCurrentUser } from 'aws-amplify/auth';
import amplifyOutputs from '../amplify_outputs.json' with { type: 'json' };

// Configure Amplify for user authentication
Amplify.configure(amplifyOutputs);

const client = generateClient();

async function updateOwnerFields() {
    try {
        console.log('🔍 Getting current user information...');
        
        // Get current user
        const user = await getCurrentUser();
        const session = await fetchAuthSession();
        const currentUserId = user.userId;
        
        console.log('👤 Current user ID:', currentUserId);
        
        if (!currentUserId) {
            console.error('❌ No current user found. Please make sure you are logged in.');
            return;
        }
        
        console.log('\n📊 Starting owner field updates...');
        
        // Update Portfolio Stocks
        console.log('\n📈 Updating Portfolio Stocks...');
        const stocksResult = await client.models.PortfolioStock.list();
        let stockUpdateCount = 0;
        
        for (const stock of stocksResult.data || []) {
            if (stock.owner !== currentUserId) {
                try {
                    await client.models.PortfolioStock.update({
                        id: stock.id,
                        owner: currentUserId
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
        const walletsResult = await client.models.StockWallet.list();
        let walletUpdateCount = 0;
        
        for (const wallet of walletsResult.data || []) {
            if (wallet.owner !== currentUserId) {
                try {
                    await client.models.StockWallet.update({
                        id: wallet.id,
                        owner: currentUserId
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
        
        for (const transaction of allTransactions) {
            if (transaction.owner !== currentUserId) {
                try {
                    await client.models.Transaction.update({
                        id: transaction.id,
                        owner: currentUserId
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
        if (error.name === 'NotAuthenticatedException') {
            console.log('\n💡 Please run: npm run dev');
            console.log('   Then log into the app and run this script again.');
        }
    }
}

console.log('🚀 Updating owner fields for imported production data...');
console.log('📝 This will change all records to be owned by your current user');
console.log('');

await updateOwnerFields();