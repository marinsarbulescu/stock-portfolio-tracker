import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { fetchAuthSession } from 'aws-amplify/auth';
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

async function checkOwnerFields() {
    try {
        console.log('🔍 Checking owner fields in imported data...');
        
        // Get all stocks
        const stocksResult = await client.models.PortfolioStock.list({
            selectionSet: ['id', 'symbol', 'owner'],
            limit: 5 // Just check first few
        });
        
        console.log('📈 Portfolio Stocks owner fields:');
        stocksResult.data?.forEach(stock => {
            console.log(`  ${stock.symbol}: owner = "${stock.owner}"`);
        });
        
        // Get all wallets
        const walletsResult = await client.models.StockWallet.list({
            selectionSet: ['id', 'portfolioStockId', 'owner'],
            limit: 5 // Just check first few
        });
        
        console.log('💰 Stock Wallets owner fields:');
        walletsResult.data?.forEach(wallet => {
            console.log(`  Wallet ${wallet.id}: owner = "${wallet.owner}"`);
        });
        
        // Get all transactions
        const transactionsResult = await client.models.Transaction.list({
            selectionSet: ['id', 'portfolioStockId', 'owner'],
            limit: 5 // Just check first few
        });
        
        console.log('💸 Transactions owner fields:');
        transactionsResult.data?.forEach(txn => {
            console.log(`  Transaction ${txn.id}: owner = "${txn.owner}"`);
        });
        
        console.log('\n🔑 To fix owner field issues, you can:');
        console.log('1. Update all records to match your current user ID');
        console.log('2. Or ensure you\'re logged in with the same user that owns the production data');
        console.log('\nProduction owner ID appears to be: "41cba5b0-1021-7096-098d-35d33590a2e6"');
        
    } catch (error) {
        console.error('❌ Error checking owner fields:', error);
    }
}

await checkOwnerFields();