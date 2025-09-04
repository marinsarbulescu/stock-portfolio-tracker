// app/(authed)/wallets/[stockId]/components/WalletsAddEditTransactionForm.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { type Schema } from '@/amplify/data/resource'; // Adjust path if needed
import { generateClient } from 'aws-amplify/data';
import { calculateSingleSalePL, calculateSingleSalePLWithCommission } from '@/app/utils/financialCalculations';
import { processTransactionCashFlow } from '@/app/utils/stockCashFlowManager';
import { FETCH_LIMIT_WALLETS_GENEROUS } from '@/app/config/constants';

const client = generateClient<Schema>();

// Define the accurate item types
type TransactionItem = Schema['Transaction'];
//type PortfolioStockItem = Schema['PortfolioStock'];
type TransactionDataType = Schema['Transaction']['type'];
type TransactionUpdatePayload = Partial<TransactionDataType> & { id: string };
//type StockWalletDataType = Schema['StockWallet']['type']; // Needed for type checking

// Define props for the component
interface TransactionFormProps {
  portfolioStockId: string;
  portfolioStockSymbol?: string;
  onTransactionAdded?: () => void;
  forceAction?: Schema['Transaction']['type']['action'];
  showCancelButton?: boolean;
  onCancel?: () => void;
  isEditMode?: boolean;
  initialData?: Partial<TransactionItem['type']> | null;
  onUpdate?: (updatedData: unknown) => Promise<void>;
}

// Define Buy Type options
type BuyTypeValue = 'Swing' | 'Hold' | 'Split';

// const SHARE_PRECISION = 5;
// const CURRENCY_PRECISION = 2;
// const SHARE_EPSILON = 1 / (10**(SHARE_PRECISION + 2)); // For zero-checking

import {
    SHARE_PRECISION,
    CURRENCY_PRECISION,
    PERCENT_PRECISION,
    SHARE_EPSILON,
    //CURRENCY_EPSILON,
    //PERCENT_EPSILON // Import if your logic uses it
} from '@/app/config/constants';

// Default values for resetting the form
const defaultFormState = {
  date: '',
  action: 'Buy' as Schema['Transaction']['type']['action'],
  signal: undefined as Schema['Transaction']['type']['signal'] | undefined,
  price: '',
  investment: '',
  amount: '', // For Dividend and SLP transactions
  sharesInput: '', // Used for Sell quantity display in Edit mode
  completedTxnId: '', // Used for Sell linking/profit calc
  buyType: 'Split' as BuyTypeValue, // Default Buy Type
};

// Helper function to get today's date in YYYY-MM-DD format
const getTodayDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};


