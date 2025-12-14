"use client";

import React, {
  createContext,
  useState,
  useContext,
  useCallback,
  useEffect,
  ReactNode,
} from "react";
import { client } from "@/utils/amplify-client";

export interface HistoricalClose {
  date: string;
  close: number;
}

export interface PriceData {
  currentPrice: number | null;
  historicalCloses: HistoricalClose[];
}

type PriceMap = Record<string, PriceData>;

interface PriceContextType {
  prices: PriceMap;
  lastFetchTimestamp: Date | null;
  isLoading: boolean;
  error: string | null;
  progressMessage: string | null;
  fetchPrices: (symbols: string[]) => Promise<void>;
  clearPrice: (symbol: string) => void;
}

const PriceContext = createContext<PriceContextType | undefined>(undefined);

const BATCH_SIZE = 5;
const STORAGE_KEY_PRICES = "yahoo-finance-prices-v2";
const STORAGE_KEY_TIMESTAMP = "yahoo-finance-timestamp";

export function PriceProvider({ children }: { children: ReactNode }) {
  const [prices, setPrices] = useState<PriceMap>({});
  const [lastFetchTimestamp, setLastFetchTimestamp] = useState<Date | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progressMessage, setProgressMessage] = useState<string | null>(null);

  // Load persisted prices from localStorage on mount
  useEffect(() => {
    try {
      const storedPrices = localStorage.getItem(STORAGE_KEY_PRICES);
      const storedTimestamp = localStorage.getItem(STORAGE_KEY_TIMESTAMP);

      if (storedPrices) {
        setPrices(JSON.parse(storedPrices));
      }
      if (storedTimestamp) {
        setLastFetchTimestamp(new Date(storedTimestamp));
      }
    } catch (err) {
      console.error("Error loading prices from localStorage:", err);
    }
  }, []);

  const fetchPrices = useCallback(async (symbols: string[]) => {
    if (symbols.length === 0) return;

    setIsLoading(true);
    setError(null);
    setProgressMessage(null);

    const fetchedPrices: PriceMap = {};
    const totalBatches = Math.ceil(symbols.length / BATCH_SIZE);

    try {
      for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        setProgressMessage(`Fetching batch ${batchNum} of ${totalBatches}...`);

        const batchSymbols = symbols.slice(i, i + BATCH_SIZE);
        const { data, errors } = await client.queries.getLatestPrices({
          symbols: batchSymbols,
        });

        if (errors) {
          console.error("Batch error:", errors);
          continue;
        }

        if (data) {
          data.forEach((result) => {
            if (result?.symbol) {
              fetchedPrices[result.symbol] = {
                currentPrice: result.currentPrice ?? null,
                historicalCloses: (result.historicalCloses ?? []).map((hc) => ({
                  date: hc?.date ?? "",
                  close: hc?.close ?? 0,
                })),
              };
            }
          });
        }
      }

      const newPrices = { ...fetchedPrices };
      const newTimestamp = new Date();

      // Update state
      setPrices(newPrices);
      setLastFetchTimestamp(newTimestamp);

      // Persist to localStorage
      try {
        localStorage.setItem(STORAGE_KEY_PRICES, JSON.stringify(newPrices));
        localStorage.setItem(STORAGE_KEY_TIMESTAMP, newTimestamp.toISOString());
      } catch (err) {
        console.error("Error saving prices to localStorage:", err);
      }
    } catch (err) {
      console.error("Price fetch error:", err);
      setError("Failed to fetch prices");
    } finally {
      setIsLoading(false);
      setProgressMessage(null);
    }
  }, []);

  // Clear a specific symbol's price (used when testPrice is saved)
  const clearPrice = useCallback((symbol: string) => {
    setPrices((prev) => {
      const newPrices = { ...prev };
      delete newPrices[symbol];

      // Persist to localStorage
      try {
        localStorage.setItem(STORAGE_KEY_PRICES, JSON.stringify(newPrices));
      } catch (err) {
        console.error("Error saving prices to localStorage:", err);
      }

      return newPrices;
    });
  }, []);

  return (
    <PriceContext.Provider
      value={{
        prices,
        lastFetchTimestamp,
        isLoading,
        error,
        progressMessage,
        fetchPrices,
        clearPrice,
      }}
    >
      {children}
    </PriceContext.Provider>
  );
}

export function usePrices() {
  const context = useContext(PriceContext);
  if (!context) {
    throw new Error("usePrices must be used within PriceProvider");
  }
  return context;
}
