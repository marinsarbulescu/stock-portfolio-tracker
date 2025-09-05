// app/utils/cashFlowMigration.ts
// Migration utility to retroactively calculate OOP, $ Balance, and ROIC for stocks

import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';
import { updateStockCashFlow, type StockCashFlowState } from './stockCashFlowManager';
import { CURRENCY_PRECISION, FETCH_LIMIT_TRANSACTIONS_STANDARD } from '@/app/config/constants';

type AmplifyClient = ReturnType<typeof generateClient<Schema>>;

export interface MigrationResult {
  success: boolean;
  stockId: string;
  stockSymbol: string;
  calculatedOOP: number;
  calculatedCashBalance: number;
  error?: string;
  transactionsProcessed: number;
  debugLog?: string[]; // Add debug information
}

/**
 * Retroactively calculate and update OOP and Cash Balance for a single stock
 * by processing all transactions in chronological order.
 * Always resets OOP and Cash Balance to 0 at start for clean recalculation.
 */
export async function migrateStockCashFlow(
  client: AmplifyClient,
  stockId: string
): Promise<MigrationResult> {
  try {
    // 1. Get stock information
    const { data: stock } = await client.models.PortfolioStock.get(
      { id: stockId },
      { selectionSet: ['id', 'symbol'] }
    );

    const stockData = stock as unknown as { symbol?: string };
    
    if (!stockData?.symbol) {
      return {
        success: false,
        stockId,
        stockSymbol: 'Unknown',
        calculatedOOP: 0,
        calculatedCashBalance: 0,
        error: 'Stock not found or missing symbol',
        transactionsProcessed: 0,
      };
    }

    const stockSymbol = stockData.symbol;

    // 2. Reset OOP and Cash Balance to 0 before migration
    await updateStockCashFlow(client, stockId, {
      totalOutOfPocket: 0,
      currentCashBalance: 0
    });

    console.log(`[Migration] Reset ${stockSymbol} cash flow metrics to 0 before recalculation`);

    // 3. Get all transactions for this stock with high limit for complete data
    const { data: transactions } = await client.models.Transaction.list({
      filter: {
        portfolioStockId: { eq: stockId }
      },
      limit: FETCH_LIMIT_TRANSACTIONS_STANDARD, // Use high limit to ensure all transactions are fetched
      selectionSet: [
        'id',
        'date',
        'action',
        'price',
        'quantity',
        'investment',
        'amount',
        'txnType',
        'createdAt'
      ]
    });

    if (!transactions) {
      return {
        success: false,
        stockId,
        stockSymbol: stockSymbol,
        calculatedOOP: 0,
        calculatedCashBalance: 0,
        error: 'Failed to fetch transactions',
        transactionsProcessed: 0,
      };
    }

    // 4. Sort transactions by date (chronological order), then by createdAt
    const sortedTransactions = [...transactions].sort((a, b) => {
      const dateA = a.date || '';
      const dateB = b.date || '';
      
      // Primary sort by date
      const dateComparison = dateA.localeCompare(dateB);
      if (dateComparison !== 0) return dateComparison;
      
      // Secondary sort by createdAt for same-date transactions
      const createdAtA = a.createdAt || '';
      const createdAtB = b.createdAt || '';
      return createdAtA.localeCompare(createdAtB);
    });

    // 5. Process transactions chronologically to calculate cash flow
    const currentState: StockCashFlowState = {
      totalOutOfPocket: 0,
      currentCashBalance: 0
    };

    let transactionsProcessed = 0;
    const debugLog: string[] = [];
    debugLog.push(`[RESET] Initializing ${stockSymbol} with OOP=$0, Balance=$0 for clean recalculation`);
    debugLog.push(`Starting migration for ${stockSymbol} with ${sortedTransactions.length} transactions`);

    for (const txn of sortedTransactions) {
      let transactionProcessed = false;
      const beforeState = { ...currentState };

      if (txn.action === 'Buy' && typeof txn.price === 'number' && typeof txn.quantity === 'number') {
        // Calculate investment needed as price * quantity
        const investmentNeeded = txn.price * txn.quantity;
        
        if (currentState.currentCashBalance >= investmentNeeded) {
          // Can fund from existing cash balance
          currentState.currentCashBalance -= investmentNeeded;
          debugLog.push(`${txn.date} (${txn.createdAt}) Buy: $${investmentNeeded} from cash balance. OOP: $${beforeState.totalOutOfPocket} → $${currentState.totalOutOfPocket}, Balance: $${beforeState.currentCashBalance} → $${currentState.currentCashBalance}`);
        } else {
          // Need additional out-of-pocket cash
          const additionalOOP = investmentNeeded - currentState.currentCashBalance;
          currentState.totalOutOfPocket += additionalOOP;
          currentState.currentCashBalance = 0;
          debugLog.push(`${txn.date} (${txn.createdAt}) Buy: $${investmentNeeded} needs $${additionalOOP} OOP. OOP: $${beforeState.totalOutOfPocket} → $${currentState.totalOutOfPocket}, Balance: $${beforeState.currentCashBalance} → $${currentState.currentCashBalance}`);
        }
        transactionProcessed = true;

      } else if (txn.action === 'Sell' && typeof txn.price === 'number' && typeof txn.quantity === 'number') {
        // Calculate sale proceeds
        const saleProceeds = txn.price * txn.quantity;
        currentState.currentCashBalance += saleProceeds;
        debugLog.push(`${txn.date} (${txn.createdAt}) Sell: +$${saleProceeds} to balance. OOP: $${beforeState.totalOutOfPocket} → $${currentState.totalOutOfPocket}, Balance: $${beforeState.currentCashBalance} → $${currentState.currentCashBalance}`);
        transactionProcessed = true;

      } else if ((txn.action === 'Div' || txn.action === 'SLP') && typeof txn.amount === 'number') {
        // Add dividend or SLP income to cash balance
        currentState.currentCashBalance += txn.amount;
        debugLog.push(`${txn.date} (${txn.createdAt}) ${txn.action}: +$${txn.amount} to balance. OOP: $${beforeState.totalOutOfPocket} → $${currentState.totalOutOfPocket}, Balance: $${beforeState.currentCashBalance} → $${currentState.currentCashBalance}`);
        transactionProcessed = true;
      }
      // Note: StockSplit transactions don't affect cash flow

      if (transactionProcessed) {
        transactionsProcessed++;
      }

      // Ensure values stay non-negative
      currentState.totalOutOfPocket = Math.max(0, currentState.totalOutOfPocket);
      currentState.currentCashBalance = Math.max(0, currentState.currentCashBalance);
    }

    // 6. Round to currency precision
    const finalOOP = parseFloat(currentState.totalOutOfPocket.toFixed(CURRENCY_PRECISION));
    const finalCashBalance = parseFloat(currentState.currentCashBalance.toFixed(CURRENCY_PRECISION));

    // 7. Update the stock in the database with final calculated values
    await updateStockCashFlow(client, stockId, {
      totalOutOfPocket: finalOOP,
      currentCashBalance: finalCashBalance
    });

    return {
      success: true,
      stockId,
      stockSymbol: stockSymbol,
      calculatedOOP: finalOOP,
      calculatedCashBalance: finalCashBalance,
      transactionsProcessed,
      debugLog,
    };

  } catch (error) {
    return {
      success: false,
      stockId,
      stockSymbol: 'Unknown',
      calculatedOOP: 0,
      calculatedCashBalance: 0,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      transactionsProcessed: 0,
    };
  }
}
