"use client";

import { client } from "./amplify-client";

/**
 * Migration script to calculate and store balance/oop for all existing assets.
 * Run this from browser console after importing:
 *
 * import { migrateAssetFinancials } from '@/utils/migrate-asset-financials';
 * await migrateAssetFinancials();
 */
export async function migrateAssetFinancials(): Promise<void> {
  console.log("Starting asset financials migration...");

  // Fetch all assets
  const assetsResponse = await client.models.Asset.list({
    limit: 5000,
  });

  const assets = assetsResponse.data;
  console.log(`Found ${assets.length} assets to process`);

  let processed = 0;
  let updated = 0;

  for (const asset of assets) {
    processed++;
    console.log(`Processing ${processed}/${assets.length}: ${asset.symbol}`);

    // Fetch all transactions for this asset
    const txnResponse = await client.models.Transaction.list({
      filter: { assetId: { eq: asset.id } },
      limit: 5000,
    });

    // Sort chronologically (oldest first)
    const sorted = [...txnResponse.data].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Calculate balance and OOP
    let balance = 0;
    let oop = 0;

    for (const txn of sorted) {
      if (txn.type === "BUY" && txn.investment !== null) {
        balance -= txn.investment;
        oop = Math.max(oop, Math.abs(balance));
      } else if (
        (txn.type === "SELL" || txn.type === "DIVIDEND" || txn.type === "SLP") &&
        txn.amount !== null
      ) {
        balance += txn.amount;
      }
      // SPLIT transactions don't affect balance/oop
    }

    // Only update if values changed
    if (asset.balance !== balance || asset.oop !== oop) {
      await client.models.Asset.update({
        id: asset.id,
        balance,
        oop,
      });
      updated++;
      console.log(`  Updated: balance=${balance.toFixed(2)}, oop=${oop.toFixed(2)}`);
    } else {
      console.log(`  No changes needed`);
    }
  }

  console.log(`Migration complete. Processed: ${processed}, Updated: ${updated}`);
}
