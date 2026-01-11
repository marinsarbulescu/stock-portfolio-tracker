// e2e/utils/jsonHelper.ts
import * as fs from "fs";
import * as path from "path";

export interface AssetCreateInput {
  symbol: string;
  name: string;
  type: "STOCK" | "ETF" | "CRYPTO";
  testPrice: string;
  buyFee?: string;
  sellFee: string;
  status: "ACTIVE" | "HIDDEN" | "ARCHIVED";
}

export interface AssetCreateExpected {
  symbol: string;
  name: string;
  type: string;
  buyFee?: string;
  sellFee: string;
  status: string;
}

export interface AssetCreateTestConfig {
  scenario: string;
  description: string;
  input: AssetCreateInput;
  expected: AssetCreateExpected;
}

// New CRUD config with action-based structure
export interface AssetAction {
  input: AssetCreateInput;
  expected: AssetCreateExpected;
}

export interface AssetCrudTestConfig {
  scenario: string;
  description: string;
  create: AssetAction;
  edit: AssetAction;
}

// Target types for ET/PT testing
export interface TargetInput {
  name: string;
  targetPercent: string;
  sortOrder: string;
  allocationPercent?: string; // Only for profit targets
}

export interface TargetExpected {
  name: string;
  targetPercent: string;
  sortOrder: string;
  allocationPercent?: string; // Only for profit targets
}

export interface TargetAction {
  input: TargetInput;
  expected: TargetExpected;
}

export interface TargetEditAction extends TargetAction {
  targetSortOrder: string; // Which target to edit (by sortOrder)
}

// ============================================================================
// BUY Transaction CRUD Types
// ============================================================================

export interface TransactionAllocationInput {
  ptPercent: string;
  percentage: string;
}

export interface TransactionInput {
  signal: string;
  price: string;
  investment: string;
  allocations: TransactionAllocationInput[];
  date?: string;  // Optional datetime for postdating (e.g., "2026-01-15T09:00:00")
}

export interface TransactionExpected {
  type: string;
  signal: string;
  price: string;
  quantity: string;
  investment: string;
  entryTarget: string;
  profitLoss: string;
  profitLossPercent: string;
}

export interface WalletExpected {
  ptPercent: string;
  price: string;
  shares: string;
  investment: string;
  pt?: string;  // Optional - profit target price
  pct2pt?: string;  // Optional - percent to profit target
  pct2ptHighlight?: "green" | "yellow" | "none";  // Optional highlight verification
}

export interface OverviewExpected {
  totalShares: string;
  ptShares: { ptPercent: string; shares: string }[];
}

// Target to identify a transaction for editing (presence indicates edit operation)
export interface EditTransactionTarget {
  signal: string;  // Display signal (e.g., "Initial")
  price: string;   // Formatted price (e.g., "$100.00")
  investment: string; // Formatted investment (e.g., "$200.00")
}

// Unified transaction action - presence of `target` indicates edit/delete operation
export interface BuyTransactionAction {
  testPriceUpdate?: string;
  target?: EditTransactionTarget; // If present, this is an edit or delete operation
  delete?: boolean;               // If true (with target), this is a delete operation
  input?: TransactionInput;       // Optional for delete (not needed)
  expected: {
    transaction?: TransactionExpected;           // The new/edited transaction (not for delete)
    transactionNotPresent?: EditTransactionTarget; // Verify deleted transaction
    priorTransactions?: TransactionExpected[];
    wallets: WalletExpected[];
    walletsNotPresent?: { ptPercent: string; price: string }[];
    overview: OverviewExpected;
  };
}

export interface AssetBuyCrudTestConfig {
  scenario: string;
  description: string;
  asset: {
    input: AssetCreateInput;
  };
  entryTargets: { input: TargetInput }[];
  profitTargets: { input: TargetInput }[];
  transactions: {
    [key: string]: BuyTransactionAction;
  };
}

// ============================================================================
// SELL Transaction CRUD Types
// ============================================================================

export interface SellTransactionInput {
  ptPercent: string;    // Which PT tab to sell from
  walletPrice: string;  // Which wallet (by price) to sell from
  signal: string;
  price: string;
  quantity: string;
  date?: string;  // Optional datetime for postdating (e.g., "2026-01-15T09:00:00")
}

