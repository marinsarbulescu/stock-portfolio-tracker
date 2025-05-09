// amplify/functions/getYfinanceData/handler.ts
import yahooFinance from 'yahoo-finance2';

interface GetPricesEvent { arguments: { symbols: string[] }; }

interface HistoricalClose {
  date: string; // YYYY-MM-DD
  close: number;
}
interface PriceResult {
  symbol: string;
  currentPrice: number | null;
  historicalCloses: HistoricalClose[];
}

export const handler = async (event: GetPricesEvent): Promise<PriceResult[]> => {
  const symbols = event.arguments.symbols;

  if (!symbols || symbols.length === 0) return [];
  console.log(`Workspaceing prices & history for symbols: ${symbols.join(', ')}`); // Corrected "Workspaceing"

  // --- TEMPORARY WORKAROUND: Filter out BTC-USD ---
  // const symbolsToFetch = symbols.filter(symbol => symbol !== 'BTC-USD');
  // console.log(`getYfinanceData: Fetching prices for (excluding BTC-USD): ${symbolsToFetch.join(',')}`);
  // --- END WORKAROUND ---

  const symbolsToFetch = symbols;

  const results: PriceResult[] = []; // Array to store all results

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 7); // Approx 7 days ago for historical
  const period1 = startDate.toISOString().split('T')[0];

  // ---vvv START OF CHANGES: Implement Sequential Fetching vvv---
  for (const symbol of symbolsToFetch) {
    console.log(`[Sequential Fetch] Processing symbol: ${symbol}`);
    try {
      // Fetch quote and history concurrently FOR THE CURRENT SYMBOL
      // This Promise.all is for the two calls (quote & historical) for ONE symbol
      const [quote, history] = await Promise.all([
        yahooFinance.quote(symbol, { fields: ['regularMarketPrice'] }),
        yahooFinance.historical(symbol, { period1: period1, interval: '1d' })
      ]);

      // Debug log for BTC-USD if it were to pass the filter (this log might not be hit due to filter)
      if (symbol === 'BTC-USD' && quote) {
        console.log(`DEBUG: BTC-USD Quote Object: ${JSON.stringify(quote, null, 2)}`);
      }

      const currentPrice = (quote && typeof quote.regularMarketPrice === 'number') ? quote.regularMarketPrice : null;

      const historicalCloses: HistoricalClose[] = history
        .filter(h => typeof h.close === 'number') // Ensure close price exists
        .map(h => ({
          date: h.date.toISOString().split('T')[0],
          close: h.close!, // Assert non-null based on filter
        }))
        .sort((a, b) => b.date.localeCompare(a.date));

      console.log(`Data for ${symbol}: Price=${currentPrice}, History Points=${historicalCloses.length}`);
      // Add the successfully fetched result to our main results array
      results.push({ symbol, currentPrice, historicalCloses });

    } catch (error: any) {
      console.error(`Error fetching data for ${symbol}:`, error.message || error);
      // Add a result indicating failure for this symbol, conforming to PriceResult
      results.push({ symbol, currentPrice: null, historicalCloses: [] });
    }
    // Optional: Add a small delay between fetching each symbol if you suspect very aggressive rate limiting
    // await new Promise(resolve => setTimeout(resolve, 200)); // e.g., 200ms delay
  }
  // ---^^^ END OF CHANGES: Implement Sequential Fetching ^^^---

  // The `quotePromises` and `Promise.allSettled` logic is now replaced by the loop above.
  // const quotePromises = symbolsToFetch.map(async (symbol) => { /* ... */ });
  // const settledResults = await Promise.allSettled(quotePromises);
  // settledResults.forEach(result => {
  //   if (result.status === 'fulfilled' && result.value) {
  //     results.push(result.value);
  //   } else if (result.status === 'rejected') {
  //     console.error(`[Promise.allSettled] A promise was rejected:`, result.reason);
  //   }
  // });

  console.log('Returning results:', results.length);
  return results;
};