// app/utils/dipRecoveryAnalysis.ts

export interface HistoricalClose {
  date: string;
  close: number;
}

export interface DipEvent {
  startDate: string;
  startPrice: number;
  lowestDate: string;
  lowestPrice: number;
  dropPercent: number;
  recoveryDate: string | null;
  recoveryPrice: number | null;
  recoveryDays: number | null;
  recovered: boolean;
  // Trade simulation fields
  buyPrice?: number;
  sellPrice?: number;
  sharesBought?: number;
  investmentUsed?: number;
  proceeds?: number;
  profit?: number;
  profitPercent?: number;
}

export interface DipFrequencyBucket {
  rangeLabel: string;
  minPercent: number;
  maxPercent: number;
  count: number;
}

export interface ROICSimulation {
  totalInvestmentUsed: number; // Total cash deployed across all trades
  totalCashReturned: number; // Total cash received from sells
  totalProfit: number; // Net profit/loss
  totalProfitPercent: number; // Overall profit percentage
  roicPercent: number; // Return on Initial Capital
  tradeCount: number; // Number of completed trades
  successfulTrades: number; // Trades that made profit
  successRate: number; // Percentage of profitable trades
  averageProfitPerTrade: number;
  largestGain: number;
  largestLoss: number;
}

export interface AnalysisResult {
  symbol: string;
  periodStart: string;
  periodEnd: string;
  totalDays: number;
  dipEvents: DipEvent[];
  recoveredDips: DipEvent[];
  statistics: {
    totalDips: number;
    recoveredCount: number;
    recoveryRate: number; // percentage
    averageDrop: number;
    medianDrop: number;
    minDrop: number;
    maxDrop: number;
    stdDeviation: number;
    averageRecoveryDays: number;
    medianRecoveryDays: number;
  };
  frequencyDistribution: DipFrequencyBucket[];
  recommendation: {
    suggestedBuyThreshold: number; // percent drop to buy at
    suggestedSellStrategy: string;
    expectedRecoveryDays: number;
  };
  roicSimulation?: ROICSimulation; // Optional: only present if investmentPerTrade is provided
}

export interface AnalysisOptions {
  minDropThreshold?: number; // Minimum drop % to consider (default: 0.3%)
  maxDropThreshold?: number; // Maximum drop % to consider (default: 10%)
  recoveryThreshold?: number; // % of previous high to consider recovered (default: 100%)
  investmentPerTrade?: number; // Amount to invest per trade for ROIC simulation (optional)
  buyThresholdPercent?: number; // Buy when price drops by this % (uses suggested threshold if not provided)
}

/**
 * Analyzes historical price data to identify dip-recovery cycles.
 *
 * Algorithm:
 * 1. Track local highs (highest price seen so far)
 * 2. When price drops, calculate drop % from local high
 * 3. When price recovers to match/exceed previous high, record the cycle
 * 4. Calculate statistics on all identified cycles
 *
 * @param data - Array of historical close prices sorted by date (oldest first)
 * @param symbol - Stock symbol being analyzed
 * @param options - Configuration options for the analysis
 * @returns Comprehensive analysis results
 */
