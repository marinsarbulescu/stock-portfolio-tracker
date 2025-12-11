import { calculateProfitPercent, calculateTakeProfit } from '../calculations';

describe('calculateProfitPercent', () => {
  it('should calculate positive profit correctly', () => {
    expect(calculateProfitPercent(100, 120)).toBe(20);
  });

  it('should calculate negative profit (loss) correctly', () => {
    expect(calculateProfitPercent(100, 80)).toBe(-20);
  });

  it('should return 0 when prices are equal', () => {
    expect(calculateProfitPercent(100, 100)).toBe(0);
  });

  it('should handle decimal prices', () => {
    expect(calculateProfitPercent(10.5, 12.6)).toBeCloseTo(20, 1);
  });
});

describe('calculateTakeProfit', () => {
  it('should calculate take profit price with 9% target', () => {
    expect(calculateTakeProfit(100, 9)).toBeCloseTo(109, 2);
  });

  it('should calculate take profit price with decimal buy price', () => {
    expect(calculateTakeProfit(50.5, 10)).toBeCloseTo(55.55, 2);
  });
});
