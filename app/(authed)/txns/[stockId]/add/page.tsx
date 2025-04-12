// app/(authed)/txns/[stockId]/add/page.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation'; // Hook to get URL params
import TransactionForm from '@/app/components/TransactionForm'; // Adjust path if needed
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';
import { FaEdit, FaTrashAlt } from 'react-icons/fa';

const client = generateClient<Schema>();
type TransactionItem = Schema['Transaction'];
type TransactionDataType = Schema['Transaction']['type'];
type PortfolioGoalsType = Schema['PortfolioGoals']['type'];

type TxnActionValue = TransactionDataType['action']; // Expect: "Buy" | "Sell" | "Div"
type TxnSignalValue = TransactionDataType['signal']; // Expect: "_5DD" | "Cust" | ... | null | undefined
type SharesTypeValue = TransactionDataType['sharesType']; // Expect: "Play" | "Hold" | null | undefined

type TransactionCreateInput = Omit<TransactionDataType, 'id' | 'createdAt' | 'updatedAt' | 'owner' | 'portfolioStock' | 'completedTxnId'>; // Adjust omit list
type TransactionUpdateInput = Partial<TransactionDataType> & { id: string };

export default function AddTransactionForStockPage() {
  const params = useParams();
  const stockId = params.stockId as string; // Get stockId from URL

  type SortableTxnKey = 'date' | 'price' | 'action' | 'signal' | 'investment' | 'quantity' | 'lbd' | 'tp';
  const [txnSortConfig, setTxnSortConfig] = useState<{ key: SortableTxnKey; direction: 'ascending' | 'descending' } | null>({ key: 'tp', direction: 'ascending' });

  const [stockSymbol, setStockSymbol] = useState<string | undefined>(undefined);

  const [transactions, setTransactions] = useState<TransactionDataType[]>([]);
  const [isTxnLoading, setIsTxnLoading] = useState(true);
  const [txnError, setTxnError] = useState<string | null>(null);

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
    txnProfit: false, // Initially visible, even if data is null
    completedTxnId: false,
  });

  // --- Add Function to Handle Sort Requests ---
  const requestTxnSort = (key: SortableTxnKey) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    // If clicking the same key again, toggle direction
    if (txnSortConfig && txnSortConfig.key === key && txnSortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setTxnSortConfig({ key, direction });
    console.log(`Sorting by ${key}, direction ${direction}`);
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
  const alwaysVisibleColumnCount = 6; // Date, Txn Id, Action, Price, Quantity, Actions
  const visibleOptionalColumns = Object.values(columnVisibility).filter(isVisible => isVisible).length;
  const totalVisibleColumns = alwaysVisibleColumnCount + visibleOptionalColumns;
  // --- End Calculation ---
  
  // --- Add Function to Fetch Goals ---
  const fetchUserGoals = useCallback(async () => {
    setIsGoalsLoading(true);
    // setError(null); // Use a specific error state if preferred
    try {
      const { data: goalsList, errors } = await client.models.PortfolioGoals.list();
      if (errors) throw errors;
      const currentGoals = goalsList[0] ?? null;
      setUserGoals(currentGoals);
      console.log('Fetched goals for budget calc:', currentGoals);
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
    setIsAllTxnsLoading(true);
    // setTxnError(null); // Use specific error state if preferred
    try {
        console.log('Fetching all buy transactions for budget calc...');
        const { data: userTxns, errors } = await client.models.Transaction.list({
            // Fetch all, pagination might be needed for very large numbers later
            selectionSet: ['id', 'action', 'investment', 'price', 'quantity']
        });
        if (errors) throw errors;
        setAllUserTxns(userTxns as TransactionDataType[]);
        console.log('Fetched all buy transactions:', userTxns);
    } catch (err: any) {
        console.error('Error fetching all buy transactions:', err);
        // setAllTxnError(err.message || 'Failed to load all transactions.');
        setAllUserTxns([]);
    } finally {
        setIsAllTxnsLoading(false);
    }
  }, []);
  // --- End Fetch All Buy Txns ---
  
  const handleEditTxnClick = (transaction: Schema['Transaction']) => {
    console.log('Editing transaction:', transaction);
    setTxnToEdit(transaction);
    setIsEditingTxn(true);
    // Optional: Scroll to the form or display it prominently
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUpdateTransaction = async (updatedTxnDataFromForm: Schema['Transaction']) => {
    // updatedTxnDataFromForm comes directly from the form's onUpdate prop
    // It should already contain the ID and all calculated/updated fields
    console.log('Attempting to update transaction with data from form:', updatedTxnDataFromForm);
    setTxnError(null);
    //setIsLoading(true); // Add loading state indication maybe
  
    try {
      // We expect updatedTxnDataFromForm to have the required structure, including 'id'
      // The 'as any' can help bypass TS issues if the exact type still mismatches update's expectation
      const { data: updatedTxn, errors } = await client.models.Transaction.update(updatedTxnDataFromForm as any);
  
      if (errors) throw errors;
  
      console.log('Transaction updated successfully:', updatedTxn);
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
    console.log(`Attempting to delete transaction with id: ${idToDelete}`);
    setTxnError(null); // Clear previous errors
  
    try {
      const { errors } = await client.models.Transaction.delete({ id: idToDelete });
  
      if (errors) {
        console.error('Error deleting transaction:', errors);
        setTxnError(errors[0]?.message || 'Failed to delete transaction.');
      } else {
        console.log('Transaction deleted successfully!');
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
  const fetchTransactions = useCallback(async () => {
    if (!stockId) return; // Don't fetch if stockId isn't available yet

    setIsTxnLoading(true);
    setTxnError(null);
    try {
      console.log(`Workspaceing transactions for stockId: ${stockId}`);
      // List transactions, filtering by portfolioStockId and sorting by date descending
      const { data: fetchedTxns, errors } = await client.models.Transaction.list({
        filter: { portfolioStockId: { eq: stockId } },
        //sort: (t) => t.date('DESC'), // Sort newest first
         // Select specific fields if needed
         selectionSet: [
          'id', 'date', 'action', 'signal', 'price', 'investment',
          'quantity', 'playShares', 'holdShares', 'lbd', 'tp', 'completedTxnId',
          'sharesType', 'txnProfit'
      ]
      });

      if (errors) throw errors;

      setTransactions(fetchedTxns as TransactionDataType[]);
      console.log('Fetched transactions:', fetchedTxns);

    } catch (err: any) {
      console.error('Error fetching transactions:', err);
      setTxnError(err.message || 'Failed to load transactions.');
      setTransactions([]);
    } finally {
      setIsTxnLoading(false);
    }
  }, [stockId]); // Dependency array includes stockId
  // --- End Fetch Transactions Function ---

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
      client.models.PortfolioStock.get({ id: stockId }, { selectionSet: ['symbol', 'budget'] })
        .then(({ data, errors }) => {
          if (data) {
            setStockSymbol(data.symbol ?? undefined);
            setStockBudget(data.budget);
            fetchUserGoals();
            fetchAllUserTransactions();
          }
          if (errors) console.error("Error fetching stock symbol/budget", errors);
        });
    }
  }, [stockId, fetchUserGoals, fetchAllUserTransactions]);
  
  // --- Fetch Transactions on Initial Load or when stockId changes ---
  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]); // Call fetchTransactions when it's available/changes
  // --- End Initial Fetch ---


  if (!stockId) {
    return <p>Stock ID not found.</p>;
  }

  return (
    <div>
      <h1>
        Add Transaction {stockSymbol ? `for ${stockSymbol.toUpperCase()}` : ''}
      </h1>
      <div style={{ marginBottom: '1.5rem', padding: '10px'}}>
        {(isGoalsLoading || isAllTxnsLoading) ? (
          <p>Loading stats...</p>
        ) : (          
          <div style={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap' }}>
            <div style={{ flexBasis: '30%', minWidth: '150px' }}>
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
            </div>  
            <div style={{ flexBasis: '30%', minWidth: '150px', paddingLeft: '15px' }}>
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
            </div>
            <div style={{ flexBasis: '30%', minWidth: '150px', paddingLeft: '15px' }}>
              {isTxnLoading ? ( <p>Calculating share counts...</p>) : (
                <>
                  <p>
                    Play Shares: <strong>{currentPlayShares.toFixed(5)}</strong>
                  </p>
                  <p>
                    Hold Shares: <strong>{currentHoldShares.toFixed(5)}</strong>
                  </p>
                  <p>
                    Total Shares: <strong>{totalCurrentShares.toFixed(5)}</strong>
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

      
      {/* --- Add Column Toggle Checkboxes --- */}
      <div style={{ marginBottom: '1rem', padding: '10px', border: '1px solid #eee' }}>
        <strong>Toggle Columns:</strong>
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
            {/* Simple formatting for the label */}
            {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
          </label>
        ))}
      </div>
      {/* --- End Column Toggle Checkboxes --- */}
      
      
      {/* --- Add Transaction List/Table Below Form --- */}
      <div style={{ marginTop: '3rem' }}>
        <h2>Recent Transactions {stockSymbol ? `for ${stockSymbol.toUpperCase()}` : ''}</h2>

        {isTxnLoading && <p>Loading transactions...</p>}
        {txnError && <p style={{ color: 'red' }}>Error loading transactions: {txnError}</p>}

        {!isTxnLoading && !txnError && (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
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
                {columnVisibility.playShares && <th style={{ padding: '5px' }}>P-Shs</th>}
                {columnVisibility.holdShares && <th style={{ padding: '5px' }}>H-Shs</th>}
                {columnVisibility.totalShares && <th style={{ padding: '5px' }}>T-Shs</th>}
                {columnVisibility.lbd && <th style={{ padding: '5px' }}>LBD</th>}
                <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestTxnSort('tp')}>
                  TP {txnSortConfig?.key === 'tp' ? (txnSortConfig.direction === 'ascending' ? '▲' : '▼') : null}
                </th>
                {columnVisibility.txnProfit && <th style={{ padding: '5px' }}>Txn Profit</th>}
                {columnVisibility.completedTxnId && <th style={{ padding: '5px' }}>Completed Txn Id</th>}
                <th style={{ padding: '5px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={14} style={{ textAlign: 'center', padding: '1rem' }}>
                    No transactions found for this stock.
                  </td>
                </tr>
              ) : (
                sortedTransactions.map((txn) => (
                  
                  <tr key={txn.id} style={{ borderBottom: '1px solid #eee' }}>
                    
                    <td style={{ padding: '5px' }}>{txn.date}</td>
                    
                    {columnVisibility.txnId && <td style={{ padding: '5px' }}>{txn.id || '--'}</td>}
                    
                    <td style={{ padding: '5px' }}>{txn.action}</td>
                    
                    {columnVisibility.signal && <td style={{ padding: '5px' }}>{txn.signal || '--'}</td>}
                    
                    <td style={{ padding: '5px' }}>{txn.price?.toFixed(2) ?? '--'}</td>
                    {columnVisibility.investment && <td style={{ padding: '5px' }}>{txn.investment?.toFixed(2) ?? '--'}</td>}
                    {columnVisibility.playShares && <td style={{ padding: '5px' }}>{getPlaySharesDisplay(txn) ?? '--'}</td>}
                    {columnVisibility.holdShares && <td style={{ padding: '5px' }}>{getHoldSharesDisplay(txn) ?? '--'}</td>}
                    {columnVisibility.totalShares && <td style={{ padding: '5px' }}>{txn.quantity?.toFixed(5) ?? '--'}</td>}
                    {columnVisibility.lbd && <td style={{ padding: '5px' }}>{txn.lbd?.toFixed(2) ?? '--'}</td>}
                    
                    <td style={{ padding: '5px' }}>{txn.tp?.toFixed(2) ?? '--'}</td>
                    {columnVisibility.txnProfit && <td style={{ padding: '5px' }}>{getTxnProfitDisplay(txn) ?? '--'}</td>}                    
                    {columnVisibility.completedTxnId && <td style={{ padding: '5px' }}>{txn.completedTxnId ?? '--'}</td>}
                    
                    
                    <td style={{ padding: '5px', textAlign: 'center' }}>
                        {/* Edit Button placeholder */}
                        <button
                            onClick={() => handleEditTxnClick(txn as any)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '5px', marginRight: '5px', color: 'blue' }}
                            title="Edit Transaction"
                        >
                            <FaEdit />
                        </button>
                        {/* Delete Button */}
                        <button
                            
                            onClick={() => handleDeleteTransaction(txn.id)} // Call delete handler
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '5px', color: 'red' }}
                            title="Delete Transaction"
                        >
                            <FaTrashAlt />
                        </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
      {/* --- End Transaction List --- */}

    </div>
  );
}