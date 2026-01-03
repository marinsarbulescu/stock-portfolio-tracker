/**
 * Utility functions for Dashboard signal calculations.
 */

export interface HistoricalClose {
  date: string;
  close: number;
}

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
 * @returns 'default' (< -1%), 'yellow' (-1% to < -0.005%), or 'green' (>= -0.005%, rounds to 0.00%)
 */
export function getPct2PTColor(
  pct: number | null
): "default" | "yellow" | "green" {
  if (pct === null) return "default";
  if (pct >= -0.005) return "green"; // PT hit (includes values that round to 0.00%)
  if (pct >= -1) return "yellow"; // -1% to -0.01% (close to PT)
  return "default"; // < -1%
}

/**
 * Calculate 5D Pullback: the largest dip from a recent high that meets ET threshold
 * Compares effective price with the last 5 trading days' close prices.
 * If the effective price has dropped more than ET% from any close, returns the
 * dip percentage from the highest close among all hits.
 *
 * @param effectivePrice - Current effective price
 * @param historicalCloses - Last ~7 days of close prices (will use most recent 5)
 * @param entryTargetPercent - Entry target percentage (stored as positive, e.g., 5 for -5%)
 * @returns The dip percentage (negative) or null if no hit
 */
export function calculate5DPullback(
  effectivePrice: number | null,
  historicalCloses: HistoricalClose[] | null | undefined,
  entryTargetPercent: number | null
): number | null {
  if (
    effectivePrice === null ||
    !historicalCloses?.length ||
    entryTargetPercent === null
  ) {
    return null;
  }

  // Sort by date descending and take last 5
  const last5Closes = [...historicalCloses]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  if (last5Closes.length === 0) return null;

  // Find all "hits" - closes where the dip meets ET threshold
  const hits: { close: number; dipPercent: number }[] = [];
  const threshold = -Math.abs(entryTargetPercent);

  for (const day of last5Closes) {
    if (day.close > 0) {
      const dipPercent = ((effectivePrice - day.close) / day.close) * 100;

      if (dipPercent <= threshold) {
        hits.push({ close: day.close, dipPercent });
      }
    }
  }

  if (hits.length === 0) return null;

  // Return dip from highest close (which gives most negative dip)
  const highestHit = hits.reduce((max, hit) =>
    hit.close > max.close ? hit : max
  );

  return highestHit.dipPercent;
}
