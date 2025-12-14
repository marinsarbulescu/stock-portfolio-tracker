/**
 * Utility functions for Dashboard signal calculations.
 */

/**
 * Calculate pullback percentage from last buy price
 * @param currentPrice - Current asset price (testPrice)
 * @param lastBuyPrice - Price of the most recent BUY transaction
 * @returns Percentage change (negative = pullback, positive = gain)
 */
export function calculatePullbackPercent(
  currentPrice: number | null,
  lastBuyPrice: number | null
): number | null {
  if (currentPrice === null || lastBuyPrice === null || lastBuyPrice === 0) {
    return null;
  }
  return ((currentPrice - lastBuyPrice) / lastBuyPrice) * 100;
}

/**
 * Check if pullback percentage triggers entry target
 * @param pullbackPercent - Current pullback percentage (negative value)
 * @param entryTargetPercent - Entry target stored as positive (e.g., 5 for -5%)
 * @returns true if pullback is at or below the negative entry target
 */
export function isPullbackTriggered(
  pullbackPercent: number | null,
  entryTargetPercent: number | null
): boolean {
  if (pullbackPercent === null || entryTargetPercent === null) {
    return false;
  }
  // ET is stored as positive (e.g., 5), pullback is negative (e.g., -5)
  // Trigger when pullback <= -entryTargetPercent
  return pullbackPercent <= -entryTargetPercent;
}

/**
 * Calculate days since a given date
 * @param dateString - ISO date string
 * @returns Number of days since the date
 */
export function calculateDaysSince(dateString: string | null): number | null {
  if (!dateString) return null;

  const date = new Date(dateString);
  const now = new Date();
  const diffTime = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

/**
 * Get color indicator for days since last buy
 * @param days - Number of days since last buy
 * @returns 'default' (0-24), 'yellow' (25-30), or 'red' (31+)
 */
export function getDaysSinceColor(
  days: number | null
): "default" | "yellow" | "red" {
  if (days === null) return "default";
  if (days >= 31) return "red";
  if (days >= 25) return "yellow";
  return "default";
}

/**
 * Calculate percentage distance to a target price
 * @param currentPrice - Current price
 * @param targetPrice - Target price to reach
 * @returns Percentage distance (negative = below target, positive = at/above)
 */
export function calculatePctToTarget(
  currentPrice: number | null,
  targetPrice: number | null
): number | null {
  if (currentPrice === null || targetPrice === null || targetPrice === 0) {
    return null;
  }
  return ((currentPrice - targetPrice) / targetPrice) * 100;
}

/**
 * Get color indicator for %2PT (percentage to profit target)
 * @param pct - Percentage to profit target
 * @returns 'default' (< -1%), 'yellow' (-1% to -0.01%), or 'green' (>= 0%)
 */
export function getPct2PTColor(
  pct: number | null
): "default" | "yellow" | "green" {
  if (pct === null) return "default";
  if (pct >= 0) return "green"; // PT hit
  if (pct >= -1) return "yellow"; // -1% to -0.01% (close to PT)
  return "default"; // < -1%
}
