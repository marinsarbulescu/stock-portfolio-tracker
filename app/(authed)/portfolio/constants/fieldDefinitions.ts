// Field definitions for portfolio forms - centralized labels, placeholders, and help text

export interface FieldDefinition {
  label: string;
  placeholder?: string;
  helpText?: string;
  required?: boolean;
}

export interface SelectFieldDefinition extends FieldDefinition {
  defaultOption?: string;
  options: { value: string; label: string }[];
}

// Basic Information Fields
export const STOCK_FIELDS = {
  symbol: {
    label: 'Ticker Symbol',
    placeholder: 'e.g., AAPL',
    helpText: undefined,
    required: true,
  } as FieldDefinition,

  name: {
    label: 'Company Name',
    placeholder: 'e.g., Apple Inc.',
    helpText: undefined,
    required: false,
  } as FieldDefinition,

  stockType: {
    label: 'Security Type',
    defaultOption: '-- Select Security Type --',
    helpText: undefined,
    required: true,
    options: [
      { value: 'Stock', label: 'Stock' },
      { value: 'ETF', label: 'ETF' },
      { value: 'Index', label: 'Index' },
      { value: 'Crypto', label: 'Crypto' },
      { value: 'Commodity', label: 'Commodity' },
    ],
  } as SelectFieldDefinition,

  region: {
    label: 'Region',
    defaultOption: '-- Select Region --',
    helpText: undefined,
    required: true,
    options: [
      { value: 'US', label: 'US' },
      { value: 'APAC', label: 'APAC' },
      { value: 'EU', label: 'EU' },
      { value: 'Intl', label: 'Intl' },
    ],
  } as SelectFieldDefinition,

  marketCategory: {
    label: 'Market Sector',
    defaultOption: '-- Select Market Sector --',
    helpText: undefined,
    required: true,
    options: [
      { value: 'APAC_Index', label: 'APAC Index' },
      { value: 'China_Index', label: 'China Index' },
      { value: 'Crypto', label: 'Crypto' },
      { value: 'Emerging_Index', label: 'Emerging Index' },
      { value: 'Europe_Index', label: 'Europe Index' },
      { value: 'International_Index', label: 'International Index' },
      { value: 'Metals', label: 'Metals' },
      { value: 'Oil', label: 'Oil' },
      { value: 'Opportunity', label: 'Opportunity' },
      { value: 'US_Index', label: 'US Index' },
    ],
  } as SelectFieldDefinition,

  riskGrowthProfile: {
    label: 'Risk Profile',
    defaultOption: '-- Select Risk Profile --',
    helpText: undefined,
    required: true,
    options: [
      { value: 'Hare', label: 'Hare (Aggressive)' },
      { value: 'Tortoise', label: 'Tortoise (Conservative)' },
    ],
  } as SelectFieldDefinition,
} as const;

// Market Data Fields
export const DATA_FIELDS = {
  testPrice: {
    label: 'Test Price',
    placeholder: 'e.g., 150.25',
    helpText: 'Overrides live market data, used only for testing purposes.',
    required: false,
  } as FieldDefinition,

  budget: {
    label: 'Maximum Risk',
    placeholder: 'e.g., 1000',
    helpText: 'The maximum amount you\'re willing to risk on this position for the current year.',
    required: false,
  } as FieldDefinition,

  stockTrend: {
    label: 'Trend',
    defaultOption: '-- Select Trend --',
    helpText: 'Optional directional bias for position management.',
    required: false,
    options: [
      { value: 'Up', label: 'Up' },
      { value: 'Down', label: 'Down' },
      { value: 'Sideways', label: 'Sideways' },
    ],
  } as SelectFieldDefinition,

  stockCommission: {
    label: 'Commission',
    placeholder: 'e.g., 0.50',
    helpText: 'Transaction or annual fees that impact profit target calculations.',
    required: false,
  } as FieldDefinition,
} as const;

// Strategy Fields
export const STRATEGY_FIELDS = {
  swingHoldRatio: {
    label: 'Swing-Hold Ratio (SHR)',
    placeholder: '0-100 (e.g., 50 = 50% Swing)',
    helpText: '% of shares allocated to Swing vs Hold wallets when using Split transactions. Example: 70 means 70% swing, 30% hold.',
    required: true,
  } as FieldDefinition,

  pdp: {
    label: 'Price Drop Percentage (PDP)',
    placeholder: 'e.g., 5 = 5%',
    helpText: '% drop at which to trigger a sell signal.',
    required: true,
  } as FieldDefinition,

  stp: {
    label: 'Swing Take Profit (STP) %',
    placeholder: 'e.g., 10 for 10% profit target',
    helpText: '% at which to take profit on swing trades.',
    required: true,
  } as FieldDefinition,

  htp: {
    label: 'Hold Take Profit (HTP) %',
    placeholder: 'e.g., 25 for 25% profit target',
    helpText: '% at which to take profit on hold trades.',
    required: false,
  } as FieldDefinition,
} as const;

// Form structure for UI organization
export const FORM_STRUCTURE = {
  basics: {
    title: 'Basics',
    fields: ['symbol', 'name', 'stockType', 'region', 'marketCategory', 'riskGrowthProfile'],
  },
  data: {
    title: 'Data',
    fields: ['testPrice', 'budget', 'stockTrend', 'stockCommission'],
  },
  strategy: {
    title: 'Strategy',
    fields: ['swingHoldRatio', 'pdp', 'stp', 'htp'],
  },
} as const;

// All fields combined for easy access
export const ALL_FIELDS = {
  ...STOCK_FIELDS,
  ...DATA_FIELDS,
  ...STRATEGY_FIELDS,
} as const;