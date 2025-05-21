// app/(authed)/page.tsx
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';
import { usePrices } from '@/app/contexts/PriceContext'; // Import context hook
import { fetchAuthSession } from 'aws-amplify/auth';
import PortfolioOverview from './components/PortfolioOverview';
import ColumnVisibilityControls, { ReportColumnVisibilityState } from './components/ColumnVisibilityControls';
import StockTable, { ReportDataItem, ReportColumnKey } from './components/StockTable';
import { useAuthStatus } from '@/app/contexts/AuthStatusContext'; // Import useAuthStatus

// const SHARE_EPSILON = 0.00001; // Example value, adjust as needed
// const CURRENCY_PRECISION = 2;  // Example value (e.g., for dollars and cents)
// const PERCENT_PRECISION = 2;   // Example value (e.g., 12.34%)

import {
    SHARE_PRECISION,
    CURRENCY_PRECISION,
    PERCENT_PRECISION,
    SHARE_EPSILON,
    //CURRENCY_EPSILON,
    //PERCENT_EPSILON // Import if your logic uses it
} from '@/app/config/constants';

type PortfolioStockDataType = { // Simplified representation needed for this page
    id: string;
    symbol: string;
    pdp: number | null | undefined;
    name?: string | null | undefined;
    budget?: number | null | undefined;
    isHidden?: boolean | null | undefined;
    region?: string | null | undefined; // Added region property
}

type StockWalletDataType = Schema['StockWallet']['type'];

//type FiveDayDipResult = Record<string, number | null>; // Map: symbol -> dip percentage or null

type TransactionListResultType = Awaited<ReturnType<typeof client.models.Transaction.list>>;

const client = generateClient<Schema>();

