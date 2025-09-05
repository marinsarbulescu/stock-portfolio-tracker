// app/utils/stockCashFlowManager.ts
// Separate component for managing stock-level OOP and $ Balance calculations
// This can be easily removed or modified without affecting other parts of the codebase

import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';

type AmplifyClient = ReturnType<typeof generateClient<Schema>>;

export interface StockCashFlowState {
  totalOutOfPocket: number;
  currentCashBalance: number;
}

export interface TransactionCashFlowInput {
  action: 'Buy' | 'Sell' | 'Div' | 'SLP' | 'StockSplit';
  investmentAmount?: number; // For Buy transactions
  saleProceeds?: number;     // For Sell transactions
  dividendAmount?: number;   // For Div and SLP transactions
}

/**
 * Calculate new stock-level OOP and $ Balance based on a transaction
 * Following the simplified business rules:
 * - OOP never decreases, only goes up
 * - Buy: If investment > cash balance, add difference to OOP
 * - Sell: Always add proceeds to cash balance
 */
export function calculateNewCashFlowState(
  currentState: StockCashFlowState,
  transaction: TransactionCashFlowInput
): StockCashFlowState {
  let newTotalOOP = currentState.totalOutOfPocket;
  let newCashBalance = currentState.currentCashBalance;

  if (transaction.action === 'Buy' && typeof transaction.investmentAmount === 'number') {
    const investmentNeeded = transaction.investmentAmount;
    
    if (newCashBalance >= investmentNeeded) {
      // Can fund from existing cash balance - OOP unchanged
      newCashBalance = newCashBalance - investmentNeeded;
      // newTotalOOP remains the same
    } else {
      // Need additional out-of-pocket cash
      const additionalOOP = investmentNeeded - newCashBalance;
      newTotalOOP = newTotalOOP + additionalOOP;
      newCashBalance = 0; // Used all available cash
    }
  } else if (transaction.action === 'Sell' && typeof transaction.saleProceeds === 'number') {
    // Add sale proceeds to cash balance
    if (transaction.saleProceeds >= 0) {
      newCashBalance = newCashBalance + transaction.saleProceeds;
    } else {
      // Handle negative proceeds (losses) - subtract from cash balance
      newCashBalance = newCashBalance - Math.abs(transaction.saleProceeds);
      // Ensure cash balance doesn't go negative
      newCashBalance = Math.max(0, newCashBalance);
    }
    // OOP remains unchanged for sell transactions
  } else if ((transaction.action === 'Div' || transaction.action === 'SLP') && 
             typeof transaction.dividendAmount === 'number') {
    // Dividend and SLP payments increase cash balance but do NOT affect out-of-pocket
    newCashBalance = newCashBalance + transaction.dividendAmount;
    // newTotalOOP remains unchanged (not an investment)
  }
  // For StockSplit, no cash flow impact (could be extended later)

  return {
    totalOutOfPocket: Math.max(0, newTotalOOP), // Ensure non-negative
    currentCashBalance: Math.max(0, newCashBalance) // Ensure non-negative
  };
}

/**
 * Update stock's cash flow totals in the database
 */
export async function updateStockCashFlow(
  client: AmplifyClient,
  stockId: string,
  newState: StockCashFlowState
): Promise<void> {
  const { errors: stockUpdateErrors } = await client.models.PortfolioStock.update({
    id: stockId,
    totalOutOfPocket: parseFloat(newState.totalOutOfPocket.toFixed(2)),
    currentCashBalance: parseFloat(newState.currentCashBalance.toFixed(2))
  });

  if (stockUpdateErrors) {
    console.error('Failed to update stock cash flow:', stockUpdateErrors);
    throw new Error('Failed to update stock cash flow totals');
  }
}

/**
 * Get current stock cash flow state from database
 */
export async function getCurrentStockCashFlowState(
  client: AmplifyClient,
  stockId: string
): Promise<StockCashFlowState> {
  const { data: currentStock } = await client.models.PortfolioStock.get(
    { id: stockId },
    { selectionSet: ['id', 'totalOutOfPocket', 'currentCashBalance'] }
  );

  if (!currentStock) {
    throw new Error(`Stock with ID ${stockId} not found`);
  }

  return {
    totalOutOfPocket: (currentStock as { totalOutOfPocket?: number }).totalOutOfPocket || 0,
    currentCashBalance: (currentStock as { currentCashBalance?: number }).currentCashBalance || 0
  };
}

/**
 * Complete cash flow update for a transaction (convenience function)
 * This combines getting current state, calculating new state, and updating database
 */
export async function processTransactionCashFlow(
  client: AmplifyClient,
  stockId: string,
  transaction: TransactionCashFlowInput
): Promise<StockCashFlowState> {
  try {
    // Get current state
    const currentState = await getCurrentStockCashFlowState(client, stockId);
    
    // Calculate new state
    const newState = calculateNewCashFlowState(currentState, transaction);
    
    // Update database
    await updateStockCashFlow(client, stockId, newState);
    
    return newState;
  } catch (error) {
    console.error('Error processing transaction cash flow:', error);
    throw error;
  }
}

/**
 * Determine if cash balance should be highlighted in red (for negative proceeds)
 */
export function shouldHighlightCashBalance(saleProceeds?: number): boolean {
  return typeof saleProceeds === 'number' && saleProceeds < 0;
}
