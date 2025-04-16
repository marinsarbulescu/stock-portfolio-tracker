import { type ClientSchema, a, defineData } from "@aws-amplify/backend";
import { getYfinanceData } from '../functions/getYfinanceData/resource';
import { sendStockEmail } from '../functions/sendStockEmail/resource';

// Define Enums first
const stockTypeEnum = a.enum(['Stock', 'ETF', 'Crypto']); // Changed order to match default in form example
const regionEnum = a.enum(['US', 'EU', 'APAC']);

const txnActionEnum = a.enum(['Buy', 'Sell', 'Div']); // Div = Dividend
const txnSignalEnum = a.enum([
  '_5DD', 'Cust', 'Initial', 'EOM', 'LBD', // For Buy action
  'TPH', 'TPP',                             // For Sell action
  'Div'                                     // For Div action
]);

const sharesTypeEnum = a.enum(['Play', 'Hold']);

/* Define the schema */
const schema = a.schema({
  StockType: stockTypeEnum,
  Region: regionEnum,
  TxnAction: txnActionEnum,
  TxnSignal: txnSignalEnum,
  SharesType: sharesTypeEnum,

  // Define the model for storing portfolio stocks
  PortfolioStock: a
    .model({
      symbol: a.string().required(), // Stock symbol, required
      stockType: a.ref('StockType').required(), // Reference the StockType enum, required
      region: a.ref('Region').required(),   // Reference the Region enum, required
      name: a.string(), // Stock name, optional
      pdp: a.float(),   // Price Dip Percent, optional number
      plr: a.float(),   // Profit Loss Ratio, optional number
      budget: a.float(), // Annual budget, optional number
      isHidden: a.boolean().default(false), // Hide the stock from the reporting table
      transactions: a.hasMany('Transaction', 'portfolioStockId')
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
      playShares: a.float(),      // Play Shares. The number of shares that we will have available to sell at TP. (quantity / 2)
      holdShares: a.float(),      // Hold Shares. The number of shares that we will hold on. (quantity / 2)
      sharesType: a.ref('SharesType'),
      lbd: a.float(),             // Last Buy Dip ($). Calculated target price for a new Buy Signal. LBD = Buy Price - (Buy Price * PDP)
      tp: a.float(),              // Take Profit ($). Calculated target price, at which we get a Sell signal. TP = Buy Price + (Buy Price * PDP * PLR)
      completedTxnId: a.string(), // Link to another Txn ID (for Sell closing a Buy?)
      txnProfit: a.float(),
      portfolioStockId: a.id().required(), // Foreign key ID
      portfolioStock: a.belongsTo('PortfolioStock', 'portfolioStockId'), // Define the relationship
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
export const data = defineData({
  schema,
  // Configure authorization modes
  authorizationModes: {
    // Use Cognito User Pools as the default mechanism for authorizing API calls
    defaultAuthorizationMode: 'userPool',
    // You could add an API key for public read access if needed later
    // apiKeyAuthorizationMode: { expiresInDays: 30 },
  },
});