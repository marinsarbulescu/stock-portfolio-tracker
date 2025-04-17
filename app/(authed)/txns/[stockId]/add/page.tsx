// app/(authed)/txns/[stockId]/add/page.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation'; // Hook to get URL params
import TransactionForm from '@/app/components/TransactionForm'; // Adjust path if needed
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';
import { FaEdit, FaTrashAlt } from 'react-icons/fa';
import type { GraphQLError } from 'graphql';

const client = generateClient<Schema>();
type TransactionItem = Schema['Transaction'];
type TransactionDataType = Schema['Transaction']['type'];
type PortfolioGoalsType = Schema['PortfolioGoals']['type'];

type TxnActionValue = TransactionDataType['action']; // Expect: "Buy" | "Sell" | "Div"
type TxnSignalValue = TransactionDataType['signal']; // Expect: "_5DD" | "Cust" | ... | null | undefined
type SharesTypeValue = TransactionDataType['sharesType']; // Expect: "Play" | "Hold" | null | undefined

type TransactionCreateInput = Omit<TransactionDataType, 'id' | 'createdAt' | 'updatedAt' | 'owner' | 'portfolioStock' | 'completedTxnId'>; // Adjust omit list
type TransactionUpdateInput = Partial<TransactionDataType> & { id: string };

// --- ADD THIS TYPE DEFINITION ---
// Derive the type returned by the list operation after awaiting
type TransactionListResultType = Awaited<ReturnType<typeof client.models.Transaction.list>>;
// This evaluates to something like:
// { data: Schema['Transaction'][], errors?: readonly GraphQLError[], nextToken?: string | null }
// --- END TYPE DEFINITION ---

