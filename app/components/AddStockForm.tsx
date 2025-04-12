// app/components/AddStockForm.tsx - Refactored for ["type"] pattern
'use client';

import React, { useState, useEffect } from 'react';
import { type Schema } from '@/amplify/data/resource'; // Adjust path if needed
import { generateClient } from 'aws-amplify/data';

const client = generateClient<Schema>();

//type PortfolioStockModel = Schema['PortfolioStock'];
//type StockTypeValue = PortfolioStockModel['stockType'];


type PortfolioStockDataType = Schema["PortfolioStock"]["type"];
type PortfolioStockUpdateInput = Partial<PortfolioStockDataType> & { id: string };
type PortfolioStockCreateInput = Omit<PortfolioStockDataType, 'id' | 'createdAt' | 'updatedAt' | 'owner' | 'transactions'>; // Adjust Omit as needed


// Define props for the component using the simpler types
interface AddStockFormProps {
  onStockAdded?: () => void; // For Add mode success
  isEditMode?: boolean;
  initialData?: Partial<PortfolioStockDataType> | null; // Expect partial simple type for editing
  onUpdate?: (updatedData: PortfolioStockUpdateInput) => Promise<void>; // Expect ID + partial simple type
  onCancel?: () => void;
}

// Add this interface definition
interface DefaultFormStateType {
  symbol: string;
  stockType: StockTypeValue; // Use your type alias
  region: RegionValue;  // Use your type alias
  name: string;
  pdp: string;
  plr: string;
  budget: string;
}

// Define specific types for dropdowns/enums based on schema
type StockTypeValue = PortfolioStockDataType['stockType'];
type RegionValue = PortfolioStockDataType['region'];

// Default values for resetting the form
const defaultFormState: DefaultFormStateType = {
  symbol: '',
  stockType: 'Stock', // Use type assertion for default
  region: 'US',   // Use type assertion for default
  name: '',
  pdp: '',
  plr: '',
  budget: '',
};

export default function AddStockForm({
  onStockAdded,
  isEditMode = false,
  initialData,
  onUpdate,
  onCancel
}: AddStockFormProps) { // Props are now correctly typed

  // State for each form field (using string/basic types for input binding)
  const [symbol, setSymbol] = useState(defaultFormState.symbol);
  const [stockType, setStockType] = useState<StockTypeValue>(defaultFormState.stockType);
  const [region, setRegion] = useState<RegionValue>(defaultFormState.region);
  const [name, setName] = useState(defaultFormState.name);
  const [pdp, setPdp] = useState(defaultFormState.pdp);
  const [plr, setPlr] = useState(defaultFormState.plr);
  const [budget, setBudget] = useState(defaultFormState.budget);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Removed success state, parent page handles success feedback after refresh/callback

  // --- CORRECTED: Effect to populate form using Partial<PortfolioStockDataType> ---
  useEffect(() => {
    setError(null); // Clear errors when switching modes/data
    if (isEditMode && initialData) {
      // Populate state from initialData. Properties should exist on PortfolioStockDataType.
      setSymbol(initialData.symbol ?? defaultFormState.symbol);
      setName(initialData.name ?? defaultFormState.name);
      setStockType(initialData.stockType ?? defaultFormState.stockType);
      setRegion(initialData.region ?? defaultFormState.region);
      setPdp(initialData.pdp?.toString() ?? defaultFormState.pdp);
      setPlr(initialData.plr?.toString() ?? defaultFormState.plr);
      setBudget(initialData.budget?.toString() ?? defaultFormState.budget);
    } else {
      // Reset form for Add mode
      setSymbol(defaultFormState.symbol);
      setStockType(defaultFormState.stockType);
      setRegion(defaultFormState.region);
      setName(defaultFormState.name);
      setPdp(defaultFormState.pdp);
      setPlr(defaultFormState.plr);
      setBudget(defaultFormState.budget);
    }
  }, [isEditMode, initialData]);
  // --- End CORRECTED Effect ---

  // Handle form submission
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    // --- Basic Validation ---
    if (!symbol || !stockType || !region) {
      setError('Symbol, Type, and Region are required.');
      setIsLoading(false); return;
    }
    // Add more validation if needed

    // --- Prepare data payload (plain object with correct types) ---
    const stockDataPayload = {
      symbol: symbol.toUpperCase(),
      stockType: stockType as StockTypeValue,
      region: region as RegionValue,
      name: name || undefined, // Use undefined for optional empty strings
      pdp: pdp ? parseFloat(pdp) : null, // Use null for optional empty numbers
      plr: plr ? parseFloat(plr) : null,
      budget: budget ? parseFloat(budget) : null,
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
        setSymbol(defaultFormState.symbol); setStockType(defaultFormState.stockType); setRegion(defaultFormState.region);
        setName(defaultFormState.name); setPdp(defaultFormState.pdp); setPlr(defaultFormState.plr); setBudget(defaultFormState.budget);
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
    <form onSubmit={handleSubmit} style={{ marginTop: '1rem', borderTop: '1px dashed #eee', paddingTop: '1rem' }}>
      {/* Conditional Title */}
      <h2>{isEditMode ? `Edit ${initialData?.symbol ?? 'Stock'}` : 'Add New Stock to Portfolio'}</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {/* Removed success message - parent page should handle feedback after successful save/refresh */}

      {/* --- Form Fields --- */}
      {/* Use same inputs as before, bound to state */}
      <div><label>Stock Symbol:</label><input id="symbol" value={symbol} onChange={(e) => setSymbol(e.target.value)} required disabled={isLoading} /></div>
      <div style={{ marginTop: '0.5rem' }}><label>Type:</label><select id="type" value={stockType} onChange={(e) => setStockType(e.target.value as StockTypeValue)} required disabled={isLoading}><option value="Stock">Stock</option><option value="ETF">ETF</option><option value="Crypto">Crypto</option></select></div>
      <div style={{ marginTop: '0.5rem' }}><label>Region:</label><select id="region" value={region} onChange={(e) => setRegion(e.target.value as RegionValue)} required disabled={isLoading}><option value="US">US</option><option value="EU">EU</option><option value="APAC">APAC</option></select></div>
      <div style={{ marginTop: '0.5rem' }}><label>Stock Name (Optional):</label><input id="name" value={name} onChange={(e) => setName(e.target.value)} disabled={isLoading} /></div>
      <div style={{ marginTop: '0.5rem' }}><label>PDP (%):</label><input id="pdp" type="number" step="any" value={pdp} onChange={(e) => setPdp(e.target.value)} disabled={isLoading} /></div>
      <div style={{ marginTop: '0.5rem' }}><label>PLR:</label><input id="plr" type="number" step="any" value={plr} onChange={(e) => setPlr(e.target.value)} disabled={isLoading} /></div>
      <div style={{ marginTop: '0.5rem' }}><label>Annual Budget:</label><input id="budget" type="number" step="any" value={budget} onChange={(e) => setBudget(e.target.value)} disabled={isLoading} /></div>
      {/* --- End Form Fields --- */}

      {/* Conditional Buttons */}
      <div style={{ marginTop: '1rem' }}>
        <button type="submit" disabled={isLoading}>{isLoading ? 'Saving...' : (isEditMode ? 'Update Stock' : 'Add Stock')}</button>
        {isEditMode && onCancel && (<button type="button" onClick={onCancel} disabled={isLoading} style={{ marginLeft: '10px' }}>Cancel</button>)}
      </div>
    </form>
  );
}