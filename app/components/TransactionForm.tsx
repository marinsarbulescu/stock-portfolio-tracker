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
type TransactionDataType = Schema['Transaction']['type']; 

type TransactionUpdatePayload = Partial<TransactionDataType> & { id: string };

// Define props for the component
interface TransactionFormProps {
  portfolioStockId: string; // Always required now
  portfolioStockSymbol?: string;
  onTransactionAdded?: () => void; // Callback for Add mode success
  isEditMode?: boolean;
  initialData?: Partial<TransactionItem> | null;
  oonUpdate?: (updatePayload: TransactionUpdatePayload) => Promise<void>; 
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
  // @ts-ignore
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
  // Replace the entire handleSubmit function
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    // --- Validation (Existing + sharesType) ---
    if (!date || (!isEditMode && !portfolioStockId) || !action) {
      setError('Date, Action required. Stock context must be provided when adding.');
      setIsLoading(false); return;
    }
    if (action === 'Sell' && !sharesInput) {
      setError('Shares quantity is required for Sell transactions.');
      setIsLoading(false); return;
    }
    if (action === 'Sell' && !sharesType) {
        setError('Shares Type (Play/Hold) is required for Sell transactions.');
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
     // completedTxnId is optional for profit calc

    // --- Parse Inputs (Existing) ---
    const priceValue = price ? parseFloat(price) : undefined; // This is the SELL price for Sell actions
    const investmentValue = investment ? parseFloat(investment) : undefined;
    const sharesInputValue = sharesInput ? parseFloat(sharesInput) : undefined; // This is the quantity for Sell actions

    // --- Calculate Derived Buy Fields (LBD, TP, Buy Shares) (Existing) ---
    let quantity: number | undefined | null = null; // Represents Buy quantity OR Sell quantity
    let playShares: number | undefined | null = null;
    let holdShares: number | undefined | null = null;
    let lbd: number | undefined | null = null;
    let tp: number | undefined | null = null;

    if (action === 'Buy') {
        if (investmentValue && priceValue && priceValue !== 0) {
           quantity = investmentValue / priceValue;
           playShares = quantity / 2;
           holdShares = quantity / 2;
        }
        if (priceValue) {
             try {
                 const { data: stockData } = await client.models.PortfolioStock.get({ id: portfolioStockId }, { selectionSet: ['pdp', 'plr'] });
                 const pdpValue = stockData?.pdp;
                 const plrValue = stockData?.plr;
                 if (typeof pdpValue === 'number' && typeof plrValue === 'number') {
                     lbd = priceValue - (priceValue * (pdpValue / 100));
                     tp = priceValue + (priceValue * (pdpValue * plrValue / 100));
                 }
             } catch (fetchErr) { /* ... error handling ... */ }
        }
    } else if (action === 'Sell') {
        quantity = sharesInputValue; // Sell quantity from input
        playShares = null; holdShares = null; lbd = null; tp = null; // Not applicable to Sell txn record
    }
    // --- End Derived Field Calculation ---


    // --- Calculate TxnProfit and TxnProfitPercent for Sell (Using NEW Logic) ---
    let txnProfit: number | null = null;
    let calculatedTxnProfitPercent: number | null = null;

    // Condition: Is a Sell, has a completedTxnId, has Sell price, has quantity
    if (action === 'Sell' && completedTxnId && priceValue && quantity) {
      //console.log(`>>> Sell action with completedTxnId: ${completedTxnId}. Fetching original Buy price...`);
      try {
        // --- MODIFIED: Fetch original Buy transaction PRICE ---
        const { data: buyTxn, errors: buyErrors } = await client.models.Transaction.get(
            { id: completedTxnId },
            { selectionSet: ['price'] } // <<< Fetch 'price' instead of 'investment'
        );

        if (buyErrors) throw buyErrors;

        // Check if original buy and its price exist and are valid numbers
        if (buyTxn && typeof buyTxn.price === 'number' && buyTxn.price !== null) {
          const originalBuyPrice = buyTxn.price; // Get the original buy price per share

          // --- NEW CALCULATION LOGIC ---
          const sellQuantity = quantity; // Quantity being sold in this transaction
          const sellRevenue = priceValue * sellQuantity; // Revenue from this sale
          const costOfSharesSold = originalBuyPrice * sellQuantity; // Cost of the shares being sold

          txnProfit = sellRevenue - costOfSharesSold; // Calculate profit/loss
          //console.log(`>>> Calculated TxnProfit: ${txnProfit} (Revenue: ${sellRevenue}, Cost: ${costOfSharesSold})`);

          // Calculate Percentage Profit/Loss based on the cost of shares sold
          if (costOfSharesSold !== 0) { // Avoid division by zero
            calculatedTxnProfitPercent = (txnProfit / costOfSharesSold) * 100;
            //console.log(`>>> Calculated TxnProfitPercent: ${calculatedTxnProfitPercent}%`);
          } else {
            calculatedTxnProfitPercent = null;
            //console.log(">>> Cost basis (costOfSharesSold) was zero, cannot calculate TxnProfitPercent.");
          }
          // --- END NEW CALCULATION LOGIC ---

        } else {
          console.warn(`>>> Original Buy (ID: ${completedTxnId}) price not found or invalid.`);
          setError("Warning: Could not calculate profit/percentage, original Buy price missing or invalid.");
          // Keep txnProfit and calculatedTxnProfitPercent as null
        }
      } catch (fetchErr: any) {
        console.error("Error fetching referenced Buy transaction for profit calc:", fetchErr);
        setError(`Warning: Error fetching original Buy txn (${fetchErr.message}). Profit/percentage not calculated.`);
        // Keep txnProfit and calculatedTxnProfitPercent as null
      }
    }
    // --- End TxnProfit Calculation ---


    // --- Prepare Final Payload (No changes needed here, uses calculated variables) ---
    const finalPayload = {
        date: date,
        action: action as TxnActionValue,
        signal: signal || undefined,
        price: priceValue,
        investment: (action === 'Buy' || action === 'Div') ? investmentValue : null,
        quantity: quantity,
        playShares: (action === 'Buy') ? playShares : null,
        holdShares: (action === 'Buy') ? holdShares : null,
        sharesType: (action === 'Sell') ? sharesType : undefined,
        lbd: (action === 'Buy') ? lbd : null,
        tp: (action === 'Buy') ? tp : null,
        completedTxnId: (action === 'Sell') ? (completedTxnId || undefined) : undefined,
        txnProfit: (action === 'Sell') ? txnProfit : null,
        txnProfitPercent: (action === 'Sell') ? calculatedTxnProfitPercent : null,
    };
    // --- End Payload Prep ---

    //console.log('>>> Final Payload being prepared:', finalPayload);

    // --- Submit Logic (Existing) ---
    try {
      if (isEditMode) {
        // --- UPDATE ---
        // @ts-ignore
        if (!initialData?.id || !onUpdate) throw new Error('Missing ID or update handler for edit.');
        const updatePayload: TransactionUpdatePayload = {
          // @ts-ignore
          id: initialData.id,
          portfolioStockId: portfolioStockId,
          ...finalPayload
        };
        await onUpdate(updatePayload); // Call parent's update handler
        setSuccess('Transaction updated successfully!');

      } else {
        // --- CREATE ---
        const createPayload = {
          portfolioStockId: portfolioStockId,
          ...finalPayload
        };
        const { errors, data: newTransaction } = await client.models.Transaction.create(createPayload);
        if (errors) throw errors;
        setSuccess('Transaction added successfully!');
        // Reset form
        setDate(defaultFormState.date); setAction(defaultFormState.action); setSignal(defaultFormState.signal);
        setPrice(defaultFormState.price); setInvestment(defaultFormState.investment); setSharesInput(defaultFormState.sharesInput);
        setCompletedTxnId(defaultFormState.completedTxnId); setSharesType('Play');
        onTransactionAdded?.();
      }
    } catch (err: any) { /* ... error handling ... */ }
    finally {
      setIsLoading(false);
    }
  }; // End handleSubmit

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '400px' }}>
        {portfolioStockSymbol && !isEditMode}
        {/* @ts-ignore - TS incorrectly thinks id might be missing on initialData */}
        <h2>{isEditMode ? `Edit transaction (ID: ${initialData?.id ? initialData.id.substring(0, 5) + '...' : 'N/A'})` : 'Add transaction'}</h2>
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