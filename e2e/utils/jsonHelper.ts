// e2e/utils/jsonHelper.ts
import * as fs from 'fs';
import * as path from 'path';

export interface WalletExpectation {
    buyPrice: number;
    investment: number;
    sharesLeft: number;
    deleted?: boolean;
}

export interface TransactionStep {
    input: {
        date: string;
        type: 'Split' | 'Swing' | 'Hold';
        signal: string;
        price?: number;
        investment?: number;
        newPrice?: number;
    };
    output: {
        wallets: {
            swing: Record<string, WalletExpectation>;
            hold: Record<string, WalletExpectation>;
        };
    };
}

export interface StockConfig {
    symbol: string;
    name: string;
    stockType: string;
    region: string;
    pdp: number;
    plr: number;
    budget: number;
    swingHoldRatio: number;
    commission: number;
    htp: number;
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
