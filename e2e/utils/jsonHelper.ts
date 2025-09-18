// e2e/utils/jsonHelper.ts
import * as fs from 'fs';
import * as path from 'path';

export interface WalletExpectation {
    buyPrice: number;
    investment: number;
    sharesLeft: number;
    deleted?: boolean;
}

export interface OverviewExpectation {
    settings: {
        budget: number;
        invested: number;
        pdp: string;
        shr: string;
        stp: string;
        htp: string;
    };
    txnsAndShares: {
        buys: number;
        totalSells: number;
        swingSells: number;
        holdSells: number;
        swingShares: string;
        holdShares: string;
        totalShares: string;
    };
    realizedPL: {
        swingDollars: string;
        swingPercent: string;
        holdDollars: string;
        holdPercent: string;
        stockDollars: string;
        stockPercent: string;
    };
    unrealizedPL: {
        swingDollars: string;
        swingPercent: string;
        holdDollars: string;
        holdPercent: string;
        stockDollars: string;
        stockPercent: string;
    };
    combinedPL: {
        swingDollars: string;
        swingPercent: string;
        holdDollars: string;
        holdPercent: string;
        stockDollars: string;
        stockPercent: string;
        incomeDollars: string;
    };
}

export interface TestPriceUpdate {
    step: string;
    description: string;
    price: number;
    timing: string;
}

export interface TransactionStep {
    input: {
        date: string;
        type?: 'Split' | 'Swing' | 'Hold';
        signal?: string;
        price?: number;
        investment?: number;
        amount?: number;
        newPrice?: number;
        action?: 'Buy' | 'Sell' | 'SLP' | 'Div';
    };
    output: {
        overview?: OverviewExpectation;
        wallets: {
            swing: Record<string, WalletExpectation>;
            hold: Record<string, WalletExpectation>;
        };
    };
}

export interface StockConfig {
    symbol: string;
    name: string;
    stockType: 'Stock' | 'ETF' | 'Crypto';
    region: 'APAC' | 'EU' | 'Intl' | 'US';
    pdp: number;
    stp: number;
    budget: number;
    swingHoldRatio: number;
    stockCommission: number;
    htp?: number;
    testPrice?: number;
    testHistoricalCloses?: Array<{ date: string; close: number; }>;
}

export interface TestConfig {
    scenarioName: string;
    stock: StockConfig;
    transactions: {
        AddTransactionA: TransactionStep;
        AddTransactionB: TransactionStep;
        UpdateTransactionA: TransactionStep;
        UpdateTransactionB: TransactionStep;
    };
}

export interface AddTransactionTestConfig {
    scenario: string;
    testPriceUpdates: Record<string, TestPriceUpdate>;
    stock: StockConfig;
    transactions: Record<string, TransactionStep>;
}

export interface DeleteTransactionTestConfig {
    scenario: string;
    stock: StockConfig;
    transactions: Record<string, TransactionStep>;
}

export interface SamePriceTransactionTestConfig {
    scenario: string;
    stock: StockConfig;
    transactions: Record<string, TransactionStep>;
}

export interface PortfolioCreateEditTestConfig {
    scenario: string;
    initialStock: StockConfig & {
        stockTrend?: 'Up' | 'Down' | 'Sideways' | null;
    };
    editedStock: StockConfig & {
        stockTrend?: 'Up' | 'Down' | 'Sideways' | null;
    };
}

export function loadTestData(fileName: string): TestConfig {
    const filePath = path.resolve(process.cwd(), fileName);
    console.log(`[jsonHelper.ts] Attempting to load JSON from: ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
        throw new Error(`JSON file not found: ${filePath}`);
    }
    
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    console.log(`[jsonHelper.ts] File content read successfully. Length: ${fileContent.length}`);
    
    try {
        const data = JSON.parse(fileContent) as TestConfig;
        console.log(`[jsonHelper.ts] Successfully parsed JSON for scenario: ${data.scenarioName}`);
        return data;
    } catch (error) {
        throw new Error(`Failed to parse JSON file ${filePath}: ${error}`);
    }
}

export function loadAddTransactionTestData(fileName: string): AddTransactionTestConfig {
    const filePath = path.resolve(process.cwd(), fileName);
    console.log(`[jsonHelper.ts] Attempting to load Add Transaction JSON from: ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
        throw new Error(`JSON file not found: ${filePath}`);
    }
    
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    console.log(`[jsonHelper.ts] File content read successfully. Length: ${fileContent.length}`);
    
    try {
        const data = JSON.parse(fileContent) as AddTransactionTestConfig;
        console.log(`[jsonHelper.ts] Successfully parsed JSON for scenario: ${data.scenario}`);
        return data;
    } catch (error) {
        throw new Error(`Failed to parse JSON file ${filePath}: ${error}`);
    }
}

