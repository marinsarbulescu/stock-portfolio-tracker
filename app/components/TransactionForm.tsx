// app/components/TransactionForm.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { type Schema } from '@/amplify/data/resource'; // Adjust path if needed
import { generateClient } from 'aws-amplify/data';

const client = generateClient<Schema>();

// Define the accurate item types
type TransactionItem = Schema['Transaction'];
type PortfolioStockItem = Schema['PortfolioStock']; // Needed for fetching PDP
// @ts-ignore
type SharesTypeValue = Schema['Transaction']['sharesType'];

// Define props for the component
interface TransactionFormProps {
  portfolioStockId: string; // Always required now
  portfolioStockSymbol?: string;
  onTransactionAdded?: () => void; // Callback for Add mode success
  isEditMode?: boolean;
  initialData?: Partial<TransactionItem> | null;
  onUpdate?: (updatedData: TransactionItem) => Promise<void>;
  onCancel?: () => void;
}

// Define specific types for dropdowns from schema
// @ts-ignore - Acknowledge TS issues with Amplify generated Enum types
type TxnActionValue = Schema['Transaction']['action'];
// @ts-ignore
type TxnSignalValue = Schema['Transaction']['signal'];

// Default values for resetting the form
const defaultFormState = {
  date: '',
  action: 'Buy' as TxnActionValue,
  signal: undefined as TxnSignalValue | undefined,
  price: '',
  investment: '',
  sharesInput: '', // Renamed state for shares input
  completedTxnId: '',
};

