import { getEffectivePrice } from "../price-utils";

describe("getEffectivePrice", () => {
  it("should return fetched price when available", () => {
    const fetchedPrices = { AAPL: 150.5 };
    expect(getEffectivePrice("AAPL", fetchedPrices, 100)).toBe(150.5);
  });

  it("should return testPrice when no fetched price exists", () => {
    const fetchedPrices = {};
    expect(getEffectivePrice("AAPL", fetchedPrices, 100)).toBe(100);
  });

  it("should return testPrice when fetched price is null", () => {
    const fetchedPrices = { AAPL: null };
    expect(getEffectivePrice("AAPL", fetchedPrices, 100)).toBe(100);
  });

  it("should return null when both fetched price and testPrice are null", () => {
    const fetchedPrices = { AAPL: null };
    expect(getEffectivePrice("AAPL", fetchedPrices, null)).toBeNull();
  });

  it("should return null when no fetched price and testPrice is null", () => {
    const fetchedPrices = {};
    expect(getEffectivePrice("AAPL", fetchedPrices, null)).toBeNull();
  });

  it("should handle zero as a valid fetched price", () => {
    const fetchedPrices = { AAPL: 0 };
    // 0 is a valid price (edge case), should be used over testPrice
    expect(getEffectivePrice("AAPL", fetchedPrices, 100)).toBe(100);
  });

  it("should prioritize fetched price over testPrice (last action wins)", () => {
    // If user fetched prices from Yahoo Finance, it overrides testPrice
    const fetchedPrices = { AAPL: 175.25 };
    expect(getEffectivePrice("AAPL", fetchedPrices, 150)).toBe(175.25);
  });

  it("should handle multiple symbols correctly", () => {
    const fetchedPrices = { AAPL: 150, MSFT: 300 };
    expect(getEffectivePrice("AAPL", fetchedPrices, 100)).toBe(150);
    expect(getEffectivePrice("MSFT", fetchedPrices, 250)).toBe(300);
    expect(getEffectivePrice("GOOG", fetchedPrices, 125)).toBe(125); // Not in fetchedPrices
  });
});
