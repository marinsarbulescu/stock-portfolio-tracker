#!/usr/bin/env tsx
/**
 * Migration Script: Copy tpValue to stpValue (simplified)
 * 
 * In DynamoDB, new fields don't automatically exist in existing records.
 * This script reads existing records with tpValue and explicitly
 * writes the stpValue field to the same records.
 * 
 * NOTE: tpPercent is being removed as it's unused in the UI.
 * 
 * Usage:
 * npx tsx scripts/migrations/migrate-tp-to-stp.ts
 */

import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import amplifyOutputs from '../../amplify_outputs.json';

// Configure Amplify
Amplify.configure(amplifyOutputs);
const client = generateClient<Schema>({
  authMode: 'apiKey' // Use API key for migration script
});

interface WalletRecord {
  id: string;
  tpValue?: number | null;
  stpValue?: number | null;
  portfolioStockId: string;
  walletType: 'Swing' | 'Hold';
  buyPrice: number;
  totalSharesQty: number;
  totalInvestment: number;
  sharesSold: number;
  remainingShares?: number | null;
  realizedPl?: number | null;
  realizedPlPercent?: number | null;
  sellTxnCount: number;
  owner?: string | null;
}

async function migrateStockWallets() {
  console.log('🚀 Starting simplified DynamoDB field migration: tpValue → stpValue');
  
  try {
    // Step 1: Use the Amplify client to fetch all records
    console.log('📊 Fetching all StockWallet records using Amplify client...');
    
    const { data: wallets, errors } = await client.models.StockWallet.list({
      limit: 1000 // Adjust if you have more than 1000 records
    });
    
    if (errors) {
      console.error('❌ Error fetching wallets:', errors);
      throw new Error('Failed to fetch wallet records');
    }
    
    console.log(`✅ Fetched ${wallets.length} wallet records`);
    
    if (wallets.length === 0) {
      console.log('🎉 No wallets found to migrate.');
      return;
    }
    
    // Step 2: Process each wallet
    console.log('🔄 Starting migration process...');
    
    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const wallet of wallets) {
      try {
        // Check if this wallet has tpValue data
        const hasTpData = wallet.tpValue !== null && wallet.tpValue !== undefined;
        
        if (!hasTpData) {
          console.log(`⏭️  Skipping wallet ${wallet.id} - no tpValue data`);
          skippedCount++;
          continue;
        }
        
        // Check if already has stpValue that matches
        if (wallet.stpValue === wallet.tpValue) {
          console.log(`⏭️  Skipping wallet ${wallet.id} - already migrated`);
          skippedCount++;
          continue;
        }
        
        // Perform migration: Copy tpValue to stpValue
        console.log(`📝 Migrating wallet ${wallet.id}: tpValue=${wallet.tpValue} → stpValue`);
        
        const updateResult = await client.models.StockWallet.update({
          id: wallet.id,
          stpValue: wallet.tpValue,
        });
        
        if (updateResult.errors) {
          console.error(`❌ Error updating wallet ${wallet.id}:`, updateResult.errors);
          errorCount++;
          continue;
        }
        
        migratedCount++;
        
        if (migratedCount % 5 === 0) {
          console.log(`⏳ Progress: ${migratedCount}/${wallets.length} wallets migrated...`);
        }
        
      } catch (error) {
        console.error(`❌ Exception updating wallet ${wallet.id}:`, error);
        errorCount++;
      }
    }
    
    // Step 3: Summary
    console.log('\n📊 Migration Summary:');
    console.log(`✅ Successfully migrated: ${migratedCount}`);
    console.log(`⏭️  Skipped (no data/already done): ${skippedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📊 Total processed: ${wallets.length}`);
    
    if (errorCount > 0) {
      console.log('\n⚠️  Some records failed to migrate. Please check the errors above.');
      process.exit(1);
    } else {
      console.log('\n🎉 Migration completed successfully!');
      console.log('\n📝 Next steps:');
      console.log('1. Verify the migration by checking a few records in the AWS console');
      console.log('2. Update your application code to use stpValue instead of tpValue');
      console.log('3. Test the application thoroughly');
      console.log('4. Once confirmed working, remove tpValue field from schema');
    }
    
  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
if (require.main === module) {
  migrateStockWallets()
    .then(() => {
      console.log('🏁 Migration script completed.');
    })
    .catch((error) => {
      console.error('💥 Migration script failed:', error);
      process.exit(1);
    });
}

export { migrateStockWallets };