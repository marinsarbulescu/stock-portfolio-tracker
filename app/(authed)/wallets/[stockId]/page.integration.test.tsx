// app/(authed)/wallets/[stockId]/page.integration.test.tsx
import React from 'react';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom'; // For matchers like toBeInTheDocument, toHaveTextContent

// --- Component Under Test ---
// Assuming the test file is in the same directory as page.tsx
import StockWalletPage from './page';

// --- Mocking Dependencies ---

// 1. Mock next/navigation
// Note: If your page *only* uses useParams, this is enough. If it uses useRouter, etc., mock those too.
jest.mock('next/navigation', () => ({
    useParams: jest.fn(() => ({ stockId: 'test-stock-id-123' })),
    // Add other mocks if needed: useRouter: jest.fn(() => ({ push: jest.fn() }))
}));

// 3. Mock PriceContext
// Adjust the path to where your PriceContext is defined
jest.mock('@/app/contexts/PriceContext', () => ({
    usePrices: jest.fn(() => ({
        latestPrices: { TEST: { currentPrice: 150 } }, // Default mock price
        pricesLoading: false,
        pricesError: null,
        fetchPrices: jest.fn(),
        lastPriceFetchTimestamp: Date.now(),
    })),
}));

// ---> Import the MOCKS from the actual module path <---
// Jest automatically uses __mocks__/aws-amplify/data.ts
// @ts-ignore
import { __testMocks as amplifyDataMocks } from 'aws-amplify/data';
// Destructure the mock functions we exported in __testMocks
const { mockTransactionList, mockStockWalletList, mockPortfolioStockGet } = amplifyDataMocks;
// --- End Import ---

// 4. (No need to mock '@/app/utils/financialCalculations' - we want the real ones)

// --- Test Suite ---