export interface SellTransactionExpected {
  type: string;         // "Sell"
  signal: string;
  price: string;
  quantity: string;
  amount: string;       // SELL specific (proceeds after sell fee)
  profitLoss: string;
  profitLossPercent: string;
}

// Target to identify a SELL transaction for editing/deleting
export interface EditSellTransactionTarget {
  signal: string;  // Display signal (e.g., "Profit Target")
  price: string;   // Formatted price (e.g., "$110.00")
  amount: string;  // Formatted amount (e.g., "$163.35")
}

// Wallet ID verification - verify a BUY transaction's allocation points to the correct wallet
export interface WalletIdVerification {
  // The wallet to get the ID from
  walletPtPercent: string;
  walletPrice: string;
  // The BUY transaction to verify (identified by signal, price, investment)
  buyTransaction: EditTransactionTarget;
  // The PT percent allocation to verify in the BUY transaction
  allocationPtPercent: string;
}

// Union type for transaction actions in SELL CRUD test
export type SellCrudTransactionAction = BuyTransactionAction | SellTransactionAction;

export interface SellTransactionAction {
  testPriceUpdate?: string;
  isSell: true;                          // Discriminator to identify SELL actions
  target?: EditSellTransactionTarget;    // If present, this is an edit or delete operation
  delete?: boolean;                      // If true (with target), this is a delete operation
  input?: SellTransactionInput;          // Optional for delete (not needed)
  expected: {
    transaction?: SellTransactionExpected;           // The new/edited SELL transaction
    transactionNotPresent?: EditSellTransactionTarget; // Verify deleted transaction
    priorTransactions?: (TransactionExpected | SellTransactionExpected)[];
    wallets: WalletExpected[];
    walletsNotPresent?: { ptPercent: string; price: string }[];
    overview: OverviewExpected;
    walletIdVerification?: WalletIdVerification;     // Verify wallet ID propagation
  };
}

export interface AssetSellCrudTestConfig {
  scenario: string;
  description: string;
  asset: {
    input: AssetCreateInput;
  };
  entryTargets: { input: TargetInput }[];
  profitTargets: { input: TargetInput }[];
  transactions: {
    [key: string]: SellCrudTransactionAction;
  };
}

// ============================================================================
// Dashboard Signals Test Types
// ============================================================================

export interface DashboardExpected {
  symbol: string;
  pct2pt: string;
  pct2ptHighlight: "green" | "yellow" | "none";
}

export interface DashboardSignalAction {
  testPriceUpdate?: string;
  isSell?: boolean;                    // Discriminator for SELL actions
  input?: TransactionInput;            // For BUY transaction creation
  sellInput?: SellTransactionInput;    // For SELL transaction creation
  expected: {
    transaction?: TransactionExpected;
    sellTransaction?: SellTransactionExpected;  // For SELL verification
    wallets: WalletExpected[];
    walletsNotPresent?: { ptPercent: string; price: string }[];  // Verify deleted wallets
    overview: OverviewExpected;
    dashboard: DashboardExpected;
  };
}

export interface DashboardSignalsTestConfig {
  scenario: string;
  description: string;
  asset: {
    input: AssetCreateInput;
  };
  entryTargets: { input: TargetInput }[];
  profitTargets: { input: TargetInput }[];
  actions: {
    [key: string]: DashboardSignalAction;
  };
}

export function loadAssetCrudTestData(fileName: string): AssetCrudTestConfig {
  const filePath = path.resolve(process.cwd(), fileName);
  console.log(`[jsonHelper.ts] Attempting to load CRUD JSON from: ${filePath}`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`JSON file not found: ${filePath}`);
  }

  const fileContent = fs.readFileSync(filePath, "utf-8");
  console.log(
    `[jsonHelper.ts] File content read successfully. Length: ${fileContent.length}`
  );

  try {
    const data = JSON.parse(fileContent) as AssetCrudTestConfig;
    console.log(
      `[jsonHelper.ts] Successfully parsed CRUD JSON for scenario: ${data.scenario}`
    );
    return data;
  } catch (error) {
    throw new Error(`Failed to parse JSON file ${filePath}: ${error}`);
  }
}

