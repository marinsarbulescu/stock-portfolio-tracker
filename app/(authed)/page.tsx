// app/(authed)/page.tsx
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';
import { usePrices } from '@/app/contexts/PriceContext'; // Import context hook
import Link from 'next/link';

// Define types locally matching schema if needed (or import if shared)
type PortfolioStockDataType = { // Simplified representation needed for this page
    id: string;
    symbol: string;
    pdp: number | null | undefined;
    name?: string | null | undefined;
    // Add other fields if needed by the table/sort
}

type FiveDayDipResult = Record<string, number | null>; // Map: symbol -> dip percentage or null

// Define Transaction List Result Type (helpful for pagination function)
type TransactionListResultType = Awaited<ReturnType<typeof client.models.Transaction.list>>;

const client = generateClient<Schema>();

export default function HomePage() {
    // Define the shape of the visibility state
    interface ReportColumnVisibilityState {
        fiveDayDip: boolean;
        lbd: boolean;
        buys: boolean;
        incompleteBuys: boolean;
        sinceBuy: boolean;
        sinceSell: boolean;
        currentPrice: boolean;
        percentToBe: boolean;
        ltpiaTakeProfitPrice: boolean,
        percentToTp: boolean;
        tpShares: boolean;
    }
    
    // Initialize the state (decide defaults - here all are visible initially)
    const [reportColumnVisibility, setReportColumnVisibility] = useState<ReportColumnVisibilityState>({
        fiveDayDip: true,
        lbd: true,
        buys: false,
        incompleteBuys: true,
        sinceBuy: true,
        sinceSell: false,
        currentPrice: true,
        percentToBe: false,
        ltpiaTakeProfitPrice: true,
        percentToTp: true,
        tpShares: false,
    });

    // Mapping from state keys to desired display labels
    const COLUMN_LABELS: Record<keyof ReportColumnVisibilityState, string> = {
        fiveDayDip: '5DD',      // Custom Label
        lbd: 'LBD',         // Custom Label
        buys: 'Buys',
        incompleteBuys: 'I-Buys',
        sinceBuy: 'Last Buy',
        sinceSell: 'Last Sell',
        currentPrice: 'Price',
        percentToBe: '%2BE',          // Custom Label
        ltpiaTakeProfitPrice: 'TP',
        percentToTp: '%2TP',          // Custom Label
        tpShares: 'TP-Shs'        // Custom Label
    };
    
    const [portfolioStocks, setPortfolioStocks] = useState<PortfolioStockDataType[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Add state for all transactions
    const [allTransactions, setAllTransactions] = useState<Schema['Transaction'][]>([]);
    // Add loading/error state specifically for transactions if desired
    //const [isTxnLoading, setIsTxnLoading] = useState(true);
    //const [txnError, setTxnError] = useState<string | null>(null);

    // Get price data from context
    const { latestPrices, pricesLoading, pricesError, lastPriceFetchTimestamp } = usePrices(); // <-- Add timestamp

    // Helper function (place inside component or import from utils)
    const formatTimestamp = (date: Date | null): string => {
        if (!date) return "N/A";
        // Options for formatting like "Apr 12th 1:58 PM PDT"
        // 'th'/'st' (ordinals) usually require a library like date-fns or manual logic.
        // Intl.DateTimeFormat provides good browser-native formatting.
        try {
            return new Intl.DateTimeFormat('en-US', {
                month: 'short',    // Apr
                day: 'numeric',    // 12
                hour: 'numeric',   // 1 PM / 13
                minute: '2-digit', // 58
                hour12: true,     // Use AM/PM
                timeZoneName: 'short' // Attempts to get PDT/PST etc. based on *user's* browser timezone
            }).format(date);
        } catch (e) {
            console.error("Error formatting date:", e);
            return date.toLocaleDateString(); // Fallback
        }
    }
    
    // --- Helper function to fetch ALL transactions using pagination ---
    const fetchAllPaginatedTransactions = useCallback(async (): Promise<Schema['Transaction'][]> => {
        //console.log("Fetching ALL user transactions with pagination...");
        let accumulatedTxns: Schema['Transaction'][] = [];
        let currentToken: string | null = null;
        let loopSafetyCounter = 0;
        const maxLoops = 25; // Adjust max pages if needed

        // --- IMPORTANT: Define the full selectionSet needed by ANY calculation using allTransactions ---
        const selectionSetNeeded = [
            'id', 'date', 'action', 'price', 'portfolioStockId',
            'tp', 'completedTxnId', 'playShares', 'investment',
            'quantity', 'holdShares', 'sharesType'
        ] as const;
        // --- END selectionSet definition ---

        try {
            do {
                loopSafetyCounter++;
                if (loopSafetyCounter > maxLoops) {
                    console.warn("Exceeded maximum pagination loops fetching all transactions.");
                    throw new Error(`Could not fetch all transactions after ${maxLoops} pages.`);
                }

                //console.log(`Workspaceing transaction page with token: ${currentToken ? '...' : 'null'}`);
                const listResult: TransactionListResultType = await client.models.Transaction.list({
                    nextToken: currentToken,
                    limit: 5000, // Fetch larger chunks
                    selectionSet: selectionSetNeeded // Use defined selectionSet
                });

                const fetchedTxns = listResult.data;
                const errors = listResult.errors;
                const returnedToken = listResult.nextToken ?? null;

                //console.log(`Workspaceed ${fetchedTxns?.length ?? 0} transactions. Next Token: ${returnedToken ? 'Yes' : 'No'}`);

                if (errors) throw errors; // Throw GraphQL errors

                if (fetchedTxns) {
                    accumulatedTxns = [...accumulatedTxns, ...(fetchedTxns as any)];
                }
                currentToken = returnedToken;

            } while (currentToken !== null);

            //console.log(`Finished fetching. Total user transactions: ${accumulatedTxns.length}`);
            return accumulatedTxns;

        } catch (err: any) {
            console.error('Error during paginated transaction fetch:', err);
            const errMsg = Array.isArray(err?.errors) ? err.errors[0].message : (err.message || 'Failed to load all transactions.');
            throw new Error(errMsg); // Re-throw to be caught by fetchPageData
        }
    }, []); // Empty dependency array - stable function definition
    // --- End Helper Function ---


    // --- Updated function to fetch both stocks and ALL transactions ---
    const fetchPageData = useCallback(async () => {
        setIsLoading(true); // Use combined loading state
        setError(null);     // Use combined error state
        // Clear previous data? Optional, but can prevent displaying stale data on refetch
        // setPortfolioStocks([]);
        // setAllTransactions([]);

        try {
            //console.log("Starting parallel fetch for stocks and all transactions...");
            // Fetch stocks AND use the pagination helper for transactions
            const [stockResult, allTxnsData] = await Promise.all([
                client.models.PortfolioStock.list({
                    selectionSet: ['id', 'symbol', 'pdp', 'name'], // Fields needed for report
                    filter: {
                        isHidden: { ne: true } // ne: not equal to true (i.e., fetch if false or null/undefined)
                        // Or you could use: isHidden: { eq: false } if you are sure all items will have the field set
                    }
                }),
                fetchAllPaginatedTransactions() // Call the pagination helper
            ]);
            //console.log("Parallel fetches completed.");

            // Process stocks result (basic error check)
            if (stockResult && Array.isArray((stockResult as any).errors) && (stockResult as any).errors.length > 0) {
                 throw (stockResult as any).errors;
            }
            setPortfolioStocks(stockResult.data as any);

            // Transactions data is the complete array from the helper
            setAllTransactions(allTxnsData);

            //console.log('Fetched Stocks Count:', stockResult.data?.length);
            //console.log('Fetched All Transactions Count:', allTxnsData?.length);

        } catch (err: any) {
            console.error("Error fetching page data:", err);
            const errorMessage = Array.isArray(err?.errors) ? err.errors[0].message : (err.message || "Failed to load page data.");
            setError(errorMessage); // Set combined error state
            // Clear data on error
            setPortfolioStocks([]);
            setAllTransactions([]);
        } finally {
            setIsLoading(false); // Set combined loading state false
        }
    }, [fetchAllPaginatedTransactions]); // Add helper to dependencies
    // --- End Updated fetchPageData ---
    
    useEffect(() => {
        fetchPageData();
    }, [fetchPageData]); // Renamed fetch function


    interface ProcessedStockTxnData {
        lastBuy?: { date: string; price: number | null }; // Store only needed info
        lastSell?: { date: string };
        buyCount: number;
        ltpiaPrice?: number | null;
        ltpiaTp?: number | null;
        ltpiaPlayShares?: number | null;
        currentPlayShares: number;
        currentHoldShares: number;
        totalCurrentShares: number;
        incompleteBuyCount: number;
    }
    type ProcessedTxnMap = Record<string, ProcessedStockTxnData>; // Keyed by stock ID

    const processedTxns = useMemo((): ProcessedTxnMap => {
        //console.log(`Processing ${allTransactions.length} transactions for share balances...`);
        const dataMap: ProcessedTxnMap = {};

        // --- Find all completed Buy Txn IDs first (needs one pass) ---
        const completedBuyTxnIds = new Set<string>();
        allTransactions.forEach(txn => {
            // @ts-ignore
            if (txn.action === 'Sell' && txn.completedTxnId) {
                 // @ts-ignore
                completedBuyTxnIds.add(txn.completedTxnId);
            }
        });
        // --- End Find Completed ---

        // --- Process data PER STOCK ---
        portfolioStocks.forEach(stock => {
            const stockId = stock.id;
            if (!stockId) return;

            // Initialize data structure for this stock
            const stockData: ProcessedStockTxnData = {
                buyCount: 0,
                currentPlayShares: 0,
                currentHoldShares: 0,
                totalCurrentShares: 0,
                incompleteBuyCount: 0, // Initialize new field
                ltpiaPrice: null,
                ltpiaTp: null,
                ltpiaPlayShares: null,
            };

            const stockTxns = allTransactions.filter(txn => (txn as any).portfolioStockId === stockId);
            const sortedStockTxns = [...stockTxns].sort((a, b) => {
                const dateA = (a as any).date ?? ''; const dateB = (b as any).date ?? '';
                return dateA.localeCompare(dateB); // Ascending for balance
            });

            // --- Calculate running balances, counts, and find latest dates/info ---
            let runningPlayShares = 0;
            let runningHoldShares = 0;
            let lowestTpIncompleteBuy: Schema['Transaction'] | null = null;
            let calculatedIncompleteBuys = 0; // Counter for incomplete buys

            sortedStockTxns.forEach(txn => {
                const action = (txn as any).action;
                const playSharesTxn = typeof (txn as any).playShares === 'number' ? (txn as any).playShares : 0;
                const holdSharesTxn = typeof (txn as any).holdShares === 'number' ? (txn as any).holdShares : 0;
                const quantityTxn = typeof (txn as any).quantity === 'number' ? (txn as any).quantity : 0;
                const sharesTypeTxn = (txn as any).sharesType;
                const date = (txn as any).date;
                const price = (txn as any).price;
                const id = (txn as any).id;
                const tp = (txn as any).tp;
                const isCompleted = completedBuyTxnIds.has(id); // Check completion status

                if (action === 'Buy') {
                    stockData.buyCount++;
                    if (!stockData.lastBuy || (date && date >= stockData.lastBuy.date)) {
                        stockData.lastBuy = { date: date, price: price ?? null };
                    }
                    runningPlayShares += playSharesTxn;
                    runningHoldShares += holdSharesTxn;

                    // Increment incomplete count if this Buy is not completed
                    if (!isCompleted) {
                        calculatedIncompleteBuys++;
                    }

                    // Check for LTPIA candidacy (incomplete buy with a TP)
                    if (!isCompleted && typeof tp === 'number') {
                        if (lowestTpIncompleteBuy === null || tp < (lowestTpIncompleteBuy as any).tp) {
                            lowestTpIncompleteBuy = txn;
                        }
                    }

                } else if (action === 'Sell') {
                    if (!stockData.lastSell || (date && date >= stockData.lastSell.date)) {
                        stockData.lastSell = { date: date };
                    }
                    if (sharesTypeTxn === 'Play') {
                        runningPlayShares -= quantityTxn;
                    } else if (sharesTypeTxn === 'Hold') {
                        runningHoldShares -= quantityTxn;
                    }
                }
            }); // End loop through stock's transactions

            // Store final calculated balances and counts
            stockData.currentPlayShares = runningPlayShares;
            stockData.currentHoldShares = runningHoldShares;
            stockData.totalCurrentShares = Math.max(0, runningPlayShares + runningHoldShares);
            stockData.incompleteBuyCount = calculatedIncompleteBuys; // Store the count

            // --- Store LTPIA details ---
            const finalLTPIA = lowestTpIncompleteBuy as any;
            stockData.ltpiaPrice = finalLTPIA?.price ?? null;
            stockData.ltpiaTp = finalLTPIA?.tp ?? null;
            stockData.ltpiaPlayShares = finalLTPIA?.playShares ?? null;

            dataMap[stockId] = stockData;

        }); // End loop through portfolioStocks

        return dataMap;
    }, [allTransactions, portfolioStocks]); // Dependencies


    interface ReportDataItem {
        id: string;
        symbol: string;
        currentPrice: number | null;
        fiveDayDip: number | null; // Calculated 5DD percentage
        lbd: number | null;        // Calculated LBD percentage
        sinceBuy: number | null;   // Days
        sinceSell: number | null;  // Days
        buys: number;            // Count
        percentToBe: number | null;
        ltpiaTakeProfitPrice: number | null;
        percentToTp: number | null;
        tpShares: number | null;
        totalCurrentShares: number;
        incompleteBuyCount: number;
      }

    function calculateDaysAgo(dateString: string | null | undefined): number | null {
        if (!dateString) return null;
        try {
          // Parse YYYY-MM-DD assuming UTC or consistent local timezone interpretation
          const pastDate = new Date(dateString + 'T00:00:00Z'); // Treat as UTC midnight
          const today = new Date();
          today.setUTCHours(0, 0, 0, 0); // Compare with today's UTC midnight
      
          const diffTime = today.getTime() - pastDate.getTime();
          if (diffTime < 0) return 0; // Or handle future dates if possible? Default to 0 days ago.
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          return diffDays;
        } catch (e) {
          console.error("Error parsing date for diff calculation:", dateString, e);
          return null;
        }
    }


    // --- Calculate Final Report Data (Phase 3) ---
    const reportData = useMemo((): ReportDataItem[] => {
        //console.log("Calculating report data...");

        return portfolioStocks.map(stock => {
            const stockId: string = stock.id;
            const symbol: string = stock.symbol;
            const pdp: number | null | undefined = stock.pdp;
            const priceData = latestPrices[symbol];
            // Ensure default includes new fields
            const txnData = processedTxns[stockId] ?? {
                buyCount: 0,
                currentPlayShares: 0,
                currentHoldShares: 0,
                totalCurrentShares: 0,
                incompleteBuyCount: 0, // Default for incomplete count
                ltpiaPrice: null,
                ltpiaTp: null,
                ltpiaPlayShares: null,
                lastBuy: undefined,
                lastSell: undefined,
            };
            const currentPrice = priceData?.currentPrice ?? null;


            // --- Calculations for 5DD, LBD, %2BE, %2TP ---
            let fiveDayDipPercent: number | null = null;
            if (typeof currentPrice === 'number' && typeof pdp === 'number' && priceData?.historicalCloses) {
                const historicalCloses = priceData.historicalCloses ?? [];
                const last5Closes = historicalCloses.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
                if (last5Closes.length > 0) {
                    let minDipMeetingCondition: number | null = null;
                    last5Closes.forEach(pastClose => {
                         if (pastClose.close > 0) {
                           const diffPercent = (currentPrice / pastClose.close - 1) * 100;
                           if (diffPercent <= (pdp * -1)) { // User's specific logic here
                               if (minDipMeetingCondition === null || diffPercent < minDipMeetingCondition) {
                                   minDipMeetingCondition = diffPercent;
                               }
                           }
                         }
                    });
                    fiveDayDipPercent = minDipMeetingCondition;
                }
            }

            let lbdPercent: number | null = null;
            const lastBuyPrice = txnData.lastBuy?.price;
            if (typeof currentPrice === 'number' && typeof lastBuyPrice === 'number' && typeof pdp === 'number' && lastBuyPrice > 0) {
                const diffPercent = (currentPrice / lastBuyPrice - 1) * 100;
                if (diffPercent <= (pdp * -1)) { // User's specific logic here
                    lbdPercent = diffPercent;
                }
            }

            let percentToBe: number | null = null;
            const ltpiaPrice = txnData.ltpiaPrice;
            if (typeof currentPrice === 'number' && typeof ltpiaPrice === 'number' && ltpiaPrice > 0) {
                percentToBe = (currentPrice / ltpiaPrice - 1) * 100;
            }

            let percentToTp: number | null = null;
            const ltpiaTakeProfitPrice = txnData.ltpiaTp;
            if (typeof currentPrice === 'number' && typeof ltpiaTakeProfitPrice === 'number' && ltpiaTakeProfitPrice > 0) {
                percentToTp = (currentPrice / ltpiaTakeProfitPrice - 1) * 100;
            }
            // --- End Calculations ---


            const sinceBuyDays = calculateDaysAgo(txnData.lastBuy?.date);
            const sinceSellDays = calculateDaysAgo(txnData.lastSell?.date);
            const buyCount = txnData.buyCount; // Total buys
            const tpSharesValue = txnData.ltpiaPlayShares;
            const totalShares = txnData.totalCurrentShares;
            const incompleteBuys = txnData.incompleteBuyCount; // Get the count


            // Return combined data object
            return {
                id: stockId,
                symbol: symbol,
                currentPrice: currentPrice,
                fiveDayDip: fiveDayDipPercent,
                lbd: lbdPercent,
                percentToBe: percentToBe,
                ltpiaTakeProfitPrice: ltpiaTakeProfitPrice ?? null, // Keep previous fix
                percentToTp: percentToTp,
                tpShares: tpSharesValue ?? null,
                sinceBuy: sinceBuyDays,
                sinceSell: sinceSellDays,
                buys: buyCount, // Total buys
                totalCurrentShares: totalShares,
                 // --- Assign Incomplete Buys Count ---
                incompleteBuyCount: incompleteBuys,
            };
        });
    }, [portfolioStocks, latestPrices, processedTxns]); // Dependencies


    // Calculate the number of currently visible columns
    const visibleColumnCount = useMemo(() => {
        // Start with columns that are always visible (e.g., Ticker)
        let count = 1;
        // Add count of toggleable columns that are currently true
        count += (Object.values(reportColumnVisibility) as boolean[]).filter(Boolean).length;
        return count;
    }, [reportColumnVisibility]);
    
    
    type ReportColumnKey = 'symbol' | 'currentPrice' | 'fiveDayDip' | 'lbd' | 'sinceBuy' |
         'sinceSell' | 'buys' | 'incompleteBuyCount' | 'percentToBe' | 'percentToTp' | 'ltpiaTakeProfitPrice' | 'tpShares';
    const [sortConfig, setSortConfig] = useState<{ key: ReportColumnKey; direction: 'ascending' | 'descending' } | null>(null);

    const sortedTableData = useMemo(() => {
        // Start with the calculated report data
        let sortableItems = [...reportData];
    
        // Helper function to handle nulls/undefined for ASCENDING sort
        // Treats null/undefined as infinitely large so they sort last
        const handleNullAsc = (val: number | null | undefined): number => {
            return (val === null || val === undefined) ? Infinity : val;
        };
    
        if (sortConfig !== null) {
            // --- User has clicked a header - Sort by selected column ---
    
            // Helper to handle nulls based on the CURRENT sort direction
            const handleNullCurrent = (val: any) => {
               if (val === null || val === undefined) {
                  // Ascending: Nulls go last (Infinity). Descending: Nulls go last (-Infinity).
                  return sortConfig.direction === 'ascending' ? Infinity : -Infinity;
               }
               return val;
            }
    
            sortableItems.sort((a, b) => {
                // @ts-ignore - Allow property access using key (known TS issue)
                const valA = a[sortConfig.key];
                // @ts-ignore - Allow property access using key
                const valB = b[sortConfig.key];
                let comparison = 0;
    
                const resolvedA = handleNullCurrent(valA);
                const resolvedB = handleNullCurrent(valB);
    
                if (resolvedA < resolvedB) comparison = -1;
                else if (resolvedA > resolvedB) comparison = 1;
    
                return sortConfig.direction === 'ascending' ? comparison : comparison * -1;
            });
        } else {
            // --- Default sort: LBD ascending (nulls last), then 5DD ascending (nulls last) ---
            sortableItems.sort((a, b) => {
                // Helper function remains the same: maps null/undefined to Infinity
                const handleNullAsc = (val: number | null | undefined): number => {
                    return (val === null || val === undefined) ? Infinity : val;
                };
      
                // Get LBD values, applying null handling
                // @ts-ignore - Allow property access
                const lbdA = handleNullAsc(a.lbd);
                // @ts-ignore - Allow property access
                const lbdB = handleNullAsc(b.lbd);
      
                // Compare LBD values using explicit checks, not just subtraction
                if (lbdA < lbdB) return -1;
                if (lbdA > lbdB) return 1;
      
                // If LBDs are equal (including both being null/Infinity), compare by 5DD
                // @ts-ignore - Allow property access
                const fiveDayDipA = handleNullAsc(a.fiveDayDip);
                // @ts-ignore - Allow property access
                const fiveDayDipB = handleNullAsc(b.fiveDayDip);
      
                // Compare 5DD values using explicit checks
                if (fiveDayDipA < fiveDayDipB) return -1;
                if (fiveDayDipA > fiveDayDipB) return 1;
      
                // If both LBD and 5DD are equal, maintain original order
                return 0;
            });
        }
        return sortableItems;
      }, [reportData, sortConfig]); // Dependencies

    const requestSort = (key: ReportColumnKey) => {
         let direction: 'ascending' | 'descending' = 'ascending';
         if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
             direction = 'descending';
         }
         setSortConfig({ key, direction });
    };

    // --- Render ---
    if (isLoading) return <p>Loading portfolio...</p>;
    if (error) return <p style={{ color: 'red' }}>Error: {error}</p>;

    const getBreakEvenCellStyle = (percent: number | null): React.CSSProperties => {
        if (percent === null || percent === undefined) return {}; // Default style
    
        if (percent >= 0) {
            //return { backgroundColor: '#286328', };
            return { color: '#01ff00' };
        } else if (percent >= -1) { // Between -1 (exclusive) and 0 (inclusive)
            //return { backgroundColor: '#737538' };
            return { color: '#edff00' };
        } else {
            return {}; // Default for less than -1
        }
    };

    const getSinceBuyCellStyle = (days: number | null): React.CSSProperties => {
        if (days === null || typeof days !== 'number') {
            return {}; // No highlighting if data is missing or invalid
        }
    
        if (days > 30) {
             // Over 30 days - light red background
            //return { backgroundColor: '#5d3232' }; // Light red hex code
            return { color: '#ff0000' };
        } else if (days > 20) {
             // Between 21 and 30 days (inclusive) - light yellow background
            //return { backgroundColor: '#5a5745' }; // Light yellow hex code
            return { color: '#ffb400' };
        } else {
            // 20 days or less - default background
            return {};
        }
    };

    return (
        // Inside HomePage component return:
        <div>
            <h2>Opportunity Report</h2>
            <div style={{ fontSize: '0.7em', color: "gray" }}>
                {pricesLoading
                ? 'Prices are refreshing...'
                // Check if timestamp exists before formatting
                : lastPriceFetchTimestamp
                    ? `Prices as of ${formatTimestamp(lastPriceFetchTimestamp)}`
                    : 'Prices not fetched yet.' // Message if no timestamp loaded
                }
            </div>
            {pricesError && <p style={{ color: 'red' }}>Price Error: {pricesError}</p>}
            
            {/* --- Add Column Toggle Checkboxes --- */}
            <div style={{ marginBottom: '1rem', marginTop: '1rem', padding: '10px', border: '1px solid #353535', fontSize: '0.7em', color: "gray" }}>
            {/* Map over the keys of the state object to create checkboxes */}
            {(Object.keys(reportColumnVisibility) as Array<keyof ReportColumnVisibilityState>).map((key) => (
                <label key={key} style={{ marginLeft: '15px', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                    <input
                        type="checkbox"
                        checked={reportColumnVisibility[key]}
                        onChange={() =>
                            // Update state by toggling the specific key's value
                            setReportColumnVisibility((prev) => ({
                                ...prev,
                                [key]: !prev[key],
                            }))
                        }
                        style={{ marginRight: '5px', cursor: 'pointer' }}
                    />
                    {COLUMN_LABELS[key]}
                </label>
            ))}
            </div>
            {/* --- End Column Toggle Checkboxes --- */}

            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem', fontSize: '0.8em' }}>
                <thead>
                    <tr style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>
                        <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestSort('symbol')}>
                            Ticker {sortConfig?.key === 'symbol' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
                        </th>
                        {reportColumnVisibility.fiveDayDip && (
                            <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestSort('fiveDayDip')}>
                                5DD (%) {sortConfig?.key === 'fiveDayDip' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
                            </th>
                        )}
                        {reportColumnVisibility.lbd && (
                            <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestSort('lbd')}>
                                LBD (%) {sortConfig?.key === 'lbd' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
                            </th>
                        )}
                        {reportColumnVisibility.buys && (
                            <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestSort('buys')}>
                                Buys {sortConfig?.key === 'buys' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
                            </th>
                        )}
                        {reportColumnVisibility.incompleteBuys && (
                        <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestSort('incompleteBuyCount')}>
                            I-Buys {sortConfig?.key === 'incompleteBuyCount' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
                        </th>
                        )}
                        {reportColumnVisibility.sinceBuy && (
                            <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestSort('sinceBuy')}>
                                L-Buy {sortConfig?.key === 'sinceBuy' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
                            </th>
                        )}
                        {reportColumnVisibility.sinceSell && (
                            <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestSort('sinceSell')}>
                                L-Sell {sortConfig?.key === 'sinceSell' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
                            </th>                        
                        )}
                        {reportColumnVisibility.currentPrice && (
                            <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestSort('currentPrice')}>
                                Price {sortConfig?.key === 'currentPrice' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
                            </th>
                        )}
                        {reportColumnVisibility.percentToBe && (
                            <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestSort('percentToBe')}>
                                %2BE {sortConfig?.key === 'percentToBe' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
                            </th>
                        )}
                        {reportColumnVisibility.ltpiaTakeProfitPrice && (
                            <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestSort('ltpiaTakeProfitPrice')}>
                                TP {sortConfig?.key === 'ltpiaTakeProfitPrice' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
                            </th>
                        )}
                        {reportColumnVisibility.percentToTp && (
                            <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestSort('percentToTp')}>
                                %2TP {sortConfig?.key === 'percentToTp' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
                            </th>
                        )}
                        
                        {reportColumnVisibility.tpShares && (
                            <th onClick={() => requestSort('tpShares')}>TP-Shs</th>
                        )}
                    </tr>
                </thead>
                <tbody>
                    {/* Use combined isLoading/error checked above, map sortedTableData */}
                    {sortedTableData.length === 0 && !isLoading ? ( // Check isLoading here too
                        <tr>
                            {/* Use dynamic colspan */}
                            <td colSpan={visibleColumnCount} style={{ textAlign: 'center', padding: '1rem' }}>
                                No stocks in portfolio.
                            </td>
                        </tr>
                    ) : (
                        sortedTableData.map((item, index) => ( // item should match ReportDataItem structure
                            <tr key={item.id} style={{ backgroundColor: index % 2 !== 0 ? '#151515' : 'transparent' }}>
                                <td style={{ padding: '5px' }}>
                                <Link
                                    href={`/txns/${item.id}/add`}
                                    style={{
                                    textDecoration: 'none',
                                    // Apply conditional color based on total shares
                                    color: item.totalCurrentShares === 0 ? 'red' : 'inherit' // Check if total is zero
                                    }}
                                >
                                    {item.symbol}
                                </Link> |

                                <Link
                                    href={`/wallets/${item.id}`}
                                    style={{
                                    textDecoration: 'none',
                                    // Apply conditional color based on total shares
                                    color: item.totalCurrentShares === 0 ? 'red' : 'inherit' // Check if total is zero
                                    }}
                                >
                                    {item.symbol}
                                </Link>
                                </td>                                
                                {reportColumnVisibility.fiveDayDip && (
                                    <td style={{ padding: '5px' }}>
                                        {typeof item.fiveDayDip === 'number' && Math.abs(item.fiveDayDip) > 0.0001 ? `${item.fiveDayDip.toFixed(2)}%` : '-'}
                                    </td>
                                )}
                                {reportColumnVisibility.lbd && (
                                    <td style={{ padding: '5px' }}>
                                        {typeof item.lbd === 'number' ? `${item.lbd.toFixed(2)}%` : '-'}
                                    </td>
                                )}
                                {reportColumnVisibility.buys && (
                                    <td style={{ padding: '5px' }}>{item.buys}</td>
                                )}
                                {reportColumnVisibility.incompleteBuys && (
                                        <td style={{ padding: '5px' }}>{item.incompleteBuyCount}</td>
                                )}
                                {reportColumnVisibility.sinceBuy && (
                                    <td style={{
                                        padding: '5px', // Keep existing padding
                                        ...getSinceBuyCellStyle(item.sinceBuy) // Merge conditional styles
                                        }}>
                                        {item.sinceBuy ?? '-'}
                                    </td>
                                )}
                                {reportColumnVisibility.sinceSell && (
                                    <td style={{ padding: '5px' }}>{item.sinceSell ?? '-'}</td>
                                )}
                                {reportColumnVisibility.currentPrice && (
                                    <td style={{ padding: '5px' }}>
                                        {typeof item.currentPrice === 'number' ? item.currentPrice.toFixed(2) : '-'}
                                    </td>
                                )}
                                {reportColumnVisibility.percentToBe && (
                                    <td style={{ padding: '5px', ...getBreakEvenCellStyle(item.percentToBe) }}>
                                        {typeof item.percentToBe === 'number'
                                            ? `${item.percentToBe.toFixed(2)}%`
                                            : '-'}
                                    </td>
                                )}
                                {reportColumnVisibility.ltpiaTakeProfitPrice && (
                                    <td style={{ padding: '5px' }}>
                                        {typeof item.ltpiaTakeProfitPrice === 'number' ? item.ltpiaTakeProfitPrice.toFixed(2) : '-'}
                                    </td>
                                )}
                                {reportColumnVisibility.percentToTp && (
                                    <td style={{ padding: '5px', ...getBreakEvenCellStyle(item.percentToTp) }}> {/* <<< ADD STYLING HERE */}
                                        {typeof item.percentToTp === 'number'
                                            ? `${item.percentToTp.toFixed(2)}%`
                                            : '-'}
                                    </td>
                                )}
                                {reportColumnVisibility.tpShares && (
                                    <td style={{ padding: '5px' }}>
                                        {typeof item.tpShares === 'number'
                                            ? item.tpShares.toFixed(5) // Format shares to 5 decimals, adjust if needed
                                            : '-'}
                                    </td>
                                )}
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}

// Helper type (might be useful globally) - Amplify often uses this internally
type Nullable<T> = T | null | undefined;