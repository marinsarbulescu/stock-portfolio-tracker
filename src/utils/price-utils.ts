import { PriceData, HistoricalClose } from "@/contexts/PriceContext";

/**
 * Get the effective price for an asset.
 * Priority: fetchedPrice (from Yahoo Finance) > testPrice (from DB)
 *
 * @param symbol - Asset symbol to look up
 * @param fetchedPrices - Map of symbol to PriceData from Yahoo Finance
 * @param testPrice - Test price from database (user-provided)
 * @returns The effective price to use, or null if neither is available
 */
export function getEffectivePrice(
  symbol: string,
  fetchedPrices: Record<string, PriceData>,
  testPrice: number | null
): number | null {
  // If we have a valid fetched price (not null or 0), use it (overrides testPrice)
  const priceData = fetchedPrices[symbol];
  if (
    priceData?.currentPrice !== null &&
    priceData?.currentPrice !== undefined &&
    priceData?.currentPrice !== 0
  ) {
    return priceData.currentPrice;
  }
  // Otherwise fall back to testPrice from database
  return testPrice;
}

/**
 * Get historical closes for an asset.
 *
 * @param symbol - Asset symbol to look up
 * @param fetchedPrices - Map of symbol to PriceData from Yahoo Finance
 * @returns Array of historical closes, or empty array if not available
 */
export function getHistoricalCloses(
  symbol: string,
  fetchedPrices: Record<string, PriceData>
): HistoricalClose[] {
  return fetchedPrices[symbol]?.historicalCloses ?? [];
}
