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
    type SortableTxnKey = 'date' | 'action' | 'signal' | 'price' | 'investment' | 'quantity' | 'lbd'; // Simplified keys
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
            'investment', // Needed for Buy/Div display and editing
            'quantity',   // Used for 'Total Shares' display and editing Sell
            'lbd',        // Keep LBD column
            'completedTxnId', // Needed for editing Sell
            'sharesType',     // Needed for editing Sell
            'playShares', 'holdShares', 'tp', 'txnProfit', 'txnProfitPercent', // Needed for editing logic in TransactionForm
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
    }, [stockId, fetchTransactions]); // Add fetchTransactions dependency
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

        // --- Step 2: Delete the Transaction ---
        console.log(`Proceeding to delete transaction ${idToDelete}`);
        const { errors: deleteErrors } = await client.models.Transaction.delete({ id: idToDelete });
        if (deleteErrors) throw deleteErrors; // Throw delete error if it occurs

        console.log('Transaction deleted successfully!');

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

    // --- Function to fetch wallets FOR THIS STOCK ---
    const fetchWallets = useCallback(async () => {
        // Only fetch if stockId is available
        if (!stockId) {
             console.log("Stock ID missing, cannot fetch wallets.");
             setWallets([]); // Clear wallets if no ID
             setIsLoading(false);
             return;
        }

        setIsLoading(true);
        setError(null);
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
                // No longer need portfolioStock.symbol here
            ] as const;

            // --- ADDED FILTER ---
            const result = await client.models.StockWallet.list({
                filter: { portfolioStockId: { eq: stockId } }, // Filter by stockId
                selectionSet: selectionSetNeeded,
            });

            if (result.errors) throw result.errors;

            //console.log(`Workspaceed ${result.data.length} wallets for ${stockId}.`);
            setWallets(result.data as StockWalletDataType[]);

        } catch (err: any) {
            console.error("Error fetching stock wallets:", err);
            const message = Array.isArray(err?.errors) ? err.errors[0].message : err.message;
            setError(message || "Failed to fetch wallet data.");
            setWallets([]);
        } finally {
            setIsLoading(false);
        }
    }, [stockId]); // <<< ADD stockId dependency

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

        // --- Validation (Keep existing validation) ---
        const quantity = parseFloat(sellQuantity);
        const price = parseFloat(sellPrice);
        const remaining = walletToSell.remainingShares ?? 0;
        const buyPrice = walletToSell.buyPrice; // Get buy price from the wallet

        if (isNaN(quantity) || quantity <= 0) {
            setSellError("Please enter a valid positive quantity.");
            setIsSelling(false);
            return;
        }
        if (quantity > remaining) {
            setSellError(`Quantity cannot exceed remaining shares (${formatShares(remaining)}).`);
            setIsSelling(false);
            return;
        }
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
        // --- End Validation ---

        if (!sellSignal) {
            setSellError("Please select a Sell Signal.");
            setIsSelling(false);
            return;
        }

        // --- Database Operations ---
        try {
            // 1. Calculate P/L for this specific sale
            const realizedPlForSale = (price - buyPrice) * quantity;

            // --- ADD: Calculate NEW totals and percentage ---
            const newTotalSharesSold = (walletToSell.sharesSold ?? 0) + quantity;
            const newTotalRealizedPl = (walletToSell.realizedPl ?? 0) + realizedPlForSale;
            const costBasisOfSoldShares = buyPrice * newTotalSharesSold; // Use wallet's buyPrice

            let newRealizedPlPercent: number | null = null;
            if (costBasisOfSoldShares !== 0) { // Avoid division by zero
                newRealizedPlPercent = (newTotalRealizedPl / costBasisOfSoldShares) * 100;
            } else if (newTotalRealizedPl === 0) {
                // If no profit/loss and no cost basis (e.g., first sale resulting in $0 P/L), percent is 0
                newRealizedPlPercent = 0;
            } // Otherwise, leave as null if cost basis is 0 but P/L is not (shouldn't happen)
            // --- END: Calculation ---

            // 2. Prepare StockWallet Update Payload
            const walletPayload = {
                id: walletToSell.id,
                sharesSold: (walletToSell.sharesSold ?? 0) + quantity,
                remainingShares: remaining - quantity, // Use validated remaining & quantity
                realizedPl: (walletToSell.realizedPl ?? 0) + realizedPlForSale,
                realizedPlPercent: newRealizedPlPercent,
                sellTxnCount: (walletToSell.sellTxnCount ?? 0) + 1,
            };
            console.log("Updating StockWallet with payload:", walletPayload);

            // 3. Prepare Transaction Create Payload
            const transactionPayload = {
                portfolioStockId: walletToSell.portfolioStockId, // Get stockId from the wallet
                action: 'Sell' as const, // Ensure type matches Enum if defined, else cast
                date: sellDate,
                price: price,
                quantity: quantity, // Use 'shares' field for quantity sold in Txn record
                completedTxnId: walletToSell.id, // Store Wallet ID here
                signal: sellSignal || undefined,
            };
            console.log("Creating Transaction with payload:", transactionPayload);


            // --- Execute DB Operations ---
            // Note: These run sequentially. Consider Promise.all if they are independent
            // and you want atomicity (though true atomicity requires backend transactions)

            const updatedWallet = await client.models.StockWallet.update(walletPayload);
            if (updatedWallet.errors) throw updatedWallet.errors; // Throw if wallet update fails

            const newTransaction = await client.models.Transaction.create(transactionPayload);
            if (newTransaction.errors) throw newTransaction.errors; // Throw if transaction create fails

            // --- Success ---
            console.log("Sell recorded successfully!", { updatedWallet: updatedWallet.data, newTransaction: newTransaction.data });
            setIsSellModalOpen(false); // Close modal on success
            fetchWallets(); // Refresh the wallet list in the table
            fetchTransactions();

        } catch (err: any) {
            // --- Error Handling ---
            console.error("Error recording sell transaction:", err);
            // Attempt to parse Amplify errors
            const errorMessage = Array.isArray(err) ? err[0].message : (err.message || "An unknown error occurred.");
            setSellError(`Failed to record sale: ${errorMessage}`);

        } finally {
            // --- Cleanup ---
            setIsSelling(false); // Ensure loading state is always reset
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
        console.log("Buy transaction added via modal, refreshing wallet list...");
        setIsBuyModalOpen(false); // Close the modal
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


    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h3>Wallets for {stockSymbol?.toUpperCase()}</h3>
                {/* --- ADD BUTTON --- */}
                <button onClick={handleOpenBuyModal} style={{ padding: '8px 15px' }}>
                    Add Buy Transaction
                </button>
                {/* --- END BUTTON --- */}
            </div>

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
                    {/* Check sortedWallets length now */}
                    {sortedWallets.length === 0 ? (
                        <tr>
                            {/* --- Adjusted Colspan (8 columns) --- */}
                            <td colSpan={11} style={{ textAlign: 'center', padding: '1rem' }}>
                                No wallets found for this stock.
                            </td>
                        </tr>
                    ) : (
                        sortedWallets.map((wallet, index) => (
                            <tr
                                key={wallet.id}
                                style={{
                                    backgroundColor: index % 2 !== 0 ? '#151515' : 'transparent',
                                }}
                            >
                                {/* --- Removed Symbol Cell --- */}
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
                                    {/* Conditionally render Sell button if shares remain */}
                                    {wallet.remainingShares && wallet.remainingShares > 0 ? (
                                        <button
                                            onClick={() => handleOpenSellModal(wallet)}
                                            // --- UPDATE STYLES & CONTENT ---
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                cursor: 'pointer',
                                                padding: '5px', // Adjust as needed
                                                color: '#28a745', // Example: Green color for sell icon
                                                fontSize: '1.1em' // Adjust size if needed
                                            }}
                                            title={`Sell from Wallet (Buy Price: ${formatCurrency(wallet.buyPrice)})`}
                                            disabled={!wallet.remainingShares || wallet.remainingShares <= 0}
                                        >
                                            {/* Replace text with icon */}
                                            <FaDollarSign />
                                        </button>
                                    ) : (
                                        '-' // Show nothing or '--' if no remaining shares
                                    )}
                                </td>
                            </tr>
                        ))
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
                                <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestTxnSort('action')}>Action</th>
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
                                    <td colSpan={8} style={{ textAlign: 'center', padding: '1rem' }}> {/* Adjust colspan */}
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