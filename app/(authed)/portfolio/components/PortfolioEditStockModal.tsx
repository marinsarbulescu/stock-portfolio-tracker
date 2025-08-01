// app/(authed)/portfolio/components/PortfolioEditStockModal.tsx
'use client';

import React, { useState, useEffect } from 'react';
import type { Schema } from '@/amplify/data/resource';

// Import types from the portfolio types file
import type {
  PortfolioStockDataType,
  PortfolioStockUpdateInput,
  StockTypeValue,
  RegionValue,
  StockTrendValue,
  EditStockModalProps,
} from '../types';

import { modalOverlayStyle, modalContentStyle } from '../types';

export default function EditStockModal({
  isOpen,
  stockToEditData,
  onUpdate,
  onCancel,
}: EditStockModalProps) {
  // --- State for each form field ---
  const [symbol, setSymbol] = useState('');
  const [stockType, setStockType] = useState<StockTypeValue>('Stock');
  const [region, setRegion] = useState<RegionValue>('US');
  const [stockTrend, setStockTrend] = useState<StockTrendValue>(null);
  const [name, setName] = useState('');
  const [pdp, setPdp] = useState('');
  const [plr, setPlr] = useState('');
  const [budget, setBudget] = useState('');
  const [testPrice, setTestPrice] = useState('');
  const [swingHoldRatio, setSwingHoldRatio] = useState('');
  const [stockCommission, setStockCommission] = useState('');
  const [htp, setHtp] = useState('0'); // Default to 0

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Effect to populate form when modal opens with edit data
  useEffect(() => {
    setError(null);
    if (isOpen && stockToEditData) {
      // Populate state from stockToEditData
      setSymbol(stockToEditData.symbol ?? '');
      setName(stockToEditData.name ?? '');
      setStockType(stockToEditData.stockType ?? 'Stock');
      setRegion(stockToEditData.region ?? 'US');
      setStockTrend(stockToEditData.stockTrend ?? null);
      setPdp(stockToEditData.pdp?.toString() ?? '');
      setPlr(stockToEditData.plr?.toString() ?? '');
      setBudget(stockToEditData.budget?.toString() ?? '');
      setTestPrice(stockToEditData.testPrice?.toString() ?? '');
      setSwingHoldRatio(stockToEditData.swingHoldRatio?.toString() ?? '');
      setStockCommission(stockToEditData.stockCommission?.toString() ?? '');
      setHtp(stockToEditData.htp?.toString() ?? '0'); // Default to 0 if not set
    }
  }, [isOpen, stockToEditData]);

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

    // Validate HTP (must be >= 0)
    const htpValue = parseFloat(htp || '0');
    if (isNaN(htpValue) || htpValue < 0) {
      setError('HTP must be a number >= 0.');
      setIsLoading(false);
      return;
    }

    // Validate testPrice (must be positive if provided)
    const testPriceValue = testPrice ? parseFloat(testPrice) : null;
    if (testPriceValue !== null && (isNaN(testPriceValue) || testPriceValue <= 0)) {
      setError('Test Price must be a positive number.');
      setIsLoading(false);
      return;
    }

    if (!stockToEditData?.id) {
      setError('Cannot update: Missing stock ID.');
      setIsLoading(false);
      return;
    }

    // --- Prepare data payload ---
    const stockDataPayload = {
      symbol: symbol.toUpperCase(),
      stockType: stockType as StockTypeValue,
      region: region as RegionValue,
      stockTrend: stockTrend as StockTrendValue,
      name: name || undefined,
      pdp: pdp ? parseFloat(pdp) : null,
      plr: plr ? parseFloat(plr) : null,
      budget: budget ? parseFloat(budget) : null,
      testPrice: testPriceValue,
      swingHoldRatio: shrValue,
      stockCommission: stockCommission ? parseFloat(stockCommission) : null,
      htp: htpValue, // Always include HTP value
    };

    // Construct payload matching PortfolioStockUpdateInput type
    const updatePayload = {
      id: stockToEditData.id,
      ...stockDataPayload
    };

    try {
      console.log('Updating stock input:', updatePayload);
      await onUpdate(updatePayload); // Call parent's update handler
    } catch (err: unknown) {
      console.error("Error updating stock:", err);
      const errorMessage = Array.isArray(err) ? (err as Array<{message: string}>)[0].message : ((err as Error).message || "An unexpected error occurred.");
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !stockToEditData) {
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
          <h2 style={{ margin: '0 0 15px 0' }}>Edit {stockToEditData.symbol ?? 'Stock'}</h2>
          
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
            <label htmlFor="stockTrend" style={{display: 'block', marginBottom: '3px'}}>Trend (Optional):</label>
            <select 
              id="stockTrend" 
              value={stockTrend || ''} 
              onChange={(e) => setStockTrend(e.target.value as StockTrendValue || null)} 
              disabled={isLoading}
              style={{width: '100%', padding: '8px'}}
            >
              <option value="">-- No Selection --</option>
              <option value="Up">Up</option>
              <option value="Down">Down</option>
              <option value="Sideways">Sideways</option>
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
            <label htmlFor="testPrice" style={{display: 'block', marginBottom: '3px'}}>Test Price (Optional):</label>
            <input 
              id="testPrice" 
              type="number" 
              step="any" 
              min="0.01"
              value={testPrice} 
              onChange={(e) => setTestPrice(e.target.value)}
              placeholder="e.g., 150.25 - overrides live price fetching" 
              disabled={isLoading}
              style={{width: '100%', padding: '8px'}}
            />
            <small style={{color: '#aaa', fontSize: '0.8em'}}>
              If set, this price will be used instead of live market data
            </small>
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

          <div>
            <label htmlFor="htp" style={{display: 'block', marginBottom: '3px'}}>HTP (%):</label>
            <input 
              id="htp" 
              type="number" 
              step="any" 
              min="0"
              value={htp} 
              onChange={(e) => setHtp(e.target.value)}
              placeholder="e.g., 10 for 10% Hold Take Profit" 
              disabled={isLoading}
              style={{width: '100%', padding: '8px'}}
              required
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
              {isLoading ? 'Saving...' : 'Update Stock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
