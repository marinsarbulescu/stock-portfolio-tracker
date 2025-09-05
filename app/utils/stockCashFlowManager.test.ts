// app/utils/stockCashFlowManager.test.ts
// Test the cash flow calculation logic for Dividend and SLP transactions

import { calculateNewCashFlowState, type StockCashFlowState, type TransactionCashFlowInput } from './stockCashFlowManager';

describe('Stock Cash Flow Manager - Dividend and SLP', () => {
  const initialState: StockCashFlowState = {
    totalOutOfPocket: 1000,
    currentCashBalance: 100
  };

  describe('Dividend transactions', () => {
    test('should increase cash balance without affecting out-of-pocket', () => {
      const dividendTransaction: TransactionCashFlowInput = {
        action: 'Div',
        dividendAmount: 50
      };

      const result = calculateNewCashFlowState(initialState, dividendTransaction);

      expect(result.totalOutOfPocket).toBe(1000); // Unchanged
      expect(result.currentCashBalance).toBe(150); // +50
    });

    test('should handle zero dividend amount', () => {
      const dividendTransaction: TransactionCashFlowInput = {
        action: 'Div',
        dividendAmount: 0
      };

      const result = calculateNewCashFlowState(initialState, dividendTransaction);

      expect(result.totalOutOfPocket).toBe(1000); // Unchanged
      expect(result.currentCashBalance).toBe(100); // Unchanged
    });
  });

  describe('SLP transactions', () => {
    test('should increase cash balance without affecting out-of-pocket', () => {
      const slpTransaction: TransactionCashFlowInput = {
        action: 'SLP',
        dividendAmount: 25
      };

      const result = calculateNewCashFlowState(initialState, slpTransaction);

      expect(result.totalOutOfPocket).toBe(1000); // Unchanged
      expect(result.currentCashBalance).toBe(125); // +25
    });

    test('should handle large SLP payment', () => {
      const slpTransaction: TransactionCashFlowInput = {
        action: 'SLP',
        dividendAmount: 500
      };

      const result = calculateNewCashFlowState(initialState, slpTransaction);

      expect(result.totalOutOfPocket).toBe(1000); // Unchanged
      expect(result.currentCashBalance).toBe(600); // +500
    });
  });

  describe('Combined scenarios', () => {
    test('should handle multiple dividend and SLP transactions', () => {
      let state = initialState;

      // First dividend
      state = calculateNewCashFlowState(state, {
        action: 'Div',
        dividendAmount: 30
      });
      expect(state.currentCashBalance).toBe(130);
      expect(state.totalOutOfPocket).toBe(1000);

      // Then SLP
      state = calculateNewCashFlowState(state, {
        action: 'SLP',
        dividendAmount: 20
      });
      expect(state.currentCashBalance).toBe(150);
      expect(state.totalOutOfPocket).toBe(1000);

      // Then a Buy transaction using the dividend/SLP cash
      state = calculateNewCashFlowState(state, {
        action: 'Buy',
        investmentAmount: 140
      });
      expect(state.currentCashBalance).toBe(10); // 150 - 140
      expect(state.totalOutOfPocket).toBe(1000); // No additional OOP needed
    });

    test('should improve ROIC when dividends received', () => {
      const stateWithDividend = calculateNewCashFlowState(initialState, {
        action: 'Div',
        dividendAmount: 50
      });

      // ROIC = (currentCashBalance / totalOutOfPocket) * 100
      const originalROIC = (initialState.currentCashBalance / initialState.totalOutOfPocket) * 100; // 10%
      const newROIC = (stateWithDividend.currentCashBalance / stateWithDividend.totalOutOfPocket) * 100; // 15%

      expect(newROIC).toBeGreaterThan(originalROIC);
      expect(newROIC).toBe(15); // (150 / 1000) * 100
    });
  });

  describe('Edge cases', () => {
    test('should handle missing dividendAmount', () => {
      const transaction: TransactionCashFlowInput = {
        action: 'Div'
        // No dividendAmount provided
      };

      const result = calculateNewCashFlowState(initialState, transaction);

      expect(result.totalOutOfPocket).toBe(1000); // Unchanged
      expect(result.currentCashBalance).toBe(100); // Unchanged
    });

    test('should ensure non-negative values', () => {
      const negativeState: StockCashFlowState = {
        totalOutOfPocket: -100,
        currentCashBalance: -50
      };

      const result = calculateNewCashFlowState(negativeState, {
        action: 'Div',
        dividendAmount: 25
      });

      expect(result.totalOutOfPocket).toBe(0); // Forced to non-negative
      expect(result.currentCashBalance).toBe(0); // -50 + 25 = -25, forced to 0
    });
  });
});
