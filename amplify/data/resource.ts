import { type ClientSchema, a, defineData } from "@aws-amplify/backend";
import { getYfinanceData } from '../functions/getYfinanceData/resource.js';
import { sendStockEmail } from '../functions/sendStockEmail/resource.js';

// Define Enums first
const stockTypeEnum = a.enum(['Stock', 'ETF', 'Crypto']); // Changed order to match default in form example
const regionEnum = a.enum(['APAC', 'EU', 'Intl', 'US']); // Intl = International, EU = Europe, APAC = Asia-Pacific

const txnActionEnum = a.enum(['Buy', 'Sell', 'Div']); // Div = Dividend
const txnSignalEnum = a.enum(['_5DD', 'Cust', 'Initial', 'EOM', 'LBD', 'TPH', 'TPP', 'TP', 'Div']);

const walletTypeEnum = a.enum(['Swing', 'Hold']);

/* Define the schema */
const schema = a.schema({
  StockType: stockTypeEnum,
  Region: regionEnum,
  TxnAction: txnActionEnum,
  TxnSignal: txnSignalEnum,
  WalletType: walletTypeEnum,

  // Define the model for storing portfolio stocks
  PortfolioStock: a
    .model({
      symbol: a.string().required(), // Stock symbol, required
      stockType: a.ref('StockType').required(), // Reference the StockType enum, required
      region: a.ref('Region').required(),   // Reference the Region enum, required
      name: a.string(), // Stock name, optional
      pdp: a.float(),   // Price Drop Percent
      plr: a.float(),   // Profit Loss Ratio
      budget: a.float(), // Annual budget, optional number
      isHidden: a.boolean().default(false), // Hide the stock from the reporting table
      swingHoldRatio: a.float(),
      transactions: a.hasMany('Transaction', 'portfolioStockId'),
      stockWallets: a.hasMany('StockWallet', 'portfolioStockId'),
      // Add owner field if not implicitly added by .authorization
      owner: a.string()
    })
    // Add owner-based authorization: grants full access ONLY to the record's owner
    .authorization((allow) => [allow.owner()]),

  Transaction: a
    .model({
      date: a.date().required(),           // Transaction date (YYYY-MM-DD)
      action: a.ref('TxnAction').required(), // Reference the TxnAction enum
      signal: a.ref('TxnSignal'),           // Reference the TxnSignal enum
      price: a.float(),                     // Price
      investment: a.float(),                // Investment amount
      quantity: a.float(),       // Shares bought or sold
      swingShares: a.float(),       // <<< RENAMED from playShares
      holdShares: a.float(),        // Existing field is fine
      txnType: a.string(),          // <<< ADDED: "Swing", "Hold", "Split", or null
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
    .authorization((allow) => [allow.owner()]),

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
    .authorization((allow) => [allow.owner()]),

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
      realizedPl: a.float().default(0), // Accumulated P/L $ from sales FROM this wallet
      tpValue: a.float(), // Calculated TP Price ($) based on buyPrice
      tpPercent: a.float(), // Calculated TP Percent (%) based on buyPrice
      realizedPlPercent: a.float(),
      sellTxnCount: a.integer().required().default(0),
      // Add owner field if not implicitly added by .authorization
      owner: a.string(),
    })
  .authorization((allow) => [allow.owner()]),

  // Define the input type for a single portfolio item
  PortfolioItemInput: a.customType({
    symbol: a.string().required(),
    price: a.float(),     // Corresponds to number | null
    name: a.string()      // Optional name
  }),
  
  // Define the custom query to get latest prices
  // --- Query definition (returns() already uses PriceResult) ---
  getLatestPrices: a.query()
    .arguments({ symbols: a.string().array().required() })
    .returns(a.ref('PriceResult').array()) // This correctly points to the updated PriceResult
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(getYfinanceData)), // Handler import assumed correct now

  // Define the custom mutation to trigger sending the email
  sendPortfolioNotification: a.mutation()
    // Expect an array of PortfolioItemInput objects
    .arguments({ portfolioSummary: a.ref('PortfolioItemInput').array().required() })
    .returns(a.boolean())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(sendStockEmail)), // Lambda handler stays the same

    // --- Define Type for Historical Close ---
  HistoricalCloseInput: a.customType({ // Renamed slightly to avoid conflict if needed
    date: a.date().required(), // Changed to date type
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
    // apiKeyAuthorizationMode: { expiresInDays: 30 },
  },
});
// --- END TYPE ANNOTATION ---