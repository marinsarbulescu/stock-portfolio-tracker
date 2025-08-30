// Test to verify TP precision fix for P/L calculations
// This test documents the $0.01 discrepancy issue and verifies the fix

describe('TP Precision and P/L Accuracy', () => {
    const buyPrice = 100;
    const quantity = 3;
    const commissionPercent = 10;
    const pdp = 3; // 3%
    const stp = 2; // 2x

    function calculateSingleSalePLWithCommission(sellPrice: number, buyPrice: number, quantity: number, commissionPercent: number): number {
        const grossPL = (sellPrice - buyPrice) * quantity;
        const saleValue = sellPrice * quantity;
        const commission = saleValue * (commissionPercent / 100);
        return grossPL - commission;
    }

    it('should demonstrate the precision issue with 2-decimal TP storage', () => {
        // Calculate exact TP using HTP formula
        const baseTP = buyPrice + (buyPrice * (pdp * stp / 100));
        const exactTP = baseTP / (1 - commissionPercent / 100);
        
        // Simulate old behavior: round TP to 2 decimal places
        const tpRounded2 = parseFloat(exactTP.toFixed(2));
        
        // Calculate P/L with rounded TP
        const pl = calculateSingleSalePLWithCommission(tpRounded2, buyPrice, quantity, commissionPercent);
        const plRounded = parseFloat(pl.toFixed(2));
        
        // Expected target profit
        const targetProfit = buyPrice * quantity * (pdp * stp / 100);
        
        // This should demonstrate the $0.01 discrepancy
        expect(exactTP).toBe(117.77777777777777);
        expect(tpRounded2).toBe(117.78);
        expect(plRounded).toBe(18.01); // Off by $0.01
        expect(targetProfit).toBe(18.00);
        expect(Math.abs(plRounded - targetProfit)).toBe(0.01);
    });

    it('should fix the precision issue with 4-decimal TP storage', () => {
        // Calculate exact TP using HTP formula
        const baseTP = buyPrice + (buyPrice * (pdp * stp / 100));
        const exactTP = baseTP / (1 - commissionPercent / 100);
        
        // Simulate new behavior: round TP to 4 decimal places
        const tpRounded4 = parseFloat(exactTP.toFixed(4));
        
        // Calculate P/L with higher precision TP
        const pl = calculateSingleSalePLWithCommission(tpRounded4, buyPrice, quantity, commissionPercent);
        const plRounded = parseFloat(pl.toFixed(2));
        
        // Expected target profit
        const targetProfit = buyPrice * quantity * (pdp * stp / 100);
        
        // This should demonstrate the fix
        expect(exactTP).toBe(117.77777777777777);
        expect(tpRounded4).toBe(117.7778);
        expect(plRounded).toBe(18.00); // Correct
        expect(targetProfit).toBe(18.00);
        expect(Math.abs(plRounded - targetProfit)).toBeLessThan(0.005); // Within rounding tolerance
    });

    it('should verify the exact math for the example scenario', () => {
        // Your specific scenario: $100 buy, $1000 budget, 30% SHR, 10% commission
        const investment = 1000 * 0.30; // $300
        const shares = investment / buyPrice; // 3 shares
        const exactTP = 117.77777777777777;
        
        // Verify exact P/L calculation
        const grossPL = (exactTP - buyPrice) * shares; // (117.7778 - 100) * 3 = 53.3333
        const saleValue = exactTP * shares; // 117.7778 * 3 = 353.3333
        const commission = saleValue * (commissionPercent / 100); // 353.3333 * 0.10 = 35.3333
        const netPL = grossPL - commission; // 53.3333 - 35.3333 = 18.0000
        
        expect(investment).toBe(300);
        expect(shares).toBe(3);
        expect(parseFloat(netPL.toFixed(2))).toBe(18.00);
    });
});
