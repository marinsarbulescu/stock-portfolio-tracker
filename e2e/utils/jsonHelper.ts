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
