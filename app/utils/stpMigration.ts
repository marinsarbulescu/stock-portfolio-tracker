/**
 * STP/HTP Migration Utility
 *
 * Recalculates STP values for stock wallets using the correct commission formula.
 * The correct formula is: baseTP / (1 - commission%)
 *
 * Note: HTP values are calculated on-the-fly and not stored in the database,
 * so they don't need migration. This utility only migrates stored STP values.
 *
 * This ensures the target price accounts for commission so you net the desired
 * profit percentage after commission is deducted.
 */

import type { Schema } from '@/amplify/data/resource';
import { generateClient } from 'aws-amplify/data';

const SHARE_EPSILON = 0.0001;

interface MigrationResult {
  success: boolean;
  stockId: string;
  stockSymbol: string;
  walletsUpdated: number;
  error?: string;
  details?: Array<{
    walletId: string;
    buyPrice: number;
    oldStp: number;
    newStp: number;
    stpDifference: number;
    oldHtp: number | null;
    newHtp: number | null;
  }>;
}

/**
 * Calculate correct target price value using division method formula
 */
function calculateCorrectTargetPrice(
  buyPrice: number,
  targetPercentage: number,
  commissionPercentage: number | null
): number {
  // Calculate base target (before commission)
  const baseTP = buyPrice * (1 + targetPercentage / 100);

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

/**
 * Recalculate STP values for all wallets of a specific stock
 *
 * Note: HTP values are calculated dynamically using calculateHtpTargetPrice() from
 * financialCalculations.ts and are not stored in the database, so they don't need
 * migration. Only STP values are stored and need to be recalculated.
 */
export async function recalculateStockStp(
  client: ReturnType<typeof generateClient<Schema>>,
  stockId: string
): Promise<MigrationResult> {
  try {
    console.log(`[STP/HTP Migration] Starting migration for stock: ${stockId}`);

    // Step 1: Fetch stock info to get STP and commission settings
    const { data: stock, errors: stockErrors } = await client.models.PortfolioStock.get({ id: stockId });

    if (stockErrors || !stock) {
      return {
        success: false,
        stockId,
        stockSymbol: 'Unknown',
        walletsUpdated: 0,
        error: `Failed to fetch stock: ${stockErrors?.[0]?.message || 'Stock not found'}`
      };
    }

    // Check if stock has STP or HTP setting
    const hasStp = stock.stp && stock.stp > 0;
    const hasHtp = stock.htp && stock.htp > 0;

    if (!hasStp && !hasHtp) {
      return {
        success: false,
        stockId,
        stockSymbol: stock.symbol,
        walletsUpdated: 0,
        error: 'Stock has no STP or HTP setting'
      };
    }

    console.log(`[STP/HTP Migration] Stock: ${stock.symbol}, STP: ${stock.stp ?? 0}%, HTP: ${stock.htp ?? 0}%, Commission: ${stock.stockCommission ?? 0}%`);

    // Step 2: Fetch all wallets for this stock
    const { data: wallets, errors: walletsErrors } = await client.models.StockWallet.list({
      filter: { portfolioStockId: { eq: stockId } },
      limit: 1000
    });

    if (walletsErrors || !wallets) {
      return {
        success: false,
        stockId,
        stockSymbol: stock.symbol,
        walletsUpdated: 0,
        error: `Failed to fetch wallets: ${walletsErrors?.[0]?.message || 'Unknown error'}`
      };
    }

    console.log(`[STP/HTP Migration] Found ${wallets.length} wallets`);

    // Step 3: Filter wallets with remaining shares
    const activeWallets = wallets.filter(w => (w.remainingShares ?? 0) > SHARE_EPSILON);
    console.log(`[STP/HTP Migration] ${activeWallets.length} wallets have remaining shares`);

    if (activeWallets.length === 0) {
      return {
        success: true,
        stockId,
        stockSymbol: stock.symbol,
        walletsUpdated: 0,
        details: []
      };
    }

    // Step 4: Recalculate and update each wallet
    const details: MigrationResult['details'] = [];
    let updatedCount = 0;
    let errorCount = 0;

    for (const wallet of activeWallets) {
      try {
        const buyPrice = wallet.buyPrice;

        // Calculate new STP value if stock has STP setting
        let correctStpValue: number | null = null;
        if (hasStp && stock.stp) {
          correctStpValue = calculateCorrectTargetPrice(buyPrice, stock.stp, stock.stockCommission);
        }

        // Calculate new HTP value if stock has HTP setting
        let correctHtpValue: number | null = null;
        if (hasHtp && stock.htp) {
          correctHtpValue = calculateCorrectTargetPrice(buyPrice, stock.htp, stock.stockCommission);
        }

        const oldStpValue = wallet.stpValue ?? 0;
        const oldHtpValue = wallet.htpValue ?? null;
        const stpDifference = correctStpValue ? correctStpValue - oldStpValue : 0;

        // Skip if STP values are already close (within $0.01) and HTP is already set
        if (
          (!correctStpValue || Math.abs(stpDifference) < 0.01) &&
          (!correctHtpValue || oldHtpValue !== null)
        ) {
          console.log(`[STP/HTP Migration] Wallet ${wallet.id} already correct (STP: ${oldStpValue}, HTP: ${oldHtpValue})`);
          continue;
        }

        console.log(`[STP/HTP Migration] Updating wallet ${wallet.id}:`);
        if (correctStpValue) {
          console.log(`  STP: $${oldStpValue.toFixed(2)} → $${correctStpValue.toFixed(2)} (Δ $${stpDifference.toFixed(2)})`);
        }
        if (correctHtpValue) {
          console.log(`  HTP: ${oldHtpValue ? `$${oldHtpValue.toFixed(2)}` : 'null'} → $${correctHtpValue.toFixed(2)}`);
        }

        // Build update payload
        const updatePayload: any = { id: wallet.id };
        if (correctStpValue) updatePayload.stpValue = correctStpValue;
        if (correctHtpValue) updatePayload.htpValue = correctHtpValue;

        // Update the wallet
        const { errors: updateErrors } = await client.models.StockWallet.update(updatePayload);

        if (updateErrors) {
          console.error(`[STP/HTP Migration] Error updating wallet ${wallet.id}:`, updateErrors);
          errorCount++;
          continue;
        }

        details.push({
          walletId: wallet.id,
          buyPrice,
          oldStp: oldStpValue,
          newStp: correctStpValue ?? oldStpValue,
          stpDifference,
          oldHtp: oldHtpValue,
          newHtp: correctHtpValue
        });

        updatedCount++;

      } catch (err) {
        console.error(`[STP/HTP Migration] Exception updating wallet ${wallet.id}:`, err);
        errorCount++;
      }
    }

    // Step 5: Return result
    const result: MigrationResult = {
      success: errorCount === 0,
      stockId,
      stockSymbol: stock.symbol,
      walletsUpdated: updatedCount,
      details
    };

    if (errorCount > 0) {
      result.error = `${errorCount} wallet(s) failed to update`;
    }

    console.log(`[STP/HTP Migration] Completed: ${updatedCount} updated, ${errorCount} errors`);

    return result;

  } catch (err: unknown) {
    console.error('[STP/HTP Migration] Unexpected error:', err);
    return {
      success: false,
      stockId,
      stockSymbol: 'Unknown',
      walletsUpdated: 0,
      error: (err as Error).message || 'Unknown error'
    };
  }
}