describe('StockWalletPage - Integration Tests', () => {
    beforeEach(() => {
        // Reset mock function implementations (not the objects themselves)
        mockTransactionList?.mockClear(); // Add '?' safety check initially if needed
        mockStockWalletList?.mockClear();
        mockPortfolioStockGet?.mockClear();
        // Apply default return values for mocks if needed for the suite
        require('next/navigation').useParams.mockReturnValue({ stockId: 'test-stock-id-123' });
        (require('@/app/contexts/PriceContext').usePrices as jest.Mock).mockReturnValue({
            latestPrices: { TEST: { currentPrice: 150 } },
            pricesLoading: false, pricesError: null, fetchPrices: jest.fn(), lastPriceFetchTimestamp: Date.now(),
        });
    });

    // --- Test Case for Realized Swing P/L ---
    test('should correctly calculate and display Realized Swing P/L in the Overview section', async () => {
        // Arrange: Define mock data for this scenario

        // Stock details needed by the page's useEffect
        const mockStockDetails = {
            id: 'test-stock-id-123',
            symbol: 'TEST',
            name: 'Test Stock Inc.',
            budget: 10000,
            pdp: 5,
            plr: 2,
            swingHoldRatio: 50,
            owner: 'test-owner'
            // Add any other fields required by the PortfolioStock type if necessary
        };

        // Wallets needed for the plStats hook to find buy prices
        const mockWallets = [
            { id: 'wallet-swing-1', portfolioStockId: 'test-stock-id-123', walletType: 'Swing', buyPrice: 100, totalSharesQty: 10, totalInvestment: 1000, sharesSold: 5, remainingShares: 5, realizedPl: 0, realizedPlPercent: 0, tpValue: 110, tpPercent: 10, sellTxnCount: 2, owner: 'test-owner', createdAt: '2023-01-01T10:00:00Z', updatedAt: '2023-03-01T10:00:00Z' },
            { id: 'wallet-hold-1', portfolioStockId: 'test-stock-id-123', walletType: 'Hold', buyPrice: 90, totalSharesQty: 5, totalInvestment: 450, sharesSold: 1, remainingShares: 4, realizedPl: 0, realizedPlPercent: 0, tpValue: 99, tpPercent: 10, sellTxnCount: 1, owner: 'test-owner', createdAt: '2023-01-01T10:00:00Z', updatedAt: '2023-04-01T10:00:00Z' },
            // Add fields like createdAt/updatedAt if your StockWalletDataType strictly requires them
        ];

        // Transactions used by the plStats hook
        const mockTransactions = [
            // Swing Sale 1: (110 - 100) * 3 = +30 P/L
            { id: 'txn-sell-swing-1', action: 'Sell', date: '2023-02-01', price: 110, quantity: 3, txnType: 'Swing', completedTxnId: 'wallet-swing-1', portfolioStockId: 'test-stock-id-123', owner: 'test-owner', txnProfit: 30, txnProfitPercent: 10, createdAt: '2023-02-01T10:00:00Z', updatedAt: '2023-02-01T10:00:00Z' },
            // Swing Sale 2: (95 - 100) * 2 = -10 P/L
            { id: 'txn-sell-swing-2', action: 'Sell', date: '2023-03-01', price: 95, quantity: 2, txnType: 'Swing', completedTxnId: 'wallet-swing-1', portfolioStockId: 'test-stock-id-123', owner: 'test-owner', txnProfit: -10, txnProfitPercent: -5, createdAt: '2023-03-01T10:00:00Z', updatedAt: '2023-03-01T10:00:00Z' },
            // Hold Sale (should be ignored for Swing P/L)
            { id: 'txn-sell-hold-1', action: 'Sell', date: '2023-04-01', price: 100, quantity: 1, txnType: 'Hold', completedTxnId: 'wallet-hold-1', portfolioStockId: 'test-stock-id-123', owner: 'test-owner', txnProfit: 10, txnProfitPercent: 11.11, createdAt: '2023-04-01T10:00:00Z', updatedAt: '2023-04-01T10:00:00Z' },
            // Add Buy transactions if plStats actually uses them directly (usually only needs wallets for realized P/L)
             { id: 'txn-buy-1', action: 'Buy', date: '2023-01-01', price: 100, quantity: 10, investment: 1000, txnType: 'Split', swingShares: 5, holdShares: 5, portfolioStockId: 'test-stock-id-123', owner: 'test-owner', createdAt: '2023-01-01T10:00:00Z', updatedAt: '2023-01-01T10:00:00Z' }
        ];

        // Expected Result: Realized Swing P/L = 30 - 10 = 20. Formatted = "$20.00"
        const expectedFormattedSwingPL = '$20.00';

        // Setup mock return values for the DataStore calls
        mockPortfolioStockGet.mockResolvedValue({ data: mockStockDetails, errors: null });
        mockStockWalletList.mockResolvedValue({ data: mockWallets, errors: null });
        // For Transaction.list, ensure pagination is handled if your component does it,
        // otherwise just return all data with nextToken: null
        mockTransactionList.mockResolvedValue({ data: mockTransactions, errors: null, nextToken: null });


        // Act: Render the component
        render(<StockWalletPage />);

        const user = userEvent.setup();

        // Assert: Wait for the component to fetch data (mocks), calculate, and render.
        // Then find the element displaying the Swing P/L and check its content.

        // Option 1: Using data-testid (Recommended if you add them)
        // Assuming <span data-testid="overview-realized-swing-pl-dollars">...</span>
        // const swingPlElement = await screen.findByTestId('overview-realized-swing-pl-dollars');
        // expect(swingPlElement).toHaveTextContent(expectedFormattedSwingPL);

        // Option 2: Querying by text content (More brittle - adjust based on your actual UI)
        // Wait for a known element in the overview to appear first
        await screen.findByRole('button', { name: /add buy transaction/i }); // Wait for page load indicator

        // ---> Find and Click the Overview Header <---
        // Find the paragraph element containing only the text "Overview" (use regex for exact match)
        const overviewHeader = await screen.findByText(/^Overview$/);
        await user.click(overviewHeader);
        // ---> End Click Simulation <---

        await screen.findByText('Realized P/L'); // Wait for the relevant section header

        // Assert: Wait for the component and find elements by data-testid
        await waitFor(async () => {
            const swingPlElement = await screen.findByTestId('overview-realized-swing-pl-dollars');
            expect(swingPlElement).toHaveTextContent(expectedFormattedSwingPL);
        });

        // Now find the specific element - this query might need adjustment!
        // It looks for the exact formatted text $20.00 within the document.
        // A better query might find the "Swing" label first and look nearby.
        const swingPlElement = await screen.findByText(expectedFormattedSwingPL);
        expect(swingPlElement).toBeInTheDocument();

        // You might also want to check the percentage if that's important
        // const expectedFormattedSwingPercent = '(1.96%)'; // Example: Calculate based on cost basis
        // const swingPercentElement = await screen.findByText(expectedFormattedSwingPercent);
        // expect(swingPercentElement).toBeInTheDocument();

    });

    // Add other integration test cases here later...
    // - Test Realized Hold P/L display
    // - Test Unrealized P/L display (requires mocking usePrices with specific latestPrices)
    // - Test Total P/L display
    // - Test interactions like clicking Sell, filling modal, verifying update calls (more complex)

});