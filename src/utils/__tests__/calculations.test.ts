import { calculateProfitPercent, calculateProfitTargetPrice } from '../calculations';

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

describe('calculateProfitTargetPrice', () => {
  it('should calculate profit target price with 9% target', () => {
    expect(calculateProfitTargetPrice(100, 9)).toBeCloseTo(109, 2);
  });

  it('should calculate profit target price with decimal buy price', () => {
    expect(calculateProfitTargetPrice(50.5, 10)).toBeCloseTo(55.55, 2);
  });
});
