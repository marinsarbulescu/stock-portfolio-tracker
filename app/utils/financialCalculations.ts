// app/utils/financialCalculations.ts
import { CURRENCY_PRECISION, PERCENT_PRECISION } from '@/app/config/constants'; // Assuming you have these constants
import { extractStockSplits, calculateSplitAdjustedPL, type StockSplitInfo } from './splitUtils';

// Define simplified types for mock data used in tests (can also be shared or defined in test file)
// interface MockTransaction {
//     id: string;
//     action: 'Buy' | 'Sell' | 'Div' | 'SLP';
//     txnType?: 'Swing' | 'Hold' | 'Split' | string | null;
//     completedTxnId?: string | null;
//     quantity?: number | null;
//     price?: number | null;
//     date?: string;
//     txnProfit?: number | null; // Add txnProfit for commission-adjusted calculations
// }

// interface MockWallet {
//     id: string;
//     buyPrice?: number | null;
// }

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
 * Calculates the total realized P/L for all 'Swing' type sales with split adjustments.
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

    // Extract stock splits from transactions
    const stockSplits = extractStockSplits(transactions);

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
                // Use stored txnProfit if available (commission-adjusted), otherwise calculate with split adjustments
                if (txn.txnProfit !== null && txn.txnProfit !== undefined) {
                    totalSwingPlDollars += txn.txnProfit;
                } else {
                    // Calculate split-adjusted P/L
                    const sellDate = txn.date || '';
                    const buyDate = ''; // We'd need wallet creation date for perfect accuracy
                    
                    const splitAdjustedPL = calculateSplitAdjustedPL(
                        txn.price,
                        walletBuyPrice,
                        txn.quantity,
                        sellDate,
                        buyDate,
                        stockSplits
                    );
                    
                    totalSwingPlDollars += splitAdjustedPL.adjustedPL;
                }
            } else {
                console.warn(`[calculateTotalRealizedSwingPL] Buy price not found for wallet ID: ${txn.completedTxnId} on Swing Sell Txn ID: ${txn.id}`);
            }
        }
    });

    return parseFloat(totalSwingPlDollars.toFixed(CURRENCY_PRECISION));
}

/**
 * Split-aware version of calculateSingleSalePL
 * @param sellPrice - The price at which shares were sold
 * @param buyPrice - The original buy price of the shares
 * @param quantity - The number of shares sold
 * @param sellDate - Date of the sale transaction
 * @param buyDate - Date of the buy transaction  
 * @param splits - Array of stock splits to consider
 * @returns The calculated profit/loss with split adjustments
 */
export function calculateSingleSalePLWithSplits(
    sellPrice: number,
    buyPrice: number,
    quantity: number,
    sellDate: string,
    buyDate: string,
    splits: StockSplitInfo[]
): number {
    // Input validation
    if (
        typeof sellPrice !== 'number' || isNaN(sellPrice) ||
        typeof buyPrice !== 'number' || isNaN(buyPrice) ||
        typeof quantity !== 'number' || isNaN(quantity)
    ) {
        console.warn("Invalid input to calculateSingleSalePLWithSplits. Returning 0.");
        return 0;
    }

    if (!splits.length) {
        // No splits - use original calculation
        return calculateSingleSalePL(sellPrice, buyPrice, quantity);
    }

    // Use split adjustment utility
    const splitAdjustedPL = calculateSplitAdjustedPL(
        sellPrice,
        buyPrice,
        quantity,
        sellDate,
        buyDate,
        splits
    );

    return splitAdjustedPL.adjustedPL;
}

/**
 * Original calculateTotalRealizedSwingPL function (preserved for backward compatibility)
 */
