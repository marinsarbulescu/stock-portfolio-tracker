#!/usr/bin/env tsx
/**
 * Migration Script: Recalculate STP values with correct commission formula
 *
 * This script recalculates stpValue for all existing wallets using the
 * correct division method formula: baseTP / (1 - commission%)
 *
 * The previous formula was additive: baseTP + (baseTP * commission%)
 * which didn't properly account for commission on the target price.
 *
 * Usage:
 * # Dry run (preview changes):
 * npx tsx scripts/migrations/recalculate-stp-with-commission.ts --dry-run
 *
 * # Apply changes (use with API key auth for production):
 * USE_API_KEY=true npx tsx scripts/migrations/recalculate-stp-with-commission.ts
 *
 * Options:
 * --dry-run    Preview changes without applying them
 *
 * Environment:
 * USE_API_KEY=true    Use API key authentication (required for production)
 */

import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import amplifyOutputs from '../../amplify_outputs.json';

// Configure Amplify
Amplify.configure(amplifyOutputs);

// Determine auth mode from environment variable
const authMode = process.env.USE_API_KEY === 'true' ? 'apiKey' : 'userPool';
console.log(`🔑 Using auth mode: ${authMode}`);

const client = generateClient<Schema>({
  authMode: authMode as 'apiKey' | 'userPool'
});

const SHARE_EPSILON = 0.0001;
const CURRENCY_EPSILON = 0.01;

interface StockInfo {
  id: string;
  symbol: string;
  stp: number | null;
  stockCommission: number | null;
}

interface WalletRecord {
  id: string;
  portfolioStockId: string;
  walletType: 'Swing' | 'Hold';
  buyPrice: number;
  totalSharesQty: number;
  totalInvestment: number;
  remainingShares: number | null;
  stpValue: number | null;
}

/**
 * Calculate STP value using the correct division method formula
 */
function calculateCorrectStpValue(
  buyPrice: number,
  stpPercentage: number,
  commissionPercentage: number | null
): number {
  // Calculate base target (before commission)
  const baseTP = buyPrice * (1 + stpPercentage / 100);

  // Apply commission adjustment if commission exists and > 0
  if (typeof commissionPercentage === 'number' && commissionPercentage > 0) {
    const commissionRate = commissionPercentage / 100;

    // Prevent division by zero or negative values
    if (commissionRate >= 1) {
      console.warn(`Commission rate (${commissionPercentage}%) is too high, using base TP`);
      return parseFloat(baseTP.toFixed(4));
    }

    // Division method: ensures net profit after commission
    const adjustedTP = baseTP / (1 - commissionRate);
    return parseFloat(adjustedTP.toFixed(4));
  }

  // No commission, return base TP
  return parseFloat(baseTP.toFixed(4));
}

async function fetchAllStocks(): Promise<Map<string, StockInfo>> {
  console.log('📊 Fetching all PortfolioStock records...');

  const { data: stocks, errors } = await client.models.PortfolioStock.list({
    limit: 1000
  });

  if (errors) {
    console.error('❌ Error fetching stocks:', errors);
    throw new Error('Failed to fetch stock records');
  }

  const stockMap = new Map<string, StockInfo>();
  for (const stock of stocks) {
    stockMap.set(stock.id, {
      id: stock.id,
      symbol: stock.symbol,
      stp: stock.stp,
      stockCommission: stock.stockCommission
    });
  }

  console.log(`✅ Fetched ${stocks.length} stock records`);
  return stockMap;
}

