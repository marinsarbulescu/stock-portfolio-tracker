// app/(authed)/wallets/[stockId]/page.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
// Import useParams to get ID from URL
import { useParams } from 'next/navigation';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource'; // Adjust path if needed
import TransactionForm from './components/WalletsAddEditTransactionModal';
import { FaEdit, FaTrashAlt, FaDollarSign } from 'react-icons/fa';
import { usePrices } from '@/app/contexts/PriceContext';
import { useOwnerId } from '@/app/hooks/useOwnerId';
//import { formatToMDYYYY } from '@/app/utils/dateFormatter';
import WalletsHeader from './components/WalletsHeader';
import WalletsOverview from './components/WalletsOverview';
import WalletsTabs from './components/WalletsTabs';
import WalletsTransactionsTable from './components/WalletsTransactionsTable';
import EditStockModal from '../../portfolio/components/PortfolioEditStockModal';
import type { TransactionTableColumnVisibilityState, SortableTxnKey, SortConfig } from './types';

// --- IMPORT THE CORRECT formatCurrency ---
import { calculateSingleSalePL, calculateSingleSalePLWithCommission, calculateTotalRealizedSwingPL, calculateSingleSalePLWithSplits, formatCurrency } from '@/app/utils/financialCalculations';
import { applySplitAdjustments, extractStockSplits, applySplitAdjustmentsToWallet } from '@/app/utils/splitUtils';
import { mergeTestPricesWithRealPrices } from '@/app/utils/priceUtils';

// Needed for the handleUpdateTransaction to update the wallet
import { adjustWalletContribution } from '@/app/services/walletService';

import {
    SHARE_PRECISION,
    CURRENCY_PRECISION,
    PERCENT_PRECISION,
    SHARE_EPSILON,
    CURRENCY_EPSILON,
    FETCH_LIMIT_FOR_UNIQUE_WALLET,
    FETCH_LIMIT_TRANSACTIONS_STANDARD,
    FETCH_LIMIT_SMALL_QUERIES,
    FETCH_LIMIT_WALLETS_CANDIDATES
} from '@/app/config/constants';
import WalletsSellTransactionModal from './components/WalletsSellTransactionModal';

type StockWalletDataType = Schema['StockWallet']['type'];
type PortfolioStockDataType = Schema["PortfolioStock"]["type"];
type PortfolioStockUpdateInput = Partial<PortfolioStockDataType> & { id: string };

interface StockInfoForWalletService {
    owner: string; // Cognito User Sub ID
    plr?: number | null;
    pdp?: number | null; // Add PDP for base TP calculation
    stockCommission?: number | null; // Add commission for TP adjustment
}


type TransactionDataType = Schema['Transaction']['type']; // Already likely defined
type TransactionListResultType = Awaited<ReturnType<typeof client.models.Transaction.list>>;

const client = generateClient<Schema>();

const getTodayDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export default function StockWalletPage() {
    const params = useParams();
    const stockId = params.stockId as string; // Get stockId from dynamic route

    // --- START: Transactions Table Visibility & Sorting ---
    const [txnColumnVisibility, setTxnColumnVisibility] = useState<TransactionTableColumnVisibilityState>({
     date: false,
     action: true,
     txnType: true,
     signal: true,
     price: true,
     lbd: true,
     investment: true,
     amount: false,
     quantity: false,
     proceeds: true,
     txnProfit: false,
     txnProfitPercent: false,
     completedTxnId: false,
 });

    const [txnSortConfig, setTxnSortConfig] = useState<{ key: SortableTxnKey; direction: 'ascending' | 'descending' } | null>(null);
    
    // Mapping from visibility state keys to display labels
    const TXN_COLUMN_LABELS: Record<keyof TransactionTableColumnVisibilityState, string> = {
        date:'Date',
        action: 'Action',
        txnType: 'Type',
        signal: 'Signal',
        price: 'Price',
        lbd: 'LBD',
        investment: 'Inv',
        amount: 'Amount',
        quantity: 'Qty',
        proceeds: 'Sell $',
        txnProfit: 'P/L',
        txnProfitPercent: 'P/L (%)',
        completedTxnId: 'Wallet ID',
    };
    
    const requestTxnSort = (key: SortableTxnKey) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (txnSortConfig && txnSortConfig.key === key && txnSortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setTxnSortConfig({ key, direction });
    };
    // --- END: Transactions Table Visibility & Sorting ---



    // --- START: Wallet Table Visibility & Sorting ---
    interface WalletColumnVisibilityState {
        id: boolean;
        buyPrice: boolean;
        totalInvestment: boolean;
        //totalSharesQty: boolean;
        tpValue: boolean;
        htp: boolean;
        sellTxnCount: boolean;
        sharesSold: boolean;
        realizedPl: boolean;
        realizedPlPercent: boolean;
        remainingShares: boolean;
    }

    type SortableWalletKey =
        | 'id'
        | 'buyPrice'
        | 'totalInvestment'
        //| 'totalSharesQty'
        | 'tpValue'
        | 'htp'
        | 'sellTxnCount'
        | 'sharesSold'
        | 'realizedPl'
        | 'realizedPlPercent'
        | 'remainingShares';

    const [walletColumnVisibility, setWalletColumnVisibility] = useState<WalletColumnVisibilityState>({
        id: true,
        buyPrice: true,
        totalInvestment: true,
        //totalSharesQty: true,
        tpValue: true,
        htp: false,
        sellTxnCount: true,
        sharesSold: false,
        realizedPl: false,
        realizedPlPercent: false,
        remainingShares: true,
    });

    const WALLET_COLUMN_LABELS: Record<keyof WalletColumnVisibilityState, string> = {
        id: 'Id',
        buyPrice: 'Buy Price',
        totalInvestment: 'Inv',
        //totalSharesQty: 'Shares',
        tpValue: 'TP',
        htp: 'HTP',
        sellTxnCount: 'Sells',
        sharesSold: 'Shs Sold',
        realizedPl: 'P/L',
        realizedPlPercent: 'P/L (%)',
        remainingShares: 'Shs Left',
    };

    // State for Wallet table sorting (use a distinct name)
    const [walletSortConfig, setWalletSortConfig] = useState<{ key: SortableWalletKey; direction: 'ascending' | 'descending' } | null>(null);

    // Sort request handler for Wallet table (use a distinct name)
    const requestWalletSort = (key: SortableWalletKey) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (walletSortConfig && walletSortConfig.key === key && walletSortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setWalletSortConfig({ key, direction });
    };
    // --- END: State for Wallet Table Visibility & Sorting ---

    
    
    // --- State for Stock Symbol (for Title) ---
    const [stockSymbol, setStockSymbol] = useState<string | undefined>(undefined);
    const [name, setStockName] = useState<string | undefined>(undefined);
    
    // --- ADD: State for current stock data to get test price ---
    const [currentStockData, setCurrentStockData] = useState<PortfolioStockDataType | null>(null);

    const [stockBudget, setStockBudget] = useState<number | null | undefined>(undefined); // undefined: not loaded, null: no budget set, number: budget value

    const [activeTab, setActiveTab] = useState<'Swing' | 'Hold'>('Swing');
    const [showEmptyWallets, setShowEmptyWallets] = useState<boolean>(false);

    // State for fetched wallet data for THIS stock
    const [wallets, setWallets] = useState<StockWalletDataType[]>([]);
    // State for loading and error status
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const { ownerId } = useOwnerId();

    useEffect(() => {
            if (!isLoading && ownerId) {
                console.log("[StockWalletPage] - Fetched Owner ID:", ownerId);
                // Now you can use this ownerId for API calls, filtering, etc.
                // For example, pass it to stockInfoForService
            } else if (!isLoading && !ownerId && !error) {
                console.warn("[StockWalletPage] - Owner ID could not be determined (user might not be logged in).");
            }
    }, [ownerId, isLoading, error]);

    const { latestPrices, pricesLoading, pricesError, lastPriceFetchTimestamp } = usePrices(); // <<< Ensure lastPriceFetchTimestamp is included

    // --- ADD STATE for Transaction List ---
    const [transactions, setTransactions] = useState<TransactionDataType[]>([]);
    const [isTxnLoading, setIsTxnLoading] = useState(true);
    const [txnError, setTxnError] = useState<string | null>(null);
    // State for Edit Modal
    const [isEditModalOpen, setIsEditModalOpen] = useState(false); // Separate modal for editing
    const [txnToEdit, setTxnToEdit] = useState<TransactionDataType | null>(null);
    // --- END ADD STATE ---

    const sortedTransactions = useMemo(() => {
        // Add calculated 'proceeds' if sorting by it is needed
        const itemsWithProceeds = transactions.map(txn => ({
            ...txn,
            // Calculate proceeds only for sell transactions, default to null otherwise
            proceeds: (txn.action === 'Sell' && typeof txn.price === 'number' && typeof txn.quantity === 'number')
                ? txn.price * txn.quantity
                : null
        }));
    
        const sortableItems = [...itemsWithProceeds]; // Use the array with proceeds
    
        if (txnSortConfig !== null) {
            sortableItems.sort((a, b) => {
                 // Helper to handle nulls based on the CURRENT sort direction
                 // Places nulls/undefined last consistently
                const handleNulls = (val: unknown) => {
                    if (val === null || val === undefined) {
                        return txnSortConfig.direction === 'ascending' ? Infinity : -Infinity;
                    }
                    return val;
                };
    
                // Use the correct key type which now includes proceeds, txnProfit, etc.
                const key = txnSortConfig.key as keyof (typeof sortableItems[0]);
    
                // Get values using the key, handle potential undefined items if array is empty initially
                const valA = a ? a[key] : undefined;
                const valB = b ? b[key] : undefined;
    
                const resolvedA = handleNulls(valA);
                const resolvedB = handleNulls(valB);
    
                let comparison = 0;
    
                 // Comparison logic (handle strings vs numbers)
                 if (typeof resolvedA === 'string' && typeof resolvedB === 'string') {
                    comparison = resolvedA.localeCompare(resolvedB);
                 } else if (typeof resolvedA === 'number' && typeof resolvedB === 'number') {
                     comparison = resolvedA - resolvedB; // Simpler numeric comparison
                 } else {
                     // Fallback for mixed types or other types (less likely with specific keys)
                     if (resolvedA < resolvedB) comparison = -1;
                     else if (resolvedA > resolvedB) comparison = 1;
                 }
    
    
                return txnSortConfig.direction === 'ascending' ? comparison : comparison * -1;
            });
        } else {
            // Default sort: Date descending
            sortableItems.sort((a, b) => (a.date && b.date) ? b.date.localeCompare(a.date) : 0);
        }
        return sortableItems;
    }, [transactions, txnSortConfig]); // Dependency only on transactions and sort config

    // --- ADD NEW STATE for Sell Modal ---
    const [isSellModalOpen, setIsSellModalOpen] = useState(false);
    const [walletToSell, setWalletToSell] = useState<StockWalletDataType | null>(null);
    // --- ADD STATE for Sell Form ---
    const [sellDate, setSellDate] = useState(getTodayDateString()); // Default to today
    const [sellQuantity, setSellQuantity] = useState('');
    const [sellPrice, setSellPrice] = useState('');
    const [sellSignal, setSellSignal] = useState<Schema['Transaction']['type']['signal'] | undefined>('Cust');
    const [sellError, setSellError] = useState<string | null>(null); // For errors within the modal
    const [isSelling, setIsSelling] = useState(false); // Loading state for submission
    // --- END NEW STATE ---

    const [stockPdp, setStockPdp] = useState<number | null | undefined>(undefined);
    const [stockShr, setStockShr] = useState<number | null | undefined>(undefined); // Swing-Hold Ratio
    const [stockPlr, setStockPlr] = useState<number | null | undefined>(undefined);
    const [stockCommission, setStockCommission] = useState<number | null | undefined>(undefined);
    const [stockHtp, setStockHtp] = useState<number | null | undefined>(undefined); // HTP percentage

    const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);

    const [isOverviewExpanded, setIsOverviewExpanded] = useState(false); // Collapsed by default

    // --- Edit Stock Modal State ---
    const [isEditStockModalOpen, setIsEditStockModalOpen] = useState(false);
    const [stockToEditData, setStockToEditData] = useState<PortfolioStockDataType | null>(null);

    // --- Function to fetch wallets FOR THIS STOCK ---
    const fetchWallets = useCallback(async () => {
            // Only fetch if stockId is available
            if (!stockId) {
                //console.log("[fetchWallets] Stock ID missing, skipping fetch.");
                setWallets([]); // Clear wallets if no ID
                setIsLoading(false);
                return;
            }
    
            setIsLoading(true);
            setError(null);
            //console.log(`[StockWalletPage] - [fetchWallets] Running fetch for stockId: ${stockId}`);
            try {
                const selectionSetNeeded = [
                    'id',
                    'buyPrice',
                    'totalInvestment',
                    'totalSharesQty',
                    'tpPercent',
                    'tpValue',
                    'sharesSold',
                    'realizedPl',
                    'realizedPlPercent',
                    'remainingShares',
                    'portfolioStockId',
                    'sellTxnCount',
                    'walletType',
                    // No longer need portfolioStock.symbol here
                ] as const;
    
                //console.log(`[StockWalletPage] - [fetchWallets] Calling list with filter:`, { portfolioStockId: { eq: stockId } });
                
                // --- ADDED FILTER ---
                const result = await client.models.StockWallet.list({
                    filter: { portfolioStockId: { eq: stockId } }, // Filter by stockId
                    selectionSet: selectionSetNeeded,
                    limit: FETCH_LIMIT_TRANSACTIONS_STANDARD
                });

                //console.log(`[StockWalletPage] - [fetchWallets] Raw API result after edit/add:`, JSON.stringify(result, null, 2));
    
                if (result.errors) throw result.errors;
    
                const fetchedData = result.data || []; // Default to empty array if data is null/undefined
                //console.log(`[StockWalletPage] - [fetchWallets] Fetched ${fetchedData.length} wallets. Calling setWallets.`);
                
                // +++ ADD SORTING LOGIC HERE +++
                fetchedData.sort((a, b) => {
                        // Handle null/undefined tpValue - place them at the end
                        const tpA = a.tpValue ?? Infinity;
                        const tpB = b.tpValue ?? Infinity;
                        return tpA - tpB; // Ascending sort (lowest TP first)
                });
                // +++ END SORTING LOGIC +++

                setWallets(fetchedData as StockWalletDataType[]);
    
            } catch (err: unknown) {
                //console.error("[fetchWallets] Error fetching stock wallets:", err);
                const errorObj = err as {errors?: Array<{message: string}>};
                const message = Array.isArray(errorObj.errors) ? errorObj.errors[0].message : (err as Error).message;
                setError(message || "Failed to fetch wallet data.");
                setWallets([]);
            } finally {
                setIsLoading(false);
            }
    }, [stockId]); // <<< ADD stockId dependency

    // --- ADD Function to Fetch Current Stock Data (including test price) ---
    const fetchCurrentStock = useCallback(async () => {
        if (!stockId) return;
        
        try {
            const { data: stockData, errors } = await client.models.PortfolioStock.get({
                id: stockId
            });

            if (errors) {
                console.error('Error fetching stock data:', errors);
                return;
            }

            if (stockData) {
                setCurrentStockData(stockData as PortfolioStockDataType);
                setStockSymbol(stockData.symbol || 'Unknown');
                setStockName(stockData.name || 'Unknown');
                setStockBudget(stockData.budget);
                setStockPdp(stockData.pdp);
                setStockPlr(stockData.plr);
                setStockShr(stockData.swingHoldRatio);
                setStockCommission(stockData.stockCommission);
                setStockHtp(stockData.htp);
            }
        } catch (err: unknown) {
            console.error('Error fetching current stock:', err);
        }
    }, [stockId]);

    // --- ADD Function to Fetch Transactions ---
    const fetchTransactions = useCallback(async () => {
        if (!stockId) return;
        //console.log(`[StockWalletPage] - Workspaceing ALL transactions for stockId: [${stockId}] for Wallet Page`);
        setIsTxnLoading(true);
        setTxnError(null);
        setTransactions([]); // Clear previous

        // Fields needed for the simplified table and editing
        const selectionSetNeeded = [
            'id', 'date', 'action', 'signal', 'price',
            'investment',
            'amount',         // ADDED - needed for Dividend and SLP transactions
            'quantity',       // Total quantity
            'lbd',
            'completedTxnId', // Links Sell back to StockWallet ID
            // --- UPDATE THESE ---
            // 'sharesType',      // REMOVED
            'txnType',        // ADDED
            // 'playShares',      // REMOVED
            'swingShares',    // ADDED (Renamed)
            'holdShares',     // Keep
            // --- END UPDATE ---
            'splitRatio',     // ADDED - needed for StockSplit transactions
            'tp', 'txnProfit', 'txnProfitPercent', // Keep for potential edit logic display
        ] as const;


        let accumulatedTxns: TransactionDataType[] = [];
        let currentToken: string | null = null;
        let loopSafetyCounter = 0;
        const maxLoops = 20;

        try {
            do {
                loopSafetyCounter++;
                if (loopSafetyCounter > maxLoops) throw new Error(`Exceeded ${maxLoops} pagination requests.`);

                const listResult: TransactionListResultType = await client.models.Transaction.list({
                    filter: { portfolioStockId: { eq: stockId } },
                    nextToken: currentToken,
                    limit: FETCH_LIMIT_SMALL_QUERIES, // Adjust limit as needed
                    selectionSet: selectionSetNeeded, // Fetch required fields
                });

                const fetchedTxns = listResult.data;
                const errors = listResult.errors;
                const returnedToken = listResult.nextToken ?? null;

                if (errors) throw errors;
                if (fetchedTxns) {
                    accumulatedTxns = [...accumulatedTxns, ...(fetchedTxns as TransactionDataType[])];
                }
                currentToken = returnedToken;

            } while (currentToken !== null);

            //console.log(`[StockWalletPage] - Finished fetching transactions for Wallet Page. Total: ${accumulatedTxns.length}`);
            console.log('[DEBUG StockSplit] Fetched transactions:', accumulatedTxns.map(t => ({ id: t.id, action: t.action, splitRatio: t.splitRatio })).filter(t => t.action === 'StockSplit'));
            setTransactions(accumulatedTxns);

        } catch (err: unknown) {
            console.error('[StockWalletPage] - Error fetching all transactions:', err);
            const errorObj = err as {errors?: Array<{message: string}>};
            const errMsg = Array.isArray(errorObj.errors) ? errorObj.errors[0].message : ((err as Error).message || 'Failed to load transactions.');
            setTxnError(errMsg);
            setTransactions([]);
        } finally {
            setIsTxnLoading(false);
        }
    }, [stockId]);
    // --- END Fetch Transactions ---

    // --- Add useEffect to Fetch Transactions ---
    useEffect(() => {
        if (stockId) {
            fetchTransactions(); // Fetch transactions when stockId is available
        }
    }, [stockId, fetchTransactions, fetchWallets]); // Add fetchTransactions dependency
    // --- END useEffect ---

        
    // --- ADD Edit/Delete Handlers ---
    const handleEditTxnClick = (transaction: TransactionDataType) => {
        //console.log('[StockWalletPage] - Opening Edit modal for transaction:', transaction);
        console.log('[DEBUG StockSplit] Edit button clicked for transaction:', { id: transaction.id, action: transaction.action, splitRatio: transaction.splitRatio });
        setTxnToEdit(transaction);
        setIsEditModalOpen(true); // Open the EDIT modal
    };

    const handleCancelEditTxn = () => {
        setIsEditModalOpen(false);
        setTxnToEdit(null);
        // Clear any errors specific to the edit form if needed
    };

    // This is called by TransactionForm's onUpdate prop.
    // It also calls the wallet update logic if txn price or invesmtent changes.
    const handleUpdateTransaction = async (updatedTxnDataFromForm: TransactionDataType & { id: string }) => {        
        if (!txnToEdit) {
            alert("Original transaction data not available. Cannot process update.");
            console.error("[StockWalletPage] - txnToEdit is null in handleUpdateTransaction");
            return;
        }

        if (!ownerId) {
            alert("[StockWalletPage] - Owner ID not yet available. Please try again shortly.");
            return;
        }        const stockInfoForService: StockInfoForWalletService = { // Ensure this type matches what walletService expects
            owner: ownerId, // Use the concatenated string
            plr: stockPlr,
            pdp: stockPdp,
            stockCommission: stockCommission,
        };
        
        // console.log('[StockWalletPage] - Attempting to update transaction via Edit modal:', updatedTxnDataFromForm);
        // console.log('[StockWalletPage] - Original transaction data:', txnToEdit);
        
        const isBuyTransaction = txnToEdit.action === 'Buy';
        let proceedWithTransactionRecordUpdate = true; // Flag to control if the Transaction model update should proceed

        try {
            if (isBuyTransaction) {
                // console.log("[StockWalletPage] - Processing update for a BUY transaction.");

                const originalPrice = txnToEdit.price;
                const updatedPrice = updatedTxnDataFromForm.price;

                // Ensure prices are numbers before comparison
                if (typeof originalPrice !== 'number' || typeof updatedPrice !== 'number') {
                    throw new Error("Original or updated price is invalid.");
                }
                
                const priceChanged = Math.abs(originalPrice - updatedPrice) > CURRENCY_EPSILON;

                if (priceChanged) {
                    const localOriginalPrice = txnToEdit.price; // Capture it at the start of this block
                    // console.log(`[StockWalletPage] Starting price change. Original Txn Price: ${localOriginalPrice}, Stock ID: ${stockId}, Owner for query: ${stockInfoForService.owner}`);

                    if (typeof localOriginalPrice !== 'number' || isNaN(localOriginalPrice)) {
                        // console.error("[StockWalletPage] CRITICAL ERROR: localOriginalPrice is invalid!", localOriginalPrice);
                        alert("Critical error: Original price is invalid for update.");
                        return;
                    }

                    // --- Constraint: Check if original wallet(s) have sales ---
                    // This logic requires fetching wallets at the originalPrice first
                    let originalWalletsHaveSales = false;
                    
                    // console.log(`[StockWalletPage] PRE-FETCHING originalSwingWallet with filter: 
                    //     buyPrice=${localOriginalPrice}, 
                    //     type=Swing, 
                    //     portfolioStockId=${stockId},
                    //     owner=${stockInfoForService.owner}`);
                    
                    const originalSwingWalletData = await client.models.StockWallet.list({
                        filter: {
                            portfolioStockId: { eq: stockId },
                            buyPrice: { eq: localOriginalPrice },
                            walletType: { eq: 'Swing' },
                            owner: { eq: stockInfoForService.owner }
                        },
                        limit: FETCH_LIMIT_FOR_UNIQUE_WALLET
                    });
                    const originalSwingWallet = originalSwingWalletData.data[0];

                    // console.log("[StockWalletPage] FETCHED originalSwingWallet:", JSON.stringify(originalSwingWallet || null));
                    
                    if (originalSwingWallet && originalSwingWallet.buyPrice !== localOriginalPrice) {
                        console.warn(`[StockWalletPage] MISMATCH WARNING (Swing): Expected originalPrice ${localOriginalPrice} but fetched wallet has buyPrice ${originalSwingWallet.buyPrice}`, originalSwingWallet);
                    }

                    // --- Pre-fetching originalHoldWallet ---
                    // console.log(`[StockWalletPage] PRE-FETCHING originalHoldWallet with filter: 
                    //     buyPrice=${localOriginalPrice}, 
                    //     type=Hold, 
                    //     portfolioStockId=${stockId},
                    //     owner=${stockInfoForService.owner}`);
                    
                        const originalHoldWalletData = await client.models.StockWallet.list({
                        filter: {
                            portfolioStockId: { eq: stockId },
                            buyPrice: { eq: localOriginalPrice },
                            walletType: { eq: 'Hold' },
                            owner: { eq: stockInfoForService.owner }
                        },
                        limit: FETCH_LIMIT_FOR_UNIQUE_WALLET
                    });
                    const originalHoldWallet = originalHoldWalletData.data[0];
                    // console.log("[StockWalletPage] FETCHED originalHoldWallet:", JSON.stringify(originalHoldWallet || null));
                    
                    if (originalHoldWallet && originalHoldWallet.buyPrice !== localOriginalPrice) {
                        // console.warn(`[StockWalletPage] MISMATCH WARNING (Hold): Expected originalPrice ${localOriginalPrice} but fetched wallet has buyPrice ${originalHoldWallet.buyPrice}`, originalHoldWallet);
                    }

                    // Store the IDs of what was actually fetched to compare with what gets passed to adjustWalletContribution
                    const fetchedSwingId = originalSwingWallet?.id;
                    const fetchedHoldId = originalHoldWallet?.id;

                    if (originalSwingWallet && ((originalSwingWallet.sharesSold ?? 0) > SHARE_EPSILON || (originalSwingWallet.sellTxnCount ?? 0) > 0)) {
                        originalWalletsHaveSales = true;
                    }
                    if (originalHoldWallet && ((originalHoldWallet.sharesSold ?? 0) > SHARE_EPSILON || (originalHoldWallet.sellTxnCount ?? 0) > 0)) {
                        originalWalletsHaveSales = true;
                    }

                    if (originalWalletsHaveSales) {
                        alert("Cannot change the Buy Price because shares have already been sold from the original wallet(s) at that price. This would invalidate historical P/L. Please delete this Buy transaction and associated Sells, then create a new Buy if needed.");
                        proceedWithTransactionRecordUpdate = false; // Do not update the transaction record
                        // Optionally, you might want to prevent closing the modal here
                        setIsEditModalOpen(true); // Keep modal open for user to correct
                        return; // Stop further processing
                    }
                    // --- End Sales Constraint Check ---

                    // Original transaction's contribution (ensure these fields exist on txnToEdit)
                    const originalTotalInvestment = txnToEdit.investment ?? 0;
                    const originalSwingShares = txnToEdit.swingShares ?? 0;
                    const originalHoldShares = txnToEdit.holdShares ?? 0;
                    const originalTotalShares = originalSwingShares + originalHoldShares;

                    // Updated transaction's contribution (ensure these fields exist on updatedTxnDataFromForm)
                    const updatedTotalInvestment = updatedTxnDataFromForm.investment ?? 0;
                    const updatedSwingShares = updatedTxnDataFromForm.swingShares ?? 0;
                    const updatedHoldShares = updatedTxnDataFromForm.holdShares ?? 0;
                    const updatedTotalShares = updatedSwingShares + updatedHoldShares;

                    // Calculate proportional investment for original and updated contributions
                    // Handle division by zero if originalTotalShares or updatedTotalShares is 0
                    const originalInvSwing = originalTotalShares > SHARE_EPSILON ? originalTotalInvestment * (originalSwingShares / originalTotalShares) : 0;
                    const originalInvHold = originalTotalShares > SHARE_EPSILON ? originalTotalInvestment * (originalHoldShares / originalTotalShares) : 0;

                    const updatedInvSwing = updatedTotalShares > SHARE_EPSILON ? updatedTotalInvestment * (updatedSwingShares / updatedTotalShares) : 0;
                    const updatedInvHold = updatedTotalShares > SHARE_EPSILON ? updatedTotalInvestment * (updatedHoldShares / updatedTotalShares) : 0;

                    // Step A: Subtract original contribution from wallets at originalPrice
                    // console.log(`[StockWalletPage] - Subtracting from old price (${originalPrice}) wallets: SwingShares=${-originalSwingShares}, HoldShares=${-originalHoldShares}`);
                    if (originalSwingShares > SHARE_EPSILON) {
                        // console.log(`[StockWalletPage] Calling adjustWalletContribution (SUBTRACT) for SWING. Original Price: ${localOriginalPrice}. PreFetchedWallet ID: ${fetchedSwingId}`);
                        await adjustWalletContribution(client, stockId, originalPrice, 'Swing', -originalSwingShares, -originalInvSwing, stockInfoForService, originalSwingWallet);
                    }
                    if (originalHoldShares > SHARE_EPSILON) {
                        // console.log(`[StockWalletPage] Calling adjustWalletContribution (SUBTRACT) for HOLD. Original Price: ${localOriginalPrice}. PreFetchedWallet ID: ${fetchedHoldId}`);
                        await adjustWalletContribution(client, stockId, originalPrice, 'Hold', -originalHoldShares, -originalInvHold, stockInfoForService, originalHoldWallet);
                    }

                    // Step B: Add new (updated) contribution to wallets at updatedPrice
                    // For this step, we don't pass preFetchedWallet because it might be a new wallet or different existing one
                    // console.log(`[StockWalletPage] - Adding to new price (${updatedPrice}) wallets: SwingShares=${updatedSwingShares}, HoldShares=${updatedHoldShares}`);
                    if (updatedSwingShares > SHARE_EPSILON) {
                        await adjustWalletContribution(client, stockId, updatedPrice, 'Swing', updatedSwingShares, updatedInvSwing, stockInfoForService, null);
                    }
                    if (updatedHoldShares > SHARE_EPSILON) {
                        await adjustWalletContribution(client, stockId, updatedPrice, 'Hold', updatedHoldShares, updatedInvHold, stockInfoForService, null);
                    }

                    // console.log("[StockWalletPage] - Wallet contributions reallocated due to price change.");
                } else {
                    // Price did NOT change.
                    // We will handle Investment/Quantity changes in the next step.
                    // For now, if only date/signal changed, only the transaction record needs updating.
                    // console.log("[StockWalletPage] - Buy Price did not change. Wallet reallocation for price not needed.");
                }
            }

            // --- Update the Transaction Record itself (if allowed) ---
            if (proceedWithTransactionRecordUpdate) {
                // console.log("[StockWalletPage] - Updating transaction record in database:", updatedTxnDataFromForm);
                const { data: updatedTxn, errors } = await client.models.Transaction.update(updatedTxnDataFromForm as Parameters<typeof client.models.Transaction.update>[0]); // Use type assertion carefully

                if (errors) throw errors;
                // console.log('[StockWalletPage] - Transaction record updated successfully:', updatedTxn);
            } else {
                // console.log("[StockWalletPage] - Transaction record update skipped due to prior validation failure (e.g., price change on wallet with sales).");
            }

            // Close modal and refresh data
            setIsEditModalOpen(false);
            setTxnToEdit(null);
            fetchTransactions();
            fetchWallets();
        
        } catch (err: unknown) {
            // console.error('[StockWalletPage] - Error in handleUpdateTransaction:', err);
            const errorObj = err as {errors?: Array<{message: string}>};
            const errorMessage = Array.isArray(errorObj.errors) ? errorObj.errors[0].message : ((err as Error).message || "Failed to update transaction and/or wallets.");
            alert(`Update Failed: ${errorMessage}`);
            // Potentially keep modal open on error:
            setIsEditModalOpen(true);
        } finally {
            // Add any loading state resets here
        }
    };

