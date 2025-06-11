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

export interface PLStats {
  totalSwingPlDollars?: number | null;
  avgSwingPlPercent?: number | null;
  totalHoldPlDollars?: number | null;
  avgHoldPlPercent?: number | null;
  totalStockPlDollars?: number | null;
  avgStockPlPercent?: number | null;
  totalSwingCostBasis?: number | null;
  totalHoldCostBasis?: number | null;
  totalStockCostBasis?: number | null;
}

export interface UnrealizedPLStats {
  unrealizedSwingDollars?: number | null;
  unrealizedSwingPercent?: number | null;
  unrealizedSwingCostBasis?: number | null;
  unrealizedHoldDollars?: number | null;
  unrealizedHoldPercent?: number | null;
  unrealizedHoldCostBasis?: number | null;
  unrealizedTotalDollars?: number | null;
  unrealizedTotalPercent?: number | null;
  unrealizedTotalCostBasis?: number | null;
}

export interface TotalPLStats {
  totalSwingPlDollars?: number | null;
  avgSwingPlPercent?: number | null;
  totalHoldPlDollars?: number | null;
  avgHoldPlPercent?: number | null;
  totalStockPlDollars?: number | null;
  avgStockPlPercent?: number | null;
  totalSwingCostBasis?: number | null;
  totalHoldCostBasis?: number | null;
  totalStockCostBasis?: number | null;
  totalStockPercent?: number | null;
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
  | 'quantity'
  | 'proceeds'
  | 'txnProfit'
  | 'txnProfitPercent';
