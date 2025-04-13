// app/contexts/PriceContext.tsx
'use client';

import React, { createContext, useState, useContext, useCallback, ReactNode, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource'; // Adjust path

const client = generateClient<Schema>();

interface HistoricalCloseData { date: string; close: number; } // Match schema type (Date is string after JSON)
interface PriceData {
  symbol: string; // Optional but good practice
  currentPrice: number | null;
  historicalCloses: HistoricalCloseData[];
}

// Type for the price map
type PriceMap = Record<string, PriceData | null>; // Symbol -> PriceData or null if fetch failed for symbol

// --- NEW: Type for combined data in Local Storage ---
interface StoredPriceInfo {
  prices: PriceMap;
  timestamp: string | null; // Store timestamp as ISO string
}
// ---

// Type for the context value
interface PriceContextType {
  latestPrices: PriceMap;
  lastPriceFetchTimestamp: Date | null;
  pricesLoading: boolean;
  pricesError: string | null;
  fetchLatestPricesForAllStocks: () => Promise<void>; // Function to trigger fetch
  notifyStatus: 'idle' | 'sending' | 'success' | 'error';
  notifyError: string | null;
  sendNotificationEmail: () => Promise<void>;
}

// Create the context with a default value
const PriceContext = createContext<PriceContextType | undefined>(undefined);

const PRICES_STORAGE_KEY = 'portfolioAppLatestPrices';

// Create the Provider component
export const PriceProvider = ({ children }: { children: ReactNode }) => {

  // --- CORRECTED: Initialize BOTH states directly from Local Storage ---
  const [latestPrices, setLatestPrices] = useState<PriceMap>(() => {
    // Reads the combined object but only returns the 'prices' part
    if (typeof window !== 'undefined') {
      try {
        const storedDataString = window.localStorage.getItem(PRICES_STORAGE_KEY);
        if (storedDataString) {
          const storedData: StoredPriceInfo = JSON.parse(storedDataString);
          //console.log("Initializing latestPrices from localStorage data:", storedData?.prices);
          return storedData.prices || {}; // Extract 'prices' property
        }
      } catch (error) {
        //console.error("Error reading/parsing stored prices state:", error);
        // Don't clear storage here, let timestamp try
      }
    }
    //console.log("Initializing latestPrices with: {} (default)");
    return {}; // Default empty object
  });

  const [lastPriceFetchTimestamp, setLastPriceFetchTimestamp] = useState<Date | null>(() => {
    // Reads the combined object but only returns the 'timestamp' part (as a Date)
    if (typeof window !== 'undefined') {
      try {
        const storedDataString = window.localStorage.getItem(PRICES_STORAGE_KEY);
        //console.log("Attempting to initialize timestamp. Found string:", storedDataString);
        if (storedDataString) {
          const storedData: StoredPriceInfo = JSON.parse(storedDataString);
          //console.log("Parsed stored data for timestamp:", storedData);
          const loadedTimestamp = storedData.timestamp ? new Date(storedData.timestamp) : null;
          //console.log("Initializing lastPriceFetchTimestamp with:", loadedTimestamp);
          return loadedTimestamp; // Extract 'timestamp' property and convert to Date
        }
      } catch (error) {
        //console.error("Error reading/parsing stored timestamp state:", error);
        // Clear storage only if parsing fails completely
        window.localStorage.removeItem(PRICES_STORAGE_KEY);
      }
    }
    //console.log("Initializing lastPriceFetchTimestamp with: null (default)");
    return null; // Default null
  });
  // --- End Corrected Initialization ---


  // Other state variables (pricesLoading, etc.) are fine
  const [pricesLoading, setPricesLoading] = useState<boolean>(false);
  const [pricesError, setPricesError] = useState<string | null>(null);
  const [notifyStatus, setNotifyStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [notifyError, setNotifyError] = useState<string | null>(null);

  useEffect(() => {
    // ... check window !== undefined ...
    try {
       const dataToStore: StoredPriceInfo = {
           prices: latestPrices,
           // Converts Date object to ISO string, should be the NEW date
           timestamp: lastPriceFetchTimestamp?.toISOString() ?? null
       };
       //console.log("Attempting to save state to localStorage:", dataToStore); // <<< Log 1
       window.localStorage.setItem(PRICES_STORAGE_KEY, JSON.stringify(dataToStore));
    } catch (error) { /* ... */ }
    // Runs whenever latestPrices OR lastPriceFetchTimestamp changes
  }, [latestPrices, lastPriceFetchTimestamp]);
  // --- End Save Effect ---


  // --- Functions (fetchLatestPricesForAllStocks, sendNotificationEmail) ---
  const fetchLatestPricesForAllStocks = useCallback(async () => {
    //console.log('Triggering fetch for all stock prices...');
    setPricesLoading(true);
    setPricesError(null);
    // Optional: Decide whether to clear prices immediately or show stale during load
    // setLatestPrices({});
 
    // --- Declare priceMap OUTSIDE the inner try ---
    let priceMap: PriceMap = {}; // Use let, initialize empty
 
    try { // Outer try for fetching stocks
      const { data: stocks, errors: stockErrors } = await client.models.PortfolioStock.list({ selectionSet: ['symbol'] });
      if (stockErrors) throw stockErrors;
      const symbols = stocks?.map(stock => stock?.symbol).filter(Boolean) as string[] ?? [];
 
      if (symbols.length === 0) {
        //console.log('No stocks found to fetch prices for.');
        setLatestPrices({}); // Set empty prices
        setLastPriceFetchTimestamp(new Date()); // Update timestamp to now
      } else {
        // If symbols exist, proceed to fetch prices
        //console.log('Fetching prices from backend for symbols:', symbols);
        try { // Inner try specifically for fetching prices
          const { data: priceResults, errors: priceErrors } = await client.queries.getLatestPrices({ symbols });
          if (priceErrors) throw priceErrors;
 
          // Initialize the outer priceMap with nulls for all symbols requested
          symbols.forEach(s => priceMap[s] = null);
          // Populate the outer priceMap with successful results
          if (priceResults) {
            priceResults.forEach(result => {
              if (result) {
                 const validHistoricalCloses = (result.historicalCloses ?? [])
                    .filter((hc): hc is HistoricalCloseData => hc !== null && hc !== undefined);
                 priceMap[result.symbol] = {
                     symbol: result.symbol,
                     currentPrice: result.currentPrice ?? null,
                     historicalCloses: validHistoricalCloses
                 };
              }
            });
          }
          // priceMap is now populated (or partially if some symbols failed)
 
        } catch (priceErr: any) {
          console.error("Error fetching latest prices:", priceErr);
          const priceErrMsg = Array.isArray(priceErr.errors) ? priceErr.errors[0].message : (priceErr.message || "Failed to fetch prices");
          setPricesError(priceErrMsg);
          // Keep priceMap as is (potentially partial), state will be updated below
        }
 
        // --- Update State AFTER inner try/catch completes ---
        // priceMap is accessible here
        setLatestPrices(priceMap);
        setLastPriceFetchTimestamp(new Date()); // Update timestamp when fetch attempt finishes
        //console.log('Prices updated in context:', priceMap);
 
      } // End else block (symbols.length > 0)
 
    } catch (err: any) { // Outer catch block for stock fetch errors etc.
      console.error("Error in fetchLatestPricesForAllStocks (Outer):", err);
      const errorMessage = Array.isArray(err.errors) ? err.errors[0].message : (err.message || "Failed to fetch stocks or prices");
      setPricesError(errorMessage);
      setLatestPrices({}); // Reset prices on major failure
      // Maybe set timestamp here too? Or leave it as the last successful fetch? Leaving it for now.
      // setLastPriceFetchTimestamp(new Date());
    } finally {
      setPricesLoading(false); // Ensure loading is always set false at the end
    }
  }, []); // Dependencies

  const sendNotificationEmail = useCallback(async () => { /* ... */ }, [latestPrices]);

  // --- Context Value (ensure timestamp is included) ---
  const value = {
    latestPrices,
    lastPriceFetchTimestamp, // Make sure this is included
    pricesLoading,
    pricesError,
    fetchLatestPricesForAllStocks,
    notifyStatus,
    notifyError,
    sendNotificationEmail
  };

  return <PriceContext.Provider value={value}>{children}</PriceContext.Provider>;
};

// Custom hook for easy context consumption
export const usePrices = (): PriceContextType => {
  const context = useContext(PriceContext);
  if (context === undefined) {
    throw new Error('usePrices must be used within a PriceProvider');
  }
  return context;
};