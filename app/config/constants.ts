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

export const FETCH_LIMIT_FOR_UNIQUE_WALLET = 1000;