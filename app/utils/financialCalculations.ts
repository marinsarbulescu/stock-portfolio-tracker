// app/utils/financialCalculations.ts
import { CURRENCY_PRECISION } from '@/app/config/constants'; // Assuming you have this constant

// Define simplified types for mock data used in tests (can also be shared or defined in test file)
interface MockTransaction {
    id: string;
    action: 'Buy' | 'Sell' | 'Div';
    txnType?: 'Swing' | 'Hold' | 'Split' | string | null;
    completedTxnId?: string | null;
    quantity?: number | null;
    price?: number | null;
    date?: string;
}

interface MockWallet {
    id: string;
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
 * Calculates the total realized P/L for all 'Swing' type sales.
 * @param transactions - Array of transaction objects.
 * @param wallets - Array of wallet objects (to find buy prices).
 * @returns The total realized P/L for swing sales, rounded to currency precision.
 */
export function calculateTotalRealizedSwingPL(
    transactions: MockTransaction[],
    wallets: MockWallet[]
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
                // Call calculateSingleSalePL directly as it's in the same file
                const profitForTxn = calculateSingleSalePL(txn.price, walletBuyPrice, txn.quantity);
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
    return value.toFixed(precision);
}

/**
 * Formats a number as a share quantity string.
 * @param value - The number to format.
 * @param precision - The number of decimal places for shares.
 * @returns A string representing the formatted share quantity.
 */
export function formatShares(value: number, precision: number): string {
    if (typeof value !== 'number' || isNaN(value)) {
        // console.warn(`Invalid input to formatShares: ${value}. Returning empty string.`);
        return ''; // Or throw an error, or return a default like 'N/A'
    }
    return value.toFixed(precision);
}