export default function HomePage() {    
    
    const [reportColumnVisibility, setReportColumnVisibility] = useState<ReportColumnVisibilityState>({
        fiveDayDip: true,
        lbd: true,
        swingWalletCount: true,
        sinceBuy: true,
        sinceSell: false,
        currentPrice: true,
        percentToBe: false,
        ltpiaTakeProfitPrice: true,
        percentToTp: true,
        tpShares: true,
    });

    const COLUMN_LABELS: Record<keyof ReportColumnVisibilityState, string> = {
        fiveDayDip: '5DD',      
        lbd: 'LBD',
        swingWalletCount: 'Swing Wallets',         
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

    const [allTransactions, setAllTransactions] = useState<Schema['Transaction'][]>([]);

    const { latestPrices, pricesLoading, pricesError, lastPriceFetchTimestamp, fetchLatestPricesForAllStocks, progressMessage } = usePrices(); // Added progressMessage
    //const { user, accessStatus: authHookAccessStatus } = useAuthStatus(); // Renamed destructured accessStatus to avoid conflict

    const formatTimestamp = (date: Date | null): string => {
        if (!date) return "N/A";
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
            // console.error("[app/(authed)/page.tsx] - Error formatting date:", e);
            return date.toLocaleDateString(); // Fallback
        }
    }

    const [pageAccessLevel, setPageAccessLevel] = useState<'loading' | 'approved' | 'denied'>('loading'); // Renamed state variable

    useEffect(() => {
        const checkUserGroup = async () => {
            try {
                const session = await fetchAuthSession();
                const accessToken = session.tokens?.accessToken;
                if (!accessToken) {
                  // console.log("[app/(authed)/page.tsx] - Access token not found in session.");
                  setPageAccessLevel('denied'); // Use renamed setter
                  return;
                }
                const groups = accessToken.payload['cognito:groups'] as string[] | undefined;
                // console.log("[app/(authed)/page.tsx] - User groups:", groups); // For debugging
                if (groups && groups.includes('ApprovedUsers')) {
                  setPageAccessLevel('approved'); // Use renamed setter
                } else {
                  setPageAccessLevel('denied'); // Use renamed setter
                }
              } catch (error) {
                // console.error("[app/(authed)/page.tsx] - Error checking user group (or user not authenticated):", error);
                setPageAccessLevel('denied'); // Use renamed setter
              }
            };
        checkUserGroup();
    }, []); // Run only once on component mount
    
    const fetchAllPaginatedTransactions = useCallback(async (): Promise<Schema['Transaction'][]> => {
        let accumulatedTxns: Schema['Transaction'][] = [];
        let currentToken: string | null = null;
        let loopSafetyCounter = 0;
        const maxLoops = 25; // Adjust max pages if needed

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

        try {
            do {
                loopSafetyCounter++;
                if (loopSafetyCounter > maxLoops) {
                    // console.warn("[app/(authed)/page.tsx] - Exceeded maximum pagination loops fetching all transactions.");
                    throw new Error(`Could not fetch all transactions after ${maxLoops} pages.`);
                }

                const listResult: TransactionListResultType = await client.models.Transaction.list({
                    nextToken: currentToken,
                    limit: 5000, // Fetch larger chunks
                    selectionSet: selectionSetNeeded // Use defined selectionSet
                });

                const fetchedTxns = listResult.data;
                const errors = listResult.errors;
                const returnedToken = listResult.nextToken ?? null;

                if (errors) throw errors; // Throw GraphQL errors

                if (fetchedTxns) {
                    accumulatedTxns = [...accumulatedTxns, ...(fetchedTxns as any)];
                }
                currentToken = returnedToken;

            } while (currentToken !== null);

            return accumulatedTxns;

        } catch (err: any) {
            // console.error('[app/(authed)/page.tsx] - Error during paginated transaction fetch:', err);
            const errMsg = Array.isArray(err?.errors) ? err.errors[0].message : (err.message || 'Failed to load all transactions.');
            throw new Error(errMsg); // Re-throw to be caught by fetchPageData
        }
    }, []); // Empty dependency array - stable function definition

    const fetchPageData = useCallback(async () => {
        setIsLoading(true); // Use combined loading state
        setError(null);     // Use combined error state
        setPortfolioStocks([]);
        setAllTransactions([]);
        setAllWallets([]);

        try {
            const [stockResult, allTxnsData, walletResult] = await Promise.all([
                client.models.PortfolioStock.list({
                    selectionSet: ['id', 'symbol', 'pdp', 'name', 'budget', 'isHidden', 'region'], // Added region to selection
                    filter: {
                        isHidden: { ne: true } // ne: not equal to true (i.e., fetch if false or null/undefined)
                    },
                    limit: 1000
                }),
                fetchAllPaginatedTransactions(), // Call the pagination helper

                client.models.StockWallet.list({
                    selectionSet: [ // Fields needed for calculations
                        'id',
                        'portfolioStockId',
                        'walletType',
                        'buyPrice',
                        'remainingShares',
                        'tpValue', // Needed for finding lowest TP
                        'sellTxnCount', // Potentially useful later
                        'sharesSold', // Potentially useful later
                        'totalInvestment', // Add this for budget calculations
                        'totalSharesQty' // Add this for budget calculations
                    ],
                    limit: 3000 // Adjust limit generously for wallets
                })
            ]);

            if (stockResult && Array.isArray((stockResult as any).errors) && (stockResult as any).errors.length > 0) {
                 throw (stockResult as any).errors;
            }
            
            const visibleStocks = (stockResult.data as any[]).filter(stock => stock.isHidden !== true);
            setPortfolioStocks(visibleStocks);
            
            const visibleStockIds = new Set(visibleStocks.map(stock => stock.id));
            
            const visibleTransactions = (allTxnsData as any[]).filter(
                txn => visibleStockIds.has(txn.portfolioStockId)
            );
            setAllTransactions(visibleTransactions);
            
            const visibleWallets = (walletResult.data as any[]).filter(
                wallet => visibleStockIds.has(wallet.portfolioStockId)
            );
            setAllWallets(visibleWallets);

        } catch (err: any) {
            // console.error("[app/(authed)/page.tsx] - Error fetching page data:", err);
            const errorMessage = Array.isArray(err?.errors) ? err.errors[0].message : (err.message || "Failed to load page data.");
            setError(errorMessage); // Set combined error state
            setPortfolioStocks([]);
            setAllTransactions([]);
            setAllWallets([]);
        } finally {
            setIsLoading(false); // Set combined loading state false
        }
    }, [fetchAllPaginatedTransactions]); // Add helper to dependencies

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

    interface ProcessedStockData {
        lastSwingBuy: { date: string; price: number | null } | undefined;
        lastSwingSell: { date: string } | undefined;
        swingBuyCount: number;
        activeSwingWallets: StockWalletDataType[];
        lowestSwingBuyPriceWallet: StockWalletDataType | null;
        lowestSwingTpWallet: StockWalletDataType | null;
        totalCurrentSwingShares: number;
        totalCurrentHoldShares: number;
    }
    type ProcessedDataMap = Record<string, ProcessedStockData>;

    const processedData = useMemo((): ProcessedDataMap => {
        const dataMap: ProcessedDataMap = {};
        const epsilon = 0.000001;

        const typedTransactions: Schema['Transaction']['type'][] = allTransactions.map(
            txn => txn as unknown as Schema['Transaction']['type']
        );

        portfolioStocks.forEach(stock => {
            const stockId = stock.id;
            if (!stockId) return;

            const stockTxns = typedTransactions.filter(txn => txn.portfolioStockId === stockId);
            const stockWallets = allWallets.filter(w => w.portfolioStockId === stockId);

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

            const sortedStockTxns = [...stockTxns].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
            sortedStockTxns.forEach(txn => {
                if (txn.action === 'Buy' && (txn.txnType === 'Swing' || (txn.txnType === 'Split' && (txn.swingShares ?? 0) > epsilon))) {
                    stockData.swingBuyCount++;
                    if (!stockData.lastSwingBuy || (txn.date && txn.date >= stockData.lastSwingBuy.date)) {
                        stockData.lastSwingBuy = { date: txn.date, price: txn.price ?? null };
                    }
                }
                else if (txn.action === 'Sell' && txn.txnType === 'Swing') {
                     if (!stockData.lastSwingSell || (txn.date && txn.date >= stockData.lastSwingSell.date)) {
                        stockData.lastSwingSell = { date: txn.date };
                    }
                }
            });

            stockData.activeSwingWallets = stockWallets.filter(w =>
                w.walletType === 'Swing' && (w.remainingShares ?? 0) > epsilon
            );
            stockData.totalCurrentSwingShares = stockData.activeSwingWallets.reduce((sum, w) => sum + (w.remainingShares ?? 0), 0);
            stockData.totalCurrentHoldShares = stockWallets
                .filter(w => w.walletType === 'Hold' && (w.remainingShares ?? 0) > epsilon)
                .reduce((sum, w) => sum + (w.remainingShares ?? 0), 0);

            stockData.lowestSwingBuyPriceWallet = stockData.activeSwingWallets.reduce((lowest, current) => {
                if (!lowest) return current;
                if (typeof current.buyPrice === 'number' && current.buyPrice < (lowest.buyPrice ?? Infinity)) {
                    return current;
                }
                return lowest;
            }, null as StockWalletDataType | null);

            stockData.lowestSwingTpWallet = stockData.activeSwingWallets
                 .filter(w => typeof w.tpValue === 'number' && w.tpValue > 0)
                 .reduce((lowest, current) => {
                    if (!lowest) return current;
                    if (current.tpValue! < lowest.tpValue!) {
                        return current;
                    }
                    return lowest;
                 }, null as StockWalletDataType | null);

            dataMap[stockId] = stockData;
        });

        return dataMap;
    }, [allTransactions, allWallets, portfolioStocks]);

    function calculateDaysAgo(dateString: string | null | undefined): number | null {
        if (!dateString) return null;
        try {
          const pastDate = new Date(dateString + 'T00:00:00Z');
          const today = new Date();
          today.setUTCHours(0, 0, 0, 0);
          const diffTime = today.getTime() - pastDate.getTime();
          if (diffTime < 0) return 0;
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          return diffDays;
        } catch (e) {
          // console.error("[app/(authed)/page.tsx] - Error parsing date for diff calculation:", dateString, e);
          return null;
        }
    }

    const reportData = useMemo((): ReportDataItem[] => {
        return portfolioStocks.map(stock => {
            const stockId: string = stock.id;
            const symbol: string = stock.symbol;
            const pdp: number | null | undefined = stock.pdp;
            const priceData = latestPrices[symbol];
            const currentPrice = priceData?.currentPrice ?? null;

            const procData = processedData[stockId] ?? {
                lastSwingBuy: undefined, lastSwingSell: undefined, swingBuyCount: 0,
                activeSwingWallets: [], lowestSwingBuyPriceWallet: null, lowestSwingTpWallet: null,
                totalCurrentSwingShares: 0, totalCurrentHoldShares: 0,
            };

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

            let lbdPercent: number | null = null;
            const lastSwingBuyPrice = procData.lastSwingBuy?.price;
            if (typeof currentPrice === 'number' && typeof lastSwingBuyPrice === 'number' && typeof pdp === 'number' && lastSwingBuyPrice > 0) {
                const diffPercent = (currentPrice / lastSwingBuyPrice - 1) * 100;
                if (diffPercent <= (pdp * -1)) {
                    lbdPercent = diffPercent;
                }
            }

            let percentToBe: number | null = null;
            const lowestSwingBuyPrice = procData.lowestSwingBuyPriceWallet?.buyPrice;
            if (typeof currentPrice === 'number' && typeof lowestSwingBuyPrice === 'number' && lowestSwingBuyPrice > 0) {
                percentToBe = (currentPrice / lowestSwingBuyPrice - 1) * 100;
            }

            const lowestSwingTpPrice = procData.lowestSwingTpWallet?.tpValue;
            const lowestSwingTpShares = procData.lowestSwingTpWallet?.remainingShares;
            let percentToTp: number | null = null;
            if (typeof currentPrice === 'number' && typeof lowestSwingTpPrice === 'number' && lowestSwingTpPrice > 0) {
                percentToTp = (currentPrice / lowestSwingTpPrice - 1) * 100;
            }

            const sinceBuyDays = calculateDaysAgo(procData.lastSwingBuy?.date);
            const sinceSellDays = calculateDaysAgo(procData.lastSwingSell?.date);
            const swingBuyCountValue = procData.swingBuyCount;
            const totalShares = procData.totalCurrentSwingShares + procData.totalCurrentHoldShares;
            const swingWalletCountValue = procData.activeSwingWallets.length;

            return {
                id: stockId,
                symbol: symbol,
                currentPrice: currentPrice,
                fiveDayDip: fiveDayDipPercent,
                lbd: lbdPercent,
                percentToBe: percentToBe,
                ltpiaTakeProfitPrice: lowestSwingTpPrice ?? null,
                percentToTp: percentToTp,
                tpShares: lowestSwingTpShares ?? null,
                sinceBuy: sinceBuyDays,
                sinceSell: sinceSellDays,
                buys: swingBuyCountValue,
                totalCurrentShares: totalShares,
                incompleteBuyCount: 0,
                swingWalletCount: swingWalletCountValue,
            };
        });
    }, [portfolioStocks, latestPrices, processedData]);

    const portfolioBudgetStats = useMemo(() => {
        const totalBudget = portfolioStocks.reduce((sum, stock) => sum + (stock.budget ?? 0), 0);

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
    }, [portfolioStocks, allWallets]);

    const portfolioTransactionCounts = useMemo(() => {
        const buys = allTransactions.filter(t => (t as any).action === 'Buy').length;
        const swingSells = allTransactions.filter(t => (t as any).action === 'Sell' && (t as any).txnType === 'Swing').length;
        const holdSells = allTransactions.filter(t => (t as any).action === 'Sell' && (t as any).txnType === 'Hold').length;
        const totalSells = swingSells + holdSells;
        return { buys, swingSells, holdSells, totalSells };
    }, [allTransactions]);

    const portfolioRealizedPL = useMemo(() => {
        const walletBuyPriceMap = new Map<string, number>();
        allWallets.forEach(w => {
            if (w.id && typeof w.buyPrice === 'number') {
                walletBuyPriceMap.set(w.id, w.buyPrice);
            }
        });
    
        let totalSwingPlDollars = 0, totalSwingCostBasis = 0;
        let totalHoldPlDollars = 0, totalHoldCostBasis = 0;
    
        allTransactions.forEach(txn => {
            if ((txn as any).action === 'Sell' && (txn as any).completedTxnId && typeof (txn as any).quantity === 'number' && typeof (txn as any).price === 'number') {
                const walletBuyPrice = walletBuyPriceMap.get((txn as any).completedTxnId);
                if (typeof walletBuyPrice === 'number') {
                    const costBasisForTxn = walletBuyPrice * (txn as any).quantity;
                    const profitForTxn = ((txn as any).price - walletBuyPrice) * (txn as any).quantity;
                    if ((txn as any).txnType === 'Swing') {
                        totalSwingPlDollars += profitForTxn;
                        totalSwingCostBasis += costBasisForTxn;
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
            totalSwingCostBasis: totalSwingCostBasis,
            totalHoldCostBasis: totalHoldCostBasis,
            totalStockCostBasis: totalStockCostBasis,
        };
    }, [allTransactions, allWallets]);

    const portfolioUnrealizedPL = useMemo(() => {
        //console.log("[app/(authed)/page.tsx] - [Memo] Calculating portfolioUnrealizedPL ($ and %)");

        let totalUnrealizedSwingPL = 0;
        let currentSwingCostBasis = 0;
        let currentSwingCostBasisForPct = 0;
        let totalUnrealizedHoldPL = 0;
        let currentHoldCostBasis = 0;
        let currentHoldCostBasisForPct = 0;
        let partialDataUsed = false;

        allWallets.forEach(wallet => {
        if ((wallet.remainingShares ?? 0) > SHARE_EPSILON && typeof wallet.buyPrice === 'number') {
            const stockInfo = portfolioStocks.find(s => s.id === wallet.portfolioStockId);
            const stockSymbol = stockInfo?.symbol;
            const currentPrice = stockSymbol ? (latestPrices[stockSymbol]?.currentPrice ?? null) : null;

            const costBasisForWallet = wallet.buyPrice * wallet.remainingShares!;
            if (wallet.walletType === 'Swing') {
                currentSwingCostBasis += costBasisForWallet;
            } else if (wallet.walletType === 'Hold') {
                currentHoldCostBasis += costBasisForWallet;
            }

            if (currentPrice === null) {
            partialDataUsed = true;
            // console.warn(`[app/(authed)/page.tsx] - [Unrealized P/L] SKIPPING P/L calc for wallet ${wallet.id} due to missing price for ${stockSymbol || 'unknown'}`);
            return;
            }

            const unrealizedForWallet = (currentPrice - wallet.buyPrice) * wallet.remainingShares!;

            if (wallet.walletType === 'Swing') {
            totalUnrealizedSwingPL += unrealizedForWallet;
            currentSwingCostBasisForPct += costBasisForWallet;
            } else if (wallet.walletType === 'Hold') {
            totalUnrealizedHoldPL += unrealizedForWallet;
            currentHoldCostBasisForPct += costBasisForWallet;
            }
        }
        });

        const swingPercent = (currentSwingCostBasisForPct > SHARE_EPSILON)
            ? (totalUnrealizedSwingPL / currentSwingCostBasisForPct) * 100
            : (Math.abs(totalUnrealizedSwingPL) < 0.001 ? 0 : null);

        const holdPercent = (currentHoldCostBasisForPct > SHARE_EPSILON)
            ? (totalUnrealizedHoldPL / currentHoldCostBasisForPct) * 100
            : (Math.abs(totalUnrealizedHoldPL) < 0.001 ? 0 : null);

        const totalUnrealizedPl = totalUnrealizedSwingPL + totalUnrealizedHoldPL;
        const currentTotalCostBasisForPct = currentSwingCostBasisForPct + currentHoldCostBasisForPct;
        const totalPercent = (currentTotalCostBasisForPct > SHARE_EPSILON)
            ? (totalUnrealizedPl / currentTotalCostBasisForPct) * 100
            : (Math.abs(totalUnrealizedPl) < 0.001 ? 0 : null);

        const roundedSwingDollars = parseFloat(totalUnrealizedSwingPL.toFixed(CURRENCY_PRECISION));
        const roundedHoldDollars = parseFloat(totalUnrealizedHoldPL.toFixed(CURRENCY_PRECISION));
        const roundedTotalDollars = parseFloat(totalUnrealizedPl.toFixed(CURRENCY_PRECISION));
        const roundedSwingPercent = typeof swingPercent === 'number' ? parseFloat(swingPercent.toFixed(PERCENT_PRECISION)) : null;
        const roundedHoldPercent = typeof holdPercent === 'number' ? parseFloat(holdPercent.toFixed(PERCENT_PRECISION)) : null;
        const roundedTotalPercent = typeof totalPercent === 'number' ? parseFloat(totalPercent.toFixed(PERCENT_PRECISION)) : null;

        //console.log(`[app/(authed)/page.tsx] - [Unrealized P/L] Swing $: ${roundedSwingDollars}, Hold $: ${roundedHoldDollars}, Total $: ${roundedTotalDollars}. Partial: ${partialDataUsed}`);

        return {
            unrealizedSwingDollars: roundedSwingDollars,
            unrealizedSwingPercent: roundedSwingPercent,
            currentSwingCostBasis: currentSwingCostBasis,
            unrealizedHoldDollars: roundedHoldDollars,
            unrealizedHoldPercent: roundedHoldPercent,
            currentHoldCostBasis: currentHoldCostBasis,
            unrealizedTotalDollars: roundedTotalDollars,
            unrealizedTotalPercent: roundedTotalPercent,
            currentTotalCostBasis: currentSwingCostBasis + currentHoldCostBasis,
            partialDataUsed: partialDataUsed,
        };

    }, [allWallets, portfolioStocks, latestPrices]);

    const portfolioTotalPL = useMemo(() => {
        //console.log("[app/(authed)/page.tsx] - [Memo] Calculating portfolioTotalPL ($ and %)");

        const totalSwingDollars = (portfolioRealizedPL.totalSwingPlDollars ?? 0) + (portfolioUnrealizedPL.unrealizedSwingDollars ?? 0);
        const totalHoldDollars = (portfolioRealizedPL.totalHoldPlDollars ?? 0) + (portfolioUnrealizedPL.unrealizedHoldDollars ?? 0);
        const totalStockDollars = (portfolioRealizedPL.totalStockPlDollars ?? 0) + (portfolioUnrealizedPL.unrealizedTotalDollars ?? 0);

        const combinedSwingBasis = (portfolioRealizedPL.totalSwingCostBasis ?? 0) + (portfolioUnrealizedPL.currentSwingCostBasis ?? 0);
        const combinedHoldBasis = (portfolioRealizedPL.totalHoldCostBasis ?? 0) + (portfolioUnrealizedPL.currentHoldCostBasis ?? 0);
        const combinedStockBasis = (portfolioRealizedPL.totalStockCostBasis ?? 0) + (portfolioUnrealizedPL.currentTotalCostBasis ?? 0);

        const totalSwingPercentCalc = (combinedSwingBasis > SHARE_EPSILON)
            ? (totalSwingDollars / combinedSwingBasis) * 100
            : (Math.abs(totalSwingDollars) < 0.001 ? 0 : null);
        const totalHoldPercentCalc = (combinedHoldBasis > SHARE_EPSILON)
            ? (totalHoldDollars / combinedHoldBasis) * 100
            : (Math.abs(totalHoldDollars) < 0.001 ? 0 : null);
        const totalStockPercentCalc = (combinedStockBasis > SHARE_EPSILON)
            ? (totalStockDollars / combinedStockBasis) * 100
            : (Math.abs(totalStockDollars) < 0.001 ? 0 : null);

        const roundedSwingDollars = parseFloat(totalSwingDollars.toFixed(CURRENCY_PRECISION));
        const roundedHoldDollars = parseFloat(totalHoldDollars.toFixed(CURRENCY_PRECISION));
        const roundedStockDollars = parseFloat(totalStockDollars.toFixed(CURRENCY_PRECISION));
        const roundedSwingPercent = typeof totalSwingPercentCalc === 'number' ? parseFloat(totalSwingPercentCalc.toFixed(PERCENT_PRECISION)) : null;
        const roundedHoldPercent = typeof totalHoldPercentCalc === 'number' ? parseFloat(totalHoldPercentCalc.toFixed(PERCENT_PRECISION)) : null;
        const roundedStockPercent = typeof totalStockPercentCalc === 'number' ? parseFloat(totalStockPercentCalc.toFixed(PERCENT_PRECISION)) : null;

        //console.log(`[app/(authed)/page.tsx] - [Total P/L] Swing: ${roundedSwingDollars} (${roundedSwingPercent}%), Hold: ${roundedHoldDollars} (${roundedHoldPercent}%), Stock: ${roundedStockDollars} (${roundedStockPercent}%)`);

        return {
        totalSwingDollars: roundedSwingDollars,
        totalSwingPercent: roundedSwingPercent,
        totalHoldDollars: roundedHoldDollars,
        totalHoldPercent: roundedHoldPercent,
        totalStockDollars: roundedStockDollars,
        totalStockPercent: roundedStockPercent,
        partialDataUsed: portfolioUnrealizedPL.partialDataUsed,
        };
    }, [portfolioRealizedPL, portfolioUnrealizedPL]);

    const portfolioYtdPL = useMemo(() => {
        // console.log('[app/(authed)/page.tsx] - [YTD Calc Start] Input Lengths:', {
        //     allWallets: allWallets.length,
        //     portfolioStocks: portfolioStocks.length,
        //     latestPrices: Object.keys(latestPrices).length,
        //     allTransactions: allTransactions.length
        // });
        const walletBuyPriceMap = new Map<string, number>();
        allWallets.forEach(w => { if (w.id && typeof w.buyPrice === 'number') walletBuyPriceMap.set(w.id, w.buyPrice); });

        const currentYear = new Date().getFullYear();
        const startOfYear = `${currentYear}-01-01`;

        let ytdRealizedSwingPL = 0, ytdRealizedHoldPL = 0;
        let currentUnrealizedSwingPL = 0, currentSwingCostBasis = 0;
        let currentUnrealizedHoldPL = 0, currentHoldCostBasis = 0;
        let partialDataUsed = false;

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

        // console.log('[app/(authed)/page.tsx] - [YTD Calc] After Realized Calc:', { ytdRealizedSwingPL, ytdRealizedHoldPL });

        // console.log('[app/(authed)/page.tsx] - [YTD Calc] Starting Unrealized Calc Loop...');

        allWallets.forEach((wallet, index) => {
            const stockForWallet = portfolioStocks.find(s => s.id === wallet.portfolioStockId);
            const stockSymbol = stockForWallet?.symbol ?? null;
            // console.log(`[app/(authed)/page.tsx] - [YTD Calc Loop ${index}] WalletID=${wallet.id} StockID=${wallet.portfolioStockId} -> Symbol=${stockSymbol}`);

            const currentPrice = latestPrices[stockSymbol ?? '']?.currentPrice ?? null;
            // console.log(`[app/(authed)/page.tsx] - [YTD Calc Loop ${index}] Price lookup for ${stockSymbol}:`, currentPrice);
            
            if (currentPrice === null && (wallet.remainingShares ?? 0) > SHARE_EPSILON) {
                partialDataUsed = true;
                // console.warn(`[app/(authed)/page.tsx] - [YTD Calc Loop ${index}] Setting priceAvailable=false. Missing price for symbol: ${stockSymbol} (Wallet ID: ${wallet.id})`);
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
        
        // console.log('[app/(authed)/page.tsx] - [YTD Calc] After Unrealized Loop:', { currentUnrealizedSwingPL, currentSwingCostBasis, currentUnrealizedHoldPL, currentHoldCostBasis });

        const totalSwingYtdPL_dollars = ytdRealizedSwingPL + currentUnrealizedSwingPL;
        const totalHoldYtdPL_dollars = ytdRealizedHoldPL + currentUnrealizedHoldPL;

        const totalSwingYtdPL_percent = (currentSwingCostBasis > SHARE_EPSILON) ? (totalSwingYtdPL_dollars / currentSwingCostBasis) * 100 : (totalSwingYtdPL_dollars === 0 ? 0 : null);
        const totalHoldYtdPL_percent = (currentHoldCostBasis > SHARE_EPSILON) ? (totalHoldYtdPL_dollars / currentHoldCostBasis) * 100 : (totalHoldYtdPL_dollars === 0 ? 0 : null);

        // console.log('[app/(authed)/page.tsx] - [YTD Calc Success] Calculation complete. Returning:', {
        //     totalSwingYtdPL_dollars, totalSwingYtdPL_percent, totalHoldYtdPL_dollars, totalHoldYtdPL_percent
        // });
        
        return {
            totalSwingYtdPL_dollars: parseFloat(totalSwingYtdPL_dollars.toFixed(CURRENCY_PRECISION)),
            totalSwingYtdPL_percent: typeof totalSwingYtdPL_percent === 'number' ? parseFloat(totalSwingYtdPL_percent.toFixed(PERCENT_PRECISION)) : null,
            totalHoldYtdPL_dollars: parseFloat(totalHoldYtdPL_dollars.toFixed(CURRENCY_PRECISION)),
            totalHoldYtdPL_percent: typeof totalHoldYtdPL_percent === 'number' ? parseFloat(totalHoldYtdPL_percent.toFixed(PERCENT_PRECISION)) : null,
            partialDataUsed: partialDataUsed,
        };

    }, [allTransactions, allWallets, portfolioStocks, latestPrices]);

    const visibleColumnCount = useMemo(() => {
        let count = 1;
        count += (Object.values(reportColumnVisibility) as boolean[]).filter(Boolean).length;
        return count;
    }, [reportColumnVisibility]);
    
    const [sortConfig, setSortConfig] = useState<{ key: ReportColumnKey; direction: 'ascending' | 'descending' } | null>(null);

    const sortedTableData = useMemo(() => {
        let sortableItems = [...reportData];
    
        const handleNullAsc = (val: number | null | undefined): number => {
            return (val === null || val === undefined) ? Infinity : val;
        };
    
        if (sortConfig !== null) {
            const handleNullCurrent = (val: any) => {
               if (val === null || val === undefined) {
                  return sortConfig.direction === 'ascending' ? Infinity : -Infinity;
               }
               return val;
            }
    
            sortableItems.sort((a, b) => {
                const valA = a[sortConfig.key];
                const valB = b[sortConfig.key];
                let comparison = 0;
    
                const resolvedA = handleNullCurrent(valA);
                const resolvedB = handleNullCurrent(valB);
    
                if (resolvedA < resolvedB) comparison = -1;
                else if (resolvedA > resolvedB) comparison = 1;
    
                return sortConfig.direction === 'ascending' ? comparison : comparison * -1;
            });
        } else {
            sortableItems.sort((a, b) => {
                const handleNullAsc = (val: number | null | undefined): number => {
                    return (val === null || val === undefined) ? Infinity : val;
                };
      
                const lbdA = handleNullAsc(a.lbd);
                const lbdB = handleNullAsc(b.lbd);
      
                if (lbdA < lbdB) return -1;
                if (lbdA > lbdB) return 1;
      
                const fiveDayDipA = handleNullAsc(a.fiveDayDip);
                const fiveDayDipB = handleNullAsc(b.fiveDayDip);
      
                if (fiveDayDipA < fiveDayDipB) return -1;
                if (fiveDayDipA > fiveDayDipB) return 1;
      
                return 0;
            });
        }
        return sortableItems;
      }, [reportData, sortConfig]);

    const requestSort = (key: ReportColumnKey) => {
         let direction: 'ascending' | 'descending' = 'ascending';
         if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
             direction = 'descending';
         }
         setSortConfig({ key, direction });
    };

    // Cell styling helper functions
    const getBreakEvenCellStyle = (percent: number | null): React.CSSProperties => {
        if (percent === null || percent === undefined) return {};
        if (percent >= 0) {
            return { color: '#01ff00' };
        } else if (percent >= -1) {
            return { color: '#edff00' };
        } else {
            return {};
        }
    };

    const getSinceBuyCellStyle = (days: number | null, swingWalletCount: number): React.CSSProperties => {
        if (days === null || typeof days !== 'number') {
            return {};
        }
        
        // Get the current month (1-12)
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1; // getMonth() returns 0-11
        
        // New logic: Check both days AND wallet count against current month
        if ((days > 30 && swingWalletCount < currentMonth) || (swingWalletCount === 0)) {
            // Return red for more than 30 days AND fewer wallets than current month
            return { color: '#ff0000' };
        } else if (days > 20 && swingWalletCount < currentMonth) {
            // Return orange for 20-30 days AND fewer wallets than current month
            return { color: '#ffb400' };
        } else {
            return {};
        }
    };

    // Formatting helpers
    const formatCurrency = (value: number | null | undefined): string => {
        if (typeof value !== 'number' || isNaN(value)) {
            return '-';
        }
        return `$${value.toLocaleString(undefined, {
            minimumFractionDigits: CURRENCY_PRECISION,
            maximumFractionDigits: CURRENCY_PRECISION,
        })}`;
    };

    const formatPercent = (value: number | null | undefined): string => {
        if (typeof value !== 'number' || isNaN(value)) {
            return '-';
        }
        return `${value.toFixed(PERCENT_PRECISION)}%`;
    };

    const formatShares = (value: number | null | undefined): string => {
        const decimals = SHARE_EPSILON;
        if (typeof value !== 'number' || isNaN(value)) {
            return '-';
        }
        return value.toFixed(decimals);
    };

    // Handle access control
    if (pageAccessLevel === 'loading') { // Use renamed state variable
        return <p>Loading access...</p>;
    }
  
    if (pageAccessLevel === 'denied') { // Use renamed state variable
        return (
        <div style={{ padding: '2rem' }}>
            <h2>Access Denied</h2>
            <p>I need to know who you are before you can access this application. Ping me with your email address.</p>
        </div>
        );
    }

    // Combined formatters and styling objects for passing to components
    const formatters = { formatCurrency, formatPercent, formatShares };
    const cellStyles = { getBreakEvenCellStyle, getSinceBuyCellStyle };
    const precision = { CURRENCY_PRECISION, PERCENT_PRECISION };

    return (
        <div>
            <h2>Opportunity Report</h2>
            <div style={{ fontSize: '0.7em', color: "gray" }}>
                {pricesLoading
                ? progressMessage || 'Prices are refreshing...' // Display progressMessage if available
                : lastPriceFetchTimestamp
                    ? `Prices as of ${formatTimestamp(lastPriceFetchTimestamp)}`
                    : 'Prices not fetched yet.'
                }
            </div>
            {pricesError && <p style={{ color: 'red' }}>Price Error: {pricesError}</p>}

            {/* Portfolio Overview Component - no longer need to pass regionDistribution */}
            <PortfolioOverview
                isExpanded={isOverviewExpanded}
                toggleExpand={() => setIsOverviewExpanded(prev => !prev)}
                portfolioBudgetStats={portfolioBudgetStats}
                portfolioTransactionCounts={portfolioTransactionCounts}
                portfolioRealizedPL={portfolioRealizedPL}
                portfolioUnrealizedPL={portfolioUnrealizedPL}
                portfolioTotalPL={portfolioTotalPL}
                formatters={formatters}
                precision={precision}
            />
            
            {/* Column Visibility Controls Component */}
            <ColumnVisibilityControls
                columnVisibility={reportColumnVisibility}
                setColumnVisibility={setReportColumnVisibility}
                columnLabels={COLUMN_LABELS}
            />

            {/* Stock Table Component */}
            <StockTable
                isLoading={isLoading}
                reportColumnVisibility={reportColumnVisibility}
                sortedTableData={sortedTableData}
                visibleColumnCount={visibleColumnCount}
                requestSort={requestSort}
                sortConfig={sortConfig}
                formatters={formatters}
                cellStyles={cellStyles}
            />
        </div>
    );
}

type Nullable<T> = T | null | undefined;