export function loadDeleteTransactionTestData(fileName: string): DeleteTransactionTestConfig {
    const filePath = path.resolve(process.cwd(), fileName);
    console.log(`[jsonHelper.ts] Attempting to load Delete Transaction JSON from: ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
        throw new Error(`JSON file not found: ${filePath}`);
    }
    
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    console.log(`[jsonHelper.ts] File content read successfully. Length: ${fileContent.length}`);
    
    try {
        const data = JSON.parse(fileContent) as DeleteTransactionTestConfig;
        console.log(`[jsonHelper.ts] Successfully parsed JSON for scenario: ${data.scenario}`);
        return data;
    } catch (error) {
        throw new Error(`Failed to parse JSON file ${filePath}: ${error}`);
    }
}

export function loadSamePriceTransactionTestData(fileName: string): SamePriceTransactionTestConfig {
    const filePath = path.resolve(process.cwd(), fileName);
    console.log(`[jsonHelper.ts] Attempting to load Same Price Transaction JSON from: ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
        throw new Error(`JSON file not found: ${filePath}`);
    }
    
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    console.log(`[jsonHelper.ts] File content read successfully. Length: ${fileContent.length}`);
    
    try {
        const data = JSON.parse(fileContent) as SamePriceTransactionTestConfig;
        console.log(`[jsonHelper.ts] Successfully parsed JSON for scenario: ${data.scenario}`);
        return data;
    } catch (error) {
        throw new Error(`Failed to parse JSON file ${filePath}: ${error}`);
    }
}

export function loadPortfolioCreateEditTestData(fileName: string): PortfolioCreateEditTestConfig {
    const filePath = path.resolve(process.cwd(), fileName);
    console.log(`[jsonHelper.ts] Attempting to load Portfolio Create Edit JSON from: ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
        throw new Error(`JSON file not found: ${filePath}`);
    }
    
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    console.log(`[jsonHelper.ts] File content read successfully. Length: ${fileContent.length}`);
    
    try {
        const data = JSON.parse(fileContent) as PortfolioCreateEditTestConfig;
        console.log(`[jsonHelper.ts] Successfully parsed JSON for scenario: ${data.scenario}`);
        return data;
    } catch (error) {
        throw new Error(`Failed to parse JSON file ${filePath}: ${error}`);
    }
}

// 5DD Test Configuration Interfaces
export interface FiveDDTestCase {
    name: string;
    description: string;
    stock: StockConfig;
    transaction: {
        action: 'Buy' | 'Sell';
        txnType: 'Split' | 'Swing' | 'Hold';
        signal: string;
        price: number;
        investment: number;
        date: string;
    };
    expected: {
        fiveDayDip: string | null;
        lastBuyDays: number;
        lbd: string;
        shouldShow5DD: boolean;
        calculations?: any;
    };
}

export interface FiveDDValidationConfig {
    scenario: string;
    description: string;
    testCases: FiveDDTestCase[];
    columnVisibility: {
        fiveDayDip: boolean;
        lbd: boolean;
        sinceBuy: boolean;
    };
    validationPoints: {
        case1: string[];
        case2: string[];
    };
}

// Function to load 5DD test configuration
export function loadFiveDDTestData(filePath: string): FiveDDValidationConfig {
    if (!fs.existsSync(filePath)) {
        throw new Error(`Test configuration file not found: ${filePath}`);
    }
    
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    console.log(`[jsonHelper.ts] 5DD test file content read successfully. Length: ${fileContent.length}`);
    
    try {
        const data = JSON.parse(fileContent) as FiveDDValidationConfig;
        console.log(`[jsonHelper.ts] Successfully parsed 5DD JSON for scenario: ${data.scenario}`);
        return data;
    } catch (error) {
        throw new Error(`Failed to parse 5DD JSON file ${filePath}: ${error}`);
    }
}