// Inside StockWalletPage component

const handleDeleteWallet = useCallback(async (walletToDelete: StockWalletDataType) => {
    if (!walletToDelete) return;

    const walletId = walletToDelete.id;
    const walletType = walletToDelete.walletType;
    const buyPrice = walletToDelete.buyPrice;
    const remainingShares = walletToDelete.remainingShares ?? 0;
    const sellTxnCount = walletToDelete.sellTxnCount ?? 0;
    const epsilon = 0.000001; // Threshold for zero shares

    // Double-check if shares are actually zero
    if (remainingShares > epsilon) {
        alert("Cannot delete wallet: Shares still remain.");
        return;
    }

    // Construct confirmation message
    let confirmMsg = `Are you sure you want to delete this empty ${walletType} wallet (Buy Price: ${formatCurrency(buyPrice)})?`;
    if (sellTxnCount > 0) {
        confirmMsg += `\n\nWARNING: This wallet has ${sellTxnCount} sell transaction(s) linked to it. Deleting the wallet might make historical P/L tracking for those sales difficult.`;
    }

    if (!window.confirm(confirmMsg)) {
        return;
    }

    //console.log(`Attempting to delete empty wallet: ${walletId}`);
    setIsLoading(true); // Use main loading state or add specific delete loading state
    // Clear previous feedback using setFeedback from response #236 if you added it
    // setFeedback(null);

    try {
        const { errors } = await client.models.StockWallet.delete({ id: walletId });

        if (errors) throw errors;

        //console.log(`Wallet ${walletId} deleted successfully.`);
        // Set success feedback using setFeedback if implemented
        // setFeedback({ type: 'success', message: `${walletType} wallet (Buy: ${formatCurrency(buyPrice)}) deleted.` });

        // Refresh the wallets list
        fetchWallets();

    } catch (err: unknown) {
        console.error(`Error deleting wallet ${walletId}:`, err);
        const errorObj = err as {errors?: Array<{message: string}>};
        const errorMessage = Array.isArray(errorObj.errors) ? errorObj.errors[0].message : ((err as Error).message || 'Failed to delete wallet.');
        // Set error feedback using setFeedback if implemented
         setError(`Delete Failed: ${errorMessage}`); // Use main error state for now
        // setFeedback({ type: 'error', message: `Delete Failed: ${errorMessage}` });
    } finally {
        setIsLoading(false);
    }
}, [fetchWallets]); // Remove unnecessary stockId dependency
// Note: If using setFeedback, add it to dependencies

