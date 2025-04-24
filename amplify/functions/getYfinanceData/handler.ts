// amplify/functions/getYfinanceData/handler.ts

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
// Make sure yahoo-finance2 is in your function's package.json dependencies
import yahooFinance from 'yahoo-finance2';

interface HistoricalClose {
  date: string; // Format YYYY-MM-DD
  close: number;
}

interface PriceResult {
  symbol: string;
  currentPrice: number | null;
  historicalCloses: HistoricalClose[]; // array for historical data
}

// --- End Update --- //

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  // Assuming symbols are passed in the request body
  const args = event.body ? JSON.parse(event.body) : { symbols: [] };
  const symbols: string[] = args.symbols || [];

  if (!symbols || symbols.length === 0) {
    return {
      statusCode: 400,
      // Ensure CORS headers are present in all responses
      headers: {
        'Access-Control-Allow-Origin': '*', // Or your specific origin
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'OPTIONS,POST,GET'
      },
      body: JSON.stringify({ error: 'No symbols provided' }),
    };
  }
  console.log(`getYfinanceData: Workspaceing prices & history for symbols: ${symbols.join(',')}`);

  const results: PriceResult[] = [];

  // Calculate start date: 7 days ago for history
  const date = new Date();
  date.setDate(date.getDate() - 7); // Set date to 7 days ago
  const startDate = date.toISOString().split('T')[0]; // Format YYYY-MM-DD
  // const period1 = startDate; // Use startDate directly if API supports YYYY-MM-DD

  const quotePromises = symbols.map(async (symbol): Promise<PriceResult | null> => {
    try {
      // Fetch quote AND history concurrently
      const [quote, history] = await Promise.all([
        // Request multiple relevant fields from quote for better fallbacks
        yahooFinance.quote(symbol, {
          fields: [
            'regularMarketPrice',
            'regularMarketChangePercent', // Example: Keep if needed elsewhere
            'marketState', // Useful for determining if market is open
            'regularMarketPreviousClose', // Good fallback if market closed
            'bid', // Potential fallback
            'ask', // Potential fallback
          ],
        }),
        // --- Historical fetch remains EXACTLY the same ---
        yahooFinance.historical(symbol, {
          period1: startDate, // Use YYYY-MM-DD format
          interval: '1d',
        }),
      ]);

      // --- Determine Current Price with Fallbacks ---
      let currentPrice: number | null = null;
      if (quote) {
         // Prioritize regularMarketPrice if market is likely open or price exists
         if (typeof quote.regularMarketPrice === 'number') {
             currentPrice = quote.regularMarketPrice;
         }
         // Fallback to previous close if market likely closed and regularMarketPrice is missing/stale
         else if (quote.marketState !== 'REGULAR' && typeof quote.regularMarketPreviousClose === 'number') {
             console.log(`getYfinanceData: Using previous close for ${symbol} (Market State: ${quote.marketState})`);
             currentPrice = quote.regularMarketPreviousClose;
         }
         // Optional: Further fallbacks to bid/ask if needed, though less common for "close"
         // else if (typeof quote.bid === 'number') {
         //    currentPrice = quote.bid;
         // }
         else {
            // If no suitable price found in quote, leave as null or log warning
            console.warn(`getYfinanceData: Could not determine current price for ${symbol} from quote.`);
         }
      } else {
         console.warn(`getYfinanceData: Quote data missing for ${symbol}`);
      }
      // --- End Current Price Logic ---

      // Process History (keep existing logic)
      const historicalCloses: HistoricalClose[] = (history || [])
      .filter((h) =>
        h && h.date && typeof h.close === 'number' && !isNaN(h.close)
      )
        .map((h) => ({
          // Ensure date is formatted correctly (YYYY-MM-DD)
          // The .toISOString().split('T')[0] handles timezone conversion safely to UTC date string
          date: h.date.toISOString().split('T')[0],
          close: h.close, // Assert non-null based on filter
        }))
        // sort descending to easily get latest 5 later (optional here)
        .sort((a, b) => b.date.localeCompare(a.date));

      // console.log(`getYfinanceData: Symbol ${symbol}: Price=${currentPrice} History Points=${historicalCloses.length}`);
      return { symbol, currentPrice, historicalCloses };

    } catch (error: any) {
      console.error(`getYfinanceData: Error fetching data for ${symbol}:`, error.message || error);
      // Return null or a specific error structure if needed downstream
      // Returning empty history on error might be preferable to null
      return { symbol, currentPrice: null, historicalCloses: [] };
    }
  });

  // Wait for all promises to settle (either fulfilled or rejected)
  const settledResults = await Promise.allSettled(quotePromises);
  settledResults.forEach((result) => {
    if (result.status === 'fulfilled' && result.value) {
      // Only add valid results (filter out nulls from errors if any)
      results.push(result.value);
    } else if (result.status === 'rejected') {
        // Log rejections if not already logged inside the catch block
        console.error("getYfinanceData: A promise was rejected:", result.reason);
    }
  });

  console.log(`getYfinanceData: Returning results for ${results.length} symbols.`);

  // Return results
  return {
    statusCode: 200,
    // Ensure CORS headers are present in all responses
      headers: {
        'Access-Control-Allow-Origin': '*', // Or your specific origin
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'OPTIONS,POST,GET'
      },
    body: JSON.stringify(results),
  };
};