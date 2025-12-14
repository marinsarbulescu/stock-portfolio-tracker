import yahooFinance from "yahoo-finance2";

interface HistoricalClose {
  date: string;
  close: number;
}

interface PriceResult {
  symbol: string;
  currentPrice: number | null;
  historicalCloses: HistoricalClose[];
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

  // Calculate date range for historical data (7 days to ensure 5 trading days)
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 7);

  // Sequential fetching to avoid rate limiting
  for (const symbol of symbols) {
    try {
      // Fetch quote and historical data concurrently for each symbol
      const [quote, chart] = await Promise.all([
        yahooFinance.quote(symbol, {
          fields: ["regularMarketPrice"],
        }),
        yahooFinance.chart(symbol, {
          period1: startDate,
          interval: "1d",
        }),
      ]);

      const currentPrice = quote?.regularMarketPrice ?? null;

      // Extract historical closes from chart data
      const historicalCloses: HistoricalClose[] = [];
      if (chart?.quotes) {
        for (const q of chart.quotes) {
          if (q.close !== null && q.close !== undefined && q.date) {
            historicalCloses.push({
              date: q.date.toISOString().split("T")[0],
              close: q.close,
            });
          }
        }
      }

      results.push({ symbol, currentPrice, historicalCloses });
    } catch (error) {
      console.error(`Error fetching ${symbol}:`, error);
      results.push({ symbol, currentPrice: null, historicalCloses: [] });
    }
  }

  return results;
};
