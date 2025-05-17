// e2e/utils/csvHelper.ts
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
// We will define our own minimal context types if direct import fails

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
    date: string;
    displayDate: string;
    action: 'Buy' | 'Sell' | 'Div';
    txnType: 'Split' | 'Swing' | 'Hold';
    signal: string;
    price: number;
    investment: number;
    quantity: number;
}

export function loadScenariosFromCSV<T extends object>(
    relativePath: string,
    numericColumns: ReadonlyArray<keyof T>
): T[] {
    const csvFilePath = path.resolve(__dirname, relativePath);
    try {
        const fileContent = fs.readFileSync(csvFilePath, { encoding: 'utf-8' });

        const parsedRecords: any[] = parse(fileContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
            cast: (value: string, context: MinimalCastingContext) => { // Using MinimalCastingContext
                if (context.header || !context.column) {
                    return value;
                }
                // Ensure context.column is treated as string if that's expected from 'columns:true'
                const columnName = String(context.column);
                if ((numericColumns as ReadonlyArray<string>).includes(columnName)) {
                    if (value === '' || value === null || value === undefined) {
                        return null;
                    }
                    const num = parseFloat(value);
                    return isNaN(num) ? null : num;
                }
                return value;
            },
            on_record: (record: Partial<T>, context: MinimalRecordContext): T | null => { // Using MinimalRecordContext
                return record as T;
            }
        });

        const recordsAfterOnRecord = parsedRecords as (T | null)[];
        return recordsAfterOnRecord.filter((item: T | null): item is T => item !== null);

    } catch (error) {
        const err = error as Error;
        console.error(`[CSVHelper] Error loading scenarios from ${csvFilePath}: ${err.message}`);
        throw new Error(`Failed to load scenarios from ${relativePath}. Make sure the file exists, is readable, and matches the expected format. Original error: ${err.message}`);
    }
}