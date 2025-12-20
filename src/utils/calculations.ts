/**
 * Calculate profit/loss percentage between buy and sell price
 * @param buyPrice - Original purchase price
 * @param currentPrice - Current or sell price
 * @returns Profit percentage (positive) or loss percentage (negative)
 */
export function calculateProfitPercent(buyPrice: number, currentPrice: number): number {
  return ((currentPrice - buyPrice) / buyPrice) * 100;
}

/**
 * Calculate the profit target price
 * @param buyPrice - Original purchase price
 * @param targetPercent - Target profit percentage (e.g., 9 for 9%)
 * @returns Target sell price
 */
export function calculateProfitTargetPrice(buyPrice: number, targetPercent: number): number {
  return buyPrice * (1 + targetPercent / 100);
}
