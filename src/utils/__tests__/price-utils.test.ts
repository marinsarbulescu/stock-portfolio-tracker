import { getEffectivePrice, getHistoricalCloses } from "../price-utils";
import { PriceData } from "@/contexts/PriceContext";

// Helper to create PriceData
const makePriceData = (
  currentPrice: number | null,
  historicalCloses: { date: string; close: number }[] = []
): PriceData => ({
  currentPrice,
  historicalCloses,
});

describe("getEffectivePrice", () => {
  it("should return fetched price when available", () => {
    const fetchedPrices = { AAPL: makePriceData(150.5) };
    expect(getEffectivePrice("AAPL", fetchedPrices, 100)).toBe(150.5);
  });

  it("should return testPrice when no fetched price exists", () => {
    const fetchedPrices: Record<string, PriceData> = {};
    expect(getEffectivePrice("AAPL", fetchedPrices, 100)).toBe(100);
  });

  it("should return testPrice when fetched price is null", () => {
    const fetchedPrices = { AAPL: makePriceData(null) };
    expect(getEffectivePrice("AAPL", fetchedPrices, 100)).toBe(100);
  });

  it("should return null when both fetched price and testPrice are null", () => {
    const fetchedPrices = { AAPL: makePriceData(null) };
    expect(getEffectivePrice("AAPL", fetchedPrices, null)).toBeNull();
  });

  it("should return null when no fetched price and testPrice is null", () => {
    const fetchedPrices: Record<string, PriceData> = {};
    expect(getEffectivePrice("AAPL", fetchedPrices, null)).toBeNull();
  });

  it("should fall back to testPrice when fetched price is zero", () => {
    const fetchedPrices = { AAPL: makePriceData(0) };
    // 0 is not valid price, should fall back to testPrice
    expect(getEffectivePrice("AAPL", fetchedPrices, 100)).toBe(100);
  });

  it("should prioritize fetched price over testPrice (last action wins)", () => {
    // If user fetched prices from Yahoo Finance, it overrides testPrice
    const fetchedPrices = { AAPL: makePriceData(175.25) };
    expect(getEffectivePrice("AAPL", fetchedPrices, 150)).toBe(175.25);
  });

  it("should handle multiple symbols correctly", () => {
    const fetchedPrices = {
      AAPL: makePriceData(150),
      MSFT: makePriceData(300),
    };
    expect(getEffectivePrice("AAPL", fetchedPrices, 100)).toBe(150);
    expect(getEffectivePrice("MSFT", fetchedPrices, 250)).toBe(300);
    expect(getEffectivePrice("GOOG", fetchedPrices, 125)).toBe(125); // Not in fetchedPrices
  });
});

describe("getHistoricalCloses", () => {
  it("should return historical closes when available", () => {
    const historicalCloses = [
      { date: "2024-01-15", close: 150 },
      { date: "2024-01-14", close: 148 },
    ];
    const fetchedPrices = { AAPL: makePriceData(155, historicalCloses) };
    expect(getHistoricalCloses("AAPL", fetchedPrices)).toEqual(historicalCloses);
  });

  it("should return empty array when symbol not found", () => {
    const fetchedPrices: Record<string, PriceData> = {};
    expect(getHistoricalCloses("AAPL", fetchedPrices)).toEqual([]);
  });

  it("should return empty array when no historical closes", () => {
    const fetchedPrices = { AAPL: makePriceData(150, []) };
    expect(getHistoricalCloses("AAPL", fetchedPrices)).toEqual([]);
  });

  it("should handle multiple symbols correctly", () => {
    const aaplCloses = [{ date: "2024-01-15", close: 150 }];
    const msftCloses = [{ date: "2024-01-15", close: 300 }];
    const fetchedPrices = {
      AAPL: makePriceData(155, aaplCloses),
      MSFT: makePriceData(305, msftCloses),
    };
    expect(getHistoricalCloses("AAPL", fetchedPrices)).toEqual(aaplCloses);
    expect(getHistoricalCloses("MSFT", fetchedPrices)).toEqual(msftCloses);
    expect(getHistoricalCloses("GOOG", fetchedPrices)).toEqual([]);
  });
});
