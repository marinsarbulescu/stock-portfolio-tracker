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
    // Add other fields if needed by the table/sort
}
type FiveDayDipResult = Record<string, number | null>; // Map: symbol -> dip percentage or null

const client = generateClient<Schema>();

export default function HomePage() {
    const [portfolioStocks, setPortfolioStocks] = useState<PortfolioStockDataType[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Add state for all transactions
    const [allTransactions, setAllTransactions] = useState<Schema['Transaction'][]>([]);
    // Add loading/error state specifically for transactions if desired
    const [isTxnLoading, setIsTxnLoading] = useState(true);
    const [txnError, setTxnError] = useState<string | null>(null);

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
    
    const fetchPageData = useCallback(async () => {
        // Set loading states for both stocks and transactions
        setIsLoading(true); // For stocks
        setIsTxnLoading(true); // For transactions
        setError(null);
        setTxnError(null);
    
        try {
            // Fetch stocks AND transactions concurrently
            const [stockResult, txnResult] = await Promise.all([
                client.models.PortfolioStock.list({
                    selectionSet: ['id', 'symbol', 'pdp', 'name' /* Add other needed fields */]
                }),
                client.models.Transaction.list({
                    // Fetch fields needed for LTPIA and other calcs
                    selectionSet: [
                        'id', 'date', 'action', 'price','portfolioStockId',
                        'tp', 'completedTxnId', 'playShares'
                     ]
                })
            ]);
    
            // Process stocks result
            if (stockResult.errors) throw stockResult.errors;
            setPortfolioStocks(stockResult.data as any); // Using 'as any' for now, refine PortfolioStockDataType if needed
    
            // Process transactions result
            if (txnResult.errors) throw txnResult.errors;
            setAllTransactions(txnResult.data as any); // Set all transactions state
    
            console.log('Fetched Stocks:', stockResult.data);
            console.log('Fetched Transactions:', txnResult.data);
    
        } catch (err: any) {
            console.error("Error fetching page data:", err);
            const errorMessage = Array.isArray(err?.errors) ? err.errors[0].message : (err.message || "Failed to load page data.");
            setError(errorMessage); // Use general error state for now
            setTxnError(errorMessage); // Could set specific txn error too
        } finally {
            setIsLoading(false);
            setIsTxnLoading(false);
        }
    }, []);
    
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
    }
    type ProcessedTxnMap = Record<string, ProcessedStockTxnData>; // Keyed by stock ID

    const processedTxns = useMemo((): ProcessedTxnMap => {
        console.log(`Processing ${allTransactions.length} transactions for ${portfolioStocks.length} stocks.`);
        const dataMap: ProcessedTxnMap = {};
        portfolioStocks.forEach(stock => {
           // @ts-ignore
           const stockId = stock.id;
           if (stockId) { dataMap[stockId] = { buyCount: 0 }; }
        });
    
        // --- Find all completed Buy Txn IDs ---
        const completedBuyTxnIds = new Set<string>();
        allTransactions.forEach(txn => {
            // @ts-ignore
            if (txn.action === 'Sell' && txn.completedTxnId) {
                // @ts-ignore
                completedBuyTxnIds.add(txn.completedTxnId);
            }
        });
        console.log('Completed Buy Txn IDs:', completedBuyTxnIds);
        // --- End Find Completed ---
    
        // Sort transactions once (e.g., by date descending for lastBuy/lastSell)
        const sortedTxns = [...allTransactions].sort((a, b) => {
           // @ts-ignore
           const dateB = b.date ?? '';
           // @ts-ignore
           const dateA = a.date ?? '';
           return dateB.localeCompare(dateA);
        });
    
        // Find lastBuy, lastSell, buyCount
        sortedTxns.forEach(txn => {
             // @ts-ignore
             const stockId = txn.portfolioStockId;
             // @ts-ignore
             const action = txn.action;
             // @ts-ignore
             const date = txn.date;
             // @ts-ignore
             const price = txn.price;
    
             if (stockId && date && dataMap[stockId]) {
                const stockData = dataMap[stockId];
                if (action === 'Buy') {
                    stockData.buyCount++;
                    if (!stockData.lastBuy) {
                        stockData.lastBuy = { date: date, price: price ?? null };
                    }
                } else if (action === 'Sell') {
                    if (!stockData.lastSell) {
                        stockData.lastSell = { date: date };
                    }
                }
             }
        });
    
        // --- Find LTPIA for each stock ---
        Object.keys(dataMap).forEach(stockId => {
           const stockData = dataMap[stockId];
           let lowestTpIncompleteBuy: Schema['Transaction'] | null = null; // Temporarily use full type
    
           allTransactions
             .filter(txn => {
                // @ts-ignore 
                return txn.portfolioStockId === stockId && // Belongs to this stock
                    // @ts-ignore
                    txn.action === 'Buy' &&             // Is a Buy
                    // @ts-ignore
                    !completedBuyTxnIds.has(txn.id) && // Is NOT completed
                    // @ts-ignore
                    typeof txn.tp === 'number';         // Has a valid TP value
             })
             .forEach(incompleteBuyTxn => {
                // @ts-ignore 
                if (lowestTpIncompleteBuy === null || incompleteBuyTxn.tp < lowestTpIncompleteBuy.tp) {
                     lowestTpIncompleteBuy = incompleteBuyTxn;
                 }
             });

             const finalLTPIA = lowestTpIncompleteBuy as any;
    
            // Store the BUY price of the found LTPIA transaction
            stockData.ltpiaPrice = finalLTPIA?.price ?? null; // Access price on the 'any' type
            stockData.ltpiaTp = finalLTPIA?.tp ?? null;    // Access tp on the 'any' type
            // @ts-ignore
            stockData.ltpiaPlayShares = lowestTpIncompleteBuy?.playShares ?? null;
            // Log LTPIA finding for debugging
            // if(lowestTpIncompleteBuy) {
            //      console.log(`LTPIA for <span class="math-inline">\{stockId\}\: TxnId\=</span>{lowestTpIncompleteBuy.id}, TP=<span class="math-inline">\{lowestTpIncompleteBuy\.tp\}, BuyPrice\=</span>{stockData.ltpiaPrice}`);
            // } else {
            //      console.log(`No LTPIA found for ${stockId}`);
            // }
        });
        // --- End Find LTPIA ---
    
    
        console.log('Processed Transactions Map:', dataMap);
        return dataMap;
    }, [allTransactions, portfolioStocks]);


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
        percentToTp: number | null;
        tpShares: number | null;
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
        console.log("Calculating report data...");

        return portfolioStocks.map(stock => {
            // @ts-ignore
            const stockId: string = stock.id;
            // @ts-ignore
            const symbol: string = stock.symbol;
            // @ts-ignore
            const pdp: number | null | undefined = stock.pdp;

            const priceData = latestPrices[symbol];
            const txnData = processedTxns[stockId] ?? { buyCount: 0 };
            const currentPrice = priceData?.currentPrice ?? null;

            // Calculate 5DD (Moved from separate hook)
            let fiveDayDipPercent: number | null = null;
            if (typeof currentPrice === 'number' && typeof pdp === 'number' && priceData?.historicalCloses) {
                const historicalCloses = priceData.historicalCloses ?? [];
                const last5Closes = historicalCloses
                                      .sort((a, b) => b.date.localeCompare(a.date))
                                      .slice(0, 5);
                if (last5Closes.length > 0) {
                    let minDipMeetingCondition: number | null = null;
                    last5Closes.forEach(pastClose => {
                        if (pastClose.close > 0) {
                           const diffPercent = (currentPrice / pastClose.close - 1) * 100;
                           if (diffPercent <= pdp) {
                               if (minDipMeetingCondition === null || diffPercent < minDipMeetingCondition) {
                                   minDipMeetingCondition = diffPercent;
                               }
                           }
                        }
                    });
                    fiveDayDipPercent = minDipMeetingCondition;
                }
            }

            // Calculate %2BE
            let percentToBe: number | null = null;
            const ltpiaPrice = txnData.ltpiaPrice;
            if (typeof currentPrice === 'number' && typeof ltpiaPrice === 'number' && ltpiaPrice > 0) {
                percentToBe = (currentPrice / ltpiaPrice - 1) * 100;
            }

            // Calculate %2TP
            let percentToTp: number | null = null;
            const ltpiaTakeProfitPrice = txnData.ltpiaTp;
            if (typeof currentPrice === 'number' && typeof ltpiaTakeProfitPrice === 'number' && ltpiaTakeProfitPrice > 0) {
                percentToTp = (currentPrice / ltpiaTakeProfitPrice - 1) * 100;
            }

            // Calculate LBD %
            let lbdPercent: number | null = null;
            const lastBuyPrice = txnData.lastBuy?.price;
            if (typeof currentPrice === 'number' && typeof lastBuyPrice === 'number' && typeof pdp === 'number' && lastBuyPrice > 0) {
                const diffPercent = (currentPrice / lastBuyPrice - 1) * 100;
                if (diffPercent <= pdp) {
                    lbdPercent = diffPercent;
                }
            }

            // Calculate Since Buy/Sell Days
            const sinceBuyDays = calculateDaysAgo(txnData.lastBuy?.date);
            const sinceSellDays = calculateDaysAgo(txnData.lastSell?.date);

            // Get Buy Count
            const buyCount = txnData.buyCount;

            // Get TP Shares
            const tpSharesValue = txnData.ltpiaPlayShares;


            // Return combined data object
            return {
                id: stockId,
                symbol: symbol,
                currentPrice: currentPrice,
                fiveDayDip: fiveDayDipPercent, // Use calculated value
                lbd: lbdPercent,
                percentToBe: percentToBe,      // <<< FIX: Assign correct variable
                percentToTp: percentToTp,
                tpShares: tpSharesValue ?? null, // Convert undefined to null
                sinceBuy: sinceBuyDays,
                sinceSell: sinceSellDays,
                buys: buyCount,
            };
        });
    // Update dependencies: remove fiveDayDipResults
    }, [portfolioStocks, latestPrices, processedTxns]);
    // --- End Calculate Report Data ---




    // --- Calculate 5DD ---
    // const fiveDayDipResults = useMemo((): FiveDayDipResult => {
    //     const results: FiveDayDipResult = {};
    //     console.log("Calculating 5DD. Prices:", latestPrices); // Debug log

    //     portfolioStocks.forEach(stock => {
    //         const priceData = latestPrices[stock.symbol];
    //         const currentPrice = priceData?.currentPrice;
    //         const pdp = stock.pdp; // Assuming PDP is stored like -2 for -2%

    //         // Ensure we have valid data to calculate
    //         if (typeof currentPrice !== 'number' || typeof pdp !== 'number' || !priceData?.historicalCloses || priceData.historicalCloses.length === 0) {
    //             results[stock.symbol] = null;
    //             return; // Cannot calculate
    //         }

    //         // Get the 5 most recent historical closes (API might return more than 5)
    //         const last5Closes = priceData.historicalCloses
    //                               .sort((a, b) => b.date.localeCompare(a.date)) // Ensure sorted descending
    //                               .slice(0, 5);

    //         if(last5Closes.length === 0) {
    //            results[stock.symbol] = null;
    //            return;
    //         }

    //         let minDipPercent: number | null = null;

    //         last5Closes.forEach(pastClose => {
    //             if (pastClose.close > 0) { // Avoid division by zero
    //                const diffPercent = (currentPrice / pastClose.close - 1) * 100; // Calculate % diff
    //                const pdpThreshold = pdp; // Using the direct percentage value

    //                // Check if the dip condition is met
    //                if (diffPercent <= pdpThreshold) {
    //                    // If condition met, update minDipPercent if this dip is larger (more negative)
    //                    if (minDipPercent === null || diffPercent < minDipPercent) {
    //                        minDipPercent = diffPercent;
    //                    }
    //                }
    //             }
    //         });
    //         results[stock.symbol] = minDipPercent; // Store the biggest dip % or null
    //     });
    //     console.log("5DD Results:", results); // Debug log
    //     return results;
    // }, [portfolioStocks, latestPrices]); // Recalculate when stocks or prices change


    // --- Create Data for Table & Sort ---
    // const tableData = useMemo(() => {
    //    return portfolioStocks.map(stock => ({
    //        ...stock,
    //        fiveDayDip: fiveDayDipResults[stock.symbol] // Add calculated dip
    //    }));
    // }, [portfolioStocks, fiveDayDipResults]);

    type ReportColumnKey = 'symbol' | 'currentPrice' | 'fiveDayDip' | 'lbd' | 'sinceBuy' |
         'sinceSell' | 'buys' | 'percentToBe' | 'percentToTp' | 'tpShares';
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
            return { backgroundColor: '#006400', };
        } else if (percent >= -1) { // Between -1 (exclusive) and 0 (inclusive)
            return { backgroundColor: '#727500' };
        } else {
            return {}; // Default for less than -1
        }
    };

    return (
        // Inside HomePage component return:
        <div>
            <h1>Portfolio Action Report</h1>
            <div style={{ fontSize: 10 }}>
                {pricesLoading
                ? 'Prices are refreshing...'
                // Check if timestamp exists before formatting
                : lastPriceFetchTimestamp
                    ? `Prices as of ${formatTimestamp(lastPriceFetchTimestamp)}`
                    : 'Prices not fetched yet.' // Message if no timestamp loaded
                }
            </div>
            {pricesError && <p style={{ color: 'red' }}>Price Error: {pricesError}</p>}
            {isTxnLoading && <p>Loading transaction data...</p>} {/* Show txn loading state */}
            {txnError && <p style={{ color: 'red' }}>Transaction Error: {txnError}</p>} {/* Show txn error */}


            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem', fontSize: 14 }}>
                <thead>
                    <tr style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>
                        <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestSort('symbol')}>
                            Ticker {sortConfig?.key === 'symbol' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
                        </th>
                        <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestSort('fiveDayDip')}>
                            5DD (%) {sortConfig?.key === 'fiveDayDip' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
                        </th>
                        <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestSort('lbd')}>
                            LBD (%) {sortConfig?.key === 'lbd' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
                        </th>
                        <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestSort('buys')}>
                            Buys {sortConfig?.key === 'buys' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
                        </th>
                        <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestSort('sinceBuy')}>
                            Since Buy {sortConfig?.key === 'sinceBuy' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
                        </th>
                        <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestSort('sinceSell')}>
                            Since Sell {sortConfig?.key === 'sinceSell' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
                        </th>                        
                        <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestSort('currentPrice')}>
                            Price {sortConfig?.key === 'currentPrice' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
                        </th>
                        <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestSort('percentToBe')}>
                            %2BE {sortConfig?.key === 'percentToBe' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
                        </th>
                        <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestSort('percentToTp')}>
                            %2TP {sortConfig?.key === 'percentToTp' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
                        </th>
                        <th onClick={() => requestSort('tpShares')}>TP-Shs</th>
                    </tr>
                </thead>
                <tbody>
                    {/* Use the final sorted data */}
                    {sortedTableData.length === 0 ? (
                        <tr><td colSpan={7} style={{ textAlign: 'center', padding: '1rem' }}>No stocks in portfolio.</td></tr>
                    ) : (
                        sortedTableData.map((item) => ( // item should match ReportDataItem structure
                            <tr key={item.id} style={{ borderBottom: '1px solid #eee' }}>
                                <td style={{ padding: '5px' }}>
                                    <Link href={`/txns/${item.id}/add`} style={{ textDecoration: 'none', color: 'inherit' }}>
                                        {item.symbol}
                                    </Link>
                                </td>                                
                                <td style={{ padding: '5px' }}>
                                    {typeof item.fiveDayDip === 'number' && Math.abs(item.fiveDayDip) > 0.0001 ? `${item.fiveDayDip.toFixed(2)}%` : '-'}
                                </td>
                                <td style={{ padding: '5px' }}>
                                    {typeof item.lbd === 'number' ? `${item.lbd.toFixed(2)}%` : '-'}
                                </td>
                                <td style={{ padding: '5px' }}>{item.buys}</td>
                                <td style={{ padding: '5px' }}>{item.sinceBuy ?? '-'}</td>
                                <td style={{ padding: '5px' }}>{item.sinceSell ?? '-'}</td>
                                <td style={{ padding: '5px' }}>
                                    {typeof item.currentPrice === 'number' ? item.currentPrice.toFixed(2) : '-'}
                                </td>
                                <td style={{ padding: '5px', ...getBreakEvenCellStyle(item.percentToBe) }}>
                                    {typeof item.percentToBe === 'number'
                                        ? `${item.percentToBe.toFixed(2)}%`
                                        : '--'}
                                </td>
                                <td style={{ padding: '5px', ...getBreakEvenCellStyle(item.percentToTp) }}> {/* <<< ADD STYLING HERE */}
                                    {typeof item.percentToTp === 'number'
                                        ? `${item.percentToTp.toFixed(2)}%`
                                        : '--'}
                                </td>
                                <td style={{ padding: '5px' }}>
                                    {typeof item.tpShares === 'number'
                                        ? item.tpShares.toFixed(5) // Format shares to 5 decimals, adjust if needed
                                        : '--'}
                                </td>
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