const handleDeleteTransaction = async (txnToDelete: TransactionDataType) => {
    // Use the passed transaction object
    const idToDelete = txnToDelete.id;
    const walletIdToUpdate = txnToDelete.completedTxnId; // Wallet ID is stored here for wallet-linked sells
    const isWalletSell = txnToDelete.action === 'Sell' && !!walletIdToUpdate;

    // Confirm deletion
    const confirmationMessage = isWalletSell
        ? 'Are you sure you want to delete this Sell transaction? This will also reverse its impact on the linked Stock Wallet (P/L, shares sold, sell count).'
        : 'Are you sure you want to delete this transaction?';

    if (!window.confirm(confirmationMessage)) {
        return;
    }

    //console.log(`[StockWalletPage] - Attempting to delete transaction: ${idToDelete}. Wallet linked: ${isWalletSell}`);
    setTxnError(null); // Clear previous table errors
    // Add a loading state specific to this row/operation if desired

    let walletUpdateError: string | null = null;
    let walletUpdateSuccess = false;

    try {
        let overallSuccess = true; // <<< ADD THIS LINE to track wallet update success
        let finalMessage = ""; // <<< ADD THIS LINE to accumulate warnings/messages
        
        // --- Step 1: Update Wallet Conditionally (BEFORE deleting transaction) ---
        if (isWalletSell) {
            //console.log(`[StockWalletPage] - Updating wallet ${walletIdToUpdate} due to deleted sell txn ${idToDelete}`);
            const quantitySold = txnToDelete.quantity;
            const sellPrice = txnToDelete.price;

            // Ensure we have the necessary info from the deleted transaction
            if (typeof quantitySold !== 'number' || quantitySold <= 0 || typeof sellPrice !== 'number') {
                 throw new Error(`Cannot update wallet: Invalid quantity (${quantitySold}) or price (${sellPrice}) on transaction being deleted.`);
            }

            try {
                // Fetch the wallet to get current values and buyPrice
                const { data: wallet, errors: fetchErrors } = await client.models.StockWallet.get(
                    { id: walletIdToUpdate },
                    { selectionSet: ['buyPrice', 'sharesSold', 'remainingShares', 'realizedPl', 'sellTxnCount'] } // Fetch needed fields
                );

                if (fetchErrors) throw fetchErrors; // Propagate fetch errors

                if (!wallet) {
                    throw new Error(`Could not find associated Stock Wallet (ID: ${walletIdToUpdate}) to update.`);
                }
                if (typeof wallet.buyPrice !== 'number') {
                     throw new Error(`Cannot reverse P/L: Wallet (ID: ${walletIdToUpdate}) is missing its Buy Price.`);
                }

                // Calculate the P/L impact of the transaction being deleted
                const plImpact = (sellPrice - wallet.buyPrice) * quantitySold;

                // Calculate the reversed wallet values
                const newSharesSold = Math.max(0, (wallet.sharesSold ?? 0) - quantitySold); // Prevent going below 0
                const newRemainingShares = (wallet.remainingShares ?? 0) + quantitySold; // Add back sold shares
                const newRealizedPl = (wallet.realizedPl ?? 0) - plImpact; // Subtract the P/L of this sale
                const newSellTxnCount = Math.max(0, (wallet.sellTxnCount ?? 0) - 1); // Decrement count, prevent going below 0

                // Recalculate Realized P/L % for the wallet based on NEW totals
                const newCostBasis = wallet.buyPrice * newSharesSold; // Cost basis of REMAINING sold shares
                let newRealizedPlPercent: number | null = null;
                if (newCostBasis !== 0) {
                    newRealizedPlPercent = (newRealizedPl / newCostBasis) * 100;
                } else if (newRealizedPl === 0 && newSharesSold === 0) {
                    newRealizedPlPercent = 0; // Explicitly 0% if no sales remaining and P/L is 0
                }

                // Prepare wallet update payload
                const walletUpdatePayload = {
                    id: walletIdToUpdate,
                    sharesSold: newSharesSold,
                    remainingShares: newRemainingShares,
                    realizedPl: newRealizedPl,
                    sellTxnCount: newSellTxnCount,
                    realizedPlPercent: newRealizedPlPercent,
                };

                //console.log("[StockWalletPage] - Reverting wallet changes with payload:", walletUpdatePayload);
                const { errors: updateErrors } = await client.models.StockWallet.update(walletUpdatePayload);
                if (updateErrors) throw updateErrors; // Propagate update errors

                walletUpdateSuccess = true; // Mark wallet update as successful

            } catch (walletErr: unknown) {
                 //console.error("[StockWalletPage] - Error updating wallet during transaction delete:", walletErr);
                 // Capture the error but allow transaction delete attempt to proceed
                 walletUpdateError = `Wallet update failed: ${Array.isArray(walletErr) ? (walletErr as Array<{message: string}>)[0].message : (walletErr as Error).message}`;
            }
        }
        
        // ==============================================
        // === Logic for DELETING A BUY TRANSACTION ===
        // ==============================================
        else if (txnToDelete.action === 'Buy') { // Use 'else if' assuming Div doesn't affect wallets
            const buyPrice = txnToDelete.price;
            const swingSharesToRemove = txnToDelete.swingShares ?? 0;
            const holdSharesToRemove = txnToDelete.holdShares ?? 0;
            const investmentToRemove = txnToDelete.investment ?? 0;
            const epsilon = 0.000001;

            if (typeof buyPrice !== 'number' || (swingSharesToRemove < epsilon && holdSharesToRemove < epsilon)) {
                //console.warn("[StockWalletPage] - [Delete Buy] Cannot process wallet update: Invalid price or zero shares.");
                finalMessage += ` | Wallet update skipped (invalid price/shares).`;
            } else {
                // Calculate proportional investment
                const totalSharesInTxn = swingSharesToRemove + holdSharesToRemove;
                let swingInvToRemove = 0;
                let holdInvToRemove = 0;
                if (totalSharesInTxn > epsilon && investmentToRemove > 0) {
                    swingInvToRemove = (swingSharesToRemove / totalSharesInTxn) * investmentToRemove;
                    holdInvToRemove = (holdSharesToRemove / totalSharesInTxn) * investmentToRemove;
                    if (Math.abs((swingInvToRemove + holdInvToRemove) - investmentToRemove) > 0.001) {
                        holdInvToRemove = investmentToRemove - swingInvToRemove; // Adjust rounding
                    }
                }

                // Define the helper function INSIDE the 'Buy' block
                const updateWalletOnBuyDelete = async (
                    type: 'Swing' | 'Hold',
                    sharesToRemove: number,
                    investmentToRemove: number
                ): Promise<boolean> => {
                    if (sharesToRemove <= epsilon) return true; // Success if nothing to remove

                    //console.log(`[StockWalletPage] - [Delete Buy - ${type}] Attempting wallet update. SharesToRemove: ${sharesToRemove}, InvToRemove: ${investmentToRemove}`);
                    try {
                        // Find wallet using client-side check
                        const { data: candidates, errors: listErrors } = await client.models.StockWallet.list({
                            filter: { and: [ { portfolioStockId: { eq: stockId } }, { walletType: { eq: type } } ] },
                            selectionSet: ['id', 'buyPrice', 'sharesSold', 'sellTxnCount', 'totalSharesQty', 'totalInvestment', 'remainingShares'],
                            limit: FETCH_LIMIT_WALLETS_CANDIDATES
                        });
                        if (listErrors) { throw listErrors; } // Propagate list errors

                        const walletToUpdate = (candidates || []).find(wallet => wallet.buyPrice != null && Math.abs(wallet.buyPrice - buyPrice) < epsilon );

                        if (!walletToUpdate) {
                            console.warn(`[StockWalletPage] - [Delete Buy - ${type}] Wallet not found for price ${buyPrice}. Cannot update.`);
                            finalMessage += ` | ${type} wallet (Price ${buyPrice}) not found.`;
                            return true; // Treat as non-failure for Txn deletion
                        }

                        // Check for sales
                        if ((walletToUpdate.sharesSold ?? 0) > epsilon || (walletToUpdate.sellTxnCount ?? 0) > 0) {
                            console.warn(`[StockWalletPage] - [Delete Buy - ${type}] Wallet ${walletToUpdate.id} has sales. Skipping update.`);
                            finalMessage += ` | ${type} wallet (Price ${buyPrice}) has sales, not reversed.`;
                            return true; // Allow Txn deletion, skip wallet update
                        }

                        // No sales - Update wallet (subtract values)
                        //console.log(`[StockWalletPage] - [Delete Buy - ${type}] Applying reversal to wallet ${walletToUpdate.id}...`);
                        const newTotalShares = Math.max(0, (walletToUpdate.totalSharesQty ?? 0) - sharesToRemove);
                        const newInvestment = Math.max(0, (walletToUpdate.totalInvestment ?? 0) - investmentToRemove);
                        const newRemaining = Math.max(0, (walletToUpdate.remainingShares ?? 0) - sharesToRemove);

                        if(newRemaining < -epsilon || newTotalShares < -epsilon) { throw new Error("Negative shares calculation error."); }
                        if (Math.abs(newRemaining - newTotalShares) > epsilon) { console.warn(`Potential inconsistency in remaining shares calculation for ${type} wallet ${walletToUpdate.id}.`); }

                        const walletUpdatePayload = {
                            id: walletToUpdate.id,
                            totalSharesQty: newTotalShares, totalInvestment: newInvestment, remainingShares: newRemaining,
                            sharesSold: 0, realizedPl: 0, sellTxnCount: 0, realizedPlPercent: 0, // Reset these as no sales occurred
                        };
                        const { errors: updateErrors } = await client.models.StockWallet.update(walletUpdatePayload);
                        if (updateErrors) throw updateErrors; // Propagate update errors
                        //console.log(`[StockWalletPage] - [Delete Buy - ${type}] Wallet update successful.`);
                        return true; // Success

                    } catch (err: unknown) {
                        console.error(`[StockWalletPage] - [Delete Buy - ${type}] Helper FAILED:`, (err as {errors?: unknown[]}).errors || err);
                        finalMessage += ` | Error updating ${type} wallet: ${(err as Error).message}.`;
                        return false; // Indicate critical failure
                    }
                }; // --- End updateWalletOnBuyDelete helper ---

                // Attempt updates sequentially
                const swingUpdateOk = await updateWalletOnBuyDelete('Swing', swingSharesToRemove, swingInvToRemove);
                const holdUpdateOk = await updateWalletOnBuyDelete('Hold', holdSharesToRemove, holdInvToRemove);

                if (!swingUpdateOk || !holdUpdateOk) {
                    overallSuccess = false; // Mark overall process failed if wallet update had critical error
                }
            } // End if valid Buy Txn data for wallet update
        } // --- END 'Buy' Deletion Block ---

        // --- Finally, Delete the Transaction IF preceding wallet logic didn't critically fail ---
        if (overallSuccess) {
            //console.log(`[StockWalletPage] - Proceeding to delete transaction ${idToDelete}`);
            const { errors: deleteErrors } = await client.models.Transaction.delete({ id: idToDelete });
            if (deleteErrors) throw deleteErrors; // Throw delete error if it occurs
            //console.log('[StockWalletPage] - Transaction deleted successfully!');
            finalMessage = `Transaction deleted successfully.${finalMessage}`;
            setTxnError(null); // Clear any previous warnings if fully successful
            // You might want a success state here too: setTxnSuccess(finalMessage);
        } else {
             // Wallet logic failed, do not delete the transaction
             throw new Error(`[StockWalletPage] - Transaction NOT deleted due to critical errors updating associated wallets.${finalMessage}`);
        }

        // Handle final status based on outcomes
        if (isWalletSell && !walletUpdateSuccess) {
             setTxnError(`Transaction deleted, but reversing wallet changes failed: ${walletUpdateError}`);
        } else if (walletUpdateError) {
             // Should not happen if update succeeded, but as safety
             setTxnError(`Transaction deleted, but encountered wallet issue: ${walletUpdateError}`);
        } else {
             // Success, clear any previous error
             setTxnError(null);
        }

    } catch (err: unknown) {
        // Catch errors from Transaction.delete or errors propagated from Wallet update/fetch
        console.error('[StockWalletPage] - Error during delete process:', err);
        const errorMessage = Array.isArray(err) ? (err as Array<{message: string}>)[0].message : ((err as Error).message || 'Failed to delete transaction.');
        // If wallet update succeeded but delete failed, we have inconsistent state! Log clearly.
        if (walletUpdateSuccess) {
             //console.error("[StockWalletPage] - CRITICAL: Wallet was updated, but Transaction delete failed! Manual reconciliation needed.");
             setTxnError(`Wallet impact reversed, but FAILED TO DELETE transaction: ${errorMessage}`);
        } else {
            setTxnError(`Delete Failed: ${errorMessage}`); // General delete error
        }
    } finally {
        // --- Step 3: Refresh Both Lists regardless of outcome ---
        //console.log("[StockWalletPage] - Refreshing wallets and transactions after delete attempt.");
        fetchTransactions();
        fetchWallets();
        // Reset loading state if applicable
    }
};
// --- END Edit/Delete Handlers ---


    // --- Fetch Stock Symbol for Title ---
    useEffect(() => {        if (stockId) {
            //console.log(`Workspaceing symbol for stockId: ${stockId}`);
            client.models.PortfolioStock.get(
                { id: stockId }, 
                { selectionSet: ['symbol', 'name', 'budget', 'pdp', 'swingHoldRatio', 'plr', 'stockCommission', 'htp', 'stockTrend'] })
                .then(({ data, errors }) => {
                    if (errors) {
                        //console.error("[StockWalletPage] - Error fetching stock symbol:", errors);
                        setError(prev => prev ? `${prev} | Failed to fetch symbol.` : 'Failed to fetch symbol.');                        setStockSymbol("Error");
                        setStockName("Error");
                        setStockBudget(null);
                        setStockPdp(null);
                        setStockShr(null);
                        setStockPlr(null);
                        setStockCommission(null);
                        setStockHtp(null);
                    } else if (data) {
                        setStockSymbol(data.symbol ?? "Unknown");                        setStockName(data.name ?? "Unknown");
                        setStockBudget(data.budget);
                        setStockPdp(data.pdp);       // <<< Set PDP state
                        setStockShr(data.swingHoldRatio); // <<< Set SHR state
                        setStockPlr(data.plr);       // <<< Set PLR state
                        setStockCommission(data.stockCommission); // <<< Set Commission state
                        setStockHtp(data.htp);       // <<< Set HTP state
                    } else {
                        setStockSymbol("Not Found");                        setStockName("Not Found");
                        setStockBudget(null);
                        setStockPdp(null); // Set related state to null if not found
                        setStockShr(null);
                        setStockPlr(null);
                        setStockCommission(null);
                        setStockHtp(null);
                    }
                }).catch(err => {
                    //console.error("[StockWalletPage] - Error fetching stock symbol:", err);
                    setError(prev => prev ? `${prev} | Failed to fetch symbol.` : 'Failed to fetch symbol.');
                    setStockSymbol("Error");
                    setStockName("Error");                    setStockBudget(null);
                    setStockShr(null);
                    setStockPlr(null);
                    setStockCommission(null);
                    setStockHtp(null);
                });
        } else {
            setStockSymbol(undefined);
            setStockName(undefined);
            setStockBudget(undefined);
            setStockPdp(undefined);
            setStockShr(undefined);
            setStockPlr(undefined);
            setStockCommission(undefined);
            setStockHtp(undefined);
        }
    }, [stockId]); // Dependency on stockId


    // Fetch wallet data when stockId changes or fetchWallets updates
    useEffect(() => {
        fetchWallets();
    }, [fetchWallets]); // fetchWallets dependency includes stockId

    // --- Add Calculations using useMemo ---
    const transactionCounts = useMemo(() => {
        if (!transactions) return { buys: 0, swingSells: 0, holdSells: 0, totalSells: 0 };

        const buys = transactions.filter(t => t.action === 'Buy').length;
        const swingSells = transactions.filter(t => t.action === 'Sell' && t.txnType === 'Swing').length;
        const holdSells = transactions.filter(t => t.action === 'Sell' && t.txnType === 'Hold').length;
        // Note: This assumes sells always have a txnType matching the wallet they came from.
        // If a 'Sell' could have a null/undefined txnType, adjust filter as needed.
        const totalSells = swingSells + holdSells;

        return { buys, swingSells, holdSells, totalSells };
    }, [transactions]); // Depends on the transactions state

    const currentShares = useMemo(() => {
        if (!wallets) return { swing: 0, hold: 0, total: 0 };

        const epsilon = SHARE_EPSILON; // Use defined epsilon

        const swing = wallets
            .filter(w => w.walletType === 'Swing' && (w.remainingShares ?? 0) > epsilon)
            .reduce((sum, w) => sum + (w.remainingShares ?? 0), 0);

        const hold = wallets
            .filter(w => w.walletType === 'Hold' && (w.remainingShares ?? 0) > epsilon)
            .reduce((sum, w) => sum + (w.remainingShares ?? 0), 0);

        const total = swing + hold;

        // Apply rounding to the final sums for display consistency
        const roundedSwing = parseFloat(swing.toFixed(SHARE_PRECISION));
        const roundedHold = parseFloat(hold.toFixed(SHARE_PRECISION));
        const roundedTotal = parseFloat(total.toFixed(SHARE_PRECISION));


        return {
            swing: (Math.abs(roundedSwing) < epsilon) ? 0 : roundedSwing,
            hold: (Math.abs(roundedHold) < epsilon) ? 0 : roundedHold,
            total: (Math.abs(roundedTotal) < epsilon) ? 0 : roundedTotal
        };
    }, [wallets]); // Depends on the wallets state

    // --- Realized P/L Calculation Memo (Standard Market Terminology) ---
    const realizedPlStats = useMemo(() => {
        // Need both transactions and wallets for this calculation
        if (!transactions || !wallets) {
            return {
                realizedSwingPL: 0, realizedSwingPercent: null,
                realizedHoldPL: 0, realizedHoldPercent: null,
                realizedStockPL: 0, realizedStockPercent: null,
                totalSwingCostBasis: 0, totalHoldCostBasis: 0, totalStockCostBasis: 0,
            };
        }

        // 1. Use the new utility function for total Swing P/L Dollars
        //    This function needs the raw transactions and wallets arrays.
        const calculatedTotalSwingPlDollars = calculateTotalRealizedSwingPL(transactions, wallets);

         // 2. Create Wallet Map (still needed for Hold P/L and cost basis calculations)
        const walletBuyPriceMap = new Map<string, number>();
        wallets.forEach(w => {
            if (w.id && typeof w.buyPrice === 'number') {
                walletBuyPriceMap.set(w.id, w.buyPrice);
            }
        });

        // 2. Initialize aggregators
        // let totalSwingPlDollars = 0;
        // let totalSwingCostBasis = 0;
        // let totalHoldPlDollars = 0;
        // let totalHoldCostBasis = 0;
        // let warnings = 0;

        let totalHoldPlDollars = 0;
        let totalSwingCostBasis = 0; // Will calculate this here
        let totalHoldCostBasis = 0;
        let warnings = 0;

        // 4. Iterate through transactions for Hold P/L and ALL cost bases
        transactions.forEach(txn => {
            if (txn.action === 'Sell' && txn.completedTxnId && typeof txn.quantity === 'number' && typeof txn.price === 'number') {
                const walletBuyPrice = walletBuyPriceMap.get(txn.completedTxnId);

                if (typeof walletBuyPrice === 'number') {
                    const costBasisForTxn = walletBuyPrice * txn.quantity;

                    // Use stored txnProfit instead of recalculating, as it contains commission-adjusted P/L
                    const profitForTxn = txn.txnProfit ?? calculateSingleSalePL(txn.price, walletBuyPrice, txn.quantity);

                    if (txn.txnType === 'Swing') {
                        // totalSwingPlDollars is now handled by calculateTotalRealizedSwingPL
                        totalSwingCostBasis += costBasisForTxn;
                    } else if (txn.txnType === 'Hold') {
                        totalHoldPlDollars += profitForTxn;
                        totalHoldCostBasis += costBasisForTxn;
                    } else {
                        console.warn(`[StockWalletPage] - Sell transaction ${txn.id} has unexpected/missing txnType: ${txn.txnType}`);
                        warnings++;
                    }
                } else {
                    console.warn(`[StockWalletPage] - Could not find wallet buy price for Sell transaction ${txn.id} (linked wallet ID: ${txn.completedTxnId}). Cannot include in P/L calculation.`);
                    warnings++;
                }
            }
        });

        // 5. Calculate percentages (TRADING ONLY - no dividend/SLP income)
        const realizedSwingPercent = (totalSwingCostBasis !== 0)
        ? (calculatedTotalSwingPlDollars / totalSwingCostBasis) * 100 // Use calculatedTotalSwingPlDollars
        : (calculatedTotalSwingPlDollars === 0 ? 0 : null);

        const realizedHoldPercent = (totalHoldCostBasis !== 0)
            ? (totalHoldPlDollars / totalHoldCostBasis) * 100
            : (totalHoldPlDollars === 0 ? 0 : null);

        // Realized P/L from TRADING ONLY (no dividend/SLP income)
        const realizedStockPL = calculatedTotalSwingPlDollars + totalHoldPlDollars;
        const totalStockCostBasis = totalSwingCostBasis + totalHoldCostBasis;
        
        // For Stock P/L percentage, use cost basis of only SOLD shares as denominator
        // This ensures consistency with Swing and Hold individual percentage calculations
        // and follows standard market logic for realized P/L percentages
        const realizedStockPercent = (totalStockCostBasis > 0)
            ? (realizedStockPL / totalStockCostBasis) * 100
            : (realizedStockPL === 0 ? 0 : null);

        // 6. Round final values (TRADING ONLY)
        const roundedRealizedSwingPL = parseFloat(calculatedTotalSwingPlDollars.toFixed(CURRENCY_PRECISION)); // Use calculatedTotalSwingPlDollars
        const roundedRealizedHoldPL = parseFloat(totalHoldPlDollars.toFixed(CURRENCY_PRECISION));
        const roundedRealizedStockPL = parseFloat(realizedStockPL.toFixed(CURRENCY_PRECISION));

        const finalRealizedSwingPercent = typeof realizedSwingPercent === 'number'
            ? parseFloat(realizedSwingPercent.toFixed(PERCENT_PRECISION))
            : null;
        const finalRealizedHoldPercent = typeof realizedHoldPercent === 'number'
            ? parseFloat(realizedHoldPercent.toFixed(PERCENT_PRECISION))
            : null;
        const finalRealizedStockPercent = typeof realizedStockPercent === 'number'
            ? parseFloat(realizedStockPercent.toFixed(PERCENT_PRECISION))
            : null;

        // Calculate Dividend and SLP income for separate tracking
        let totalDividendAmount = 0;
        let totalSlpAmount = 0;
        
        transactions.forEach(txn => {
            if (txn.action === 'Div' && typeof txn.amount === 'number') {
                totalDividendAmount += txn.amount;
            } else if (txn.action === 'SLP' && typeof txn.amount === 'number') {
                totalSlpAmount += txn.amount;
            }
        });

        const totalIncomeFromDivAndSlp = totalDividendAmount + totalSlpAmount;

        if (warnings > 0) {
            console.warn(`[StockWalletPage] - [realizedPlStats] Calculation finished with ${warnings} warnings (missing data). Results might be incomplete.`);
        }

        return {
            realizedSwingPL: roundedRealizedSwingPL, // Use the value from the utility function
            realizedSwingPercent: finalRealizedSwingPercent,
            realizedHoldPL: roundedRealizedHoldPL,
            realizedHoldPercent: finalRealizedHoldPercent,
            realizedStockPL: roundedRealizedStockPL,
            realizedStockPercent: finalRealizedStockPercent,
            totalSwingCostBasis: parseFloat(totalSwingCostBasis.toFixed(CURRENCY_PRECISION)), // Round cost basis
            totalHoldCostBasis: parseFloat(totalHoldCostBasis.toFixed(CURRENCY_PRECISION)),   // Round cost basis
            totalStockCostBasis: parseFloat(totalStockCostBasis.toFixed(CURRENCY_PRECISION)), // Round cost basis
            totalDividendAmount: parseFloat(totalDividendAmount.toFixed(CURRENCY_PRECISION)),
            totalSlpAmount: parseFloat(totalSlpAmount.toFixed(CURRENCY_PRECISION)),
            totalIncomeFromDivAndSlp: parseFloat(totalIncomeFromDivAndSlp.toFixed(CURRENCY_PRECISION))
        };

    }, [transactions, wallets]); // Remove constant dependencies that don't cause re-renders
    // --- End Realized P/L Calc Memo ---


    // --- START - Client-Side Sorting Logic for Wallets ---
