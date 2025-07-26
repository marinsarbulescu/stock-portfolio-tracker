// app/contexts/PriceContext.tsx
'use client';

import React, { createContext, useState, useContext, useCallback, ReactNode, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource'; // Adjust path

const client = generateClient<Schema>();

interface HistoricalCloseData { date: string; close: number; }
interface PriceData {
  symbol: string;
  currentPrice: number | null;
  historicalCloses: HistoricalCloseData[];
}

type PriceMap = Record<string, PriceData | null>;

interface StoredPriceInfo {
  prices: PriceMap;
  timestamp: string | null;
}

interface PriceContextType {
  latestPrices: PriceMap;
  lastPriceFetchTimestamp: Date | null;
  pricesLoading: boolean;
  pricesError: string | null;
  progressMessage: string | null; // Added for progress indication
  fetchLatestPricesForAllStocks: () => Promise<void>;
}

const PriceContext = createContext<PriceContextType | undefined>(undefined);
const PRICES_STORAGE_KEY = 'portfolioAppLatestPrices';

// --- Define your hardcoded list of symbols to exclude on the client-side ---
const EXCLUDED_SYMBOLS_CLIENT: string[] = [
    'DBA',
    'IYZ',
    'SOYB',
    'AMD',
];
// --- End of Client-Side Excluded Symbols Definition ---

// --- Define the batch size for fetching prices ---
const PRICE_FETCH_BATCH_SIZE = 5; // You can experiment with this number
// --- End of Batch Size Definition ---


export const PriceProvider = ({ children }: { children: ReactNode }) => {
  const [latestPrices, setLatestPrices] = useState<PriceMap>(() => {
    if (typeof window !== 'undefined') {
      try {
        const storedDataString = window.localStorage.getItem(PRICES_STORAGE_KEY);
        if (storedDataString) {
          const storedData: StoredPriceInfo = JSON.parse(storedDataString);
          return storedData.prices || {};
        }
      } catch (error) {
        // console.error("[PriceContext.tsx] - Error reading/parsing stored prices state:", error);
      }
    }
    return {};
  });

  const [lastPriceFetchTimestamp, setLastPriceFetchTimestamp] = useState<Date | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const storedDataString = window.localStorage.getItem(PRICES_STORAGE_KEY);
        if (storedDataString) {
          const storedData: StoredPriceInfo = JSON.parse(storedDataString);
          return storedData.timestamp ? new Date(storedData.timestamp) : null;
        }
      } catch (error) {
        // console.error("[PriceContext.tsx] - Error reading/parsing stored timestamp state:", error);
        window.localStorage.removeItem(PRICES_STORAGE_KEY);
      }
    }
    return null;
  });

  const [pricesLoading, setPricesLoading] = useState<boolean>(false);
  const [pricesError, setPricesError] = useState<string | null>(null);
  const [progressMessage, setProgressMessage] = useState<string | null>(null); // New state for progress message

  useEffect(() => {
    if (typeof window !== 'undefined') {
        try {
            const dataToStore: StoredPriceInfo = {
                prices: latestPrices,
                timestamp: lastPriceFetchTimestamp?.toISOString() ?? null
            };
            window.localStorage.setItem(PRICES_STORAGE_KEY, JSON.stringify(dataToStore));
        } catch (error) {
            // console.error("[PriceContext.tsx] - Error saving state to localStorage:", error);
        }
    }
  }, [latestPrices, lastPriceFetchTimestamp]);

  const fetchLatestPricesForAllStocks = useCallback(async () => {
    setPricesLoading(true);
    setPricesError(null);
    setProgressMessage(null); // Reset progress message at the start
    const allFetchedPricesMap: PriceMap = {};
    let overallError: string | null = null;

    try {
      // console.log('[PriceContext.tsx] - Fetching all stock symbols from backend...');
      const { data: stocksData, errors: stockErrors } = await client.models.PortfolioStock.list({
        selectionSet: ['symbol', 'archived', 'isHidden']
      });

      if (stockErrors) {
        // console.error("[PriceContext.tsx] - Error fetching stock list:", stockErrors);
        const firstErrorMsg = Array.isArray(stockErrors) && stockErrors.length > 0 ? stockErrors[0].message : "Failed to fetch stock list";
        throw new Error(firstErrorMsg);
      }

      // Filter out archived stocks AND hidden stocks from price fetching
      const activeStocksData = stocksData?.filter(stock => !stock.archived && !stock.isHidden) ?? [];
      const allSymbolsFromBackend = activeStocksData.map(stock => stock.symbol).filter(Boolean) as string[];
      
      // console.log(`[PriceContext.tsx] - Found ${allSymbolsFromBackend.length} active, non-hidden symbols from backend:`, allSymbolsFromBackend);

      // --- Filter out excluded symbols on the client-side ---
      const symbolsToProcess = allSymbolsFromBackend.filter(symbol => {
        const isExcluded = EXCLUDED_SYMBOLS_CLIENT.includes(symbol.toUpperCase());
        if (isExcluded) {
          // console.log(`[PriceContext.tsx] - Client-side: Excluding symbol: ${symbol}`);
        }
        return !isExcluded;
      });
      // console.log(`[PriceContext.tsx] - Processing ${symbolsToProcess.length} symbols after client-side exclusion:`, symbolsToProcess);
      // --- End of client-side filtering ---


      if (symbolsToProcess.length === 0) {
        // console.log('[PriceContext.tsx] - No stocks found to fetch prices for after exclusion.');
        setLatestPrices({});
        setLastPriceFetchTimestamp(new Date());
      } else {
        const totalBatches = Math.ceil(symbolsToProcess.length / PRICE_FETCH_BATCH_SIZE);
        // Use the constant defined at the top
        for (let i = 0; i < symbolsToProcess.length; i += PRICE_FETCH_BATCH_SIZE) {
          const currentBatchNumber = Math.floor(i / PRICE_FETCH_BATCH_SIZE) + 1;
          setProgressMessage(`Fetching batch ${currentBatchNumber} of ${totalBatches}...`); // Update progress message

          const batchSymbols = symbolsToProcess.slice(i, i + PRICE_FETCH_BATCH_SIZE);
          // console.log(`[PriceContext.tsx] - Fetching prices for batch ${currentBatchNumber}/${totalBatches} (Size: ${PRICE_FETCH_BATCH_SIZE}):`, batchSymbols);

          try {
            const { data: batchPriceResults, errors: batchPriceErrors } = await client.queries.getLatestPrices({ symbols: batchSymbols });

            if (batchPriceErrors) {
              // console.error(`[PriceContext.tsx] - Error fetching prices for batch ${batchSymbols.join(',')}:`, batchPriceErrors);
              const batchErrMsg = Array.isArray(batchPriceErrors) && batchPriceErrors.length > 0 ? batchPriceErrors[0].message : "Failed to fetch prices for a batch";
              if (!overallError) overallError = batchErrMsg;
              batchSymbols.forEach(s => {
                if (!(s in allFetchedPricesMap)) allFetchedPricesMap[s] = null;
              });
              continue;
            }

            batchSymbols.forEach(s => {
                if (!(s in allFetchedPricesMap)) allFetchedPricesMap[s] = null;
            });

            if (batchPriceResults) {
              // console.log(`[PriceContext.tsx] - Batch ${currentBatchNumber} results:`, batchPriceResults);
              batchPriceResults.forEach(result => {
                if (result && result.symbol) {
                  const validHistoricalCloses = (result.historicalCloses ?? [])
                    .filter((hc): hc is HistoricalCloseData => hc !== null && hc !== undefined);
                  allFetchedPricesMap[result.symbol] = {
                    symbol: result.symbol,
                    currentPrice: result.currentPrice ?? null,
                    historicalCloses: validHistoricalCloses
                  };
                }
              });
            }
            // console.log(`[PriceContext.tsx] - Successfully processed batch ${currentBatchNumber}`);
          } catch (batchErr: unknown) {
            // console.error(`[PriceContext.tsx] - Unexpected error processing batch ${batchSymbols.join(',')}:`, batchErr);
            const unexpectedBatchErrMsg = (batchErr as Error).message || "Unexpected error during batch price fetch";
            if (!overallError) overallError = unexpectedBatchErrMsg;
            batchSymbols.forEach(s => {
                if (!(s in allFetchedPricesMap)) allFetchedPricesMap[s] = null;
            });
          }
        }
        
        setLatestPrices(allFetchedPricesMap);
        setLastPriceFetchTimestamp(new Date());
        if (overallError) {
            setPricesError(overallError + " (Some batches may have failed)");
        }
        // console.log('[PriceContext.tsx] - All batches processed. Prices updated in context:', allFetchedPricesMap);
      }
    } catch (err: unknown) {
      // console.error("[PriceContext.tsx] - Error in fetchLatestPricesForAllStocks (Outer catch):", err);
      let outerErrMsg = "An unexpected error occurred";
      if (Array.isArray(err) && err.length > 0 && (err as Array<{message: string}>)[0].message) {
        outerErrMsg = (err as Array<{message: string}>)[0].message;
      } else if ((err as Error).message) {
        outerErrMsg = (err as Error).message;
      }
      setPricesError(outerErrMsg);
      setLatestPrices({});
    } finally {
      setPricesLoading(false);
      setProgressMessage(null); // Clear progress message when done
    }
  }, []);

  const value = {
    latestPrices,
    lastPriceFetchTimestamp,
    pricesLoading,
    pricesError,
    progressMessage, // Add progressMessage to the context value
    fetchLatestPricesForAllStocks
  };

  return <PriceContext.Provider value={value}>{children}</PriceContext.Provider>;
};

export const usePrices = (): PriceContextType => {
  const context = useContext(PriceContext);
  if (context === undefined) {
    throw new Error('usePrices must be used within a PriceProvider');
  }
  return context;
};
