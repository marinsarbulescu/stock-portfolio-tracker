// app/(authed)/portfolio/types.ts

import type { Schema } from '@/amplify/data/resource';

// ===== BASE SCHEMA TYPES =====
export type PortfolioStockDataType = Schema["PortfolioStock"]["type"];
export type StockWalletDataType = Schema['StockWallet']['type'];

// ===== PORTFOLIO STOCK OPERATION TYPES =====
export type PortfolioStockUpdateInput = Partial<PortfolioStockDataType> & { id: string };
export type PortfolioStockCreateInput = Omit<PortfolioStockDataType, 'id' | 'createdAt' | 'updatedAt' | 'owner' | 'transactions' | 'stockWallets'>;

// ===== ENUM/DROPDOWN TYPES =====
export type StockTypeValue = PortfolioStockDataType['stockType'];
export type RegionValue = PortfolioStockDataType['region'];
export type StockTrendValue = PortfolioStockDataType['stockTrend'];

// ===== PRICE-RELATED TYPES =====
export interface PriceData {
  symbol: string;
  currentPrice: number | null;
  historicalCloses: Array<{ date: string; close: number; }>;
  isTestPrice?: boolean; // Flag to indicate if currentPrice is from testPrice override
}

export type LatestPrices = Record<string, PriceData | null>;
export type PriceMap = Record<string, PriceData | null>;

// ===== COLUMN VISIBILITY TYPES =====
export interface PortfolioColumnVisibilityState {
  name: boolean;
  stockType: boolean;
  region: boolean;
  stockTrend: boolean;
  currentPrice: boolean;
  pdp: boolean;
  htp: boolean;
  plr: boolean;
  stockCommission: boolean;
  budget: boolean;
  investment: boolean;
}

export type PortfolioColumnKey = keyof PortfolioColumnVisibilityState;

// ===== SORTING TYPES =====
export type SortableStockKey = 
  | 'symbol'
  | 'name'
  | 'stockType'
  | 'region'
  | 'stockTrend'
  | 'currentPrice'
  | 'pdp'
  | 'htp'
  | 'plr'
  | 'stockCommission'
  | 'budget'
  | 'investment';

export interface StockSortConfig {
  key: SortableStockKey;
  direction: 'ascending' | 'descending';
}

// ===== DISTRIBUTION AND STATS TYPES =====
export interface RegionDistribution {
  US: number;
  Intl: number;
  APAC: number;
  EU: number;
}

export interface StockTypeDistribution {
  Stock: number;
  ETF: number;
  Crypto: number;
}

export interface InvestmentBreakdown {
  stock: { value: number; pct: number };
  etf: { value: number; pct: number };
  crypto?: { value: number; pct: number };
  total: { value: number; pct: number };
}

export interface RegionStats {
  counts: { 
    stock: number; 
    etf: number; 
    crypto?: number; 
    total: number 
  };
  swingInvestment: InvestmentBreakdown;
  holdInvestment: InvestmentBreakdown;
  totalInvestment: InvestmentBreakdown;
}

// ===== COMPONENT PROPS TYPES =====
export interface PortfolioTableProps {
  isLoading: boolean;
  error: string | null;
  sortedStocks: PortfolioStockDataType[];
  stockSortConfig: StockSortConfig | null;
  stockInvestments: Record<string, number>;
  latestPrices: LatestPrices;
  pricesLoading: boolean;
  showArchived: boolean;
  archivedCount: number;
  columnVisibility: PortfolioColumnVisibilityState;
  setColumnVisibility: React.Dispatch<React.SetStateAction<PortfolioColumnVisibilityState>>;
  visibleColumnCount: number;
  requestStockSort: (key: SortableStockKey) => void;
  handleEditClick: (stock: PortfolioStockDataType) => void;
  handleToggleHidden: (stock: PortfolioStockDataType) => void;
  handleArchiveStock: (stock: PortfolioStockDataType) => void;
  handleSplitClick: (stock: PortfolioStockDataType) => void;
}

export interface PortfolioOverviewProps {
  isOverviewExpanded: boolean;
  setIsOverviewExpanded: (expanded: boolean) => void;
  regionDistribution: RegionDistribution;
  stockTypeDistribution: StockTypeDistribution;
  percentages: RegionDistribution;
  stockTypePercentages: StockTypeDistribution;
  usRegionStats: RegionStats;
  euRegionStats: RegionStats;
  intlRegionStats: RegionStats;
  apacRegionStats: RegionStats;
}

export interface AddStockModalProps {
  isOpen: boolean;
  onStockAdded: () => void;
  onCancel: () => void;
}

export interface EditStockModalProps {
  isOpen: boolean;
  stockToEditData: PortfolioStockDataType | null;
  onUpdate: (updatePayload: PortfolioStockUpdateInput) => Promise<void>;
  onCancel: () => void;
}

// ===== CONSTANTS =====
export const STOCK_COLUMN_LABELS: Record<SortableStockKey, string> = {
  symbol: 'Ticker',
  name: 'Name',
  stockType: 'Type',
  region: 'Region',
  stockTrend: 'Trend',
  currentPrice: 'Last Price',
  pdp: 'PDP (%)',
  htp: 'HTP (%)',
  plr: 'PLR (%)',
  stockCommission: 'Comm (%)',
  budget: 'Budget',
  investment: 'Inv',
};

export const PORTFOLIO_COLUMN_LABELS: Record<PortfolioColumnKey, string> = {
  name: 'Name',
  stockType: 'Type',
  region: 'Region',
  stockTrend: 'Trend',
  currentPrice: 'Last Price',
  pdp: 'PDP (%)',
  htp: 'HTP (%)',
  plr: 'PLR (%)',
  stockCommission: 'Comm (%)',
  budget: 'Budget',
  investment: 'Inv',
};

// ===== MODAL STYLES =====
export const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.75)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 1000
};

export const modalContentStyle: React.CSSProperties = {
  backgroundColor: '#1e1e1e',
  borderRadius: '8px',
  maxHeight: '90vh',
  width: '90%',
  maxWidth: '500px',
  overflowY: 'auto',
  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)'
};