export function loadAssetCreateTestData(fileName: string): AssetCreateTestConfig {
  const filePath = path.resolve(process.cwd(), fileName);
  console.log(`[jsonHelper.ts] Attempting to load JSON from: ${filePath}`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`JSON file not found: ${filePath}`);
  }

  const fileContent = fs.readFileSync(filePath, "utf-8");
  console.log(
    `[jsonHelper.ts] File content read successfully. Length: ${fileContent.length}`
  );

  try {
    const data = JSON.parse(fileContent) as AssetCreateTestConfig;
    console.log(
      `[jsonHelper.ts] Successfully parsed JSON for scenario: ${data.scenario}`
    );
    return data;
  } catch (error) {
    throw new Error(`Failed to parse JSON file ${filePath}: ${error}`);
  }
}

export function loadAssetBuyCrudTestData(fileName: string): AssetBuyCrudTestConfig {
  const filePath = path.resolve(process.cwd(), fileName);
  console.log(`[jsonHelper.ts] Attempting to load Buy CRUD JSON from: ${filePath}`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`JSON file not found: ${filePath}`);
  }

  const fileContent = fs.readFileSync(filePath, "utf-8");
  console.log(
    `[jsonHelper.ts] File content read successfully. Length: ${fileContent.length}`
  );

  try {
    const data = JSON.parse(fileContent) as AssetBuyCrudTestConfig;
    console.log(
      `[jsonHelper.ts] Successfully parsed Buy CRUD JSON for scenario: ${data.scenario}`
    );
    return data;
  } catch (error) {
    throw new Error(`Failed to parse JSON file ${filePath}: ${error}`);
  }
}

export function loadAssetSellCrudTestData(fileName: string): AssetSellCrudTestConfig {
  const filePath = path.resolve(process.cwd(), fileName);
  console.log(`[jsonHelper.ts] Attempting to load Sell CRUD JSON from: ${filePath}`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`JSON file not found: ${filePath}`);
  }

  const fileContent = fs.readFileSync(filePath, "utf-8");
  console.log(
    `[jsonHelper.ts] File content read successfully. Length: ${fileContent.length}`
  );

  try {
    const data = JSON.parse(fileContent) as AssetSellCrudTestConfig;
    console.log(
      `[jsonHelper.ts] Successfully parsed Sell CRUD JSON for scenario: ${data.scenario}`
    );
    return data;
  } catch (error) {
    throw new Error(`Failed to parse JSON file ${filePath}: ${error}`);
  }
}

export function loadDashboardSignalsTestData(fileName: string): DashboardSignalsTestConfig {
  const filePath = path.resolve(process.cwd(), fileName);
  console.log(`[jsonHelper.ts] Attempting to load Dashboard Signals JSON from: ${filePath}`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`JSON file not found: ${filePath}`);
  }

  const fileContent = fs.readFileSync(filePath, "utf-8");
  console.log(
    `[jsonHelper.ts] File content read successfully. Length: ${fileContent.length}`
  );

  try {
    const data = JSON.parse(fileContent) as DashboardSignalsTestConfig;
    console.log(
      `[jsonHelper.ts] Successfully parsed Dashboard Signals JSON for scenario: ${data.scenario}`
    );
    return data;
  } catch (error) {
    throw new Error(`Failed to parse JSON file ${filePath}: ${error}`);
  }
}

// ============================================================================
// ROI Test Types
// ============================================================================

export interface FinancialOverviewExpected {
  oop: string;           // e.g., "$600.00"
  marketValue: string;   // e.g., "$600.00"
  roi: string;           // e.g., "0.00%"
  available: string;     // e.g., "$600"
}

export interface DashboardAvailableExpected {
  symbol: string;
  available: string;
  isGrayedOut?: boolean;  // If true, verify the row has gray styling (negative Available)
}

export interface DividendSlpInput {
  type: "DIVIDEND" | "SLP";
  amount: string;
  date?: string;  // Optional datetime for postdating (e.g., "2026-01-15T11:30:00")
}

