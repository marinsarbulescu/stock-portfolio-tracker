// app/(authed)/page.tsx
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { generateClient } from 'aws-amplify/data';
import { isHtpSignalActive, getHtpDisplayValue } from '@/app/utils/htpCalculations';
import type { Schema } from '@/amplify/data/resource';
import { usePrices } from '@/app/contexts/PriceContext'; // Import context hook
import { mergeTestPricesWithRealPrices } from '@/app/utils/priceUtils'; // Import test price utility
import { applySplitAdjustments, extractStockSplits } from '@/app/utils/splitUtils'; // Import split adjustment utilities
import { fetchAuthSession } from 'aws-amplify/auth';
import { calculateTotalRealizedSwingPL, calculateSingleSalePL, calculatePercentToStp, calculatePercentToHtp, calculateHtpTargetPrice, type TransactionForCalculation, type WalletForCalculation } from '@/app/utils/financialCalculations';
import SignalsOverview from './components/SignalsOverview';
import SignalsTable from './components/SignalsTable';
// import { useAuthStatus } from '@/app/contexts/AuthStatusContext'; // Import useAuthStatus - Unused
import type { 
  PortfolioStockDataType, 
  StockWalletDataType, 
  ReportColumnVisibilityState, 
  ReportDataItem, 
  ReportColumnKey,
  PageAccessLevel,
  SortConfig
} from './types';
import type { PortfolioStockDataType as PortfolioPageStockDataType } from '../portfolio/types';

import {
    // SHARE_PRECISION, // Unused
    CURRENCY_PRECISION,
    PERCENT_PRECISION,
    SHARE_EPSILON,
    FETCH_LIMIT_TRANSACTIONS_PAGINATED,
    FETCH_LIMIT_STOCKS_STANDARD,
    FETCH_LIMIT_WALLETS_GENEROUS
    //CURRENCY_EPSILON,
    //PERCENT_EPSILON // Import if your logic uses it
} from '@/app/config/constants';

type TransactionListResultType = Awaited<ReturnType<typeof client.models.Transaction.list>>;

const client = generateClient<Schema>();

