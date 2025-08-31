// Type overrides for E2E tests to fix Amplify Schema type conflicts
// These types match the actual runtime behavior where properties are strings, not string arrays

declare module '../utils/dataHelpers' {
  export interface PortfolioStockCreateData {
    owner: string;
    symbol: string;
    name: string;
    stockType: 'Stock' | 'ETF' | 'Crypto';
    region: 'APAC' | 'EU' | 'Intl' | 'US';
    pdp: number;
    stp: number;
    budget: number;
    swingHoldRatio: number;
    stockCommission: number;
    htp?: number;
    stockTrend?: 'Up' | 'Down' | 'Sideways' | null;
  }
}

declare module '../utils/pageHelpers' {
  export interface StockData {
    symbol: string;
    name: string;
    stockType: string;
    region: string;
    pdp: number;
    stp: number;
    budget: number;
    swingHoldRatio: number;
    stockCommission: number;
    htp?: number;
    stockTrend?: string;
    owner: string;
  }
}

// Override Amplify types for e2e tests
declare module '@aws-amplify/data-schema' {
  interface ModelType {
    readonly id: string;
  }
}