export function calculateTotalRealizedSwingPLLegacy(
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

/**
 * Calculates the percentage difference between current price and STP target price.
 * Shows how close the current price is to reaching the STP target.
 * Formula: (currentPrice - stpValue) / stpValue * 100
 * @param currentPrice - The current stock price
 * @param stpValue - The stop take profit target price
 * @returns The percentage difference from STP target, or null if invalid inputs
 * 
 * @example
 * calculatePercentToStp(230, 243.80) // Returns -5.66 (current price below STP)
 * calculatePercentToStp(243.80, 243.80) // Returns 0 (current price at STP)
 * calculatePercentToStp(260, 243.80) // Returns 6.64 (current price above STP)
 */
export function calculatePercentToStp(
    currentPrice: number | null | undefined,
    stpValue: number | null | undefined
): number | null {
    // Validate inputs
    if (
        typeof currentPrice !== 'number' || 
        typeof stpValue !== 'number' || 
        isNaN(currentPrice) || 
        isNaN(stpValue) || 
        currentPrice <= 0 || 
        stpValue <= 0
    ) {
        return null;
    }

    // Calculate percentage difference from STP target
    // Formula: (currentPrice - stpValue) / stpValue * 100
    return (currentPrice - stpValue) / stpValue * 100;
}

/**
 * Calculates the HTP target price from buy price and HTP percentage.
 * Formula: buyPrice × (1 + htpPercentage/100) / (1 - commission/100)
 * This ensures you net exactly the target profit percentage after commission is deducted.
 * @param buyPrice - The original buy price
 * @param htpPercentage - The HTP percentage (e.g., 18 for 18%)
 * @param commissionPercentage - Optional commission percentage
 * @returns The HTP target price, or null if invalid inputs
 *
 * @example
 * calculateHtpTargetPrice(100, 18, 1) // Returns ~119.19 (nets 18% after 1% commission)
 * calculateHtpTargetPrice(240, 18) // Returns 283.20 (18% gain, no commission)
 */
export function calculateHtpTargetPrice(
    buyPrice: number | null | undefined,
    htpPercentage: number | null | undefined,
    commissionPercentage?: number | null | undefined
): number | null {
    // Validate inputs
    if (
        typeof buyPrice !== 'number' ||
        typeof htpPercentage !== 'number' ||
        isNaN(buyPrice) ||
        isNaN(htpPercentage) ||
        buyPrice <= 0 ||
        htpPercentage <= 0
    ) {
        return null;
    }

    // Calculate HTP target price from buy price (before commission adjustment)
    const htpTargetBeforeCommission = buyPrice * (1 + htpPercentage / 100);

    // Adjust for commission if provided (using division method to ensure net profit)
    if (typeof commissionPercentage === 'number' && commissionPercentage > 0) {
        const commissionRate = commissionPercentage / 100;

        // Prevent division by zero or negative values
        if (commissionRate >= 1) {
            console.warn(`Commission rate (${commissionPercentage}%) is too high for HTP calculation, using base target`);
            return htpTargetBeforeCommission;
        }

        // Commission-adjusted target: ensures you net exactly htpPercentage profit after commission
        return htpTargetBeforeCommission / (1 - commissionRate);
    }

    return htpTargetBeforeCommission;
}

/**
 * Calculates the percentage difference between current price and HTP target price.
 * Shows how close the current price is to reaching the HTP target.
 * Formula: (currentPrice - htpTargetPrice) / htpTargetPrice * 100
 * @param currentPrice - The current stock price
 * @param buyPrice - The original buy price
 * @param htpPercentage - The HTP percentage (e.g., 18 for 18%)
 * @param commissionPercentage - Optional commission percentage
 * @returns The percentage difference from HTP target, or null if invalid inputs
 * 
 * @example
 * calculatePercentToHtp(271.40, 230, 18, 3) // Returns 0 (current price at HTP)
 * calculatePercentToHtp(260, 240, 18) // Returns -8.20 (current price below HTP)
 * calculatePercentToHtp(300, 240, 18) // Returns 6.04 (current price above HTP)
 */
export function calculatePercentToHtp(
    currentPrice: number | null | undefined,
    buyPrice: number | null | undefined,
    htpPercentage: number | null | undefined,
    commissionPercentage?: number | null | undefined
): number | null {
    // Validate inputs
    if (
        typeof currentPrice !== 'number' || 
        typeof buyPrice !== 'number' ||
        typeof htpPercentage !== 'number' ||
        isNaN(currentPrice) || 
        isNaN(buyPrice) ||
        isNaN(htpPercentage) ||
        currentPrice <= 0 || 
        buyPrice <= 0 ||
        htpPercentage <= 0
    ) {
        return null;
    }

    // Calculate HTP target price
    const htpTargetPrice = calculateHtpTargetPrice(buyPrice, htpPercentage, commissionPercentage);
    
    if (!htpTargetPrice) {
        return null;
    }

    // Calculate percentage difference from HTP target
    // Formula: (currentPrice - htpTargetPrice) / htpTargetPrice * 100
    return (currentPrice - htpTargetPrice) / htpTargetPrice * 100;
}