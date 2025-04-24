// amplify/functions/getYfinanceData/handler.ts
import yahooFinance from 'yahoo-finance2';

interface GetPricesEvent { arguments: { symbols: string[] }; }

// --- Update PriceResult ---
interface HistoricalClose {
  date: string; // YYYY-MM-DD
  close: number;
}
interface PriceResult {
  symbol: string;
  currentPrice: number | null;
  historicalCloses: HistoricalClose[]; // Array for historical data
}
// --- End Update ---

export const handler = async (event: GetPricesEvent): Promise<PriceResult[]> => {
  const symbols = event.arguments.symbols;
  if (!symbols || symbols.length === 0) return [];
  console.log(`Workspaceing prices & history for symbols: ${symbols.join(', ')}`);

  const results: PriceResult[] = [];

  // Calculate start date approx 7 days ago for history
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 7);
  const period1 = startDate.toISOString().split('T')[0]; // Format YYYY-MM-DD

  const quotePromises = symbols.map(async (symbol) => {
    try {
      // Fetch quote and history concurrently
      const [quote, history] = await Promise.all([
        yahooFinance.quote(symbol, { fields: ['regularMarketPrice'] }),
        yahooFinance.historical(symbol, { period1: period1, interval: '1d' })
      ]);

      const currentPrice = (quote && typeof quote.regularMarketPrice === 'number') ? quote.regularMarketPrice : null;

      // Process history - filter out entries without a close price and format
      const historicalCloses: HistoricalClose[] = history
         .filter(h => typeof h.close === 'number') // Ensure close price exists
         .map(h => ({
            // Format date consistently, ensure it's not null/undefined
            date: h.date.toISOString().split('T')[0],
            close: h.close! // Assert non-null based on filter
         }))
         // Sort descending to easily get latest 5 later (optional here)
         .sort((a, b) => b.date.localeCompare(a.date));

      console.log(`Data for <span class="math-inline">\{symbol\}\: Price\=</span>{currentPrice}, History Points=${historicalCloses.length}`);
      return { symbol, currentPrice, historicalCloses };

    } catch (error: any) {
      console.error(`Error fetching data for ${symbol}:`, error.message || error);
      return { symbol, currentPrice: null, historicalCloses: [] }; // Return empty history on error
    }
  });

  const settledResults = await Promise.allSettled(quotePromises);
  settledResults.forEach(result => {
    if (result.status === 'fulfilled' && result.value) {
      results.push(result.value);
    }
  });

  console.log('Returning results:', results.length);
  return results;
};