export interface RoiTransactionAction {
  testPriceUpdate?: string;           // Update test price before transaction
  isSell?: boolean;                   // Discriminator for SELL transactions
  isDividendOrSlp?: boolean;          // Discriminator for DIVIDEND/SLP transactions
  input?: TransactionInput;           // BUY input
  sellInput?: SellTransactionInput;   // SELL input
  dividendSlpInput?: DividendSlpInput; // DIVIDEND/SLP input
  expected: {
    financialOverview: FinancialOverviewExpected;
    dashboard: DashboardAvailableExpected;
  };
}

export interface RoiTestConfig {
  scenario: string;
  description: string;
  asset: {
    input: AssetCreateInput;
    budget: { year: string; amount: string };
  };
  entryTargets: { input: TargetInput }[];
  profitTargets: { input: TargetInput }[];
  transactions: {
    [key: string]: RoiTransactionAction;
  };
}

export function loadRoiTestData(fileName: string): RoiTestConfig {
  const filePath = path.resolve(process.cwd(), fileName);
  console.log(`[jsonHelper.ts] Attempting to load ROI JSON from: ${filePath}`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`JSON file not found: ${filePath}`);
  }

  const fileContent = fs.readFileSync(filePath, "utf-8");
  console.log(
    `[jsonHelper.ts] File content read successfully. Length: ${fileContent.length}`
  );

  try {
    const data = JSON.parse(fileContent) as RoiTestConfig;
    console.log(
      `[jsonHelper.ts] Successfully parsed ROI JSON for scenario: ${data.scenario}`
    );
    return data;
  } catch (error) {
    throw new Error(`Failed to parse JSON file ${filePath}: ${error}`);
  }
}

// ============================================================================
// Config Changes Test Types
// ============================================================================

export interface ConfigChangeEditET {
  targetSortOrder: string;
  newTargetPercent: string;
}

export interface ConfigChangeEditPTAlloc {
  [key: string]: {
    sortOrder: string;
    newAllocationPercent: string;
  };
}

export interface ConfigChangeEditBuyFee {
  newBuyFee: string;
}

export interface ConfigChangeEditSellFee {
  newSellFee: string;
}

export interface ConfigChanges {
  editET?: ConfigChangeEditET;
  editPTAlloc?: ConfigChangeEditPTAlloc;
  editBuyFee?: ConfigChangeEditBuyFee;
  editSellFee?: ConfigChangeEditSellFee;
}

// Verification-only action (no transaction created, just verify state after config change)
export interface VerificationOnlyAction {
  isVerificationOnly: true;
  expected: {
    wallets: WalletExpected[];
  };
}

export type ConfigChangesTransactionAction = BuyTransactionAction | SellTransactionAction | VerificationOnlyAction;

export interface AssetConfigChangesTestConfig {
  scenario: string;
  description: string;
  asset: {
    input: AssetCreateInput;
  };
  entryTargets: { input: TargetInput }[];
  profitTargets: { input: TargetInput }[];
  configChanges: ConfigChanges;
  transactions: {
    [key: string]: ConfigChangesTransactionAction;
  };
}

export function loadAssetConfigChangesTestData(fileName: string): AssetConfigChangesTestConfig {
  const filePath = path.resolve(process.cwd(), fileName);
  console.log(`[jsonHelper.ts] Attempting to load Config Changes JSON from: ${filePath}`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`JSON file not found: ${filePath}`);
  }

  const fileContent = fs.readFileSync(filePath, "utf-8");
  console.log(
    `[jsonHelper.ts] File content read successfully. Length: ${fileContent.length}`
  );

  try {
    const data = JSON.parse(fileContent) as AssetConfigChangesTestConfig;
    console.log(
      `[jsonHelper.ts] Successfully parsed Config Changes JSON for scenario: ${data.scenario}`
    );
    return data;
  } catch (error) {
    throw new Error(`Failed to parse JSON file ${filePath}: ${error}`);
  }
}

// ============================================================================
// PT CRUD Test Types
// ============================================================================

export interface PTDeleteButtonsVerification {
  hidden?: string[];   // sortOrders where delete should be hidden
  visible?: string[];  // sortOrders where delete should be visible
}

export interface PTExpectedAfterDelete {
  sortOrder: string;
  name: string;
  targetPercent: string;
  allocationPercent: string;
}

