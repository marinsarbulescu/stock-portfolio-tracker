// app/components/AddStockForm.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { type Schema } from '@/amplify/data/resource'; // Adjust path if needed
import { generateClient } from 'aws-amplify/data';

const client = generateClient<Schema>();

type PortfolioStockDataType = Schema["PortfolioStock"]["type"];
type PortfolioStockUpdateInput = Partial<PortfolioStockDataType> & { id: string };
// Omit 'transactions' and 'stockWallets' as they are relationships, not direct inputs
type PortfolioStockCreateInput = Omit<PortfolioStockDataType, 'id' | 'createdAt' | 'updatedAt' | 'owner' | 'transactions' | 'stockWallets'>;

// Define specific types for dropdowns/enums based on schema
type StockTypeValue = PortfolioStockDataType['stockType'];
type RegionValue = PortfolioStockDataType['region'];

// --- Interface for form state ---
interface DefaultFormStateType {
  symbol: string;
  stockType: StockTypeValue;
  region: RegionValue;
  name: string;
  pdp: string;
  plr: string;
  budget: string;
  swingHoldRatio: string; // <<< ADDED SHR state field
}

// --- Props for the component ---
interface AddStockFormProps {
  onStockAdded?: () => void;
  isEditMode?: boolean;
  initialData?: Partial<PortfolioStockDataType> | null;
  onUpdate?: (updatedData: PortfolioStockUpdateInput) => Promise<void>;
  onCancel?: () => void;
}

// --- Default values for resetting the form ---
const defaultFormState: DefaultFormStateType = {
  symbol: '',
  stockType: 'Stock',
  region: 'US',
  name: '',
  pdp: '',
  plr: '',
  budget: '',
  swingHoldRatio: '', // <<< ADDED SHR default
};

