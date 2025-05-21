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
  fetchLatestPricesForAllStocks: () => Promise<void>;
  notifyStatus: 'idle' | 'sending' | 'success' | 'error';
  notifyError: string | null;
  sendNotificationEmail: () => Promise<void>;
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
const PRICE_FETCH_BATCH_SIZE = 10; // You can experiment with this number
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
        console.error("Error reading/parsing stored prices state:", error);
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
        console.error("Error reading/parsing stored timestamp state:", error);
        window.localStorage.removeItem(PRICES_STORAGE_KEY);
      }
    }
    return null;
  });

  const [pricesLoading, setPricesLoading] = useState<boolean>(false);
  const [pricesError, setPricesError] = useState<string | null>(null);
  const [notifyStatus, setNotifyStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [notifyError, setNotifyError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
        try {
            const dataToStore: StoredPriceInfo = {
                prices: latestPrices,
                timestamp: lastPriceFetchTimestamp?.toISOString() ?? null
            };
            window.localStorage.setItem(PRICES_STORAGE_KEY, JSON.stringify(dataToStore));
        } catch (error) {
            console.error("Error saving state to localStorage:", error);
        }
    }
  }, [latestPrices, lastPriceFetchTimestamp]);

  const fetchLatestPricesForAllStocks = useCallback(async () => {
    setPricesLoading(true);
    setPricesError(null);
    let allFetchedPricesMap: PriceMap = {};
    let overallError: string | null = null;

    try {
      console.log('Fetching all stock symbols from backend...');
      const { data: stocksData, errors: stockErrors } = await client.models.PortfolioStock.list({
        selectionSet: ['symbol']
      });

      if (stockErrors) {
        console.error("Error fetching stock list:", stockErrors);
        const firstErrorMsg = Array.isArray(stockErrors) && stockErrors.length > 0 ? stockErrors[0].message : "Failed to fetch stock list";
        throw new Error(firstErrorMsg);
      }

      const allSymbolsFromBackend = stocksData?.map(stock => stock.symbol).filter(Boolean) as string[] ?? [];
      console.log(`Found ${allSymbolsFromBackend.length} symbols from backend.`);

      // --- Filter out excluded symbols on the client-side ---
      const symbolsToProcess = allSymbolsFromBackend.filter(symbol => {
        const isExcluded = EXCLUDED_SYMBOLS_CLIENT.includes(symbol.toUpperCase());
        if (isExcluded) {
          console.log(`Client-side: Excluding symbol: ${symbol}`);
        }
        return !isExcluded;
      });
      console.log(`Processing ${symbolsToProcess.length} symbols after client-side exclusion.`);
      // --- End of client-side filtering ---


      if (symbolsToProcess.length === 0) {
        console.log('No stocks found to fetch prices for after exclusion.');
        setLatestPrices({});
        setLastPriceFetchTimestamp(new Date());
      } else {
        // Use the constant defined at the top
        for (let i = 0; i < symbolsToProcess.length; i += PRICE_FETCH_BATCH_SIZE) {
          const batchSymbols = symbolsToProcess.slice(i, i + PRICE_FETCH_BATCH_SIZE);
          console.log(`Fetching prices for batch ${Math.floor(i / PRICE_FETCH_BATCH_SIZE) + 1}/${Math.ceil(symbolsToProcess.length / PRICE_FETCH_BATCH_SIZE)} (Size: ${PRICE_FETCH_BATCH_SIZE}):`, batchSymbols);

          try {
            const { data: batchPriceResults, errors: batchPriceErrors } = await client.queries.getLatestPrices({ symbols: batchSymbols });

            if (batchPriceErrors) {
              console.error(`Error fetching prices for batch ${batchSymbols.join(',')}:`, batchPriceErrors);
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
            console.log(`Successfully processed batch ${Math.floor(i / PRICE_FETCH_BATCH_SIZE) + 1}`);
          } catch (batchErr: any) {
            console.error(`Unexpected error processing batch ${batchSymbols.join(',')}:`, batchErr);
            const unexpectedBatchErrMsg = batchErr.message || "Unexpected error during batch price fetch";
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
        console.log('All batches processed. Prices updated in context:', allFetchedPricesMap);
      }
    } catch (err: any) {
      console.error("Error in fetchLatestPricesForAllStocks (Outer catch):", err);
      let outerErrMsg = "An unexpected error occurred while preparing to fetch prices.";
      if (err.message) {
        outerErrMsg = err.message;
      }
      setPricesError(outerErrMsg);
      setLatestPrices({});
    } finally {
      setPricesLoading(false);
    }
  }, []);

  const sendNotificationEmail = useCallback(async () => { /* ... */ }, [latestPrices]);

  const value = {
    latestPrices,
    lastPriceFetchTimestamp,
    pricesLoading,
    pricesError,
    fetchLatestPricesForAllStocks,
    notifyStatus,
    notifyError,
    sendNotificationEmail
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






// // app/contexts/PriceContext.tsx
// 'use client';

// import React, { createContext, useState, useContext, useCallback, ReactNode, useEffect } from 'react';
// import { generateClient } from 'aws-amplify/data';
// import type { Schema } from '@/amplify/data/resource'; // Adjust path

// const client = generateClient<Schema>();

// interface HistoricalCloseData { date: string; close: number; }
// interface PriceData {
//   symbol: string;
//   currentPrice: number | null;
//   historicalCloses: HistoricalCloseData[];
// }

// type PriceMap = Record<string, PriceData | null>;

// interface StoredPriceInfo {
//   prices: PriceMap;
//   timestamp: string | null;
// }

// interface PriceContextType {
//   latestPrices: PriceMap;
//   lastPriceFetchTimestamp: Date | null;
//   pricesLoading: boolean;
//   pricesError: string | null;
//   fetchLatestPricesForAllStocks: () => Promise<void>;
//   notifyStatus: 'idle' | 'sending' | 'success' | 'error';
//   notifyError: string | null;
//   sendNotificationEmail: () => Promise<void>;
// }

// const PriceContext = createContext<PriceContextType | undefined>(undefined);
// const PRICES_STORAGE_KEY = 'portfolioAppLatestPrices';

// export const PriceProvider = ({ children }: { children: ReactNode }) => {
//   const [latestPrices, setLatestPrices] = useState<PriceMap>(() => {
//     if (typeof window !== 'undefined') {
//       try {
//         const storedDataString = window.localStorage.getItem(PRICES_STORAGE_KEY);
//         if (storedDataString) {
//           const storedData: StoredPriceInfo = JSON.parse(storedDataString);
//           return storedData.prices || {};
//         }
//       } catch (error) {
//         console.error("[PriceContext.tsx] - Error reading/parsing stored prices state:", error);
//       }
//     }
//     return {};
//   });

//   const [lastPriceFetchTimestamp, setLastPriceFetchTimestamp] = useState<Date | null>(() => {
//     if (typeof window !== 'undefined') {
//       try {
//         const storedDataString = window.localStorage.getItem(PRICES_STORAGE_KEY);
//         if (storedDataString) {
//           const storedData: StoredPriceInfo = JSON.parse(storedDataString);
//           return storedData.timestamp ? new Date(storedData.timestamp) : null;
//         }
//       } catch (error) {
//         console.error("[PriceContext.tsx] - Error reading/parsing stored timestamp state:", error);
//         window.localStorage.removeItem(PRICES_STORAGE_KEY);
//       }
//     }
//     return null;
//   });

//   const [pricesLoading, setPricesLoading] = useState<boolean>(false);
//   const [pricesError, setPricesError] = useState<string | null>(null);
//   const [notifyStatus, setNotifyStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
//   const [notifyError, setNotifyError] = useState<string | null>(null);

//   useEffect(() => {
//     if (typeof window !== 'undefined') {
//         try {
//             const dataToStore: StoredPriceInfo = {
//                 prices: latestPrices,
//                 timestamp: lastPriceFetchTimestamp?.toISOString() ?? null
//             };
//             window.localStorage.setItem(PRICES_STORAGE_KEY, JSON.stringify(dataToStore));
//         } catch (error) {
//             console.error("[PriceContext.tsx] - Error saving state to localStorage:", error);
//         }
//     }
//   }, [latestPrices, lastPriceFetchTimestamp]);

//   const fetchLatestPricesForAllStocks = useCallback(async () => {
//     setPricesLoading(true);
//     setPricesError(null);
//     let priceMap: PriceMap = {};

//     try {
//       const { data: stocksData, errors: stockErrors } = await client.models.PortfolioStock.list({
//         selectionSet: ['symbol'] // Only fetch symbols
//       });

//       if (stockErrors) throw stockErrors; // This will be caught by the outer catch

//       // Ensure stocksData and its map method are safe to call
//       const symbols = stocksData?.map(stock => stock.symbol).filter(Boolean) as string[] ?? [];

//       if (symbols.length === 0) {
//         setLatestPrices({});
//         setLastPriceFetchTimestamp(new Date());
//       } else {
//         try {
//           const { data: priceResults, errors: priceErrors } = await client.queries.getLatestPrices({ symbols });

//           // It's important to check priceErrors first.
//           // If priceErrors exist, the operation might have partially or fully failed.
//           if (priceErrors) {
//             // Even if there are errors, priceResults might contain partial data.
//             // Decide if you want to process partial data or throw. Here, we throw.
//             throw priceErrors;
//           }

//           // Initialize priceMap with nulls for all requested symbols
//           symbols.forEach(s => priceMap[s] = null);

//           // Populate priceMap with successful results
//           // Ensure priceResults is not null/undefined before iterating
//           if (priceResults) {
//             priceResults.forEach(result => {
//               if (result && result.symbol) { // Ensure result and result.symbol are valid
//                 const validHistoricalCloses = (result.historicalCloses ?? [])
//                   .filter((hc): hc is HistoricalCloseData => hc !== null && hc !== undefined);
//                 priceMap[result.symbol] = {
//                   symbol: result.symbol,
//                   currentPrice: result.currentPrice ?? null,
//                   historicalCloses: validHistoricalCloses
//                 };
//               }
//             });
//           }
//         // This catch block is for errors specifically from client.queries.getLatestPrices
//         } catch (priceErr: any) {
//           console.error("[PriceContext.tsx] - Error fetching latest prices (inner catch):", priceErr);
//           let specificPriceErrMsg = "Failed to fetch prices"; // Default message
//           // If priceErr is an array (likely GraphQL errors from Amplify client)
//           if (Array.isArray(priceErr) && priceErr.length > 0 && priceErr[0].message) {
//             specificPriceErrMsg = priceErr[0].message;
//           } else if (priceErr.message) { // If it's a standard Error object
//             specificPriceErrMsg = priceErr.message;
//           }
//           setPricesError(specificPriceErrMsg);
//           // priceMap might be partially filled or empty, set it anyway
//           // Or, you might decide to set latestPrices to {} to clear stale data
//           // setLatestPrices({}); // Option: clear prices on any price fetch error
//         }

//         setLatestPrices(priceMap); // Update with whatever was successfully mapped or the initial nulls
//         setLastPriceFetchTimestamp(new Date());
//       }
//     } catch (err: any) { // Outer catch for stock fetching errors or other unexpected issues
//       console.error("[PriceContext.tsx] - Error in fetchLatestPricesForAllStocks (Outer catch):", err);
//       let outerErrMsg = "An unexpected error occurred";
//       if (Array.isArray(err) && err.length > 0 && err[0].message) { // Likely GraphQL errors from stock list
//         outerErrMsg = err[0].message;
//       } else if (err.message) {
//         outerErrMsg = err.message;
//       }
//       setPricesError(outerErrMsg);
//       setLatestPrices({}); // Reset prices on major failure
//     } finally {
//       setPricesLoading(false);
//     }
//   }, []);

//   const sendNotificationEmail = useCallback(async () => { /* ... */ }, [latestPrices]);

//   const value = {
//     latestPrices,
//     lastPriceFetchTimestamp,
//     pricesLoading,
//     pricesError,
//     fetchLatestPricesForAllStocks,
//     notifyStatus,
//     notifyError,
//     sendNotificationEmail
//   };

//   return <PriceContext.Provider value={value}>{children}</PriceContext.Provider>;
// };

// export const usePrices = (): PriceContextType => {
//   const context = useContext(PriceContext);
//   if (context === undefined) {
//     throw new Error('usePrices must be used within a PriceProvider');
//   }
//   return context;
// };
