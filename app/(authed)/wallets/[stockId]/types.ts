import type { Schema } from '@/amplify/data/resource';

export type StockWalletDataType = Schema['StockWallet']['type'];
export type TransactionDataType = Schema['Transaction']['type'];

export interface TransactionCounts {
  buys: number;
  swingSells: number;
  holdSells: number;
  totalSells: number;
}
export interface CurrentShares {
  swing: number;
  hold: number;
  total: number;
}

export interface RealizedPLStats {
  realizedSwingPL?: number | null;
  realizedSwingPercent?: number | null;
  realizedHoldPL?: number | null;
  realizedHoldPercent?: number | null;
  realizedStockPL?: number | null;
  realizedStockPercent?: number | null;
  totalSwingCostBasis?: number | null;
  totalHoldCostBasis?: number | null;
  totalStockCostBasis?: number | null;
  totalDividendAmount?: number | null;
  totalSlpAmount?: number | null;
  totalIncomeFromDivAndSlp?: number | null;
}

export interface UnrealizedPLStats {
  unrealizedSwingPL?: number | null;
  unrealizedSwingPercent?: number | null;
  unrealizedSwingCostBasis?: number | null;
  unrealizedHoldPL?: number | null;
  unrealizedHoldPercent?: number | null;
  unrealizedHoldCostBasis?: number | null;
  unrealizedStockPL?: number | null;
  unrealizedStockPercent?: number | null;
  unrealizedStockCostBasis?: number | null;
}

export interface CombinedPLStats {
  combinedSwingPL?: number | null;
  combinedSwingPercent?: number | null;
  combinedHoldPL?: number | null;
  combinedHoldPercent?: number | null;
  combinedStockPL?: number | null;
  combinedStockPercent?: number | null;
  // Legacy fields for compatibility (these are for realized P/L percentages, not total)
  avgSwingPlPercent?: number | null;
  avgHoldPlPercent?: number | null;
  avgStockPlPercent?: number | null;
  totalSwingCostBasis?: number | null;
  totalHoldCostBasis?: number | null;
  totalStockCostBasis?: number | null;
}

export interface WalletColumnVisibilityState {
  buyPrice: boolean;
  quantity: boolean;
  totalInvestment: boolean;
  currentPrice: boolean;
  currentValue: boolean;
  unrealizedPl: boolean;
  unrealizedPlPercent: boolean;
  tp: boolean;
  tpPercent: boolean;
  walletType: boolean;
  notes: boolean;
}

export type WalletSortableKey =
  | 'createdAt'
  | 'buyPrice'
  | 'totalSharesQty'
  | 'totalInvestment'
  | 'walletType';

export interface SortConfig<K extends string | number | symbol> {
  key: K;
  direction: 'ascending' | 'descending';
}

export type LatestPricesType = Record<string, { currentPrice: number; previousClose?: number }>;

// Table-specific types for Wallets section
export interface WalletsTableColumnVisibilityState {
  id: boolean;
  buyPrice: boolean;
  totalInvestment: boolean;
  tpValue: boolean;
  htp: boolean;
  sellTxnCount: boolean;
  sharesSold: boolean;
  realizedPl: boolean;
  realizedPlPercent: boolean;
  remainingShares: boolean;
}

export type WalletsTableSortableKey =
  | 'id'
  | 'buyPrice'
  | 'totalInvestment'
  | 'tpValue'
  | 'htp'
  | 'sellTxnCount'
  | 'sharesSold'
  | 'realizedPl'
  | 'realizedPlPercent'
  | 'remainingShares';

// Table-specific types for Transactions section
export interface TransactionTableColumnVisibilityState {
  date: boolean;
  action: boolean;
  txnType: boolean;
  signal: boolean;
  price: boolean;
  lbd: boolean;
  investment: boolean;
  amount: boolean;
  quantity: boolean;
  proceeds: boolean;
  txnProfit: boolean;
  txnProfitPercent: boolean;
  completedTxnId: boolean;
}

export type SortableTxnKey =
  | 'date'
  | 'action'
  | 'txnType'
  | 'signal'
  | 'price'
  | 'lbd'
  | 'investment'
  | 'amount'
  | 'quantity'
  | 'proceeds'
  | 'txnProfit'
  | 'txnProfitPercent';