export default function AddStockForm({
  onStockAdded,
  isEditMode = false,
  initialData,
  onUpdate,
  onCancel
}: AddStockFormProps) {

  // --- State for each form field ---
  const [symbol, setSymbol] = useState(defaultFormState.symbol);
  const [stockType, setStockType] = useState<StockTypeValue>(defaultFormState.stockType);
  const [region, setRegion] = useState<RegionValue>(defaultFormState.region);
  const [name, setName] = useState(defaultFormState.name);
  const [pdp, setPdp] = useState(defaultFormState.pdp);
  const [plr, setPlr] = useState(defaultFormState.plr);
  const [budget, setBudget] = useState(defaultFormState.budget);
  const [swingHoldRatio, setSwingHoldRatio] = useState(defaultFormState.swingHoldRatio); // <<< ADDED SHR state

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Effect to populate form using Partial<PortfolioStockDataType> ---
  useEffect(() => {
    setError(null);
    if (isEditMode && initialData) {
      // Populate state from initialData
      setSymbol(initialData.symbol ?? defaultFormState.symbol);
      setName(initialData.name ?? defaultFormState.name);
      setStockType(initialData.stockType ?? defaultFormState.stockType);
      setRegion(initialData.region ?? defaultFormState.region);
      setPdp(initialData.pdp?.toString() ?? defaultFormState.pdp);
      setPlr(initialData.plr?.toString() ?? defaultFormState.plr);
      setBudget(initialData.budget?.toString() ?? defaultFormState.budget);
      setSwingHoldRatio(initialData.swingHoldRatio?.toString() ?? defaultFormState.swingHoldRatio); // <<< ADDED Populating SHR
    } else {
      // Reset form for Add mode
      setSymbol(defaultFormState.symbol);
      setStockType(defaultFormState.stockType);
      setRegion(defaultFormState.region);
      setName(defaultFormState.name);
      setPdp(defaultFormState.pdp);
      setPlr(defaultFormState.plr);
      setBudget(defaultFormState.budget);
      setSwingHoldRatio(defaultFormState.swingHoldRatio); // <<< ADDED Resetting SHR
    }
  }, [isEditMode, initialData]);
  // --- End Effect ---

  // Handle form submission
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    // --- Basic Validation ---
    if (!symbol || !stockType || !region) { /* ... */ }
    // Optional: Add validation for SHR (e.g., must be between 0 and 100)
    const shrValue = swingHoldRatio ? parseFloat(swingHoldRatio) : null;
    if (shrValue !== null && (isNaN(shrValue) || shrValue < 0 || shrValue > 100)) {
         setError('Swing-Hold Ratio must be a number between 0 and 100.');
         setIsLoading(false); return;
     }
    // --- End Validation ---

    // --- Prepare data payload (plain object with correct types) ---
    const stockDataPayload = {
      symbol: symbol.toUpperCase(),
      stockType: stockType as StockTypeValue,
      region: region as RegionValue,
      name: name || undefined,
      pdp: pdp ? parseFloat(pdp) : null,
      plr: plr ? parseFloat(plr) : null,
      budget: budget ? parseFloat(budget) : null,
      swingHoldRatio: shrValue, // <<< ADDED SHR value (already parsed or null)
      // isHidden will default to false based on schema if not provided
    };
    // --- End Payload Prep ---

    // --- Submit Logic ---
    try {
      if (isEditMode) {
        // --- UPDATE ---
        // ID comes from initialData prop passed during edit click
        // We know initialData exists because isEditMode is true (based on useEffect dependency)
        // But initialData could still be null technically if passed incorrectly - safer check:
        if (!initialData?.id || !onUpdate) {
             throw new Error('Cannot update: Missing initial data ID or update handler.');
        }

        // Construct payload matching PortfolioStockUpdateInput type { id: string } & Partial<PortfolioStockDataType>
        const updatePayload = {
             id: initialData.id,
             ...stockDataPayload
         };
        console.log('Updating stock input:', updatePayload);
        await onUpdate(updatePayload); // Call parent's update handler

      } else {
        // --- CREATE ---
        console.log('Creating stock input:', stockDataPayload);
        // Pass payload matching create input type (PortfolioStockCreateInput)
        const { errors } = await client.models.PortfolioStock.create(stockDataPayload);
        if (errors) throw errors;

        console.log('Stock added successfully!');
        // Reset form fields only on successful ADD using default state values
        setSymbol(defaultFormState.symbol);
        setStockType(defaultFormState.stockType);
        setRegion(defaultFormState.region);
        setName(defaultFormState.name);
        setPdp(defaultFormState.pdp);
        setPlr(defaultFormState.plr);
        setBudget(defaultFormState.budget);
        setSwingHoldRatio(defaultFormState.swingHoldRatio);
        onStockAdded?.(); // Notify parent
      }
    } catch (err: any) {
      console.error("Error saving stock:", err);
      const errorMessage = Array.isArray(err) ? err[0].message : (err.message || "An unexpected error occurred.");
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }; // End handleSubmit

  return (
    <form onSubmit={handleSubmit} style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      gap: '15px', 
      maxWidth: '450px', 
      margin: '0 auto',
      padding: '1rem'
    }}>
      {/* Conditional Title */}
      <h2 style={{ margin: '0 0 15px 0' }}>{isEditMode ? `Edit ${initialData?.symbol ?? 'Stock'}` : 'Add New Stock to Portfolio'}</h2>
      
      {error && <p style={{ color: 'red', background: '#331a1a', padding: '8px', borderRadius: '4px', border: '1px solid #663333', margin: '0 0 10px 0', fontSize: '0.9em' }} role="alert">{error}</p>}

      {/* --- Form Fields --- */}
      <div>
        <label htmlFor="symbol" style={{display: 'block', marginBottom: '3px'}}>Ticker:</label>
        <input 
          id="symbol" 
          value={symbol} 
          onChange={(e) => setSymbol(e.target.value)} 
          required 
          disabled={isLoading} 
          style={{width: '100%', padding: '8px'}}
        />
      </div>
      
      <div>
        <label htmlFor="type" style={{display: 'block', marginBottom: '3px'}}>Type:</label>
        <select 
          id="type" 
          value={stockType} 
          onChange={(e) => setStockType(e.target.value as StockTypeValue)} 
          required 
          disabled={isLoading}
          style={{width: '100%', padding: '8px'}}
        >
          <option value="Stock">Stock</option>
          <option value="ETF">ETF</option>
          <option value="Crypto">Crypto</option>
        </select>
      </div>
      
      <div>
        <label htmlFor="region" style={{display: 'block', marginBottom: '3px'}}>Region:</label>
        <select 
          id="region" 
          value={region} 
          onChange={(e) => setRegion(e.target.value as RegionValue)} 
          required 
          disabled={isLoading}
          style={{width: '100%', padding: '8px'}}
        >
          <option value="US">US</option>
          <option value="APAC">APAC</option>
          <option value="EU">EU</option>
          <option value="Intl">Intl</option>
        </select>
      </div>
      
      <div>
        <label htmlFor="name" style={{display: 'block', marginBottom: '3px'}}>Stock Name (Optional):</label>
        <input 
          id="name" 
          value={name} 
          onChange={(e) => setName(e.target.value)} 
          disabled={isLoading}
          style={{width: '100%', padding: '8px'}}
        />
      </div>
      
      <div>
        <label htmlFor="pdp" style={{display: 'block', marginBottom: '3px'}}>Price Drop Percentage (PDP):</label>
        <input 
          id="pdp" 
          type="number" 
          step="any" 
          value={pdp} 
          onChange={(e) => setPdp(e.target.value)}
          placeholder="e.g., 10 = 10%" 
          disabled={isLoading}
          style={{width: '100%', padding: '8px'}} 
        />
      </div>
      
      <div>
        <label htmlFor="plr" style={{display: 'block', marginBottom: '3px'}}>Profit Loss Ratio (PLR):</label>
        <input 
          id="plr" 
          type="number" 
          step="any" 
          value={plr} 
          onChange={(e) => setPlr(e.target.value)}
          placeholder="e.g., 1.5 = 150%" 
          disabled={isLoading}
          style={{width: '100%', padding: '8px'}}
        />
      </div>
      
      <div>
          <label htmlFor="shr" style={{display: 'block', marginBottom: '3px'}}>Swin-Hold Ratio (SHR):</label> {/* Swing-Hold Ratio */}
          <input
              id="shr"
              type="number"
              step="any" 
              min="0"   
              max="100" 
              value={swingHoldRatio}
              onChange={(e) => setSwingHoldRatio(e.target.value)}
              placeholder="0-100 (e.g., 70 = 70% Swing & 30% Hold)"
              disabled={isLoading}
              style={{width: '100%', padding: '8px'}}
          />
      </div>
      
      <div>
        <label htmlFor="budget" style={{display: 'block', marginBottom: '3px'}}>Annual Budget:</label>
        <input 
          id="budget" 
          type="number" 
          step="any" 
          value={budget} 
          onChange={(e) => setBudget(e.target.value)}
          placeholder="e.g., 1500 or best guess if unknown" 
          disabled={isLoading}
          style={{width: '100%', padding: '8px'}}
        />
      </div>
      {/* --- End Form Fields --- */}

      {/* Buttons */}
      <div style={{ marginTop: '1rem', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
        {/* Always show Cancel button (onCancel required in props) */}
        {onCancel && (
          <button 
            type="button" 
            onClick={onCancel} 
            disabled={isLoading}
            style={{
              padding: '8px 16px',
              backgroundColor: '#555555',
              borderRadius: '4px',
              cursor: isLoading ? 'not-allowed' : 'pointer'
            }}
          >
            Cancel
          </button>
        )}
        <button 
          type="submit" 
          disabled={isLoading}
          style={{
            padding: '8px 16px',
            backgroundColor: '#557100',
            borderRadius: '4px',
            cursor: isLoading ? 'not-allowed' : 'pointer'
          }}
        >
          {isLoading ? 'Saving...' : (isEditMode ? 'Update Stock' : 'Add Stock')}
        </button>
      </div>
    </form>
  );
}