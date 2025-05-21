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

// --- Define your hardcoded list of symbols to exclude ---
const EXCLUDED_SYMBOLS: string[] = [
    'BTC-USD',
    'DBA',
    'IYZ',
    'SOYB',
    'AMD',
];
// --- End of Excluded Symbols Definition ---

export const handler = async (event: GetPricesEvent): Promise<PriceResult[]> => {
  const incomingSymbols = event.arguments.symbols;

  if (!incomingSymbols || incomingSymbols.length === 0) return [];
  console.log(`getYfinanceData: Received symbols: ${incomingSymbols.join(', ')}`);

  // --- Filter out excluded symbols ---
  const symbolsToFetch = incomingSymbols.filter(symbol => {
    const isExcluded = EXCLUDED_SYMBOLS.includes(symbol.toUpperCase()); // Case-insensitive check
    if (isExcluded) {
      console.log(`getYfinanceData: Excluding symbol: ${symbol} (found in EXCLUDED_SYMBOLS list)`);
    }
    return !isExcluded;
  });
  // --- End of filtering ---

  if (symbolsToFetch.length === 0) {
    console.log('getYfinanceData: No symbols remaining to fetch after exclusion.');
    return [];
  }
  console.log(`getYfinanceData: Fetching prices & history for (after exclusion): ${symbolsToFetch.join(', ')}`);


  const results: PriceResult[] = []; // Array to store all results

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 7); // Approx 7 days ago for historical
  const period1 = startDate.toISOString().split('T')[0];

  // --- Sequential Fetching for the filtered symbolsToFetch list ---
  for (const symbol of symbolsToFetch) {
    console.log(`[Sequential Fetch] Processing symbol: ${symbol}`);
    try {
      // Fetch quote and history concurrently FOR THE CURRENT SYMBOL
      const [quote, history] = await Promise.all([
        yahooFinance.quote(symbol, { fields: ['regularMarketPrice'] }),
        yahooFinance.historical(symbol, { period1: period1, interval: '1d' })
      ]);

      const currentPrice = (quote && typeof quote.regularMarketPrice === 'number') ? quote.regularMarketPrice : null;

      const historicalCloses: HistoricalClose[] = history
        .filter(h => typeof h.close === 'number') // Ensure close price exists
        .map(h => ({
          date: h.date.toISOString().split('T')[0],
          close: h.close!, // Assert non-null based on filter
        }))
        .sort((a, b) => b.date.localeCompare(a.date));

      console.log(`Data for ${symbol}: Price=${currentPrice}, History Points=${historicalCloses.length}`);
      results.push({ symbol, currentPrice, historicalCloses });

    } catch (error: any) {
      console.error(`Error fetching data for ${symbol}:`, error.message || error);
      // Add a result indicating failure for this symbol, conforming to PriceResult
      results.push({ symbol, currentPrice: null, historicalCloses: [] });
    }
    // Optional: Add a small delay between fetching each symbol if you suspect very aggressive rate limiting
    // await new Promise(resolve => setTimeout(resolve, 200)); // e.g., 200ms delay
  }
  // --- End of Sequential Fetching ---

  console.log('getYfinanceData: Returning results count:', results.length);
  return results;
};
