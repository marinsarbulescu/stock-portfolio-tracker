import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import amplifyOutputs from '../amplify_outputs.json' with { type: 'json' };
import { readFileSync } from 'fs';

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

async function testSingleWalletImport(jsonFilePath) {
    try {
        console.log('🔍 Testing single StockWallet import...');
        
        const data = JSON.parse(readFileSync(jsonFilePath, 'utf8'));
        const wallets = data.stockWallets;
        const stocks = data.portfolioStocks;
        
        console.log(`Found ${wallets.length} wallets and ${stocks.length} stocks`);
        
        // Create stock ID mapping from first few stocks
        const stockIdMap = new Map();
        const firstStock = stocks[0];
        
        // Import first stock
        const { id: stockId, createdAt, updatedAt, ...stockData } = firstStock;
        console.log('Creating test stock...', stockData.symbol);
        
        const stockResult = await client.models.PortfolioStock.create({
            ...stockData,
            owner: stockData.owner
        });
        
        if (stockResult.data && stockResult.data.id) {
            stockIdMap.set(stockId, stockResult.data.id);
            console.log(`✅ Stock created: ${stockResult.data.symbol} (${stockResult.data.id})`);
        } else {
            console.error('❌ Stock creation failed');
            return;
        }
        
        // Try to import first wallet for this stock
        const firstWallet = wallets.find(w => w.portfolioStockId === stockId);
        if (!firstWallet) {
            console.error('❌ No wallet found for first stock');
            return;
        }
        
        console.log('Testing wallet creation with data:', JSON.stringify(firstWallet, null, 2));
        
        const { id: walletId, createdAt: wCreatedAt, updatedAt: wUpdatedAt, portfolioStockId, ...walletData } = firstWallet;
        
        // Include all available fields based on successful test
        const cleanWalletData = {
            portfolioStockId: stockIdMap.get(portfolioStockId),
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
            stpValue: walletData.tpValue, // Map tpValue to stpValue as well
            owner: firstWallet.owner
        };
        
        console.log('Cleaned wallet data:', JSON.stringify(cleanWalletData, null, 2));
        
        const result = await client.models.StockWallet.create(cleanWalletData);
        
        console.log('Raw result:', JSON.stringify(result, null, 2));
        
        if (result.data && result.data.id) {
            console.log(`✅ Wallet created successfully: ${result.data.id}`);
        } else {
            console.error('❌ Wallet creation returned no data');
            if (result.errors) {
                console.error('Errors:', result.errors);
            }
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

if (process.argv.length < 3) {
    console.error('❌ Please provide the path to your exported JSON file');
    console.log('📝 Usage: node scripts/test-single-wallet.mjs path/to/your/exported-file.json');
    process.exit(1);
}

const jsonFilePath = process.argv[2];
await testSingleWalletImport(jsonFilePath);