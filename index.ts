import { ModelInit, MutableModel, PersistentModelConstructor } from "@aws-amplify/datastore";
import { initSchema } from "@aws-amplify/datastore";

import { schema } from "./schema";

export enum StockType {
  STOCK = "Stock",
  ETF = "ETF",
  CRYPTO = "Crypto"
}

export enum Region {
  APAC = "APAC",
  EU = "EU",
  INTL = "Intl",
  US = "US"
}

export enum StockTrend {
  DOWN = "Down",
  UP = "Up",
  SIDEWAYS = "Sideways"
}

export enum TxnAction {
  BUY = "Buy",
  SELL = "Sell",
  DIV = "Div",
  SLP = "SLP"
}

export enum TxnSignal {
  5_DD = "_5DD",
  CUST = "Cust",
  INITIAL = "Initial",
  EOM = "EOM",
  LBD = "LBD",
  TPH = "TPH",
  TPP = "TPP",
  TP = "TP",
  DIV = "Div"
}

export enum WalletType {
  SWING = "Swing",
  HOLD = "Hold"
}

type EagerPortfolioStockModel = {
  readonly [__modelMeta__]: {
    identifier: ManagedIdentifier<PortfolioStock, 'id'>;
    readOnlyFields: 'createdAt' | 'updatedAt';
  };
  readonly id: string;
  readonly symbol: string;
  readonly stockType: StockType | keyof typeof StockType;
  readonly region: Region | keyof typeof Region;
  readonly stockTrend?: StockTrend | keyof typeof StockTrend | null;
  readonly name?: string | null;
  readonly pdp?: number | null;
  readonly plr?: number | null;
  readonly budget?: number | null;
  readonly isHidden?: boolean | null;
  readonly archived?: boolean | null;
  readonly archivedAt?: string | null;
  readonly swingHoldRatio?: number | null;
  readonly stockCommission?: number | null;
  readonly htp?: number | null;
  readonly transactions?: (TransactionModel | null)[] | null;
  readonly stockWallets?: (StockWalletModel | null)[] | null;
  readonly owner?: string | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

type LazyPortfolioStockModel = {
  readonly [__modelMeta__]: {
    identifier: ManagedIdentifier<PortfolioStock, 'id'>;
    readOnlyFields: 'createdAt' | 'updatedAt';
  };
  readonly id: string;
  readonly symbol: string;
  readonly stockType: StockType | keyof typeof StockType;
  readonly region: Region | keyof typeof Region;
  readonly stockTrend?: StockTrend | keyof typeof StockTrend | null;
  readonly name?: string | null;
  readonly pdp?: number | null;
  readonly plr?: number | null;
  readonly budget?: number | null;
  readonly isHidden?: boolean | null;
  readonly archived?: boolean | null;
  readonly archivedAt?: string | null;
  readonly swingHoldRatio?: number | null;
  readonly stockCommission?: number | null;
  readonly htp?: number | null;
  readonly transactions: AsyncCollection<TransactionModel>;
  readonly stockWallets: AsyncCollection<StockWalletModel>;
  readonly owner?: string | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

export declare type PortfolioStockModel = LazyLoading extends LazyLoadingDisabled ? EagerPortfolioStockModel : LazyPortfolioStockModel

export declare const PortfolioStockModel: (new (init: ModelInit<PortfolioStockModel>) => PortfolioStockModel) & {
  copyOf(source: PortfolioStockModel, mutator: (draft: MutableModel<PortfolioStockModel>) => MutableModel<PortfolioStockModel> | void): PortfolioStockModel;
}

type EagerTransactionModel = {
  readonly [__modelMeta__]: {
    identifier: ManagedIdentifier<Transaction, 'id'>;
    readOnlyFields: 'createdAt' | 'updatedAt';
  };
  readonly id: string;
  readonly date: string;
  readonly action: TxnAction | keyof typeof TxnAction;
  readonly signal?: TxnSignal | keyof typeof TxnSignal | null;
  readonly price?: number | null;
  readonly investment?: number | null;
  readonly quantity?: number | null;
  readonly amount?: number | null;
  readonly swingShares?: number | null;
  readonly holdShares?: number | null;
  readonly txnType?: string | null;
  readonly archived?: boolean | null;
  readonly archivedAt?: string | null;
  readonly lbd?: number | null;
  readonly tp?: number | null;
  readonly completedTxnId?: string | null;
  readonly txnProfit?: number | null;
  readonly txnProfitPercent?: number | null;
  readonly portfolioStockId: string;
  readonly portfolioStock?: PortfolioStockModel | null;
  readonly owner?: string | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

type LazyTransactionModel = {
  readonly [__modelMeta__]: {
    identifier: ManagedIdentifier<Transaction, 'id'>;
    readOnlyFields: 'createdAt' | 'updatedAt';
  };
  readonly id: string;
  readonly date: string;
  readonly action: TxnAction | keyof typeof TxnAction;
  readonly signal?: TxnSignal | keyof typeof TxnSignal | null;
  readonly price?: number | null;
  readonly investment?: number | null;
  readonly quantity?: number | null;
  readonly amount?: number | null;
  readonly swingShares?: number | null;
  readonly holdShares?: number | null;
  readonly txnType?: string | null;
  readonly archived?: boolean | null;
  readonly archivedAt?: string | null;
  readonly lbd?: number | null;
  readonly tp?: number | null;
  readonly completedTxnId?: string | null;
  readonly txnProfit?: number | null;
  readonly txnProfitPercent?: number | null;
  readonly portfolioStockId: string;
  readonly portfolioStock: AsyncItem<PortfolioStockModel | undefined>;
  readonly owner?: string | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

export declare type TransactionModel = LazyLoading extends LazyLoadingDisabled ? EagerTransactionModel : LazyTransactionModel

export declare const TransactionModel: (new (init: ModelInit<TransactionModel>) => TransactionModel) & {
  copyOf(source: TransactionModel, mutator: (draft: MutableModel<TransactionModel>) => MutableModel<TransactionModel> | void): TransactionModel;
}

type EagerPortfolioGoalsModel = {
  readonly [__modelMeta__]: {
    identifier: ManagedIdentifier<PortfolioGoals, 'id'>;
    readOnlyFields: 'createdAt' | 'updatedAt';
  };
  readonly id: string;
  readonly totalBudget?: number | null;
  readonly usBudgetPercent?: number | null;
  readonly intBudgetPercent?: number | null;
  readonly usStocksTarget?: number | null;
  readonly usEtfsTarget?: number | null;
  readonly intStocksTarget?: number | null;
  readonly intEtfsTarget?: number | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

type LazyPortfolioGoalsModel = {
  readonly [__modelMeta__]: {
    identifier: ManagedIdentifier<PortfolioGoals, 'id'>;
    readOnlyFields: 'createdAt' | 'updatedAt';
  };
  readonly id: string;
  readonly totalBudget?: number | null;
  readonly usBudgetPercent?: number | null;
  readonly intBudgetPercent?: number | null;
  readonly usStocksTarget?: number | null;
  readonly usEtfsTarget?: number | null;
  readonly intStocksTarget?: number | null;
  readonly intEtfsTarget?: number | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

export declare type PortfolioGoalsModel = LazyLoading extends LazyLoadingDisabled ? EagerPortfolioGoalsModel : LazyPortfolioGoalsModel

export declare const PortfolioGoalsModel: (new (init: ModelInit<PortfolioGoalsModel>) => PortfolioGoalsModel) & {
  copyOf(source: PortfolioGoalsModel, mutator: (draft: MutableModel<PortfolioGoalsModel>) => MutableModel<PortfolioGoalsModel> | void): PortfolioGoalsModel;
}

type EagerStockWalletModel = {
  readonly [__modelMeta__]: {
    identifier: ManagedIdentifier<StockWallet, 'id'>;
    readOnlyFields: 'createdAt' | 'updatedAt';
  };
  readonly id: string;
  readonly portfolioStockId: string;
  readonly walletType: WalletType | keyof typeof WalletType;
  readonly portfolioStock?: PortfolioStockModel | null;
  readonly buyPrice: number;
  readonly totalSharesQty: number;
  readonly totalInvestment: number;
  readonly sharesSold: number;
  readonly remainingShares?: number | null;
  readonly archived?: boolean | null;
  readonly archivedAt?: string | null;
  readonly realizedPl?: number | null;
  readonly tpValue?: number | null;
  readonly tpPercent?: number | null;
  readonly realizedPlPercent?: number | null;
  readonly sellTxnCount: number;
  readonly owner?: string | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

type LazyStockWalletModel = {
  readonly [__modelMeta__]: {
    identifier: ManagedIdentifier<StockWallet, 'id'>;
    readOnlyFields: 'createdAt' | 'updatedAt';
  };
  readonly id: string;
  readonly portfolioStockId: string;
  readonly walletType: WalletType | keyof typeof WalletType;
  readonly portfolioStock: AsyncItem<PortfolioStockModel | undefined>;
  readonly buyPrice: number;
  readonly totalSharesQty: number;
  readonly totalInvestment: number;
  readonly sharesSold: number;
  readonly remainingShares?: number | null;
  readonly archived?: boolean | null;
  readonly archivedAt?: string | null;
  readonly realizedPl?: number | null;
  readonly tpValue?: number | null;
  readonly tpPercent?: number | null;
  readonly realizedPlPercent?: number | null;
  readonly sellTxnCount: number;
  readonly owner?: string | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

export declare type StockWalletModel = LazyLoading extends LazyLoadingDisabled ? EagerStockWalletModel : LazyStockWalletModel

export declare const StockWalletModel: (new (init: ModelInit<StockWalletModel>) => StockWalletModel) & {
  copyOf(source: StockWalletModel, mutator: (draft: MutableModel<StockWalletModel>) => MutableModel<StockWalletModel> | void): StockWalletModel;
}

type EagerHistoricalCloseInputModel = {
  readonly date: string;
  readonly close: number;
}

type LazyHistoricalCloseInputModel = {
  readonly date: string;
  readonly close: number;
}

export declare type HistoricalCloseInputModel = LazyLoading extends LazyLoadingDisabled ? EagerHistoricalCloseInputModel : LazyHistoricalCloseInputModel

export declare const HistoricalCloseInputModel: (new (init: ModelInit<HistoricalCloseInputModel>) => HistoricalCloseInputModel)

type EagerPriceResultModel = {
  readonly symbol: string;
  readonly currentPrice?: number | null;
  readonly historicalCloses: (HistoricalCloseInput | null)[];
}

type LazyPriceResultModel = {
  readonly symbol: string;
  readonly currentPrice?: number | null;
  readonly historicalCloses: (HistoricalCloseInput | null)[];
}

export declare type PriceResultModel = LazyLoading extends LazyLoadingDisabled ? EagerPriceResultModel : LazyPriceResultModel

export declare const PriceResultModel: (new (init: ModelInit<PriceResultModel>) => PriceResultModel)

const { PortfolioStock, Transaction, PortfolioGoals, StockWallet, HistoricalCloseInput, PriceResult } = initSchema(schema) as {
  PortfolioStock: PersistentModelConstructor<PortfolioStockModel>;
  Transaction: PersistentModelConstructor<TransactionModel>;
  PortfolioGoals: PersistentModelConstructor<PortfolioGoalsModel>;
  StockWallet: PersistentModelConstructor<StockWalletModel>;
  HistoricalCloseInput: PersistentModelConstructor<HistoricalCloseInputModel>;
  PriceResult: PersistentModelConstructor<PriceResultModel>;
};

export {
  PortfolioStock,
  Transaction,
  PortfolioGoals,
  StockWallet
};