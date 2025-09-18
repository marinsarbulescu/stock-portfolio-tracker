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

  // Apply test price and/or test historical data overrides
  stocksData.forEach(stock => {
    if (stock.symbol) {
      const hasTestPrice = typeof stock.testPrice === 'number' && stock.testPrice > 0;
      
      // Parse testHistoricalCloses - it could be a JSON string from database or array from direct usage
      let parsedTestHistoricalCloses: { date: string; close: number; }[] | null = null;
      if (stock.testHistoricalCloses) {
        if (Array.isArray(stock.testHistoricalCloses)) {
          parsedTestHistoricalCloses = stock.testHistoricalCloses;
        } else if (typeof stock.testHistoricalCloses === 'string') {
          try {
            const parsed = JSON.parse(stock.testHistoricalCloses);
            if (Array.isArray(parsed)) {
              parsedTestHistoricalCloses = parsed;
            }
          } catch (error) {
            console.warn(`[priceUtils] Failed to parse testHistoricalCloses JSON for ${stock.symbol}:`, error);
          }
        }
      }
      
      const hasTestHistorical = parsedTestHistoricalCloses && parsedTestHistoricalCloses.length > 0;
      
      if (hasTestPrice || hasTestHistorical) {
        const realPriceData = mergedPrices[stock.symbol];
        
        // Create or update price data with test overrides
        mergedPrices[stock.symbol] = {
          symbol: stock.symbol,
          currentPrice: hasTestPrice ? stock.testPrice : realPriceData?.currentPrice || null,
          historicalCloses: hasTestHistorical ? (parsedTestHistoricalCloses || []) : realPriceData?.historicalCloses || [],
          isTestPrice: Boolean(hasTestPrice || hasTestHistorical)
        };
      }
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

  const hasTestPrice = typeof stock.testPrice === 'number' && stock.testPrice > 0;
  
  // Parse testHistoricalCloses - it could be a JSON string from database or array from direct usage
  let parsedTestHistoricalCloses: { date: string; close: number; }[] | null = null;
  if (stock.testHistoricalCloses) {
    if (Array.isArray(stock.testHistoricalCloses)) {
      // Already an array
      parsedTestHistoricalCloses = stock.testHistoricalCloses;
      if (stock.symbol.startsWith('E2E5DD')) {
        console.log(`[priceUtils] ${stock.symbol}: testHistoricalCloses is array, length=${stock.testHistoricalCloses.length}`);
      }
    } else if (typeof stock.testHistoricalCloses === 'string') {
      // JSON string from database - parse it
      if (stock.symbol.startsWith('E2E5DD')) {
        console.log(`[priceUtils] ${stock.symbol}: testHistoricalCloses is string: ${stock.testHistoricalCloses.substring(0, 100)}...`);
      }
      try {
        const parsed = JSON.parse(stock.testHistoricalCloses);
        if (Array.isArray(parsed)) {
          parsedTestHistoricalCloses = parsed;
          if (stock.symbol.startsWith('E2E5DD')) {
            console.log(`[priceUtils] ${stock.symbol}: Parsed JSON successfully, length=${parsed.length}`);
          }
        } else {
          if (stock.symbol.startsWith('E2E5DD')) {
            console.log(`[priceUtils] ${stock.symbol}: Parsed JSON but not an array:`, typeof parsed);
          }
        }
      } catch (error) {
        console.warn(`[priceUtils] Failed to parse testHistoricalCloses JSON for ${stock.symbol}:`, error);
        parsedTestHistoricalCloses = null;
      }
    } else {
      if (stock.symbol.startsWith('E2E5DD')) {
        console.log(`[priceUtils] ${stock.symbol}: testHistoricalCloses is neither array nor string:`, typeof stock.testHistoricalCloses);
      }
    }
  } else {
    if (stock.symbol.startsWith('E2E5DD')) {
      console.log(`[priceUtils] ${stock.symbol}: testHistoricalCloses is null/undefined`);
    }
  }
  
  const hasTestHistorical = parsedTestHistoricalCloses && parsedTestHistoricalCloses.length > 0;

  // If stock has test price and/or test historical data, use them
  if (hasTestPrice || hasTestHistorical) {
    const realPriceData = realPrices[stock.symbol];
    return {
      symbol: stock.symbol,
      currentPrice: hasTestPrice ? stock.testPrice : realPriceData?.currentPrice || null,
      historicalCloses: hasTestHistorical ? (parsedTestHistoricalCloses || []) : realPriceData?.historicalCloses || [],
      isTestPrice: Boolean(hasTestPrice || hasTestHistorical)
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