export default function AddTransactionForStockPage() {
  const params = useParams();
  const stockId = params.stockId as string; // Get stockId from URL

  type SortableTxnKey = 'date' | 'price' | 'action' | 'signal' | 'investment' | 'quantity' | 'lbd' | 'tp' | 'txnProfitPercent';
  const [txnSortConfig, setTxnSortConfig] = useState<{ key: SortableTxnKey; direction: 'ascending' | 'descending' } | null>({ key: 'tp', direction: 'ascending' });

  const [stockSymbol, setStockSymbol] = useState<string | undefined>(undefined);

  const [transactions, setTransactions] = useState<TransactionDataType[]>([]);
  const [isTxnLoading, setIsTxnLoading] = useState(true);
  const [txnError, setTxnError] = useState<string | null>(null);

  //const [nextToken, setNextToken] = useState<string | null>(null);

  //const [isTxnLoadingMore, setIsTxnLoadingMore] = useState(false);

  const [isEditingTxn, setIsEditingTxn] = useState(false);
  const [txnToEdit, setTxnToEdit] = useState<Schema['Transaction'] | null>(null);

  const [userGoals, setUserGoals] = useState<PortfolioGoalsType | null>(null);
  const [allUserTxns, setAllUserTxns] = useState<TransactionDataType[]>([]);
  const [isGoalsLoading, setIsGoalsLoading] = useState(true);
  const [isAllTxnsLoading, setIsAllTxnsLoading] = useState(true);

  const [stockBudget, setStockBudget] = useState<number | null | undefined>(undefined); // Undefined initially, null if no budget set, number if set

  interface ColumnVisibilityState {
    txnId: boolean;
    signal: boolean;
    investment: boolean;
    playShares: boolean;
    holdShares: boolean;
    totalShares: boolean;
    lbd: boolean;
    txnProfit: boolean;
    txnProfitPercent: boolean;
    completedTxnId: boolean;
  }
  
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>({
    txnId: false, // Default to visible
    signal: false, // Default to visible
    investment: true,
    playShares: true,
    holdShares: false,
    totalShares: false,
    lbd: true,
    txnProfit: true, // Initially visible, even if data is null
    txnProfitPercent: true,
    completedTxnId: false,
  });

  // Mapping from state keys to desired display labels
  const COLUMN_LABELS: Record<keyof ColumnVisibilityState, string> = {
    txnId: 'Txn Id',
    signal: 'Signal',
    investment: 'Inv.',
    playShares: 'Play Shs',
    holdShares: 'Hold Shs',
    totalShares: 'Total Shs',
    lbd: 'LND',
    txnProfit: 'Txn P/L',
    txnProfitPercent: 'Txn P/L (%)',
    completedTxnId: 'Completed Buy Id',
  };

  // --- Add this useMemo hook for Total Stock P/L ---
  const stockTotalProfit = useMemo(() => {
    // Calculate the sum of profits from all relevant transactions for THIS stock
    return transactions.reduce((sum, txn) => {
      // Check if txnProfit is a valid number before adding
      if (typeof txn.txnProfit === 'number') {
        return sum + txn.txnProfit;
      }
      return sum; // Otherwise, keep the sum as is
    }, 0); // Start sum at 0
  }, [transactions]); // Dependency: Recalculate when this stock's transactions change
  // --- End Total Stock P/L hook ---

  // --- Add these useMemo hooks for P/L Percentage ---

  // Calculate the total amount invested in Buy transactions for THIS stock
  const totalBuyInvestment = useMemo(() => {
    return transactions.reduce((sum, txn) => {
      // Check if it's a Buy action and investment is a valid number
      if (txn.action === 'Buy' && typeof txn.investment === 'number') {
        return sum + txn.investment;
      }
      return sum;
    }, 0);
  }, [transactions]);

  // Calculate the overall P/L percentage based on total profit / total investment
  const stockProfitPercent = useMemo(() => {
    // Avoid division by zero if no investment was made
    if (totalBuyInvestment === 0) {
      return null; // Or return 0, or NaN, depending on how you want to display it
    }
    // Ensure stockTotalProfit is also valid (it should be a number from its hook)
    if (typeof stockTotalProfit !== 'number') {
        return null;
    }
    // Calculate percentage
    return (stockTotalProfit / totalBuyInvestment) * 100;
  }, [stockTotalProfit, totalBuyInvestment]); // Dependencies

  // --- End P/L Percentage hooks ---

  // --- Add Function to Handle Sort Requests ---
  const requestTxnSort = (key: SortableTxnKey) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    // If clicking the same key again, toggle direction
    if (txnSortConfig && txnSortConfig.key === key && txnSortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setTxnSortConfig({ key, direction });
    //console.log(`Sorting by ${key}, direction ${direction}`);
  };
  // --- End Sort Request Function ---


  // --- Helper function to determine Play Shares display value ---
  const getPlaySharesDisplay = (txn: TransactionDataType): string => {
   if (txn.action === 'Buy') {
      const playShares = typeof txn.playShares === 'number' ? txn.playShares : null;
      return playShares !== null ? playShares.toFixed(5) : '--';
    } else if (txn.action === 'Sell' && txn.sharesType === 'Play') {
      
      const quantity = typeof txn.quantity === 'number' ? txn.quantity : null;
      return quantity !== null ? quantity.toFixed(5) : '--'; // Show quantity sold
    } else {
      // Sell of Hold type, Div, or other actions
      return '--';
    }
  };
  // --- End Helper Function ---

  const getHoldSharesDisplay = (txn: TransactionDataType): string => {
    if (txn.action === 'Buy') {
      const holdShares = typeof txn.holdShares === 'number' ? txn.holdShares : null;
      return holdShares !== null ? holdShares.toFixed(5) : '--';
    } else if (txn.action === 'Sell' && txn.sharesType === 'Hold') {
      const quantity = typeof txn.quantity === 'number' ? txn.quantity : null;
      return quantity !== null ? quantity.toFixed(5) : '--'; // Show quantity sold
    } else {
      // Sell of Hold type, Div, or other actions
      return '--';
    }
  };

  const getTxnProfitDisplay = (txn: TransactionDataType): string => {
    if (txn.action === 'Sell' && txn.completedTxnId && typeof txn.txnProfit === 'number') {
      return txn.txnProfit.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    } else {
      return '--';
    }
  };

  // --- Calculate Visible Column Count ---
  const alwaysVisibleColumnCount = 10; // Date, Action, Price, Investment, Play Shares, LBD, TP, Txn L/P, Txn L/P (%), Actions
  const visibleOptionalColumns = Object.values(columnVisibility).filter(isVisible => isVisible).length;
  const totalVisibleColumns = alwaysVisibleColumnCount + visibleOptionalColumns;
  // --- End Calculation ---
  
  // --- Add Function to Fetch Goals ---
  const fetchUserGoals = useCallback(async () => {
    //console.log("Fetching goals...");
    setIsGoalsLoading(true);
    // setError(null); // Use a specific error state if preferred
    try {
      const { data: goalsList, errors } = await client.models.PortfolioGoals.list();
      if (errors) throw errors;
      const currentGoals = goalsList[0] ?? null;
      setUserGoals(currentGoals);
      //console.log('Fetched goals for budget calc:', currentGoals);
    } catch (err: any) {
      console.error("Error fetching goals:", err);
      // setGoalsError(err.message || "Failed to load goals data.");
      setUserGoals(null);
    } finally {
      setIsGoalsLoading(false);
    }
  }, []);
  // --- End Fetch Goals ---

  // --- Add Function to Fetch All Buy Transactions ---
  const fetchAllUserTransactions = useCallback(async () => {
    //console.log("Fetching all transactions...");
    setIsAllTxnsLoading(true);
    // setTxnError(null); // Use specific error state if preferred
    try {
        //console.log('Fetching all buy transactions for budget calc...');
        const { data: userTxns, errors } = await client.models.Transaction.list({
            // Fetch all, pagination might be needed for very large numbers later
            selectionSet: ['id', 'action', 'investment', 'price', 'quantity']
        });
        if (errors) throw errors;
        setAllUserTxns(userTxns as TransactionDataType[]);
        //console.log('Fetched all buy transactions:', userTxns);
    } catch (err: any) {
        console.error('Error fetching all buy transactions:', err);
        // setAllTxnError(err.message || 'Failed to load all transactions.');
        //console.log("ERROR fetching all transactions:", err);
        setAllUserTxns([]);
    } finally {
        setIsAllTxnsLoading(false);
    }
  }, []);
  // --- End Fetch All Buy Txns ---
  
  const handleEditTxnClick = (transaction: Schema['Transaction']) => {
    //console.log('Editing transaction:', transaction);
    setTxnToEdit(transaction);
    setIsEditingTxn(true);
    // Optional: Scroll to the form or display it prominently
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUpdateTransaction = async (updatedTxnDataFromForm: Schema['Transaction']) => {
    // updatedTxnDataFromForm comes directly from the form's onUpdate prop
    // It should already contain the ID and all calculated/updated fields
    //console.log('Attempting to update transaction with data from form:', updatedTxnDataFromForm);
    setTxnError(null);
    //setIsLoading(true); // Add loading state indication maybe
  
    try {
      // We expect updatedTxnDataFromForm to have the required structure, including 'id'
      // The 'as any' can help bypass TS issues if the exact type still mismatches update's expectation
      const { data: updatedTxn, errors } = await client.models.Transaction.update(updatedTxnDataFromForm as any);
  
      if (errors) throw errors;
  
      //console.log('Transaction updated successfully:', updatedTxn);
      setIsEditingTxn(false);
      setTxnToEdit(null);
      fetchTransactions();        // Refresh list for THIS stock
      fetchAllUserTransactions(); // Refresh list for ALL transactions (for budget calc)
    } catch (err: any) {
      console.error('Error updating transaction:', err);
      const errorMessage = Array.isArray(err) ? err[0].message : (err.message || "Failed to update transaction.");
      setTxnError(errorMessage);
    } finally {
       
      //setIsLoading(false); // Ensure loading state is reset
    }
  };

  const handleCancelEditTxn = () => {
    setIsEditingTxn(false);
    setTxnToEdit(null);
  };
  
  const handleDeleteTransaction = async (idToDelete: string) => {
    if (!window.confirm('Are you sure you want to delete this transaction?')) {
      return;
    }
    //console.log(`Attempting to delete transaction with id: ${idToDelete}`);
    setTxnError(null); // Clear previous errors
  
    try {
      const { errors } = await client.models.Transaction.delete({ id: idToDelete });
  
      if (errors) {
        console.error('Error deleting transaction:', errors);
        setTxnError(errors[0]?.message || 'Failed to delete transaction.');
      } else {
        //console.log('Transaction deleted successfully!');
        // Refresh the transactions list
        fetchTransactions();
      }
    } catch (err: any) {
      console.error('Unexpected error deleting transaction:', err);
      setTxnError(err.message || 'An error occurred during deletion.');
    }
    // Maybe add specific loading state logic if needed
  };

  // --- Add Function to Fetch Transactions ---
  // Use useCallback to memoize the function, preventing unnecessary calls
  // --- Modified Fetch Transactions Function (Fetches All Pages) ---
  const fetchTransactions = useCallback(async () => {
    if (!stockId) return; // Exit if no stockId

    //console.log(`Workspaceing ALL transactions for stockId: [${stockId}]`);
    setIsTxnLoading(true); // Indicate loading started
    setTxnError(null);
    // Clear previous transactions before fetching all new ones
    setTransactions([]);

    let accumulatedTxns: Schema['Transaction'][] = [];
    let currentToken: string | null = null;
    let loopSafetyCounter = 0; // Prevent potential infinite loops
    const maxLoops = 20; // Set a reasonable max number of pages

    try {
      do {
        // Safety break
        loopSafetyCounter++;
        if (loopSafetyCounter > maxLoops) {
           console.warn("Exceeded maximum pagination requests. Breaking loop.");
           throw new Error(`Could not fetch all transactions after ${maxLoops} pages.`);
        }

        //console.log(`Workspaceing page with token: ${currentToken ? '...' : 'null'}`); // Don't log full token
        const listResult: TransactionListResultType = await client.models.Transaction.list({
          filter: { portfolioStockId: { eq: stockId } },
          nextToken: currentToken,
          limit: 100,
        });

        const fetchedTxns = listResult.data;
        const errors = listResult.errors; // Check for GraphQL errors
        const returnedToken = listResult.nextToken ?? null;

        //console.log(`Workspaceed ${fetchedTxns?.length ?? 0} items. Next Token Received: ${returnedToken ? 'Yes' : 'No'}`);

        if (errors) throw errors; // Throw GraphQL errors

        if (fetchedTxns) {
            // Add the fetched items to our accumulator array
            // Using 'as any' workaround if type mismatch persists
            accumulatedTxns = [...accumulatedTxns, ...(fetchedTxns as any)];
        }
        // Set the token for the *next* loop iteration
        currentToken = returnedToken;

      } while (currentToken !== null); // Continue looping as long as there's a nextToken

      //console.log(`Finished fetching. Total transactions: ${accumulatedTxns.length}`);
      //@ts-ignore
      setTransactions(accumulatedTxns); // Set the final state with ALL transactions

    } catch (err: any) {
      console.error('Error fetching all transactions:', err);
      const errMsg = Array.isArray(err?.errors) ? err.errors[0].message : (err.message || 'Failed to load transactions.');
      setTxnError(errMsg);
      setTransactions([]); // Clear transactions on error
    } finally {
      setIsTxnLoading(false); // Set loading false only after ALL pages are fetched or an error occurs
    }
  // Depend only on stockId. The function now handles its own looping.
  // Adding setTransactions etc. can cause infinite loops if not careful.
  }, [stockId]);
  // --- End Fetch Transactions Function ---

  
  useEffect(() => {
    // Fetch data needed for budget calculations and display
    fetchUserGoals();
    fetchAllUserTransactions();

    // Fetch the stock symbol for display
    if (stockId) {
      client.models.PortfolioStock.get({ id: stockId }, { selectionSet: ['symbol', 'budget'] }) // Fetch budget too!
        .then(({ data, errors }) => {
          if (data) {
            setStockSymbol(data.symbol ?? undefined);
            setStockBudget(data.budget); // Store the fetched stock budget
            //console.log("Fetched stock details:", data);
          }
          if (errors) {
            console.error("Error fetching stock details", errors);
            // Handle error, maybe set a specific error state
            setStockSymbol(undefined);
            setStockBudget(undefined);
          }
        });
    } else {
        setStockSymbol(undefined); // Clear if no stockId
        setStockBudget(undefined);
    }

  // Run only once on mount - fetchUserGoals and fetchAllUserTransactions are stable due to useCallback
  }, [stockId, fetchUserGoals, fetchAllUserTransactions]);

  
  // Rename and update the calculation logic
  const netBudgetImpact = useMemo(() => {
    return allUserTxns.reduce((sum, txn) => {
      const investment = typeof txn.investment === 'number' ? txn.investment : 0;
      const price = typeof txn.price === 'number' ? txn.price : 0;
      const quantity = typeof txn.quantity === 'number' ? txn.quantity : 0;
      
      if (txn.action === 'Buy' || txn.action === 'Div') {
        // Buys and Dividends decrease budget (increase spending sum)
        return sum + investment;
      } else if (txn.action === 'Sell') {
        // Sells increase budget (decrease spending sum)
        const sellReturn = price * quantity;
        return sum - sellReturn;
      } else {
        return sum; // Ignore other types if any
      }
    }, 0);
  }, [allUserTxns]); // Depend on the state holding all transactions

  const remainingBudget = useMemo(() => {
    const totalBudget = typeof userGoals?.totalBudget === 'number' ? userGoals.totalBudget : 0;
    // Subtract the net impact (Buys/Divs are positive impact, Sells are negative impact)
    return totalBudget - netBudgetImpact;
  }, [userGoals?.totalBudget, netBudgetImpact]);

  // --- Calculate Stock-Specific Stats ---
  const stockRemainingBudget = useMemo(() => {
    const startingBudget = typeof stockBudget === 'number' ? stockBudget : 0;
    // Use the 'transactions' state (only txns for this stock)
    return transactions.reduce((budget, txn) => {
      const investment = typeof txn.investment === 'number' ? txn.investment : 0;
      const price = typeof txn.price === 'number' ? txn.price : 0;
      const quantity = typeof txn.quantity === 'number' ? txn.quantity : 0;

      
      if (txn.action === 'Buy') {
        return budget - investment; // Subtract Buy investment
      
      } else if (txn.action === 'Sell') {
        const sellReturn = price * quantity;
        return budget + sellReturn; // Add Sell return
      } else {
        return budget; // Ignore Div for stock-specific budget? Or subtract investment too? Adjust if needed.
      }
    }, startingBudget); // Start reduction with the stock's budget  
  }, [stockBudget, transactions]); // Recalculate when stock budget or its transactions change

  const buyCount = useMemo(() => {    
    return transactions.filter(txn => txn.action === 'Buy').length;
  }, [transactions]);

  const sellCount = useMemo(() => {    
    return transactions.filter(txn => txn.action === 'Sell').length;
  }, [transactions]);
  // --- End Stock-Specific Stat Calculations ---

  const currentPlayShares = useMemo(() => {    
    return transactions.reduce((balance, txn) => {      
      const playShares = typeof txn.playShares === 'number' ? txn.playShares : 0;      
      const quantity = typeof txn.quantity === 'number' ? txn.quantity : 0; // Use quantity for sell amount
  
      
      if (txn.action === 'Buy') {
        return balance + playShares;      
      } else if (txn.action === 'Sell' && txn.sharesType === 'Play') { // Subtract only if selling Play shares
        return balance - quantity;
      } else {
        return balance;
      }
    }, 0);
  
  }, [transactions]);
  
  const currentHoldShares = useMemo(() => {    
    return transactions.reduce((balance, txn) => {      
      const holdShares = typeof txn.holdShares === 'number' ? txn.holdShares : 0;      
      const quantity = typeof txn.quantity === 'number' ? txn.quantity : 0; // Use quantity for sell amount
  
      
      if (txn.action === 'Buy') {
        return balance + holdShares;      
      } else if (txn.action === 'Sell' && txn.sharesType === 'Hold') { // Subtract only if selling Hold shares
        return balance - quantity;
      } else {
        return balance;
      }
    }, 0);
  
  }, [transactions]);

  const totalCurrentShares = useMemo(() => {
      // Ensure counts are numbers before adding
      const play = typeof currentPlayShares === 'number' ? currentPlayShares : 0;
      const hold = typeof currentHoldShares === 'number' ? currentHoldShares : 0;
      return play + hold;
  }, [currentPlayShares, currentHoldShares]);
  // --- End Share Count Calculations ---
  
  // --- Add this useMemo hook ---
  const completedBuyTxnIds = useMemo(() => {
    //console.log("Calculating completed Buy IDs for this stock's transactions...");
    const ids = new Set<string>();
    // Iterate through the transactions specifically loaded for THIS stock
    transactions.forEach(t => {
        // If it's a Sell transaction and it specifies which Buy it completed...
        // Ensure we check 't.completedTxnId' exists and is not null/empty string
        if (t.action === 'Sell' && t.completedTxnId) {
            ids.add(t.completedTxnId);
        }
    });
    //console.log("Completed Buy Txn IDs for this stock:", ids); // Optional debug log
    return ids;
  }, [transactions]); // Re-calculate only when this stock's transactions change
  // --- End completedBuyTxnIds hook ---

  // --- Add these useMemo hooks for COMPLETED P/L Percentage ---

  // --- REPLACE the previous cost basis hook with this one ---
  // Calculate the total COST BASIS of ONLY the shares involved in completed trades
  const completedTradesCostBasis = useMemo(() => {
    return transactions.reduce((sum, txn) => {
      // Check if it's a Sell transaction with a calculated profit
      if (txn.action === 'Sell' && typeof txn.txnProfit === 'number' &&
          typeof txn.price === 'number' && typeof txn.quantity === 'number')
      {
        // Calculate the cost basis for THIS specific sell transaction
        // Cost = Revenue - Profit
        const sellRevenue = txn.price * txn.quantity;
        const costBasisForThisSell = sellRevenue - txn.txnProfit;
        return sum + costBasisForThisSell;
      }
      return sum; // Otherwise, keep the sum as is
    }, 0);
  }, [transactions]); // Dependency: Recalculate when transactions change
  // --- End completedTradesCostBasis hook ---


  // --- REPLACE the previous percentage hook with this one ---
  // Calculate the P/L percentage based ONLY on completed transactions' profit vs cost
  const completedStockProfitPercent = useMemo(() => {
    // Avoid division by zero if the cost basis for completed trades is zero
    if (completedTradesCostBasis === 0) {
      return null; // Or 0 or NaN
    }
    // Ensure stockTotalProfit is valid
    if (typeof stockTotalProfit !== 'number') {
        return null;
    }
    // Calculate percentage: (Total Profit from Completed Sells) / (Total Cost Basis for those Sells)
    return (stockTotalProfit / completedTradesCostBasis) * 100; // Use the new cost basis
  }, [stockTotalProfit, completedTradesCostBasis]); // Dependencies updated
  // --- End completedStockProfitPercent hook ---
  
  // --- Add Memoized Sort Logic ---
  const sortedTransactions = useMemo(() => {
    let sortableItems = [...transactions]; // Create a mutable copy of transactions for THIS stock
    if (txnSortConfig !== null) {
      sortableItems.sort((a, b) => {
        const valA = a[txnSortConfig.key];
        const valB = b[txnSortConfig.key];

        // Handle null/undefined and different types for robust comparison
        let comparison = 0;
        if (valA === null || valA === undefined) comparison = -1;
        else if (valB === null || valB === undefined) comparison = 1;
        else if (valA < valB) comparison = -1;
        else if (valA > valB) comparison = 1;

        return txnSortConfig.direction === 'ascending' ? comparison : comparison * -1;
      });
    } else {
      // <<<< ADD DEFAULT SORT HERE >>>>
      // Default sort by date descending if no specific sort is chosen
      sortableItems.sort((a, b) => (a.date < b.date ? 1 : -1));
    }
    // Add default sort? The fetch already sorts by date descending.
    // If you remove sort from fetch, you could add default here:
    // else { sortableItems.sort((a, b) => (a.date < b.date ? 1 : -1)); } // Example default sort
    return sortableItems;
  }, [transactions, txnSortConfig]); // Re-sort only when transactions data or sort config changes
  // --- End Memoized Sort Logic ---
  
  useEffect(() => {
    if (stockId) {
        //console.log("StockId changed or initial load, fetching ALL transactions.");
        fetchTransactions(); // Call the function (it handles pagination internally)
    } else {
        setTransactions([]); // Clear if no stockId
    }
  // Include fetchTransactions if ESLint requires, as it's stable due to useCallback
  }, [stockId, fetchTransactions]);

  if (!stockId) {
    return <p>Stock ID not found.</p>;
  }

  return (
    <div>
      <h2>
        {stockSymbol ? stockSymbol.toUpperCase() : ''} details
      </h2>
      <div style={{ marginBottom: '1.5rem', padding: '10px', paddingLeft: '0px'}}>
        {(isGoalsLoading || isAllTxnsLoading) ? (
          <p>Loading stats...</p>
        ) : (          
          <div style={{ display: 'flex', flexWrap: 'wrap', fontSize: '0.8em' }}>
            {/* <div style={{ flexBasis: '30%', minWidth: '150px' }}>
              <p>
                Remaining Annual Budget: 
                <strong style={{ marginLeft: '10px', fontSize: '1.1em' }}>
                  {typeof remainingBudget === 'number'
                    ? remainingBudget.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
                    : '$0.00'}
                </strong>
                <small style={{ marginLeft: '10px' }}>
                  (Target: ${userGoals?.totalBudget?.toFixed(2) ?? '0.00'} - Net Impact: ${netBudgetImpact.toFixed(2)})
                </small>
              </p>
            </div>   */}
            <div style={{ flexBasis: '30%', minWidth: '150px'}}>
              <p>
                Stock Annual Budget:  {typeof stockBudget === 'number' 
                                        ? stockBudget.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
                                        : '$0.00'}
              </p>
              {isTxnLoading ? (
                <p>Calculating Remaining Budget...</p>
                ) : (
                  <p>Remaining Budget:  {typeof remainingBudget === 'number'
                                          ? stockRemainingBudget.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
                                          : '$0.00'}
                  </p>
                )}
              <p>Buys: {buyCount}</p>
              <p>Sells: {sellCount}</p>
              <p>Incomplete Buys: {buyCount - sellCount}</p>
            </div>
            <div style={{ flexBasis: '30%', minWidth: '150px', paddingLeft: '15px' }}>
              {isTxnLoading ? ( <p>Calculating share counts...</p>) : (
                <>
                  <p>
                    Play Shs: {currentPlayShares.toFixed(5)}
                  </p>
                  <p>
                    Hold Shs: {currentHoldShares.toFixed(5)}
                  </p>
                  <p>
                    Total Shs: {totalCurrentShares.toFixed(5)}
                  </p>
                </>
              )}
            </div>

            <div style={{ flexBasis: '30%', minWidth: '150px', paddingLeft: '15px' }}>
              {/* --- START: Add Stock P/L Stats --- */}
              {!isTxnLoading && ( // Only show once transactions are loaded
                  <>
                      <p>
                        P/L (All):&nbsp; 
                          <strong>
                            {stockTotalProfit.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                          </strong> /&nbsp;
                          <strong> 
                            {typeof stockProfitPercent === 'number'
                                ? `${stockProfitPercent.toFixed(2)}%`
                                : '--' // Display dashes if percentage couldn't be calculated
                            }
                          </strong>
                      </p>
                      <p>
                        P/L (Compl. Txns):&nbsp; 
                          <strong>
                            {stockTotalProfit.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                          </strong> /&nbsp;
                          <strong>
                            {typeof completedStockProfitPercent === 'number'
                                ? `${completedStockProfitPercent.toFixed(2)}%`
                                : '--'
                            }
                          </strong>
                      </p>
                  </>
              )}
            </div>
          </div>   
        )}
      </div>


      {isEditingTxn && txnToEdit ? (
        // Render form in Edit mode
        
        <TransactionForm
            isEditMode={true}
            initialData={txnToEdit}
            // @ts-ignore
            onUpdate={handleUpdateTransaction}
            onCancel={handleCancelEditTxn}
            portfolioStockId={stockId}
            portfolioStockSymbol={stockSymbol}
        />
      ) : (
        // Render form in Add mode (existing setup)
          <TransactionForm
            portfolioStockId={stockId}
            portfolioStockSymbol={stockSymbol}
            onTransactionAdded={() => {
              fetchTransactions(); // Refetch txns for current stock list
              fetchAllUserTransactions(); // Refetch all buy txns for budget calc
            }}
          />
      )}
      
      
      {/* --- Add Transaction List/Table Below Form --- */}
      <div style={{ marginTop: '2rem' }}>
        <div style={{ marginBottom: '1rem', marginTop: '1rem', padding: '5px', border: '1px solid #353535', fontSize: '0.7em', color: "gray" }}>
          {Object.keys(columnVisibility).map((key) => (
            <label key={key} style={{ marginLeft: '15px', whiteSpace: 'nowrap' }}>
              <input
                type="checkbox"
                checked={columnVisibility[key as keyof ColumnVisibilityState]}
                onChange={() =>
                  setColumnVisibility((prev) => ({
                    ...prev,
                    [key]: !prev[key as keyof ColumnVisibilityState], // Toggle the specific key
                  }))
                }
                style={{ marginRight: '5px' }}
              />
              {COLUMN_LABELS[key as keyof ColumnVisibilityState]}
            </label>
          ))}
        </div>

        {isTxnLoading && <p>Loading transactions...</p>}
        {txnError && <p style={{ color: 'red' }}>Error loading transactions: {txnError}</p>}

        {!isTxnLoading && !txnError && (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem', fontSize: '0.8em' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>
                <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestTxnSort('date')}>
                  Date {txnSortConfig?.key === 'date' ? (txnSortConfig.direction === 'ascending' ? '▲' : '▼') : null}
                </th>
                {columnVisibility.txnId && <th style={{ padding: '5px' }}>Txn Id</th>}
                <th style={{ padding: '5px' }}>Action</th>
                {columnVisibility.signal && <th style={{ padding: '5px' }}>Signal</th>}
                <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestTxnSort('price')}>
                  Price {txnSortConfig?.key === 'price' ? (txnSortConfig.direction === 'ascending' ? '▲' : '▼') : null}
                </th>
                {columnVisibility.investment && <th style={{ padding: '5px' }}>Inv.</th>}
                {columnVisibility.playShares && <th style={{ padding: '5px' }}>Play Shs</th>}
                {columnVisibility.holdShares && <th style={{ padding: '5px' }}>Hold Shs</th>}
                {columnVisibility.totalShares && <th style={{ padding: '5px' }}>Total Shs</th>}
                {columnVisibility.lbd && <th style={{ padding: '5px' }}>LBD</th>}
                <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestTxnSort('tp')}>
                  TP {txnSortConfig?.key === 'tp' ? (txnSortConfig.direction === 'ascending' ? '▲' : '▼') : null}
                </th>
                {columnVisibility.txnProfit && <th style={{ padding: '5px' }}>Txn P/L</th>}
                {columnVisibility.txnProfitPercent && <th style={{ padding: '5px' }}>Txn P/L (%)</th>}
                {columnVisibility.completedTxnId && <th style={{ padding: '5px' }}>Completed Buy Id</th>}
                <th style={{ padding: '5px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  {/* Use dynamic colspan based on visible columns */}
                  <td colSpan={totalVisibleColumns} style={{ textAlign: 'center', padding: '1rem' }}>
                    No transactions found for this stock.
                  </td>
                </tr>
              ) : (
                // Map over sorted transactions
                sortedTransactions.map((txn, index) => { // txn is type TransactionDataType

                  // --- Determine if this row should be highlighted ---
                  const isCompletedBuy = txn.action === 'Buy' && completedBuyTxnIds.has(txn.id);
                  // --- End determination ---

                  return (
                    <tr
                      key={txn.id}
                      style={{
                        
                        // --- Apply conditional background color ---
                        backgroundColor: index % 2 !== 0 ? '#151515' : 'transparent',
                        color: isCompletedBuy ? '#616161' : undefined, // Light gray for completed Buys
                        // Consider reducing opacity slightly too if desired
                        // opacity: isCompletedBuy ? 0.8 : 1,
                      }}
                    >
                      {/* Render all your existing <td> elements for the row */}
                      <td style={{ padding: '5px' }}>{txn.date}</td>
                      {columnVisibility.txnId && <td style={{ padding: '5px' }}>{txn.id || '-'}</td>}
                      <td style={{ padding: '5px' }}>{txn.action}</td>
                      {columnVisibility.signal && <td style={{ padding: '5px' }}>{txn.signal || '-'}</td>}
                      <td style={{ padding: '5px' }}>{txn.price?.toFixed(2) ?? '-'}</td>
                      {columnVisibility.investment && <td style={{ padding: '5px' }}>{txn.investment?.toFixed(2) ?? '-'}</td>}
                      {columnVisibility.playShares && <td style={{ padding: '5px' }}>{getPlaySharesDisplay(txn) ?? '-'}</td>}
                      {columnVisibility.holdShares && <td style={{ padding: '5px' }}>{getHoldSharesDisplay(txn) ?? '-'}</td>}
                      {columnVisibility.totalShares && <td style={{ padding: '5px' }}>{txn.quantity?.toFixed(5) ?? '-'}</td>}
                      {columnVisibility.lbd && <td style={{ padding: '5px' }}>{txn.lbd?.toFixed(2) ?? '--'}</td>}
                      <td style={{ padding: '5px' }}>{txn.tp?.toFixed(2) ?? '-'}</td>
                      {columnVisibility.txnProfit && <td style={{ padding: '5px' }}>{getTxnProfitDisplay(txn) ?? '-'}</td>}
                      {columnVisibility.txnProfitPercent && (<td style={{ padding: '5px' }}>
                          {typeof txn.txnProfitPercent === 'number'
                            ? `${txn.txnProfitPercent.toFixed(2)}%`
                            : '--'}
                        </td>
                      )}
                      {columnVisibility.completedTxnId && <td style={{ padding: '5px' }}>{txn.completedTxnId ?? '-'}</td>}
                      <td style={{ padding: '5px', textAlign: 'center' }}>
                          {/* Edit/Delete Buttons */}
                          <button onClick={() => handleEditTxnClick(txn as any)} /* ... styles ... */ > <FaEdit /> </button>
                          <button onClick={() => handleDeleteTransaction(txn.id)} /* ... styles ... */ > <FaTrashAlt /> </button>
                      </td>
                    </tr>
                  );
                }) // End map
              )}
            </tbody>
          </table>
        )}
      </div>
      {/* --- End Transaction List --- */}

    </div>
  );
}