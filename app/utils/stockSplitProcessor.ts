// app/utils/stockSplitProcessor.ts
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';

export interface StockSplitData {
  portfolioStockId: string;
  splitDate: string;
  splitRatio: number; // e.g., 6.0 for 6:1 split
  preSplitPrice: number;
  postSplitPrice: number;
  owner: string;
}

export class StockSplitProcessor {
  private client = generateClient<Schema>();

  /**
   * Process a stock split by:
   * 1. Creating a StockSplit transaction record
   * 2. Adjusting all existing wallet buy prices and share quantities
   * 3. Updating the stock's split adjustment factor
   * 4. Adjusting the test price if set
   */
  async processStockSplit(splitData: StockSplitData): Promise<void> {
    const { portfolioStockId, splitRatio, splitDate, preSplitPrice, postSplitPrice, owner } = splitData;

    try {
      console.log(`[StockSplitProcessor] Processing ${splitRatio}:1 split for stock ${portfolioStockId}`);

      // Step 1: Create the split transaction record
      await this.createSplitTransaction(splitData);

      // Step 2: Adjust all wallets for this stock
      await this.adjustWalletsForSplit(portfolioStockId, splitRatio);

      // Step 3: Update stock's split adjustment factor and test price
      await this.updateStockSplitFactor(portfolioStockId, splitRatio);

      console.log(`[StockSplitProcessor] ✅ Split processing completed for stock ${portfolioStockId}`);
    } catch (error) {
      console.error(`[StockSplitProcessor] Error processing split:`, error);
      throw error;
    }
  }

  private async createSplitTransaction(splitData: StockSplitData): Promise<void> {
    const { portfolioStockId, splitRatio, splitDate, preSplitPrice, postSplitPrice, owner } = splitData;

    const { errors } = await this.client.models.Transaction.create({
      date: splitDate,
      action: 'StockSplit',
      splitRatio: splitRatio,
      preSplitPrice: preSplitPrice,
      postSplitPrice: postSplitPrice,
      portfolioStockId: portfolioStockId,
      owner: owner,
      // Other fields are optional for split transactions
    });

    if (errors) {
      throw new Error(`Failed to create split transaction: ${errors[0]?.message}`);
    }

    console.log(`[StockSplitProcessor] Split transaction created for ${splitRatio}:1 split`);
  }

  private async adjustWalletsForSplit(portfolioStockId: string, splitRatio: number): Promise<void> {
    // Get all wallets for this stock
    const { data: wallets, errors } = await this.client.models.StockWallet.list({
      filter: { portfolioStockId: { eq: portfolioStockId } }
    });

    if (errors) {
      throw new Error(`Failed to fetch wallets: ${errors[0]?.message}`);
    }

    if (!wallets || wallets.length === 0) {
      console.log(`[StockSplitProcessor] No wallets found for stock ${portfolioStockId}`);
      return;
    }

    // Adjust each wallet
    for (const wallet of wallets) {
      const adjustedBuyPrice = wallet.buyPrice / splitRatio;
      const adjustedTotalShares = wallet.totalSharesQty * splitRatio;
      const adjustedRemainingShares = wallet.remainingShares ? wallet.remainingShares * splitRatio : 0;
      const adjustedSharesSold = wallet.sharesSold * splitRatio;

      const { errors: updateErrors } = await this.client.models.StockWallet.update({
        id: wallet.id,
        buyPrice: adjustedBuyPrice,
        totalSharesQty: adjustedTotalShares,
        remainingShares: adjustedRemainingShares,
        sharesSold: adjustedSharesSold,
        // totalInvestment stays the same (same dollar amount invested)
        // tpValue and tpPercent will be recalculated based on new buyPrice
        tpValue: wallet.tpValue ? wallet.tpValue / splitRatio : undefined,
      });

      if (updateErrors) {
        console.error(`[StockSplitProcessor] Error updating wallet ${wallet.id}:`, updateErrors);
        throw new Error(`Failed to update wallet: ${updateErrors[0]?.message}`);
      }

      console.log(`[StockSplitProcessor] Adjusted wallet ${wallet.id}: ${wallet.buyPrice} → ${adjustedBuyPrice}, shares: ${wallet.totalSharesQty} → ${adjustedTotalShares}`);
    }
  }

  private async updateStockSplitFactor(portfolioStockId: string, splitRatio: number): Promise<void> {
    // Get current stock data
    const { data: stock, errors } = await this.client.models.PortfolioStock.get({ id: portfolioStockId });

    if (errors || !stock) {
      throw new Error(`Failed to fetch stock: ${errors?.[0]?.message || 'Stock not found'}`);
    }

    // Calculate new adjustment factor
    const currentFactor = stock.splitAdjustmentFactor || 1.0;
    const newFactor = currentFactor * splitRatio;

    // Adjust test price if set
    const adjustedTestPrice = stock.testPrice ? stock.testPrice / splitRatio : stock.testPrice;

    const { errors: updateErrors } = await this.client.models.PortfolioStock.update({
      id: portfolioStockId,
      splitAdjustmentFactor: newFactor,
      testPrice: adjustedTestPrice,
    });

    if (updateErrors) {
      throw new Error(`Failed to update stock split factor: ${updateErrors[0]?.message}`);
    }

    console.log(`[StockSplitProcessor] Updated stock split adjustment factor: ${currentFactor} → ${newFactor}`);
    if (adjustedTestPrice) {
      console.log(`[StockSplitProcessor] Adjusted test price: ${stock.testPrice} → ${adjustedTestPrice}`);
    }
  }

  /**
   * Get split history for a stock
   */
  async getSplitHistory(portfolioStockId: string): Promise<any[]> {
    const { data: splits, errors } = await this.client.models.Transaction.list({
      filter: { 
        portfolioStockId: { eq: portfolioStockId },
        action: { eq: 'StockSplit' }
      }
    });

    if (errors) {
      throw new Error(`Failed to fetch split history: ${errors[0]?.message}`);
    }

    return splits || [];
  }

  /**
   * Calculate split-adjusted price for display purposes
   */
  calculateSplitAdjustedPrice(originalPrice: number, splitAdjustmentFactor: number): number {
    return originalPrice / splitAdjustmentFactor;
  }
}

export const stockSplitProcessor = new StockSplitProcessor();