export interface AllocationErrorTest {
  allocations: Record<string, string>;  // ptPercent -> allocation value
  expectedError: string;
}

export interface PTCrudCreateStep {
  buyTransaction: {
    input: TransactionInput;
    expected: {
      transaction: TransactionExpected;
      wallets: WalletExpected[];
      overview: OverviewExpected;
    };
  };
  verifyDeleteButtons: PTDeleteButtonsVerification;
}

export interface PTCrudDeleteStep {
  sellTransaction: {
    input: SellTransactionInput;
    expected: {
      transaction: SellTransactionExpected;
      wallets: WalletExpected[];
      walletsNotPresent: { ptPercent: string; price: string }[];
      overview: OverviewExpected;
    };
  };
  verifyDeleteButtonsAfterSell: PTDeleteButtonsVerification;
  targetSortOrder: string;
  expectedPTsAfterDelete: PTExpectedAfterDelete[];
  expectedWalletTabs: string[];
  allocationErrorTests: {
    lessThan100: AllocationErrorTest;
    moreThan100: AllocationErrorTest;
  };
}

export interface PTAllocationEditTest {
  targetSortOrder: string;
  newAllocationPercent: string;
  expectedError?: string;    // If present, expect error after save
  expectedWarning?: string;  // Yellow warning below PT list (for < 100%)
  noWarning?: boolean;       // If true, verify no warning is shown
}

export interface PTCrudEditAllocationStep {
  tests: PTAllocationEditTest[];
  expectedFinalAllocations: PTExpectedAfterDelete[];
}

export interface PTOrderEditTest {
  targetSortOrder: string;      // Current sortOrder of PT to edit
  newSortOrder: string;         // New sortOrder to set
  expectedError?: string;       // If present, expect error message
}

export interface PTCrudEditOrderStep {
  duplicateOrderTest: PTOrderEditTest;
  validOrderTest: PTOrderEditTest;
  expectedPTsAfterEdit: PTExpectedAfterDelete[];
  expectedWalletTabOrder: string[];  // PT percents in expected tab order
}

export interface PTCrudEditValueStep {
  targetSortOrder: string;           // sortOrder of PT to edit
  input: {
    targetPercent: string;           // New target percent value
    name: string;                    // New name for the PT
  };
  confirmationMessage: string;       // Expected browser confirm() message
  expectedPT: PTExpectedAfterDelete; // Expected PT row after edit
  expectedWalletTabs: string[];      // Expected wallet tab order after edit
  expectedWallet: {
    ptPercent: string;               // PT percent to verify (tab identifier)
    price: string;                   // Entry price of wallet
    shares: string;                  // Shares in wallet (unchanged)
    investment: string;              // Investment in wallet (unchanged)
    pt: string;                      // New PT price after recalculation
    pct2pt: string;                  // New %2PT after recalculation
  };
}

export interface AssetPTCrudTestConfig {
  scenario: string;
  description: string;
  asset: {
    input: AssetCreateInput;
  };
  entryTargets: { input: TargetInput }[];
  profitTargets: { input: TargetInput }[];
  steps: {
    createPT: PTCrudCreateStep;
    deletePT: PTCrudDeleteStep;
    editPTAllocation?: PTCrudEditAllocationStep;
    editPTOrder?: PTCrudEditOrderStep;
    editPTValue?: PTCrudEditValueStep;
  };
}

export function loadAssetPTCrudTestData(fileName: string): AssetPTCrudTestConfig {
  const filePath = path.resolve(process.cwd(), fileName);
  console.log(`[jsonHelper.ts] Attempting to load PT CRUD JSON from: ${filePath}`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`JSON file not found: ${filePath}`);
  }

  const fileContent = fs.readFileSync(filePath, "utf-8");
  console.log(
    `[jsonHelper.ts] File content read successfully. Length: ${fileContent.length}`
  );

  try {
    const data = JSON.parse(fileContent) as AssetPTCrudTestConfig;
    console.log(
      `[jsonHelper.ts] Successfully parsed PT CRUD JSON for scenario: ${data.scenario}`
    );
    return data;
  } catch (error) {
    throw new Error(`Failed to parse JSON file ${filePath}: ${error}`);
  }
}

