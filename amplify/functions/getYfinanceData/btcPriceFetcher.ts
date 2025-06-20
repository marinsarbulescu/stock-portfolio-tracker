// amplify/functions/getYfinanceData/btcPriceFetcher.ts
// BTC price fetching module optimized for AWS Lambda environment

import https from 'https';

export interface BTCPriceResult {
  symbol: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  timestamp: Date;
  source: string;
}

/**
 * Fetches BTC-USD price from CoinGecko API
 */
async function fetchBTCFromCoinGecko(): Promise<BTCPriceResult> {
  return new Promise((resolve, reject) => {
    const url = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true';
    
    const req = https.get(url, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          
          if (!json.bitcoin || !json.bitcoin.usd) {
            throw new Error('Invalid response structure from CoinGecko');
          }

          resolve({
            symbol: 'BTC-USD',
            price: json.bitcoin.usd,
            change: null, // CoinGecko doesn't provide absolute change
            changePercent: json.bitcoin.usd_24h_change || null,
            timestamp: new Date(),
            source: 'CoinGecko API'
          });

        } catch (error) {
          reject(new Error(`Failed to parse CoinGecko response: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`CoinGecko request failed: ${error.message}`));
    });

    req.setTimeout(8000, () => {
      req.destroy();
      reject(new Error('CoinGecko request timeout'));
    });
  });
}

/**
 * Fetches BTC-USD price from Binance API
 */
async function fetchBTCFromBinance(): Promise<BTCPriceResult> {
  return new Promise((resolve, reject) => {
    const url = 'https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT';
    
    const req = https.get(url, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          
          const price = parseFloat(json.lastPrice);
          const change24h = parseFloat(json.priceChange);
          const changePercent24h = parseFloat(json.priceChangePercent);

          if (isNaN(price)) {
            throw new Error('Invalid price data from Binance');
          }

          resolve({
            symbol: 'BTC-USD',
            price: price,
            change: isNaN(change24h) ? null : change24h,
            changePercent: isNaN(changePercent24h) ? null : changePercent24h,
            timestamp: new Date(),
            source: 'Binance API'
          });

        } catch (error) {
          reject(new Error(`Failed to parse Binance response: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Binance request failed: ${error.message}`));
    });

    req.setTimeout(8000, () => {
      req.destroy();
      reject(new Error('Binance request timeout'));
    });
  });
}

/**
 * Fetches BTC-USD price from CoinDesk API
 */
async function fetchBTCFromCoinDesk(): Promise<BTCPriceResult> {
  return new Promise((resolve, reject) => {
    const url = 'https://api.coindesk.com/v1/bpi/currentprice.json';
    
    const req = https.get(url, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          
          if (!json.bpi || !json.bpi.USD || !json.bpi.USD.rate) {
            throw new Error('Invalid response structure from CoinDesk');
          }

          const priceString = json.bpi.USD.rate;
          const price = parseFloat(priceString.replace(/[,$]/g, ''));
          const timestamp = json.time.updated ? new Date(json.time.updated) : new Date();

          if (isNaN(price)) {
            throw new Error('Invalid price data from CoinDesk');
          }

          resolve({
            symbol: 'BTC-USD',
            price: price,
            change: null,
            changePercent: null,
            timestamp: timestamp,
            source: 'CoinDesk API'
          });

        } catch (error) {
          reject(new Error(`Failed to parse CoinDesk response: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`CoinDesk request failed: ${error.message}`));
    });

    req.setTimeout(8000, () => {
      req.destroy();
      reject(new Error('CoinDesk request timeout'));
    });
  });
}

/**
 * Main function to fetch BTC price with multiple fallback sources
 */
export async function getBTCPrice(): Promise<BTCPriceResult> {
  const sources = [
    { name: 'CoinGecko', func: fetchBTCFromCoinGecko },
    { name: 'Binance', func: fetchBTCFromBinance },
    { name: 'CoinDesk', func: fetchBTCFromCoinDesk }
  ];

  let lastError: Error | null = null;

  for (const source of sources) {
    try {
      console.log(`[BTC Fetcher] Trying ${source.name}...`);
      const result = await source.func();
      console.log(`[BTC Fetcher] Success from ${source.name}: $${result.price}`);
      return result;
    } catch (error) {
      console.warn(`[BTC Fetcher] ${source.name} failed:`, error instanceof Error ? error.message : 'Unknown error');
      lastError = error instanceof Error ? error : new Error('Unknown error');
    }
  }

  throw new Error(`All BTC price sources failed. Last error: ${lastError?.message || 'Unknown error'}`);
}

/**
 * Generate mock historical data for BTC (since we don't have real historical from these APIs)
 * This creates a simple 7-day history based on current price with some variation
 */
export function generateBTCHistoricalData(currentPrice: number, days: number = 7): Array<{date: string, close: number}> {
  const history: Array<{date: string, close: number}> = [];
  const now = new Date();
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    // Generate realistic price variation (±2% random walk)
    const variation = (Math.random() - 0.5) * 0.04; // ±2%
    const basePrice = currentPrice * (1 + variation * i * 0.1); // Slight trend
    const dailyVariation = (Math.random() - 0.5) * 0.02; // ±1% daily
    const price = basePrice * (1 + dailyVariation);
    
    history.push({
      date: date.toISOString().split('T')[0],
      close: Math.round(price * 100) / 100 // Round to 2 decimals
    });
  }
  
  return history.sort((a, b) => b.date.localeCompare(a.date)); // Sort newest first
}
