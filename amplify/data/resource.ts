//amplify/backend/data/schema.ts
import { type ClientSchema, a, defineData } from "@aws-amplify/backend";
import { getYfinanceData } from '../functions/getYfinanceData/resource.js';
import { getHistoricalData } from '../functions/getHistoricalData/resource.js';

// Define Enums first
const stockTypeEnum = a.enum(['Stock', 'ETF', 'Crypto']); // Changed order to match default in form example
const regionEnum = a.enum(['APAC', 'EU', 'Intl', 'US']); // Intl = International, EU = Europe, APAC = Asia-Pacific
const stockTrendEnum = a.enum(['Down', 'Up', 'Sideways']); // Stock trend direction

const txnActionEnum = a.enum(['Buy', 'Sell', 'Div', 'SLP', 'StockSplit']); // Div = Dividend, SLP = Stock Lending Payment, StockSplit = Corporate Stock Split
const txnSignalEnum = a.enum(['_5DD', 'Cust', 'Initial', 'EOM', 'LBD', 'TPH', 'TPP', 'TP', 'Div']);

const walletTypeEnum = a.enum(['Swing', 'Hold']);

/* Define the schema */
const schema = a.schema({
  StockType: stockTypeEnum,
  Region: regionEnum,
  StockTrend: stockTrendEnum,
  TxnAction: txnActionEnum,
  TxnSignal: txnSignalEnum,
  WalletType: walletTypeEnum,

  // Define the model for storing portfolio stocks
  PortfolioStock: a
    .model({
      symbol: a.string().required(), // Stock symbol, required
      stockType: a.ref('StockType').required(), // Reference the StockType enum, required
      region: a.ref('Region').required(),   // Reference the Region enum, required
      stockTrend: a.ref('StockTrend'), // Reference the StockTrend enum, optional
      name: a.string(), // Stock name, optional
      pdp: a.float(),   // Price Drop Percent
      plr: a.float(),   // Profit Loss Ratio
      budget: a.float(), // Annual budget, optional number
      testPrice: a.float(), // Test/override price for experimental purposes, optional
      isHidden: a.boolean().default(false), // Hide the stock from the reporting table
      archived: a.boolean().default(false), // Soft delete flag for archived stocks
      archivedAt: a.datetime(), // Timestamp when the stock was archived
      swingHoldRatio: a.float(),
      stockCommission: a.float(), // Commission for stock trades, optional
      htp: a.float().default(0), // Hold Take Profit percentage, required, default 0
      splitAdjustmentFactor: a.float().default(1.0), // Cumulative split adjustment factor
      transactions: a.hasMany('Transaction', 'portfolioStockId'),
      stockWallets: a.hasMany('StockWallet', 'portfolioStockId'),
      // Add owner field if not implicitly added by .authorization
      owner: a.string()
    })
    // Add owner-based authorization: grants full access ONLY to the record's owner
    .authorization((allow) => [
      allow.owner(), // Keep owner auth for the app
      allow.publicApiKey().to(['create', 'read', 'delete', 'update']) // Allow API Key access needed by helpers
      // Add 'update' if your helpers might update
    ]),

  Transaction: a
    .model({
      date: a.date().required(),           // Transaction date (YYYY-MM-DD)
      action: a.ref('TxnAction').required(), // Reference the TxnAction enum
      signal: a.ref('TxnSignal'),           // Reference the TxnSignal enum
      price: a.float(),                     // Price
      investment: a.float(),                // Investment amount
      quantity: a.float(),       // Shares bought or sold
      amount: a.float(),         // Amount for Dividend/SLP transactions
      splitRatio: a.float(),     // For StockSplit: ratio like 6.0 for 6:1 split
      preSplitPrice: a.float(),  // Price before the split (for reference)
      postSplitPrice: a.float(), // Price after the split (for reference)
      swingShares: a.float(),       // <<< RENAMED from playShares
      holdShares: a.float(),        // Existing field is fine
      txnType: a.string(),          // <<< ADDED: "Swing", "Hold", "Split", or null
      archived: a.boolean().default(false), // Soft delete flag for archived transactions
      archivedAt: a.datetime(), // Timestamp when the transaction was archived
      lbd: a.float(),             // Last Buy Dip ($). Calculated target price for a new Buy Signal. LBD = Buy Price - (Buy Price * PDP)
      tp: a.float(),              // Take Profit ($). Calculated target price, at which we get a Sell signal. TP = Buy Price + (Buy Price * PDP * PLR)
      completedTxnId: a.string(), // Link to another Txn ID (for Sell closing a Buy?)
      txnProfit: a.float(),
      txnProfitPercent: a.float(),
      portfolioStockId: a.id().required(), // Foreign key ID
      portfolioStock: a.belongsTo('PortfolioStock', 'portfolioStockId'), // Define the relationship
      // Add owner field if not implicitly added by .authorization
      owner: a.string()
    })
    .authorization((allow) => [
      allow.owner(), // Keep owner auth for the app
      allow.publicApiKey().to(['create', 'read', 'delete', 'update']) // Allow API Key access needed by helpers
      // Add 'update' if your helpers might update
    ]),

  PortfolioGoals: a
    .model({
      totalBudget: a.float(),       // Annual total budget (optional float)
      usBudgetPercent: a.float(),   // Annual US budget % (optional float)
      intBudgetPercent: a.float(),  // Annual Int budget % (optional float)
      usStocksTarget: a.integer(),  // # of US stocks target (optional integer)
      usEtfsTarget: a.integer(),    // # of US ETFs target (optional integer)
      intStocksTarget: a.integer(), // # of Int stocks target (optional integer)
      intEtfsTarget: a.integer(),   // # of Int ETFs target (optional integer)
    })
    .authorization((allow) => [
      allow.owner(), // Keep owner auth for the app
      allow.publicApiKey().to(['create', 'read', 'delete', 'update']) // Allow API Key access needed by helpers
      // Add 'update' if your helpers might update
    ]),

  StockWallet: a
  .model(
    {
      // Link back to the parent stock
      portfolioStockId: a.id().required(),
      walletType: a.ref('WalletType').required(),
      portfolioStock: a.belongsTo('PortfolioStock', ['portfolioStockId']),
      buyPrice: a.float().required(), // The unique buy price for this wallet
      totalSharesQty: a.float().required(), // Total shares EVER bought at this price
      totalInvestment: a.float().required(), // Total investment EVER for this wallet (at this price)
      sharesSold: a.float().required().default(0), // Shares sold specifically from this wallet
      remainingShares: a.float(), // totalSharesQty - sharesSold (Must be updated on Buy/Sell)
      archived: a.boolean().default(false), // Soft delete flag for archived wallets
      archivedAt: a.datetime(), // Timestamp when the wallet was archived
      realizedPl: a.float().default(0), // Accumulated P/L $ from sales FROM this wallet
      tpValue: a.float(), // Calculated TP Price ($) based on buyPrice
      tpPercent: a.float(), // Calculated TP Percent (%) based on buyPrice
      realizedPlPercent: a.float(),
      sellTxnCount: a.integer().required().default(0),
      // Add owner field if not implicitly added by .authorization
      owner: a.string(),
    })
    .authorization((allow) => [
      allow.owner(), // Keep owner auth for the app
      allow.publicApiKey().to(['create', 'read', 'delete', 'update']) // Allow API Key access needed by helpers
      // Add 'update' if your helpers might update
    ]),

  // Define the custom query to get latest prices
  // --- Query definition (returns() already uses PriceResult) ---
  getLatestPrices: a.query()
    .arguments({ symbols: a.string().array().required() })
    .returns(a.ref('PriceResult').array()) // This correctly points to the updated PriceResult
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(getYfinanceData)), // Handler import assumed correct now

  // Define the custom query to get historical data
  getHistoricalData: a.query()
    .arguments({ 
      symbols: a.string().array().required(),
      startDate: a.string().required(),
      endDate: a.string().required()
    })
    .returns(a.ref('PriceResult').array())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(getHistoricalData)),

    // --- Define Type for Historical Close ---
  HistoricalCloseInput: a.customType({ // Renamed slightly to avoid conflict if needed
    date: a.string().required(), // Use string for YYYY-MM-DD format
    close: a.float().required()
  }),

  // --- Update PriceResult Type ---
  PriceResult: a.customType({
    symbol: a.string().required(),
    currentPrice: a.float(), // Was 'price' before
    historicalCloses: a.ref('HistoricalCloseInput').array().required() // Add history field
  }),
});

// Export the schema type for use in client-side code generation
export type Schema = ClientSchema<typeof schema>;

// Define the data resource for your backend
// --- ADD TYPE ANNOTATION ---
export const data = defineData({ // <<< Add : DataResources<Schema>
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
    apiKeyAuthorizationMode: {
      description: 'API Key for E2E test helpers', // Optional description
      expiresInDays: 365 // Or 7, or up to 365
    },
  },
});
// --- END TYPE ANNOTATION ---