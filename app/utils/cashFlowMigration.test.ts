// app/utils/cashFlowMigration.test.ts
// Test the migration script with Dividend and SLP transactions

import { migrateStockCashFlow } from './cashFlowMigration';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';

// Mock the AWS Amplify client
jest.mock('aws-amplify/data');

type MockClient = ReturnType<typeof generateClient<Schema>>;

const mockClient = {
  models: {
    PortfolioStock: {
      get: jest.fn(),
      update: jest.fn()
    },
    Transaction: {
      list: jest.fn()
    }
  }
} as unknown as MockClient;

(generateClient as jest.Mock).mockReturnValue(mockClient);

describe('Cash Flow Migration - Dividend and SLP', () => {
  const stockId = 'test-stock-id';
  const stockSymbol = 'AAPL';

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock stock data
    (mockClient.models.PortfolioStock.get as jest.Mock).mockResolvedValue({
      data: { symbol: stockSymbol }
    });

    // Mock successful update
    (mockClient.models.PortfolioStock.update as jest.Mock).mockResolvedValue({
      errors: null
    });
  });

  test('should handle Buy, Dividend, and SLP transactions chronologically', async () => {
    // Mock transactions with mixed types
    const mockTransactions = [
      {
        date: '2024-01-01',
        createdAt: '2024-01-01T10:00:00Z',
        action: 'Buy',
        price: 100,
        quantity: 10
      },
      {
        date: '2024-01-15',
        createdAt: '2024-01-15T10:00:00Z',
        action: 'Div',
        amount: 25
      },
      {
        date: '2024-02-01',
        createdAt: '2024-02-01T10:00:00Z',
        action: 'SLP',
        amount: 15
      },
      {
        date: '2024-02-15',
        createdAt: '2024-02-15T10:00:00Z',
        action: 'Buy',
        price: 105,
        quantity: 5
      }
    ];

    (mockClient.models.Transaction.list as jest.Mock).mockResolvedValue({
      data: mockTransactions,
      errors: null
    });

    const result = await migrateStockCashFlow(mockClient, stockId);

    expect(result.success).toBe(true);
    expect(result.transactionsProcessed).toBe(4);
    
    // Verify cash flow calculation:
    // Buy 1: $1000 out-of-pocket, $0 cash balance
    // Div: $1000 out-of-pocket, $25 cash balance
    // SLP: $1000 out-of-pocket, $40 cash balance
    // Buy 2: $525 investment, uses $40 cash + $485 additional OOP
    expect(result.calculatedOOP).toBe(1485); // 1000 + 485
    expect(result.calculatedCashBalance).toBe(0); // Used all cash for second buy

    // Verify database update was called with correct values
    expect(mockClient.models.PortfolioStock.update).toHaveBeenCalledWith({
      id: stockId,
      totalOutOfPocket: 1485,
      currentCashBalance: 0
    });
  });

  test('should handle only dividend transactions', async () => {
    const mockTransactions = [
      {
        date: '2024-01-01',
        createdAt: '2024-01-01T10:00:00Z',
        action: 'Div',
        amount: 50
      },
      {
        date: '2024-02-01',
        createdAt: '2024-02-01T10:00:00Z',
        action: 'Div',
        amount: 30
      }
    ];

    (mockClient.models.Transaction.list as jest.Mock).mockResolvedValue({
      data: mockTransactions,
      errors: null
    });

    const result = await migrateStockCashFlow(mockClient, stockId);

    expect(result.success).toBe(true);
    expect(result.transactionsProcessed).toBe(2);
    expect(result.calculatedOOP).toBe(0); // No investment made
    expect(result.calculatedCashBalance).toBe(80); // 50 + 30
  });

  test('should handle dividend improving ROIC scenario', async () => {
    const mockTransactions = [
      {
        date: '2024-01-01',
        createdAt: '2024-01-01T10:00:00Z',
        action: 'Buy',
        price: 100,
        quantity: 10 // $1000 investment
      },
      {
        date: '2024-01-15',
        createdAt: '2024-01-15T10:00:00Z',
        action: 'Div',
        amount: 100 // 10% dividend return
      }
    ];

    (mockClient.models.Transaction.list as jest.Mock).mockResolvedValue({
      data: mockTransactions,
      errors: null
    });

    const result = await migrateStockCashFlow(mockClient, stockId);

    expect(result.success).toBe(true);
    expect(result.calculatedOOP).toBe(1000);
    expect(result.calculatedCashBalance).toBe(100);
    
    // ROIC would be (100 / 1000) * 100 = 10%
    const roic = (result.calculatedCashBalance / result.calculatedOOP) * 100;
    expect(roic).toBe(10);
  });

  test('should ignore transactions with missing amount for Div/SLP', async () => {
    const mockTransactions = [
      {
        date: '2024-01-01',
        createdAt: '2024-01-01T10:00:00Z',
        action: 'Div'
        // Missing amount field
      },
      {
        date: '2024-01-02',
        createdAt: '2024-01-02T10:00:00Z',
        action: 'SLP',
        amount: null
      }
    ];

    (mockClient.models.Transaction.list as jest.Mock).mockResolvedValue({
      data: mockTransactions,
      errors: null
    });

    const result = await migrateStockCashFlow(mockClient, stockId);

    expect(result.success).toBe(true);
    expect(result.transactionsProcessed).toBe(0); // No valid transactions processed
    expect(result.calculatedOOP).toBe(0);
    expect(result.calculatedCashBalance).toBe(0);
  });
});