export function analyzeDipRecoveryCycles(
  data: HistoricalClose[],
  symbol: string,
  options: AnalysisOptions = {}
): AnalysisResult {
  // Set default options
  const {
    minDropThreshold = 0.3,
    maxDropThreshold = 10,
    recoveryThreshold = 100,
    investmentPerTrade,
    buyThresholdPercent
  } = options;

  // Validate input
  if (!data || data.length < 2) {
    return createEmptyResult(symbol);
  }

  // Sort data by date to ensure chronological order
  const sortedData = [...data].sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const dipEvents: DipEvent[] = [];
  let localHigh = sortedData[0].close;
  let localHighDate = sortedData[0].date;
  let currentDip: Partial<DipEvent> | null = null;

  // Iterate through historical data
  for (let i = 1; i < sortedData.length; i++) {
    const currentPrice = sortedData[i].close;
    const currentDate = sortedData[i].date;

    // Check if we're in a dip or starting a new one
    if (currentPrice < localHigh) {
      const dropPercent = ((localHigh - currentPrice) / localHigh) * 100;

      // Start tracking a new dip if we don't have one
      if (!currentDip) {
        currentDip = {
          startDate: localHighDate,
          startPrice: localHigh,
          lowestDate: currentDate,
          lowestPrice: currentPrice,
          dropPercent: dropPercent,
          recovered: false
        };
      } else {
        // Update dip if this is a new low
        if (currentPrice < (currentDip.lowestPrice || Infinity)) {
          currentDip.lowestDate = currentDate;
          currentDip.lowestPrice = currentPrice;
          currentDip.dropPercent = dropPercent;
        }
      }
    } else {
      // Price is at or above local high
      const recoveryPriceThreshold = localHigh * (recoveryThreshold / 100);

      if (currentPrice >= recoveryPriceThreshold && currentDip) {
        // Dip has recovered!
        const recoveryDays = calculateDaysBetween(currentDip.startDate!, currentDate);

        const completedDip: DipEvent = {
          startDate: currentDip.startDate!,
          startPrice: currentDip.startPrice!,
          lowestDate: currentDip.lowestDate!,
          lowestPrice: currentDip.lowestPrice!,
          dropPercent: currentDip.dropPercent!,
          recoveryDate: currentDate,
          recoveryPrice: currentPrice,
          recoveryDays: recoveryDays,
          recovered: true
        };

        // Only record dip if it's within our threshold range
        if (
          completedDip.dropPercent >= minDropThreshold &&
          completedDip.dropPercent <= maxDropThreshold
        ) {
          dipEvents.push(completedDip);
        }

        // Reset for next cycle
        currentDip = null;
      }

      // Update local high if we've reached a new peak
      if (currentPrice > localHigh) {
        localHigh = currentPrice;
        localHighDate = currentDate;
      }
    }
  }

  // Handle any ongoing dip that hasn't recovered yet
  if (currentDip && currentDip.dropPercent) {
    if (
      currentDip.dropPercent >= minDropThreshold &&
      currentDip.dropPercent <= maxDropThreshold
    ) {
      dipEvents.push({
        startDate: currentDip.startDate!,
        startPrice: currentDip.startPrice!,
        lowestDate: currentDip.lowestDate!,
        lowestPrice: currentDip.lowestPrice!,
        dropPercent: currentDip.dropPercent,
        recoveryDate: null,
        recoveryPrice: null,
        recoveryDays: null,
        recovered: false
      });
    }
  }

  // Calculate statistics
  const recoveredDips = dipEvents.filter(d => d.recovered);
  const statistics = calculateStatistics(dipEvents, recoveredDips);
  const frequencyDistribution = calculateFrequencyDistribution(dipEvents);
  const recommendation = generateRecommendation(statistics);

  // Calculate ROIC simulation if investment amount is provided
  let roicSimulation: ROICSimulation | undefined;
  if (investmentPerTrade && investmentPerTrade > 0) {
    roicSimulation = simulateROIC(
      dipEvents,
      investmentPerTrade,
      buyThresholdPercent || recommendation.suggestedBuyThreshold
    );
  }

  return {
    symbol,
    periodStart: sortedData[0].date,
    periodEnd: sortedData[sortedData.length - 1].date,
    totalDays: sortedData.length,
    dipEvents,
    recoveredDips,
    statistics,
    frequencyDistribution,
    recommendation,
    roicSimulation
  };
}

/**
 * Calculate days between two date strings
 */
