"use client";

import { client } from "./amplify-client";

export interface FinancialUpdate {
  balance: number;
  oop: number;
}

/**
 * Recalculates balance and OOP from all transactions for an asset
 * and updates the Asset record.
 *
 * Balance: Running net position (negative = invested, positive = cash available)
 * OOP: Maximum out-of-pocket (peak investment reached during history)
 *
 * @param assetId - The ID of the asset to recalculate
 * @returns The calculated balance and oop values
 */
export async function recalculateAssetFinancials(
  assetId: string
): Promise<FinancialUpdate> {
  // 1. Fetch all transactions for the asset
  const response = await client.models.Transaction.list({
    filter: { assetId: { eq: assetId } },
    limit: 5000,
  });

  // 2. Sort chronologically (oldest first)
  const sorted = [...response.data].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // 3. Calculate balance and OOP
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

  // 4. Update the asset
  await client.models.Asset.update({
    id: assetId,
    balance,
    oop,
  });

  return { balance, oop };
}
