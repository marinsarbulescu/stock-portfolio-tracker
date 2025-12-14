import {
  calculatePullbackPercent,
  isPullbackTriggered,
  calculateDaysSince,
  getDaysSinceColor,
  calculatePctToTarget,
  getPct2PTColor,
  calculate5DPullback,
  HistoricalClose,
} from "../dashboard-calculations";

describe("calculatePullbackPercent", () => {
  it("should return null when currentPrice is null", () => {
    expect(calculatePullbackPercent(null, 100)).toBeNull();
  });

  it("should return null when lastBuyPrice is null", () => {
    expect(calculatePullbackPercent(100, null)).toBeNull();
  });

  it("should return null when lastBuyPrice is 0", () => {
    expect(calculatePullbackPercent(100, 0)).toBeNull();
  });

  it("should calculate negative percentage for price drop", () => {
    // Price dropped from 100 to 95 = -5%
    expect(calculatePullbackPercent(95, 100)).toBeCloseTo(-5, 2);
  });

  it("should calculate positive percentage for price increase", () => {
    // Price rose from 100 to 110 = +10%
    expect(calculatePullbackPercent(110, 100)).toBeCloseTo(10, 2);
  });

  it("should return 0 when prices are equal", () => {
    expect(calculatePullbackPercent(100, 100)).toBeCloseTo(0, 2);
  });
});

describe("isPullbackTriggered", () => {
  it("should return true when pullback equals negative entryTargetPercent", () => {
    // ET is 5 (stored as positive), pullback is -5%
    expect(isPullbackTriggered(-5, 5)).toBe(true);
  });

  it("should return true when pullback exceeds negative entryTargetPercent", () => {
    // ET is 5%, pullback is -6% (more severe)
    expect(isPullbackTriggered(-6, 5)).toBe(true);
  });

  it("should return false when pullback is less than negative entryTargetPercent", () => {
    // ET is 5%, pullback is only -4%
    expect(isPullbackTriggered(-4, 5)).toBe(false);
  });

  it("should return false when pullback is positive", () => {
    expect(isPullbackTriggered(5, 5)).toBe(false);
  });

  it("should return false when pullback is 0", () => {
    expect(isPullbackTriggered(0, 5)).toBe(false);
  });

  it("should return false when pullbackPercent is null", () => {
    expect(isPullbackTriggered(null, 5)).toBe(false);
  });

  it("should return false when entryTargetPercent is null", () => {
    expect(isPullbackTriggered(-5, null)).toBe(false);
  });
});

describe("calculateDaysSince", () => {
  it("should return null when date is null", () => {
    expect(calculateDaysSince(null)).toBeNull();
  });

  it("should return 0 for today", () => {
    const today = new Date().toISOString();
    expect(calculateDaysSince(today)).toBe(0);
  });

  it("should calculate days correctly for past dates", () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    expect(calculateDaysSince(thirtyDaysAgo.toISOString())).toBe(30);
  });

  it("should handle dates in the past year", () => {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const days = calculateDaysSince(oneYearAgo.toISOString());
    expect(days).toBeGreaterThanOrEqual(365);
  });
});

describe("getDaysSinceColor", () => {
  it("should return default for null", () => {
    expect(getDaysSinceColor(null)).toBe("default");
  });

  it("should return default for 0 days", () => {
    expect(getDaysSinceColor(0)).toBe("default");
  });

  it("should return default for 24 days", () => {
    expect(getDaysSinceColor(24)).toBe("default");
  });

  it("should return yellow for 25 days", () => {
    expect(getDaysSinceColor(25)).toBe("yellow");
  });

  it("should return yellow for 30 days", () => {
    expect(getDaysSinceColor(30)).toBe("yellow");
  });

  it("should return red for 31 days", () => {
    expect(getDaysSinceColor(31)).toBe("red");
  });

  it("should return red for 100 days", () => {
    expect(getDaysSinceColor(100)).toBe("red");
  });
});

describe("calculatePctToTarget", () => {
  it("should return null when currentPrice is null", () => {
    expect(calculatePctToTarget(null, 100)).toBeNull();
  });

  it("should return null when targetPrice is null", () => {
    expect(calculatePctToTarget(100, null)).toBeNull();
  });

  it("should return null when targetPrice is 0", () => {
    expect(calculatePctToTarget(100, 0)).toBeNull();
  });

  it("should return negative when below target", () => {
    // Current 95, target 100 = -5%
    expect(calculatePctToTarget(95, 100)).toBeCloseTo(-5, 2);
  });

  it("should return 0 when at target", () => {
    expect(calculatePctToTarget(100, 100)).toBeCloseTo(0, 2);
  });

  it("should return positive when above target", () => {
    // Current 110, target 100 = +10%
    expect(calculatePctToTarget(110, 100)).toBeCloseTo(10, 2);
  });
});

