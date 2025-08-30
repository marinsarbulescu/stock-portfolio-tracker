/**
 * Centralized field definitions and tooltips for consistent explanations across the application
 * These definitions are used in forms, tooltips, and documentation throughout the app
 */

export interface FieldDefinition {
  label: string;
  tooltip: string;
  placeholder?: string;
  required?: boolean;
}

export const FIELD_DEFINITIONS = {
  // Stock Settings Fields
  PDP: {
    label: 'Price Drop Percentage (PDP)',
    tooltip: 'Percentage price drop threshold to trigger buy signal opportunity',
    placeholder: 'e.g., 10 = 10%',
    required: true,
  } as FieldDefinition,

  STP: {
    label: 'Swing Take Profit (STP)',
    tooltip: 'Target price gain percentage to trigger sell signal for swing positions',
    placeholder: 'e.g., 1.5 = 150%',
    required: true,
  } as FieldDefinition,

  SHR: {
    label: 'Swing-Hold Ratio (SHR)',
    tooltip: 'Portfolio allocation split between swing trading and buy-and-hold strategies',
    placeholder: '0-100 (e.g., 70 = 70% Swing & 30% Hold)',
    required: true,
  } as FieldDefinition,

  HTP: {
    label: 'Hold Take Profit (HTP)',
    tooltip: 'Target price gain percentage to trigger sell signal for hold positions',
    placeholder: 'e.g., 10 for 10% Hold Take Profit',
    required: false,
  } as FieldDefinition,

  // Basic Stock Information
  SYMBOL: {
    label: 'Symbol',
    tooltip: 'Stock ticker symbol (e.g., AAPL, MSFT, GOOGL)',
    placeholder: 'e.g., AAPL',
    required: true,
  } as FieldDefinition,

  NAME: {
    label: 'Name',
    tooltip: 'Optional company name (e.g., Apple Inc., Microsoft Corp)',
    placeholder: 'e.g., Apple Inc.',
    required: false,
  } as FieldDefinition,

  REGION: {
    label: 'Region',
    tooltip: 'Geographic region where the stock is primarily traded',
    required: true,
  } as FieldDefinition,

  MARKET_CATEGORY: {
    label: 'Market Category',
    tooltip: 'Asset class category for portfolio diversification tracking',
    required: true,
  } as FieldDefinition,

  SECURITY_TYPE: {
    label: 'Security Type',
    tooltip: 'Type of security (individual stock, ETF, or cryptocurrency)',
    required: true,
  } as FieldDefinition,

  RISK_GROWTH_PROFILE: {
    label: 'Risk/Growth Profile',
    tooltip: 'Risk and growth characteristics of the investment',
    required: true,
  } as FieldDefinition,

  // Optional Fields
  TEST_PRICE: {
    label: 'Test Price',
    tooltip: 'If set, this price will be used instead of live market data',
    placeholder: 'e.g., 150.25 - overrides live price fetching',
    required: false,
  } as FieldDefinition,

  BUDGET: {
    label: 'Annual Budget',
    tooltip: 'Annual investment budget allocated for this position (optional)',
    placeholder: 'e.g., 1500 or best guess if unknown',
    required: false,
  } as FieldDefinition,

  TREND: {
    label: 'Trend',
    tooltip: 'Current market trend assessment for the security',
    required: false,
  } as FieldDefinition,
} as const;

// Helper function to get field definition
export function getFieldDefinition(fieldKey: keyof typeof FIELD_DEFINITIONS): FieldDefinition {
  return FIELD_DEFINITIONS[fieldKey];
}

// Helper function to get just the tooltip text
export function getFieldTooltip(fieldKey: keyof typeof FIELD_DEFINITIONS): string {
  return FIELD_DEFINITIONS[fieldKey].tooltip;
}

// Helper function to get the full label
export function getFieldLabel(fieldKey: keyof typeof FIELD_DEFINITIONS): string {
  return FIELD_DEFINITIONS[fieldKey].label;
}