// ============================================================================
// Stock Split Test Types
// ============================================================================

export interface SplitTransactionInput {
  splitRatio: string;
}

export interface SplitStepTransaction {
  type: "BUY" | "SPLIT" | "DELETE_SPLIT";
  input?: TransactionInput | SplitTransactionInput;
  expected?: {
    wallets?: WalletExpected[];
    errorMessage?: string;
  };
}

export interface SplitTestStep {
  description: string;
  transactions: SplitStepTransaction[];
}

export interface AssetSplitTestConfig {
  scenario: string;
  description: string;
  asset: {
    input: AssetCreateInput;
  };
  entryTargets: { input: TargetInput }[];
  profitTargets: { input: TargetInput }[];
  steps: Record<string, SplitTestStep>;
}

export function loadAssetSplitTestData(fileName: string): AssetSplitTestConfig {
  const filePath = path.resolve(process.cwd(), fileName);
  console.log(`[jsonHelper.ts] Attempting to load Split JSON from: ${filePath}`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`JSON file not found: ${filePath}`);
  }

  const fileContent = fs.readFileSync(filePath, "utf-8");
  console.log(
    `[jsonHelper.ts] File content read successfully. Length: ${fileContent.length}`
  );

  try {
    const data = JSON.parse(fileContent) as AssetSplitTestConfig;
    console.log(
      `[jsonHelper.ts] Successfully parsed Split JSON for scenario: ${data.scenario}`
    );
    return data;
  } catch (error) {
    throw new Error(`Failed to parse JSON file ${filePath}: ${error}`);
  }
}

// ============================================================================
// Transaction Split Test Types (BUY, SELL, SPLIT combined)
// ============================================================================

export interface SplitInput {
  splitRatio: string;
}

export interface SplitTransactionExpected {
  type: "Split";
  ratio: string;
}

export interface TransactionSplitAction {
  testPriceUpdate?: string;
  isSell?: boolean;
  isSplit?: boolean;
  input?: TransactionInput | {
    ptPercent: string;
    walletPrice: string;
    signal: string;
    price: string;
    quantity: string;
  };
  splitInput?: SplitInput;
  expected: {
    transaction?: TransactionExpected | SplitTransactionExpected;
    priorTransactions?: TransactionExpected[];
    wallets: WalletExpected[];
    walletsNotPresent?: { ptPercent: string; price: string }[];
    overview: OverviewExpected;
    financialOverview: FinancialOverviewExpected;
  };
}

export interface TransactionSplitTestConfig {
  scenario: string;
  description: string;
  asset: {
    input: AssetCreateInput;
    budget: { year: string; amount: string };
  };
  entryTargets: { input: TargetInput }[];
  profitTargets: { input: TargetInput }[];
  transactions: {
    [key: string]: TransactionSplitAction;
  };
}

export function loadTransactionSplitTestData(fileName: string): TransactionSplitTestConfig {
  const filePath = path.resolve(process.cwd(), fileName);
  console.log(`[jsonHelper.ts] Attempting to load TransactionSplit JSON from: ${filePath}`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`JSON file not found: ${filePath}`);
  }

  const fileContent = fs.readFileSync(filePath, "utf-8");
  console.log(
    `[jsonHelper.ts] File content read successfully. Length: ${fileContent.length}`
  );

  try {
    const data = JSON.parse(fileContent) as TransactionSplitTestConfig;
    console.log(
      `[jsonHelper.ts] Successfully parsed TransactionSplit JSON for scenario: ${data.scenario}`
    );
    return data;
  } catch (error) {
    throw new Error(`Failed to parse JSON file ${filePath}: ${error}`);
  }
}

// ============================================================================
// Historical Reversal Test Types
// ============================================================================

export interface HistoricalReversalAction {
  testPriceUpdate?: string;

  // Create operations
  isSell?: boolean;
  isSplit?: boolean;
  isDividendOrSlp?: boolean;

  // Delete operations
  isDelete?: boolean;              // Delete SELL
  isDeleteSplit?: boolean;         // Delete SPLIT
  isDeleteDividendOrSlp?: boolean; // Delete DIVIDEND/SLP
  isDeleteBuy?: boolean;           // Delete BUY

