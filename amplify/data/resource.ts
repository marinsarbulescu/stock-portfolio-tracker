import { a, defineData, type ClientSchema } from "@aws-amplify/backend";
import { getYfinanceData } from "../functions/getYfinanceData/resource.js";

const schema = a.schema({
  // Enums
  AssetType: a.enum(["STOCK", "ETF", "CRYPTO"]),
  AssetStatus: a.enum(["ACTIVE", "HIDDEN", "ARCHIVED"]),
  TransactionType: a.enum(["BUY", "SELL", "DIVIDEND", "SPLIT", "SLP"]),
  TransactionSignal: a.enum(["REPULL", "CUSTOM", "INITIAL", "EOM", "ENTAR", "TP"]),

  // Asset - Primary table for stocks, ETFs, and crypto
  Asset: a
    .model({
      symbol: a.string().required(),
      name: a.string().required(),
      type: a.ref("AssetType").required(),
      testPrice: a.float(), // For E2E testing signals
      commission: a.float(), // Percentage per sell transaction
      status: a.ref("AssetStatus").required(),
      // Relationships
      yearlyBudgets: a.hasMany("YearlyBudget", "assetId"),
      profitTargets: a.hasMany("ProfitTarget", "assetId"),
      entryTargets: a.hasMany("EntryTarget", "assetId"),
      transactions: a.hasMany("Transaction", "assetId"),
      wallets: a.hasMany("Wallet", "assetId"),
    })
    .authorization((allow) => [allow.owner()]),

  // YearlyBudget - Annual budget per asset for ROI tracking
  YearlyBudget: a
    .model({
      year: a.integer().required(),
      amount: a.float().required(),
      // Relationship
      assetId: a.id().required(),
      asset: a.belongsTo("Asset", "assetId"),
    })
    .authorization((allow) => [allow.owner()]),

  // ProfitTarget - Tiered sell signals when price increases
  ProfitTarget: a
    .model({
      name: a.string().required(),
      targetPercent: a.float().required(),
      allocationPercent: a.float(), // Optional - % of shares to sell
      sortOrder: a.integer().required(),
      // Relationships
      assetId: a.id().required(),
      asset: a.belongsTo("Asset", "assetId"),
      allocations: a.hasMany("TransactionAllocation", "profitTargetId"),
      wallets: a.hasMany("Wallet", "profitTargetId"),
    })
    .authorization((allow) => [allow.owner()]),

  // EntryTarget - Tiered buy signals when price decreases
  EntryTarget: a
    .model({
      name: a.string().required(),
      targetPercent: a.float().required(), // Stored as positive
      sortOrder: a.integer().required(),
      // Relationship
      assetId: a.id().required(),
      asset: a.belongsTo("Asset", "assetId"),
    })
    .authorization((allow) => [allow.owner()]),

  // Transaction - Buy/Sell/Dividend/Split/SLP records
  Transaction: a
    .model({
      type: a.ref("TransactionType").required(),
      date: a.datetime().required(), // Date+time, allows backdating
      signal: a.ref("TransactionSignal"), // Required for BUY/SELL
      quantity: a.float(), // Number of shares (BUY/SELL)
      amount: a.float(), // Payment received (DIVIDEND/SLP) or net proceeds (SELL)
      splitRatio: a.float(), // Required for SPLIT
      price: a.float(), // Required for BUY/SELL
      investment: a.float(), // Required for BUY
      costBasis: a.float(), // For SELL: buyPrice × quantity (what was paid for sold shares)
      entryTargetPrice: a.float(), // Calculated ET price for BUY (price * (1 + ET%/100))
      entryTargetPercent: a.float(), // ET percentage used (e.g., -5)
      // Relationships
      assetId: a.id().required(),
      asset: a.belongsTo("Asset", "assetId"),
      allocations: a.hasMany("TransactionAllocation", "transactionId"),
      walletId: a.id(), // Optional - only for SELL transactions
      wallet: a.belongsTo("Wallet", "walletId"),
    })
    .authorization((allow) => [allow.owner()]),

  // TransactionAllocation - Links BUY transactions to profit targets and wallets
  TransactionAllocation: a
    .model({
      transactionId: a.id().required(),
      transaction: a.belongsTo("Transaction", "transactionId"),
      profitTargetId: a.id().required(),
      profitTarget: a.belongsTo("ProfitTarget", "profitTargetId"),
      walletId: a.id().required(), // Links allocation to the wallet it contributes to
      wallet: a.belongsTo("Wallet", "walletId"),
      percentage: a.float().required(), // User input (e.g., 50)
      shares: a.float().required(), // Calculated: (percentage/100) * totalShares
    })
    .authorization((allow) => [allow.owner()]),

  // Wallet - Aggregates BUY transactions by price and profit target
  Wallet: a
    .model({
      price: a.float().required(),
      investment: a.float().required(), // Sum of all investments at this price/PT
      shares: a.float().required(), // Calculated: investment / price
      profitTargetPrice: a.float().required(), // Pre-calculated: price * (1 + PT%) / (1 - commission%)
      // Relationships
      assetId: a.id().required(),
      asset: a.belongsTo("Asset", "assetId"),
      profitTargetId: a.id().required(),
      profitTarget: a.belongsTo("ProfitTarget", "profitTargetId"),
      sellTransactions: a.hasMany("Transaction", "walletId"),
      allocations: a.hasMany("TransactionAllocation", "walletId"), // BUY allocations that contributed to this wallet
    })
    .authorization((allow) => [allow.owner()]),

  // Custom type for historical close data
  HistoricalClose: a.customType({
    date: a.string().required(),
    close: a.float().required(),
  }),

  // Custom type for Yahoo Finance price result
  PriceResult: a.customType({
    symbol: a.string().required(),
    currentPrice: a.float(),
    historicalCloses: a.ref("HistoricalClose").array(),
  }),

  // Query to fetch latest prices from Yahoo Finance
  getLatestPrices: a
    .query()
    .arguments({ symbols: a.string().array().required() })
    .returns(a.ref("PriceResult").array())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(getYfinanceData)),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "userPool",
  },
});
