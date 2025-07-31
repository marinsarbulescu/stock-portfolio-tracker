// app/utils/splitUtils.ts
import type { Schema } from '@/amplify/data/resource';

export interface StockSplitInfo {
  date: string;
  splitRatio: number; // e.g., 2.0 for 2:1 split
  preSplitPrice?: number; // Optional reference price
}

// Flexible transaction interface for split detection
export interface SplitDetectionTransaction {
  action?: string | null;
  date?: string | null;
  quantity?: number | null;
  price?: number | null;
  splitRatio?: number | null;
}

export interface SplitAdjustedTransaction {
  originalTransaction: Schema['Transaction']['type'];
  adjustedShares: number;
  adjustedPrice: number;
  cumulativeSplitFactor: number;
  wasAdjusted: boolean;
}

/**
 * Extract stock split information from transactions (flexible input type)
 * @param transactions - All transactions for a stock
 * @returns Array of split information sorted by date
 */
export function extractStockSplits(transactions: SplitDetectionTransaction[]): StockSplitInfo[] {
  const splits = transactions
    .filter(txn => txn.action === 'StockSplit')
    .map(txn => ({
      date: txn.date || '',
      splitRatio: txn.splitRatio || 1, // Split ratio stored in splitRatio field
      preSplitPrice: txn.price || undefined // Pre-split price stored in price field
    }))
    .sort((a, b) => a.date.localeCompare(b.date)); // Sort chronologically

  return splits;
}

/**
 * Calculate cumulative split factor for transactions before a given date
 * @param splits - Array of stock splits sorted by date
 * @param transactionDate - Date of the transaction to check
 * @returns Cumulative split factor (1.0 = no splits, 2.0 = 2x after 2:1 split, etc.)
 */
export function calculateCumulativeSplitFactor(splits: StockSplitInfo[], transactionDate: string): number {
  if (!splits.length) return 1.0;

  let cumulativeFactor = 1.0;
  
  for (const split of splits) {
    // If split happened after this transaction, apply the split factor
    if (split.date > transactionDate) {
      cumulativeFactor *= split.splitRatio;
    }
  }

  return cumulativeFactor;
}

/**
 * Apply split adjustments to a transaction for accurate calculations
 * @param transaction - Original transaction
 * @param splits - Array of stock splits for the stock
 * @returns Split-adjusted transaction data
 */
export function applySplitAdjustments(
  transaction: Schema['Transaction']['type'], 
  splits: StockSplitInfo[]
): SplitAdjustedTransaction {
  if (!splits.length || !transaction.date) {
    // No splits or invalid date - return original values
    return {
      originalTransaction: transaction,
      adjustedShares: transaction.quantity || 0,
      adjustedPrice: transaction.price || 0,
      cumulativeSplitFactor: 1.0,
      wasAdjusted: false
    };
  }

  const cumulativeFactor = calculateCumulativeSplitFactor(splits, transaction.date);
  
  if (cumulativeFactor === 1.0) {
    // No adjustments needed
    return {
      originalTransaction: transaction,
      adjustedShares: transaction.quantity || 0,
      adjustedPrice: transaction.price || 0,
      cumulativeSplitFactor: 1.0,
      wasAdjusted: false
    };
  }

  // Apply split adjustments
  const originalShares = transaction.quantity || 0;
  const originalPrice = transaction.price || 0;
  
  const adjustedShares = originalShares * cumulativeFactor;
  const adjustedPrice = originalPrice / cumulativeFactor;

  return {
    originalTransaction: transaction,
    adjustedShares,
    adjustedPrice,
    cumulativeSplitFactor: cumulativeFactor,
    wasAdjusted: true
  };
}

/**
 * Apply split adjustments to wallet buy price and shares for accurate calculations
 * @param wallet - Original wallet data
 * @param splits - Array of stock splits for the stock
 * @returns Split-adjusted wallet data
 */