  // Inputs
  input?: TransactionInput | {
    ptPercent: string;
    walletPrice: string;
    signal: string;
    price: string;
    quantity: string;
  };
  splitInput?: SplitInput;
  dividendSlpInput?: DividendSlpInput;

  // Target for delete/edit operations
  target?: EditTransactionTarget;
  targetTransaction?: {
    type?: string;
    ratio?: string;
    signal?: string;
    price?: string;
    amount?: string;
  };

  expected: {
    transaction?: TransactionExpected | SellTransactionExpected | SplitTransactionExpected;
    transactionNotPresent?: {
      signal?: string;
      price?: string;
      investment?: string;
      amount?: string;
    };
    priorTransactions?: (TransactionExpected | SellTransactionExpected)[];
    wallets?: WalletExpected[];
    walletsNotPresent?: { ptPercent: string; price: string }[];
    overview?: OverviewExpected;
    financialOverview?: FinancialOverviewExpected;
  };
}

export interface HistoricalReversalTestConfig {
  scenario: string;
  description: string;
  asset: {
    input: AssetCreateInput;
    budget: { year: string; amount: string };
  };
  entryTargets: { input: TargetInput }[];
  profitTargets: { input: TargetInput }[];
  transactions: {
    [key: string]: HistoricalReversalAction;
  };
}

export function loadHistoricalReversalTestData(fileName: string): HistoricalReversalTestConfig {
  const filePath = path.resolve(process.cwd(), fileName);
  console.log(`[jsonHelper.ts] Attempting to load HistoricalReversal JSON from: ${filePath}`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`JSON file not found: ${filePath}`);
  }

  const fileContent = fs.readFileSync(filePath, "utf-8");
  console.log(
    `[jsonHelper.ts] File content read successfully. Length: ${fileContent.length}`
  );

  try {
    const data = JSON.parse(fileContent) as HistoricalReversalTestConfig;
    console.log(
      `[jsonHelper.ts] Successfully parsed HistoricalReversal JSON for scenario: ${data.scenario}`
    );
    return data;
  } catch (error) {
    throw new Error(`Failed to parse JSON file ${filePath}: ${error}`);
  }
}

// ============================================================================
// Entry Target CRUD Test Types
// ============================================================================

export interface ETCrudCreateStep {
  input: TargetInput;
  expected: TargetExpected;
}

export interface ETCrudEditStep {
  input: TargetInput;
  expected: TargetExpected;
}

export interface ETCrudDeleteStep {
  confirmationMessage: string;  // Expected warning message when deleting ET
}

export interface ETTransactionAction {
  testPriceUpdate?: string;
  input?: TransactionInput;
  expected: {
    transaction?: TransactionExpected;
    wallets: WalletExpected[];
    overview: OverviewExpected;
  };
}

export interface ETEditAfterTransactionsStep {
  input: TargetInput;
  expected: TargetExpected;
  expectedTransactions: {
    signal: string;
    price: string;
    entryTarget: string;  // The updated entry target price
  }[];
  expectedColumnHeader: string;  // The expected ET column header name
}

export interface DashboardVerification {
  symbol: string;
  pullback: string;  // Expected pullback value (e.g., "-18.18%")
}

export interface AssetETCrudTestConfig {
  scenario: string;
  description: string;
  asset: {
    input: AssetCreateInput;
    budget?: { year: string; amount: string };
  };
  profitTargets: { input: TargetInput }[];
  steps: {
    createET: ETCrudCreateStep;
    editET: ETCrudEditStep;
    deleteET: ETCrudDeleteStep;
    recreateET: ETCrudCreateStep;
    transactions: {
      [key: string]: ETTransactionAction;
    };
    editETAfterTransactions: ETEditAfterTransactionsStep;
    dashboardVerification: DashboardVerification;
  };
}

