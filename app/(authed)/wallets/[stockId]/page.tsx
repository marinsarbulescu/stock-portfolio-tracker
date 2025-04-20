// app/(authed)/wallets/[stockId]/page.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
// Import useParams to get ID from URL
import { useParams } from 'next/navigation';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource'; // Adjust path if needed
import TransactionForm from '@/app/components/TransactionForm';
import { FaEdit, FaTrashAlt, FaDollarSign } from 'react-icons/fa';
import type { GraphQLError } from 'graphql';

// Define the type for the fetched wallet data (no longer needs nested stock)
type StockWalletDataType = Schema['StockWallet']['type'];

// Define the keys we can sort the table by (removed 'symbol')
type SortableWalletKey = 'buyPrice' | 'totalInvestment' | 'totalSharesQty' | 'tpValue' | 'tpPercent' | 'sharesSold' | 
    'realizedPl' | 'realizedPlPercent' | 'remainingShares' | 'sellTxnCount';

type TransactionItem = Schema['Transaction']; // Already likely defined
type TransactionDataType = Schema['Transaction']['type']; // Already likely defined
type TransactionListResultType = Awaited<ReturnType<typeof client.models.Transaction.list>>;

const client = generateClient<Schema>();

// Helper function to get today's date in YYYY-MM-DD format
const getTodayDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
    const day = String(today.getDate()).padStart(2, '0');
    return `<span class="math-inline">\{year\}\-</span>{month}-${day}`;
};

