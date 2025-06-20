// amplify/functions/getYfinanceData/handler.ts
import yahooFinance from 'yahoo-finance2';
import { getBTCPrice, generateBTCHistoricalData } from './btcPriceFetcher';

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
    // 'BTC-USD', // Removed from exclusion - now handled by our custom fetcher
    'DBA',
    'IYZ',
    'SOYB',
    'AMD',
];
// --- End of Excluded Symbols Definition ---

// --- Special symbols that need custom handling ---
const CUSTOM_FETCH_SYMBOLS = ['BTC-USD'];
// --- End of Custom Symbols Definition ---

export const handler = async (event: GetPricesEvent): Promise<PriceResult[]> => {
  const incomingSymbols = event.arguments.symbols;

  if (!incomingSymbols || incomingSymbols.length === 0) return [];
  console.log(`getYfinanceData: Received symbols: ${incomingSymbols.join(', ')}`);

  // --- Separate symbols into custom fetch and regular YFinance ---
  const customFetchSymbols = incomingSymbols.filter(symbol => 
    CUSTOM_FETCH_SYMBOLS.includes(symbol.toUpperCase())
  );
  
  const regularSymbols = incomingSymbols.filter(symbol => {
    const upperSymbol = symbol.toUpperCase();
    const isCustom = CUSTOM_FETCH_SYMBOLS.includes(upperSymbol);
    const isExcluded = EXCLUDED_SYMBOLS.includes(upperSymbol);
    
    if (isCustom) {
      console.log(`getYfinanceData: Using custom fetcher for: ${symbol}`);
      return false;
    }
    if (isExcluded) {
      console.log(`getYfinanceData: Excluding symbol: ${symbol} (found in EXCLUDED_SYMBOLS list)`);
      return false;
    }
    return true;
  });
  // --- End of symbol separation ---

  console.log(`getYfinanceData: Custom fetch symbols: ${customFetchSymbols.join(', ') || 'none'}`);
  console.log(`getYfinanceData: YFinance symbols: ${regularSymbols.join(', ') || 'none'}`);

  const results: PriceResult[] = []; // Array to store all results

  // --- Process custom fetch symbols (BTC, etc.) ---
  for (const symbol of customFetchSymbols) {
    console.log(`[Custom Fetch] Processing symbol: ${symbol}`);
    try {
      if (symbol.toUpperCase() === 'BTC-USD') {
        const btcData = await getBTCPrice();
        const historicalData = generateBTCHistoricalData(btcData.price || 50000, 7);
        
        results.push({
          symbol: 'BTC-USD',
          currentPrice: btcData.price,
          historicalCloses: historicalData
        });
        
        console.log(`Custom fetch success for BTC-USD: Price=${btcData.price}, Source=${btcData.source}, History Points=${historicalData.length}`);
      }
    } catch (error: any) {
      console.error(`Error in custom fetch for ${symbol}:`, error.message || error);
      results.push({ symbol, currentPrice: null, historicalCloses: [] });
    }
  }
  // --- End custom fetch processing ---

  // --- Process regular YFinance symbols ---
  if (regularSymbols.length > 0) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7); // Approx 7 days ago for historical
    const period1 = startDate.toISOString().split('T')[0];

    // --- Sequential Fetching for the filtered regular symbols ---
    for (const symbol of regularSymbols) {
      console.log(`[YFinance Sequential Fetch] Processing symbol: ${symbol}`);
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
