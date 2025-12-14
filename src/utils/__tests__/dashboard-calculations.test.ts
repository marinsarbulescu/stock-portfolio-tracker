import {
  calculatePullbackPercent,
  isPullbackTriggered,
  calculateDaysSince,
  getDaysSinceColor,
  calculatePctToTarget,
  getPct2PTColor,
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
