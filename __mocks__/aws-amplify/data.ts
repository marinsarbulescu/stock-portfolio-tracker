// __mocks__/aws-amplify/data.ts
import { jest } from '@jest/globals';

// Create the mock functions for methods used across tests
const mockTransactionList = jest.fn();
const mockStockWalletList = jest.fn();
const mockPortfolioStockGet = jest.fn();
const mockPortfolioStockCreate = jest.fn(); // <-- Add mock for PortfolioStock.create
const mockPortfolioStockUpdate = jest.fn(); // <-- Add mock for PortfolioStock.update
// Add mocks for other models/methods if needed by AddStockForm tests

// Define the mock client structure using these functions
const mockClient = {
    models: {
        Transaction: { list: mockTransactionList },
        StockWallet: { list: mockStockWalletList },
        PortfolioStock: {
            get: mockPortfolioStockGet,
            create: mockPortfolioStockCreate, // <-- Add create mock
            update: mockPortfolioStockUpdate, // <-- Add update mock
            // Add other PortfolioStock methods if needed (e.g., list, delete)
        },
        // Add other models if needed
    },
};

// Export the mocked generateClient function
export const generateClient = jest.fn(() => mockClient);

// Export the mock functions themselves so tests can import and control them
export const __testMocks = {
    mockTransactionList,
    mockStockWalletList,
    mockPortfolioStockGet,
    mockPortfolioStockCreate, // <-- Export create mock
    mockPortfolioStockUpdate, // <-- Export update mock
};