export function applySplitAdjustmentsToWallet(
  wallet: { id?: string; buyPrice?: number; remainingShares?: number; totalSharesQty?: number; [key: string]: unknown },
  splits: StockSplitInfo[],
  walletCreationDate?: string
): {
  adjustedBuyPrice: number;
  adjustedRemainingShares: number;
  adjustedTotalShares: number;
  cumulativeSplitFactor: number;
  wasAdjusted: boolean;
} {
  const buyPrice = wallet.buyPrice || 0;
  const remainingShares = wallet.remainingShares || 0;
  const totalShares = wallet.totalSharesQty || 0;

  if (!splits.length || !walletCreationDate) {
    return {
      adjustedBuyPrice: buyPrice,
      adjustedRemainingShares: remainingShares,
      adjustedTotalShares: totalShares,
      cumulativeSplitFactor: 1.0,
      wasAdjusted: false
    };
  }

  const cumulativeFactor = calculateCumulativeSplitFactor(splits, walletCreationDate);
  
  if (cumulativeFactor === 1.0) {
    return {
      adjustedBuyPrice: buyPrice,
      adjustedRemainingShares: remainingShares,
      adjustedTotalShares: totalShares,
      cumulativeSplitFactor: 1.0,
      wasAdjusted: false
    };
  }

  return {
    adjustedBuyPrice: buyPrice / cumulativeFactor,
    adjustedRemainingShares: remainingShares * cumulativeFactor,
    adjustedTotalShares: totalShares * cumulativeFactor,
    cumulativeSplitFactor: cumulativeFactor,
    wasAdjusted: true
  };
}

/**
 * Adjust P/L calculations to account for stock splits
 * @param sellPrice - Sale price per share
 * @param buyPrice - Original buy price per share  
 * @param shares - Number of shares sold
 * @param sellDate - Date of sale
 * @param buyDate - Date of purchase
 * @param splits - Array of stock splits
 * @returns Split-adjusted P/L calculation
 */
export function calculateSplitAdjustedPL(
  sellPrice: number,
  buyPrice: number, 
  shares: number,
  sellDate: string,
  buyDate: string,
  splits: StockSplitInfo[]
): {
  adjustedPL: number;
  adjustedBuyPrice: number;
  adjustedShares: number;
  sellPriceUsed: number;
  wasAdjusted: boolean;
} {
  if (!splits.length) {
    const pl = (sellPrice - buyPrice) * shares;
    return {
      adjustedPL: pl,
      adjustedBuyPrice: buyPrice,
      adjustedShares: shares,
      sellPriceUsed: sellPrice,
      wasAdjusted: false
    };
  }

  // Get cumulative split factors for buy and sell dates
  const buyCumulativeFactor = calculateCumulativeSplitFactor(splits, buyDate);
  const sellCumulativeFactor = calculateCumulativeSplitFactor(splits, sellDate);

  // Adjust buy transaction values
  const adjustedBuyPrice = buyPrice / buyCumulativeFactor;
  const adjustedShares = shares * buyCumulativeFactor;
  
  // Sell price adjustment (should be 1.0 if sale is after all splits)
  const adjustedSellPrice = sellPrice / sellCumulativeFactor;

  // Calculate split-adjusted P/L
  const adjustedPL = (adjustedSellPrice - adjustedBuyPrice) * adjustedShares;

  return {
    adjustedPL,
    adjustedBuyPrice,
    adjustedShares,
    sellPriceUsed: adjustedSellPrice,
    wasAdjusted: buyCumulativeFactor !== 1.0 || sellCumulativeFactor !== 1.0
  };
}

/**
 * Debug utility to log split adjustment information
 */
export function logSplitAdjustments(
  stockSymbol: string,
  splits: StockSplitInfo[],
  transaction: Schema['Transaction']['type'],
  adjusted: SplitAdjustedTransaction
): void {
  if (adjusted.wasAdjusted) {
    console.log(`[Split Adjustment - ${stockSymbol}] Transaction ${transaction.id}:`);
    console.log(`  Date: ${transaction.date}`);
    console.log(`  Original: ${transaction.quantity} shares @ $${transaction.price}`);
    console.log(`  Adjusted: ${adjusted.adjustedShares} shares @ $${adjusted.adjustedPrice.toFixed(4)}`);
    console.log(`  Split Factor: ${adjusted.cumulativeSplitFactor}x`);
    console.log(`  Splits Applied:`, splits.filter(s => s.date > (transaction.date || '')));
  }
}