describe("getPct2PTColor", () => {
  it("should return default for null", () => {
    expect(getPct2PTColor(null)).toBe("default");
  });

  it("should return green for 0%", () => {
    expect(getPct2PTColor(0)).toBe("green");
  });

  it("should return green for positive values", () => {
    expect(getPct2PTColor(5)).toBe("green");
    expect(getPct2PTColor(0.01)).toBe("green");
  });

  it("should return yellow for -0.01%", () => {
    expect(getPct2PTColor(-0.01)).toBe("yellow");
  });

  it("should return yellow for -0.5%", () => {
    expect(getPct2PTColor(-0.5)).toBe("yellow");
  });

  it("should return yellow for -1%", () => {
    expect(getPct2PTColor(-1)).toBe("yellow");
  });

  it("should return default for -1.01%", () => {
    expect(getPct2PTColor(-1.01)).toBe("default");
  });

  it("should return default for -5%", () => {
    expect(getPct2PTColor(-5)).toBe("default");
  });
});

describe("calculate5DPullback", () => {
  // Helper to create historical closes
  const makeCloses = (closes: number[]): HistoricalClose[] => {
    // Creates closes for the last N days in descending date order
    return closes.map((close, i) => ({
      date: new Date(Date.now() - (i + 1) * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
      close,
    }));
  };

  it("should return null when effective price is null", () => {
    const closes = makeCloses([100, 101, 102, 103, 104]);
    expect(calculate5DPullback(null, closes, 5)).toBeNull();
  });

  it("should return null when historical closes is empty", () => {
    expect(calculate5DPullback(95, [], 5)).toBeNull();
  });

  it("should return null when historical closes is null/undefined", () => {
    expect(calculate5DPullback(95, null as unknown as HistoricalClose[], 5)).toBeNull();
  });

  it("should return null when entry target is null", () => {
    const closes = makeCloses([100, 101, 102, 103, 104]);
    expect(calculate5DPullback(95, closes, null)).toBeNull();
  });

  it("should return null when no closes meet the threshold", () => {
    // Effective price 95, closes all at 99 = -4.04% dip (doesn't meet -5% threshold)
    const closes = makeCloses([99, 99, 99, 99, 99]);
    expect(calculate5DPullback(95, closes, 5)).toBeNull();
  });

  it("should return the dip from highest close among hits", () => {
    // Effective price $95, ET -5%
    // Day -1: $95 → 0% → No hit
    // Day -2: $102 → -6.86% → Hit (highest close!)
    // Day -3: $98 → -3.06% → No hit
    // Day -4: $101 → -5.94% → Hit
    // Day -5: $99 → -4.04% → No hit
    const closes = makeCloses([95, 102, 98, 101, 99]);
    const result = calculate5DPullback(95, closes, 5);
    // Expected: (95 - 102) / 102 * 100 = -6.86%
    expect(result).toBeCloseTo(-6.86, 2);
  });

  it("should use only the last 5 closes even if more provided", () => {
    // 7 closes provided, but should only use last 5
    // Closes in date order (newest first): 95, 102, 98, 101, 99, 110, 115
    // Only last 5: 95, 102, 98, 101, 99
    // The 110 and 115 should be ignored
    const closes = makeCloses([95, 102, 98, 101, 99, 110, 115]);
    const result = calculate5DPullback(95, closes, 5);
    // Should be same as previous test: -6.86%
    expect(result).toBeCloseTo(-6.86, 2);
  });

  it("should work with a single hit", () => {
    // Only one close meets threshold
    const closes = makeCloses([98, 98, 105, 98, 98]);
    // Effective 95, closes at 98 give -3.06% (no hit), close at 105 gives -9.52% (hit)
    const result = calculate5DPullback(95, closes, 5);
    // Expected: (95 - 105) / 105 * 100 = -9.52%
    expect(result).toBeCloseTo(-9.52, 2);
  });

  it("should handle when all closes are hits", () => {
    // All closes meet threshold, should return dip from highest
    const closes = makeCloses([110, 108, 106, 104, 102]);
    // Effective 95, ET 5%
    // Dips: -13.64%, -12.04%, -10.38%, -8.65%, -6.86%
    // All meet -5% threshold, highest close is 110
    const result = calculate5DPullback(95, closes, 5);
    // Expected: (95 - 110) / 110 * 100 = -13.64%
    expect(result).toBeCloseTo(-13.64, 2);
  });

  it("should handle entry target as absolute value", () => {
    // ET stored as positive 5 (meaning -5% threshold)
    const closes = makeCloses([100, 101, 102]);
    const result = calculate5DPullback(95, closes, 5);
    // 95 vs 102 = -6.86% (meets -5%)
    expect(result).toBeCloseTo(-6.86, 2);
  });

  it("should skip closes with zero value", () => {
    // One close is 0 (invalid data), should skip it
    const closes = makeCloses([99, 0, 105, 98, 97]);
    // Effective 95, only 105 gives -9.52% hit
    const result = calculate5DPullback(95, closes, 5);
    expect(result).toBeCloseTo(-9.52, 2);
  });

  it("should return exact threshold hit", () => {
    // Price exactly at -5% threshold
    // If close is 100 and effective is 95, dip = -5% exactly
    const closes = makeCloses([100]);
    const result = calculate5DPullback(95, closes, 5);
    expect(result).toBeCloseTo(-5, 2);
  });
});
