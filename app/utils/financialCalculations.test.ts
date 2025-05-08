// In: app/utils/financialCalculations.test.ts

import { calculateTotalRealizedSwingPL, calculateSingleSalePL /* if you want to mock it or just rely on its own tests */ } from './financialCalculations';
// Mock constants if they are not available in the test environment or set them up
// For simplicity here, let's assume CURRENCY_PRECISION is 2 for toFixed(2)

// Define simplified types if not already imported from the main file
interface MockTransaction {
    id: string;
    action: 'Buy' | 'Sell' | 'Div';
    txnType?: 'Swing' | 'Hold' | 'Split' | string | null;
    completedTxnId?: string | null;
    quantity?: number | null;
    price?: number | null;
}

interface MockWallet {
    id: string;
    buyPrice?: number | null;
}


describe('calculateTotalRealizedSwingPL', () => {
    const mockWallets: MockWallet[] = [
        { id: 'swingWallet1', buyPrice: 100 },
        { id: 'holdWallet1', buyPrice: 50 },
        { id: 'swingWallet2', buyPrice: 200 },
    ];

    test('should return 0 if there are no transactions', () => {
        expect(calculateTotalRealizedSwingPL([], mockWallets)).toBe(0.00);
    });

    test('should return 0 if there are no Sell transactions', () => {
        const transactions: MockTransaction[] = [
            { id: 't1', action: 'Buy', price: 100, quantity: 10 },
        ];
        expect(calculateTotalRealizedSwingPL(transactions, mockWallets)).toBe(0.00);
    });

    test('should return 0 if there are Sell transactions but no Swing type', () => {
        const transactions: MockTransaction[] = [
            { id: 't1', action: 'Sell', txnType: 'Hold', completedTxnId: 'holdWallet1', quantity: 5, price: 60 },
        ];
        expect(calculateTotalRealizedSwingPL(transactions, mockWallets)).toBe(0.00);
    });

    test('should correctly sum P/L from profitable Swing sales', () => {
        const transactions: MockTransaction[] = [
            // Swing P/L: (110 - 100) * 2 = 20
            { id: 't1', action: 'Sell', txnType: 'Swing', completedTxnId: 'swingWallet1', quantity: 2, price: 110 },
            // Swing P/L: (220 - 200) * 1 = 20
            { id: 't2', action: 'Sell', txnType: 'Swing', completedTxnId: 'swingWallet2', quantity: 1, price: 220 },
        ];
        // Expected: 20 + 20 = 40
        expect(calculateTotalRealizedSwingPL(transactions, mockWallets)).toBe(40.00);
    });

    test('should correctly sum P/L from losing Swing sales', () => {
        const transactions: MockTransaction[] = [
            // Swing P/L: (90 - 100) * 2 = -20
            { id: 't1', action: 'Sell', txnType: 'Swing', completedTxnId: 'swingWallet1', quantity: 2, price: 90 },
            // Swing P/L: (180 - 200) * 1 = -20
            { id: 't2', action: 'Sell', txnType: 'Swing', completedTxnId: 'swingWallet2', quantity: 1, price: 180 },
        ];
        // Expected: -20 + -20 = -40
        expect(calculateTotalRealizedSwingPL(transactions, mockWallets)).toBe(-40.00);
    });

    test('should correctly sum P/L from a mix of profitable and losing Swing sales', () => {
        const transactions: MockTransaction[] = [
            { id: 't1', action: 'Sell', txnType: 'Swing', completedTxnId: 'swingWallet1', quantity: 2, price: 110 }, // +20
            { id: 't2', action: 'Sell', txnType: 'Hold', completedTxnId: 'holdWallet1', quantity: 5, price: 60 },  // Ignored (+50 for Hold)
            { id: 't3', action: 'Sell', txnType: 'Swing', completedTxnId: 'swingWallet2', quantity: 1, price: 180 }, // -20
        ];
        // Expected Swing P/L: 20 - 20 = 0
        expect(calculateTotalRealizedSwingPL(transactions, mockWallets)).toBe(0.00);
    });

    test('should ignore Swing sales if completedTxnId is missing or not found in wallets', () => {
        const transactions: MockTransaction[] = [
            { id: 't1', action: 'Sell', txnType: 'Swing', completedTxnId: 'swingWallet1', quantity: 2, price: 110 }, // +20
            { id: 't2', action: 'Sell', txnType: 'Swing', completedTxnId: 'unknownWallet', quantity: 1, price: 250 },// Ignored
            { id: 't3', action: 'Sell', txnType: 'Swing', /* no completedTxnId */ quantity: 1, price: 250 },      // Ignored
        ];
        expect(calculateTotalRealizedSwingPL(transactions, mockWallets)).toBe(20.00);
    });

    test('should handle rounding correctly for the final sum', () => {
        const slightlyOffWallets: MockWallet[] = [{ id: 'w1', buyPrice: 10.12 }];
        const transactions: MockTransaction[] = [
            // P/L = (10.23 - 10.12) * 1 = 0.11
            { id: 't1', action: 'Sell', txnType: 'Swing', completedTxnId: 'w1', quantity: 1, price: 10.23 },
            // P/L = (10.345 - 10.12) * 1 = 0.225
            { id: 't2', action: 'Sell', txnType: 'Swing', completedTxnId: 'w1', quantity: 1, price: 10.345 },
        ];
        // Sum = 0.11 + 0.225 = 0.335. Rounded to 2 decimal places should be 0.34
        expect(calculateTotalRealizedSwingPL(transactions, slightlyOffWallets)).toBe(0.34);
    });
});