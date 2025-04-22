// app/(authed)/wallets/[stockId]/page.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
// Import useParams to get ID from URL
import { useParams } from 'next/navigation';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource'; // Adjust path if needed
import TransactionForm from '@/app/components/TransactionForm';
import { FaEdit, FaTrashAlt, FaDollarSign } from 'react-icons/fa';
//import type { GraphQLError } from 'graphql';
import { usePrices } from '@/app/contexts/PriceContext';
//import { DiVim } from 'react-icons/di';

// Define the type for the fetched wallet data (no longer needs nested stock)
type StockWalletDataType = Schema['StockWallet']['type'];

// Define the keys we can sort the table by (removed 'symbol')
type SortableWalletKey = 'buyPrice' | 'totalInvestment' | 'totalSharesQty' | 'tpValue' | 'tpPercent' | 'sharesSold' | 
    'realizedPl' | 'realizedPlPercent' | 'remainingShares' | 'sellTxnCount';

//type TransactionItem = Schema['Transaction']; // Already likely defined
type TransactionDataType = Schema['Transaction']['type']; // Already likely defined
type TransactionListResultType = Awaited<ReturnType<typeof client.models.Transaction.list>>;

const client = generateClient<Schema>();

// Helper function to get today's date in YYYY-MM-DD format
const getTodayDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export default function StockWalletPage() {
    // --- Get stockId from URL ---
    const params = useParams();
    const stockId = params.stockId as string; // Get stockId from dynamic route

    //const { latestPrices } = usePrices(); // Add pricesLoading, pricesError if you want to display their states

    // --- State for Stock Symbol (for Title) ---
    const [stockSymbol, setStockSymbol] = useState<string | undefined>(undefined);
    const [name, setStockName] = useState<string | undefined>(undefined);

    const [stockBudget, setStockBudget] = useState<number | null | undefined>(undefined); // undefined: not loaded, null: no budget set, number: budget value

    const [activeTab, setActiveTab] = useState<'Swing' | 'Hold'>('Swing');

    // State for fetched wallet data for THIS stock
    const [wallets, setWallets] = useState<StockWalletDataType[]>([]);
    // State for loading and error status
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    // State for table sorting
    const [sortConfig, setSortConfig] = useState<{ key: SortableWalletKey; direction: 'ascending' | 'descending' } | null>(null);

    const { latestPrices, pricesLoading, pricesError, lastPriceFetchTimestamp } = usePrices(); // <<< Ensure lastPriceFetchTimestamp is included

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

    const [stockPdp, setStockPdp] = useState<number | null | undefined>(undefined);
    const [stockShr, setStockShr] = useState<number | null | undefined>(undefined); // Swing-Hold Ratio
    const [stockPlr, setStockPlr] = useState<number | null | undefined>(undefined);

    const [isBuyModalOpen, setIsBuyModalOpen] = useState(false);

    const SHARE_PRECISION = 5; // Or your desired share precision
    const CURRENCY_PRECISION = 2; // Standard for currency
    const PERCENT_PRECISION = 4; // Precision for percentages (adjust as needed)
    // Epsilon for checking closeness to zero, based on share precision
    const SHARE_EPSILON = 1 / (10**(SHARE_PRECISION + 2)); // e.g., 0.0000001 for 5 decimal places

    const [isOverviewExpanded, setIsOverviewExpanded] = useState(false); // Collapsed by default

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
                
                // +++ ADD SORTING LOGIC HERE +++
                fetchedData.sort((a, b) => {
                        // Handle null/undefined tpValue - place them at the end
                        const tpA = a.tpValue ?? Infinity;
                        const tpB = b.tpValue ?? Infinity;
                        return tpA - tpB; // Ascending sort (lowest TP first)
                });
                // +++ END SORTING LOGIC +++

                setWallets(fetchedData as StockWalletDataType[]);
    
            } catch (err: any) {
                console.error("[fetchWallets] Error fetching stock wallets:", err);
                const message = Array.isArray(err?.errors) ? err.errors[0].message : err.message;
                setError(message || "Failed to fetch wallet data.");
                setWallets([]);
            } finally {
                setIsLoading(false);
            }
    }, [stockId]); // <<< ADD stockId dependency

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
            client.models.PortfolioStock.get(
                { id: stockId }, 
                { selectionSet: ['symbol', 'name', 'budget', 'pdp', 'swingHoldRatio', 'plr'] })
                .then(({ data, errors }) => {
                    if (errors) {
                        console.error("Error fetching stock symbol:", errors);
                        setError(prev => prev ? `${prev} | Failed to fetch symbol.` : 'Failed to fetch symbol.');
                        setStockSymbol("Error");
                        setStockName("Error");
                        setStockBudget(null);
                        setStockPdp(null);
                        setStockShr(null);
                        setStockPlr(null);
                    } else if (data) {
                        setStockSymbol(data.symbol ?? "Unknown");
                        setStockName(data.name ?? "Unknown");
                        setStockBudget(data.budget);
                        setStockPdp(data.pdp);       // <<< Set PDP state
                        setStockShr(data.swingHoldRatio); // <<< Set SHR state
                        setStockPlr(data.plr);       // <<< Set PLR state
                    } else {
                        setStockSymbol("Not Found");
                        setStockName("Not Found");
                        setStockBudget(null);
                        setStockPdp(null); // Set related state to null if not found
                        setStockShr(null);
                        setStockPlr(null);
                    }
                }).catch(err => {
                    console.error("Error fetching stock symbol:", err);
                    setError(prev => prev ? `${prev} | Failed to fetch symbol.` : 'Failed to fetch symbol.');
                    setStockSymbol("Error");
                    setStockName("Error");
                    setStockBudget(null);
                    setStockPdp(null); // Set related state to null on catch
                    setStockShr(null);
                    setStockPlr(null);
                });
        } else {
            setStockSymbol(undefined);
            setStockName(undefined);
            setStockBudget(undefined);
            setStockPdp(undefined);
            setStockShr(undefined);
            setStockPlr(undefined);
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

    // --- UPDATED P/L Calculation Memo (Method 2: Total P/L / Total Cost Basis) ---
    const plStats = useMemo(() => {
        // Need both transactions and wallets for this calculation
        if (!transactions || !wallets) {
            return {
                totalSwingPlDollars: 0, avgSwingPlPercent: null,
                totalHoldPlDollars: 0, avgHoldPlPercent: null,
                totalStockPlDollars: 0, avgStockPlPercent: null
            };
        }

        // 1. Create a Wallet Map for efficient buyPrice lookup
        const walletBuyPriceMap = new Map<string, number>(); // Map<walletId, buyPrice>
        wallets.forEach(w => {
            if (w.id && typeof w.buyPrice === 'number') {
                walletBuyPriceMap.set(w.id, w.buyPrice);
            }
        });

        // 2. Initialize aggregators
        let totalSwingPlDollars = 0;
        let totalSwingCostBasis = 0;
        let totalHoldPlDollars = 0;
        let totalHoldCostBasis = 0;
        let warnings = 0;

        // 3. Iterate through ALL transactions to find Sells and aggregate
        transactions.forEach(txn => {
            if (txn.action === 'Sell' && txn.completedTxnId && typeof txn.quantity === 'number' && typeof txn.price === 'number') {
                const walletBuyPrice = walletBuyPriceMap.get(txn.completedTxnId);

                // Check if we found the wallet and its buy price
                if (typeof walletBuyPrice === 'number') {
                    const costBasisForTxn = walletBuyPrice * txn.quantity;
                    const profitForTxn = (txn.price - walletBuyPrice) * txn.quantity; // Recalculate for accuracy here

                    // Aggregate based on txnType
                    if (txn.txnType === 'Swing') {
                        totalSwingPlDollars += profitForTxn;
                        totalSwingCostBasis += costBasisForTxn;
                    } else if (txn.txnType === 'Hold') {
                        totalHoldPlDollars += profitForTxn;
                        totalHoldCostBasis += costBasisForTxn;
                    } else {
                        // Handle sells with missing/unexpected txnType if necessary
                        console.warn(`Sell transaction ${txn.id} has unexpected/missing txnType: ${txn.txnType}`);
                        warnings++;
                    }
                } else {
                    console.warn(`Could not find wallet buy price for Sell transaction ${txn.id} (linked wallet ID: ${txn.completedTxnId}). Cannot include in P/L % calculation.`);
                    warnings++;
                    // Optionally, still add its profit to the dollar totals if txnProfit exists?
                    // if (txn.txnType === 'Swing') totalSwingPlDollars += (txn.txnProfit ?? 0);
                    // if (txn.txnType === 'Hold') totalHoldPlDollars += (txn.txnProfit ?? 0);
                }
            }
        });

        // 4. Calculate final averages (handle division by zero)
        const avgSwingPlPercent = (totalSwingCostBasis !== 0)
            ? (totalSwingPlDollars / totalSwingCostBasis) * 100
            : (totalSwingPlDollars === 0 ? 0 : null); // If cost is 0, % is 0 only if P/L is also 0

        const avgHoldPlPercent = (totalHoldCostBasis !== 0)
            ? (totalHoldPlDollars / totalHoldCostBasis) * 100
            : (totalHoldPlDollars === 0 ? 0 : null);

        const totalStockPlDollars = totalSwingPlDollars + totalHoldPlDollars;
        const totalStockCostBasis = totalSwingCostBasis + totalHoldCostBasis;
        const avgStockPlPercent = (totalStockCostBasis !== 0)
            ? (totalStockPlDollars / totalStockCostBasis) * 100
            : (totalStockPlDollars === 0 ? 0 : null);

        // 5. Round final values
        const roundedTotalSwingPl = parseFloat(totalSwingPlDollars.toFixed(CURRENCY_PRECISION));
        const roundedTotalHoldPl = parseFloat(totalHoldPlDollars.toFixed(CURRENCY_PRECISION));
        const roundedTotalStockPl = parseFloat(totalStockPlDollars.toFixed(CURRENCY_PRECISION));

        const finalAvgSwingPlPercent = typeof avgSwingPlPercent === 'number'
            ? parseFloat(avgSwingPlPercent.toFixed(PERCENT_PRECISION))
            : null;
        const finalAvgHoldPlPercent = typeof avgHoldPlPercent === 'number'
            ? parseFloat(avgHoldPlPercent.toFixed(PERCENT_PRECISION))
            : null;
        const finalAvgStockPlPercent = typeof avgStockPlPercent === 'number'
            ? parseFloat(avgStockPlPercent.toFixed(PERCENT_PRECISION))
            : null;

        if (warnings > 0) {
            console.warn(`[plStats] Calculation finished with ${warnings} warnings (missing data). Results might be incomplete.`);
        }

        return {
            totalSwingPlDollars: roundedTotalSwingPl,
            avgSwingPlPercent: finalAvgSwingPlPercent,
            totalHoldPlDollars: roundedTotalHoldPl,
            avgHoldPlPercent: finalAvgHoldPlPercent,
            totalStockPlDollars: roundedTotalStockPl,
            avgStockPlPercent: finalAvgStockPlPercent
        };

    }, [transactions, wallets]); // <<< Now depends on BOTH transactions and wallets
    // --- End UPDATED P/L Calc Memo ---

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

    const totalTiedUpInvestment = useMemo(() => {
        // Ensure wallets data is loaded
        if (!wallets || wallets.length === 0) {
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

    
    // --- ADD Memo for Total SWING YTD P/L Calculation ---
// --- UPDATED Memo for Total SWING YTD P/L ($ and %) ---
const totalSwingYtdPL = useMemo(() => {
    console.log("[Memo] Calculating totalSwingYtdPL ($ and %)");
    // Depends on transactions, wallets, price data
    if (!transactions || !wallets || !stockSymbol) {
        return { dollars: null, percent: null }; // Return object for consistency
    }

    // --- Create Wallet Map INSIDE this hook ---
    console.log("[Memo] Creating internal wallet buy price map for YTD calc");
    const walletBuyPriceMap = new Map<string, number>(); // Map<walletId, buyPrice>
    wallets.forEach(w => {
        // Ensure wallet has an ID and a valid buy price number
        if (w.id && typeof w.buyPrice === 'number') {
            walletBuyPriceMap.set(w.id, w.buyPrice);
        }
    });
    console.log(`[Memo] Internal map created with ${walletBuyPriceMap.size} entries.`);
    // --- End Wallet Map ---

    const currentYear = new Date().getFullYear();
    const startOfYear = `${currentYear}-01-01`;
    const currentPrice = latestPrices[stockSymbol]?.currentPrice ?? null;

    let ytdRealizedSwingPL = 0;
    let currentUnrealizedSwingPL = 0;
    let currentSwingCostBasis = 0; // <<< ADDED: Accumulator for cost basis
    let warnings = 0;

    // --- Calculate YTD Realized P/L for SWING Sells ---
    transactions.forEach(txn => {
        if (txn.action === 'Sell' && txn.txnType === 'Swing' &&
            txn.date && txn.date >= startOfYear && txn.completedTxnId &&
            typeof txn.quantity === 'number' && typeof txn.price === 'number') {
            const walletBuyPrice = walletBuyPriceMap.get(txn.completedTxnId);
            if (typeof walletBuyPrice === 'number') {
                const profitForTxn = (txn.price - walletBuyPrice) * txn.quantity;
                ytdRealizedSwingPL += profitForTxn;
            } else {
                // Wallet link or buy price was missing for a YTD Swing Sell
                warnings++;
                console.warn(`[Swing YTD P/L] Could not find wallet buy price for YTD Swing Sell Txn ${txn.id}`);
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
       console.warn("[Swing YTD P/L] Cannot calculate P/L: Current price unavailable.");
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
         console.warn(`[Swing YTD P/L] Calculation finished with ${warnings} warnings (missing data). Realized P/L part might be incomplete.`);
    }

    console.log(`[Swing YTD P/L] $,%: ${roundedTotalPL_dollars}, ${roundedPercent}% (Basis: ${currentSwingCostBasis.toFixed(2)})`);

    // Return object with both values
    return {
        dollars: roundedTotalPL_dollars,
        percent: roundedPercent
    };

// Correct dependencies for this specific calculation
}, [transactions, wallets, latestPrices, stockSymbol]); // Removed walletBuyPriceMap as it's internal now
// --- End Total Swing YTD P/L Calc Memo ---

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
        console.log("Opening sell modal for wallet:", wallet);
        setWalletToSell(wallet);
        // Reset form fields when opening
        setSellDate(getTodayDateString());
        setSellQuantity('');
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
                txnProfit: roundedTxnPl,             // Add rounded P/L $ for THIS txn
                txnProfitPercent: roundedTxnPlPercent
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
     
    const currentStockPriceForOverview = latestPrices[stockSymbol ?? '']?.currentPrice;

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div>
                    <p style={{ fontSize: '1.5em' }}>{name} ({stockSymbol?.toUpperCase()})</p>
                    <p style={{ fontSize: '1.2em' }}>
                        {typeof currentStockPriceForOverview === 'number'
                            ? formatCurrency(currentStockPriceForOverview)
                            : (pricesLoading ? 'Loading...' : 'N/A') // Show loading or N/A
                        }
                    </p>
                </div>         
                
                <button onClick={handleOpenBuyModal} style={{ padding: '8px 15px' }}>Add Buy Transaction</button>
            </div>

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
                        {stockBudget === undefined || stockPdp === undefined || stockShr === undefined || stockPlr === undefined ? (
                            <p>Loading details...</p>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0px 15px', marginTop: '10px' }}>
                                {/* Column 1 */}
                                <div>
                                    <p style={{ fontWeight: 'bold', fontSize: '1.1em' }}>Settings</p>
                                    
                                    <p style={{ fontWeight: 'bold', marginTop: '10px' }}>Annual budget</p>
                                    <p>{typeof stockBudget === 'number' ? formatCurrency(stockBudget) : 'Not set'}</p>

                                    <p style={{ fontWeight: 'bold', marginTop: '10px' }}>Budget available</p>
                                    <p>{typeof stockBudget === 'number' ? formatCurrency(stockBudget - totalTiedUpInvestment) : 'N/A'}</p>

                                    <p style={{ fontWeight: 'bold', marginTop: '10px' }}>Price Dip Percent (PDP)</p>
                                    <p>{typeof stockPdp === 'number' ? `${stockPdp}%` : 'Not set'}</p>

                                    <p style={{ fontWeight: 'bold', marginTop: '10px' }}>Swing-Hold Ratio (SHR)</p>
                                    <p>{typeof stockShr === 'number' ? `${stockShr}% Swing` : 'Not set'}</p>

                                    <p style={{ fontWeight: 'bold', marginTop: '10px' }}>Profit-Loss Ratio (PLR)</p>
                                    <p>{typeof stockPlr === 'number' ? stockPlr : 'Not set'}</p>                                    
                                </div>

                                {/* Column 2 */}
                                <div>
                                    <p style={{ fontWeight: 'bold', fontSize: '1.1em' }}>Transactions</p>
                                    
                                    <p style={{ fontWeight: 'bold', marginTop: '10px' }}>Total Buys</p>
                                    <p>{transactionCounts.buys}</p>
                                    
                                    <p style={{ fontWeight: 'bold', marginTop: '10px' }}>Swing Sells</p>
                                    <p>{transactionCounts.swingSells}</p>
                                    
                                    <p style={{ fontWeight: 'bold', marginTop: '10px' }}>Hold Sells</p>
                                    <p>{transactionCounts.holdSells}</p>
                                    
                                    <p style={{ fontWeight: 'bold', marginTop: '10px' }}>Total Sells</p>
                                    <p>{transactionCounts.totalSells}</p>
                                    
                                    <p style={{ fontWeight: 'bold', marginTop: '30px' }}>Swing shares</p>
                                    <p>{formatShares(currentShares.swing)}</p>

                                    <p style={{ fontWeight: 'bold', marginTop: '10px' }}>Hold shares</p>
                                    <p>{formatShares(currentShares.hold)}</p>

                                    <p style={{ fontWeight: 'bold', marginTop: '10px' }}>Total shares</p>
                                    <p>{formatShares(currentShares.total)}</p>
                                </div>

                                <div>
                                    <p style={{ fontWeight: 'bold', fontSize: '1.1em' }}>Realized P/L</p>

                                    <p style={{ fontWeight: 'bold', marginTop: '10px' }}>Swing P/L</p>
                                    <p>{formatCurrency(plStats.totalSwingPlDollars)}</p>

                                    <p style={{ fontWeight: 'bold', marginTop: '10px' }}>Swing P/L Avg (%)</p>
                                    <p>{formatPercent(plStats.avgSwingPlPercent)}</p>

                                    <p style={{ fontWeight: 'bold', marginTop: '10px' }}>Hold P/L</p>
                                    <p>{formatCurrency(plStats.totalHoldPlDollars)}</p>

                                    <p style={{ fontWeight: 'bold', marginTop: '10px' }}>Hold P/L Avg (%)</p>
                                    <p>{formatPercent(plStats.avgHoldPlPercent)}</p>

                                    <p style={{ fontWeight: 'bold', marginTop: '30px' }}>Stock P/L</p>
                                    <p>{formatCurrency(plStats.totalStockPlDollars)}</p>

                                    <p style={{ fontWeight: 'bold', marginTop: '10px' }}>Stock P/L Avg (%)</p>
                                    <p>{formatPercent(plStats.avgStockPlPercent)}</p>

                                    {/* +++ ADD TOTAL SWING YTD P/L +++ */}
                                    <p style={{ fontWeight: 'bold', marginTop: '30px' }}>Total Swing YTD P/L</p>
                                    <p>
                                        {totalSwingYtdPL?.dollars === null // Check if calculation was possible
                                            ? (pricesLoading ? 'Loading Price...' : 'N/A') // Show loading or N/A if price missing
                                            : formatCurrency(totalSwingYtdPL.dollars) // Display formatted result
                                        }
                                    </p>

                                    <p style={{ fontWeight: 'bold', marginTop: '10px' }}>Swing YTD P/L (%)</p>
                                    <p>
                                        {totalSwingYtdPL?.percent === null // Check if percent value is null
                                            ? (pricesLoading ? 'Loading Price...' : 'N/A')
                                            : formatPercent(totalSwingYtdPL.percent) // Display percent
                                        }
                                    </p>
                                </div>

                                <div>
                                    <p style={{ fontWeight: 'bold', fontSize: '1.1em' }}>Unrealized P/L</p>

                                    {/* +++ ADD TOTAL SWING YTD P/L +++ */}
                                    <p style={{ fontWeight: 'bold', marginTop: '10px' }}>Total Swing YTD P/L</p>
                                    <p>
                                        {totalSwingYtdPL?.dollars === null // Check if calculation was possible
                                            ? (pricesLoading ? 'Loading Price...' : 'N/A') // Show loading or N/A if price missing
                                            : formatCurrency(totalSwingYtdPL.dollars) // Display formatted result
                                        }
                                    </p>

                                    <p style={{ fontWeight: 'bold', marginTop: '10px' }}>Swing YTD P/L (%)</p>
                                    <p>
                                        {totalSwingYtdPL?.percent === null // Check if percent value is null
                                            ? (pricesLoading ? 'Loading Price...' : 'N/A')
                                            : formatPercent(totalSwingYtdPL.percent) // Display percent
                                        }
                                    </p>
                                </div>
                            </div> // End grid layout
                        )}
                    </div>
                )}
            </div>
            {/* End Overview Section */}
            
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
                            <td colSpan={10} style={{ textAlign: 'center', padding: '1rem' }}>
                                No {activeTab} wallets found for this stock.
                            </td>
                        </tr>
                    ) : (
                        (activeTab === 'Swing' ? swingWallets : holdWallets).map((wallet, index) => {
                            const currentStockPrice = latestPrices[stockSymbol ?? '']?.currentPrice;
                            return (
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
                                    <td style={{
                                        padding: '5px',
                                        ...getTpCellStyle(wallet, currentStockPrice) // Apply conditional style
                                    }}>
                                        {formatCurrency(wallet.tpValue)}
                                    </td>
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
                            )
                        }) // End map over the CORRECT list
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
                                <label htmlFor="sellPrice" style={labelStyle}>Sell Price ($):</label>
                                <input id="sellPrice" type="number" /*...*/ value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} required disabled={isSelling} style={inputStyle} />
                            </div>
                            <div style={formGroupStyle}>
                                <label htmlFor="sellQuantity" style={labelStyle}>Quantity:</label>
                                <input id="sellQuantity" type="number" /*...*/ value={sellQuantity} onChange={(e) => setSellQuantity(e.target.value)} required disabled={isSelling} style={inputStyle} />
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

            <div style={{ marginTop: '3rem', paddingTop: '1.5rem' }}>
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