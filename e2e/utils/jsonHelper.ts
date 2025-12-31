// e2e/utils/jsonHelper.ts
import * as fs from "fs";
import * as path from "path";

export interface AssetCreateInput {
  symbol: string;
  name: string;
  type: "STOCK" | "ETF" | "CRYPTO";
  testPrice: string;
  commission: string;
  status: "ACTIVE" | "HIDDEN" | "ARCHIVED";
}

export interface AssetCreateExpected {
  symbol: string;
  name: string;
  type: string;
  commission: string;
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

export interface AssetTargetsTestConfig {
  scenario: string;
  description: string;
  asset: {
    input: AssetCreateInput;
  };
  entryTarget: {
    create: TargetAction;
    edit: TargetAction;
  };
  profitTargets: {
    create: TargetAction[];
    edit: TargetEditAction;
  };
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
  pt: string;
  pct2pt: string;
  pct2ptHighlight?: "green" | "none";  // Optional highlight verification
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
}

export interface SellTransactionExpected {
  type: string;         // "Sell"
  signal: string;
  price: string;
  quantity: string;
  amount: string;       // SELL specific (proceeds after commission)
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

export function loadAssetTargetsTestData(fileName: string): AssetTargetsTestConfig {
  const filePath = path.resolve(process.cwd(), fileName);
  console.log(`[jsonHelper.ts] Attempting to load Targets JSON from: ${filePath}`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`JSON file not found: ${filePath}`);
  }

  const fileContent = fs.readFileSync(filePath, "utf-8");
  console.log(
    `[jsonHelper.ts] File content read successfully. Length: ${fileContent.length}`
  );

  try {
    const data = JSON.parse(fileContent) as AssetTargetsTestConfig;
    console.log(
      `[jsonHelper.ts] Successfully parsed Targets JSON for scenario: ${data.scenario}`
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
