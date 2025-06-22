// app/(authed)/stocks-listing/components/AddStockModal.tsx
'use client';

import React, { useState } from 'react';
import { type Schema } from '@/amplify/data/resource';
import { generateClient } from 'aws-amplify/data';

const client = generateClient<Schema>();

type PortfolioStockDataType = Schema["PortfolioStock"]["type"];
// Omit 'transactions' and 'stockWallets' as they are relationships, not direct inputs
type PortfolioStockCreateInput = Omit<PortfolioStockDataType, 'id' | 'createdAt' | 'updatedAt' | 'owner' | 'transactions' | 'stockWallets'>;

// Define specific types for dropdowns/enums based on schema
type StockTypeValue = PortfolioStockDataType['stockType'];
type RegionValue = PortfolioStockDataType['region'];

export interface AddStockModalProps {
  isOpen: boolean;
  onStockAdded: () => void;
  onCancel: () => void;
}

const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.75)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 1000
};

const modalContentStyle: React.CSSProperties = {
  backgroundColor: '#1e1e1e',
  borderRadius: '8px',
  maxHeight: '90vh',
  width: '90%',
  maxWidth: '500px',
  overflowY: 'auto',
  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)'
};

export default function AddStockModal({
  isOpen,
  onStockAdded,
  onCancel,
}: AddStockModalProps) {
  // --- State for each form field ---
  const [symbol, setSymbol] = useState('');
  const [stockType, setStockType] = useState<StockTypeValue>('Stock');
  const [region, setRegion] = useState<RegionValue>('US');
  const [name, setName] = useState('');
  const [pdp, setPdp] = useState('');
  const [plr, setPlr] = useState('');
  const [budget, setBudget] = useState('');
  const [swingHoldRatio, setSwingHoldRatio] = useState('');
  const [stockCommission, setStockCommission] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setSymbol('');
      setStockType('Stock');
      setRegion('US');
      setName('');
      setPdp('');
      setPlr('');
      setBudget('');
      setSwingHoldRatio('');
      setStockCommission('');
      setError(null);
    }
  }, [isOpen]);

  // Handle form submission
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    // --- Basic Validation ---
    if (!symbol || !stockType || !region) {
      setError('Symbol, Type, and Region are required.');
      setIsLoading(false);
      return;
    }

    // Optional: Add validation for SHR (e.g., must be between 0 and 100)
    const shrValue = swingHoldRatio ? parseFloat(swingHoldRatio) : null;
    if (shrValue !== null && (isNaN(shrValue) || shrValue < 0 || shrValue > 100)) {
      setError('Swing-Hold Ratio must be a number between 0 and 100.');
      setIsLoading(false);
      return;
    }

    // --- Prepare data payload ---
    const stockDataPayload = {
      symbol: symbol.toUpperCase(),
      stockType: stockType as StockTypeValue,
      region: region as RegionValue,
      name: name || undefined,
      pdp: pdp ? parseFloat(pdp) : null,
      plr: plr ? parseFloat(plr) : null,
      budget: budget ? parseFloat(budget) : null,
      swingHoldRatio: shrValue,
      stockCommission: stockCommission ? parseFloat(stockCommission) : null,
    };

    try {
      console.log('Creating stock input:', stockDataPayload);
      const { errors } = await client.models.PortfolioStock.create(stockDataPayload);
      if (errors) throw errors;

      console.log('Stock added successfully!');
      onStockAdded(); // Notify parent
    } catch (err: any) {
      console.error("Error saving stock:", err);
      const errorMessage = Array.isArray(err) ? err[0].message : (err.message || "An unexpected error occurred.");
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div style={modalOverlayStyle}>
      <div style={modalContentStyle}>
        <form onSubmit={handleSubmit} style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '15px', 
          maxWidth: '450px', 
          margin: '0 auto',
          padding: '1rem'
        }}>
          <h2 style={{ margin: '0 0 15px 0' }}>Add New Stock to Portfolio</h2>
          
          {error && (
            <p style={{ 
              color: 'red', 
              background: '#331a1a', 
              padding: '8px', 
              borderRadius: '4px', 
              border: '1px solid #663333', 
              margin: '0 0 10px 0', 
              fontSize: '0.9em' 
            }} role="alert">
              {error}
            </p>
          )}

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
            <label htmlFor="shr" style={{display: 'block', marginBottom: '3px'}}>Swing-Hold Ratio (SHR):</label>
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

          <div>
            <label htmlFor="commission" style={{display: 'block', marginBottom: '3px'}}>Commission:</label>
            <input 
              id="commission" 
              type="number" 
              step="any" 
              value={stockCommission} 
              onChange={(e) => setStockCommission(e.target.value)}
              placeholder="e.g., 1.00 for commission per trade" 
              disabled={isLoading}
              style={{width: '100%', padding: '8px'}}
            />
          </div>

          {/* Buttons */}
          <div style={{ marginTop: '1rem', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
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
              {isLoading ? 'Saving...' : 'Add Stock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
