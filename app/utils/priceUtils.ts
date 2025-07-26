// app/utils/priceUtils.ts

import type { PortfolioStockDataType } from '@/app/(authed)/portfolio/types';

// Type matching PriceContext's PriceData interface with test price support
export interface PriceData {
  symbol: string;
  currentPrice: number | null;
  historicalCloses: Array<{ date: string; close: number }>;
  isTestPrice?: boolean; // Add this back for Portfolio page usage
}

export type PriceMap = Record<string, PriceData | null>;

/**
 * Merges real prices from PriceContext with test prices from stock database data.
 * Test prices override real prices when available.
 * 
 * @param realPrices - Price data from PriceContext (real prices from APIs)
 * @param stocksData - Stock data from database (includes testPrice field)
 * @returns Merged price map with test price overrides applied
 */
export function mergeTestPricesWithRealPrices(
  realPrices: Record<string, { symbol: string; currentPrice: number | null; historicalCloses: { date: string; close: number; }[] } | null>,
  stocksData: PortfolioStockDataType[]
): PriceMap {
  // Start with a copy of real prices, converting to our extended interface
  const mergedPrices: PriceMap = {};
  
  // Copy real prices first
  Object.keys(realPrices).forEach(symbol => {
    const realPrice = realPrices[symbol];
    if (realPrice) {
      mergedPrices[symbol] = {
        symbol: realPrice.symbol,
        currentPrice: realPrice.currentPrice,
        historicalCloses: realPrice.historicalCloses || [],
        isTestPrice: false
      };
    }
  });

  // Apply test price overrides
  stocksData.forEach(stock => {
    if (stock.symbol && typeof stock.testPrice === 'number' && stock.testPrice > 0) {
      const realPriceData = mergedPrices[stock.symbol];
      
      // Create or update price data with test price override
      mergedPrices[stock.symbol] = {
        symbol: stock.symbol,
        currentPrice: stock.testPrice,
        historicalCloses: realPriceData?.historicalCloses || [],
        isTestPrice: true
      };
    }
  });

  return mergedPrices;
}

/**
 * Get the display price for a stock, preferring test price over real price.
 * 
 * @param stock - Stock data from database
 * @param realPrices - Real prices from PriceContext
 * @returns Price data for display
 */
export function getStockDisplayPrice(
  stock: PortfolioStockDataType,
  realPrices: Record<string, { symbol: string; currentPrice: number | null; historicalCloses: { date: string; close: number; }[] } | null>
): PriceData | null {
  if (!stock.symbol) return null;

  // If stock has a test price, use it
  if (typeof stock.testPrice === 'number' && stock.testPrice > 0) {
    const realPriceData = realPrices[stock.symbol];
    return {
      symbol: stock.symbol,
      currentPrice: stock.testPrice,
      historicalCloses: realPriceData?.historicalCloses || [],
      isTestPrice: true
    };
  }

  // Otherwise, use real price
  const realPrice = realPrices[stock.symbol];
  if (realPrice) {
    return {
      symbol: realPrice.symbol,
      currentPrice: realPrice.currentPrice,
      historicalCloses: realPrice.historicalCloses || [],
      isTestPrice: false
    };
  }

  return null;
}
