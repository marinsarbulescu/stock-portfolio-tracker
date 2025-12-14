import yahooFinance from "yahoo-finance2";

interface PriceResult {
  symbol: string;
  currentPrice: number | null;
}

interface GetPricesEvent {
  arguments: {
    symbols: string[];
  };
}

export const handler = async (event: GetPricesEvent): Promise<PriceResult[]> => {
  const symbols = event.arguments.symbols;
  if (!symbols || symbols.length === 0) return [];

  // Suppress non-critical notices
  yahooFinance.suppressNotices(["yahooSurvey", "ripHistorical"]);

  const results: PriceResult[] = [];

  // Sequential fetching to avoid rate limiting
  for (const symbol of symbols) {
    try {
      const quote = await yahooFinance.quote(symbol, {
        fields: ["regularMarketPrice"],
      });
      const currentPrice = quote?.regularMarketPrice ?? null;
      results.push({ symbol, currentPrice });
    } catch (error) {
      console.error(`Error fetching ${symbol}:`, error);
      results.push({ symbol, currentPrice: null });
    }
  }

  return results;
};
