// Example: app/config/constants.ts

// Display/Calculation Precision
export const SHARE_PRECISION: number = 5;
export const CURRENCY_PRECISION: number = 2;
export const PERCENT_PRECISION: number = 2; // Choose a consistent value (e.g., 2 for display)

// Epsilon values for zero-checking (derived from precision)
// Using slightly more precision for epsilon check than the value itself
export const SHARE_EPSILON: number = 1 / (10**(SHARE_PRECISION + 2)); // e.g., 0.0000001
export const CURRENCY_EPSILON: number = 1 / (10**(CURRENCY_PRECISION + 2)); // e.g., 0.0001
export const PERCENT_EPSILON: number = 1 / (10**(PERCENT_PRECISION + 2)); // e.g., 0.0001

// DynamoDB Query Limits
// Note: These limits affect how many records DynamoDB scans before filtering,
// not just how many records are returned. Higher limits needed when filtering
// for specific transaction types (e.g., finding last buy when recent records are sells)

export const FETCH_LIMIT_FOR_UNIQUE_WALLET = 5000;
export const FETCH_LIMIT_TRANSACTIONS_PAGINATED = 5000; // For large transaction fetches with pagination
export const FETCH_LIMIT_TRANSACTIONS_STANDARD = 5000; // For standard transaction queries
export const FETCH_LIMIT_STOCKS_STANDARD = 5000; // For portfolio stock queries
export const FETCH_LIMIT_WALLETS_GENEROUS = 5000; // For wallet queries that need generous limits
export const FETCH_LIMIT_WALLETS_CANDIDATES = 5000; // For wallet candidate searches
export const FETCH_LIMIT_SMALL_QUERIES = 5000; // For smaller, targeted queries