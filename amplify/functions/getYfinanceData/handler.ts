// amplify/functions/getYfinanceData/handler.ts
import YahooFinance from 'yahoo-finance2';

// Initialize yahoo-finance2 (v3 pattern)
const yahooFinance = new YahooFinance();

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
    'DBA',
    'IYZ',
    'SOYB',
    'AMD',
];
// --- End of Excluded Symbols Definition ---

// Note: BTC-USD is now handled by yahoo-finance2 directly alongside other symbols

export const handler = async (event: GetPricesEvent): Promise<PriceResult[]> => {
  const incomingSymbols = event.arguments.symbols;

  if (!incomingSymbols || incomingSymbols.length === 0) return [];
  console.log(`getYfinanceData: Received symbols: ${incomingSymbols.join(', ')}`);

  // --- Filter out excluded symbols ---
  const validSymbols = incomingSymbols.filter(symbol => {
    const upperSymbol = symbol.toUpperCase();
    const isExcluded = EXCLUDED_SYMBOLS.includes(upperSymbol);
    
    if (isExcluded) {
      console.log(`getYfinanceData: Excluding symbol: ${symbol} (found in EXCLUDED_SYMBOLS list)`);
      return false;
    }
    return true;
  });
  // --- End of symbol filtering ---

  console.log(`getYfinanceData: Processing symbols: ${validSymbols.join(', ') || 'none'}`);

  const results: PriceResult[] = []; // Array to store all results

  // --- Process all symbols with YFinance (including BTC-USD) ---
  if (validSymbols.length > 0) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7); // Approx 7 days ago for historical
    const period1 = startDate.toISOString().split('T')[0];

    // --- Sequential Fetching for all symbols ---
    for (const symbol of validSymbols) {
      console.log(`[YFinance Sequential Fetch] Processing symbol: ${symbol}`);
      try {
        // Fetch quote and history concurrently FOR THE CURRENT SYMBOL
        const [quoteResult, history] = await Promise.all([
          // For BTC-USD and crypto symbols, catch validation errors but extract the data
          yahooFinance.quote(symbol, { fields: ['regularMarketPrice'] }).catch(error => {
            // If it's a schema validation error, the data might still be in the error
            if (error.message?.includes('Failed Yahoo Schema validation')) {
              console.log(`[YFinance] Schema validation failed for ${symbol}, extracting data from error`);
              // The actual data is often in the error object itself or in error.result
              if (error.result) return error.result;
              if (error.value) return error.value;
              // Sometimes the data is in the error message JSON
              try {
                const match = error.message.match(/"value":\s*({[^}]+})/);
                if (match) {
                  const data = JSON.parse(match[1]);
                  return data;
                }
              } catch (parseError) {
                console.log(`[YFinance] Could not parse data from validation error for ${symbol}`);
              }
            }
            throw error; // Re-throw if it's a different error
          }),
          yahooFinance.historical(symbol, { period1: period1, interval: '1d' })
        ]);

        // Handle case where quoteResult might be an array (like for BTC-USD from schema validation error handling)
        const quoteData = Array.isArray(quoteResult) ? quoteResult[0] : quoteResult;
        const currentPrice = (quoteData && typeof quoteData.regularMarketPrice === 'number') ? quoteData.regularMarketPrice : null;

        const historicalCloses: HistoricalClose[] = history
          .filter(h => typeof h.close === 'number') // Ensure close price exists
          .map(h => ({
            date: h.date.toISOString().split('T')[0],
            close: h.close!, // Assert non-null based on filter
          }))
          .sort((a, b) => b.date.localeCompare(a.date));

        console.log(`YFinance data for ${symbol}: Price=${currentPrice}, History Points=${historicalCloses.length}`);
        results.push({ symbol, currentPrice, historicalCloses });

      } catch (error: any) {
        console.error(`Error fetching YFinance data for ${symbol}:`, error.message || error);
        // Add a result indicating failure for this symbol, conforming to PriceResult
        results.push({ symbol, currentPrice: null, historicalCloses: [] });
      }
      // Optional: Add a small delay between fetching each symbol if you suspect very aggressive rate limiting
      // await new Promise(resolve => setTimeout(resolve, 200)); // e.g., 200ms delay
    }
    // --- End of YFinance Sequential Fetching ---
  }

  console.log('getYfinanceData: Returning results count:', results.length);
  console.log('getYfinanceData: Results summary:', results.map(r => `${r.symbol}: ${r.currentPrice ? '$' + r.currentPrice.toFixed(2) : 'null'}`).join(', '));
  return results;
};