export function loadAssetETCrudTestData(fileName: string): AssetETCrudTestConfig {
  const filePath = path.resolve(process.cwd(), fileName);
  console.log(`[jsonHelper.ts] Attempting to load ET CRUD JSON from: ${filePath}`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`JSON file not found: ${filePath}`);
  }

  const fileContent = fs.readFileSync(filePath, "utf-8");
  console.log(
    `[jsonHelper.ts] File content read successfully. Length: ${fileContent.length}`
  );

  try {
    const data = JSON.parse(fileContent) as AssetETCrudTestConfig;
    console.log(
      `[jsonHelper.ts] Successfully parsed ET CRUD JSON for scenario: ${data.scenario}`
    );
    return data;
  } catch (error) {
    throw new Error(`Failed to parse JSON file ${filePath}: ${error}`);
  }
}

// ============================================================================
// 5D Pullback Test Types
// ============================================================================

export interface HistoricalCloseInput {
  date: string;
  close: number;
}

export interface FiveDPullbackScenario {
  name: string;
  testPrice: string;
  testHistoricalCloses: HistoricalCloseInput[];
  expected: {
    fiveDPullback: string;  // e.g., "-6.86%" or "-" for null
  };
}

export interface FiveDPullbackTestConfig {
  scenario: string;
  description: string;
  asset: {
    input: AssetCreateInput;
  };
  entryTarget: { input: TargetInput };
  scenarios: FiveDPullbackScenario[];
}

export function loadFiveDPullbackTestData(fileName: string): FiveDPullbackTestConfig {
  const filePath = path.resolve(process.cwd(), fileName);
  console.log(`[jsonHelper.ts] Attempting to load 5D Pullback JSON from: ${filePath}`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`JSON file not found: ${filePath}`);
  }

  const fileContent = fs.readFileSync(filePath, "utf-8");
  console.log(
    `[jsonHelper.ts] File content read successfully. Length: ${fileContent.length}`
  );

  try {
    const data = JSON.parse(fileContent) as FiveDPullbackTestConfig;
    console.log(
      `[jsonHelper.ts] Successfully parsed 5D Pullback JSON for scenario: ${data.scenario}`
    );
    return data;
  } catch (error) {
    throw new Error(`Failed to parse JSON file ${filePath}: ${error}`);
  }
}

// ============================================================================
// Cash Transaction CRUD Test Types (DIVIDEND/SLP postdating, edit, delete)
// ============================================================================

export interface CashCrudTransactionAction {
  testPriceUpdate?: string;           // Update test price before transaction
  isSell?: boolean;                   // Discriminator for SELL transactions
  isDividendOrSlp?: boolean;          // Discriminator for DIVIDEND/SLP transactions
  input?: TransactionInput;           // BUY input
  sellInput?: SellTransactionInput;   // SELL input
  dividendSlpInput?: DividendSlpInput; // DIVIDEND/SLP input
}

export interface CashCrudCheckpoint {
  name: string;
  action: "create" | "edit" | "delete";
  target?: {                          // For edit/delete: target the transaction by type and amount
    type: "DIVIDEND" | "SLP";
    amount?: string;                  // Amount to match for finding transaction
  };
  editInput?: DividendSlpInput;       // New values for edit action
  expected: {
    financialOverview: FinancialOverviewExpected;
  };
}

export interface CashCrudTestConfig {
  scenario: string;
  description: string;
  asset: {
    input: AssetCreateInput;
    budget: { year: string; amount: string };
  };
  entryTargets: { input: TargetInput }[];
  profitTargets: { input: TargetInput }[];
  setupTransactions: {
    [key: string]: CashCrudTransactionAction;
  };
  checkpoints: CashCrudCheckpoint[];
}

export function loadCashCrudTestData(fileName: string): CashCrudTestConfig {
  const filePath = path.resolve(process.cwd(), fileName);
  console.log(`[jsonHelper.ts] Attempting to load Cash CRUD JSON from: ${filePath}`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`JSON file not found: ${filePath}`);
  }

  const fileContent = fs.readFileSync(filePath, "utf-8");
  console.log(
    `[jsonHelper.ts] File content read successfully. Length: ${fileContent.length}`
  );

  try {
    const data = JSON.parse(fileContent) as CashCrudTestConfig;
    console.log(
      `[jsonHelper.ts] Successfully parsed Cash CRUD JSON for scenario: ${data.scenario}`
    );
    return data;
  } catch (error) {
    throw new Error(`Failed to parse JSON file ${filePath}: ${error}`);
  }
}
