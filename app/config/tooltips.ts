// app/config/tooltips.ts

/**
 * Tooltip text definitions for the application
 * This file centralizes all tooltip content for easy maintenance
 */

export const WALLETS_OVERVIEW_TOOLTIPS = {
  TOTAL_OOP: "Out-of-Pocket: actual cash you've invested into a stock from your own pocket - money that came \"out of pocket\" rather than being funded from previous sale proceeds or dividends",
  CASH_BALANCE: "Cash Balance: available cash for reinvestment, without needing additional out-of-pocket funds. Increases from sells, dividends, and SLP. Decreases when used to fund new buys.",
  MARKET_VALUE: "Market Value: current value of all remaining shares (total shares × current price).",
  ROIC: "Return on Initial Capital: percentage return on original cash invested, calculated as (Cash Balance + Market Value - OOP) / OOP * 100.",
  RISK_BUDGET: "Max OOP: the max out-of-pocket allocated for this stock, for the current year.",
  BUDGET_USED: "Budget Used: net cash investment (Total OOP - Cash Balance). The actual money at risk.",
  BUDGET_AVAILABLE: "Budget Available: total amount available for new investments. Combines remaining OOP budget (Max OOP - OOP) plus Cash Balance.",
  TIED_UP: "Tied-Up: the investment amount tied up in currently held shares.",
  R_INV: "Risk Investment (r-Inv): the investment amount in wallets where the Target Price (TP) has not yet been met (current price < TP).",
  PDP: "Price Drop Percentage: percentage below buy price at which to buy again.",
  SHR: "Swing Hold Ratio: percentage of shares to allocate to Swing strategy vs Hold strategy for new purchases.",
  STP: "Swing Take Profit: percentage above buy price at which to sell Swing shares for profit taking.",
  HTP: "Hold Take Profit: percentage above buy price at which to sell Hold shares for long-term profit taking."
} as const;

// Add other tooltip categories as needed
export const SIGNALS_OVERVIEW_TOOLTIPS = {
  RISK_BUDGET: "Max OOP: the max out-of-pocket allocated for portfolio investments, for the current year.",
  BUDGET_USED: "Budget Used: net cash investment across all stocks (Total OOP - Cash Balance). The actual money at risk.",
  BUDGET_AVAILABLE: "Budget Available: total amount available for new investments. Combines remaining OOP budget (Max OOP - OOP) plus Cash Balance.",
  TIED_UP: "Tied-Up: the investment amount tied up in currently held shares across all stocks.",
  R_INV: "Risk Investment (r-Inv): the investment amount in wallets where the Target Price (TP) has not yet been met (current price < TP).",
  TOTAL_OOP: "Out-of-Pocket: actual cash you've invested into a stock from your own pocket - money that came \"out of pocket\" rather than being funded from previous sale proceeds or dividends across all stocks.",
  CASH_BALANCE: "Cash Balance: available cash for reinvestment, without needing additional out-of-pocket funds. Increases from sells, dividends, and SLP. Decreases when used to fund new buys. Aggregated across all stocks.",
  MARKET_VALUE: "Market Value: current value of all remaining shares across all stocks (total shares × current price).",
  ROIC: "Return on Initial Capital: percentage return on original cash invested, calculated as (Cash Balance + Market Value - OOP) / OOP * 100."
} as const;

export const PORTFOLIO_TABLE_TOOLTIPS = {
  // Future tooltips for portfolio table
} as const;