export default function HomePage() {    
    
    const [reportColumnVisibility, setReportColumnVisibility] = useState<ReportColumnVisibilityState>({
        riskInvestment: true,
        budgetAvailable: true,
        fiveDayDip: true,
        lbd: true,
        swingWalletCount: true,
        sinceBuy: true,
        sinceSell: false,
        currentPrice: false,
        percentToBe: false,
        ltpiaTakeProfitPrice: false,
        percentToTp: true,
        percentToHtp: true,
        tpShares: true,
    });

    const COLUMN_LABELS: Record<keyof ReportColumnVisibilityState, string> = {
        riskInvestment: 'r-Inv',
        budgetAvailable: 'Available',
        fiveDayDip: '5DD',      
        lbd: 'LBD',
        swingWalletCount: 'Swing Wallets',         
        sinceBuy: 'Last Buy',
        sinceSell: 'Last Sell',
        currentPrice: 'Price',
        percentToBe: '%2BE',          
        ltpiaTakeProfitPrice: 'TP',
        percentToTp: '%2STP',
        percentToHtp: '%2HTP',
        tpShares: 'TP Shares',
    };
    
    const [isOverviewExpanded, setIsOverviewExpanded] = useState(false); // Collapsed by default
    
    const [portfolioStocks, setPortfolioStocks] = useState<PortfolioStockDataType[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    // const [error, setError] = useState<string | null>(null); // Unused

    const [allWallets, setAllWallets] = useState<StockWalletDataType[]>([]);

    const [allTransactions, setAllTransactions] = useState<Schema['Transaction'][]>([]);

    const { latestPrices, pricesLoading, pricesError, lastPriceFetchTimestamp, progressMessage } = usePrices(); // Removed unused fetchLatestPricesForAllStocks
    //const { user, accessStatus: authHookAccessStatus } = useAuthStatus(); // Renamed destructured accessStatus to avoid conflict

    // Create merged prices that include test price overrides for Signals page
    const mergedPrices = useMemo(() => {
        // Convert portfolioStocks to the format expected by mergeTestPricesWithRealPrices
        const stocksWithTestPrices = portfolioStocks.map(stock => ({
            symbol: stock.symbol,
            testPrice: stock.testPrice, // Now properly typed
            // Add other required fields with default values
            id: stock.id,
            name: stock.name || '',
            stockType: 'Stock' as const,
            region: 'US' as const,
            owner: '',
            isHidden: null,
            archived: null,
            archivedAt: null,
            createdAt: '',
            updatedAt: '',
            transactions: null as unknown,
            stockWallets: null as unknown,
            budget: null,
            pdp: null,
            plr: null,
            swingHoldRatio: null,
            stockCommission: null,
            htp: null,
            stockTrend: null,
        }));
        return mergeTestPricesWithRealPrices(latestPrices, stocksWithTestPrices as PortfolioPageStockDataType[]);
    }, [latestPrices, portfolioStocks]);

    // Compute total invested amount per stock by summing remainingShares × buyPrice for all wallets
    const stockInvestments = useMemo(() => {
        const invMap: Record<string, number> = {};
        
        // Group wallets by stock ID and calculate investment
        allWallets.forEach(wallet => {
            if (wallet.portfolioStockId) {
                const investment = (wallet.remainingShares ?? 0) * (wallet.buyPrice ?? 0);
                invMap[wallet.portfolioStockId] = (invMap[wallet.portfolioStockId] ?? 0) + investment;
            }
        });
        
        return invMap;
    }, [allWallets]);

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
        } catch {
            // console.error("[app/(authed)/page.tsx] - Error formatting date:", e);
            return date.toLocaleDateString(); // Fallback
        }
    }

    const [pageAccessLevel, setPageAccessLevel] = useState<PageAccessLevel>('loading'); // Renamed state variable

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
              } catch {
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
            'completedTxnId',
            'swingShares',
            'holdShares',
            'investment',
            'quantity',            
            'txnType',
            'signal',
            'lbd',
            'amount',
            'txnProfit',
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
                    limit: FETCH_LIMIT_TRANSACTIONS_PAGINATED, // Fetch larger chunks
                    selectionSet: selectionSetNeeded // Use defined selectionSet
                });

                const fetchedTxns = listResult.data;
                const errors = listResult.errors;
                const returnedToken = listResult.nextToken ?? null;

                if (errors) throw errors; // Throw GraphQL errors

                if (fetchedTxns) {
                    accumulatedTxns = [...accumulatedTxns, ...(fetchedTxns as Schema['Transaction'][])];
                }
                currentToken = returnedToken;

            } while (currentToken !== null);

            return accumulatedTxns;

        } catch (err: unknown) {
            // console.error('[app/(authed)/page.tsx] - Error during paginated transaction fetch:', err);
            const errMsg = Array.isArray((err as { errors?: Array<{ message: string }> })?.errors) 
                ? (err as { errors: Array<{ message: string }> }).errors[0].message 
                : ((err as Error)?.message || 'Failed to load all transactions.');
            throw new Error(errMsg); // Re-throw to be caught by fetchPageData
        }
    }, []); // Empty dependency array - stable function definition

    const fetchPageData = useCallback(async () => {
        setIsLoading(true); // Use combined loading state
        // setError(null);     // Use combined error state - Unused
        setPortfolioStocks([]);
        setAllTransactions([]);
        setAllWallets([]);

        try {
            const [stockResult, allTxnsData, walletResult] = await Promise.all([
                client.models.PortfolioStock.list({
                    selectionSet: ['id', 'symbol', 'pdp', 'name', 'budget', 'testPrice', 'isHidden', 'archived', 'region', 'htp', 'stockCommission', 'stockTrend', 'totalOutOfPocket', 'currentCashBalance'], // Added cash flow fields
                    filter: {
                        and: [
                            { isHidden: { ne: true } }, // not hidden
                            { archived: { ne: true } }  // not archived
                        ]
                    },
                    limit: FETCH_LIMIT_STOCKS_STANDARD
                }),
                fetchAllPaginatedTransactions(), // Call the pagination helper

                client.models.StockWallet.list({
                    selectionSet: [ // Fields needed for calculations
                        'id',
                        'portfolioStockId',
                        'walletType',
                        'buyPrice',
                        'remainingShares',
                        'stpValue', // Needed for finding lowest STP
                        'sellTxnCount', // Potentially useful later
                        'sharesSold', // Potentially useful later
                        'totalInvestment', // Add this for budget calculations
                        'totalSharesQty' // Add this for budget calculations
                    ],
                    limit: FETCH_LIMIT_WALLETS_GENEROUS // Adjust limit generously for wallets
                })
            ]);

            if (stockResult && Array.isArray((stockResult as { errors?: Array<{ message: string }> }).errors) && (stockResult as { errors: Array<{ message: string }> }).errors.length > 0) {
                 throw (stockResult as { errors: Array<{ message: string }> }).errors;
            }
            
            const visibleStocks = (stockResult.data as PortfolioStockDataType[]).filter(stock => !stock.isHidden && !stock.archived);
            console.log('[Signals] Visible stocks after filtering:', visibleStocks.length);
            console.log('[Signals] First few visible stocks:', visibleStocks.slice(0, 3).map(s => ({ symbol: s.symbol, id: s.id, isHidden: s.isHidden, archived: s.archived })));
            
            setPortfolioStocks(visibleStocks);
            
            const visibleStockIds = new Set(visibleStocks.map(stock => stock.id));
            console.log('[Signals] Visible stock IDs:', Array.from(visibleStockIds).slice(0, 5));
            
            const visibleTransactions = allTxnsData.filter(
                (txn: unknown) => {
                    const transaction = txn as { portfolioStockId: string };
                    return visibleStockIds.has(transaction.portfolioStockId);
                }
            );
            console.log('[Signals] Visible transactions after filtering:', visibleTransactions.length);
            
            setAllTransactions(visibleTransactions);
            
            const visibleWallets = (walletResult.data as StockWalletDataType[]).filter(
                wallet => visibleStockIds.has(wallet.portfolioStockId)
            );
            console.log('[Signals] Visible wallets after filtering:', visibleWallets.length);
            
            setAllWallets(visibleWallets);

        } catch (err) {
            console.error("[Signals] Error fetching page data:", err);
            const errorMessage = Array.isArray((err as { errors?: Array<{ message: string }> })?.errors) 
                ? (err as { errors: Array<{ message: string }> }).errors[0].message 
                : ((err as Error)?.message || "Failed to load page data.");
            console.error("[Signals] Error message:", errorMessage);
            // setError(errorMessage); // Set combined error state - Unused
            setPortfolioStocks([]);
            setAllTransactions([]);
            setAllWallets([]);
        } finally {
            console.log('[Signals] Data fetch completed');
            setIsLoading(false); // Set combined loading state false
        }
    }, [fetchAllPaginatedTransactions]); // Add helper to dependencies

    useEffect(() => {
        fetchPageData();
    }, [fetchPageData]); // Renamed fetch function

    // interface ProcessedStockTxnData { // Unused interface
    //     lastBuy?: { date: string; price: number | null }; // Store only needed info
    //     lastSell?: { date: string };
    //     buyCount: number;
    //     ltpiaPrice?: number | null;
    //     ltpiaTp?: number | null;
    //     ltpiaPlayShares?: number | null;
    //     currentPlayShares: number;
    //     currentHoldShares: number;
    //     totalCurrentShares: number;
    //     incompleteBuyCount: number;
    // }
    // type ProcessedTxnMap = Record<string, ProcessedStockTxnData>; // Keyed by stock ID - Unused

    interface ProcessedStockData {
        lastBuy: { date: string; price: number | null } | undefined; // Changed from lastSwingBuy
        lastSell: { date: string } | undefined; 
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
                lastBuy: undefined, // Changed from lastSwingBuy
                lastSell: undefined, 
                swingBuyCount: 0,
                activeSwingWallets: [],
                lowestSwingBuyPriceWallet: null,
                lowestSwingTpWallet: null,
                totalCurrentSwingShares: 0,
                totalCurrentHoldShares: 0,
            };

            const sortedStockTxns = [...stockTxns].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
            
            // Apply stock split adjustments to transaction prices before processing
            const stockSplits = extractStockSplits(sortedStockTxns);
            const splitAdjustedTxns = sortedStockTxns.map(txn => {
                const adjustment = applySplitAdjustments(txn, stockSplits);
                return {
                    ...txn,
                    price: adjustment.adjustedPrice || txn.price,
                    quantity: adjustment.adjustedShares || txn.quantity
                };
            });
            
            splitAdjustedTxns.forEach(txn => {
                // Update swingBuyCount (specific to Swing and Split-to-Swing buys)
                if (txn.action === 'Buy' && (txn.txnType === 'Swing' || (txn.txnType === 'Split' && (txn.swingShares ?? 0) > epsilon))) {
                    stockData.swingBuyCount++;
                }

                // Update lastBuy (for Buy actions with actual prices: Swing, Hold, Split - but exclude StockSplit)
                if (txn.action === 'Buy' && typeof txn.price === 'number' && txn.price > 0) {
                    if (!stockData.lastBuy || (txn.date && txn.date > stockData.lastBuy.date)) {
                        stockData.lastBuy = { date: txn.date, price: txn.price };
                    }
                }
                // Modified to include 'Hold' type for lastSell (from previous step)
                else if (txn.action === 'Sell' && (txn.txnType === 'Swing' || txn.txnType === 'Hold')) {
                     if (!stockData.lastSell || (txn.date && txn.date >= stockData.lastSell.date)) {
                        stockData.lastSell = { date: txn.date };
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
                 .filter(w => typeof w.stpValue === 'number' && w.stpValue > 0)
                 .reduce((lowest, current) => {
                    if (!lowest) return current;
                    if (current.stpValue! < lowest.stpValue!) {
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
        } catch {
          // console.error("[app/(authed)/page.tsx] - Error parsing date for diff calculation:", dateString, e);
          return null;
        }
    }

    // HTP Signal calculation function - checks if any Hold wallet for a stock has HTP signal
    const checkHtpSignalForStock = useCallback((stockId: string, currentStockPrice: number | null): boolean => {
        if (typeof currentStockPrice !== 'number') {
            return false;
        }

        // Get the stock data to access HTP percentage
        const stock = portfolioStocks.find(s => s.id === stockId);
        if (!stock || typeof stock.htp !== 'number' || stock.htp <= 0) {
            return false;
        }

        // Get commission percentage for the stock
        const stockCommission = stock.stockCommission;

        // Get Hold wallets for this stock with remaining shares
        const stockHoldWallets = allWallets.filter(wallet => 
            wallet.portfolioStockId === stockId && 
            wallet.walletType === 'Hold' &&
            (wallet.remainingShares ?? 0) > SHARE_EPSILON
        );

        // Check if any Hold wallet has HTP signal using shared utility
        return stockHoldWallets.some(wallet => {
            const buyPrice = wallet.buyPrice;
            
            if (typeof buyPrice !== 'number' || buyPrice <= 0 || typeof stock.htp !== 'number') {
                return false;
            }

            return isHtpSignalActive(buyPrice, stock.htp, currentStockPrice, stockCommission);
        });
    }, [portfolioStocks, allWallets]);

    // Get HTP values for wallets with active HTP signals
    const getHtpValuesForStock = useCallback((stockId: string, currentStockPrice: number | null): string[] => {
        if (typeof currentStockPrice !== 'number') {
            return [];
        }

        // Get the stock data to access HTP percentage
        const stock = portfolioStocks.find(s => s.id === stockId);
        if (!stock || typeof stock.htp !== 'number' || stock.htp <= 0) {
            return [];
        }

        // Get commission percentage for the stock
        const stockCommission = stock.stockCommission;

        // Get Hold wallets for this stock with remaining shares
        const stockHoldWallets = allWallets.filter(wallet => 
            wallet.portfolioStockId === stockId && 
            wallet.walletType === 'Hold' &&
            (wallet.remainingShares ?? 0) > SHARE_EPSILON
        );

        // Collect HTP values for wallets with active HTP signals using shared utility
        const htpValues: string[] = [];
        
        stockHoldWallets.forEach(wallet => {
            const buyPrice = wallet.buyPrice;

            if (typeof buyPrice === 'number' && buyPrice > 0 && typeof stock.htp === 'number') {
                const displayValue = getHtpDisplayValue(buyPrice, stock.htp, currentStockPrice, stockCommission);
                if (displayValue !== '-') {
                    htpValues.push(displayValue);
                }
            }
        });

        return htpValues;
    }, [portfolioStocks, allWallets]);

    // Compute risk investment per stock (investment in wallets where TP hasn't been met)
    const stockRiskInvestments = useMemo(() => {
        const riskMap: Record<string, number | null> = {};
        
        // First, calculate total tied-up investment per stock
        const stockTotalInvestments: Record<string, number> = {};
        
        allWallets.forEach(wallet => {
            if (wallet.portfolioStockId) {
                const stockId = wallet.portfolioStockId;
                const remainingShares = wallet.remainingShares ?? 0;
                
                // Skip if no remaining shares
                if (remainingShares <= SHARE_EPSILON) {
                    return;
                }
                
                // Calculate tied-up investment for this wallet
                const totalInvestment = wallet.totalInvestment ?? 0;
                const totalShares = wallet.totalSharesQty ?? 0;
                const investmentPerShare = (totalShares > SHARE_EPSILON) ? (totalInvestment / totalShares) : 0;
                const tiedUpInWallet = investmentPerShare * remainingShares;
                
                stockTotalInvestments[stockId] = (stockTotalInvestments[stockId] ?? 0) + tiedUpInWallet;
            }
        });
        
        // Then, for each stock, calculate risk investment using WalletsOverview logic
        Object.keys(stockTotalInvestments).forEach(stockId => {
            const totalTiedUpInvestment = stockTotalInvestments[stockId];
            
            // Get current price from mergedPrices (includes test price)
            const stockSymbol = portfolioStocks.find(s => s.id === stockId)?.symbol;
            const currentPrice = mergedPrices[stockSymbol || '']?.currentPrice;
            
            // If no current price available, return null (can't assess risk without price)
            if (typeof currentPrice !== 'number') {
                riskMap[stockId] = null;
                return;
            }
            
            // Calculate investment in wallets where TP has been MET
            const investmentWithMetTP = allWallets
                .filter(wallet => wallet.portfolioStockId === stockId)
                .reduce((total, wallet) => {
                    const remainingShares = wallet.remainingShares ?? 0;
                    const tp = wallet.stpValue;
                    
                    // Skip if no remaining shares
                    if (remainingShares <= SHARE_EPSILON) {
                        return total;
                    }
                    
                    // Check if TP has been MET (tp <= currentPrice)
                    if (typeof tp === 'number' && tp <= currentPrice) {
                        // Calculate this wallet's tied-up investment
                        const totalInvestment = wallet.totalInvestment ?? 0;
                        const totalShares = wallet.totalSharesQty ?? 0;
                        const investmentPerShare = (totalShares > SHARE_EPSILON) ? (totalInvestment / totalShares) : 0;
                        const tiedUpInWallet = investmentPerShare * remainingShares;
                        
                        return total + tiedUpInWallet;
                    }
                    
                    return total;
                }, 0);
            
            // Risk Investment = Total Investment - Investment with met TP
            riskMap[stockId] = totalTiedUpInvestment - investmentWithMetTP;
        });
        
        return riskMap;
    }, [allWallets, portfolioStocks, mergedPrices]);

    // Compute budget available per stock (Budget - Budget Used)
    const stockBudgetAvailable = useMemo(() => {
        const budgetAvailableMap: Record<string, number> = {};
        
        // Calculate budget available for each stock using stock-level cash flow data
        portfolioStocks.forEach(stock => {
            const stockId = stock.id;
            const stockBudget = stock.budget ?? 0;
            
            // Use the same cash flow data as WalletsOverview
            const stockWithCashFlow = stock as unknown as PortfolioStockDataType & {
                totalOutOfPocket?: number;
                currentCashBalance?: number;
            };
            
            const totalOOP = stockWithCashFlow.totalOutOfPocket || 0;
            const currentCashBalance = stockWithCashFlow.currentCashBalance || 0;
            
            // Budget Used = Net Cash Investment (OOP - Cash Balance)
            const budgetUsed = totalOOP - currentCashBalance;
            
            // Budget Available = Risk Budget - Budget Used
            const budgetAvailable = Math.max(0, stockBudget - budgetUsed);
            
            budgetAvailableMap[stockId] = budgetAvailable;
        });
        
        return budgetAvailableMap;
    }, [portfolioStocks]);

    const reportData = useMemo((): ReportDataItem[] => {
        return portfolioStocks.map(stock => {
            const stockId: string = stock.id;
            const symbol: string = stock.symbol;
            const pdp: number | null | undefined = stock.pdp;
            const priceData = mergedPrices[symbol]; // Use merged prices instead of latestPrices
            const currentPrice = priceData?.currentPrice ?? null;
            const isTestPrice = priceData?.isTestPrice || false; // Get actual test price status

            const procData = processedData[stockId] ?? {
                lastBuy: undefined, lastSell: undefined, swingBuyCount: 0, // Changed from lastSwingBuy
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
            const lastBuyPrice = procData.lastBuy?.price; // Changed from procData.lastSwingBuy?.price
            if (typeof currentPrice === 'number' && typeof lastBuyPrice === 'number' && typeof pdp === 'number' && lastBuyPrice > 0) { // Used lastBuyPrice
                const diffPercent = (currentPrice / lastBuyPrice - 1) * 100; // Used lastBuyPrice
                if (diffPercent <= (pdp * -1)) {
                    lbdPercent = diffPercent;
                }
            }

            let percentToBe: number | null = null;
            const lowestSwingBuyPrice = procData.lowestSwingBuyPriceWallet?.buyPrice;
            if (typeof currentPrice === 'number' && typeof lowestSwingBuyPrice === 'number' && lowestSwingBuyPrice > 0) {
                percentToBe = (currentPrice / lowestSwingBuyPrice - 1) * 100;
            }

            const lowestSwingTpPrice = procData.lowestSwingTpWallet?.stpValue;
            const lowestSwingTpShares = procData.lowestSwingTpWallet?.remainingShares;
            let percentToTp: number | null = null;
            if (typeof currentPrice === 'number' && typeof lowestSwingTpPrice === 'number' && lowestSwingTpPrice > 0) {
                percentToTp = calculatePercentToStp(currentPrice, lowestSwingTpPrice);
            }

            // Calculate %2HTP: percentage difference between current price and HTP target for Hold wallets
            let percentToHtp: number | null = null;
            if (typeof currentPrice === 'number' && typeof stock.htp === 'number' && stock.htp > 0) {
                // Get Hold wallets for this stock with remaining shares
                const stockHoldWallets = allWallets.filter(wallet => 
                    wallet.portfolioStockId === stockId &&
                    wallet.walletType === 'Hold' &&
                    (wallet.remainingShares ?? 0) > SHARE_EPSILON
                );
                
                // Find the lowest buy price among Hold wallets (similar to %2TP logic)
                if (stockHoldWallets.length > 0) {
                    const lowestHoldWallet = stockHoldWallets.reduce((lowest, current) => {
                        const currentBuyPrice = current.buyPrice ?? 0;
                        const lowestBuyPrice = lowest.buyPrice ?? 0;
                        return currentBuyPrice < lowestBuyPrice ? current : lowest;
                    });
                    
                    if (lowestHoldWallet?.buyPrice) {
                        percentToHtp = calculatePercentToHtp(currentPrice, lowestHoldWallet.buyPrice, stock.htp, stock.stockCommission);
                    }
                }
            }

            const sinceBuyDays = calculateDaysAgo(procData.lastBuy?.date); // Changed from procData.lastSwingBuy?.date
            const sinceSellDays = calculateDaysAgo(procData.lastSell?.date); 
            const swingBuyCountValue = procData.swingBuyCount;
            const totalShares = procData.totalCurrentSwingShares + procData.totalCurrentHoldShares;
            const swingWalletCountValue = procData.activeSwingWallets.length;

            // Calculate HTP signal status and values for Hold wallets
            const hasHtpSignal = checkHtpSignalForStock(stockId, currentPrice);
            const htpValues = getHtpValuesForStock(stockId, currentPrice);

            return {
                id: stockId,
                symbol: symbol,
                stockTrend: stock.stockTrend,
                riskInvestment: stockRiskInvestments[stockId] ?? null,
                budgetAvailable: stockBudgetAvailable[stockId] ?? null,
                budget: stock.budget ?? null,
                currentPrice: currentPrice,
                isTestPrice: isTestPrice,
                fiveDayDip: fiveDayDipPercent,
                lbd: lbdPercent,
                percentToBe: percentToBe,
                ltpiaTakeProfitPrice: lowestSwingTpPrice ?? null,
                percentToTp: percentToTp,
                percentToHtp: percentToHtp,
                tpShares: lowestSwingTpShares ?? null,
                sinceBuy: sinceBuyDays,
                sinceSell: sinceSellDays,
                buys: swingBuyCountValue,
                totalCurrentShares: totalShares,
                incompleteBuyCount: 0,
                swingWalletCount: swingWalletCountValue,
                hasHtpSignal: hasHtpSignal,
                htpValues: htpValues,
            };
        });
    }, [portfolioStocks, mergedPrices, processedData, checkHtpSignalForStock, getHtpValuesForStock, stockBudgetAvailable, stockRiskInvestments]);

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

        // Calculate total risk investment (sum of all rInv values)
        const totalRiskInvestment = Object.values(stockRiskInvestments).reduce((sum: number, rInv: number | null) => sum + (rInv ?? 0), 0);

        // Calculate portfolio-level budget metrics using allWallets
        const totalOOP = allWallets.reduce((sum, wallet) => sum + (wallet.totalInvestment || 0), 0);
        const totalCashBalance = allWallets.reduce((sum, wallet) => sum + (wallet.cashBalance || 0), 0);

        const totalBudgetUsed = Math.max(0, totalOOP - totalCashBalance);
        const totalBudgetAvailable = Math.max(0, totalBudget - totalBudgetUsed);

        return {
            totalBudget: parseFloat(totalBudget.toFixed(CURRENCY_PRECISION)),
            totalInvested: parseFloat(totalTiedUpInvestment.toFixed(CURRENCY_PRECISION)),
            budgetLeft: parseFloat(budgetLeft.toFixed(CURRENCY_PRECISION)),
            totalRiskInvestment: parseFloat(totalRiskInvestment.toFixed(CURRENCY_PRECISION)),
            totalBudgetUsed: parseFloat(totalBudgetUsed.toFixed(CURRENCY_PRECISION)),
            totalBudgetAvailable: parseFloat(totalBudgetAvailable.toFixed(CURRENCY_PRECISION)),
        };
    }, [portfolioStocks, allWallets, stockRiskInvestments]);

    const portfolioTransactionCounts = useMemo(() => {
        const typedTxns = allTransactions.map(t => t as unknown as Schema['Transaction']['type']);
        const buys = typedTxns.filter(t => t.action === 'Buy').length;
        const swingSells = typedTxns.filter(t => t.action === 'Sell' && t.txnType === 'Swing').length;
        const holdSells = typedTxns.filter(t => t.action === 'Sell' && t.txnType === 'Hold').length;
        const totalSells = swingSells + holdSells;
        return { buys, swingSells, holdSells, totalSells };
    }, [allTransactions]);

    const portfolioPerformanceMetrics = useMemo(() => {
        // Calculate total OOP and cash balance from portfolio stocks
        let totalOOP = 0;
        let totalCashBalance = 0;

        portfolioStocks.forEach(stock => {
            // Type assertion to access cash flow fields
            const stockWithCashFlow = stock as unknown as PortfolioStockDataType & {
                totalOutOfPocket?: number;
                currentCashBalance?: number;
            };
            totalOOP += stockWithCashFlow.totalOutOfPocket || 0;
            totalCashBalance += stockWithCashFlow.currentCashBalance || 0;
        });

        // Calculate portfolio ROIC and total market value
        let portfolioROIC: number | null = null;
        let totalMarketValue = 0;
        
        allWallets.forEach(wallet => {
            if ((wallet.remainingShares ?? 0) > SHARE_EPSILON) {
                const stockInfo = portfolioStocks.find(s => s.id === wallet.portfolioStockId);
                const stockSymbol = stockInfo?.symbol;
                const currentPrice = stockSymbol ? (mergedPrices[stockSymbol]?.currentPrice ?? null) : null;
                
                if (typeof currentPrice === 'number') {
                    totalMarketValue += (wallet.remainingShares ?? 0) * currentPrice;
                }
            }
        });
        
        if (totalOOP > 0) {
            const totalPortfolioValue = totalCashBalance + totalMarketValue;
            portfolioROIC = ((totalPortfolioValue - totalOOP) / totalOOP) * 100;
        }

        return {
            totalOOP: parseFloat(totalOOP.toFixed(CURRENCY_PRECISION)),
            totalCashBalance: parseFloat(totalCashBalance.toFixed(CURRENCY_PRECISION)),
            totalMarketValue: parseFloat(totalMarketValue.toFixed(CURRENCY_PRECISION)),
            portfolioROIC: portfolioROIC !== null ? parseFloat(portfolioROIC.toFixed(PERCENT_PRECISION)) : null,
        };
    }, [portfolioStocks, allWallets, mergedPrices]);

    const portfolioRealizedPL = useMemo(() => {
        // Create wallet buy price map for fallback calculations
        const walletBuyPriceMap = new Map<string, number>();
        allWallets.forEach(w => {
            if (w.id && typeof w.buyPrice === 'number') {
                walletBuyPriceMap.set(w.id, w.buyPrice);
            }
        });
    
        // Use the same financial calculation utility as wallets page for Swing P/L
        const calculatedTotalSwingPlDollars = calculateTotalRealizedSwingPL(
            allTransactions as unknown as TransactionForCalculation[],
            allWallets as unknown as WalletForCalculation[]
        );
        
        let totalSwingCostBasis = 0;
        let totalHoldPlDollars = 0, totalHoldCostBasis = 0;
    
        const typedTxnsForPL = allTransactions.map(t => t as unknown as Schema['Transaction']['type']);
        typedTxnsForPL.forEach(txn => {
            if (txn.action === 'Sell' && txn.completedTxnId && typeof txn.quantity === 'number' && typeof txn.price === 'number') {
                const walletBuyPrice = walletBuyPriceMap.get(txn.completedTxnId || '');
                if (typeof walletBuyPrice === 'number') {
                    const costBasisForTxn = walletBuyPrice * (txn.quantity || 0);
                    
                    if (txn.txnType === 'Swing') {
                        // Only accumulate cost basis for Swing - P/L is handled by utility
                        totalSwingCostBasis += costBasisForTxn;
                    } else if (txn.txnType === 'Hold') {
                        // Use stored txnProfit if available (commission-adjusted), otherwise calculate
                        const profitForTxn = txn.txnProfit ?? calculateSingleSalePL(txn.price!, walletBuyPrice, txn.quantity!);
                        totalHoldPlDollars += profitForTxn;
                        totalHoldCostBasis += costBasisForTxn;
                    }
                }
            }
        });

        // Calculate percentages using the same logic as wallets page
        const avgSwingPlPercent = (totalSwingCostBasis !== 0) ? (calculatedTotalSwingPlDollars / totalSwingCostBasis) * 100 : (calculatedTotalSwingPlDollars === 0 ? 0 : null);
        const avgHoldPlPercent = (totalHoldCostBasis !== 0) ? (totalHoldPlDollars / totalHoldCostBasis) * 100 : (totalHoldPlDollars === 0 ? 0 : null);
        const totalStockPlDollars = calculatedTotalSwingPlDollars + totalHoldPlDollars;
        const totalStockCostBasis = totalSwingCostBasis + totalHoldCostBasis;
        const avgStockPlPercent = (totalStockCostBasis !== 0) ? (totalStockPlDollars / totalStockCostBasis) * 100 : (totalStockPlDollars === 0 ? 0 : null);

        // Calculate Div&SLP amounts
        let totalDividendAmount = 0;
        let totalSlpAmount = 0;
        
        typedTxnsForPL.forEach(txn => {
            if (txn.action === 'Div' && typeof txn.amount === 'number') {
                totalDividendAmount += txn.amount;
            } else if (txn.action === 'SLP' && typeof txn.amount === 'number') {
                totalSlpAmount += txn.amount;
            }
        });
        
        const totalIncomeFromDivAndSlp = totalDividendAmount + totalSlpAmount;

        return {
            totalSwingPlDollars: parseFloat(calculatedTotalSwingPlDollars.toFixed(CURRENCY_PRECISION)),
            avgSwingPlPercent: typeof avgSwingPlPercent === 'number' ? parseFloat(avgSwingPlPercent.toFixed(PERCENT_PRECISION)) : null,
            totalHoldPlDollars: parseFloat(totalHoldPlDollars.toFixed(CURRENCY_PRECISION)),
            avgHoldPlPercent: typeof avgHoldPlPercent === 'number' ? parseFloat(avgHoldPlPercent.toFixed(PERCENT_PRECISION)) : null,
            totalStockPlDollars: parseFloat(totalStockPlDollars.toFixed(CURRENCY_PRECISION)),
            avgStockPlPercent: typeof avgStockPlPercent === 'number' ? parseFloat(avgStockPlPercent.toFixed(PERCENT_PRECISION)) : null,
            totalDividendAmount: parseFloat(totalDividendAmount.toFixed(CURRENCY_PRECISION)),
            totalSlpAmount: parseFloat(totalSlpAmount.toFixed(CURRENCY_PRECISION)),
            totalIncomeFromDivAndSlp: parseFloat(totalIncomeFromDivAndSlp.toFixed(CURRENCY_PRECISION)),
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
            // Use merged prices instead of latestPrices to be consistent with wallets page
            const currentPrice = stockSymbol ? (mergedPrices[stockSymbol]?.currentPrice ?? null) : null;

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

    }, [allWallets, portfolioStocks, mergedPrices]);

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
        totalIncomeFromDivAndSlp: portfolioRealizedPL.totalIncomeFromDivAndSlp,
        partialDataUsed: portfolioUnrealizedPL.partialDataUsed,
        };
    }, [portfolioRealizedPL, portfolioUnrealizedPL]);

    const visibleColumnCount = useMemo(() => {
        let count = 1;
        count += (Object.values(reportColumnVisibility) as boolean[]).filter(Boolean).length;
        return count;
    }, [reportColumnVisibility]);
    
    const [sortConfig, setSortConfig] = useState<SortConfig<ReportColumnKey> | null>(null);

    const sortedTableData = useMemo(() => {
        const sortableItems = [...reportData];
    
        // const handleNullAsc = (val: number | null | undefined): number => { // Unused
        //     return (val === null || val === undefined) ? Infinity : val;
        // };
    
        if (sortConfig !== null) {
            const handleNullCurrent = (val: unknown) => {
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
        
        // Check for zero swing wallets (always red)
        if (swingWalletCount === 0) {
            return { color: '#ff0000' };
        }
        
        // Color based purely on days since last buy
        if (days > 30) {
            // Return red for more than 30 days
            return { color: '#ff0000' };
        } else if (days > 20) {
            // Return orange for 20-30 days
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
            <h2>Signals</h2>
            <div style={{ fontSize: '0.7em', color: "gray" }}>
                {pricesLoading
                ? progressMessage || 'Prices are refreshing...' // Display progressMessage if available
                : lastPriceFetchTimestamp
                    ? `Prices as of ${formatTimestamp(lastPriceFetchTimestamp)}`
                    : 'Prices not fetched yet.'
                }
            </div>
            {pricesError && <p style={{ color: 'red' }}>Price Error: {pricesError}</p>}

            {/* Signals Overview Component */}
            <SignalsOverview
                isExpanded={isOverviewExpanded}
                toggleExpand={() => setIsOverviewExpanded(prev => !prev)}
                portfolioBudgetStats={portfolioBudgetStats}
                portfolioTransactionCounts={portfolioTransactionCounts}
                portfolioPerformanceMetrics={portfolioPerformanceMetrics}
                portfolioRealizedPL={portfolioRealizedPL}
                portfolioUnrealizedPL={portfolioUnrealizedPL}
                portfolioTotalPL={portfolioTotalPL}
                formatters={formatters}
                precision={precision}
            />
            
            {/* Signals Table Component (includes column visibility controls) */}
            <SignalsTable
                isLoading={isLoading}
                reportColumnVisibility={reportColumnVisibility}
                setReportColumnVisibility={setReportColumnVisibility}
                columnLabels={COLUMN_LABELS}
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

// type Nullable<T> = T | null | undefined; // Unused type