async function recalculateWalletStpValues(dryRun: boolean = false) {
  console.log('🚀 Starting STP recalculation migration');
  console.log(`📝 Mode: ${dryRun ? 'DRY RUN (preview only)' : 'LIVE (will update database)'}\n`);

  try {
    // Step 1: Fetch all stocks to get STP and commission settings
    const stockMap = await fetchAllStocks();

    // Step 2: Fetch all wallets
    console.log('📊 Fetching all StockWallet records...');

    const { data: wallets, errors } = await client.models.StockWallet.list({
      limit: 1000
    });

    if (errors) {
      console.error('❌ Error fetching wallets:', errors);
      throw new Error('Failed to fetch wallet records');
    }

    console.log(`✅ Fetched ${wallets.length} wallet records\n`);

    if (wallets.length === 0) {
      console.log('🎉 No wallets found to process.');
      return;
    }

    // Step 3: Process each wallet
    console.log('🔄 Starting recalculation process...\n');

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    let noChangeCount = 0;

    for (const wallet of wallets) {
      try {
        // Get stock info
        const stock = stockMap.get(wallet.portfolioStockId);
        if (!stock) {
          console.log(`⏭️  Skipping wallet ${wallet.id} - stock not found`);
          skippedCount++;
          continue;
        }

        // Skip if no STP setting
        if (!stock.stp || stock.stp <= 0) {
          console.log(`⏭️  Skipping wallet ${wallet.id} (${stock.symbol}) - no STP setting`);
          skippedCount++;
          continue;
        }

        // Skip if no remaining shares
        const remainingShares = wallet.remainingShares ?? 0;
        if (remainingShares <= SHARE_EPSILON) {
          console.log(`⏭️  Skipping wallet ${wallet.id} (${stock.symbol}) - no remaining shares`);
          skippedCount++;
          continue;
        }

        // Calculate correct STP value
        const buyPrice = wallet.buyPrice;
        const correctStpValue = calculateCorrectStpValue(
          buyPrice,
          stock.stp,
          stock.stockCommission
        );

        const oldStpValue = wallet.stpValue ?? 0;
        const difference = correctStpValue - oldStpValue;
        const percentDiff = oldStpValue > 0 ? (difference / oldStpValue * 100) : 0;

        // Skip if values are already close (within 0.01)
        if (Math.abs(difference) < 0.01) {
          console.log(`⏭️  Skipping wallet ${wallet.id} (${stock.symbol}) - already correct (${oldStpValue})`);
          noChangeCount++;
          continue;
        }

        console.log(`📝 ${stock.symbol} Wallet ${wallet.id}:`);
        console.log(`   Buy Price: $${buyPrice.toFixed(2)}`);
        console.log(`   STP%: ${stock.stp}%, Commission: ${stock.stockCommission ?? 0}%`);
        console.log(`   Old STP: $${oldStpValue.toFixed(2)}`);
        console.log(`   New STP: $${correctStpValue.toFixed(2)}`);
        console.log(`   Difference: $${difference.toFixed(2)} (${percentDiff.toFixed(2)}%)`);

        if (!dryRun) {
          // Update the wallet with new STP value
          const updateResult = await client.models.StockWallet.update({
            id: wallet.id,
            stpValue: correctStpValue,
          });

          if (updateResult.errors) {
            console.error(`❌ Error updating wallet ${wallet.id}:`, updateResult.errors);
            errorCount++;
            continue;
          }

          console.log(`   ✅ Updated successfully\n`);
        } else {
          console.log(`   🔍 Would update (dry run)\n`);
        }

        updatedCount++;

      } catch (error) {
        console.error(`❌ Exception processing wallet ${wallet.id}:`, error);
        errorCount++;
      }
    }

    // Step 4: Summary
    console.log('\n📊 Migration Summary:');
    console.log(`✅ ${dryRun ? 'Would update' : 'Updated'}: ${updatedCount}`);
    console.log(`⏭️  Skipped (no STP/no shares): ${skippedCount}`);
    console.log(`✓  Already correct: ${noChangeCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📊 Total processed: ${wallets.length}`);

    if (dryRun) {
      console.log('\n🔍 This was a DRY RUN - no changes were made.');
      console.log('💡 Run without --dry-run to apply changes.');
    } else if (errorCount > 0) {
      console.log('\n⚠️  Some records failed to update. Please check the errors above.');
      process.exit(1);
    } else {
      console.log('\n🎉 Migration completed successfully!');
      console.log('\n📝 Next steps:');
      console.log('1. Verify updated values in the application');
      console.log('2. Test STP calculations with test transactions');
      console.log('3. Monitor for any issues with sell signals');
    }

  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  recalculateWalletStpValues(dryRun)
    .then(() => {
      console.log('🏁 Migration script completed.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration script failed:', error);
      process.exit(1);
    });
}

export { recalculateWalletStpValues };
