// app/(authed)/page.tsx
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';
import { usePrices } from '@/app/contexts/PriceContext'; // Import context hook
import Link from 'next/link';

const SHARE_EPSILON = 0.00001; // Example value, adjust as needed
const CURRENCY_PRECISION = 2;  // Example value (e.g., for dollars and cents)
const PERCENT_PRECISION = 2;   // Example value (e.g., 12.34%)

// Define types locally matching schema if needed (or import if shared)
type PortfolioStockDataType = { // Simplified representation needed for this page
    id: string;
    symbol: string;
    pdp: number | null | undefined;
    name?: string | null | undefined;
    budget?: number | null | undefined;
    // Add other fields if needed by the table/sort
}

type StockWalletDataType = Schema['StockWallet']['type'];

type FiveDayDipResult = Record<string, number | null>; // Map: symbol -> dip percentage or null

// Define Transaction List Result Type (helpful for pagination function)
type TransactionListResultType = Awaited<ReturnType<typeof client.models.Transaction.list>>;

const client = generateClient<Schema>();

export default function HomePage() {
    // Define the shape of the visibility state
    interface ReportColumnVisibilityState {
        fiveDayDip: boolean;
        lbd: boolean;
        swingWalletCount: boolean;
        //buys: boolean;
        //incompleteBuys: boolean;
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
        swingWalletCount: true,
        //buys: false,
        //incompleteBuys: true,
        sinceBuy: true,
        sinceSell: false,
        currentPrice: true,
        percentToBe: false,
        ltpiaTakeProfitPrice: true,
        percentToTp: true,
        tpShares: true,
    });

    // Mapping from state keys to desired display labels
    const COLUMN_LABELS: Record<keyof ReportColumnVisibilityState, string> = {
        fiveDayDip: '5DD',      
        lbd: 'LBD',
        swingWalletCount: 'Swing Wallets',         
        //buys: 'Sw Wallets',
        //incompleteBuys: 'I-Buys',
        sinceBuy: 'Last Buy',
        sinceSell: 'Last Sell',
        currentPrice: 'Price',
        percentToBe: '%2BE',          
        ltpiaTakeProfitPrice: 'TP',
        percentToTp: '%2TP',          
        tpShares: 'TP Shares',
    };
    
    const [isOverviewExpanded, setIsOverviewExpanded] = useState(false); // Collapsed by default
    
    const [portfolioStocks, setPortfolioStocks] = useState<PortfolioStockDataType[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [allWallets, setAllWallets] = useState<StockWalletDataType[]>([]);

    // Add state for all transactions
    const [allTransactions, setAllTransactions] = useState<Schema['Transaction'][]>([]);

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
            'id',
            'date',
            'action',
            'price',
            'portfolioStockId',
            'tp',
            'completedTxnId',
            'swingShares',
            'holdShares',
            'investment',
            'quantity',            
            'txnType',
            'signal',
            'lbd',
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
        setPortfolioStocks([]);
        setAllTransactions([]);
        setAllWallets([]);

        try {
            //console.log("Starting parallel fetch for stocks and all transactions...");
            // Fetch stocks AND use the pagination helper for transactions
            const [stockResult, allTxnsData, walletResult] = await Promise.all([
                client.models.PortfolioStock.list({
                    selectionSet: ['id', 'symbol', 'pdp', 'name', 'budget'], // Fields needed for report
                    filter: {
                        isHidden: { ne: true } // ne: not equal to true (i.e., fetch if false or null/undefined)
                        // Or you could use: isHidden: { eq: false } if you are sure all items will have the field set
                    },
                    limit: 1000
                }),
                fetchAllPaginatedTransactions(), // Call the pagination helper

                client.models.StockWallet.list({
                    // No filter here fetches ALL wallets for the user (owner auth applied by default)
                    selectionSet: [ // Fields needed for calculations
                        'id',
                        'portfolioStockId',
                        'walletType',
                        'buyPrice',
                        'remainingShares',
                        'tpValue', // Needed for finding lowest TP
                        'sellTxnCount', // Potentially useful later
                        'sharesSold' // Potentially useful later
                        // Add any other fields needed by revised calculations
                    ],
                    limit: 3000 // Adjust limit generously for wallets
                })
            ]);
            //console.log("Parallel fetches completed.");

            // Process stocks result (basic error check)
            if (stockResult && Array.isArray((stockResult as any).errors) && (stockResult as any).errors.length > 0) {
                 throw (stockResult as any).errors;
            }
            setPortfolioStocks(stockResult.data as any);

            // Transactions data is the complete array from the helper
            setAllTransactions(allTxnsData);

            if (walletResult.errors) throw walletResult.errors;
            setAllWallets(walletResult.data as any); // <<< Set wallets state

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

    // --- Process Transactions & Wallets per Stock ---
    interface ProcessedStockData {
        // From Transactions
        lastSwingBuy: { date: string; price: number | null } | undefined;
        lastSwingSell: { date: string } | undefined;
        swingBuyCount: number;
        // From Wallets
        activeSwingWallets: StockWalletDataType[]; // Keep the actual wallet objects
        lowestSwingBuyPriceWallet: StockWalletDataType | null; // Wallet with lowest buy price (and shares > 0)
        lowestSwingTpWallet: StockWalletDataType | null; // Wallet with lowest TP (and shares > 0)
        totalCurrentSwingShares: number; // Sum remaining swing shares
        totalCurrentHoldShares: number; // Sum remaining hold shares (calculated for reference)
    }
    type ProcessedDataMap = Record<string, ProcessedStockData>; // Keyed by stock ID

    const processedData = useMemo((): ProcessedDataMap => {
        //console.log(`Processing ${allTransactions.length} transactions and ${allWallets.length} wallets...`);
        const dataMap: ProcessedDataMap = {};
        const epsilon = 0.000001; // Tolerance for share checks

        // --- Add this mapping step ---
        // Explicitly cast each transaction to the type we expect it to be
        // (assuming schema and selectionSet are correct)
        const typedTransactions: Schema['Transaction']['type'][] = allTransactions.map(
            txn => txn as unknown as Schema['Transaction']['type']
        );
        // --- End mapping step ---

        // --- Process data PER STOCK ---
        portfolioStocks.forEach(stock => {
            const stockId = stock.id;
            if (!stockId) return;

            // Filter transactions and wallets for the current stock
            const stockTxns = typedTransactions.filter(txn => txn.portfolioStockId === stockId);
            const stockWallets = allWallets.filter(w => w.portfolioStockId === stockId);

            // Initialize data structure for this stock
            const stockData: ProcessedStockData = {
                lastSwingBuy: undefined,
                lastSwingSell: undefined,
                swingBuyCount: 0,
                activeSwingWallets: [],
                lowestSwingBuyPriceWallet: null,
                lowestSwingTpWallet: null,
                totalCurrentSwingShares: 0,
                totalCurrentHoldShares: 0,
            };

            // --- Process Transactions ---
            // Sort by date to find latest
            const sortedStockTxns = [...stockTxns].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
            sortedStockTxns.forEach(txn => {
                // Find Last Swing Buy (contributed to Swing shares)
                if (txn.action === 'Buy' && (txn.txnType === 'Swing' || (txn.txnType === 'Split' && (txn.swingShares ?? 0) > epsilon))) {
                    stockData.swingBuyCount++;
                    // Update lastSwingBuy if this one is later or first
                    if (!stockData.lastSwingBuy || (txn.date && txn.date >= stockData.lastSwingBuy.date)) {
                        stockData.lastSwingBuy = { date: txn.date, price: txn.price ?? null };
                    }
                }
                // Find Last Swing Sell (sold FROM Swing shares)
                else if (txn.action === 'Sell' && txn.txnType === 'Swing') {
                    // Update lastSwingSell if this one is later or first
                     if (!stockData.lastSwingSell || (txn.date && txn.date >= stockData.lastSwingSell.date)) {
                        stockData.lastSwingSell = { date: txn.date };
                    }
                }
            });

            // --- Process Wallets ---
            stockData.activeSwingWallets = stockWallets.filter(w =>
                w.walletType === 'Swing' && (w.remainingShares ?? 0) > epsilon
            );
            stockData.totalCurrentSwingShares = stockData.activeSwingWallets.reduce((sum, w) => sum + (w.remainingShares ?? 0), 0);
            // Calculate total Hold shares for reference if needed elsewhere
            stockData.totalCurrentHoldShares = stockWallets
                .filter(w => w.walletType === 'Hold' && (w.remainingShares ?? 0) > epsilon)
                .reduce((sum, w) => sum + (w.remainingShares ?? 0), 0);


            // Find Lowest Buy Price Active Swing Wallet
            stockData.lowestSwingBuyPriceWallet = stockData.activeSwingWallets.reduce((lowest, current) => {
                if (!lowest) return current; // First one becomes lowest initially
                if (typeof current.buyPrice === 'number' && current.buyPrice < (lowest.buyPrice ?? Infinity)) {
                    return current;
                }
                return lowest;
            }, null as StockWalletDataType | null);

            // Find Lowest TP Active Swing Wallet (considering only those with valid TP)
             stockData.lowestSwingTpWallet = stockData.activeSwingWallets
                 .filter(w => typeof w.tpValue === 'number' && w.tpValue > 0) // Filter for valid TPs
                 .reduce((lowest, current) => {
                    if (!lowest) return current;
                    // We know tpValue is number here due to filter
                    if (current.tpValue! < lowest.tpValue!) {
                        return current;
                    }
                    return lowest;
                 }, null as StockWalletDataType | null);

            dataMap[stockId] = stockData;
        }); // End loop through portfolioStocks

        //console.log("Finished processing transactions and wallets.", dataMap);
        return dataMap;
    // Update dependencies: now depends on wallets too
    }, [allTransactions, allWallets, portfolioStocks]);


    interface ReportDataItem {
        id: string;
        symbol: string;
        currentPrice: number | null;
        fiveDayDip: number | null; // Calculated 5DD percentage
        lbd: number | null;        // Calculated LBD percentage
        sinceBuy: number | null;   // Days
        sinceSell: number | null;  // Days
        swingWalletCount: number;
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
        //console.log("Calculating final report data based on processed data...");

        return portfolioStocks.map(stock => {
            const stockId: string = stock.id;
            const symbol: string = stock.symbol;
            const pdp: number | null | undefined = stock.pdp; // Keep PDP from stock
            const priceData = latestPrices[symbol]; // Get current price / history
            const currentPrice = priceData?.currentPrice ?? null;

            // Get processed Txn/Wallet data for this stock
            const procData = processedData[stockId] ?? { // Use new processedData map
                lastSwingBuy: undefined, lastSwingSell: undefined, swingBuyCount: 0,
                activeSwingWallets: [], lowestSwingBuyPriceWallet: null, lowestSwingTpWallet: null,
                totalCurrentSwingShares: 0, totalCurrentHoldShares: 0, // Provide defaults
            };

            // --- Calculations for 5DD, LBD, %2BE, %2TP ---
            // 5DD (Uses Price History & PDP - unchanged logic)
            let fiveDayDipPercent: number | null = null;
            if (typeof currentPrice === 'number' && typeof pdp === 'number' && priceData?.historicalCloses) {
                 const historicalCloses = priceData.historicalCloses ?? [];
                 const last5Closes = historicalCloses.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
                 if (last5Closes.length > 0) {
                     let minDipMeetingCondition: number | null = null;
                     last5Closes.forEach(pastClose => {
                         if (pastClose.close > 0) {
                            const diffPercent = (currentPrice / pastClose.close - 1) * 100;
                            if (diffPercent <= (pdp * -1)) {
                                if (minDipMeetingCondition === null || diffPercent < minDipMeetingCondition) {
                                    minDipMeetingCondition = diffPercent;
                                }
                            }
                         }
                     });
                     fiveDayDipPercent = minDipMeetingCondition;
                 }
            }

            // LBD (Uses Last SWING Buy Price & PDP)
            let lbdPercent: number | null = null;
            const lastSwingBuyPrice = procData.lastSwingBuy?.price;
            if (typeof currentPrice === 'number' && typeof lastSwingBuyPrice === 'number' && typeof pdp === 'number' && lastSwingBuyPrice > 0) {
                const diffPercent = (currentPrice / lastSwingBuyPrice - 1) * 100;
                if (diffPercent <= (pdp * -1)) {
                    lbdPercent = diffPercent;
                }
            }

            // %2BE (Uses Lowest Swing Buy Price)
            let percentToBe: number | null = null;
            const lowestSwingBuyPrice = procData.lowestSwingBuyPriceWallet?.buyPrice;
            if (typeof currentPrice === 'number' && typeof lowestSwingBuyPrice === 'number' && lowestSwingBuyPrice > 0) {
                percentToBe = (currentPrice / lowestSwingBuyPrice - 1) * 100;
            }

            // TP, %2TP, TP-Shs (Uses Lowest Swing TP Wallet info)
            const lowestSwingTpPrice = procData.lowestSwingTpWallet?.tpValue; // The TP value itself
            const lowestSwingTpShares = procData.lowestSwingTpWallet?.remainingShares; // Shares in that wallet
            let percentToTp: number | null = null;
            if (typeof currentPrice === 'number' && typeof lowestSwingTpPrice === 'number' && lowestSwingTpPrice > 0) {
                percentToTp = (currentPrice / lowestSwingTpPrice - 1) * 100;
            }
            // --- End Calculations ---

            // Get other data points
            const sinceBuyDays = calculateDaysAgo(procData.lastSwingBuy?.date);
            const sinceSellDays = calculateDaysAgo(procData.lastSwingSell?.date); // Last SWING sell
            const swingBuyCountValue = procData.swingBuyCount;
            // Calculate total shares from processed data
            const totalShares = procData.totalCurrentSwingShares + procData.totalCurrentHoldShares;
            const swingWalletCountValue = procData.activeSwingWallets.length;

            // Return combined data object for the report row
            return {
                id: stockId,
                symbol: symbol,
                currentPrice: currentPrice,
                fiveDayDip: fiveDayDipPercent,
                lbd: lbdPercent,
                percentToBe: percentToBe,
                // Rename LTPIA TP Price to just TP
                ltpiaTakeProfitPrice: lowestSwingTpPrice ?? null, // TP value to display
                percentToTp: percentToTp,
                tpShares: lowestSwingTpShares ?? null, // Shares corresponding to lowest TP wallet
                sinceBuy: sinceBuyDays,
                sinceSell: sinceSellDays, // Since last SWING sell
                buys: swingBuyCountValue, // Now represents SWING buys
                totalCurrentShares: totalShares, // Keep total if needed
                incompleteBuyCount: 0, // No longer calculated/used
                swingWalletCount: swingWalletCountValue,
            };
        });
    // Update dependencies
    }, [portfolioStocks, latestPrices, processedData]);


    // --- Portfolio Overview Calculations ---

    // Calculate Budget Stats
    const portfolioBudgetStats = useMemo(() => {
        const totalBudget = portfolioStocks.reduce((sum, stock) => sum + (stock.budget ?? 0), 0);

        // Calculate total tied-up investment across ALL wallets
        const totalTiedUpInvestment = allWallets.reduce((totalTiedUp, wallet) => {
            const totalInvestment = wallet.totalInvestment ?? 0;
            const totalShares = wallet.totalSharesQty ?? 0;
            const remainingShares = wallet.remainingShares ?? 0;
            const investmentPerShare = (totalShares > SHARE_EPSILON) ? (totalInvestment / totalShares) : 0;
            const tiedUpInWallet = investmentPerShare * remainingShares;
            return totalTiedUp + tiedUpInWallet;
        }, 0);

        const budgetLeft = totalBudget - totalTiedUpInvestment;

        return {
            totalBudget: parseFloat(totalBudget.toFixed(CURRENCY_PRECISION)),
            budgetLeft: parseFloat(budgetLeft.toFixed(CURRENCY_PRECISION)),
        };
    }, [portfolioStocks, allWallets]); // Depends on stocks and wallets

    // Calculate Transaction Counts
    const portfolioTransactionCounts = useMemo(() => {
        const buys = allTransactions.filter(t => (t as any).action === 'Buy').length;
        const swingSells = allTransactions.filter(t => (t as any).action === 'Sell' && (t as any).txnType === 'Swing').length;
        const holdSells = allTransactions.filter(t => (t as any).action === 'Sell' && (t as any).txnType === 'Hold').length;
        const totalSells = swingSells + holdSells;
        return { buys, swingSells, holdSells, totalSells };
    }, [allTransactions]);

    // Calculate Realized P/L Stats (Method 2)
    const portfolioRealizedPL = useMemo(() => {
        const walletBuyPriceMap = new Map<string, number>();
        allWallets.forEach(w => {
            if (w.id && typeof w.buyPrice === 'number') {
                walletBuyPriceMap.set(w.id, w.buyPrice);
            }
        });
    
        let totalSwingPlDollars = 0, totalSwingCostBasis = 0;
        let totalHoldPlDollars = 0, totalHoldCostBasis = 0;
    
        // Use '(txn as any)' to access properties we know exist via selectionSet
        allTransactions.forEach(txn => {
            // Access properties using 'as any'
            if ((txn as any).action === 'Sell' && (txn as any).completedTxnId && typeof (txn as any).quantity === 'number' && typeof (txn as any).price === 'number') {
                // Access completedTxnId using 'as any'
                const walletBuyPrice = walletBuyPriceMap.get((txn as any).completedTxnId);
                if (typeof walletBuyPrice === 'number') {
                    // Access quantity using 'as any'
                    const costBasisForTxn = walletBuyPrice * (txn as any).quantity;
                     // Access price and quantity using 'as any'
                    const profitForTxn = ((txn as any).price - walletBuyPrice) * (txn as any).quantity;
    
                    // Access txnType using 'as any'
                    if ((txn as any).txnType === 'Swing') {
                        totalSwingPlDollars += profitForTxn;
                        totalSwingCostBasis += costBasisForTxn;
                    // Access txnType using 'as any'
                    } else if ((txn as any).txnType === 'Hold') {
                        totalHoldPlDollars += profitForTxn;
                        totalHoldCostBasis += costBasisForTxn;
                    }
                }
            }
        });

        const avgSwingPlPercent = (totalSwingCostBasis !== 0) ? (totalSwingPlDollars / totalSwingCostBasis) * 100 : (totalSwingPlDollars === 0 ? 0 : null);
        const avgHoldPlPercent = (totalHoldCostBasis !== 0) ? (totalHoldPlDollars / totalHoldCostBasis) * 100 : (totalHoldPlDollars === 0 ? 0 : null);
        const totalStockPlDollars = totalSwingPlDollars + totalHoldPlDollars;
        const totalStockCostBasis = totalSwingCostBasis + totalHoldCostBasis;
        const avgStockPlPercent = (totalStockCostBasis !== 0) ? (totalStockPlDollars / totalStockCostBasis) * 100 : (totalStockPlDollars === 0 ? 0 : null);

        return {
            totalSwingPlDollars: parseFloat(totalSwingPlDollars.toFixed(CURRENCY_PRECISION)),
            avgSwingPlPercent: typeof avgSwingPlPercent === 'number' ? parseFloat(avgSwingPlPercent.toFixed(PERCENT_PRECISION)) : null,
            totalHoldPlDollars: parseFloat(totalHoldPlDollars.toFixed(CURRENCY_PRECISION)),
            avgHoldPlPercent: typeof avgHoldPlPercent === 'number' ? parseFloat(avgHoldPlPercent.toFixed(PERCENT_PRECISION)) : null,
            totalStockPlDollars: parseFloat(totalStockPlDollars.toFixed(CURRENCY_PRECISION)),
            avgStockPlPercent: typeof avgStockPlPercent === 'number' ? parseFloat(avgStockPlPercent.toFixed(PERCENT_PRECISION)) : null,
        };
    }, [allTransactions, allWallets]);

    // Calculate YTD P/L Stats
    const portfolioYtdPL = useMemo(() => {
        console.log('[YTD Calc Start] Input Lengths:', {
            allWallets: allWallets.length,
            portfolioStocks: portfolioStocks.length,
            latestPrices: Object.keys(latestPrices).length,
            allTransactions: allTransactions.length
        });
        const walletBuyPriceMap = new Map<string, number>();
        allWallets.forEach(w => { if (w.id && typeof w.buyPrice === 'number') walletBuyPriceMap.set(w.id, w.buyPrice); });

        const currentYear = new Date().getFullYear();
        const startOfYear = `${currentYear}-01-01`;

        let ytdRealizedSwingPL = 0, ytdRealizedHoldPL = 0;
        let currentUnrealizedSwingPL = 0, currentSwingCostBasis = 0;
        let currentUnrealizedHoldPL = 0, currentHoldCostBasis = 0;
        let partialDataUsed = false;

        // YTD Realized
        allTransactions.forEach(txn => {
            if ((txn as any).action === 'Sell' && (txn as any).date && (txn as any).date >= startOfYear && (txn as any).completedTxnId && typeof (txn as any).quantity === 'number' && typeof (txn as any).price === 'number') {
                const walletBuyPrice = walletBuyPriceMap.get((txn as any).completedTxnId);
                if (typeof walletBuyPrice === 'number') {
                    const profitForTxn = ((txn as any).price - walletBuyPrice) * (txn as any).quantity;
                    if ((txn as any).txnType === 'Swing') ytdRealizedSwingPL += profitForTxn;
                    else if ((txn as any).txnType === 'Hold') ytdRealizedHoldPL += profitForTxn;
                }
            }
        });

        console.log('[YTD Calc] After Realized Calc:', { ytdRealizedSwingPL, ytdRealizedHoldPL });

        // Current Unrealized and Cost Basis (Price dependency here)
        console.log('[YTD Calc] Starting Unrealized Calc Loop...');

        // Current Unrealized and Cost Basis
        allWallets.forEach((wallet, index) => {
            const stockForWallet = portfolioStocks.find(s => s.id === wallet.portfolioStockId);
            const stockSymbol = stockForWallet?.symbol ?? null;
            console.log(`[YTD Calc Loop ${index}] WalletID=${wallet.id} StockID=${wallet.portfolioStockId} -> Symbol=${stockSymbol}`);

            const currentPrice = latestPrices[stockSymbol ?? '']?.currentPrice ?? null;
            // --- LOG 3: Log Price Lookup Result ---
            console.log(`[YTD Calc Loop ${index}] Price lookup for ${stockSymbol}:`, currentPrice);
            
            if (currentPrice === null && (wallet.remainingShares ?? 0) > SHARE_EPSILON) {
                // --- LOG 4: Log EXACTLY when priceAvailable becomes false ---
                partialDataUsed = true;
                console.warn(`[YTD Calc Loop ${index}] Setting priceAvailable=false. Missing price for symbol: ${stockSymbol} (Wallet ID: ${wallet.id})`);
                return;
            }

            if ((wallet.remainingShares ?? 0) > SHARE_EPSILON && typeof wallet.buyPrice === 'number' && typeof currentPrice === 'number') {
                const unrealizedForWallet = (currentPrice - wallet.buyPrice) * wallet.remainingShares!;
                const costBasisForWallet = wallet.buyPrice * wallet.remainingShares!;
                if (wallet.walletType === 'Swing') {
                    currentUnrealizedSwingPL += unrealizedForWallet;
                    currentSwingCostBasis += costBasisForWallet;
                } else if (wallet.walletType === 'Hold') {
                    currentUnrealizedHoldPL += unrealizedForWallet;
                    currentHoldCostBasis += costBasisForWallet;
                }
            }
        });
        
        console.log('[YTD Calc] After Unrealized Loop:', { currentUnrealizedSwingPL, currentSwingCostBasis, currentUnrealizedHoldPL, currentHoldCostBasis });

        // --- LOG 5: Log state of priceAvailable before the check ---
        //console.log('[YTD Calc] Before priceAvailable check. priceAvailable =', priceAvailable);
    
        // if (!priceAvailable) {
        //     console.warn("[YTD Calc ABORT] Cannot calculate full unrealized P/L: One or more current prices unavailable. Returning nulls.");
        //     // Return nulls for values depending on unrealized P/L
        //     return { totalSwingYtdPL_dollars: null, totalSwingYtdPL_percent: null, totalHoldYtdPL_dollars: null, totalHoldYtdPL_percent: null };
        // }

        const totalSwingYtdPL_dollars = ytdRealizedSwingPL + currentUnrealizedSwingPL;
        const totalHoldYtdPL_dollars = ytdRealizedHoldPL + currentUnrealizedHoldPL;

        const totalSwingYtdPL_percent = (currentSwingCostBasis > SHARE_EPSILON) ? (totalSwingYtdPL_dollars / currentSwingCostBasis) * 100 : (totalSwingYtdPL_dollars === 0 ? 0 : null);
        const totalHoldYtdPL_percent = (currentHoldCostBasis > SHARE_EPSILON) ? (totalHoldYtdPL_dollars / currentHoldCostBasis) * 100 : (totalHoldYtdPL_dollars === 0 ? 0 : null);

        // --- LOG 6: Log final calculated results ---
        console.log('[YTD Calc Success] Calculation complete. Returning:', {
            totalSwingYtdPL_dollars, totalSwingYtdPL_percent, totalHoldYtdPL_dollars, totalHoldYtdPL_percent
        });
        
        return {
            totalSwingYtdPL_dollars: parseFloat(totalSwingYtdPL_dollars.toFixed(CURRENCY_PRECISION)),
            totalSwingYtdPL_percent: typeof totalSwingYtdPL_percent === 'number' ? parseFloat(totalSwingYtdPL_percent.toFixed(PERCENT_PRECISION)) : null,
            totalHoldYtdPL_dollars: parseFloat(totalHoldYtdPL_dollars.toFixed(CURRENCY_PRECISION)),
            totalHoldYtdPL_percent: typeof totalHoldYtdPL_percent === 'number' ? parseFloat(totalHoldYtdPL_percent.toFixed(PERCENT_PRECISION)) : null,
            partialDataUsed: partialDataUsed,
        };

    }, [allTransactions, allWallets, portfolioStocks, latestPrices]); // Dependencies

    // --- End Portfolio Overview Calculations ---


    // Calculate the number of currently visible columns
    const visibleColumnCount = useMemo(() => {
        // Start with columns that are always visible (e.g., Ticker)
        let count = 1;
        // Add count of toggleable columns that are currently true
        count += (Object.values(reportColumnVisibility) as boolean[]).filter(Boolean).length;
        return count;
    }, [reportColumnVisibility]);
    
    
    type ReportColumnKey = 
        'symbol' | 
        'currentPrice' | 
        'fiveDayDip' | 
        'lbd' | 
        'sinceBuy' |
        'sinceSell' | 
        'swingWalletCount' |
        //'buys' | 
        'incompleteBuyCount' | 
        'percentToBe' | 
        'percentToTp' | 
        'ltpiaTakeProfitPrice' | 
        'tpShares';
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

            <div style={{
                marginBottom: '1rem',
                border: '1px solid #444', // Keep border for the whole section
            }}>
                <p
                    style={{
                        marginTop: 0, marginBottom: 0, // Remove bottom margin if collapsing
                        padding: '10px 15px', // Keep padding on heading
                        cursor: 'pointer', // Indicate clickable
                        display: 'flex', // Use flex to align text and arrow
                        justifyContent: 'space-between', // Push arrow to the right
                        alignItems: 'center'
                    }}
                    onClick={() => setIsOverviewExpanded(prev => !prev)} // Toggle state on click
                >                   
                    Overview
                    {/* Indicator Arrow */}
                    <span style={{ fontSize: '0.8em' }}>{isOverviewExpanded ? '▼' : '▶'}</span>
                </p>

                {/* Conditionally render the details based on state */}
                {isOverviewExpanded && (
                    <div style={{
                        padding: '0px 15px 10px 15px', // Add padding back for content
                        borderTop: '1px solid #444', // Add divider when expanded
                        fontSize: '0.8em'
                    }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0px 15px', marginTop: '10px' }}>
                            <div>
                                <p style={{ fontWeight: 'bold', fontSize: '1.1em' }}>Budget</p>

                                <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>Annual</p>
                                <p>
                                    ${portfolioBudgetStats.totalBudget.toLocaleString(undefined, {
                                        minimumFractionDigits: CURRENCY_PRECISION,
                                        maximumFractionDigits: CURRENCY_PRECISION,
                                    })}
                                </p>
                                
                                <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>Available</p>
                                <p>
                                    ${portfolioBudgetStats.budgetLeft.toLocaleString(undefined, {
                                        minimumFractionDigits: CURRENCY_PRECISION,
                                        maximumFractionDigits: CURRENCY_PRECISION,
                                    })}
                                </p>                             
                            </div>

                            <div>
                                <p style={{ fontWeight: 'bold', fontSize: '1.1em' }}>Transactions</p>
                                    
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                                    <div>
                                        <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>Buys</p>
                                        <p>
                                            {portfolioTransactionCounts.buys}
                                        </p>

                                        <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>Swing Sells</p>
                                        <p>
                                            {portfolioTransactionCounts.swingSells}
                                        </p>
                                    </div>
                                    <div>    
                                        <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>Sells</p>
                                        <p>
                                            {portfolioTransactionCounts.totalSells}
                                        </p>
                                        
                                        <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>Hold Sells</p>
                                        <p>
                                            {portfolioTransactionCounts.holdSells}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <p style={{ fontWeight: 'bold', fontSize: '1.1em' }}>Realized P/L</p>

                                <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>Swing P/L</p>
                                <p>
                                    ${portfolioRealizedPL.totalSwingPlDollars.toFixed(CURRENCY_PRECISION)}
                                    &nbsp;
                                    ({portfolioRealizedPL.avgSwingPlPercent !== null ? `${portfolioRealizedPL.avgSwingPlPercent.toFixed(PERCENT_PRECISION)}%` : 'N/A'})
                                </p>

                                <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>Hold P/L</p>
                                <p>
                                    ${portfolioRealizedPL.totalHoldPlDollars.toFixed(CURRENCY_PRECISION)}
                                    &nbsp;
                                    ({portfolioRealizedPL.avgHoldPlPercent !== null ? `${portfolioRealizedPL.avgHoldPlPercent.toFixed(PERCENT_PRECISION)}%` : 'N/A'})
                                </p>

                                <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>Stock P/L</p>
                                <p>
                                    ${portfolioRealizedPL.totalStockPlDollars.toFixed(CURRENCY_PRECISION)}
                                    &nbsp;
                                    ({portfolioRealizedPL.avgStockPlPercent !== null ? `${portfolioRealizedPL.avgStockPlPercent.toFixed(PERCENT_PRECISION)}%` : 'N/A'})
                                </p>
                            </div>
                            <div>
                                <p style={{ fontWeight: 'bold', fontSize: '1.1em' }}>YTD P/L</p>

                                {portfolioYtdPL.partialDataUsed && (
                                    <p style={{ margin: '5px 0 0 0', fontSize: '0.8em', fontStyle: 'italic', color: 'orange' }}>
                                    (* only holdings w/ price)
                                    </p>
                                )}
                                
                                <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>Swing YTD P/L</p>
                                <p>
                                    ${portfolioYtdPL.totalSwingYtdPL_dollars.toFixed(CURRENCY_PRECISION)}&nbsp; 
                                    ({portfolioYtdPL.totalSwingYtdPL_percent !== null ? `${portfolioYtdPL.totalSwingYtdPL_percent.toFixed(PERCENT_PRECISION)}%` : 'N/A %'})
                                </p>

                                <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>Hold YTD P/L</p>
                                <p>
                                    ${portfolioYtdPL.totalHoldYtdPL_dollars.toFixed(CURRENCY_PRECISION)} &nbsp;
                                    ({portfolioYtdPL.totalHoldYtdPL_percent !== null ? `${portfolioYtdPL.totalHoldYtdPL_percent.toFixed(PERCENT_PRECISION)}%` : 'N/A %'})
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            
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
                        {reportColumnVisibility.swingWalletCount && (
                            <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestSort('swingWalletCount')}>
                                Sw Wlts {sortConfig?.key === 'swingWalletCount' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
                            </th>
                        )}
                        {/* {reportColumnVisibility.buys && (
                            <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestSort('buys')}>
                                S Wallets {sortConfig?.key === 'buys' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
                            </th>
                        )} */}
                        {/* {reportColumnVisibility.incompleteBuys && (
                        <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestSort('incompleteBuyCount')}>
                            I-Buys {sortConfig?.key === 'incompleteBuyCount' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
                        </th>
                        )} */}
                        {reportColumnVisibility.sinceBuy && (
                            <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestSort('sinceBuy')}>
                                L Buy {sortConfig?.key === 'sinceBuy' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
                            </th>
                        )}
                        {reportColumnVisibility.sinceSell && (
                            <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestSort('sinceSell')}>
                                L Sell {sortConfig?.key === 'sinceSell' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
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
                                {/* <Link
                                    href={`/txns/${item.id}/add`}
                                    style={{
                                    textDecoration: 'none',
                                    // Apply conditional color based on total shares
                                    color: item.totalCurrentShares === 0 ? 'red' : 'inherit' // Check if total is zero
                                    }}
                                >
                                    {item.symbol}
                                </Link> | */}

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
                                {reportColumnVisibility.swingWalletCount  && (
                                    <td style={{ padding: '5px' }}>{item.swingWalletCount }</td>
                                )}
                                {reportColumnVisibility.sinceBuy && (
                                    <td style={{
                                        padding: '5px', // Keep existing padding
                                        ...getSinceBuyCellStyle(item.sinceBuy) // Merge conditional styles
                                        }}>
                                        {item.sinceBuy != null ? `${item.sinceBuy} d` : '-'}
                                    </td>
                                )}
                                {reportColumnVisibility.sinceSell && (
                                    <td style={{ padding: '5px' }}>{item.sinceSell != null ? `${item.sinceSell} d` : '-'}</td>
                                )}
                                {reportColumnVisibility.currentPrice && (
                                    <td style={{ padding: '5px' }}>
                                        {typeof item.currentPrice === 'number' ? `$${item.currentPrice.toFixed(2)}` : '-'}
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
                                        {typeof item.ltpiaTakeProfitPrice === 'number' ? `$${item.ltpiaTakeProfitPrice.toFixed(2)}` : '-'}
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