const sortedWallets = useMemo(() => {
    //console.log("[Memo] Sorting wallets...");
    const sortableItems = [...wallets]; // Start with the raw wallets fetched

    if (walletSortConfig !== null) { // Use the new state variable
        sortableItems.sort((a, b) => {
             // Helper for nulls/undefined - places them last consistently
            const handleNulls = (val: unknown) => {
                if (val === null || val === undefined) {
                    // Use walletSortConfig here
                    return walletSortConfig.direction === 'ascending' ? Infinity : -Infinity;
                }
                return val;
            };

            // Use the correct key type for wallets
            const key = walletSortConfig.key as keyof StockWalletDataType;

            const valA = a ? a[key] : undefined;
            const valB = b ? b[key] : undefined;

            const resolvedA = handleNulls(valA);
            const resolvedB = handleNulls(valB);

            let comparison = 0;

            // Comparison logic (only numbers expected for wallet keys based on SortableWalletKey)
            if (typeof resolvedA === 'number' && typeof resolvedB === 'number') {
                comparison = resolvedA - resolvedB;
            } else {
                 // Basic fallback if somehow not numbers
                 if (resolvedA < resolvedB) comparison = -1;
                 else if (resolvedA > resolvedB) comparison = 1;
            }

            // Use walletSortConfig here
            return walletSortConfig.direction === 'ascending' ? comparison : comparison * -1;
        });
    } else {
        // Default sort: Keep the sort by TP ascending from fetchWallets if desired,
        // or change to Buy Price ascending, or remove default client sort
         sortableItems.sort((a, b) => { // Example: Default sort Buy Price Asc
             const priceA = a.buyPrice ?? Infinity; // Nulls last
             const priceB = b.buyPrice ?? Infinity; // Nulls last
             return priceA - priceB;
         });
    }
    //console.log("[Memo] Wallets sorted.");
    return sortableItems;
}, [wallets, walletSortConfig]); // Use the new sort config state
// --- END - Client-Side Sorting Logic for Wallets ---



    // --- ADD Client-Side Filtering for Tabs ---
    const swingWallets = useMemo(() => {
        // Log the input array that's about to be filtered
        //console.log("[StockWalletPage] -  Raw sortedWallets before Swing filter:", sortedWallets);

        // Perform the filter operation
        const filtered = sortedWallets.filter(w => w.walletType === 'Swing');

        // Log the result of the filtering
        //console.log("[StockWalletPage] -  Filtered swingWallets RESULT:", filtered);

        // Return the filtered array
        return filtered;
    }, [sortedWallets]); // Dependency array remains the same

    const holdWallets = useMemo(() => {
        // You can optionally log the input here too, though it's the same sortedWallets
        // console.log("[StockWalletPage] -  Raw sortedWallets before Hold filter:", sortedWallets);

        // Perform the filter operation
        const filtered = sortedWallets.filter(w => w.walletType === 'Hold');

        // Log the result of the filtering
        //console.log("[StockWalletPage] -  Filtered holdWallets RESULT:", filtered);

        // Return the filtered array
        return filtered;
    }, [sortedWallets]); // Dependency array remains the same
    // --- END Filtering Logic ---

    // Merge test prices with real prices for display
    const mergedPrices = useMemo(() => {
        // For wallets page, merge test price from current stock data if available
        if (currentStockData && currentStockData.symbol && currentStockData.testPrice) {
            return mergeTestPricesWithRealPrices(latestPrices, [currentStockData]);
        }
        // Otherwise, convert the real prices to the merged format with isTestPrice: false
        const mergedRealPrices: Record<string, { symbol: string; currentPrice: number | null; historicalCloses: { date: string; close: number; }[]; isTestPrice?: boolean; } | null> = {};
        Object.keys(latestPrices).forEach(symbol => {
            const price = latestPrices[symbol];
            if (price) {
                mergedRealPrices[symbol] = {
                    ...price,
                    isTestPrice: false
                };
            } else {
                mergedRealPrices[symbol] = null;
            }
        });
        return mergedRealPrices;
    }, [latestPrices, currentStockData]);

    
// --- UPDATED Memo for Total SWING YTD P/L ($ and %) ---
const totalSwingYtdPL = useMemo(() => {
    //console.log("[Memo] Calculating totalSwingYtdPL ($ and %)");
    // Depends on transactions, wallets, price data
    if (!transactions || !wallets || !stockSymbol) {
        return { dollars: null, percent: null }; // Return object for consistency
    }

    // --- Create Wallet Map INSIDE this hook ---
    //console.log("[Memo] Creating internal wallet buy price map for YTD calc");
    const walletBuyPriceMap = new Map<string, number>(); // Map<walletId, buyPrice>
    wallets.forEach(w => {
        // Ensure wallet has an ID and a valid buy price number
        if (w.id && typeof w.buyPrice === 'number') {
            walletBuyPriceMap.set(w.id, w.buyPrice);
        }
    });
    //console.log(`[Memo] Internal map created with ${walletBuyPriceMap.size} entries.`);
    // --- End Wallet Map ---

    const currentYear = new Date().getFullYear();
    const startOfYear = `${currentYear}-01-01`;
    const currentPrice = mergedPrices[stockSymbol]?.currentPrice ?? null;

    let ytdRealizedSwingPL = 0;
    let currentUnrealizedSwingPL = 0;
    let currentSwingCostBasis = 0; // <<< ADDED: Accumulator for cost basis
    let warnings = 0;

    // --- Calculate YTD Realized P/L for SWING Sells ---
    const swingSplits = extractStockSplits(transactions);
    transactions.forEach(txn => {
        if (txn.action === 'Sell' && txn.txnType === 'Swing' &&
            txn.date && txn.date >= startOfYear && txn.completedTxnId &&
            typeof txn.quantity === 'number' && typeof txn.price === 'number') {
            const walletBuyPrice = walletBuyPriceMap.get(txn.completedTxnId);
            const buyTxn = transactions.find(t => t.id === txn.completedTxnId);
            const buyDate = buyTxn?.date || '';
            if (typeof walletBuyPrice === 'number' && buyDate) {
                // Use stored txnProfit if available, otherwise calculate with splits
                const profitForThisOneSale = txn.txnProfit ?? calculateSingleSalePLWithSplits(
                    txn.price!,
                    walletBuyPrice,
                    txn.quantity!,
                    txn.date!,
                    buyDate,
                    swingSplits
                );
                ytdRealizedSwingPL += profitForThisOneSale;
            } else {
                // Wallet link or buy price was missing for a YTD Swing Sell
                warnings++;
                console.warn(`[StockWalletPage] - [Swing YTD P/L] Could not find wallet buy price or buy date for YTD Swing Sell Txn ${txn.id}`);
            }
        }
    });

    // --- Calculate Current Unrealized P/L AND Cost Basis for SWING Wallets ---
    if (typeof currentPrice === 'number') {
        wallets.forEach(wallet => {
            if (wallet.walletType === 'Swing' &&
                (wallet.remainingShares ?? 0) > SHARE_EPSILON &&
                typeof wallet.buyPrice === 'number') // Make sure buyPrice exists
            {
                 // Unrealized P/L calculation
                 currentUnrealizedSwingPL += (currentPrice - wallet.buyPrice) * wallet.remainingShares!;
                 // Accumulate Cost Basis for current holdings
                 currentSwingCostBasis += wallet.buyPrice * wallet.remainingShares!; // <<< ADDED
            }
        });
   } else {
       //console.warn("[StockWalletPage] - [Swing YTD P/L] Cannot calculate P/L: Current price unavailable.");
       return { dollars: null, percent: null }; // Return nulls if price missing
   }

   // Sum the dollar components
   const totalPL_dollars = ytdRealizedSwingPL + currentUnrealizedSwingPL;
   const roundedTotalPL_dollars = parseFloat(totalPL_dollars.toFixed(CURRENCY_PRECISION));

   // --- Calculate Percentage ---
   let calculatedPercent: number | null = null;
   // Only calculate if the cost basis is positive to avoid division by zero/weird results
   if (currentSwingCostBasis > SHARE_EPSILON) {
        calculatedPercent = (totalPL_dollars / currentSwingCostBasis) * 100;
   } else if (Math.abs(totalPL_dollars) < 0.001) {
        // If cost basis is zero (or near zero) and P/L is also zero, return 0%
        calculatedPercent = 0;
   } // Otherwise, percent remains null (e.g., profit/loss with zero cost basis is undefined)

   const roundedPercent = typeof calculatedPercent === 'number'
       ? parseFloat(calculatedPercent.toFixed(PERCENT_PRECISION)) // Use PERCENT_PRECISION
       : null;
   // --- End Percentage Calculation ---

   if (warnings > 0) {
         console.warn(`[StockWalletPage] - [Swing YTD P/L] Calculation finished with ${warnings} warnings (missing data). Realized P/L part might be incomplete.`);
    }

    //console.log(`[StockWalletPage] - [Swing YTD P/L] $,%: ${roundedTotalPL_dollars}, ${roundedPercent}% (Basis: ${currentSwingCostBasis.toFixed(2)})`);

    // Return object with both values
    return {
        dollars: roundedTotalPL_dollars,
        percent: roundedPercent
    };

// Correct dependencies for this specific calculation
}, [transactions, wallets, mergedPrices, stockSymbol]); // Updated to use mergedPrices
// --- End Total Swing YTD P/L Calc Memo ---


