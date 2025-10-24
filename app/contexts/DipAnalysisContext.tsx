// app/contexts/DipAnalysisContext.tsx
'use client';

import React, { createContext, useState, useContext, useCallback, ReactNode, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';
import { analyzeDipRecoveryCycles, type AnalysisResult, type AnalysisOptions } from '@/app/utils/dipRecoveryAnalysis';

const client = generateClient<Schema>();

interface HistoricalClose {
  date: string;
  close: number;
}

interface StockDataResult {
  symbol: string;
  currentPrice: number | null;
  historicalCloses: HistoricalClose[];
}

interface StoredAnalysisInfo {
  results: Record<string, AnalysisResult>;
  timestamp: string | null;
}

interface DipAnalysisContextType {
  analysisResults: Record<string, AnalysisResult>;
  lastAnalysisTimestamp: Date | null;
  analysisLoading: boolean;
  analysisError: string | null;
  progressMessage: string | null;
  analyzeDipsForSymbol: (
    symbol: string,
    months: number,
    options?: AnalysisOptions
  ) => Promise<AnalysisResult | null>;
  clearAnalysisResults: () => void;
}

const DipAnalysisContext = createContext<DipAnalysisContextType | undefined>(undefined);
const ANALYSIS_STORAGE_KEY = 'portfolioAppDipAnalysis';

export const DipAnalysisProvider = ({ children }: { children: ReactNode }) => {
  const [analysisResults, setAnalysisResults] = useState<Record<string, AnalysisResult>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const storedDataString = window.localStorage.getItem(ANALYSIS_STORAGE_KEY);
        if (storedDataString) {
          const storedData: StoredAnalysisInfo = JSON.parse(storedDataString);
          return storedData.results || {};
        }
      } catch {
        // Silently handle errors
      }
    }
    return {};
  });

  const [lastAnalysisTimestamp, setLastAnalysisTimestamp] = useState<Date | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const storedDataString = window.localStorage.getItem(ANALYSIS_STORAGE_KEY);
        if (storedDataString) {
          const storedData: StoredAnalysisInfo = JSON.parse(storedDataString);
          return storedData.timestamp ? new Date(storedData.timestamp) : null;
        }
      } catch {
        window.localStorage.removeItem(ANALYSIS_STORAGE_KEY);
      }
    }
    return null;
  });

  const [analysisLoading, setAnalysisLoading] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [progressMessage, setProgressMessage] = useState<string | null>(null);

  // Save to localStorage whenever results change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const dataToStore: StoredAnalysisInfo = {
          results: analysisResults,
          timestamp: lastAnalysisTimestamp?.toISOString() ?? null
        };
        window.localStorage.setItem(ANALYSIS_STORAGE_KEY, JSON.stringify(dataToStore));
      } catch {
        // Silently handle errors
      }
    }
  }, [analysisResults, lastAnalysisTimestamp]);

  /**
   * Analyze dip-recovery cycles for a specific stock symbol
   */
  const analyzeDipsForSymbol = useCallback(async (
    symbol: string,
    months: number = 6,
    options: AnalysisOptions = {}
  ): Promise<AnalysisResult | null> => {
    if (!symbol || !symbol.trim()) {
      setAnalysisError('Please provide a valid stock symbol');
      return null;
    }

    setAnalysisLoading(true);
    setAnalysisError(null);
    setProgressMessage('Fetching historical data...');

    try {
      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(endDate.getMonth() - months);

      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      console.log(`[DipAnalysisContext] Fetching ${months}-month data for ${symbol.toUpperCase()} from ${startDateStr} to ${endDateStr}`);

      // Fetch historical data from Lambda
      const response = await client.queries.getHistoricalData({
        symbols: [symbol.toUpperCase()],
        startDate: startDateStr,
        endDate: endDateStr
      });

      if (response.errors) {
        const errorMsg = response.errors[0].message || 'Failed to fetch historical data';
        throw new Error(errorMsg);
      }

      const data = response.data as StockDataResult[];

      if (!data || data.length === 0) {
        throw new Error('No data returned for the symbol');
      }

      const stockData = data[0];

      if (!stockData.historicalCloses || stockData.historicalCloses.length === 0) {
        throw new Error(`No historical data found for ${symbol.toUpperCase()}`);
      }

      console.log(`[DipAnalysisContext] Retrieved ${stockData.historicalCloses.length} data points for ${symbol.toUpperCase()}`);

      // Perform analysis
      setProgressMessage('Analyzing dip-recovery patterns...');

      const analysisResult = analyzeDipRecoveryCycles(
        stockData.historicalCloses,
        symbol.toUpperCase(),
        options
      );

      console.log(`[DipAnalysisContext] Analysis complete. Found ${analysisResult.statistics.totalDips} dip events`);

      // Store result
      setAnalysisResults(prev => ({
        ...prev,
        [symbol.toUpperCase()]: analysisResult
      }));

      setLastAnalysisTimestamp(new Date());
      setProgressMessage(null);

      return analysisResult;

    } catch (err: unknown) {
      console.error('[DipAnalysisContext] Error analyzing dips:', err);
      const errorMessage = (err as Error).message || 'Failed to analyze dip patterns';
      setAnalysisError(errorMessage);
      setProgressMessage(null);
      return null;
    } finally {
      setAnalysisLoading(false);
    }
  }, []);

  /**
   * Clear all stored analysis results
   */
  const clearAnalysisResults = useCallback(() => {
    setAnalysisResults({});
    setLastAnalysisTimestamp(null);
    setAnalysisError(null);
    setProgressMessage(null);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(ANALYSIS_STORAGE_KEY);
    }
  }, []);

  return (
    <DipAnalysisContext.Provider
      value={{
        analysisResults,
        lastAnalysisTimestamp,
        analysisLoading,
        analysisError,
        progressMessage,
        analyzeDipsForSymbol,
        clearAnalysisResults
      }}
    >
      {children}
    </DipAnalysisContext.Provider>
  );
};

/**
 * Hook to use the DipAnalysis context
 */
export const useDipAnalysis = () => {
  const context = useContext(DipAnalysisContext);
  if (context === undefined) {
    throw new Error('useDipAnalysis must be used within a DipAnalysisProvider');
  }
  return context;
};
