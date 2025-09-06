import type { Schema } from '@/amplify/data/resource';

// Base data types from Amplify schema
export type StockWalletDataType = Schema['StockWallet']['type'];
export type TransactionDataType = Schema['Transaction']['type'];

// Simplified portfolio stock type for signals page
export interface PortfolioStockDataType {
  id: string;
  symbol: string;
  pdp: number | null | undefined;
  name?: string | null | undefined;
  budget?: number | null | undefined;
  testPrice?: number | null | undefined; // Add testPrice field that's already being fetched
  isHidden?: boolean | null | undefined;
  archived?: boolean | null | undefined;
  region?: string | null | undefined;
  htp?: number | null | undefined; // HTP percentage for Hold TP signal
  stockCommission?: number | null | undefined; // Commission percentage
  stockTrend?: string | null | undefined; // Stock trend: "Down", "Up", "Sideways"
}

// Table column visibility state for signals table
export interface ReportColumnVisibilityState {
  riskInvestment: boolean;
  fiveDayDip: boolean;
  lbd: boolean;
  swingWalletCount: boolean;
  sinceBuy: boolean;
  sinceSell: boolean;
  currentPrice: boolean;
  percentToBe: boolean;
  ltpiaTakeProfitPrice: boolean;
  percentToTp: boolean;
  tpShares: boolean;
}

// Data structure for each row in the signals table
export interface ReportDataItem {
  id: string;
  symbol: string;
  stockTrend?: string | null; // Stock trend: "Down", "Up", "Sideways"
  riskInvestment: number | null;
  budget: number | null; // Add budget for conditional styling
  currentPrice: number | null;
  isTestPrice?: boolean; // Flag to indicate if currentPrice is from testPrice override
  fiveDayDip: number | null;
  lbd: number | null;
  sinceBuy: number | null;
  sinceSell: number | null;
  swingWalletCount: number;
  buys: number;
  percentToBe: number | null;
  ltpiaTakeProfitPrice: number | null;
  percentToTp: number | null;
  tpShares: number | null;
  totalCurrentShares: number;
  incompleteBuyCount: number;
  hasHtpSignal: boolean;
  htpValues: string[];
}

// Sortable column keys for signals table
export type ReportColumnKey = 
  | 'symbol' 
  | 'riskInvestment'
  | 'currentPrice' 
  | 'fiveDayDip' 
  | 'lbd' 
  | 'sinceBuy'
  | 'sinceSell' 
  | 'swingWalletCount'
  | 'incompleteBuyCount' 
  | 'percentToBe' 
  | 'percentToTp' 
  | 'ltpiaTakeProfitPrice' 
  | 'tpShares';

// Sort configuration interface
export interface SortConfig<K extends string | number | symbol> {
  key: K;
  direction: 'ascending' | 'descending';
}

// Portfolio budget statistics
export interface PortfolioBudgetStats {
  totalBudget: number;
  totalInvested: number;
  budgetLeft: number;
  totalRiskInvestment: number;
}

// Portfolio transaction counts
export interface PortfolioTransactionCounts {
  buys: number;
  swingSells: number;
  holdSells: number;
  totalSells: number;
}

// Portfolio performance metrics (OOP, Cash Balance, Market Value, ROIC)
export interface PortfolioPerformanceMetrics {
  totalOOP: number;
  totalCashBalance: number;
  totalMarketValue: number;
  portfolioROIC: number | null;
}

// Portfolio realized P/L statistics
export interface PortfolioRealizedPL {
  totalSwingPlDollars: number;
  avgSwingPlPercent: number | null;
  totalHoldPlDollars: number;
  avgHoldPlPercent: number | null;
  totalStockPlDollars: number;
  avgStockPlPercent: number | null;
  totalDividendAmount: number;
  totalSlpAmount: number;
  totalIncomeFromDivAndSlp: number;
}

// Portfolio unrealized P/L statistics
export interface PortfolioUnrealizedPL {
  unrealizedSwingDollars: number;
  unrealizedSwingPercent: number | null;
  unrealizedHoldDollars: number;
  unrealizedHoldPercent: number | null;
  unrealizedTotalDollars: number;
  unrealizedTotalPercent: number | null;
  partialDataUsed: boolean;
}

// Portfolio total P/L statistics
export interface PortfolioTotalPL {
  totalSwingDollars: number;
  totalSwingPercent: number | null;
  totalHoldDollars: number;
  totalHoldPercent: number | null;
  totalStockDollars: number;
  totalStockPercent: number | null;
  totalIncomeFromDivAndSlp: number;
  partialDataUsed: boolean;
}

// Formatting utilities interface
export interface Formatters {
  formatCurrency: (value: number | null | undefined) => string;
  formatPercent: (value: number | null | undefined) => string;
}

// Precision configuration
export interface PrecisionConfig {
  CURRENCY_PRECISION: number;
  PERCENT_PRECISION: number;
}

// Cell styling utilities interface
export interface CellStyles {
  getBreakEvenCellStyle: (percent: number | null) => React.CSSProperties;
  getSinceBuyCellStyle: (days: number | null, swingWalletCount: number) => React.CSSProperties;
}

// Access level for page authorization
export type PageAccessLevel = 'loading' | 'approved' | 'denied';

// Price data type (commonly used across the app)
export type LatestPricesType = Record<string, { 
  currentPrice: number | null; 
  previousClose?: number 
} | null>;

// Transaction list result type
export type TransactionListResultType = Awaited<ReturnType<ReturnType<typeof import('aws-amplify/data').generateClient<Schema>>['models']['Transaction']['list']>>;

// Props interfaces for components
export interface SignalsOverviewProps {
  isExpanded: boolean;
  toggleExpand: () => void;
  portfolioBudgetStats: PortfolioBudgetStats;
  portfolioTransactionCounts: PortfolioTransactionCounts;
  portfolioPerformanceMetrics: PortfolioPerformanceMetrics;
  portfolioRealizedPL: PortfolioRealizedPL;
  portfolioUnrealizedPL: PortfolioUnrealizedPL;
  portfolioTotalPL: PortfolioTotalPL;
  formatters: Formatters;
  precision: PrecisionConfig;
}

export interface SignalsTableProps {
  isLoading: boolean;
  reportColumnVisibility: ReportColumnVisibilityState;
  setReportColumnVisibility: React.Dispatch<React.SetStateAction<ReportColumnVisibilityState>>;
  columnLabels: Record<keyof ReportColumnVisibilityState, string>;
  sortedTableData: ReportDataItem[];
  visibleColumnCount: number;
  requestSort: (key: ReportColumnKey) => void;
  sortConfig: SortConfig<ReportColumnKey> | null;
  formatters: Formatters;
  cellStyles: CellStyles;
}
