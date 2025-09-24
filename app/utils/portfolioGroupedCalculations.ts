// app/utils/portfolioGroupedCalculations.ts
import type { PortfolioStockDataType, StockWalletDataType, LatestPrices } from '@/app/(authed)/portfolio/types';
import { SHARE_EPSILON } from '../config/constants';

export interface GroupedInvestmentData {
  groupName: string;
  maxRisk: number;
  oop: number;
  tiedUp: number;
  marketValue: number;
  roic: number;
}

interface CalculateGroupedInvestmentDataParams {
  groupBy: 'region' | 'marketCategory' | 'riskGrowthProfile';
  stocks: PortfolioStockDataType[];
  stockOOPInvestments: Record<string, number>;
  stockInvestments: Record<string, number>;
  wallets: StockWalletDataType[];
  latestPrices: LatestPrices;
}

// Define all possible enum values
const REGION_VALUES = ['APAC', 'EU', 'Intl', 'US'];
const MARKET_CATEGORY_VALUES = [
  'APAC_Index',
  'China_Index',
  'Crypto',
  'Emerging_Index',
  'Europe_Index',
  'International_Index',
  'Metals',
  'Oil',
  'Opportunity',
  'US_Index'
];
const RISK_PROFILE_VALUES = ['Hare', 'Tortoise'];

export function calculateGroupedInvestmentData({
  groupBy,
  stocks,
  stockOOPInvestments,
  stockInvestments,
  wallets,
  latestPrices,
}: CalculateGroupedInvestmentDataParams): GroupedInvestmentData[] {
  // Initialize all groups with empty arrays based on groupBy type
  const groups = new Map<string, PortfolioStockDataType[]>();
  
  if (groupBy === 'region') {
    REGION_VALUES.forEach(region => groups.set(region, []));
  } else if (groupBy === 'marketCategory') {
    MARKET_CATEGORY_VALUES.forEach(category => groups.set(category, []));
  } else {
    RISK_PROFILE_VALUES.forEach(profile => groups.set(profile, []));
  }
  
  // Populate groups with actual stocks
  stocks.forEach(stock => {
    let groupKey: string;
    if (groupBy === 'region') {
      groupKey = stock.region || 'Unknown';
    } else if (groupBy === 'marketCategory') {
      groupKey = stock.marketCategory || 'Unknown';
    } else {
      groupKey = stock.riskGrowthProfile || 'Unknown';
    }
    
    if (groups.has(groupKey)) {
      groups.get(groupKey)!.push(stock);
    }
  });

  // Calculate metrics for each group
  const results: GroupedInvestmentData[] = [];
  
  groups.forEach((stocksInGroup, groupName) => {
    let maxRisk = 0;
    let totalOOP = 0;
    let totalTiedUp = 0;
    let totalMarketValue = 0;

    stocksInGroup.forEach(stock => {
      // Max Risk - sum of budgets only for active (non-hidden) stocks
      if (!stock.isHidden) {
        const stockBudget = stock.budget ?? 0;
        maxRisk += stockBudget;
      }

      // OOP - total out-of-pocket investment
      totalOOP += stockOOPInvestments[stock.id] || 0;

      // Tied-up investment
      totalTiedUp += stockInvestments[stock.id] || 0;

      // Market Value - current value of all positions
      // Get all wallets for this stock
      const stockWallets = wallets.filter(w => w.portfolioStockId === stock.id);
      
      stockWallets.forEach(wallet => {
        if ((wallet.remainingShares ?? 0) > SHARE_EPSILON) {
          const currentPrice = latestPrices[stock.symbol]?.currentPrice;
          if (typeof currentPrice === 'number') {
            totalMarketValue += (wallet.remainingShares ?? 0) * currentPrice;
          }
        }
      });
    });

    // Calculate ROIC
    let roic = 0;
    if (totalOOP > 0) {
      // ROIC = (Market Value - OOP) / OOP * 100
      roic = ((totalMarketValue - totalOOP) / totalOOP) * 100;
    }

    results.push({
      groupName,
      maxRisk,
      oop: totalOOP,
      tiedUp: totalTiedUp,
      marketValue: totalMarketValue,
      roic,
    });
  });

  // Sort results based on groupBy type
  if (groupBy === 'region') {
    // Keep the original order from REGION_VALUES
    const regionOrder = REGION_VALUES;
    results.sort((a, b) => {
      const aIndex = regionOrder.indexOf(a.groupName);
      const bIndex = regionOrder.indexOf(b.groupName);
      return aIndex - bIndex;
    });
  } else if (groupBy === 'marketCategory') {
    // Keep the original order from MARKET_CATEGORY_VALUES
    const categoryOrder = MARKET_CATEGORY_VALUES;
    results.sort((a, b) => {
      const aIndex = categoryOrder.indexOf(a.groupName);
      const bIndex = categoryOrder.indexOf(b.groupName);
      return aIndex - bIndex;
    });
  } else {
    // Keep the original order from RISK_PROFILE_VALUES
    const profileOrder = RISK_PROFILE_VALUES;
    results.sort((a, b) => {
      const aIndex = profileOrder.indexOf(a.groupName);
      const bIndex = profileOrder.indexOf(b.groupName);
      return aIndex - bIndex;
    });
  }

  return results;
}

// Helper function to format group names for display
export function formatGroupName(groupName: string, groupBy: 'region' | 'marketCategory' | 'riskGrowthProfile'): string {
  if (groupBy === 'marketCategory') {
    // Convert underscore format to readable format
    return groupName.replace(/_/g, ' ');
  }
  return groupName;
}