export default function StockWalletPage() {
    // --- Get stockId from URL ---
    const params = useParams();
    const stockId = params.stockId as string; // Get stockId from dynamic route

    // --- State for Stock Symbol (for Title) ---
    const [stockSymbol, setStockSymbol] = useState<string | undefined>(undefined);

    // --- ADD STATE for Migration ---
    const [isMigrating, setIsMigrating] = useState(false);
    const [migrationError, setMigrationError] = useState<string | null>(null);
    const [migrationSuccess, setMigrationSuccess] = useState<string | null>(null);
    // --- END Migration State ---

    const [activeTab, setActiveTab] = useState<'Swing' | 'Hold'>('Swing');

    // State for fetched wallet data for THIS stock
    const [wallets, setWallets] = useState<StockWalletDataType[]>([]);
    // State for loading and error status
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    // State for table sorting
    const [sortConfig, setSortConfig] = useState<{ key: SortableWalletKey; direction: 'ascending' | 'descending' } | null>(null);

    // --- ADD STATE for Transaction List ---
    const [transactions, setTransactions] = useState<TransactionDataType[]>([]);
    const [isTxnLoading, setIsTxnLoading] = useState(true);
    const [txnError, setTxnError] = useState<string | null>(null);
    // State for Edit Modal
    const [isEditModalOpen, setIsEditModalOpen] = useState(false); // Separate modal for editing
    const [txnToEdit, setTxnToEdit] = useState<TransactionDataType | null>(null);
    // State for Sorting Txn Table
    type SortableTxnKey = 'date' | 'action' | 'signal' | 'txnType' |'price' | 'investment' | 'quantity' | 'lbd'; // Simplified keys
    const [txnSortConfig, setTxnSortConfig] = useState<{ key: SortableTxnKey; direction: 'ascending' | 'descending' } | null>(null);
    // --- END ADD STATE ---

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

    const [isBuyModalOpen, setIsBuyModalOpen] = useState(false);

    const SHARE_PRECISION = 5; // Or your desired share precision
    const CURRENCY_PRECISION = 2; // Standard for currency
    const PERCENT_PRECISION = 4; // Precision for percentages (adjust as needed)
    // Epsilon for checking closeness to zero, based on share precision
    const SHARE_EPSILON = 1 / (10**(SHARE_PRECISION + 2)); // e.g., 0.0000001 for 5 decimal places


    // --- Function to fetch wallets FOR THIS STOCK ---
    const fetchWallets = useCallback(async () => {
            // Only fetch if stockId is available
            if (!stockId) {
                console.log("[fetchWallets] Stock ID missing, skipping fetch.");
                setWallets([]); // Clear wallets if no ID
                setIsLoading(false);
                return;
            }
    
            setIsLoading(true);
            setError(null);
            console.log(`[fetchWallets] Running fetch for stockId: ${stockId}`);
            try {
                //console.log(`Workspaceing stock wallets for stockId: ${stockId}`);
                // Define fields needed from the StockWallet model
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
    
                console.log(`[fetchWallets] Calling list with filter:`, { portfolioStockId: { eq: stockId } });
                
                // --- ADDED FILTER ---
                const result = await client.models.StockWallet.list({
                    filter: { portfolioStockId: { eq: stockId } }, // Filter by stockId
                    selectionSet: selectionSetNeeded,
                    limit: 1000
                });

                console.log(`[fetchWallets] Raw API result after edit/add:`, JSON.stringify(result, null, 2));
    
                if (result.errors) throw result.errors;
    
                const fetchedData = result.data || []; // Default to empty array if data is null/undefined
                console.log(`[fetchWallets] Fetched ${fetchedData.length} wallets. Calling setWallets.`);
                
                setWallets(result.data as StockWalletDataType[]);
    
            } catch (err: any) {
                console.error("[fetchWallets] Error fetching stock wallets:", err);
                const message = Array.isArray(err?.errors) ? err.errors[0].message : err.message;
                setError(message || "Failed to fetch wallet data.");
                setWallets([]);
            } finally {
                setIsLoading(false);
            }
    }, [stockId]); // <<< ADD stockId dependency

        // Inside StockWalletPage component

    // Replace the ENTIRE body of handleMigrateBuysToWallets with this:
    const handleMigrateBuysToWallets = useCallback(async () => {
        if (!stockId) { setMigrationError("Stock ID is missing."); return; }
        if (!transactions) { setMigrationError("Transactions not loaded yet."); return; }

        setIsMigrating(true);
        setMigrationError(null);
        setMigrationSuccess(null);
        console.log(`[MIGRATE] Starting wallet migration for stockId: ${stockId}`);

        // Counters for summary
        let oldBuyTxnCount = 0;
        let buyGroupsCreated = 0;
        let walletsCreated = 0;
        let walletsSkipped = 0;
        let walletsFailed = 0;

        try {
            // --- 1. Get Stock Details (Ratio, PDP, PLR) ---
            console.log("[MIGRATE] Fetching stock details...");
            const { data: stockData, errors: stockErrors } = await client.models.PortfolioStock.get(
                { id: stockId }, { selectionSet: ['swingHoldRatio', 'pdp', 'plr'] }
            );
            if (stockErrors) throw stockErrors;
            if (!stockData) throw new Error("Could not fetch stock details.");

            const pdpValue = stockData.pdp;
            const plrValue = stockData.plr;
            let ratio = 0.5; // Default to 50/50 if ratio invalid/missing
            if (typeof stockData.swingHoldRatio === 'number' && stockData.swingHoldRatio >= 0 && stockData.swingHoldRatio <= 100) {
                ratio = stockData.swingHoldRatio / 100.0;
            } else {
                console.warn(`[MIGRATE] Invalid stock swingHoldRatio (${stockData.swingHoldRatio}). Defaulting to 50/50 split.`);
            }
            console.log(`[MIGRATE] Stock Details: PDP=${pdpValue}, PLR=${plrValue}, Ratio=${ratio * 100}% Swing`);


            // --- 2. Filter for OLD Buy Transactions (no txnType) ---
            // Use SHARE_EPSILON for checks
            const oldBuyTransactions = transactions.filter(
                txn => txn.action === 'Buy'
                    && !txn.txnType // Key filter
                    && typeof txn.quantity === 'number' && txn.quantity > SHARE_EPSILON
                    && typeof txn.price === 'number'
                    && typeof txn.investment === 'number' && txn.investment > SHARE_EPSILON
            );
            oldBuyTxnCount = oldBuyTransactions.length;
            console.log(`[MIGRATE] Found ${oldBuyTxnCount} historical Buy transactions.`);
            if (oldBuyTxnCount === 0) {
                setMigrationSuccess("No historical Buy transactions found needing migration.");
                setIsMigrating(false);
                return;
            }


            // --- 3. Aggregate RAW Shares/Investment by Buy Price ---
            // Store RAW values first
            const expectedWalletData_raw = new Map<string, {
                buyPrice: number;
                expectedSwingShares_raw: number;
                expectedHoldShares_raw: number;
                expectedTotalInvestment_raw: number;
            }>();

            for (const txn of oldBuyTransactions) {
                if (typeof txn.price !== 'number' || typeof txn.quantity !== 'number' || typeof txn.investment !== 'number') continue;
                const priceKey = txn.price.toFixed(4); // Key for grouping
                const group = expectedWalletData_raw.get(priceKey) ?? {
                    buyPrice: txn.price, expectedSwingShares_raw: 0, expectedHoldShares_raw: 0, expectedTotalInvestment_raw: 0,
                };

                // Calculate RAW splits for this transaction
                const txnSwingShares_raw = txn.quantity * ratio;
                const txnHoldShares_raw = txn.quantity * (1 - ratio);

                // Accumulate RAW values
                group.expectedSwingShares_raw += txnSwingShares_raw;
                group.expectedHoldShares_raw += txnHoldShares_raw;
                group.expectedTotalInvestment_raw += txn.investment;
                expectedWalletData_raw.set(priceKey, group);
            }
            buyGroupsCreated = expectedWalletData_raw.size;
            console.log(`[MIGRATE] Aggregated old buys into ${buyGroupsCreated} price groups (raw values).`);


            // --- 4. Fetch ALL Existing Wallets to check against ---
            console.log("[MIGRATE] Fetching existing wallets...");
            // Assuming fetchWallets helper or similar logic populates 'wallets' state used below is okay,
            // but for robustness, let's re-fetch here to ensure we have the absolute latest state before creating.
            const { data: existingDbWalletsData, errors: fetchErrors } = await client.models.StockWallet.list({
                filter: { portfolioStockId: { eq: stockId } },
                selectionSet: ['id', 'buyPrice', 'walletType'], // Only need these for checking
                limit: 1000 // Fetch up to 1000 (add pagination if more expected)
            });
            if (fetchErrors) throw fetchErrors;
            const existingDbWallets = existingDbWalletsData || [];
            const existingWalletMap = new Map<string, boolean>();
            existingDbWallets.forEach(w => {
                if (w.buyPrice != null && w.walletType) {
                    const priceKey = w.buyPrice.toFixed(4);
                    existingWalletMap.set(`${priceKey}_${w.walletType}`, true);
                }
            });
            console.log(`[MIGRATE] Found ${existingDbWallets.length} existing wallets.`);


            // --- 5. Iterate Aggregated Groups, ROUND values, and Create MISSING Wallets ---
            for (const [priceKey, rawData] of Array.from(expectedWalletData_raw.entries())) {
                const { buyPrice, expectedSwingShares_raw, expectedHoldShares_raw, expectedTotalInvestment_raw } = rawData;

                // --- Round the AGGREGATED values for this price group ---
                const roundedSwingShares = parseFloat(expectedSwingShares_raw.toFixed(SHARE_PRECISION));
                const roundedHoldShares = parseFloat(expectedHoldShares_raw.toFixed(SHARE_PRECISION));
                const roundedTotalInvestment = parseFloat(expectedTotalInvestment_raw.toFixed(CURRENCY_PRECISION));

                const finalSwingShares = (Math.abs(roundedSwingShares) < SHARE_EPSILON) ? 0 : roundedSwingShares;
                const finalHoldShares = (Math.abs(roundedHoldShares) < SHARE_EPSILON) ? 0 : roundedHoldShares;
                const finalTotalInvestment = (Math.abs(roundedTotalInvestment) < 0.001) ? 0 : roundedTotalInvestment; // Currency epsilon
                const finalTotalShares = finalSwingShares + finalHoldShares; // Sum of rounded parts
                // --- End Rounding ---


                // --- Recalculate & Round proportional investment split using FINAL rounded values ---
                let finalSwingInvestment = 0;
                let finalHoldInvestment = 0;
                if (finalTotalShares > SHARE_EPSILON && finalTotalInvestment > 0) {
                    finalSwingInvestment = (finalSwingShares / finalTotalShares) * finalTotalInvestment;
                    finalHoldInvestment = (finalHoldShares / finalTotalShares) * finalTotalInvestment;
                    // Adjust raw values slightly before rounding
                    if (Math.abs((finalSwingInvestment + finalHoldInvestment) - finalTotalInvestment) > 0.0001) {
                        finalHoldInvestment = finalTotalInvestment - finalSwingInvestment;
                    }
                    // Round the final split investment values
                    finalSwingInvestment = parseFloat(finalSwingInvestment.toFixed(CURRENCY_PRECISION));
                    finalHoldInvestment = parseFloat(finalHoldInvestment.toFixed(CURRENCY_PRECISION));
                }
                // Ensure final rounded splits sum exactly to final rounded total investment
                if(Math.abs((finalSwingInvestment + finalHoldInvestment) - finalTotalInvestment) > 0.001) {
                    console.warn(`Adjusting final investment split for price ${buyPrice} due to rounding.`);
                    finalHoldInvestment = finalTotalInvestment - finalSwingInvestment; // Assign remainder
                    // Re-round just in case
                    finalHoldInvestment = parseFloat(finalHoldInvestment.toFixed(CURRENCY_PRECISION));
                }
                // --- End Investment Split Rounding ---


                // +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
                // +++ CHANGE 1 START: TP Calculation moved here +++
                // Calculate TP Values ONCE per price group
                let tpValue_raw = null, tpPercent = null;
                let tpValue_final = null;
                if (typeof pdpValue === 'number' && typeof plrValue === 'number' && buyPrice) {
                    tpValue_raw = buyPrice + (buyPrice * (pdpValue * plrValue / 100));
                    tpPercent = pdpValue * plrValue; // This is the percentage value
                    tpValue_final = parseFloat(tpValue_raw.toFixed(CURRENCY_PRECISION)); // Round TP $ value
                    console.log(`[MIGRATE TP Calc for ${buyPrice}] PDP=${pdpValue}, PLR=${plrValue}, TP_Raw=${tpValue_raw}, TP%=${tpPercent}, TP_Final=${tpValue_final}`);
                } else {
                    console.log(`[MIGRATE TP Calc for ${buyPrice}] Skipped (Missing PDP/PLR/BuyPrice)`);
                }
                // +++ CHANGE 1 END +++
                // +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++


                // --- Check/Create SWING Wallet (using FINAL rounded values) ---
                if (finalSwingShares > SHARE_EPSILON) {
                    const swingMapKey = `${priceKey}_Swing`;
                    if (existingWalletMap.has(swingMapKey)) {
                        console.log(`[MIGRATE - Swing] Wallet exists for price ${buyPrice}. Skipping.`);
                        walletsSkipped++;
                    } else {
                        console.log(`[MIGRATE - Swing] Creating new wallet for price ${buyPrice}... Shares: ${finalSwingShares}, Inv: ${finalSwingInvestment}`);
                        try {
                            // Uses tpValue_final and tpPercent calculated above
                            const createPayload = {
                                portfolioStockId: stockId,
                                walletType: 'Swing' as const,
                                buyPrice: buyPrice,
                                totalSharesQty: finalSwingShares, // Use FINAL rounded value
                                totalInvestment: finalSwingInvestment, // Use FINAL rounded value
                                sharesSold: 0,
                                remainingShares: finalSwingShares, // Use FINAL rounded value
                                realizedPl: 0, sellTxnCount: 0,
                                tpValue: tpValue_final,    // Use calculated value
                                tpPercent: tpPercent,     // Use calculated value
                                realizedPlPercent: 0,
                            };
                            const { errors } = await client.models.StockWallet.create(createPayload as any);
                            if (errors) throw errors;
                            console.log(`[MIGRATE - Swing] Create SUCCESS`);
                            walletsCreated++;
                        } catch (err: any) {
                            console.error(`[MIGRATE - Swing] FAILED creation for price ${buyPrice}:`, err?.errors || err);
                            walletsFailed++;
                            if (!migrationError) setMigrationError(`Failed creating Swing wallet for price ${buyPrice}: ${err.message}`);
                        }
                    }
                }

                // --- Check/Create HOLD Wallet (using FINAL rounded values) ---
                if (finalHoldShares > SHARE_EPSILON) {
                    const holdMapKey = `${priceKey}_Hold`;
                    if (existingWalletMap.has(holdMapKey)) {
                        console.log(`[MIGRATE - Hold] Wallet exists for price ${buyPrice}. Skipping.`);
                        walletsSkipped++;
                    } else {
                        console.log(`[MIGRATE - Hold] Creating new wallet for price ${buyPrice}... Shares: ${finalHoldShares}, Inv: ${finalHoldInvestment}`);
                        try {
                            // +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
                            // +++ CHANGE 2 START: Update Hold Payload +++
                            // Uses tpValue_final and tpPercent calculated above
                            const createPayload = {
                                portfolioStockId: stockId,
                                walletType: 'Hold' as const,
                                buyPrice: buyPrice,
                                totalSharesQty: finalHoldShares, // Use FINAL rounded value
                                totalInvestment: finalHoldInvestment, // Use FINAL rounded value
                                sharesSold: 0,
                                remainingShares: finalHoldShares, // Use FINAL rounded value
                                realizedPl: 0, sellTxnCount: 0,
                                tpValue: tpValue_final,     // Use calculated value
                                tpPercent: tpPercent,      // Use calculated value
                                realizedPlPercent: 0,
                            };
                            // +++ CHANGE 2 END +++
                            // +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
                            const { errors } = await client.models.StockWallet.create(createPayload as any);
                            if (errors) throw errors;
                            console.log(`[MIGRATE - Hold] Create SUCCESS`);
                            walletsCreated++;
                        } catch (err: any) {
                            console.error(`[MIGRATE - Hold] FAILED creation for price ${buyPrice}:`, err?.errors || err);
                            walletsFailed++;
                            if (!migrationError) setMigrationError(`Failed creating Hold wallet for price ${buyPrice}: ${err.message}`);
                        }
                    }
                }
            } // End loop through aggregated buyGroups


            // --- 6. Set Final Status ---
            if (walletsFailed > 0) {
                setMigrationError(`Processed ${oldBuyTxnCount} txns (${buyGroupsCreated} groups). Created: ${walletsCreated}, Skipped: ${walletsSkipped}, Failed: ${walletsFailed}. Check console.`);
            } else if (walletsCreated > 0) {
                setMigrationSuccess(`Migration complete. ${walletsCreated} new wallets created, ${walletsSkipped} existing wallets skipped.`);
            } else {
                setMigrationSuccess(`Migration check complete. No new wallets needed, ${walletsSkipped} existing wallets skipped.`);
            }

            // --- 7. Refresh Wallet List ---
            console.log("[MIGRATE] Refreshing wallet list...");
            fetchWallets(); // Make sure fetchWallets is correctly defined and included in dependencies

        } catch (error: any) {
            console.error("[MIGRATE] Critical error during migration process:", error);
            const message = Array.isArray(error?.errors) ? error.errors[0].message : error.message;
            setMigrationError(message || "An unexpected error occurred during migration.");
        } finally {
            setIsMigrating(false);
        }
    }, [stockId, transactions, fetchWallets]); // Ensure all dependencies are correct

    // --- ADD Function to Fetch Transactions ---
    // Adapted from txns/[stockId]/add/page.tsx
    const fetchTransactions = useCallback(async () => {
        if (!stockId) return;
        console.log(`Workspaceing ALL transactions for stockId: [${stockId}] for Wallet Page`);
        setIsTxnLoading(true);
        setTxnError(null);
        setTransactions([]); // Clear previous

        // Fields needed for the simplified table and editing
        const selectionSetNeeded = [
            'id', 'date', 'action', 'signal', 'price',
            'investment',
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
                    limit: 100, // Adjust limit as needed
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

            console.log(`Finished fetching transactions for Wallet Page. Total: ${accumulatedTxns.length}`);
            setTransactions(accumulatedTxns);

        } catch (err: any) {
            console.error('Error fetching all transactions:', err);
            const errMsg = Array.isArray(err?.errors) ? err.errors[0].message : (err.message || 'Failed to load transactions.');
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
    console.log('Opening Edit modal for transaction:', transaction);
    setTxnToEdit(transaction);
    setIsEditModalOpen(true); // Open the EDIT modal
};

const handleCancelEditTxn = () => {
    setIsEditModalOpen(false);
    setTxnToEdit(null);
    // Clear any errors specific to the edit form if needed
};

// This is called by TransactionForm's onUpdate prop
const handleUpdateTransaction = async (updatedTxnDataFromForm: TransactionDataType & { id: string }) => {
    console.log('Attempting to update transaction via Edit modal:', updatedTxnDataFromForm);
    // Add loading state within the modal if desired
    // setEditError(null);
    try {
        // Assuming updatedTxnDataFromForm has the full structure needed
        const { data: updatedTxn, errors } = await client.models.Transaction.update(updatedTxnDataFromForm as any);

        if (errors) throw errors;

        console.log('Transaction updated successfully:', updatedTxn);
        setIsEditModalOpen(false); // Close EDIT modal
        setTxnToEdit(null);
        // --- REFRESH BOTH ---
        fetchTransactions();
        fetchWallets(); // Refresh wallets as Buy/Sell edits might affect them
        // --- END REFRESH ---

    } catch (err: any) {
        console.error('Error updating transaction:', err);
        const errorMessage = Array.isArray(err) ? err[0].message : (err.message || "Failed to update transaction.");
        // Display error within the edit modal?
        // setEditError(errorMessage);
        alert(`Update Failed: ${errorMessage}`); // Simple alert for now
    } finally {
        // Reset edit modal loading state if you added one
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

    console.log(`Attempting to delete empty wallet: ${walletId}`);
    setIsLoading(true); // Use main loading state or add specific delete loading state
    // Clear previous feedback using setFeedback from response #236 if you added it
    // setFeedback(null);

    try {
        const { errors } = await client.models.StockWallet.delete({ id: walletId });

        if (errors) throw errors;

        console.log(`Wallet ${walletId} deleted successfully.`);
        // Set success feedback using setFeedback if implemented
        // setFeedback({ type: 'success', message: `${walletType} wallet (Buy: ${formatCurrency(buyPrice)}) deleted.` });

        // Refresh the wallets list
        fetchWallets();

    } catch (err: any) {
        console.error(`Error deleting wallet ${walletId}:`, err);
        const errorMessage = Array.isArray(err?.errors) ? err.errors[0].message : (err.message || 'Failed to delete wallet.');
        // Set error feedback using setFeedback if implemented
         setError(`Delete Failed: ${errorMessage}`); // Use main error state for now
        // setFeedback({ type: 'error', message: `Delete Failed: ${errorMessage}` });
    } finally {
        setIsLoading(false);
    }
}, [stockId, fetchWallets]); // Add dependencies (stockId needed indirectly? fetchWallets needed)
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

    console.log(`Attempting to delete transaction: ${idToDelete}. Wallet linked: ${isWalletSell}`);
    setTxnError(null); // Clear previous table errors
    // Add a loading state specific to this row/operation if desired

    let walletUpdateError: string | null = null;
    let walletUpdateSuccess = false;

    try {
        let overallSuccess = true; // <<< ADD THIS LINE to track wallet update success
        let finalMessage = ""; // <<< ADD THIS LINE to accumulate warnings/messages
        
        // --- Step 1: Update Wallet Conditionally (BEFORE deleting transaction) ---
        if (isWalletSell) {
            console.log(`Updating wallet ${walletIdToUpdate} due to deleted sell txn ${idToDelete}`);
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

                console.log("Reverting wallet changes with payload:", walletUpdatePayload);
                const { errors: updateErrors } = await client.models.StockWallet.update(walletUpdatePayload);
                if (updateErrors) throw updateErrors; // Propagate update errors

                walletUpdateSuccess = true; // Mark wallet update as successful

            } catch (walletErr: any) {
                 console.error("Error updating wallet during transaction delete:", walletErr);
                 // Capture the error but allow transaction delete attempt to proceed
                 walletUpdateError = `Wallet update failed: ${Array.isArray(walletErr) ? walletErr[0].message : walletErr.message}`;
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
                console.warn("[Delete Buy] Cannot process wallet update: Invalid price or zero shares.");
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

                    console.log(`[Delete Buy - ${type}] Attempting wallet update. SharesToRemove: ${sharesToRemove}, InvToRemove: ${investmentToRemove}`);
                    try {
                        // Find wallet using client-side check
                        const { data: candidates, errors: listErrors } = await client.models.StockWallet.list({
                            filter: { and: [ { portfolioStockId: { eq: stockId } }, { walletType: { eq: type } } ] },
                            selectionSet: ['id', 'buyPrice', 'sharesSold', 'sellTxnCount', 'totalSharesQty', 'totalInvestment', 'remainingShares'],
                            limit: 500
                        });
                        if (listErrors) { throw listErrors; } // Propagate list errors

                        const walletToUpdate = (candidates || []).find(wallet => wallet.buyPrice != null && Math.abs(wallet.buyPrice - buyPrice) < epsilon );

                        if (!walletToUpdate) {
                            console.warn(`[Delete Buy - ${type}] Wallet not found for price ${buyPrice}. Cannot update.`);
                            finalMessage += ` | ${type} wallet (Price ${buyPrice}) not found.`;
                            return true; // Treat as non-failure for Txn deletion
                        }

                        // Check for sales
                        if ((walletToUpdate.sharesSold ?? 0) > epsilon || (walletToUpdate.sellTxnCount ?? 0) > 0) {
                            console.warn(`[Delete Buy - ${type}] Wallet ${walletToUpdate.id} has sales. Skipping update.`);
                            finalMessage += ` | ${type} wallet (Price ${buyPrice}) has sales, not reversed.`;
                            return true; // Allow Txn deletion, skip wallet update
                        }

                        // No sales - Update wallet (subtract values)
                        console.log(`[Delete Buy - ${type}] Applying reversal to wallet ${walletToUpdate.id}...`);
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
                        console.log(`[Delete Buy - ${type}] Wallet update successful.`);
                        return true; // Success

                    } catch (err: any) {
                        console.error(`[Delete Buy - ${type}] Helper FAILED:`, err?.errors || err);
                        finalMessage += ` | Error updating ${type} wallet: ${err.message}.`;
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
            console.log(`Proceeding to delete transaction ${idToDelete}`);
            const { errors: deleteErrors } = await client.models.Transaction.delete({ id: idToDelete });
            if (deleteErrors) throw deleteErrors; // Throw delete error if it occurs
            console.log('Transaction deleted successfully!');
            finalMessage = `Transaction deleted successfully.${finalMessage}`;
            setTxnError(null); // Clear any previous warnings if fully successful
            // You might want a success state here too: setTxnSuccess(finalMessage);
        } else {
             // Wallet logic failed, do not delete the transaction
             throw new Error(`Transaction NOT deleted due to critical errors updating associated wallets.${finalMessage}`);
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

    } catch (err: any) {
        // Catch errors from Transaction.delete or errors propagated from Wallet update/fetch
        console.error('Error during delete process:', err);
        const errorMessage = Array.isArray(err) ? err[0].message : (err.message || 'Failed to delete transaction.');
        // If wallet update succeeded but delete failed, we have inconsistent state! Log clearly.
        if (walletUpdateSuccess) {
             console.error("CRITICAL: Wallet was updated, but Transaction delete failed! Manual reconciliation needed.");
             setTxnError(`Wallet impact reversed, but FAILED TO DELETE transaction: ${errorMessage}`);
        } else {
            setTxnError(`Delete Failed: ${errorMessage}`); // General delete error
        }
    } finally {
        // --- Step 3: Refresh Both Lists regardless of outcome ---
        console.log("Refreshing wallets and transactions after delete attempt.");
        fetchTransactions();
        fetchWallets();
        // Reset loading state if applicable
    }
};
// --- END Edit/Delete Handlers ---


    // --- Fetch Stock Symbol for Title ---
    useEffect(() => {
        if (stockId) {
            //console.log(`Workspaceing symbol for stockId: ${stockId}`);
            client.models.PortfolioStock.get({ id: stockId }, { selectionSet: ['symbol'] })
                .then(({ data, errors }) => {
                    if (errors) {
                         console.error("Error fetching stock symbol:", errors);
                         setError(prev => prev ? `${prev} | Failed to fetch symbol.` : 'Failed to fetch symbol.');
                         setStockSymbol("Error");
                    } else if (data) {
                         setStockSymbol(data.symbol ?? "Unknown");
                    } else {
                         setStockSymbol("Not Found");
                    }
                }).catch(err => {
                     console.error("Error fetching stock symbol:", err);
                     setError(prev => prev ? `${prev} | Failed to fetch symbol.` : 'Failed to fetch symbol.');
                     setStockSymbol("Error");
                });
        } else {
            setStockSymbol(undefined);
        }
    }, [stockId]); // Dependency on stockId


    // Fetch wallet data when stockId changes or fetchWallets updates
    useEffect(() => {
        fetchWallets();
    }, [fetchWallets]); // fetchWallets dependency includes stockId

    // --- Client-Side Sorting Logic (Removed Symbol Sort) ---
    const sortedWallets = useMemo(() => {
        let sortableItems = [...wallets];
        if (sortConfig !== null) {
             sortableItems.sort((a, b) => {
                 // @ts-ignore - Allow index access for defined keys
                 let valA = a[sortConfig.key];
                 // @ts-ignore
                 let valB = b[sortConfig.key];

                 // Comparison logic (handle nulls to sort them last)
                 let comparison = 0;
                 const handleNulls = (val: any) => (val === null || val === undefined) ? (sortConfig.direction === 'ascending' ? Infinity : -Infinity) : val;

                 const resolvedA = handleNulls(valA);
                 const resolvedB = handleNulls(valB);

                 if (typeof resolvedA === 'string' && typeof resolvedB === 'string') {
                    comparison = resolvedA.localeCompare(resolvedB);
                 } else {
                    if (resolvedA < resolvedB) comparison = -1;
                    else if (resolvedA > resolvedB) comparison = 1;
                 }

                 return sortConfig.direction === 'ascending' ? comparison : comparison * -1;
             });
        } else {
            // Default sort: Buy Price ascending
            sortableItems.sort((a, b) => {
                const priceA = a.buyPrice ?? 0;
                const priceB = b.buyPrice ?? 0;
                return priceA - priceB;
            });
        }
        return sortableItems;
    }, [wallets, sortConfig]);

    // --- ADD Client-Side Filtering for Tabs ---
    const swingWallets = useMemo(() => {
        // Log the input array that's about to be filtered
        console.log(">>> Raw sortedWallets before Swing filter:", sortedWallets);

        // Perform the filter operation
        const filtered = sortedWallets.filter(w => w.walletType === 'Swing');

        // Log the result of the filtering
        console.log(">>> Filtered swingWallets RESULT:", filtered);

        // Return the filtered array
        return filtered;
    }, [sortedWallets]); // Dependency array remains the same

    const holdWallets = useMemo(() => {
        // You can optionally log the input here too, though it's the same sortedWallets
        // console.log(">>> Raw sortedWallets before Hold filter:", sortedWallets);

        // Perform the filter operation
        const filtered = sortedWallets.filter(w => w.walletType === 'Hold');

        // Log the result of the filtering
        console.log(">>> Filtered holdWallets RESULT:", filtered);

        // Return the filtered array
        return filtered;
    }, [sortedWallets]); // Dependency array remains the same
    // --- END Filtering Logic ---

    // --- ADD Txn Sorting Logic ---
    const requestTxnSort = (key: SortableTxnKey) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (txnSortConfig && txnSortConfig.key === key && txnSortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setTxnSortConfig({ key, direction });
    };

    const sortedTransactions = useMemo(() => {
        let sortableItems = [...transactions];
        if (txnSortConfig !== null) {
            sortableItems.sort((a, b) => {
                // @ts-ignore - Allow index access by key
                const valA = a[txnSortConfig.key];
                // @ts-ignore
                const valB = b[txnSortConfig.key];
                let comparison = 0;
                // Basic comparison, handle nulls simply
                if (valA === null || valA === undefined) comparison = -1;
                else if (valB === null || valB === undefined) comparison = 1;
                else if (valA < valB) comparison = -1;
                else if (valA > valB) comparison = 1;

                return txnSortConfig.direction === 'ascending' ? comparison : comparison * -1;
            });
        } else {
            // Default sort: Date descending
            sortableItems.sort((a, b) => (a.date < b.date ? 1 : -1));
        }
        return sortableItems;
    }, [transactions, txnSortConfig]);
    // --- END Txn Sorting Logic ---


    // Sort request handler
    const requestSort = (key: SortableWalletKey) => {
         let direction: 'ascending' | 'descending' = 'ascending';
         if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
             direction = 'descending';
         }
         setSortConfig({ key, direction });
    };
    // --- End Sorting Logic ---


    // --- START: Replace your existing Formatting Helpers with this block ---
    const formatCurrency = (value: number | null | undefined): string => {
        if (typeof value !== 'number') {
             return '-'; // Return '-' if value is not a number
        }
        // Return the formatted currency string
        return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    };

    const formatPercent = (value: number | null | undefined): string => {
        if (typeof value !== 'number') {
            return '-'; // Explicitly return string
        }
        // Returns formatted string with '%'
        return `${value.toFixed(2)}%`;
    };

     const formatShares = (value: number | null | undefined, decimals = 5): string => {
        if (typeof value !== 'number') {
            return '-'; // Explicitly return string
        }
        // Returns formatted string with fixed decimals
        return value.toFixed(decimals);
    };
    // --- END: Formatting Helpers ---

    // --- ADD FUNCTION to handle opening the modal ---
    const handleOpenSellModal = (wallet: StockWalletDataType) => {
        console.log("Opening sell modal for wallet:", wallet);
        setWalletToSell(wallet);
        // Reset form fields when opening
        setSellDate(getTodayDateString());
        setSellQuantity('');
        setSellPrice('');
        setSellError(null);
        setIsSelling(false);
        setSellSignal('Cust');
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
    
        console.log("Data in walletToSell at start of handleSellSubmit:", JSON.stringify(walletToSell, null, 2));
    
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
            // 1. Calculate raw P/L for this specific sale
            const realizedPlForSale = (price - buyPrice) * quantity;
    
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
            console.log("Updating StockWallet with payload:", walletPayload);
    
    
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
                 // Optionally add the rounded P/L for THIS specific transaction
                 // txnProfit: parseFloat(realizedPlForSale.toFixed(CURRENCY_PRECISION)),
            };
            console.log("Creating Transaction with payload:", transactionPayload);
    
    
            // --- Execute DB Operations ---
            const updatedWallet = await client.models.StockWallet.update(walletPayload);
            if (updatedWallet.errors) throw updatedWallet.errors;
    
            const newTransaction = await client.models.Transaction.create(transactionPayload);
            if (newTransaction.errors) throw newTransaction.errors;
    
            // --- Success ---
            console.log("Sell recorded successfully!", { updatedWallet: updatedWallet.data, newTransaction: newTransaction.data });
            setIsSellModalOpen(false);
            fetchWallets();
            fetchTransactions(); // Refresh relevant data
    
        } catch (err: any) {
            // --- Error Handling ---
            console.error("Error recording sell transaction:", err);
            const errorMessage = Array.isArray(err) ? err[0].message : (err.message || "An unknown error occurred.");
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

    // --- ADD HANDLERS for Buy Modal ---
    const handleOpenBuyModal = () => {
        setIsBuyModalOpen(true);
    };

    const handleCloseBuyModal = () => {
        setIsBuyModalOpen(false);
        // Optionally reset any related state if needed
    };

    // This function will be called by TransactionForm after a successful Buy
    const handleBuyAdded = () => {
        console.log("[StockWalletPage] handleBuyAdded callback triggered!");
        setIsBuyModalOpen(false); // Close the modal
        //await new Promise(resolve => setTimeout(resolve, 750));
        fetchWallets();
        fetchTransactions();
        // You might also need to refresh other data if the Buy impacts other calculations on the page
    };
    // --- END HANDLERS ---

    // --- Render Logic ---
    // Show loading indicator until stock symbol AND wallets are potentially loaded
     if (isLoading || stockSymbol === undefined) return <p>Loading wallet data...</p>;
     // Handle case where stockId was invalid / stock not found
     if (stockSymbol === "Not Found" || stockSymbol === "Error") {
        return <p style={{ color: 'orange' }}>Could not load wallets: Stock {stockSymbol}.</p>;
     }
     // Show specific fetch error for wallets
     if (error && !stockSymbol) return <p style={{ color: 'red' }}>Error: {error}</p>;

     console.log("[StockWalletPage Render] Component rendering. Wallets state length:", wallets.length, "Wallets state content:", wallets);

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h3>{stockSymbol?.toUpperCase()}</h3>
                {/* --- ADD BUTTON --- */}
                <button onClick={handleOpenBuyModal} style={{ padding: '8px 15px' }}>
                    Add Buy Transaction
                </button>
                {/* --- END BUTTON --- */}

                {/* --- ADD MIGRATION BUTTON --- */}
                <button
                    onClick={handleMigrateBuysToWallets} // We will create this function next
                    disabled={isMigrating || isLoading || isTxnLoading} // Disable while loading/migrating
                    style={{ padding: '5px 10px', fontSize: '0.8em' }}
                 >
                    {isMigrating ? 'Processing...' : 'Generate Wallets from Buys'}
                 </button>
                 {/* --- END MIGRATION BUTTON --- */}
            </div>

            {/* Display Migration Feedback */}
            {migrationError && <p style={{ color: 'red', fontSize: '0.9em' }}>Migration Error: {migrationError}</p>}
             {migrationSuccess && <p style={{ color: 'lightgreen', fontSize: '0.9em' }}>{migrationSuccess}</p>}

            <h3>Wallets</h3>

            {/* --- ADD TABS --- */}
             <div style={{ marginBottom: '1rem', borderBottom: '1px solid #555', paddingBottom: '0.5rem' }}>
                <button
                    onClick={() => setActiveTab('Swing')}
                    style={{
                        padding: '8px 15px', marginRight: '10px', cursor: 'pointer',
                        border: 'none', borderBottom: activeTab === 'Swing' ? '2px solid lightblue' : '2px solid transparent',
                        background: 'none', color: activeTab === 'Swing' ? 'lightblue' : 'inherit',
                        fontSize: '1em'
                    }}
                >
                    Swing ({swingWallets.length})
                </button>
                <button
                    onClick={() => setActiveTab('Hold')}
                     style={{
                        padding: '8px 15px', cursor: 'pointer',
                        border: 'none', borderBottom: activeTab === 'Hold' ? '2px solid lightgreen' : '2px solid transparent',
                        background: 'none', color: activeTab === 'Hold' ? 'lightgreen' : 'inherit',
                        fontSize: '1em'
                    }}
                >
                    Hold ({holdWallets.length})
                </button>
             </div>
             {/* --- END TABS --- */}
            
            {error && <p style={{ color: 'red' }}>Error loading wallets: {error}</p>}

            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem', fontSize: '0.8em' }}>
                <thead>
                    <tr style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>
                        {/* --- Removed Symbol Header --- */}
                        <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestSort('buyPrice')}>
                            Buy Price {sortConfig?.key === 'buyPrice' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
                        </th>
                        <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestSort('totalInvestment')}>
                            Inv {sortConfig?.key === 'totalInvestment' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
                        </th>
                        <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestSort('totalSharesQty')}>
                            Shares {sortConfig?.key === 'totalSharesQty' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
                        </th>
                        <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestSort('tpValue')}>
                            TP ($) {sortConfig?.key === 'tpValue' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
                        </th>
                        {/* <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestSort('tpPercent')}>
                            TP (%) {sortConfig?.key === 'tpPercent' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
                        </th> */}
                        <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestSort('sellTxnCount')}>
                            Sells {sortConfig?.key === 'sellTxnCount' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
                        </th>
                        <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestSort('sharesSold')}>
                            Shs Sold {sortConfig?.key === 'sharesSold' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
                        </th>
                        <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestSort('realizedPl')}>
                            P/L ($) {sortConfig?.key === 'realizedPl' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
                        </th>
                        <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestSort('realizedPlPercent')}>
                            P/L (%) {sortConfig?.key === 'realizedPlPercent' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
                        </th>
                        <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestSort('remainingShares')}>
                            Shs Left {sortConfig?.key === 'remainingShares' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
                        </th>
                        <th style={{ padding: '5px' }}>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {/* Check if the selected filtered list is empty */}
                    {(activeTab === 'Swing' ? swingWallets : holdWallets).length === 0 ? (
                        <tr>
                            <td colSpan={11} style={{ textAlign: 'center', padding: '1rem' }}>
                                No {activeTab} wallets found for this stock.
                            </td>
                        </tr>
                    ) : (
                        // Map ONLY over the selected filtered list (swingWallets or holdWallets)
                        (activeTab === 'Swing' ? swingWallets : holdWallets).map((wallet, index) => (
                           // Directly return the table row for the current 'wallet'
                           <tr
                                key={wallet.id}
                                style={{
                                    backgroundColor: index % 2 !== 0 ? '#151515' : 'transparent',
                                }}
                           >
                                {/* Render cells using the 'wallet' object from the filtered list */}
                                <td style={{ padding: '5px' }}>{formatCurrency(wallet.buyPrice)}</td>
                                <td style={{ padding: '5px' }}>{formatCurrency(wallet.totalInvestment)}</td>
                                <td style={{ padding: '5px' }}>{formatShares(wallet.totalSharesQty)}</td>
                                <td style={{ padding: '5px' }}>{formatCurrency(wallet.tpValue)}</td>
                                {/* <td style={{ padding: '5px' }}>{formatPercent(wallet.tpPercent)}</td> */}
                                <td style={{ padding: '5px' }}>{wallet.sellTxnCount ?? 0}</td>
                                <td style={{ padding: '5px' }}>{formatShares(wallet.sharesSold)}</td>
                                <td style={{ padding: '5px' }}>{formatCurrency(wallet.realizedPl)}</td>
                                <td style={{ padding: '5px' }}>{formatPercent(wallet.realizedPlPercent)}</td>
                                <td style={{ padding: '5px' }}>{formatShares(wallet.remainingShares)}</td>
                                <td style={{ padding: '5px', textAlign: 'center' }}>
                                    {/* Sell button logic using the correct 'wallet' */}
                                    {wallet.remainingShares && wallet.remainingShares > 0 ? (
                                        <button
                                            onClick={() => handleOpenSellModal(wallet)}
                                            style={{
                                                background: 'none', border: 'none', cursor: 'pointer',
                                                padding: '5px', color: '#28a745', fontSize: '1.1em'
                                            }}
                                            title={`Sell from Wallet (Buy Price: ${formatCurrency(wallet.buyPrice)})`}
                                            disabled={!wallet.remainingShares || wallet.remainingShares <= 0}
                                        >
                                            <FaDollarSign />
                                        </button>
                                    ) : (
                                        '' // Show '-' if no remaining shares
                                    )}

                                    {/* --- ADD DELETE BUTTON --- */}
                                    {wallet.remainingShares === 0 ? (
                                        <button
                                            onClick={() => handleDeleteWallet(wallet)} // <<< Call new handler
                                            // Enable only if remaining shares are effectively zero
                                            disabled={(wallet.remainingShares ?? 0) > 0.000001}
                                            title={ (wallet.remainingShares ?? 0) > 0.000001 ? "Delete disabled (shares remain)" : `Delete Empty ${wallet.walletType} Wallet` }
                                            style={{
                                                background: 'none', border: 'none', cursor: 'pointer',
                                                padding: '5px', marginLeft: '8px', // Add some space
                                                // Grey out when disabled, make red when enabled?
                                                color: 'gray', // Grey or Red
                                                fontSize: '1.1em'
                                            }}
                                        >
                                            <FaTrashAlt />
                                        </button>
                                    ) : (
                                        '' // Show '-' if no remaining shares
                                    )}
                                    {/* --- END DELETE BUTTON --- */}
                                </td>
                           </tr>
                        )) // End map over the CORRECT list
                    )}
                </tbody>
            </table>
        
            {isSellModalOpen && walletToSell && (
                <div style={modalOverlayStyle}> {/* Outer overlay div */}
                    <div style={modalContentStyle}> {/* Modal content container */}
                        {/* Wrap content in a form */}
                        <form onSubmit={handleSellSubmit}>
                            <h3>Sell Shares from Wallet</h3>
                            {/* Stock/Buy Price Info */}
                            <p style={{ marginBottom: '15px' }}>Stock: <strong>{stockSymbol?.toUpperCase()}</strong> | Buy Price: <strong>{formatCurrency(walletToSell.buyPrice)}</strong></p>

                            {/* Display Error */}
                            {sellError && <p style={{ color: 'red', /*...*/ }}>{sellError}</p>}

                            {/* Form Fields: Date, Quantity, Price */}
                            <div style={formGroupStyle}>
                                <label htmlFor="sellDate" style={labelStyle}>Sell Date:</label>
                                <input id="sellDate" type="date" value={sellDate} onChange={(e) => setSellDate(e.target.value)} required disabled={isSelling} style={inputStyle} />
                            </div>
                            <div style={formGroupStyle}>
                                <label htmlFor="sellQuantity" style={labelStyle}>Quantity:</label>
                                <input id="sellQuantity" type="number" /*...*/ value={sellQuantity} onChange={(e) => setSellQuantity(e.target.value)} required disabled={isSelling} style={inputStyle} />
                            </div>
                            <div style={formGroupStyle}>
                                <label htmlFor="sellPrice" style={labelStyle}>Sell Price ($):</label>
                                <input id="sellPrice" type="number" /*...*/ value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} required disabled={isSelling} style={inputStyle} />
                            </div>
                            <div style={formGroupStyle}>
                                <label htmlFor="sellSignal" style={labelStyle}>Signal:</label>
                                <select
                                    id="sellSignal"
                                    value={sellSignal ?? ''} // Handle undefined state
                                    onChange={(e) => setSellSignal(e.target.value as Schema['Transaction']['type']['signal'] || undefined)}
                                    required // Make signal required for sell
                                    disabled={isSelling}
                                    style={inputStyle} // Reuse input style or create new
                                >
                                    <option value="">-- Select Signal --</option>
                                    <option value="Cust">Cust</option>
                                    <option value="TP">TP</option>
                                    {/* <option value="TPH">TPH</option>
                                    <option value="TPP">TPP</option> */}
                                </select>
                            </div>
                            {/* End Form Fields */}

                            {/* Action Buttons */}
                            <div style={{ display: 'flex', /*...*/ }}>
                                <button type="button" onClick={handleCancelSell} disabled={isSelling}>Cancel</button>
                                <button type="submit" disabled={isSelling || !sellQuantity || !sellPrice || !sellDate}>
                                    {isSelling ? 'Selling...' : 'Confirm Sale'}
                                </button>
                            </div>
                        </form>
                    </div> 
                </div>
            )}

            {isBuyModalOpen && (
                <div style={modalOverlayStyle}> {/* Reuse styles */}
                    <div style={{ ...modalContentStyle, minWidth: '400px' }}> {/* Slightly wider? */}
                        <h3>Add Buy Transaction</h3>
                        <p style={{ marginTop: '-5px', marginBottom: '20px' }}>Stock: <strong>{stockSymbol?.toUpperCase()}</strong></p>

                        {/* Render the TransactionForm configured for Buy */}
                        <TransactionForm
                            portfolioStockId={stockId} // Pass current stock ID
                            portfolioStockSymbol={stockSymbol} // Pass current symbol
                            forceAction="Buy" // Lock the action to Buy
                            onTransactionAdded={handleBuyAdded} // Refresh list on success
                            showCancelButton={true} // Show the cancel button
                            onCancel={handleCloseBuyModal} // Handle cancellation
                            // Do not pass edit mode props (isEditMode, initialData, onUpdate)
                        />

                    </div>
                </div>
            )}

            <div style={{ marginTop: '3rem', borderTop: '1px solid #ccc', paddingTop: '1.5rem' }}>
                <h3>Transaction</h3>

                {/* Loading/Error Display */}
                {isTxnLoading && <p>Loading transaction history...</p>}
                {txnError && <p style={{ color: 'red' }}>Error loading transactions: {txnError}</p>}

                {/* Transaction Table */}
                {!isTxnLoading && !txnError && (
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem', fontSize: '0.8em' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>
                                {/* Simplified Columns */}
                                <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestTxnSort('date')}>Date</th>
                                <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestTxnSort('action')}>Txn</th>
                                <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestTxnSort('txnType')}>Type</th>
                                <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestTxnSort('signal')}>Signal</th>
                                <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestTxnSort('price')}>Price</th>
                                <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestTxnSort('investment')}>Inv</th>
                                <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestTxnSort('quantity')}>Quantity</th>
                                <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestTxnSort('lbd')}>LBD</th>
                                <th style={{ padding: '5px' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedTransactions.length === 0 ? (
                                <tr>
                                    <td colSpan={9} style={{ textAlign: 'center', padding: '1rem' }}> {/* Adjust colspan */}
                                        No transactions found for this stock.
                                    </td>
                                </tr>
                            ) : (
                                sortedTransactions.map((txn, index) => (
                                    <tr
                                        key={txn.id}
                                        style={{
                                            backgroundColor: index % 2 !== 0 ? '#151515' : 'transparent',
                                        }}
                                    >
                                        <td style={{ padding: '5px' }}>{txn.date}</td>
                                        <td style={{ padding: '5px' }}>{txn.action}</td>
                                        <td style={{ padding: '5px' }}>{txn.txnType ?? '-'}</td>
                                        <td style={{ padding: '5px' }}>{txn.signal ?? '-'}</td>
                                        <td style={{ padding: '5px' }}>{formatCurrency(txn.price)}</td>
                                        {/* Show investment only if Buy/Div */}
                                        <td style={{ padding: '5px' }}>{txn.action !== 'Sell' ? formatCurrency(txn.investment) : '-'}</td>
                                        <td style={{ padding: '5px' }}>{formatShares(txn.quantity)}</td>
                                        {/* Show LBD only if Buy */}
                                        <td style={{ padding: '5px' }}>{txn.action === 'Buy' ? formatCurrency(txn.lbd) : '-'}</td>
                                        <td style={{ padding: '5px', textAlign: 'center' }}>
                                            <button onClick={() => handleEditTxnClick(txn)} title="Edit Transaction" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '5px', color: 'gray', marginRight: '5px' }}><FaEdit /></button>
                                            <button onClick={() => handleDeleteTransaction(txn)} title="Delete Transaction" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '5px', color: 'gray' }}><FaTrashAlt /></button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            {isEditModalOpen && txnToEdit && (
                <div style={modalOverlayStyle}> {/* Reuse styles */}
                    <div style={{ ...modalContentStyle, minWidth: '400px' }}>
                        {/* Render TransactionForm configured for Edit mode */}
                        <TransactionForm
                            isEditMode={true}
                            initialData={txnToEdit}
                            onUpdate={handleUpdateTransaction}
                            onCancel={handleCancelEditTxn}
                            portfolioStockId={stockId}
                            portfolioStockSymbol={stockSymbol}
                            showCancelButton={true}
                        />
                    </div>
                </div>
            )}
        
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