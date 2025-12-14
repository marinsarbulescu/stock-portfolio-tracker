/**
 * Get the effective price for an asset.
 * Priority: fetchedPrice (from Yahoo Finance) > testPrice (from DB)
 *
 * @param symbol - Asset symbol to look up
 * @param fetchedPrices - Map of symbol to fetched price from Yahoo Finance
 * @param testPrice - Test price from database (user-provided)
 * @returns The effective price to use, or null if neither is available
 */
export function getEffectivePrice(
  symbol: string,
  fetchedPrices: Record<string, number | null>,
  testPrice: number | null
): number | null {
  // If we have a valid fetched price (not null or 0), use it (overrides testPrice)
  const fetchedPrice = fetchedPrices[symbol];
  if (symbol in fetchedPrices && fetchedPrice !== null && fetchedPrice !== 0) {
    return fetchedPrice;
  }
  // Otherwise fall back to testPrice from database
  return testPrice;
}