function calculateDaysBetween(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Calculate statistical metrics from dip events
 */
function calculateStatistics(
  allDips: DipEvent[],
  recoveredDips: DipEvent[]
): AnalysisResult['statistics'] {
  if (allDips.length === 0) {
    return {
      totalDips: 0,
      recoveredCount: 0,
      recoveryRate: 0,
      averageDrop: 0,
      medianDrop: 0,
      minDrop: 0,
      maxDrop: 0,
      stdDeviation: 0,
      averageRecoveryDays: 0,
      medianRecoveryDays: 0
    };
  }

  const dropPercents = allDips.map(d => d.dropPercent);
  const recoveryDays = recoveredDips
    .map(d => d.recoveryDays)
    .filter((days): days is number => days !== null);

  // Calculate average drop
  const averageDrop = dropPercents.reduce((sum, val) => sum + val, 0) / dropPercents.length;

  // Calculate median drop
  const sortedDrops = [...dropPercents].sort((a, b) => a - b);
  const medianDrop = sortedDrops[Math.floor(sortedDrops.length / 2)];

  // Calculate min/max
  const minDrop = Math.min(...dropPercents);
  const maxDrop = Math.max(...dropPercents);

  // Calculate standard deviation
  const variance = dropPercents.reduce((sum, val) =>
    sum + Math.pow(val - averageDrop, 2), 0
  ) / dropPercents.length;
  const stdDeviation = Math.sqrt(variance);

  // Calculate recovery days statistics
  const averageRecoveryDays = recoveryDays.length > 0
    ? recoveryDays.reduce((sum, val) => sum + val, 0) / recoveryDays.length
    : 0;

  const sortedRecoveryDays = [...recoveryDays].sort((a, b) => a - b);
  const medianRecoveryDays = sortedRecoveryDays.length > 0
    ? sortedRecoveryDays[Math.floor(sortedRecoveryDays.length / 2)]
    : 0;

  return {
    totalDips: allDips.length,
    recoveredCount: recoveredDips.length,
    recoveryRate: (recoveredDips.length / allDips.length) * 100,
    averageDrop,
    medianDrop,
    minDrop,
    maxDrop,
    stdDeviation,
    averageRecoveryDays,
    medianRecoveryDays
  };
}

/**
 * Calculate frequency distribution of dips into buckets
 */
function calculateFrequencyDistribution(dipEvents: DipEvent[]): DipFrequencyBucket[] {
  // Define buckets: 0-0.5%, 0.5-1%, 1-1.5%, 1.5-2%, 2-3%, 3-5%, 5-10%
  const buckets: DipFrequencyBucket[] = [
    { rangeLabel: '0-0.5%', minPercent: 0, maxPercent: 0.5, count: 0 },
    { rangeLabel: '0.5-1%', minPercent: 0.5, maxPercent: 1, count: 0 },
    { rangeLabel: '1-1.5%', minPercent: 1, maxPercent: 1.5, count: 0 },
    { rangeLabel: '1.5-2%', minPercent: 1.5, maxPercent: 2, count: 0 },
    { rangeLabel: '2-3%', minPercent: 2, maxPercent: 3, count: 0 },
    { rangeLabel: '3-5%', minPercent: 3, maxPercent: 5, count: 0 },
    { rangeLabel: '5-10%', minPercent: 5, maxPercent: 10, count: 0 },
    { rangeLabel: '10%+', minPercent: 10, maxPercent: Infinity, count: 0 }
  ];

  // Count dips in each bucket
  dipEvents.forEach(dip => {
    const bucket = buckets.find(b =>
      dip.dropPercent >= b.minPercent && dip.dropPercent < b.maxPercent
    );
    if (bucket) {
      bucket.count++;
    }
  });

  return buckets;
}

/**
 * Generate trading recommendations based on analysis
 */
function generateRecommendation(
  statistics: AnalysisResult['statistics']
): AnalysisResult['recommendation'] {
  // Suggest buy threshold slightly below the median dip
  // This gives a good balance between frequency and magnitude
  const suggestedBuyThreshold = parseFloat((statistics.medianDrop * 0.9).toFixed(2));

  // Generate sell strategy recommendation
  let sellStrategy = 'Sell when price recovers to previous high';
  if (statistics.recoveryRate > 90) {
    sellStrategy = 'High recovery rate - sell at previous high or slightly above';
  } else if (statistics.recoveryRate < 70) {
    sellStrategy = 'Lower recovery rate - consider tighter stop-loss or longer hold';
  }

  return {
    suggestedBuyThreshold,
    suggestedSellStrategy: sellStrategy,
    expectedRecoveryDays: Math.round(statistics.medianRecoveryDays)
  };
}

/**
 * Simulate trading strategy and calculate ROIC
 *
 * Based on WalletsOverview ROIC calculation:
 * ROIC = ((Total Value - Total Out-of-Pocket) / Total Out-of-Pocket) * 100
 * Where Total Value = Cash Balance + (Current Shares * Current Price)
 *
 * For our simulation:
 * - Total Out-of-Pocket = Sum of all investments made
 * - Cash Balance = Sum of all proceeds from sells
 * - Current Shares = 0 (we sell everything at recovery)
 * - ROIC = ((Cash Balance - Total Investment) / Total Investment) * 100
 */
function simulateROIC(
  dipEvents: DipEvent[],
  investmentPerTrade: number,
  buyThresholdPercent?: number
): ROICSimulation {
  let totalInvestmentUsed = 0;
  let totalCashReturned = 0;
  const profits: number[] = [];
  let successfulTrades = 0;

  // Process only recovered dips for completed trades
  const recoveredDips = dipEvents.filter(d => d.recovered);

  recoveredDips.forEach(dip => {
    // Determine buy price based on threshold
    // If buyThresholdPercent is provided, buy when price drops by that %
    // Otherwise, buy at the lowest price observed
    let buyPrice: number;

    if (buyThresholdPercent !== undefined) {
      // Buy when price drops by the threshold percent from local high
      buyPrice = dip.startPrice * (1 - buyThresholdPercent / 100);
      // But don't pay more than the lowest price observed
      buyPrice = Math.min(buyPrice, dip.lowestPrice);
    } else {
      // Buy at the lowest price (most conservative)
      buyPrice = dip.lowestPrice;
    }

    const sellPrice = dip.recoveryPrice!; // Recovery price (previous high)
    const sharesBought = investmentPerTrade / buyPrice;
    const proceeds = sharesBought * sellPrice;
    const profit = proceeds - investmentPerTrade;
    const profitPercent = (profit / investmentPerTrade) * 100;

    // Update dip event with trade simulation data
    dip.buyPrice = buyPrice;
    dip.sellPrice = sellPrice;
    dip.sharesBought = sharesBought;
    dip.investmentUsed = investmentPerTrade;
    dip.proceeds = proceeds;
    dip.profit = profit;
    dip.profitPercent = profitPercent;

    // Track totals
    totalInvestmentUsed += investmentPerTrade;
    totalCashReturned += proceeds;
    profits.push(profit);

    if (profit > 0) {
      successfulTrades++;
    }
  });

  const totalProfit = totalCashReturned - totalInvestmentUsed;
  const tradeCount = recoveredDips.length;

  // Calculate ROIC following the same pattern as WalletsOverview
  // ROIC = ((Total Value - Total OOP) / Total OOP) * 100
  // Total Value here is just Cash Balance since we have no remaining shares
  const roicPercent = totalInvestmentUsed > 0
    ? ((totalCashReturned - totalInvestmentUsed) / totalInvestmentUsed) * 100
    : 0;

  return {
    totalInvestmentUsed,
    totalCashReturned,
    totalProfit,
    totalProfitPercent: totalInvestmentUsed > 0
      ? (totalProfit / totalInvestmentUsed) * 100
      : 0,
    roicPercent,
    tradeCount,
    successfulTrades,
    successRate: tradeCount > 0 ? (successfulTrades / tradeCount) * 100 : 0,
    averageProfitPerTrade: tradeCount > 0 ? totalProfit / tradeCount : 0,
    largestGain: profits.length > 0 ? Math.max(...profits) : 0,
    largestLoss: profits.length > 0 ? Math.min(...profits) : 0
  };
}

/**
 * Create an empty result object for invalid/empty data
 */
function createEmptyResult(symbol: string): AnalysisResult {
  return {
    symbol,
    periodStart: '',
    periodEnd: '',
    totalDays: 0,
    dipEvents: [],
    recoveredDips: [],
    statistics: {
      totalDips: 0,
      recoveredCount: 0,
      recoveryRate: 0,
      averageDrop: 0,
      medianDrop: 0,
      minDrop: 0,
      maxDrop: 0,
      stdDeviation: 0,
      averageRecoveryDays: 0,
      medianRecoveryDays: 0
    },
    frequencyDistribution: [],
    recommendation: {
      suggestedBuyThreshold: 0,
      suggestedSellStrategy: 'Insufficient data for recommendation',
      expectedRecoveryDays: 0
    }
  };
}
