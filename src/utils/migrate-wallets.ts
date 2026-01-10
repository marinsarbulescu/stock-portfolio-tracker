/**
 * Migration script to rebuild wallets based on profit target allocations.
 *
 * This script:
 * 1. Fetches all assets
 * 2. For each asset, fetches all BUY transactions with their allocations
 * 3. Deletes existing wallets
 * 4. Rebuilds wallets from allocations grouped by (price, profitTargetId)
 *
 * Run this from the browser console after importing, or use the migrate page.
 */

import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";

const client = generateClient<Schema>();

interface MigrationResult {
  assetId: string;
  symbol: string;
  oldWalletCount: number;
  newWalletCount: number;
  totalInvestmentBefore: number;
  totalInvestmentAfter: number;
}

export async function migrateWallets(): Promise<MigrationResult[]> {
  const results: MigrationResult[] = [];

  // 1. Get all assets
  console.log("Fetching assets...");
  const assetsResponse = await client.models.Asset.list();
  const assets = assetsResponse.data;
  console.log(`Found ${assets.length} assets`);

  for (const asset of assets) {
    console.log(`\nProcessing ${asset.symbol}...`);

    // 2. Get existing wallets for this asset (for comparison)
    const oldWalletsResponse = await client.models.Wallet.list({
      filter: { assetId: { eq: asset.id } },
    });
    const oldWallets = oldWalletsResponse.data;
    const oldWalletCount = oldWallets.length;
    const totalInvestmentBefore = oldWallets.reduce((sum, w) => sum + w.investment, 0);

    console.log(`  Found ${oldWalletCount} existing wallets, total investment: $${totalInvestmentBefore.toFixed(2)}`);

    // 3. Get all BUY transactions for this asset
    const transactionsResponse = await client.models.Transaction.list({
      filter: {
        assetId: { eq: asset.id },
        type: { eq: "BUY" },
      },
    });
    const buyTransactions = transactionsResponse.data;
    console.log(`  Found ${buyTransactions.length} BUY transactions`);

    // Get profit targets for this asset (needed for profitTargetPrice calculation)
    const profitTargetsResponse = await client.models.ProfitTarget.list({
      filter: { assetId: { eq: asset.id } },
    });
    const profitTargetsMap = new Map(
      profitTargetsResponse.data.map((pt) => [pt.id, pt.targetPercent])
    );
    const sellFee = asset.sellFee ?? 0;

    // 4. Build new wallet map from transaction allocations
    const newWalletMap = new Map<string, {
      assetId: string;
      price: number;
      profitTargetId: string;
      investment: number;
      shares: number;
      profitTargetPrice: number;
    }>();

    for (const txn of buyTransactions) {
      if (!txn.price || !txn.investment) continue;

      // Get allocations for this transaction
      const allocationsResponse = await client.models.TransactionAllocation.list({
        filter: { transactionId: { eq: txn.id } },
      });
      const allocations = allocationsResponse.data;

      if (allocations.length === 0) {
        console.warn(`  Warning: BUY transaction ${txn.id} has no allocations`);
        continue;
      }

      for (const alloc of allocations) {
        const key = `${txn.price}-${alloc.profitTargetId}`;
        const allocationInvestment = (alloc.percentage / 100) * txn.investment;
        const allocationShares = allocationInvestment / txn.price;

        // Calculate profitTargetPrice: buyPrice × (1 + PT%) / (1 - sellFee%)
        const ptPercent = profitTargetsMap.get(alloc.profitTargetId) ?? 0;
        const profitTargetPrice = parseFloat((txn.price * (1 + ptPercent / 100) / (1 - sellFee / 100)).toFixed(5));

        if (newWalletMap.has(key)) {
          const existing = newWalletMap.get(key)!;
          existing.investment += allocationInvestment;
          existing.shares += allocationShares;
          // profitTargetPrice stays the same since it's based on the same price/PT combo
        } else {
          newWalletMap.set(key, {
            assetId: asset.id,
            price: txn.price,
            profitTargetId: alloc.profitTargetId,
            investment: allocationInvestment,
            shares: allocationShares,
            profitTargetPrice,
          });
        }
      }
    }

    const newWalletCount = newWalletMap.size;
    const totalInvestmentAfter = Array.from(newWalletMap.values())
      .reduce((sum, w) => sum + w.investment, 0);

    console.log(`  Will create ${newWalletCount} new wallets, total investment: $${totalInvestmentAfter.toFixed(2)}`);

    // Validate totals match
    if (Math.abs(totalInvestmentBefore - totalInvestmentAfter) > 0.01) {
      console.warn(`  Warning: Investment mismatch! Before: $${totalInvestmentBefore.toFixed(2)}, After: $${totalInvestmentAfter.toFixed(2)}`);
    }

    // 5. Delete old wallets
    console.log(`  Deleting ${oldWalletCount} old wallets...`);
    for (const wallet of oldWallets) {
      await client.models.Wallet.delete({ id: wallet.id });
    }

    // 6. Create new wallets (round shares to 5 decimals)
    console.log(`  Creating ${newWalletCount} new wallets...`);
    const newWalletsArray = Array.from(newWalletMap.values());
    for (const walletData of newWalletsArray) {
      const shares = parseFloat(walletData.shares.toFixed(5));
      await client.models.Wallet.create({
        ...walletData,
        shares,
        originalShares: shares,
        originalPrice: walletData.price,
        originalProfitTargetPrice: walletData.profitTargetPrice,
      });
    }

    results.push({
      assetId: asset.id,
      symbol: asset.symbol,
      oldWalletCount,
      newWalletCount,
      totalInvestmentBefore,
      totalInvestmentAfter,
    });

    console.log(`  Done with ${asset.symbol}`);
  }

  console.log("\n=== Migration Complete ===");
  console.log("Results:", results);

  return results;
}

// Export for browser console usage
if (typeof window !== "undefined") {
  (window as unknown as { migrateWallets: typeof migrateWallets }).migrateWallets = migrateWallets;
}