// --- START: Memo for All-Time UNREALIZED P/L Calculation ---
const unrealizedPlStats = useMemo(() => {
    //console.log("[Memo] Calculating unrealizedPlStats ($ and %)");
    // Depends on wallets and the latest price for this stock
    if (!wallets || !stockSymbol) {
        return {
            unrealizedSwingPL: null, unrealizedSwingPercent: null, unrealizedSwingCostBasis: 0, // Added Basis
            unrealizedHoldPL: null, unrealizedHoldPercent: null, unrealizedHoldCostBasis: 0, // Added Basis
            unrealizedStockPL: null, unrealizedStockPercent: null, unrealizedStockCostBasis: 0 // Added Basis
        };
    }

    const currentPrice = mergedPrices[stockSymbol]?.currentPrice ?? null;

    // If current price isn't available, we cannot calculate unrealized P/L
    if (currentPrice === null) {
        //console.warn("[StockWalletPage] - [Unrealized P/L] Cannot calculate: Current price unavailable for", stockSymbol);
        return {
            unrealizedSwingPL: null, unrealizedSwingPercent: null, unrealizedSwingCostBasis: 0, // Added Basis
            unrealizedHoldPL: null, unrealizedHoldPercent: null, unrealizedHoldCostBasis: 0, // Added Basis
            unrealizedStockPL: null, unrealizedStockPercent: null, unrealizedStockCostBasis: 0 // Added Basis
        };
    }

    // Extract stock splits from transactions for split adjustments
    const stockSplits = extractStockSplits(transactions || []);

    let totalUnrealizedSwingPL = 0;
    let totalSwingCostBasis = 0; // Cost basis of CURRENTLY HELD swing shares
    let totalUnrealizedHoldPL = 0;
    let totalHoldCostBasis = 0; // Cost basis of CURRENTLY HELD hold shares

    wallets.forEach(wallet => {
        if ((wallet.remainingShares ?? 0) > SHARE_EPSILON && typeof wallet.buyPrice === 'number') {
          // Since wallets are now permanently updated during stock splits,
          // we use the wallet values directly without runtime split adjustments
          const buyPrice = wallet.buyPrice;
          const remainingShares = wallet.remainingShares!;
          
          const unrealizedForWallet = (currentPrice - buyPrice) * remainingShares;
          const costBasisForWallet = buyPrice * remainingShares;
  
          if (wallet.walletType === 'Swing') {
            totalUnrealizedSwingPL += unrealizedForWallet;
            totalSwingCostBasis += costBasisForWallet; // Accumulate basis
          } else if (wallet.walletType === 'Hold') {
            totalUnrealizedHoldPL += unrealizedForWallet;
            totalHoldCostBasis += costBasisForWallet; // Accumulate basis
          }
        }
      });

    // Calculate percentages based on collected basis
    const swingPercent = (totalSwingCostBasis > SHARE_EPSILON)
        ? (totalUnrealizedSwingPL / totalSwingCostBasis) * 100
        : (Math.abs(totalUnrealizedSwingPL) < 0.001 ? 0 : null);

    const holdPercent = (totalHoldCostBasis > SHARE_EPSILON)
        ? (totalUnrealizedHoldPL / totalHoldCostBasis) * 100
        : (Math.abs(totalUnrealizedHoldPL) < 0.001 ? 0 : null);

    const totalUnrealizedPl = totalUnrealizedSwingPL + totalUnrealizedHoldPL;
    const totalCostBasis = totalSwingCostBasis + totalHoldCostBasis; // Total basis of HELD shares
    const totalPercent = (totalCostBasis > SHARE_EPSILON)
        ? (totalUnrealizedPl / totalCostBasis) * 100
        : (Math.abs(totalUnrealizedPl) < 0.001 ? 0 : null);

    // Rounding
    // ... (rounding logic for dollars and percents as before) ...
    const roundedSwingDollars = parseFloat(totalUnrealizedSwingPL.toFixed(CURRENCY_PRECISION));
    const roundedHoldDollars = parseFloat(totalUnrealizedHoldPL.toFixed(CURRENCY_PRECISION));
    const roundedTotalDollars = parseFloat(totalUnrealizedPl.toFixed(CURRENCY_PRECISION));
    const roundedSwingPercent = typeof swingPercent === 'number' ? parseFloat(swingPercent.toFixed(PERCENT_PRECISION)) : null;
    const roundedHoldPercent = typeof holdPercent === 'number' ? parseFloat(holdPercent.toFixed(PERCENT_PRECISION)) : null;
    const roundedTotalPercent = typeof totalPercent === 'number' ? parseFloat(totalPercent.toFixed(PERCENT_PRECISION)) : null;

    // Return results
    return {
        unrealizedSwingPL: roundedSwingDollars,
        unrealizedSwingPercent: roundedSwingPercent,
        unrealizedSwingCostBasis: totalSwingCostBasis, // Return calculated basis
        unrealizedHoldPL: roundedHoldDollars,
        unrealizedHoldPercent: roundedHoldPercent,
        unrealizedHoldCostBasis: totalHoldCostBasis, // Return calculated basis
        unrealizedStockPL: roundedTotalDollars,
        unrealizedStockPercent: roundedTotalPercent,
        unrealizedStockCostBasis: totalCostBasis // Return calculated basis
    };

  }, [wallets, mergedPrices, stockSymbol, transactions]); // Updated to include transactions for split extraction
  // --- END: Memo for All-Time UNREALIZED P/L Calculation ---

// --- START: Memo for All-Time COMBINED P/L (Realized + Unrealized) ---
const combinedPlStats = useMemo(() => {
    // Check if unrealized calculation was possible (depends on current price)
    const unrealizedAvailable = unrealizedPlStats.unrealizedStockPL !== null;

    if (!unrealizedAvailable) {
        return {
          combinedSwingPL: null, combinedSwingPercent: null,
          combinedHoldPL: null, combinedHoldPercent: null,
          combinedStockPL: null, combinedStockPercent: null,
        };
      }
  
      // --- Calculate Combined Dollar Amounts (Including Income) ---
      const combinedSwingPL = (realizedPlStats.realizedSwingPL ?? 0) + (unrealizedPlStats.unrealizedSwingPL ?? 0);
      const combinedHoldPL = (realizedPlStats.realizedHoldPL ?? 0) + (unrealizedPlStats.unrealizedHoldPL ?? 0);
      
      // Include dividend and SLP income in the combined stock total
      const combinedStockPL = (realizedPlStats.realizedStockPL ?? 0) + (unrealizedPlStats.unrealizedStockPL ?? 0) + (realizedPlStats.totalIncomeFromDivAndSlp ?? 0);
  
      // --- Calculate Combined Cost Bases ---
      // Basis = Basis of Sold Shares (from realizedPlStats) + Basis of Held Shares (from unrealizedPlStats)
      const combinedSwingBasis = (realizedPlStats.totalSwingCostBasis ?? 0) + (unrealizedPlStats.unrealizedSwingCostBasis ?? 0);
      const combinedHoldBasis = (realizedPlStats.totalHoldCostBasis ?? 0) + (unrealizedPlStats.unrealizedHoldCostBasis ?? 0);
      const combinedStockBasis = (realizedPlStats.totalStockCostBasis ?? 0) + (unrealizedPlStats.unrealizedStockCostBasis ?? 0);
  
  
      // --- Calculate Combined Percentages ---
      const combinedSwingPercentCalc = (combinedSwingBasis > SHARE_EPSILON)
          ? (combinedSwingPL / combinedSwingBasis) * 100
          : (Math.abs(combinedSwingPL) < 0.001 ? 0 : null);
  
      const combinedHoldPercentCalc = (combinedHoldBasis > SHARE_EPSILON)
          ? (combinedHoldPL / combinedHoldBasis) * 100
          : (Math.abs(combinedHoldPL) < 0.001 ?  0 : null);
  
      const combinedStockPercentCalc = (combinedStockBasis > SHARE_EPSILON)
          ? (combinedStockPL / combinedStockBasis) * 100
          : (Math.abs(combinedStockPL) < 0.001 ? 0 : null);
  
      // --- Rounding ---
      const roundedCombinedSwingPL = parseFloat(combinedSwingPL.toFixed(CURRENCY_PRECISION));
      const roundedCombinedHoldPL = parseFloat(combinedHoldPL.toFixed(CURRENCY_PRECISION));
      const roundedCombinedStockPL = parseFloat(combinedStockPL.toFixed(CURRENCY_PRECISION));
  
      const roundedCombinedSwingPercent = typeof combinedSwingPercentCalc === 'number' ? parseFloat(combinedSwingPercentCalc.toFixed(PERCENT_PRECISION)) : null;
      const roundedCombinedHoldPercent = typeof combinedHoldPercentCalc === 'number' ? parseFloat(combinedHoldPercentCalc.toFixed(PERCENT_PRECISION)) : null;
      const roundedCombinedStockPercent = typeof combinedStockPercentCalc === 'number' ? parseFloat(combinedStockPercentCalc.toFixed(PERCENT_PRECISION)) : null;
  
      //console.log(`[StockWalletPage] - [Combined P/L] Final values - SwingPL: ${roundedCombinedSwingPL} (${roundedCombinedSwingPercent}%), HoldPL: ${roundedCombinedHoldPL} (${roundedCombinedHoldPercent}%), StockPL: ${roundedCombinedStockPL} (${roundedCombinedStockPercent}%)`);
  
      // --- Return results including percentages ---
      return {
        combinedSwingPL: roundedCombinedSwingPL,
        combinedSwingPercent: roundedCombinedSwingPercent,
        combinedHoldPL: roundedCombinedHoldPL,
        combinedHoldPercent: roundedCombinedHoldPercent,
        combinedStockPL: roundedCombinedStockPL,
        combinedStockPercent: roundedCombinedStockPercent,
      };
  // Depend on the results of the other two memos
}, [realizedPlStats, unrealizedPlStats]);
// --- END: Memo for All-Time COMBINED P/L ---


const totalTiedUpInvestment = useMemo(() => {
    // Ensure wallets data is loaded
    if (!wallets || wallets.length ===  0) {
        return 0;
    }

    //const epsilon = 0.000001; // Tolerance

    return wallets.reduce((totalTiedUp, wallet) => {
        const totalInvestment = wallet.totalInvestment ?? 0;
        const totalShares = wallet.totalSharesQty ?? 0;
        const remainingShares = wallet.remainingShares ?? 0;

        // Calculate investment per share for this wallet (handle division by zero)
        const investmentPerShare = (totalShares > SHARE_EPSILON) ? (totalInvestment / totalShares) : 0;

        // Calculate investment tied up in remaining shares for this wallet
        const tiedUpInWallet = investmentPerShare * remainingShares;

        return totalTiedUp + tiedUpInWallet;
    }, 0); // Start sum at 0

}, [wallets]); // Recalculate when the wallets data changes

