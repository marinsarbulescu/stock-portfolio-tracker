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
  MarketCategoryValue,
  RiskGrowthProfileValue,
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
  const [marketCategory, setMarketCategory] = useState<MarketCategoryValue>('US_Index');
  const [riskGrowthProfile, setRiskGrowthProfile] = useState<RiskGrowthProfileValue>('Hare');
  const [name, setName] = useState('');
  const [pdp, setPdp] = useState('');
  const [stp, setStp] = useState('');
  const [budget, setBudget] = useState('');
  const [testPrice, setTestPrice] = useState('');
  const [swingHoldRatio, setSwingHoldRatio] = useState('');
  const [stockCommission, setStockCommission] = useState('');
  const [htp, setHtp] = useState(''); // Now optional, no default value

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
      setMarketCategory(stockToEditData.marketCategory ?? 'US_Index');
      setRiskGrowthProfile(stockToEditData.riskGrowthProfile ?? 'Hare');
      setPdp(stockToEditData.pdp?.toString() ?? '');
      setStp(stockToEditData.stp?.toString() ?? '');
      setBudget(stockToEditData.budget?.toString() ?? '');
      setTestPrice(stockToEditData.testPrice?.toString() ?? '');
      setSwingHoldRatio(stockToEditData.swingHoldRatio?.toString() ?? '');
      setStockCommission(stockToEditData.stockCommission?.toString() ?? '');
      setHtp(stockToEditData.htp?.toString() ?? ''); // No default since it's now optional
    }
  }, [isOpen, stockToEditData]);

  // Handle form submission
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    // --- Basic Validation ---
    if (!symbol || !stockType || !region || !marketCategory || !riskGrowthProfile || !pdp || !stp || !swingHoldRatio) {
      setError('Symbol, Security Type, Region, Market Category, Risk/Growth Profile, PDP, STP, and SHR are required.');
      setIsLoading(false);
      return;
    }

    // Validate PDP (must be a valid number)
    const pdpValue = parseFloat(pdp);
    if (isNaN(pdpValue)) {
      setError('Price Drop Percentage (PDP) must be a valid number.');
      setIsLoading(false);
      return;
    }

    // Validate STP (must be a valid number)
    const stpValue = parseFloat(stp);
    if (isNaN(stpValue)) {
      setError('Swing Take Profit (STP) must be a valid number.');
      setIsLoading(false);
      return;
    }

    // Validate SHR (must be between 0 and 100)
    const shrValue = parseFloat(swingHoldRatio);
    if (isNaN(shrValue) || shrValue < 0 || shrValue > 100) {
      setError('Swing-Hold Ratio (SHR) must be a number between 0 and 100.');
      setIsLoading(false);
      return;
    }

    // Validate HTP (optional, but if provided must be >= 0)
    const htpValue = htp ? parseFloat(htp) : null;
    if (htpValue !== null && (isNaN(htpValue) || htpValue < 0)) {
      setError('Hold Take Profit (HTP) must be a number >= 0.');
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
      marketCategory: marketCategory as MarketCategoryValue,
      riskGrowthProfile: riskGrowthProfile as RiskGrowthProfileValue,
      name: name || undefined,
      pdp: pdpValue, // Required field, always a number
      stp: stpValue, // Required field, always a number
      budget: budget ? parseFloat(budget) : undefined,
      testPrice: testPriceValue ? testPriceValue : undefined,
      swingHoldRatio: shrValue, // Required field, always a number
      stockCommission: stockCommission ? parseFloat(stockCommission) : undefined,
      htp: htpValue ? htpValue : undefined, // Optional field, use undefined instead of null
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
      <div style={{...modalContentStyle, width: '75%', maxWidth: '1200px'}}>
        <form onSubmit={handleSubmit} style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '15px', 
          maxWidth: '1200px', 
          margin: '0 auto',
          padding: '1.5rem'
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

          {/* --- 3-Column Form Fields Layout --- */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr 1fr', 
            gap: '25px'
          }}>
            {/* Column 1 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label htmlFor="symbol" style={{display: 'block', marginBottom: '3px'}}>
                  Ticker <span style={{color: 'red'}}>*</span>
                </label>
                <input 
                  id="symbol" 
                  value={symbol} 
                  onChange={(e) => setSymbol(e.target.value)} 
                  required 
                  disabled={isLoading} 
                  style={{width: '100%', padding: '8px'}}
                />
                <small style={{color: '#aaa', fontSize: '0.8em', minHeight: '3.6em', display: 'block', lineHeight: '1.4', marginTop: '4px'}}>
                  Stock ticker symbol (e.g., AAPL, MSFT, GOOGL)
                </small>
              </div>
              
              <div>
                <label htmlFor="name" style={{display: 'block', marginBottom: '3px'}}>Name</label>
                <input 
                  id="name" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  disabled={isLoading}
                  style={{width: '100%', padding: '8px'}}
                />
                <small style={{color: '#aaa', fontSize: '0.8em', minHeight: '3.6em', display: 'block', lineHeight: '1.4', marginTop: '4px'}}>
                  Optional company name (e.g., Apple Inc., Microsoft Corp)
                </small>
              </div>

              <div>
                <label htmlFor="region" style={{display: 'block', marginBottom: '3px'}}>
                  Region <span style={{color: 'red'}}>*</span>
                </label>
                <select 
                  id="region" 
                  value={region} 
                  onChange={(e) => setRegion(e.target.value as RegionValue)} 
                  required 
                  disabled={isLoading}
                  style={{width: '100%', padding: '8px'}}
                >
                  <option value="">-- Select one --</option>
                  <option value="APAC">APAC</option>
                  <option value="EU">EU</option>
                  <option value="Intl">Intl</option>
                  <option value="US">US</option>
                </select>
                <small style={{color: '#aaa', fontSize: '0.8em', minHeight: '3.6em', display: 'block', lineHeight: '1.4', marginTop: '4px'}}>
                  Geographic region where the stock is primarily traded
                </small>
              </div>

              <div>
                <label htmlFor="marketCategory" style={{display: 'block', marginBottom: '3px'}}>
                  Market Category <span style={{color: 'red'}}>*</span>
                </label>
                <select 
                  id="marketCategory" 
                  value={marketCategory || ''} 
                  onChange={(e) => setMarketCategory(e.target.value as MarketCategoryValue || null)} 
                  required
                  disabled={isLoading}
                  style={{width: '100%', padding: '8px'}}
                >
                  <option value="">-- Select one --</option>
                  <option value="APAC_Index">APAC Index</option>
                  <option value="China_Index">China Index</option>
                  <option value="Crypto">Crypto</option>
                  <option value="Emerging_Index">Emerging Index</option>
                  <option value="Europe_Index">Europe Index</option>
                  <option value="International_Index">International Index</option>
                  <option value="Metals">Metals</option>
                  <option value="Oil">Oil</option>
                  <option value="Opportunity">Opportunity</option>
                  <option value="US_Index">US Index</option>
                </select>
                <small style={{color: '#aaa', fontSize: '0.8em', minHeight: '3.6em', display: 'block', lineHeight: '1.4', marginTop: '4px'}}>
                  Asset class category for portfolio diversification tracking
                </small>
              </div>

              <div>
                <label htmlFor="type" style={{display: 'block', marginBottom: '3px'}}>
                  Security Type <span style={{color: 'red'}}>*</span>
                </label>
                <select 
                  id="type" 
                  value={stockType} 
                  onChange={(e) => setStockType(e.target.value as StockTypeValue)} 
                  required 
                  disabled={isLoading}
                  style={{width: '100%', padding: '8px'}}
                >
                  <option value="">-- Select one --</option>
                  <option value="Crypto">Crypto</option>
                  <option value="ETF">ETF</option>
                  <option value="Stock">Stock</option>
                </select>
                <small style={{color: '#aaa', fontSize: '0.8em', minHeight: '3.6em', display: 'block', lineHeight: '1.4', marginTop: '4px'}}>
                  Type of security (individual stock, ETF, or cryptocurrency)
                </small>
              </div>

              <div>
                <label htmlFor="riskGrowthProfile" style={{display: 'block', marginBottom: '3px'}}>
                  Risk/Growth Profile <span style={{color: 'red'}}>*</span>
                </label>
                <select 
                  id="riskGrowthProfile" 
                  value={riskGrowthProfile || ''} 
                  onChange={(e) => setRiskGrowthProfile(e.target.value as RiskGrowthProfileValue || null)} 
                  required
                  disabled={isLoading}
                  style={{width: '100%', padding: '8px'}}
                >
                  <option value="">-- Select one --</option>
                  <option value="Hare">Hare</option>
                  <option value="Tortoise">Tortoise</option>
                </select>
                <small style={{color: '#aaa', fontSize: '0.8em', minHeight: '3.6em', display: 'block', lineHeight: '1.4', marginTop: '4px'}}>
                  Investment strategy: Hare (fast/risky growth), Tortoise (steady/conservative)
                </small>
              </div>
            </div>

            {/* Column 2 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label htmlFor="pdp" style={{display: 'block', marginBottom: '3px'}}>
                  Price Drop Percentage (PDP) <span style={{color: 'red'}}>*</span>
                </label>
                <input 
                  id="pdp" 
                  type="number" 
                  step="any" 
                  value={pdp} 
                  onChange={(e) => setPdp(e.target.value)}
                  placeholder="e.g., 10 = 10%" 
                  required
                  disabled={isLoading}
                  style={{width: '100%', padding: '8px'}} 
                />
                <small style={{color: '#aaa', fontSize: '0.8em', minHeight: '3.6em', display: 'block', lineHeight: '1.4', marginTop: '4px'}}>
                  Percentage price drop threshold to trigger buy signal opportunity
                </small>
              </div>

              <div>
                <label htmlFor="shr" style={{display: 'block', marginBottom: '3px'}}>
                  Swing-Hold Ratio (SHR) <span style={{color: 'red'}}>*</span>
                </label>
                <input
                  id="shr"
                  type="number"
                  step="any" 
                  min="0"   
                  max="100" 
                  value={swingHoldRatio}
                  onChange={(e) => setSwingHoldRatio(e.target.value)}
                  placeholder="0-100 (e.g., 70 = 70% Swing & 30% Hold)"
                  required
                  disabled={isLoading}
                  style={{width: '100%', padding: '8px'}}
                />
                <small style={{color: '#aaa', fontSize: '0.8em', minHeight: '3.6em', display: 'block', lineHeight: '1.4', marginTop: '4px'}}>
                  Portfolio allocation split between swing trading and buy-and-hold strategies
                </small>
              </div>

              <div>
                <label htmlFor="stp" style={{display: 'block', marginBottom: '3px'}}>
                  Swing Take Profit (STP) <span style={{color: 'red'}}>*</span>
                </label>
                <input 
                  id="stp" 
                  type="number" 
                  step="any" 
                  value={stp} 
                  onChange={(e) => setStp(e.target.value)}
                  placeholder="e.g., 1.5 = 150%" 
                  required
                  disabled={isLoading}
                  style={{width: '100%', padding: '8px'}}
                />
                <small style={{color: '#aaa', fontSize: '0.8em', minHeight: '3.6em', display: 'block', lineHeight: '1.4', marginTop: '4px'}}>
                  Target price gain percentage to trigger sell signal for swing positions
                </small>
              </div>

              <div>
                <label htmlFor="htp" style={{display: 'block', marginBottom: '3px'}}>Hold Take Profit (HTP)</label>
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
                />
                <small style={{color: '#aaa', fontSize: '0.8em', minHeight: '3.6em', display: 'block', lineHeight: '1.4', marginTop: '4px'}}>
                  Target price gain percentage to trigger sell signal for hold positions
                </small>
              </div>
            </div>

            {/* Column 3 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label htmlFor="testPrice" style={{display: 'block', marginBottom: '3px'}}>Test Price</label>
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
                <label htmlFor="budget" style={{display: 'block', marginBottom: '3px'}}>Annual Budget</label>
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
                <small style={{color: '#aaa', fontSize: '0.8em', minHeight: '3.6em', display: 'block', lineHeight: '1.4', marginTop: '4px'}}>
                  Annual investment budget allocated for this position (optional)
                </small>
              </div>

              <div>
                <label htmlFor="stockTrend" style={{display: 'block', marginBottom: '3px'}}>Trend</label>
                <select 
                  id="stockTrend" 
                  value={stockTrend || ''} 
                  onChange={(e) => setStockTrend(e.target.value as StockTrendValue || null)} 
                  disabled={isLoading}
                  style={{width: '100%', padding: '8px'}}
                >
                  <option value="">-- Select one --</option>
                  <option value="Down">Down</option>
                  <option value="Sideways">Sideways</option>
                  <option value="Up">Up</option>
                </select>
                <small style={{color: '#aaa', fontSize: '0.8em', minHeight: '3.6em', display: 'block', lineHeight: '1.4', marginTop: '4px'}}>
                  Current market trend direction for technical analysis (optional)
                </small>
              </div>

              <div>
                <label htmlFor="commission" style={{display: 'block', marginBottom: '3px'}}>Commission</label>
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
                <small style={{color: '#aaa', fontSize: '0.8em', minHeight: '3.6em', display: 'block', lineHeight: '1.4', marginTop: '4px'}}>
                  Trading commission cost per transaction (optional)
                </small>
              </div>
            </div>
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
