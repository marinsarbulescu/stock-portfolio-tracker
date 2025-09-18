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

async function importPortfolioStocks(jsonFilePath) {
    console.log('🚀 Starting import of Portfolio Stocks to development environment...');
    
    try {
        // Read the production data
        const data = JSON.parse(readFileSync(jsonFilePath, 'utf8'));
        console.log(`📁 Loaded export from: ${data.exportDate}`);
        console.log(`📊 Found ${data.portfolioStocks.length} portfolio stocks to import`);
        
        // Clear existing PortfolioStock data first
        console.log('\n🗑️  Clearing existing PortfolioStock data...');
        
        try {
            const existingStocks = await client.models.PortfolioStock.list({ limit: 1000 });
            if (existingStocks.data && existingStocks.data.length > 0) {
                console.log(`   Found ${existingStocks.data.length} existing stocks, deleting...`);
                for (const stock of existingStocks.data) {
                    await client.models.PortfolioStock.delete({ id: stock.id });
                }
                console.log('   ✅ Cleared existing PortfolioStock data');
            } else {
                console.log('   ✅ No existing PortfolioStock data to clear');
            }
        } catch (error) {
            console.error('   ⚠️  Error clearing data:', error.message);
        }
        
        // Import PortfolioStock records
        console.log('\n📥 Importing Portfolio Stocks...');
        let successCount = 0;
        let errorCount = 0;
        
        for (const stock of data.portfolioStocks) {
            try {
                // Remove system fields that shouldn't be imported, but keep owner
                const { id, createdAt, updatedAt, ...stockData } = stock;
                
                console.log(`   Creating: ${stockData.symbol} (${stockData.stockType})`);
                
                const result = await client.models.PortfolioStock.create(stockData);
                if (result.data && result.data.id) {
                    successCount++;
                    console.log(`   ✅ Created: ${stockData.symbol} with ID: ${result.data.id.substring(0, 8)}...`);
                } else {
                    console.log(`   ⚠️  No data returned for: ${stockData.symbol}`);
                    errorCount++;
                }
            } catch (error) {
                console.error(`   ❌ Failed to create ${stock.symbol}:`, error.message);
                errorCount++;
            }
        }
        
        // Final summary
        console.log(`\n📊 Import Summary:`);
        console.log(`   ✅ Successfully imported: ${successCount} stocks`);
        console.log(`   ❌ Failed to import: ${errorCount} stocks`);
        console.log(`   📋 Total processed: ${data.portfolioStocks.length} stocks`);
        
        // Count final records
        console.log('\n📊 Counting final PortfolioStock records...');
        try {
            const finalStocks = await client.models.PortfolioStock.list({ limit: 1000 });
            console.log(`   📈 Final count: ${finalStocks.data?.length || 0} PortfolioStock records`);
        } catch (error) {
            console.error('   ⚠️  Error counting final records:', error.message);
        }
        
        console.log('\n🎉 PortfolioStock import completed successfully!');
        console.log('🧪 You can now test your migration scripts on real stock data!');
        
    } catch (error) {
        console.error('❌ Import failed:', error);
        process.exit(1);
    }
}

// Get the JSON file path from command line argument
const jsonFilePath = process.argv[2];

if (!jsonFilePath) {
    console.error('❌ Please provide the path to your exported JSON file');
    console.error('📝 Usage: node scripts/import-stocks-only.mjs path/to/your/exported-file.json');
    process.exit(1);
}

importPortfolioStocks(jsonFilePath);