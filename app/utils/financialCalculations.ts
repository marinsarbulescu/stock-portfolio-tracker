// app/utils/financialCalculations.ts
import { CURRENCY_PRECISION, PERCENT_PRECISION } from '@/app/config/constants'; // Assuming you have these constants

// Define simplified types for mock data used in tests (can also be shared or defined in test file)
interface MockTransaction {
    id: string;
    action: 'Buy' | 'Sell' | 'Div' | 'SLP';
    txnType?: 'Swing' | 'Hold' | 'Split' | string | null;
    completedTxnId?: string | null;
    quantity?: number | null;
    price?: number | null;
    date?: string;
    txnProfit?: number | null; // Add txnProfit for commission-adjusted calculations
}

interface MockWallet {
    id: string;
    buyPrice?: number | null;
}

// Define a flexible transaction interface that can handle both Mock and Schema types
export interface TransactionForCalculation {
    id?: string | null;
    action?: string | null;
    txnType?: string | null;
    completedTxnId?: string | null;
    quantity?: number | null;
    price?: number | null;
    date?: string | null;
    txnProfit?: number | null;
}

// Define a flexible wallet interface that can handle both Mock and Schema types  
export interface WalletForCalculation {
    id?: string | null;
    buyPrice?: number | null;
}

/**
 * Calculates the profit or loss for a single sale transaction.
 * @param sellPrice - The price at which shares were sold.
 * @param buyPrice - The original buy price of the shares.
 * @param quantity - The number of shares sold.
 * @returns The calculated profit (if positive) or loss (if negative).
 */
export function calculateSingleSalePL(
    sellPrice: number,
    buyPrice: number,
    quantity: number
): number {
    // You can add input validation if necessary
    if (
        typeof sellPrice !== 'number' || isNaN(sellPrice) ||
        typeof buyPrice !== 'number' || isNaN(buyPrice) ||
        typeof quantity !== 'number' || isNaN(quantity)
    ) {
        console.warn("Invalid input to calculateSingleSalePL. Returning 0.");
        return 0; // Or throw an error, depending on desired behavior
    }
    return (sellPrice - buyPrice) * quantity;
}

/**
 * Calculates the profit or loss for a single sale transaction, accounting for commission.
 * @param sellPrice - The price at which shares were sold.
 * @param buyPrice - The original buy price of the shares.
 * @param quantity - The number of shares sold.
 * @param commissionPercent - The commission percentage (e.g., 1 for 1%).
 * @returns The calculated profit (if positive) or loss (if negative), net of commission.
 */
export function calculateSingleSalePLWithCommission(
    sellPrice: number,
    buyPrice: number,
    quantity: number,
    commissionPercent: number
): number {
    // Input validation
    if (
        typeof sellPrice !== 'number' || isNaN(sellPrice) ||
        typeof buyPrice !== 'number' || isNaN(buyPrice) ||
        typeof quantity !== 'number' || isNaN(quantity) ||
        typeof commissionPercent !== 'number' || isNaN(commissionPercent)
    ) {
        console.warn("Invalid input to calculateSingleSalePLWithCommission. Returning 0.");
        return 0;
    }
    
    // Calculate gross P/L
    const grossPL = (sellPrice - buyPrice) * quantity;
    
    // Calculate commission on the sale amount
    const saleValue = sellPrice * quantity;
    const commission = saleValue * (commissionPercent / 100);
    
    // Return net P/L after commission
    return grossPL - commission;
}

/**
 * Calculates the total realized P/L for all 'Swing' type sales.
 * @param transactions - Array of transaction objects.
 * @param wallets - Array of wallet objects (to find buy prices).
 * @returns The total realized P/L for swing sales, rounded to currency precision.
 */
export function calculateTotalRealizedSwingPL(
    transactions: TransactionForCalculation[],
    wallets: WalletForCalculation[]
): number {
    const walletBuyPriceMap = new Map<string, number>();
    wallets.forEach(w => {
        if (w.id && typeof w.buyPrice === 'number') {
            walletBuyPriceMap.set(w.id, w.buyPrice);
        }
    });

    let totalSwingPlDollars = 0;

    transactions.forEach(txn => {
        if (
            txn.action === 'Sell' &&
            txn.txnType === 'Swing' &&
            txn.completedTxnId &&
            typeof txn.quantity === 'number' &&
            typeof txn.price === 'number'
        ) {
            const walletBuyPrice = walletBuyPriceMap.get(txn.completedTxnId);

            if (typeof walletBuyPrice === 'number') {
                // Use stored txnProfit if available (commission-adjusted), otherwise calculate
                const profitForTxn = txn.txnProfit ?? calculateSingleSalePL(txn.price, walletBuyPrice, txn.quantity);
                totalSwingPlDollars += profitForTxn;
            } else {
                console.warn(`[calculateTotalRealizedSwingPL] Buy price not found for wallet ID: ${txn.completedTxnId} on Swing Sell Txn ID: ${txn.id}`);
            }
        }
    });

    return parseFloat(totalSwingPlDollars.toFixed(CURRENCY_PRECISION));
}

/**
 * Formats a number as a currency string.
 * @param value - The number to format.
 * @param precision - The number of decimal places.
 * @returns A string representing the formatted currency value.
 */
export function formatCurrency(value: number, precision: number = CURRENCY_PRECISION): string {
    if (typeof value !== 'number' || isNaN(value)) {
        // console.warn(`Invalid input to formatCurrency: ${value}. Returning empty string.`);
        return ''; // Or throw an error, or return a default like 'N/A'
    }
    // Use Intl.NumberFormat for proper currency formatting
    // This will handle negative signs correctly and add currency symbols based on locale.
    // For simplicity, using 'USD' and 'en-US' locale. Adjust if you need multi-currency/locale support.
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD', // Change if you support other currencies
        minimumFractionDigits: precision,
        maximumFractionDigits: precision,
    }).format(value);
}

/**
 * Formats a number as a share quantity string.
 * @param value - The number to format.
 * @param precision - The number of decimal places for shares.
 * @returns A string representing the formatted share quantity.
 */
export function formatShares(value: number, precision: number): string {
    if (typeof value !== 'number' || isNaN(value)) {
        return ''; // Or throw an error, or return a default like 'N/A'
    }
    return value.toFixed(precision);
}

/**
 * Formats a number as a percentage string.
 * @param value - The number to format (e.g., 50 for 50%).
 * @returns A string representing the formatted percentage value.
 */
export function formatPercent(value: number | null | undefined): string {
    if (typeof value !== 'number' || isNaN(value)) {
        return '-';
    }
    return `${value.toFixed(PERCENT_PRECISION)}%`;
}