export default function TransactionForm({
  portfolioStockId,
  portfolioStockSymbol,
  onTransactionAdded,
  isEditMode = false,
  initialData,
  onUpdate,
  onCancel
}: TransactionFormProps) {

  // State for form fields
  const [date, setDate] = useState(defaultFormState.date);
  const [action, setAction] = useState<TxnActionValue>(defaultFormState.action);
  const [signal, setSignal] = useState<TxnSignalValue | undefined>(defaultFormState.signal);
  const [price, setPrice] = useState(defaultFormState.price);
  const [investment, setInvestment] = useState(defaultFormState.investment);
  const [sharesInput, setSharesInput] = useState(defaultFormState.sharesInput); // Input for Sell action
  const [completedTxnId, setCompletedTxnId] = useState(defaultFormState.completedTxnId);
  const [sharesType, setSharesType] = useState<SharesTypeValue>('Play')

  // State for submission status
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // --- CORRECTED: Effect to populate form for editing ---
  useEffect(() => {
    setError(null); // Clear errors when switching modes/data
    setSuccess(null); // Clear success message
    if (isEditMode && initialData) {
      // Populate state from initialData for editing
      // @ts-ignore
      setDate(initialData.date ?? defaultFormState.date);
      // @ts-ignore
      setAction(initialData.action ?? defaultFormState.action);
      // @ts-ignore
      setSignal(initialData.signal ?? defaultFormState.signal);
      // @ts-ignore
      setPrice(initialData.price?.toString() ?? defaultFormState.price);
      // @ts-ignore
      setInvestment(initialData.investment?.toString() ?? defaultFormState.investment);
      // @ts-ignore
      setSharesInput(initialData.quantity?.toString() ?? defaultFormState.sharesInput); // Populate sharesInput from quantity if editing Sell
      // @ts-ignore
      setCompletedTxnId(initialData.completedTxnId ?? defaultFormState.completedTxnId);
      // @ts-ignore
      setSharesType(initialData.sharesType ?? 'Play');
    } else {
      // Reset form for Add mode
      setDate(defaultFormState.date);
      setAction(defaultFormState.action);
      setSignal(defaultFormState.signal);
      setPrice(defaultFormState.price);
      setInvestment(defaultFormState.investment);
      setSharesInput(defaultFormState.sharesInput);
      setCompletedTxnId(defaultFormState.completedTxnId);
      setSharesType('Play');
    }
  }, [isEditMode, initialData]);
  // --- End CORRECTED Effect ---






  // Handle form submission
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    // --- Validation ---
    if (!date || (!isEditMode && !portfolioStockId) || !action) {
      setError('Date, Action required. Stock context must be provided when adding.');
      setIsLoading(false); return;
    }
    if (action === 'Sell' && !sharesInput) {
      setError('Shares are required for Sell transactions.');
      setIsLoading(false); return;
    }
    if ((action === 'Buy' || action === 'Div') && !investment) {
        setError('Investment/Amount is required for Buy/Dividend transactions.');
        setIsLoading(false); return;
    }
     if ((action === 'Buy' || action === 'Sell') && !price) {
        setError('Price is required for Buy/Sell transactions.');
        setIsLoading(false); return;
    }
     if (action === 'Sell' && !completedTxnId) {
        // Optional: Make completedTxnId required? Or just recommended?
        // setError('Completed Txn ID is required for Sell transactions.');
        // setIsLoading(false); return;
    }

    // --- Parse Inputs ---
    const priceValue = price ? parseFloat(price) : undefined;
    const investmentValue = investment ? parseFloat(investment) : undefined;
    const sharesInputValue = sharesInput ? parseFloat(sharesInput) : undefined;

    // --- Add Log 1: Check initial values ---
    console.log(`handleSubmit triggered. isEditMode: ${isEditMode}, action: ${action}, priceValue: ${priceValue}`);

    // --- Calculate Derived Fields ---
    let quantity: number | undefined | null = null; // Use null for DB
    let playShares: number | undefined | null = null;
    let holdShares: number | undefined | null = null;
    let lbd: number | undefined | null = null;
    let tp: number | undefined | null = null; // TP logic still TBD

    if (action === 'Buy') {
      if (investmentValue && priceValue && priceValue !== 0) {
        quantity = investmentValue / priceValue;
      }
    } else if (action === 'Sell') {
      quantity = sharesInputValue;
    } // Div quantity remains null

    if (quantity) {
      playShares = quantity / 2;
      holdShares = quantity / 2;
    }

    // --- Calculate LBD & TP (Requires fetching PortfolioStock PDP and PLR) ---
    if (action === 'Buy' && priceValue) {
      try {
        console.log(`>>> Fetching PDP and PLR for stock ID: ${portfolioStockId}`); // --- Add Log 3 ---   
        const { data: stockData } = await client.models.PortfolioStock.get({ id: portfolioStockId }, { selectionSet: ['pdp', 'plr'] });

        // --- Add Log 4: Check fetch result ---
        console.log('>>> Fetched stock data for LBD and TP:', stockData);

        const pdpValue = stockData?.pdp;
        const plrValue = stockData?.plr;
        if (typeof pdpValue === 'number' && typeof plrValue === 'number') {
          lbd = priceValue - (priceValue * (pdpValue / 100));
          console.log(`>>> LBD calculated: ${lbd}`); // --- Add Log 5 ---
          tp = priceValue + (priceValue * (pdpValue * plrValue / 100))
          console.log(`>>> TP calculated: ${tp}`); // --- Add Log 5 ---
        } else {
          console.log('>>> PDP or PLR value was not a number:', pdpValue); // --- Add Log 6 ---
        }
      } catch (fetchErr) {
          console.warn("Could not fetch stock PDP or PLR for LBD and TP calc", fetchErr);
          // Continue without LBD, or show a warning?
          setError("Warning: Could not fetch stock PDP or PLR to calculate LBD and TP.");
      }
    } else {
        console.log('>>> Condition for LBD and TP calculation NOT met.'); // --- Add Log 7 ---
    }
    // // --- End Calculation Block ---

    // --- **** NEW: Calculate TxnProfit if applicable **** ---
    let txnProfit: number | undefined | null = null;
    if (action === 'Sell' && completedTxnId && priceValue && quantity && playShares) {
      console.log(`>>> Sell action with completedTxnId: ${completedTxnId}. Fetching original Buy...`);
      try {
        // Fetch the original Buy transaction using the ID entered by the user
        const { data: buyTxn, errors: buyErrors } = await client.models.Transaction.get({ id: completedTxnId }, {
          selectionSet: ['investment'] // Only need the investment amount
        });

        if (buyErrors) throw buyErrors; // Pass Amplify errors to main catch

        if (buyTxn) {
          const buyInvestment = typeof buyTxn.investment === 'number' ? buyTxn.investment : null;
          if (buyInvestment !== null) {
            const buyPlayInvestment = buyInvestment / 2;
            const sellRevenue = priceValue * quantity;
            txnProfit = sellRevenue - buyPlayInvestment; // Calculate profit
            console.log(`>>> Calculated TxnProfit: ${txnProfit} (Revenue: ${sellRevenue}, Cost: ${buyInvestment})`);
          } else {
            console.warn(`>>> Original Buy transaction (ID: ${completedTxnId}) found, but has no valid investment amount.`);
            setError("Warning: Could not calculate profit, original Buy investment missing.");
          }
        } else {
          console.warn(`>>> Original Buy transaction (ID: ${completedTxnId}) not found.`);
          setError("Warning: Could not find referenced Buy transaction to calculate profit.");
        }
      } catch (fetchErr: any) {
        console.error("Error fetching referenced Buy transaction:", fetchErr);
        // Decide if you want to block save or just save without profit
        setError(`Warning: Error fetching original Buy txn (${fetchErr.message}). Profit not calculated.`);
      }
    }
    // --- **** End TxnProfit Calculation **** ---


    // --- Prepare Final Payload ---
    const finalPayload = {
        date: date,
        action: action as TxnActionValue,
        // --- Conditionally include fields ---
        signal: signal || undefined, // Include if selected, otherwise undefined
        price: priceValue, // Include if relevant (Buy/Sell/Div usually have price)
        investment: (action === 'Buy' || action === 'Div') ? investmentValue : null, // Store null if not Buy/Div
        quantity: quantity, // Calculated or input quantity (null for Div)
        playShares: playShares,
        holdShares: holdShares,
        lbd: lbd,
        tp: tp, // Store null until logic defined
        sharesType: (action === 'Sell') ? (sharesType as SharesTypeValue) : undefined,
        completedTxnId: (action === 'Sell') ? (completedTxnId || undefined) : undefined, // Only store for Sell
        txnProfit: txnProfit,
        // --- End Conditional ---
    };
    // --- End Payload Prep ---

    // --- Add Log 8: Check final payload before submit ---
    console.log('>>> Final Payload being prepared:', finalPayload);


    // --- Submit Logic ---
    try {
      if (isEditMode) {
        // @ts-ignore
        if (!initialData?.id || !onUpdate) throw new Error('Missing ID or update handler for edit.');
        const updatePayload = {
          // @ts-ignore  
          id: initialData.id,
            portfolioStockId: portfolioStockId, // Include FK
            ...finalPayload
        };
        console.log('>>> Calling onUpdate with payload:', updatePayload); // --- Add Log 9 ---
        console.log('Updating transaction:', updatePayload);
        // @ts-ignore - Bypassing potential mismatch between payload and expected TransactionItem type if TS complains
        await onUpdate(updatePayload as TransactionItem); // Call parent's update handler
        setSuccess('Transaction updated successfully!'); // Set success message locally

      } else {
        // --- CREATE ---
        const createPayload = {
            portfolioStockId: portfolioStockId, // Include FK
            ...finalPayload
        };
        console.log('Creating transaction:', createPayload);
        const { errors, data: newTransaction } = await client.models.Transaction.create(createPayload);
        if (errors) throw errors;

        console.log('Transaction added successfully:', newTransaction);
        setSuccess('Transaction added successfully!');
        // Reset form fields only on successful ADD
        setDate(defaultFormState.date); setAction(defaultFormState.action); setSignal(defaultFormState.signal);
        setPrice(defaultFormState.price); setInvestment(defaultFormState.investment); setSharesInput(defaultFormState.sharesInput);
        setCompletedTxnId(defaultFormState.completedTxnId);
        onTransactionAdded?.(); // Notify parent to refetch lists
      }
    } catch (err: any) {
        console.error("Error saving transaction:", err);
        const errorMessage = Array.isArray(err) ? err[0].message : (err.message || "An unexpected error occurred.");
        setError(errorMessage);
        setSuccess(null); // Clear success on error
    } finally {
      setIsLoading(false);
    }
  }; // End handleSubmit

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '400px' }}>
        {portfolioStockSymbol && !isEditMode && <p>Adding transaction for: <strong>{portfolioStockSymbol.toUpperCase()}</strong></p>}
        {/* @ts-ignore - TS incorrectly thinks id might be missing on initialData */}
        <h2>{isEditMode ? `Edit Transaction (ID: ${initialData?.id ? initialData.id.substring(0, 5) + '...' : 'N/A'})` : 'Add New Transaction'}</h2>
        {error && <p style={{ color: 'red' }}>Error: {error}</p>}
        {success && <p style={{ color: 'green' }}>{success}</p>}

        {/* --- Fields --- */}
        <div><label htmlFor="date">Date:</label><input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required disabled={isLoading} style={{width: '100%'}} /></div>
        <div><label htmlFor="action">Action:</label><select id="action" value={action} onChange={(e) => setAction(e.target.value as TxnActionValue)} required disabled={isLoading} style={{width: '100%'}}><option value="Buy">Buy</option><option value="Sell">Sell</option><option value="Div">Dividend</option></select></div>

        {/* Signal - Conditional Options */}
        <div>
            <label htmlFor="signal">Signal:</label>
            <select id="signal" value={signal ?? ''} onChange={(e) => setSignal(e.target.value as TxnSignalValue || undefined)} required={action !== 'Div'} disabled={isLoading || action === 'Div'} style={{width: '100%'}}>
                <option value="">-- Select Signal --</option>
                {(action === 'Buy') && (<><option value="_5DD">_5DD</option><option value="Cust">Cust</option><option value="Initial">Initial</option><option value="EOM">EOM</option><option value="LBD">LBD</option></>)}
                {(action === 'Sell') && (<><option value="Cust">Cust</option><option value="TPH">TPH</option><option value="TPP">TPP</option></>)}
                {(action === 'Div') && (<option value="Div">Div</option>)}
            </select>
        </div>

        {/* Price - Required for Buy/Sell */}
        {(action === 'Buy' || action === 'Sell') && (
            <div><label htmlFor="price">Price:</label><input id="price" type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} required={action !== 'Div'} placeholder={action === 'Div' ? 'Optional' : 'e.g., 150.25'} disabled={isLoading} style={{width: '100%'}} /></div>
        )}

        {/* Investment/Amount - Required for Buy/Div */}
        {(action === 'Buy' || action === 'Div') && (
            <div><label htmlFor="investment">{action === 'Div' ? 'Amount:' : 'Investment:'}</label><input id="investment" type="number" step="0.01" value={investment} onChange={(e) => setInvestment(e.target.value)} required placeholder="e.g., 1000.00" disabled={isLoading} style={{width: '100%'}}/></div>
        )}

        {/* Shares - Required for Sell */}
        {action === 'Sell' && (
            <div>
              <label htmlFor="sharesInput">Shares:</label>
              <input id="sharesInput" type="number" step="any" value={sharesInput} onChange={(e) => setSharesInput(e.target.value)} required placeholder="e.g., 10.5" disabled={isLoading} style={{width: '100%'}} />
              
              <div style={{marginTop: '0.5rem'}}>
                <label htmlFor="sharesType">Shares Type:</label>
                <select
                  id="sharesType"
                  value={sharesType}
                  onChange={(e) => setSharesType(e.target.value as SharesTypeValue)}
                  required // Required when selling
                  disabled={isLoading}
                  style={{ width: '100%' }}
                >
                  <option value="Play">Play Shares</option>
                  <option value="Hold">Hold Shares</option>
                </select>
              </div>

              <div>
                <label htmlFor="completedTxnId">Completed Txn ID (Optional):</label>
                <input id="completedTxnId" type="text" value={completedTxnId} onChange={(e) => setCompletedTxnId(e.target.value)} placeholder="ID of Buy transaction being closed" disabled={isLoading} style={{width: '100%'}}/>
              </div>
            </div>
        )}

        {/* Buttons */}
        <div style={{ marginTop: '1rem' }}>
            <button type="submit" disabled={isLoading}>{isLoading ? 'Saving...' : (isEditMode ? 'Update Transaction' : 'Add Transaction')}</button>
            {isEditMode && onCancel && (<button type="button" onClick={onCancel} disabled={isLoading} style={{ marginLeft: '10px' }}>Cancel</button>)}
        </div>
    </form>
  );
}