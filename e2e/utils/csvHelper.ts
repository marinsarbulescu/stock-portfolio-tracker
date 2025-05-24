// e2e/utils/csvHelper.ts
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

// --- Locally Defined Minimal Context Interfaces ---
interface MinimalCastingContext {
    header?: boolean;
    // With `columns: true` in parse options, context.column should be the string header name.
    // If columns were an array of names, it could also be a string.
    // If columns were false, it would be a number (index).
    column?: string | number | null;
}

interface MinimalRecordContext {
    // Define properties if you use any from the context in on_record.
    // If not using any, 'any' or an empty object {} would also work.
    // For example, csv-parse Context includes 'lines', 'records', 'count', etc.
}
// --- End Local Context Interfaces ---


export interface AddTransactionInputScenario {
    scenarioName: string;
    stepName?: string; // Added for multi-step scenarios
    date: string; // YYYY-MM-DD
    displayDate?: string; // MM/DD/YYYY or other display format
    action: 'Buy' | 'Sell' | 'Div'; // Assuming these are the primary actions
    txnType?: 'Swing' | 'Hold' | 'Split'; // Specific to Buy actions
    signal?: '_5DD' | 'Cust' | 'Initial' | 'EOM' | 'LBD' | 'TPH' | 'TPP' | 'TP'; // Signal for the transaction
    price?: number;
    investment?: number; // For Buy/Div
    quantity?: number; // For Sell, or calculated for Buy
    pdp?: number; // Percent Down Price (for LBD calc)
    plr?: number; // Profit/Loss Ratio (for TP calc)
    swingHoldRatio?: number; // Percentage for Swing in a Split Buy (e.g., 70 for 70%)
    lbd?: number; // Limit Buy Down price (calculated or for verification)
    // Expected Swing Wallet values
    SwWtBuyPrice?: number;
    SwWtTotalInvestment?: number;
    SwWtRemainingShares?: number;
    // Expected Hold Wallet values
    HlWtBuyPrice?: number;
    HlWtTotalInvestment?: number;
    HlWtRemainingShares?: number;

    // New fields for stock creation
    stockSymbol: string;
    stockName: string;
    stockStockType?: string;
    stockRegion?: string;
    stockPdp?: number;
    stockPlr?: number;
    stockBudget?: number;
    stockSwingHoldRatio?: number;
}

export function loadScenariosFromCSV<T extends Record<string, any>>(
    relativePath: string,
    numericColumns: ReadonlyArray<keyof T> = []
): T[] {
    const filePath = path.join(__dirname, relativePath);
    console.log(`[csvHelper.ts] Attempting to load CSV from: ${filePath}`); // LOG 1
    try {
        const fileContent = fs.readFileSync(filePath, { encoding: 'utf8' });
        console.log(`[csvHelper.ts] File content read successfully. Length: ${fileContent.length}`); // LOG 2
        if (fileContent.trim().length === 0) {
            console.warn(`[csvHelper.ts] CSV file is empty: ${filePath}`);
            return [];
        }

        const records = parse(fileContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
            cast: (value: string, context: MinimalCastingContext) => { // Using MinimalCastingContext
                if (context.header) return value;
                if (numericColumns.includes(context.column as keyof T)) {
                    if (value === '' || value.trim() === '') return undefined; // Handle empty strings for numeric fields
                    const num = parseFloat(value);
                    return isNaN(num) ? undefined : num; // Convert actual NaN to undefined as well, or keep as NaN if preferred
                }
                return value;
            },
        }) as unknown as T[];
        console.log(`[csvHelper.ts] Parsed ${records.length} records from ${filePath}`); // LOG 3
        return records;
    } catch (error) {
        console.error(`[csvHelper.ts] Error loading or parsing CSV file ${filePath}:`, error);
        return [];
    }
}