export default function TransactionForm({
  portfolioStockId,
  portfolioStockSymbol,
  onTransactionAdded,
  forceAction,
  showCancelButton = false,
  onCancel,
  isEditMode = false,
  initialData = null,
  onUpdate
}: TransactionFormProps) {

  // --- State for form fields ---
  const [date, setDate] = useState(defaultFormState.date);
  const [action, setAction] = useState<Schema['Transaction']['type']['action']>(defaultFormState.action);
  const [signal, setSignal] = useState<Schema['Transaction']['type']['signal'] | undefined>(defaultFormState.signal);
  const [price, setPrice] = useState(defaultFormState.price);
  const [investment, setInvestment] = useState(defaultFormState.investment);
  const [amount, setAmount] = useState(defaultFormState.amount);
  const [sharesInput, setSharesInput] = useState(defaultFormState.sharesInput);
  const [completedTxnId, setCompletedTxnId] = useState(defaultFormState.completedTxnId);
  const [buyType, setBuyType] = useState<BuyTypeValue>(defaultFormState.buyType);

  // --- State for Stock Split specific fields ---
  const [splitRatio, setSplitRatio] = useState('2'); // Default 2:1 split

  const [warning, setWarning] = useState<string | null>(null);

  //console.log("[TransactionForm Render] Component rendering. Current warning state:", warning);
  
  // State for submission status
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // --- Effect to populate form for editing or set defaults ---
  useEffect(() => {
    //console.log("[TransactionForm useEffect] Running effect, clearing messages. Mode:", isEditMode, "Initial Data:", initialData);
    setError(null);
    setSuccess(null);
    setWarning(null);
    if (isEditMode && initialData) {
      // Populate state from initialData for editing
      setDate(initialData.date ?? getTodayDateString());
      setAction(initialData.action ?? defaultFormState.action);
      setSignal(initialData.signal ?? defaultFormState.signal);
      setPrice(initialData.price?.toString() ?? defaultFormState.price);
      setInvestment(initialData.investment?.toString() ?? defaultFormState.investment);
      setAmount(initialData.amount?.toString() ?? defaultFormState.amount);
      setSharesInput(initialData.quantity?.toString() ?? defaultFormState.sharesInput);
      setCompletedTxnId(initialData.completedTxnId ?? defaultFormState.completedTxnId);
      setBuyType((initialData.txnType as BuyTypeValue) ?? defaultFormState.buyType);
      const splitRatioValue = initialData.splitRatio?.toString() ?? '2';
      setSplitRatio(splitRatioValue); // Initialize split ratio from data
    } else {
      // Reset form for Add mode
      setDate(getTodayDateString());
      setAction(forceAction ?? defaultFormState.action);
      setSignal(defaultFormState.signal);
      setPrice(defaultFormState.price);
      setInvestment(defaultFormState.investment);
      setAmount(defaultFormState.amount);
      setSharesInput(defaultFormState.sharesInput);
      setCompletedTxnId(defaultFormState.completedTxnId);
      setBuyType(defaultFormState.buyType);
      setSplitRatio('2'); // Reset to default 2:1 split
    }
  }, [isEditMode, initialData, forceAction]);
  // --- End Effect ---

  // Additional useEffect to ensure split ratio updates when initialData changes
  useEffect(() => {
    if (isEditMode && initialData && initialData.action === 'StockSplit' && initialData.splitRatio) {
      console.log('[DEBUG StockSplit] Additional useEffect - updating split ratio:', { from: splitRatio, to: initialData.splitRatio.toString() });
      setSplitRatio(initialData.splitRatio.toString());
    }
  }, [isEditMode, initialData?.splitRatio, initialData?.action]);


  // Handle form submission
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    setWarning(null);

    // --- Validation ---
    if (!date || (!isEditMode && !portfolioStockId) || !action) { setError('Date, Action required.'); setIsLoading(false); return; }
    if ((action === 'Buy' || action === 'Div') && !investment) { setError('Investment/Amount required for Buy/Dividend.'); setIsLoading(false); return; }
    if ((action === 'SLP') && !amount) { setError('Amount required for Stock Lending Payment.'); setIsLoading(false); return; }
    if ((action === 'Buy' || action === 'Sell') && !price) { setError('Price required for Buy/Sell.'); setIsLoading(false); return; }
    if (action === 'Buy' && !buyType) { setError('Please select a Buy Type.'); setIsLoading(false); return; }
    if (action === 'StockSplit' && (!splitRatio || parseFloat(splitRatio) <= 0)) { setError('Split Ratio must be greater than 0.'); setIsLoading(false); return; }
    // --- End Validation ---


    // --- Parse Inputs ---
    const priceValue = price ? parseFloat(price) : undefined;
    const investmentValue = investment ? parseFloat(investment) : undefined;
    const amountValue = amount ? parseFloat(amount) : undefined;
    const splitRatioValue = splitRatio ? parseFloat(splitRatio) : undefined;

    // --- Initialize derived fields ---
    let quantity_raw: number | undefined | null = null; // Raw total quantity
    let quantity_final: number | undefined | null = null; // Rounded total quantity
    let quantity: number | undefined | null = null;    
    let calculatedSwingShares_raw: number | undefined | null = null;
    let calculatedHoldShares_raw: number | undefined | null = null;
    let calculatedSwingShares_final: number | undefined | null = null;
    let calculatedHoldShares_final: number | undefined | null = null;

    let lbd_raw: number | undefined | null = null;
    let tp_raw: number | undefined | null = null;
    let lbd_final: number | undefined | null = null;
    let tp_final: number | undefined | null = null;

    let pdpValue: number | null | undefined = null;
    let stpValue: number | null | undefined = null;
    let stockCommissionValue: number | null | undefined = null;


    // --- Calculations for Buy action ---
    if (action === 'Buy') {
        if (investmentValue && priceValue && priceValue > 0) {
          quantity_raw = investmentValue / priceValue; // Calculate raw total quantity

          // --- Round TOTAL quantity ---
          const roundedQuantity = parseFloat(quantity_raw.toFixed(SHARE_PRECISION));
          quantity_final = (Math.abs(roundedQuantity) < SHARE_EPSILON) ? 0 : roundedQuantity;
          //console.log(`Calculated Quantity - Raw: ${quantity_raw}, Rounded: ${quantity_final}`);
          // --- End Rounding ---
        } else {
            setError("Investment and positive Price are required to calculate quantity for Buy.");
            setIsLoading(false); return;        }

        // Fetch stock details (ratio, pdp, stp)
        let ratio = 1.0; // Default to 100% Swing
        try {
            //console.log("Fetching stock details for ratio/TP/LBD...");
            const { data: stock } = await client.models.PortfolioStock.get(
                { id: portfolioStockId }, { selectionSet: ['swingHoldRatio', 'pdp', 'stp', 'stockCommission'] }
            );
            pdpValue = (stock as unknown as { pdp?: number })?.pdp;
            stpValue = (stock as unknown as { stp?: number })?.stp;
            stockCommissionValue = (stock as unknown as { stockCommission?: number })?.stockCommission;

            if (buyType === 'Split') {
                if (typeof (stock as unknown as { swingHoldRatio?: number })?.swingHoldRatio === 'number' && (stock as unknown as { swingHoldRatio: number }).swingHoldRatio >= 0 && (stock as unknown as { swingHoldRatio: number }).swingHoldRatio <= 100) {
                    ratio = (stock as unknown as { swingHoldRatio: number }).swingHoldRatio / 100.0;
                    //console.log(`Using fetched ratio for split: ${ratio * 100}% Swing`);
                } else {
                    ratio = 0.5; // Default 50/50 if type is Split but ratio missing/invalid
                    console.warn(`Swing/Hold ratio not found or invalid for stock, using default 50/50 split.`);
                }
            } else if (buyType === 'Hold') {
                ratio = 0.0; // 0% Swing (100% Hold)
            } // Default ratio remains 1.0 (100% Swing) for 'Swing' type            // Calculate LBD/TP
            if (typeof pdpValue === 'number' && typeof stpValue === 'number' && priceValue) {
              // Calculate target LBD (without commission adjustment)
              const targetLBD = priceValue - (priceValue * (pdpValue / 100));
              
              // Apply commission adjustment to LBD if commission is available and > 0
              if (typeof stockCommissionValue === 'number' && stockCommissionValue > 0) {
                const commissionRate = stockCommissionValue / 100;
                
                // Prevent division by zero or extreme values
                if (commissionRate >= 1) {
                  console.warn(`Commission rate (${stockCommissionValue}%) is too high, using target LBD without adjustment`);
                  lbd_raw = targetLBD;
                } else {
                  // Commission-adjusted LBD: targetLBD / (1 + commissionRate)
                  // This ensures that LBD + commission = target LBD
                  lbd_raw = targetLBD / (1 + commissionRate);
                  console.log(`[LBD Debug] Target LBD: ${targetLBD}, Commission: ${stockCommissionValue}%, Commission-adjusted LBD: ${lbd_raw}`);
                }
              } else {
                // No commission or invalid commission, use target LBD
                lbd_raw = targetLBD;
              }
              
              // Calculate base TP using new STP formula
              const baseTP = priceValue + (priceValue * (stpValue / 100));
                // Apply commission adjustment to TP if commission is available and > 0
              if (typeof stockCommissionValue === 'number' && stockCommissionValue > 0) {
                const commissionRate = stockCommissionValue / 100;
                
                // Prevent division by zero or negative values
                if (commissionRate >= 1) {
                  console.warn(`Commission rate (${stockCommissionValue}%) is too high, using base TP calculation`);
                  tp_raw = baseTP;
                } else {
                  // Commission-adjusted TP: baseTP / (1 - commissionRate)
                  tp_raw = baseTP / (1 - commissionRate);
                }
              } else {
                // No commission or invalid commission, use base TP
                tp_raw = baseTP;
              }

              // --- Round LBD/TP (Optional but good practice for currency) ---
              lbd_final = parseFloat(lbd_raw.toFixed(CURRENCY_PRECISION));
              // TP needs higher precision (4 decimals) to avoid $0.01 discrepancy when selling at commission-adjusted TP
              tp_final = parseFloat(tp_raw.toFixed(4)); // Use 4 decimal places for TP precision
              // --- End Rounding ---
            } else { 
                //console.log("Could not calculate LBD/TP (PDP/STP invalid or price missing)"); 
            }

        } catch (fetchErr: unknown) {
            console.error("Error fetching stock data", fetchErr);
            setError(`Could not fetch stock details. ${(fetchErr as Error).message}`);
            setIsLoading(false); return;
        }

        // Calculate share splits USING ROUNDED TOTAL quantity
        if (quantity_final && quantity_final > 0) {
          calculatedSwingShares_raw = quantity_final * ratio;
          calculatedHoldShares_raw = quantity_final * (1 - ratio);

          // --- Round SPLIT shares ---
          const roundedSwing = parseFloat(calculatedSwingShares_raw.toFixed(SHARE_PRECISION));
          const roundedHold = parseFloat(calculatedHoldShares_raw.toFixed(SHARE_PRECISION));

          calculatedSwingShares_final = (Math.abs(roundedSwing) < SHARE_EPSILON) ? 0 : roundedSwing;
          calculatedHoldShares_final = (Math.abs(roundedHold) < SHARE_EPSILON) ? 0 : roundedHold;

          // --- Consistency Check (Optional) ---
          // If the sum of rounded parts doesn't match the rounded total, adjust slightly
          const roundedSum = calculatedSwingShares_final + calculatedHoldShares_final;
          if (Math.abs(roundedSum - quantity_final) > SHARE_EPSILON / 10) { // Use smaller tolerance for check
               console.warn(`Adjusting split shares slightly due to rounding (Total: ${quantity_final}, Sum: ${roundedSum})`);
               // Example: Adjust the larger portion (or hold shares)
               calculatedHoldShares_final = quantity_final - calculatedSwingShares_final;
               // Re-round the adjusted value just in case
               const reRoundedHold = parseFloat(calculatedHoldShares_final.toFixed(SHARE_PRECISION));
               calculatedHoldShares_final = (Math.abs(reRoundedHold) < SHARE_EPSILON) ? 0 : reRoundedHold;

          }
          //console.log(`Calculated Split - Swing Raw: ${calculatedSwingShares_raw}, Hold Raw: ${calculatedHoldShares_raw}`);
          //console.log(`Calculated Split - Swing Rounded: ${calculatedSwingShares_final}, Hold Rounded: ${calculatedHoldShares_final}`);
          // --- End Rounding Split Shares ---
        }
    }
    // --- End Buy action calculations ---


    // --- TxnProfit Calculation (Enhanced for Sell Edits) ---
    let txnProfit: number | null = null;
    let calculatedTxnProfitPercent: number | null = null;
    
    if (isEditMode && action === 'Sell') {
        const originalPrice = initialData?.price;
        const newPrice = priceValue;
        const currentQuantity = sharesInput ? parseFloat(sharesInput) : initialData?.quantity;
        
        // Check if price changed
        if (typeof originalPrice === 'number' && typeof newPrice === 'number' && 
            Math.abs(originalPrice - newPrice) > 0.0001) {
            
            console.log("[Sell Edit] Price changed, recalculating P/L...");
            
            // Fetch wallet buy price using completedTxnId
            if (completedTxnId && currentQuantity) {
                try {
                    const { data: wallet } = await client.models.StockWallet.get(
                        { id: completedTxnId },
                        { selectionSet: ['buyPrice'] }
                    );
                    
                    if ((wallet as unknown as { buyPrice?: number })?.buyPrice && typeof (wallet as unknown as { buyPrice: number }).buyPrice === 'number') {
                        // Fetch stock commission for commission-adjusted P/L calculation
                        let stockCommissionValue = 0;
                        try {
                            const { data: stock } = await client.models.PortfolioStock.get(
                                { id: portfolioStockId },
                                { selectionSet: ['stockCommission'] }
                            );
                            stockCommissionValue = (stock as unknown as { stockCommission?: number })?.stockCommission ?? 0;
                        } catch (error) {
                            console.warn("[Sell Edit] Could not fetch stock commission, using 0:", error);
                        }
                        
                        // Recalculate P/L using new price with commission adjustment
                        txnProfit = calculateSingleSalePLWithCommission(newPrice, (wallet as unknown as { buyPrice: number }).buyPrice, currentQuantity, stockCommissionValue);
                        
                        // Calculate percentage
                        const costBasis = (wallet as unknown as { buyPrice: number }).buyPrice * currentQuantity;
                        calculatedTxnProfitPercent = costBasis !== 0 ? (txnProfit / costBasis) * 100 : 0;
                        
                        console.log(`[Sell Edit] Recalculated P/L: ${txnProfit}, %: ${calculatedTxnProfitPercent}`);
                    } else {
                        console.warn("[Sell Edit] Could not fetch wallet buy price");
                        txnProfit = initialData?.txnProfit ?? null;
                        calculatedTxnProfitPercent = initialData?.txnProfitPercent ?? null;
                    }
                } catch (error) {
                    console.error("[Sell Edit] Error fetching wallet:", error);
                    txnProfit = initialData?.txnProfit ?? null;
                    calculatedTxnProfitPercent = initialData?.txnProfitPercent ?? null;
                }
            } else {
                txnProfit = initialData?.txnProfit ?? null;
                calculatedTxnProfitPercent = initialData?.txnProfitPercent ?? null;
            }
        } else {
            // Price didn't change, keep original values
            txnProfit = initialData?.txnProfit ?? null;
            calculatedTxnProfitPercent = initialData?.txnProfitPercent ?? null;
        }
        
        quantity = currentQuantity;
    }
    // --- End TxnProfit ---

    // --- Cash flow is now handled at stock level, not per transaction ---
    const outOfPocketValue = null;  // No longer calculated per transaction
    const cashBalanceValue = null;  // No longer calculated per transaction

    // --- Prepare Final Payload for Transaction (using FINAL rounded values) ---
    const finalPayload: Partial<Omit<TransactionDataType, 'id' | 'portfolioStock' | 'createdAt' | 'updatedAt' | 'owner'>> = {
        date: date,
        action: action as Schema['Transaction']['type']['action'],
        signal: (action === 'Div' || (action as string) === 'SLP' || action === 'StockSplit') ? undefined : (signal || undefined), // No signal for Dividend, SLP, and StockSplit transactions
        price: (action === 'StockSplit') ? undefined : priceValue, // StockSplit doesn't use price field
        investment: (action === 'Buy') && typeof investmentValue === 'number' // Only Buy uses investment field
         ? parseFloat(investmentValue.toFixed(CURRENCY_PRECISION))
         : null, // Keep null if not Buy or if investmentValue isn't a number
        amount: (action === 'Div' || action === 'SLP') && typeof (action === 'Div' ? investmentValue : amountValue) === 'number'
         ? parseFloat(((action === 'Div' ? investmentValue : amountValue) as number).toFixed(CURRENCY_PRECISION))
         : null, // Store Div amounts from investment field, SLP amounts from amount field
        quantity: action === 'Sell' ? quantity : 
                 action === 'StockSplit' ? undefined : // StockSplit uses splitRatio field instead
                 quantity_final, // Use quantity_final for Buy/Div
        // Stock Split specific fields
        splitRatio: (action === 'StockSplit') ? splitRatioValue : undefined,
        swingShares: (action === 'Buy') ? calculatedSwingShares_final : null, // Use FINAL rounded swing shares
        holdShares: (action === 'Buy') ? calculatedHoldShares_final : null, // Use FINAL rounded hold shares
        txnType: (action === 'Buy') ? buyType : undefined,
        lbd: (action === 'Buy') ? lbd_final : null, // Only Buy uses LBD
        tp: (action === 'Buy') ? tp_final : null,   // Only Buy uses TP
        completedTxnId: (action === 'Sell') ? (completedTxnId || undefined) : undefined,
        txnProfit: (action === 'Sell') ? txnProfit : null, // Only Sell uses txnProfit
        txnProfitPercent: (action === 'Sell') ? calculatedTxnProfitPercent : null, // Only Sell uses txnProfitPercent
        // Cash flow fields removed - now handled at stock level
    };
    // --- End Payload Prep ---

    // --- Submit Logic ---
    try {
        let savedTransaction: TransactionDataType | null = null;

        if (isEditMode) {
            // --- UPDATE ---
            if (!initialData?.id || !onUpdate) throw new Error('Missing ID or update handler for edit.');
            const updatePayload: TransactionUpdatePayload = {
                id: initialData.id,
                portfolioStockId: portfolioStockId, // Include Stock ID in update
                ...finalPayload // Spread the prepared fields
            };
            //console.log("Submitting Update Payload:", updatePayload);
            console.log('[DEBUG StockSplit] Transaction update payload being sent to database:', updatePayload);
            if (action === 'StockSplit') {
                console.log('[DEBUG StockSplit] StockSplit update details:', { splitRatioValue, fromForm: splitRatio, inPayload: updatePayload.splitRatio });
            }
            
            savedTransaction = { ...initialData, ...updatePayload };

            // ================================================================
            // === START: WALLET UPDATE LOGIC ON TRANSACTION EDIT =============
            // ================================================================

            // Only attempt wallet updates if the edited action is still 'Buy'
            if (savedTransaction && savedTransaction.action === 'Buy') {
              //console.log("[Edit Wallet Logic] Checking if wallet update is needed for edited Buy txn...");

              // --- Safety Checks ---
              // 1. Did Buy Price or Buy Type change? If so, DO NOT auto-update wallet.
              //    (Requires complex reconciliation - warn user instead)
              //    Compare using tolerance for price.
              const epsilon = 0.0001;
              const priceChanged = typeof initialData?.price !== 'number' || typeof savedTransaction.price !== 'number' || Math.abs(initialData.price - savedTransaction.price) > epsilon;
              const buyTypeChanged = initialData?.txnType !== savedTransaction.txnType;

              if (priceChanged || buyTypeChanged) {
                  console.warn("[Edit Wallet Logic] Buy Price or Buy Type changed. Skipping automatic wallet update. Manual reconciliation may be needed.");
                  setWarning("Transaction updated, but Buy Price/Type changed; associated wallet(s) were NOT automatically updated.");
              } else {
                  // --- Price and Type are the SAME - Proceed to check/update wallet ---

                  // <<< --- ADD Ratio Calculation HERE --- >>>
                  let ratio = 1.0; // Default (e.g., 100% Swing or 50/50) if fetch fails or no ratio
                  try {
                       //console.log("[Edit Wallet Logic] Fetching stock ratio for investment split...");
                       const { data: stock } = await client.models.PortfolioStock.get(
                           { id: portfolioStockId },
                           { selectionSet: ['swingHoldRatio'] }
                       );
                       //console.log(`[Edit Wallet Logic] Fetched stock.swingHoldRatio: ${(stock as unknown as { swingHoldRatio?: number })?.swingHoldRatio}`);
                       if (typeof (stock as unknown as { swingHoldRatio?: number })?.swingHoldRatio === 'number' && (stock as unknown as { swingHoldRatio: number }).swingHoldRatio >= 0 && (stock as unknown as { swingHoldRatio: number }).swingHoldRatio <= 100) {
                           ratio = (stock as unknown as { swingHoldRatio: number }).swingHoldRatio / 100.0;
                       } else {
                          //console.warn("[Edit Wallet Logic] swingHoldRatio not found/invalid, deciding default ratio based on buyType...");
                          if (initialData?.txnType === 'Hold') {
                            ratio = 0.0;
                          } else if (initialData?.txnType === 'Swing') {
                              ratio = 1.0;
                          } else { // Split or unknown - default to 50/50? or 100% Swing?
                              ratio = 0.5; // Defaulting to 50/50 for investment delta if ratio missing on SPLIT edit
                          }
                       }
                   } catch (fetchErr) {
                       console.error("[Edit Wallet Logic] Failed to fetch stock ratio, using default ratio.", fetchErr);
                       ratio = 0.5; // Use default on error
                   }
                   //console.log(`[Edit Wallet Logic] Using ratio: ${ratio} for investment delta split.`);
                  // <<< --- END Ratio Calculation --- >>>

                  // Calculate *changes* in shares based on the update
                  const initialSwing = (initialData?.swingShares ?? 0);
                  const initialHold = (initialData?.holdShares ?? 0);
                  const newSwing = (savedTransaction.swingShares ?? 0);
                  const newHold = (savedTransaction.holdShares ?? 0);
                  const deltaSwing = newSwing - initialSwing;
                  const deltaHold = newHold - initialHold;

                  // Calculate *change* in investment
                  const initialInvestment = (initialData?.investment ?? 0);
                  const newInvestment = (savedTransaction.investment ?? 0);
                  const deltaInvestment = newInvestment - initialInvestment;

                  // Helper to find and update a specific typed wallet IF no sales occurred
                  // Helper to find and update a specific typed wallet IF no sales occurred
                  const updateWalletIfNoSales = async (
                    type: 'Swing' | 'Hold',
                    shareDelta: number,
                    investmentDelta: number
                  ) => {
                    // Only proceed if there's a change for this type
                    if (Math.abs(shareDelta) < epsilon && Math.abs(investmentDelta) < epsilon) return;

                    // Use the ORIGINAL price from the transaction being edited to find the wallet
                    const originalBuyPrice = initialData?.price;
                    if (typeof originalBuyPrice !== 'number') {
                         console.warn(`[Edit Wallet Logic - ${type}] Cannot find wallet - original transaction price is invalid.`);
                         setWarning(prev => prev ? `${prev} | Cannot find ${type} wallet (invalid original price).` : `Cannot find ${type} wallet (invalid original price).`);
                         return;
                    }

                    //console.log(`[Edit Wallet Logic - ${type}] Delta detected (Shares: ${shareDelta}, Inv: ${investmentDelta}). Checking wallet for price ${originalBuyPrice}...`);

                    // Inside updateWalletIfNoSales helper function

                  try {
                    // 1. Fetch candidate wallets for this stock and type (BROADER filter)
                    //console.log(`[Edit Wallet Helper - ${type}] Fetching candidates for stock ${portfolioStockId}, type ${type}...`);
                    const { data: candidates, errors: listErrors } = await client.models.StockWallet.list({
                        filter: { and: [
                            { portfolioStockId: { eq: portfolioStockId } },
                            { walletType: { eq: type } }
                            // REMOVED buyPrice filter here
                        ]},
                        selectionSet: ['id', 'buyPrice', 'sharesSold', 'sellTxnCount', 'totalSharesQty', 'totalInvestment', 'remainingShares'], // Ensure all needed fields fetched
                        limit: 500 // Fetch candidates (adjust limit if needed)
                    });

                    if (listErrors) throw listErrors; // Handle list errors
                    //console.log(`[Edit Wallet Helper - ${type}] Found ${candidates?.length ?? 0} candidates. Searching for match with price ${originalBuyPrice}...`);

                    // 2. Find matching wallet in code using tolerance
                    const epsilon = 0.0001;
                    // --- Use .find() on the fetched candidates ---
                    const walletToUpdate = (candidates || []).find(wallet => {
                        const isPriceValid = wallet.buyPrice != null && typeof wallet.buyPrice === 'number';
                        const priceDifference = isPriceValid ? Math.abs(wallet.buyPrice! - originalBuyPrice) : Infinity;
                        const isCloseEnough = priceDifference < epsilon;
                        // Optional Log: console.log(`[Find Check - ${type}] Wallet ${wallet.id}, DB Price ${wallet.buyPrice}, Target ${originalBuyPrice}, Match: ${isCloseEnough}`);
                        return isPriceValid && isCloseEnough;
                    });
                    //console.log(`[Edit Wallet Helper - ${type}] Result of find():`, walletToUpdate ? `Found ID ${walletToUpdate.id}` : 'Not Found');


                    // 3. Proceed with logic using the wallet found by .find()
                    if (!walletToUpdate) {
                        // Log warning and return (treat as non-critical failure for this helper)
                        console.warn(`[Edit Wallet Helper - ${type}] Wallet not found matching Buy Price ${originalBuyPrice}. Cannot update.`);
                        setWarning(prev => prev ? `${prev} | ${type} wallet not found.` : `${type} wallet not found for update.`);
                        return true;
                    }

                    // 4. Check for sales on the found wallet
                    if ((walletToUpdate.sharesSold ?? 0) > epsilon || (walletToUpdate.sellTxnCount ?? 0) > 0) {
                        // Log warning and return (treat as non-critical failure)
                        console.warn(`[Edit Wallet Helper - ${type}] Wallet ${walletToUpdate.id} has sales recorded. Skipping automatic update.`);
                        setWarning(prev => prev ? `${prev} | ${type} wallet has sales, not updated.` : `${type} wallet has sales, not updated.`);
                        return true;
                    }

                    // 5. No sales - Apply updates
                    //console.log(`[Edit Wallet Helper - ${type}] No sales detected for wallet ${walletToUpdate.id}. Applying updates...`);
                    const currentTotalShares = walletToUpdate.totalSharesQty ?? 0;
                    const currentInvestment = walletToUpdate.totalInvestment ?? 0;
                    const currentRemaining = walletToUpdate.remainingShares ?? 0;
                    // Calculate new values using deltas passed to the helper
                    const newTotalShares = Math.max(0, currentTotalShares + shareDelta);
                    const newInvestment = Math.max(0, currentInvestment + investmentDelta);
                    const newRemaining = Math.max(0, currentRemaining + shareDelta);

                    // Safety check results
                    if(newRemaining < -epsilon || newTotalShares < -epsilon) { throw new Error("Negative shares calculation error."); }
                    if (Math.abs(newRemaining - newTotalShares) > epsilon) { console.warn(`Potential inconsistency in remaining shares calculation for ${type} wallet ${walletToUpdate.id}.`); }


                    // Prepare the explicit payload
                    const walletUpdatePayload = {
                        id: walletToUpdate.id,
                        totalSharesQty: newTotalShares,
                        totalInvestment: newInvestment,
                        remainingShares: newRemaining,
                        sharesSold: 0, // Still 0
                        realizedPl: 0, // Still 0
                        sellTxnCount: 0, // Still 0
                        realizedPlPercent: 0, // Still 0
                    };
                    //console.log(`[Edit Wallet Helper - ${type}] Update Payload:`, walletUpdatePayload);
                    const { errors: updateErrors } = await client.models.StockWallet.update(walletUpdatePayload);
                    if (updateErrors) throw updateErrors; // Throw actual error if update fails
                    //console.log(`[Edit Wallet Helper - ${type}] Wallet update successful.`);
                    return true; // Indicate success

                } catch (err: unknown) { // Catch errors from list, update, or calculations
                    console.error(`[Edit Wallet Helper - ${type}] FAILED:`, (err as {errors?: unknown[]}).errors || err);
                    setWarning(prev => prev ? `${prev} | Failed to update ${type} wallet.` : `Failed to update ${type} wallet.`);
                    return false; // Indicate critical failure for this wallet update attempt
                }
                }; // End helper function

                  // Call helper for Swing and Hold wallets
                  await updateWalletIfNoSales('Swing', deltaSwing, deltaInvestment * (ratio)); // Distribute investment delta proportionally
                  await updateWalletIfNoSales('Hold', deltaHold, deltaInvestment * (1 - ratio)); // Use 'ratio' calculated earlier in handleSubmit

              } // End if Price/Type didn't change
          } // End if action === 'Buy'

          // ================================================================
          // === WALLET UPDATE LOGIC FOR SELL TRANSACTION EDITS ============
          // ================================================================

          if (savedTransaction && savedTransaction.action === 'Sell') {
              const originalPrice = initialData?.price;
              const newPrice = savedTransaction.price;
              const originalTxnProfit = initialData?.txnProfit ?? 0;
              const newTxnProfit = savedTransaction.txnProfit ?? 0;
              
              // Check if price changed (and thus P/L changed)
              if (typeof originalPrice === 'number' && typeof newPrice === 'number' && 
                  Math.abs(originalPrice - newPrice) > 0.0001) {
                  
                  console.log("[Sell Edit] Updating wallet P/L due to price change...");
                  
                  const walletId = savedTransaction.completedTxnId;
                  if (walletId) {
                      try {
                          // Fetch current wallet state
                          const { data: wallet, errors: fetchErrors } = await client.models.StockWallet.get(
                              { id: walletId },
                              { selectionSet: ['realizedPl', 'realizedPlPercent', 'sharesSold', 'buyPrice'] }
                          );
                          
                          if (fetchErrors) throw fetchErrors;
                          if (!wallet) throw new Error(`Wallet ${walletId} not found`);
                          
                          // Calculate the P/L difference
                          const plDifference = newTxnProfit - originalTxnProfit;
                          
                          // Update wallet P/L
                          const newRealizedPl = ((wallet as unknown as { realizedPl?: number }).realizedPl ?? 0) + plDifference;
                          
                          // Recalculate wallet P/L percentage
                          const totalCostBasis = ((wallet as unknown as { buyPrice?: number }).buyPrice ?? 0) * ((wallet as unknown as { sharesSold?: number }).sharesSold ?? 0);
                          const newRealizedPlPercent = totalCostBasis !== 0 ? (newRealizedPl / totalCostBasis) * 100 : 0;
                          
                          // Update wallet
                          const { errors: updateErrors } = await client.models.StockWallet.update({
                              id: walletId,
                              realizedPl: parseFloat(newRealizedPl.toFixed(CURRENCY_PRECISION)),
                              realizedPlPercent: parseFloat(newRealizedPlPercent.toFixed(PERCENT_PRECISION))
                          });
                          
                          if (updateErrors) throw updateErrors;
                          
                          console.log(`[Sell Edit] Wallet ${walletId} P/L updated: ${newRealizedPl}`);
                          
                      } catch (walletError: unknown) {
                          console.error("[Sell Edit] Failed to update wallet P/L:", walletError);
                          setWarning("Transaction updated, but wallet P/L update failed. Please check wallet manually.");
                      }
                  }
              }
          } // End if action === 'Sell'

          // ================================================================
          // === END: WALLET UPDATE LOGIC FOR SELL TRANSACTION EDITS =======
          // ================================================================

          // ================================================================
          // === END: WALLET UPDATE LOGIC ON TRANSACTION EDIT ===============
          // ================================================================

          // Now call parent's update handler after all wallet updates are complete
          await onUpdate(updatePayload); // Call parent's update handler
          setSuccess('Transaction updated successfully!');

        } else {
            // --- CREATE ---
            const createPayload = {
                portfolioStockId: portfolioStockId,
                ...finalPayload
            };
            
            // Enhanced logging for Stock Split transactions
            if (action === 'StockSplit') {
                console.log('[DEBUG StockSplit] Transaction update payload:', finalPayload);
                console.log('[DEBUG StockSplit] Split ratio being saved:', { splitRatioValue, fromForm: splitRatio });
                console.log('[StockSplit] Final payload:', finalPayload);
                console.log('[StockSplit] Create payload:', createPayload);
                console.log('[StockSplit] Action value:', action, 'Type:', typeof action);
            }
            
            // Use type assertion temporarily if strict type checking causes issues with optional fields
            const { errors, data: newTransaction } = await client.models.Transaction.create(createPayload as Parameters<typeof client.models.Transaction.create>[0]);
            if (errors) throw errors;

            if (!newTransaction) {
              throw new Error("Transaction creation failed unexpectedly: No data returned.");
            }

            setSuccess('Transaction added successfully!');
            savedTransaction = newTransaction; // Store the newly created transaction

            // === UPDATE STOCK CASH FLOW TOTALS (New Simplified Logic) ===
            try {
                // Prepare transaction data for cash flow calculation
                let transactionCashFlow = null;

                if (action === 'Buy') {
                    transactionCashFlow = {
                        action: action,
                        investmentAmount: investmentValue || 0
                    };
                } else if (action === 'Sell') {
                    const saleProceeds = (priceValue || 0) * (quantity || 0);
                    transactionCashFlow = {
                        action: action,
                        saleProceeds: saleProceeds
                    };
                }
                // For other actions (Div, SLP, StockSplit), no cash flow impact yet

                // Update stock cash flow using the new component
                if (transactionCashFlow) {
                    await processTransactionCashFlow(client, portfolioStockId, transactionCashFlow);
                }
            } catch (stockError) {
                console.error('Error updating stock cash flow:', stockError);
                // Continue anyway - transaction was created successfully
            }
            // === END: UPDATE STOCK CASH FLOW TOTALS ===


            // ============================================================
            // === START: UPDATED WALLET UPDATE/CREATE LOGIC for BUY ====
            // ============================================================
            if (action === 'Buy' && priceValue) {
                //console.log('>>> Buy detected, attempting to create/update TYPED StockWallet(s)...');

                // Helper function to create/update typed wallets (REVISED CHECK LOGIC)
                const createOrUpdateWallet = async (
                  type: 'Swing' | 'Hold',
                  sharesToAdd: number | null | undefined,
                  investmentToAdd_raw: number // Proportional investment
              ) => {
                  // Use a small tolerance for floating point comparison
                  const epsilon = SHARE_EPSILON;
                  if (!sharesToAdd || sharesToAdd <= epsilon) { // Check against tolerance
                      //console.log(`[Wallet Logic - <span class="math-inline">\{type\}\] No significant shares to add \(</span>{sharesToAdd}). Skipping wallet.`);
                      return;
                  }
                  // Ensure priceValue is valid before proceeding
                  if (typeof priceValue !== 'number') {
                       console.error(`[Wallet Logic - <span class="math-inline">\{type\}\] Invalid priceValue \(</span>{priceValue}), cannot process wallet.`);
                       throw new Error(`Cannot process ${type} wallet due to invalid price.`);
                  }

                  // --- Round Investment to Add ---
                  const roundedInvestmentToAdd = parseFloat(investmentToAdd_raw.toFixed(CURRENCY_PRECISION));
                  //console.log(`[Wallet Logic - ${type}] Processing... Shares: ${sharesToAdd}, Investment: ${roundedInvestmentToAdd}, Price: ${priceValue}`);
                  // --- End Rounding ---

                  try {
                      // 1. Fetch candidate wallets for this stock and type (BROADER filter)
                      //console.log(`[Wallet Logic - ${type}] Fetching candidate wallets (Stock: ${portfolioStockId}, Type: ${type})...`);
                      const { data: candidates, errors: listErrors } = await client.models.StockWallet.list({
                          filter: { and: [
                              { portfolioStockId: { eq: portfolioStockId } },
                              { walletType: { eq: type } }
                              // REMOVED buyPrice filter here
                          ]},
                           // Fetch necessary fields for update/check
                          selectionSet: ['id', 'buyPrice', 'totalSharesQty', 'totalInvestment', 'remainingShares'],
                          limit: 1000 // Fetch candidates
                      });

                      if (listErrors) throw listErrors; // Handle list errors
                      //console.log(`[Wallet Logic - ${type}] Found ${candidates?.length ?? 0} candidates.`);

                      // 2. Find matching wallet in code using tolerance WITH detailed logging
                      const existingWallet = (candidates || []).find(wallet => {
                          // --- Add Detailed Logs INSIDE find callback ---
                          //console.log(`[Wallet Find Check - ${type}] Comparing Form Price (Value: ${priceValue}, Type: ${typeof priceValue}) with DB Wallet (ID: ${wallet.id}) Price (Value: ${wallet.buyPrice}, Type: ${typeof wallet.buyPrice})`);
                          const isPriceValid = wallet.buyPrice != null && typeof wallet.buyPrice === 'number'; // Check type too
                          const priceDifference = isPriceValid ? Math.abs(wallet.buyPrice! - priceValue) : Infinity;
                          const isCloseEnough = priceDifference < epsilon;
                          //console.log(`[Wallet Find Check - ${type}] DB Price Valid: ${isPriceValid}, Price Difference: <span class="math-inline">\{priceDifference\}, Is Close Enough \(<</span>{epsilon}): ${isCloseEnough}`);
                          // --- End Detailed Logs ---
                          return isPriceValid && isCloseEnough; // Return boolean result
                      });
                      //console.log(`[Wallet Logic - ${type}] Result of find():`, existingWallet ? `Found ID ${existingWallet.id}` : 'Not Found');

                      if (existingWallet) {
                          // 3a. Update existing wallet (Apply Rounding to final totals)
                          //console.log(`[Wallet Logic - ${type}] Found existing wallet ${existingWallet.id}. Updating...`);
                          const currentTotalShares = existingWallet.totalSharesQty ?? 0;
                          const currentInvestment = existingWallet.totalInvestment ?? 0;
                          const currentRemaining = existingWallet.remainingShares ?? 0;

                          // Calculate NEW totals
                          const newTotalShares_raw = currentTotalShares + sharesToAdd;
                          const newInvestment_raw = currentInvestment + roundedInvestmentToAdd;
                          const newRemaining_raw = currentRemaining + sharesToAdd;

                          // ROUND final totals before saving
                          const finalTotalShares = parseFloat(newTotalShares_raw.toFixed(SHARE_PRECISION));
                          const finalInvestment = parseFloat(newInvestment_raw.toFixed(CURRENCY_PRECISION));
                          const finalRemainingShares = parseFloat(newRemaining_raw.toFixed(SHARE_PRECISION));

                          // Recalculate TP for updated wallet using the same logic as new wallets
                          let updatedTpValue = null;
                          if (finalTotalShares > 0 && finalInvestment > 0 && typeof stpValue === 'number' && stpValue > 0) {
                              const avgBuyPrice = finalInvestment / finalTotalShares;
                              const baseTP = avgBuyPrice + (avgBuyPrice * (stpValue / 100));
                              
                              // Apply commission adjustment if available (use the same stockCommissionValue from earlier fetch)
                              if (typeof stockCommissionValue === 'number' && stockCommissionValue > 0) {
                                  const commissionRate = stockCommissionValue / 100;
                                  if (commissionRate >= 1) {
                                      updatedTpValue = baseTP;
                                  } else {
                                      updatedTpValue = baseTP / (1 - commissionRate);
                                  }
                              } else {
                                  updatedTpValue = baseTP;
                              }
                              updatedTpValue = parseFloat(updatedTpValue.toFixed(4)); // Use 4 decimal places for TP precision
                          }

                          const updatePayload = {
                              id: existingWallet.id,
                              totalSharesQty: (Math.abs(finalTotalShares) < epsilon) ? 0 : finalTotalShares,
                              totalInvestment: (Math.abs(finalInvestment) < 0.001) ? 0 : finalInvestment, // Currency epsilon
                              remainingShares: (Math.abs(finalRemainingShares) < epsilon) ? 0 : finalRemainingShares,
                              tpValue: updatedTpValue, // Add recalculated TP
                          };
                          const { errors: updateErrors } = await client.models.StockWallet.update(updatePayload);
                          if (updateErrors) throw updateErrors;
                          //console.log(`[Wallet Logic - ${type}] Update SUCCESS`);
                      } else {
                          // 3b. Create new wallet (use rounded values directly)
                          //console.log(`[Wallet Logic - ${type}] No existing wallet found. Creating new...`);
                          // Fetch PDP/STP (use previously fetched values)
                          // Use rounded TP if available
                          const createPayload = {
                              portfolioStockId: portfolioStockId,
                              walletType: type,
                              buyPrice: priceValue, // Use the price from the form
                              totalSharesQty: sharesToAdd, // Already rounded
                              totalInvestment: roundedInvestmentToAdd, // Use rounded investment portion
                              sharesSold: 0,
                              remainingShares: sharesToAdd, // Already rounded
                              realizedPl: 0,
                              sellTxnCount: 0,
                              tpValue: tp_final, // Use rounded TP
                              tpPercent: /* calculate or fetch */ null, // Recalculate if needed
                              realizedPlPercent: 0,
                          };
                          const { errors: createErrors } = await client.models.StockWallet.create(createPayload as Parameters<typeof client.models.StockWallet.create>[0]);
                          if (createErrors) throw createErrors;
                          //console.log(`[Wallet Logic - ${type}] Create SUCCESS`);
                     }
                 } catch (walletError: unknown) {
                     console.error(`[Wallet Logic - ${type}] FAILED:`, (walletError as {errors?: unknown[]}).errors || walletError);
                     throw new Error(`Transaction saved, but failed to create/update ${type} wallet: ${(walletError as Error).message}`);
                 }
             }; // End createOrUpdateWallet function

                // Calculate proportional investment
                const totalInvestmentValue = investmentValue ?? 0;
                const totalCalcQuantity = quantity_final ?? 0; // Use rounded total quantity
                let swingInvestment_raw = 0;
                let holdInvestment_raw = 0;

                if (totalCalcQuantity > SHARE_EPSILON && totalInvestmentValue > 0) {
                     // Use FINAL rounded shares for proportion calculation
                    swingInvestment_raw = (calculatedSwingShares_final && calculatedSwingShares_final > 0) ? (calculatedSwingShares_final / totalCalcQuantity) * totalInvestmentValue : 0;
                    holdInvestment_raw = (calculatedHoldShares_final && calculatedHoldShares_final > 0) ? (calculatedHoldShares_final / totalCalcQuantity) * totalInvestmentValue : 0;
                     // Adjust raw values for rounding (sum should equal total investment)
                    if(Math.abs((swingInvestment_raw + holdInvestment_raw) - totalInvestmentValue) > 0.0001) { // Small tolerance
                        holdInvestment_raw = totalInvestmentValue - swingInvestment_raw;
                    }
                }

                // Call update/create, passing ROUNDED shares and RAW proportional investment
                await createOrUpdateWallet('Swing', calculatedSwingShares_final ?? 0, swingInvestment_raw);
                await createOrUpdateWallet('Hold', calculatedHoldShares_final ?? 0, holdInvestment_raw);

            } // End if (action === 'Buy') wallet logic
            // ============================================================
            // === END: UPDATED WALLET UPDATE/CREATE LOGIC ================
            // ============================================================

            // ============================================================
            // === START: STOCK SPLIT WALLET UPDATE LOGIC =================
            // ============================================================
            if (action === 'StockSplit' && splitRatioValue) {
                console.log('[StockSplit] Processing wallet updates for stock split...');
                
                try {
                    // Fetch all existing wallets for this stock
                    const { data: existingWallets, errors: fetchErrors } = await client.models.StockWallet.list({
                        filter: { portfolioStockId: { eq: portfolioStockId } },
                        selectionSet: [
                            'id', 'buyPrice', 'totalSharesQty', 'remainingShares', 
                            'totalInvestment', 'sharesSold', 'realizedPl', 'sellTxnCount', 
                            'realizedPlPercent', 'walletType', 'tpValue', 'tpPercent'
                        ],
                        limit: FETCH_LIMIT_WALLETS_GENEROUS // Ensure all wallets are found for stock split
                    });
                    
                    if (fetchErrors) {
                        console.error('[StockSplit] Error fetching wallets:', fetchErrors);
                        throw fetchErrors;
                    }
                    
                    if (!existingWallets || existingWallets.length === 0) {
                        console.log('[StockSplit] No wallets found to update for stock split');
                        return;
                    }
                    
                    console.log(`[StockSplit] Found ${existingWallets.length} wallets to update`);
                    
                    // Process each wallet: apply split adjustments using direct database updates
                    // Note: We use direct updates here instead of adjustWalletContribution because:
                    // 1. Stock splits affect ALL existing wallets proportionally (not single contributions)
                    // 2. We need to modify buyPrice (price per share) which adjustWalletContribution doesn't handle
                    // 3. adjustWalletContribution is designed for delta-based changes, not proportional scaling
                    // 4. Split adjustments require scaling existing values, not adding/subtracting new ones
                    for (const wallet of existingWallets) {
                        if (!wallet.id) continue;
                        
                        const originalBuyPrice = wallet.buyPrice || 0;
                        const originalTotalShares = wallet.totalSharesQty || 0;
                        const originalRemainingShares = wallet.remainingShares || 0;
                        const originalSharesSold = wallet.sharesSold || 0;
                        
                        // Calculate split-adjusted values
                        const adjustedBuyPrice = originalBuyPrice / splitRatioValue;
                        const adjustedTotalShares = originalTotalShares * splitRatioValue;
                        const adjustedRemainingShares = originalRemainingShares * splitRatioValue;
                        const adjustedSharesSold = originalSharesSold * splitRatioValue;
                        
                        // Update TP value if it exists (also needs split adjustment)
                        const originalTpValue = wallet.tpValue || 0;
                        const adjustedTpValue = originalTpValue > 0 ? originalTpValue / splitRatioValue : 0;
                        
                        console.log(`[StockSplit] Updating wallet ${wallet.id}:`, {
                            buyPrice: `${originalBuyPrice} → ${adjustedBuyPrice}`,
                            totalShares: `${originalTotalShares} → ${adjustedTotalShares}`,
                            remainingShares: `${originalRemainingShares} → ${adjustedRemainingShares}`,
                            sharesSold: `${originalSharesSold} → ${adjustedSharesSold}`,
                            tpValue: `${originalTpValue} → ${adjustedTpValue}`
                        });
                        
                        // Prepare wallet update payload
                        const walletUpdatePayload = {
                            id: wallet.id,
                            buyPrice: adjustedBuyPrice,
                            totalSharesQty: adjustedTotalShares,
                            remainingShares: adjustedRemainingShares,
                            sharesSold: adjustedSharesSold,
                            tpValue: adjustedTpValue,
                            // Keep other fields unchanged
                            totalInvestment: wallet.totalInvestment, // Investment amount stays the same
                            realizedPl: wallet.realizedPl, // P/L dollar amount stays the same
                            sellTxnCount: wallet.sellTxnCount,
                            realizedPlPercent: wallet.realizedPlPercent, // Percentage stays the same
                            walletType: wallet.walletType,
                            tpPercent: wallet.tpPercent
                        };
                        
                        // Update the wallet in the database
                        const { errors: updateErrors } = await client.models.StockWallet.update(walletUpdatePayload);
                        if (updateErrors) {
                            console.error(`[StockSplit] Error updating wallet ${wallet.id}:`, updateErrors);
                            throw updateErrors;
                        }
                        
                        console.log(`[StockSplit] Successfully updated wallet ${wallet.id}`);
                    }
                    
                    console.log('[StockSplit] All wallets updated successfully for stock split');
                    
                } catch (splitError) {
                    console.error('[StockSplit] Error updating wallets for stock split:', splitError);
                    throw new Error(`Stock split transaction saved, but failed to update wallets: ${(splitError as Error).message}`);
                }
            } // End if (action === 'StockSplit') wallet logic
            // ============================================================
            // === END: STOCK SPLIT WALLET UPDATE LOGIC ===================
            // ============================================================

            // Reset form only on successful CREATE
            setDate(getTodayDateString());
            setAction(forceAction ?? defaultFormState.action);
            setSignal(defaultFormState.signal);
            setPrice(defaultFormState.price);
            setInvestment(defaultFormState.investment);
            setSharesInput(defaultFormState.sharesInput);
            setCompletedTxnId(defaultFormState.completedTxnId);
            setBuyType(defaultFormState.buyType);
            setSplitRatio('2'); // Reset to default 2:1 split
        }

        // Call success callback if provided (outside create/update blocks)
        //console.log("[TransactionForm Edit] Finished wallet updates (if any). Calling onTransactionAdded callback...");
        onTransactionAdded?.();

    } catch (err: unknown) {
        // Enhanced error logging for Stock Split
        if (action === 'StockSplit') {
            console.error('[StockSplit] Error saving transaction:', err);
        }
        // Attempt to parse Amplify errors which might be an array
        const errorObj = err as {errors?: Array<{message: string}>};
        let message = '';
        if (Array.isArray(errorObj.errors) && errorObj.errors[0]?.message) {
            message = errorObj.errors[0].message;
        } else if ((err as Error).message) {
            message = (err as Error).message;
        } else {
            message = JSON.stringify(err);
        }
        setError(message);
        setSuccess(null); // Clear success message on error
    } finally {
        setIsLoading(false);
    }
}; // End handleSubmit


  // --- JSX Rendering ---
  // Includes all fields and buttons now
  return (
    <form data-testid="transaction-form-modal" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '450px', margin: 'auto' }}>
        {/* Use passed symbol for title, fallback if needed */}
        <h2>{isEditMode ? `Edit Transaction` : `Add Transaction${portfolioStockSymbol ? ` for ${portfolioStockSymbol.toUpperCase()}` : ''}`}</h2>
        {/* Display messages */}
        {error && <p style={{ color: '#ff4d4d', background: '#331a1a', padding: '8px', borderRadius: '4px', border: '1px solid #663333', margin: '0 0 10px 0', fontSize: '0.9em' }}>Error: {error}</p>}
        {warning && <p style={{ color: 'red', background: 'red', padding: '8px', borderRadius: '4px', border: '1px solid #665500', margin: '0 0 10px 0', fontSize: '0.9em' }}>Warning: {warning}</p>}
        {success && <p style={{ color: '#4dff4d', background: '#1a331a', padding: '8px', borderRadius: '4px', border: '1px solid #336633', margin: '0 0 10px 0', fontSize: '0.9em' }}>{success}</p>}

        {/* --- Input Fields --- */}
        <div>
            <label htmlFor="date" style={{display:'block', marginBottom:'3px'}}>Date:</label>
            <input 
                data-testid="txn-form-date"
                id="date" 
                type="date" 
                value={date} 
                onChange={(e) => setDate(e.target.value)} 
                required 
                disabled={isLoading} 
                style={{width: '100%', padding: '8px'}} />
        </div>

        {/* --- MODIFIED ACTION FIELD --- */}
        {forceAction ? (
                <div>
                    <label style={{display:'block', marginBottom:'3px'}}>Action:</label>
                    <p 
                        data-testid="txn-form-action-display" // New data-testid for static display
                        style={{ padding: '8px', border: '1px solid #333', borderRadius: '4px', margin: 0, background: '#1e1e1e' }}
                    >
                        {action} {/* This will display the value from the 'action' state, which is set by forceAction */}
                    </p>
                </div>
            ) : (
                // Only show the dropdown if action is not forced
                <div>
                    <label htmlFor="action" style={{display:'block', marginBottom:'3px'}}>Action:</label>
                    <select 
                        data-testid="txn-form-action" // Keep this for when dropdown is shown
                        id="action" 
                        value={action} 
                        onChange={(e) => {
                            const newAction = e.target.value as Schema['Transaction']['type']['action'];
                            setAction(newAction);
                            // Clear signal when switching to Dividend or SLP (since they don't use signals)
                            if (newAction === 'Div' || newAction === 'SLP') {
                                setSignal(undefined);
                            }
                        }} 
                        required 
                        // Original disabled logic: isLoading || !!forceAction || isEditMode
                        // Since this block only runs if !forceAction, we simplify:
                        disabled={isLoading || isEditMode} // Still disabled in edit mode as per original logic
                        style={{ width: '100%', padding: '8px' }}>
                        {/* Options are only needed if not forceAction */}
                        <option value="Buy">Buy</option>
                        <option value="Sell">Sell</option>
                        <option value="Div">Dividend</option>
                        <option value="SLP">Stock Lending Payment</option>
                        <option value="StockSplit">Stock Split</option>
                    </select>
                </div>
        )}
        {/* --- END MODIFIED ACTION FIELD --- */}

        {/* Buy Type Selection */}
        {action === 'Buy' && !isEditMode && (
             <div style={{marginTop: '5px', padding: '10px', border: '1px solid #444', borderRadius: '4px'}}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Buy Type:</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 15px' }}>
                    <label style={{cursor: 'pointer'}}>
                        <input 
                            data-testid="txn-form-txnType-swing"
                            type="radio" 
                            name="buyType" 
                            value="Swing" 
                            checked={buyType === 'Swing'} 
                            onChange={(e) => setBuyType(e.target.value as BuyTypeValue)} 
                            disabled={isLoading} />
                                Swing
                    </label>
                    <label style={{cursor: 'pointer'}}>
                        <input 
                            data-testid="txn-form-txnType-hold"
                            type="radio" 
                            name="buyType" 
                            value="Hold" 
                            checked={buyType === 'Hold'} 
                            onChange={(e) => setBuyType(e.target.value as BuyTypeValue)} 
                            disabled={isLoading} /> 
                                Hold
                    </label>
                    <label style={{cursor: 'pointer'}}>
                        <input 
                            data-testid="txn-form-txnType-split"
                            type="radio" 
                            name="buyType" 
                            value="Split" 
                            checked={buyType === 'Split'} 
                            onChange={(e) => setBuyType(e.target.value as BuyTypeValue)} 
                            disabled={isLoading} /> 
                                Split (Auto)
                    </label>
                </div>
             </div>
        )}

        {/* Signal Field - exclude Dividends and SLP as they don't need signals */}
        {(action === 'Buy' || action === 'Sell') && (
            <div>
                <label htmlFor="signal" style={{display:'block', marginBottom:'3px'}}>Signal:</label>
                <select 
                    data-testid="txn-form-signal"
                    id="signal" 
                    value={signal ?? ''} 
                    onChange={(e) => setSignal(e.target.value as Schema['Transaction']['type']['signal'] | undefined)} 
                    required={true} 
                    disabled={isLoading} 
                    style={{ width: '100%', padding: '8px' }} >
                        <option value="">-- Select Signal --</option>
                        {action === 'Buy' && <> <option value="_5DD">_5DD</option> <option value="Cust">Cust</option> <option value="Initial">Initial</option> <option value="EOM">EOM</option> <option value="LBD">LBD</option> </>}
                        {action === 'Sell' && <> <option value="Cust">Cust</option> <option value="TPH">TPH</option> <option value="TPP">TPP</option><option value="TP">TP</option> </>}
                </select>
            </div>
        )}

        {/* Price Field */}
        {(action === 'Buy' || action === 'Sell') && (
            <div>
                <label htmlFor="price" style={{display:'block', marginBottom:'3px'}}>Price:</label>
                <input 
                    data-testid="txn-form-price"
                    id="price" 
                    type="number" 
                    step="any" 
                    value={price} 
                    onChange={(e) => setPrice(e.target.value)} 
                    required={true} 
                    placeholder="e.g., 150.25" 
                    disabled={isLoading} 
                    style={{width: '100%', padding: '8px'}} />
            </div>
        )}

        {/* Investment Field */}
        {(action === 'Buy' || action === 'Div') && (
            <div>
                <label htmlFor="investment" style={{display:'block', marginBottom:'3px'}}>{action === 'Div' ? 'Amount:' : 'Investment:'}</label>
                <input 
                    data-testid="txn-form-investment"
                    id="investment" 
                    type="number" 
                    step="any" 
                    value={investment} 
                    onChange={(e) => setInvestment(e.target.value)} 
                    required 
                    placeholder="e.g., 1000.00" 
                    disabled={isLoading} 
                    style={{width: '100%', padding: '8px'}}/>
            </div>
        )}

        {/* Amount Input for SLP transactions */}
        {action === 'SLP' && (
            <div>
                <label htmlFor="amount" style={{display:'block', marginBottom:'3px'}}>Amount:</label>
                <input 
                    data-testid="txn-form-amount"
                    id="amount" 
                    type="number" 
                    step="any" 
                    value={amount} 
                    onChange={(e) => setAmount(e.target.value)} 
                    required 
                    placeholder="e.g., 50.00" 
                    disabled={isLoading} 
                    style={{width: '100%', padding: '8px'}}/>
            </div>
        )}

        {/* Stock Split specific fields */}
        {action === 'StockSplit' && (
            <>
                <div>
                    <label htmlFor="splitRatio" style={{display:'block', marginBottom:'3px'}}>Split Ratio:</label>
                    <input 
                        data-testid="txn-form-split-ratio"
                        id="splitRatio" 
                        type="number" 
                        step="any" 
                        value={splitRatio} 
                        onChange={(e) => {
                            console.log('[DEBUG StockSplit] Split ratio field changed:', { from: splitRatio, to: e.target.value });
                            setSplitRatio(e.target.value);
                        }} 
                        required 
                        placeholder="e.g., 2 for 2:1 split" 
                        disabled={isLoading} 
                        style={{width: '100%', padding: '8px'}}/>
                    <small style={{color: '#888', fontSize: '0.8em'}}>Enter the split multiplier (e.g., 2 for 2:1 split, 3 for 3:1 split)</small>
                </div>
            </>
        )}

        {/* Shares Input (Only for Editing Sell action's quantity) */}
        {isEditMode && action === 'Sell' && (
             <div>
                 <label htmlFor="sharesInput" style={{display:'block', marginBottom:'3px'}}>Shares (Quantity Sold):</label>
                 <input id="sharesInput" type="number" step="any" value={sharesInput} onChange={(e) => setSharesInput(e.target.value)} required placeholder="e.g., 10.5" disabled={isLoading} style={{width: '100%', padding: '8px'}} />
             </div>
        )}

        {/* CompletedTxnId Input (Only for Editing Sell action) */}
         {isEditMode && action === 'Sell' && (
            <div>
                <label htmlFor="completedTxnId" style={{display:'block', marginBottom:'3px'}}>Completed Txn ID (Links to Buy/Wallet):</label>
                <input id="completedTxnId" type="text" value={completedTxnId} onChange={(e) => setCompletedTxnId(e.target.value)} placeholder="ID of original Buy OR StockWallet" disabled={isLoading} style={{width: '100%', padding: '8px'}}/>
            </div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '1rem' }}>
            {showCancelButton && onCancel && (
                <button type="button" onClick={onCancel} disabled={isLoading} style={{ padding: '8px 15px' }}>
                    Cancel
                </button>
            )}
            <button data-testid="txn-form-submit-button" type="submit" disabled={isLoading} style={{ padding: '8px 15px', marginLeft: showCancelButton ? '0' : 'auto' }}>
                {isLoading ? (isEditMode ? 'Updating...' : 'Adding...') : (isEditMode ? 'Update Transaction' : 'Add Transaction')}
            </button>
        </div>
    </form>
  );
} // End of component