// Calculate Risk Investment (rInv) - investment in wallets where TP hasn't been met
const riskInvestment = useMemo(() => {
    // If no wallets or no price data, return 0
    if (!wallets || wallets.length === 0) {
        return 0;
    }
    
    // Get current price from mergedPrices (includes test price if set)
    const currentPrice = mergedPrices[stockSymbol ?? '']?.currentPrice;
    
    // If no current price available, return total investment (all at risk)
    if (typeof currentPrice !== 'number') {
        return totalTiedUpInvestment;
    }
    
    // Calculate investment in wallets where TP has been MET
    const investmentWithMetTP = wallets.reduce((total, wallet) => {
        const remainingShares = wallet.remainingShares ?? 0;
        const tp = wallet.tpValue;
        
        // Skip if no remaining shares
        if (remainingShares <= SHARE_EPSILON) {
            return total;
        }
        
        // Check if TP has been MET (same logic as green coloring: tp <= currentPrice)
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
    return totalTiedUpInvestment - investmentWithMetTP;
}, [wallets, mergedPrices, stockSymbol, totalTiedUpInvestment]);

// --- ADD Memo for Total HOLD YTD P/L Calculation ---
const totalHoldYtdPL = useMemo(() => {
    //console.log("[Memo] Calculating totalHoldYtdPL ($ and %)");
    // Depends on transactions, wallets, price data
    if (!transactions || !wallets || !stockSymbol) {
        return { dollars: null, percent: null }; // Return object for consistency
    }

    // --- Create Wallet Map INSIDE this hook ---
    //console.log("[Memo] Creating internal wallet buy price map for YTD calc");
    const walletBuyPriceMap = new Map<string, number>(); // Map<walletId, buyPrice>
    wallets.forEach(w => {
        // Ensure wallet has an ID and a valid buy price number
        if (w.id && typeof w.buyPrice === 'number') {
            walletBuyPriceMap.set(w.id, w.buyPrice);
        }
    });
    //console.log(`[Memo] Internal map created with ${walletBuyPriceMap.size} entries.`);
    // --- End Wallet Map ---

    const currentYear = new Date().getFullYear();
    const startOfYear = `${currentYear}-01-01`;
    const currentPrice = mergedPrices[stockSymbol]?.currentPrice ?? null;

    let ytdRealizedHoldPL = 0;
    let currentUnrealizedHoldPL = 0;
    let currentHoldCostBasis = 0; // <<< ADDED: Accumulator for cost basis
    let warnings = 0;

    // --- Calculate YTD Realized P/L for HOLD Sells ---
    const holdSplits = extractStockSplits(transactions);
    transactions.forEach(txn => {
        if (txn.action === 'Sell' && txn.txnType === 'Hold' &&
            txn.date && txn.date >= startOfYear && txn.completedTxnId &&
            typeof txn.quantity === 'number' && typeof txn.price === 'number') {
            const walletBuyPrice = walletBuyPriceMap.get(txn.completedTxnId);
            const buyTxn = transactions.find(t => t.id === txn.completedTxnId);
            const buyDate = buyTxn?.date || '';
            if (typeof walletBuyPrice === 'number' && buyDate) {
                // Use stored txnProfit if available, otherwise calculate with splits
                const profitForThisOneSale = txn.txnProfit ?? calculateSingleSalePLWithSplits(
                    txn.price!,
                    walletBuyPrice,
                    txn.quantity!,
                    txn.date!,
                    buyDate,
                    holdSplits
                );
                ytdRealizedHoldPL += profitForThisOneSale;
            } else {
                // Wallet link or buy price was missing for a YTD Hold Sell
                warnings++;
                console.warn(`[StockWalletPage] - [Hold YTD P/L] Could not find wallet buy price or buy date for YTD Hold Sell Txn ${txn.id}`);
            }
        }
    });

    // --- Calculate Current Unrealized P/L AND Cost Basis for HOLD Wallets ---
    if (typeof currentPrice === 'number') {
        wallets.forEach(wallet => {
            if (wallet.walletType === 'Hold' &&
                (wallet.remainingShares ?? 0) > SHARE_EPSILON &&
                typeof wallet.buyPrice === 'number') // Make sure buyPrice exists
            {
                 // Unrealized P/L calculation
                 currentUnrealizedHoldPL += (currentPrice - wallet.buyPrice) * wallet.remainingShares!;
                 // Accumulate Cost Basis for current holdings
                 currentHoldCostBasis += wallet.buyPrice * wallet.remainingShares!; // <<< ADDED
            }
        });
   } else {
       //console.warn("[StockWalletPage] - [Hold YTD P/L] Cannot calculate P/L: Current price unavailable.");
       return { dollars: null, percent: null }; // Return nulls if price missing
   }

   // Sum the dollar components
   const totalPL_dollars = ytdRealizedHoldPL + currentUnrealizedHoldPL;
   const roundedTotalPL_dollars = parseFloat(totalPL_dollars.toFixed(CURRENCY_PRECISION));

   // --- Calculate Percentage ---
   let calculatedPercent: number | null = null;
   // Only calculate if the cost basis is positive to avoid division by zero/weird results
   if (currentHoldCostBasis > SHARE_EPSILON) {
        calculatedPercent = (totalPL_dollars / currentHoldCostBasis) * 100;
   } else if (Math.abs(totalPL_dollars) < 0.001) {
        // If cost basis is zero (or near zero) and P/L is also zero, return 0%
        calculatedPercent = 0;
   } // Otherwise, percent remains null (e.g., profit/loss with zero cost basis is undefined)

   const roundedPercent = typeof calculatedPercent === 'number'
       ? parseFloat(calculatedPercent.toFixed(PERCENT_PRECISION)) // Use PERCENT_PRECISION
       : null;
   // --- End Percentage Calculation ---

   if (warnings > 0) {
         console.warn(`[StockWalletPage] - [Hold YTD P/L] Calculation finished with ${warnings} warnings (missing data). Realized P/L part might be incomplete.`);
    }

    //console.log(`[StockWalletPage] - [Hold YTD P/L] $,%: ${roundedTotalPL_dollars}, ${roundedPercent}% (Basis: ${currentHoldCostBasis.toFixed(2)})`);

    // Return object with both values
    return {
        dollars: roundedTotalPL_dollars,
        percent: roundedPercent
    };

}, [transactions, wallets, mergedPrices, stockSymbol]); // Updated to use mergedPrices
// --- End Total Hold YTD P/L Calc Memo ---

// Helper to truncate long IDs for display
const truncateId = (id: string | null | undefined, length = 8): string => {
    // If no ID, return a dash
    if (!id) return '-';
    // If ID is already short enough, return it as is
    if (id.length <= length) return id;
    // Otherwise, show the first few chars, ellipsis, and last few chars
    const startLength = Math.floor(length / 2);
    const endLength = length - startLength;
    //return `${id.substring(0, startLength)}...${id.substring(id.length - endLength)}`;
    return `${id.substring(0, startLength)}...`;
};

const formatPercent = (value: number | null | undefined): string => {
        if (typeof value !== 'number' || isNaN(value)) { // Added isNaN check for robustness
            return '-';
        }
        // Use the imported PERCENT_PRECISION constant
        return `${value.toFixed(PERCENT_PRECISION)}%`;
    };

const formatShares = (value: number | null | undefined, decimals = SHARE_PRECISION): string => {
        if (typeof value !== 'number' || isNaN(value) || Math.abs(value) < SHARE_EPSILON) {
            return '-'; // Returns '-' only for non-numbers
        }
        // Returns formatted string with fixed decimals
        return value.toFixed(decimals);
    };
    // --- END: Formatting Helpers ---

    // +++ Add TP Cell Styling Function +++
    const getTpCellStyle = (
        wallet: StockWalletDataType,
        currentStockPrice: number | null | undefined // Pass current price in
    ): React.CSSProperties => {
        const remaining = wallet.remainingShares ?? 0;
        const tp = wallet.tpValue;

        // Conditions: Has shares AND TP is set AND TP >= Current Price
        if (remaining > SHARE_EPSILON &&
            typeof tp === 'number' &&
            typeof currentStockPrice === 'number' &&
            tp <= currentStockPrice
           ) {
             // Condition met: return green text style
             return { color: 'lightgreen' };
        }
        // Condition not met: return default empty style object
        return {};
    };
    // ++++++++++++++++++++++++++++++++

    // --- ADD FUNCTION to handle opening the modal ---
    const handleOpenSellModal = (wallet: StockWalletDataType) => {
        //console.log("Opening sell modal for wallet:", wallet);
        setWalletToSell(wallet);
        // Reset form fields when opening
        setSellDate(getTodayDateString());
        setSellQuantity(wallet.remainingShares ? String(wallet.remainingShares) : ''); // Pre-fill with remaining shares
        // Use the precise TP value from the database (4 decimal places) instead of empty string
        setSellPrice('');
        setSellError(null);
        setIsSelling(false);
        setSellSignal('TP');
        setIsSellModalOpen(true);
    };
    // --- END FUNCTION ---

    // Replace the entire handleSellSubmit function with this:
    const handleSellSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!walletToSell) {
            setSellError("No wallet selected for sale.");
            return;
        }
    
        //console.log("[StockWalletPage] - Data in walletToSell at start of handleSellSubmit:", JSON.stringify(walletToSell, null, 2));
    
        setIsSelling(true);
        setSellError(null);
    
        // --- Validation ---
        const quantity = parseFloat(sellQuantity); // User input quantity
        const price = parseFloat(sellPrice);       // User input price
        const remaining = walletToSell.remainingShares ?? 0; // Current remaining from DB
        const buyPrice = walletToSell.buyPrice;    // Buy price from wallet

        const remaining_rounded = parseFloat(remaining.toFixed(SHARE_PRECISION));
        const quantity_input_rounded = parseFloat(quantity.toFixed(SHARE_PRECISION)); // Assuming quantity is already parsed number
    
        if (isNaN(quantity) || quantity <= 0) {
            setSellError("Please enter a valid positive quantity.");
            setIsSelling(false);
            return;
        }
        // --- Modify remaining shares check using epsilon ---
        // Check if trying to sell slightly more than available due to floating point issues
        if (quantity_input_rounded > remaining_rounded + SHARE_EPSILON) {
            setSellError(`Quantity cannot exceed remaining shares (${remaining.toFixed(SHARE_PRECISION)}).`); // Format output
            setIsSelling(false);
            return;
        }
         // --- End modification ---
        if (isNaN(price) || price <= 0) {
            setSellError("Please enter a valid positive price.");
            setIsSelling(false);
            return;
        }
        if (!sellDate) {
            setSellError("Please select a valid date.");
            setIsSelling(false);
            return;
        }
        if (typeof buyPrice !== 'number') {
            setSellError("Error: Wallet buy price is missing. Cannot calculate P/L.");
            setIsSelling(false);
            return;
        }
         if (!sellSignal) {
            setSellError("Please select a Sell Signal.");
            setIsSelling(false);
            return;
        }
        // --- End Validation ---
    
    
        // --- Database Operations ---
        try {
            // 1. Calculate raw P/L for this specific sale (with commission adjustment)
            const realizedPlForSale = calculateSingleSalePLWithCommission(
                price, 
                buyPrice, 
                quantity, 
                stockCommission ?? 0 // Use 0 if no commission is set
            );
    
            // 2. Calculate NEW raw totals
            const newTotalSharesSold_raw = (walletToSell.sharesSold ?? 0) + quantity;
            const newTotalRealizedPl_raw = (walletToSell.realizedPl ?? 0) + realizedPlForSale;
            const newRemainingShares_raw = remaining - quantity; // Calculate raw remaining
    
            // 3. --- Round the Calculated Values ---
            // Round remaining shares
            const roundedRemainingShares = parseFloat(newRemainingShares_raw.toFixed(SHARE_PRECISION));
            // Force to exactly 0 if the rounded value is extremely close
            const finalRemainingShares = (Math.abs(roundedRemainingShares) < SHARE_EPSILON) ? 0 : roundedRemainingShares;
    
            // Round realized P/L
            const roundedRealizedPl = parseFloat(newTotalRealizedPl_raw.toFixed(CURRENCY_PRECISION));
    
            // Calculate and round realized P/L Percent
            const costBasisOfSoldShares = buyPrice * newTotalSharesSold_raw; // Cost basis using wallet's buy price
            let newRealizedPlPercent_raw: number | null = null;
            if (costBasisOfSoldShares !== 0) {
                 // Use rounded P/L for percentage calculation for consistency
                newRealizedPlPercent_raw = (roundedRealizedPl / costBasisOfSoldShares) * 100;
            } else if (roundedRealizedPl === 0) {
                newRealizedPlPercent_raw = 0;
            }
            // Round the percentage itself
            const finalRealizedPlPercent = typeof newRealizedPlPercent_raw === 'number'
                ? parseFloat(newRealizedPlPercent_raw.toFixed(PERCENT_PRECISION))
                : null;
            // --- End Rounding ---

            // --- ADD: Calculate P/L PERCENT for THIS sale ---
            let realizedPlPercentForSale: number | null = null;
            if (buyPrice !== 0) { // Avoid division by zero
                realizedPlPercentForSale = (realizedPlForSale / (buyPrice * quantity)) * 100;
            } else if (realizedPlForSale === 0) {
                realizedPlPercentForSale = 0; // 0% if cost basis and P/L are both 0
            }
            // Round the percentage for this transaction
            const roundedTxnPlPercent = typeof realizedPlPercentForSale === 'number'
               ? parseFloat(realizedPlPercentForSale.toFixed(PERCENT_PRECISION)) // Use PERCENT_PRECISION
               : null;
            // Round the dollar amount for this transaction
            const roundedTxnPl = parseFloat(realizedPlForSale.toFixed(CURRENCY_PRECISION));
            // --- END ADD ---
    
    
            // 4. Prepare StockWallet Update Payload (using FINAL rounded values)
            const walletPayload = {
                id: walletToSell.id,
                // sharesSold accumulates exact input quantities, should be precise enough
                sharesSold: newTotalSharesSold_raw,
                remainingShares: finalRemainingShares, // Use the final rounded & zero-checked value
                realizedPl: roundedRealizedPl,         // Use the rounded currency value
                realizedPlPercent: finalRealizedPlPercent,// Use the rounded percentage
                sellTxnCount: (walletToSell.sellTxnCount ?? 0) + 1,
            };
            //console.log("[StockWalletPage] - Updating StockWallet with payload:", walletPayload);
    
    
            // 5. Prepare Transaction Create Payload (uses exact sale quantity/price)
            const transactionPayload = {
                portfolioStockId: walletToSell.portfolioStockId,
                action: 'Sell' as const,
                date: sellDate,
                price: price,
                quantity: quantity, // The exact quantity specified by the user for THIS sale
                completedTxnId: walletToSell.id,
                signal: sellSignal || undefined,
                txnType: walletToSell.walletType,
                txnProfit: roundedTxnPl,             // Add rounded P/L $ for THIS txn
                txnProfitPercent: roundedTxnPlPercent
            };
            //console.log("[StockWalletPage] - Creating Transaction with payload:", transactionPayload);
    
    
            // --- Execute DB Operations ---
            const updatedWallet = await client.models.StockWallet.update(walletPayload);
            if (updatedWallet.errors) throw updatedWallet.errors;
    
            const newTransaction = await client.models.Transaction.create(transactionPayload);
            if (newTransaction.errors) throw newTransaction.errors;
    
            // --- Success ---
            //console.log("[StockWalletPage] - Sell recorded successfully!", { updatedWallet: updatedWallet.data, newTransaction: newTransaction.data });
            setIsSellModalOpen(false);
            fetchWallets();
            fetchTransactions(); // Refresh relevant data
    
        } catch (err: unknown) {
            // --- Error Handling ---
            //console.error("[StockWalletPage] - Error recording sell transaction:", err);
            const errorMessage = Array.isArray(err) ? (err as Array<{message: string}>)[0].message : ((err as Error).message || "An unknown error occurred.");
            setSellError(`Failed to record sale: ${errorMessage}`);
    
        } finally {
            // --- Cleanup ---
            setIsSelling(false);
        }
        // --- End Database Operations ---
    };

    // --- Modify Cancel Handler ---
     const handleCancelSell = () => {
        setIsSellModalOpen(false);
        // Also clear any errors or partial input if desired, though handleOpenSellModal already resets
        setSellError(null);
        setIsSelling(false);
        setSellSignal('Cust');
     };
    // --- End Cancel Handler ---

    // --- ADD HANDLERS for Transaction Modal ---
    const handleOpenTransactionModal = () => {
        setIsTransactionModalOpen(true);
    };

    const handleCloseTransactionModal = () => {
        setIsTransactionModalOpen(false);
        // Optionally reset any related state if needed
    };

    // This function will be called by TransactionForm after a successful transaction
    const handleTransactionAdded = () => {
        //console.log("[StockWalletPage] - handleTransactionAdded callback triggered!");
        setIsTransactionModalOpen(false); // Close the modal
        //await new Promise(resolve => setTimeout(resolve, 750));
        fetchWallets();
        fetchTransactions();
        // You might also need to refresh other data if transactions impact other calculations on the page
    };
    // --- END HANDLERS ---

    // --- Edit Stock Modal Handlers ---
    const handleEditStock = () => {
        // Create stock data object from current state
        if (stockId && stockSymbol && name) {
            const stockData = {
                id: stockId,
                symbol: stockSymbol,
                name: name,
                stockType: 'Stock' as const, // Default value
                region: 'US' as const, // Default value
                budget: stockBudget,
                pdp: stockPdp,
                swingHoldRatio: stockShr,
                plr: stockPlr,
                stockCommission: stockCommission,
                htp: stockHtp,
                testPrice: currentStockData?.testPrice ?? null, // Include test price from current stock data
                owner: ownerId ?? '',
                isHidden: null,
                archived: null,
                archivedAt: null,
                createdAt: '',
                updatedAt: '',
                transactions: null as unknown, // Not needed for edit
                stockWallets: null as unknown, // Not needed for edit
            };
            
            setStockToEditData(stockData as PortfolioStockDataType);
            setIsEditStockModalOpen(true);
        }
    };

    const handleCancelEditStock = () => {
        setIsEditStockModalOpen(false);
        setStockToEditData(null);
    };

    const handleUpdateStock = async (updatePayload: PortfolioStockUpdateInput) => {
        if (!stockId) return;
        console.log('Attempting to update stock:', stockId, updatePayload);

        try {
            const { data: updatedStock, errors } = await client.models.PortfolioStock.update({
                ...updatePayload,
                id: stockId, // Ensure id is this specific stockId
            });

            if (errors) {
                console.error('Error updating stock:', errors);
                setError(errors[0].message || 'Failed to update stock.');
            } else {
                console.log('Stock updated successfully:', updatedStock);
                // Update local state with new values
                if (updatedStock) {
                    setStockName(updatedStock.name ?? name);
                    setStockBudget(updatedStock.budget);
                    setStockPdp(updatedStock.pdp);
                    setStockShr(updatedStock.swingHoldRatio);
                    setStockPlr(updatedStock.plr);
                    setStockCommission(updatedStock.stockCommission);
                    setStockHtp(updatedStock.htp);
                }
                handleCancelEditStock();
            }
        } catch (err: unknown) {
            console.error('Unexpected error updating stock:', err);
            setError((err as Error).message || 'An error occurred during update.');
        }
    };
    // --- END Edit Stock Modal Handlers ---
    
    // --- ADD: Initial data loading useEffect ---
    useEffect(() => {
        if (stockId) {
            fetchCurrentStock();
            fetchWallets();
            fetchTransactions();
        }
    }, [stockId, fetchCurrentStock, fetchWallets, fetchTransactions]);
    
    
    // --- Render Logic ---
    // Show loading indicator until stock symbol AND wallets are potentially loaded
     if (isLoading || stockSymbol === undefined) return <p>Loading wallet data...</p>;
     // Handle case where stockId was invalid / stock not found
     if (stockSymbol === "Not Found" || stockSymbol === "Error") {
        return <p style={{ color: 'orange' }}>Could not load wallets: Stock {stockSymbol}.</p>;
     }
     // Show specific fetch error for wallets
     if (error && !stockSymbol) return <p style={{ color: 'red' }}>Error: {error}</p>;

     //console.log("[StockWalletPage] - Component rendering. Wallets state length:", wallets.length, "Wallets state content:", wallets);
     
    const currentStockPriceForOverview = mergedPrices[stockSymbol ?? '']?.currentPrice;
    const currentStockIsTestPrice = mergedPrices[stockSymbol ?? '']?.isTestPrice || false;

    return (
        <div>
            <WalletsHeader
                name={name ?? ''}
                symbol={stockSymbol}
                price={currentStockPriceForOverview}
                isTestPrice={currentStockIsTestPrice}
                pricesLoading={pricesLoading}
                onAddTransaction={handleOpenTransactionModal}
                onEditStock={handleEditStock}
            />
            <WalletsOverview
                isExpanded={isOverviewExpanded}
                onToggle={() => setIsOverviewExpanded(prev => !prev)}
                stockBudget={stockBudget}
                stockPdp={stockPdp}
                stockShr={stockShr}
                stockPlr={stockPlr}
                stockHtp={stockHtp}
                totalTiedUpInvestment={totalTiedUpInvestment}
                riskInvestment={riskInvestment}
                transactionCounts={transactionCounts}
                currentShares={currentShares}
                realizedPlStats={realizedPlStats}
                unrealizedPlStats={unrealizedPlStats}
                combinedPlStats={combinedPlStats}
                pricesLoading={pricesLoading}            />
            {/* --- START: Wallets section --- */}
            <WalletsTabs
              swingWallets={swingWallets}
              holdWallets={holdWallets}
              walletColumnVisibility={walletColumnVisibility}
              setWalletColumnVisibility={setWalletColumnVisibility}
              walletSortConfig={walletSortConfig}
              requestWalletSort={requestWalletSort}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              error={error}
              latestPrices={mergedPrices}
              stockSymbol={stockSymbol}
              onSell={handleOpenSellModal}
              onDelete={handleDeleteWallet}
              columnLabels={WALLET_COLUMN_LABELS}
              showEmptyWallets={showEmptyWallets}
              setShowEmptyWallets={setShowEmptyWallets}
              stockHtp={stockHtp}
              stockCommission={stockCommission}
            />
            {/* --- END: Wallets section replaced by component --- */}
            
            {/* --- START: Transactions section --- */}
            <WalletsTransactionsTable
                transactions={sortedTransactions}
                isLoading={isTxnLoading}
                error={txnError}
                columnVisibility={txnColumnVisibility}
                columnLabels={TXN_COLUMN_LABELS}
                setColumnVisibility={setTxnColumnVisibility}
                sortConfig={txnSortConfig}
                requestSort={requestTxnSort}
                onEdit={handleEditTxnClick}
                onDelete={handleDeleteTransaction}
            />
            {/* --- END: Transactions section --- */}

            {/* --- START: Sell modal --- */}
            <WalletsSellTransactionModal
              show={isSellModalOpen}
              wallet={walletToSell!}
              sellDate={sellDate}
              sellQuantity={sellQuantity}
              sellPrice={sellPrice}
              sellSignal={sellSignal}
              sellError={sellError}
              isSelling={isSelling}
              onDateChange={setSellDate}
              onQuantityChange={setSellQuantity}
              onPriceChange={setSellPrice}
              onSignalChange={(sig: Schema['Transaction']['type']['signal']) => setSellSignal(sig)}
              onCancel={handleCancelSell}
              onSubmit={handleSellSubmit}
           />
            {/* --- END: Sell modal --- */}

            {/* --- START: Buy modal --- */}
            {isTransactionModalOpen && (
                <div style={modalOverlayStyle}> {/* Reuse styles */}
                    <div style={{ ...modalContentStyle, minWidth: '400px' }}> {/* Slightly wider? */}
                        <h3>Add Transaction</h3>
                        <p style={{ marginTop: '-5px', marginBottom: '20px' }}>Stock: <strong>{stockSymbol?.toUpperCase()}</strong></p>

                        {/* Render the TransactionForm configured for any action */}
                        <TransactionForm
                            portfolioStockId={stockId} // Pass current stock ID
                            portfolioStockSymbol={stockSymbol} // Pass current symbol
                            onTransactionAdded={handleTransactionAdded} // Refresh list on success
                            showCancelButton={true} // Show the cancel button
                            onCancel={handleCloseTransactionModal} // Handle cancellation
                            // Do not pass edit mode props (isEditMode, initialData, onUpdate)
                        />
                    </div>
                </div>
            )}
            {/* --- END: Buy modal --- */}
            
            {/* --- START: Edit modal --- */}
            {isEditModalOpen && txnToEdit && (
                <div style={modalOverlayStyle}> {/* Reuse styles */}
                    <div style={{ ...modalContentStyle, minWidth: '400px' }}>
                        {/* Render TransactionForm configured for Edit mode */}
                        <TransactionForm
                            key={txnToEdit.id} // Force re-mount when editing different transactions or updated data
                            isEditMode={true}
                            initialData={txnToEdit}
                            onUpdate={async (updatedData: unknown) => {
                                await handleUpdateTransaction(updatedData as TransactionDataType & { id: string });
                            }}
                            onCancel={handleCancelEditTxn}
                            portfolioStockId={stockId}
                            portfolioStockSymbol={stockSymbol}
                            showCancelButton={true}
                        />
                    </div>
                </div>
            )}
            {/* --- END: Edit modal --- */}        

            {/* --- START: Edit Stock Modal --- */}
            <EditStockModal
                isOpen={isEditStockModalOpen}
                stockToEditData={stockToEditData}
                onUpdate={handleUpdateStock}
                onCancel={handleCancelEditStock}
            />
            {/* --- END: Edit Stock Modal --- */}
        </div>
    );
}

// -- Add some basic styles (optional, place outside component) ---
const modalOverlayStyle: React.CSSProperties = {
    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.6)', display: 'flex',
    justifyContent: 'center', alignItems: 'center', zIndex: 1000,
};
const modalContentStyle: React.CSSProperties = {
    background: '#151515', padding: '25px', borderRadius: '8px',
    minWidth: '350px', maxWidth: '500px', boxShadow: '0 5px 15px rgba(0,0,0,0.3)',
};
const formGroupStyle: React.CSSProperties = {
    marginBottom: '15px',
};
const labelStyle: React.CSSProperties = {
    display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '0.9em',
};
const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', border: '1px solid #ccc',
    borderRadius: '4px', boxSizing: 'border-box', fontSize: '1em',
};
// --- End Styles ---