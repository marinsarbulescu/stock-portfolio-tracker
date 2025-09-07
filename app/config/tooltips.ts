// app/config/tooltips.ts

/**
 * Tooltip text definitions for the application
 * This file centralizes all tooltip content for easy maintenance
 */

export const WALLETS_OVERVIEW_TOOLTIPS = {
  TOTAL_OOP: "Total Out-of-Pocket: the sum of all Buy investments.",
  CASH_BALANCE: "Cash Balance: the sum of all Sell proceeds plus dividends and SLP income.",
  MARKET_VALUE: "Market Value: current value of all remaining shares (total shares × current price).",
  ROIC: "Return on Initial Capital: percentage return on original cash invested, calculated as (Cash Balance + Market Value - Total OOP) / Total OOP * 100.",
  RISK_BUDGET: "Max Risk Budget: the total budget allocated for this stock investment, for the current year.",
  BUDGET_USED: "Budget Used: net cash investment (Total OOP - Cash Balance). The actual money at risk.",
  BUDGET_AVAILABLE: "Budget Available: remaining budget that can be used for new investments (Risk Budget - Budget Used).",
  TIED_UP: "Tied-Up: the investment amount tied up in currently held shares.",
  R_INV: "Risk Investment (r-Inv): the investment amount in wallets where the Target Price (TP) has not yet been met (current price < TP).",
  PDP: "Price Drop Percentage: percentage below buy price at which to buy again.",
  SHR: "Swing Hold Ratio: percentage of shares to allocate to Swing strategy vs Hold strategy for new purchases.",
  STP: "Swing Take Profit: percentage above buy price at which to sell Swing shares for profit taking.",
  HTP: "Hold Take Profit: percentage above buy price at which to sell Hold shares for long-term profit taking."
} as const;

// Add other tooltip categories as needed
export const SIGNALS_OVERVIEW_TOOLTIPS = {
  RISK_BUDGET: "Max Risk Budget: the total budget allocated for portfolio investments for the current year.",
  BUDGET_USED: "Budget Used: net cash investment across all stocks (Total OOP - Cash Balance). The actual money at risk.",
  BUDGET_AVAILABLE: "Budget Available: remaining budget that can be used for new investments (Risk Budget - Budget Used).",
  TIED_UP: "Tied-Up: the investment amount tied up in currently held shares across all stocks.",
  R_INV: "Risk Investment (r-Inv): the investment amount in wallets where the Target Price (TP) has not yet been met (current price < TP).",
  TOTAL_OOP: "Total Out-of-Pocket: the sum of all Buy investments across all stocks.",
  CASH_BALANCE: "Cash Balance: the sum of all Sell proceeds plus dividends and SLP income across all stocks.",
  MARKET_VALUE: "Market Value: current value of all remaining shares across all stocks (total shares × current price).",
  ROIC: "Return on Initial Capital: percentage return on original cash invested, calculated as (Cash Balance + Market Value - Total OOP) / Total OOP * 100."
} as const;

export const PORTFOLIO_TABLE_TOOLTIPS = {
  // Future tooltips for portfolio table
} as const;
