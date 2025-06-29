import type { Schema } from '../../data/resource';
import yahooFinance from 'yahoo-finance2';

export const handler: Schema["getHistoricalData"]["functionHandler"] = async (event) => {
  console.log('getHistoricalData function called with:', event);
  
  const { symbols, startDate, endDate } = event.arguments;
  
  if (!symbols || symbols.length === 0) {
    throw new Error('No symbols provided');
  }

  try {
    const results = [];
    
    for (const symbol of symbols) {
      if (!symbol) {
        console.warn('Skipping null or undefined symbol');
        continue;
      }
      
      console.log(`Fetching historical data for ${symbol} from ${startDate} to ${endDate}`);
      
      try {
        // Fetch historical data for the specified date range
        const data = await yahooFinance.historical(symbol, {
          period1: startDate, // Use string date format directly
          period2: endDate,   // Use string date format directly
          interval: '1d'
        });
        
        console.log(`Retrieved ${data.length} data points for ${symbol}`);
        
        // Get current price (latest available)
        let currentPrice: number | null = null;
        if (data && data.length > 0) {
          currentPrice = data[data.length - 1].close;
        }
        
        // Transform data to match expected format
        const historicalCloses = data
          .filter((item: any) => typeof item.close === 'number') // Ensure close price exists
          .map((item: any) => ({
            date: item.date.toISOString().split('T')[0], // Convert Date object to YYYY-MM-DD string
            close: item.close
          }))
          .sort((a, b) => a.date.localeCompare(b.date)); // Sort by date ascending (oldest first)
        
        results.push({
          symbol: symbol.toUpperCase(),
          currentPrice,
          historicalCloses
        });
      } catch (symbolError) {
        console.error(`Error fetching data for ${symbol}:`, symbolError);
        // Still include the symbol with null data to maintain consistency
        results.push({
          symbol: symbol.toUpperCase(),
          currentPrice: null,
          historicalCloses: []
        });
      }
    }
    
    console.log(`Successfully processed ${results.length} symbols`);
    return results;
    
  } catch (error) {
    console.error('Error in getHistoricalData:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    throw new Error(`Failed to fetch historical data: ${errorMessage}`);
  }
};
