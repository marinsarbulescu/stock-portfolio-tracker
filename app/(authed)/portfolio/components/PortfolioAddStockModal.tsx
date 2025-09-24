// app/(authed)/portfolio/components/PortfolioAddStockModal.tsx
'use client';

import React, { useState } from 'react';
import { type Schema } from '@/amplify/data/resource';
import { generateClient } from 'aws-amplify/data';

// Import types from the portfolio types file
import type {
  StockTypeValue,
  RegionValue,
  StockTrendValue,
  MarketCategoryValue,
  RiskGrowthProfileValue,
  AddStockModalProps,
} from '../types';

import { modalOverlayStyle, modalContentStyle } from '../types';
import { ALL_FIELDS } from '../constants/fieldDefinitions';

const client = generateClient<Schema>();

export default function AddStockModal({
  isOpen,
  onStockAdded,
  onCancel,
}: AddStockModalProps) {
  // --- State for each form field ---
  const [symbol, setSymbol] = useState('');
  const [stockType, setStockType] = useState<StockTypeValue | ''>('');
  const [region, setRegion] = useState<RegionValue | ''>('');
  const [stockTrend, setStockTrend] = useState<StockTrendValue>(null);
  const [marketCategory, setMarketCategory] = useState<MarketCategoryValue | ''>('');
  const [riskGrowthProfile, setRiskGrowthProfile] = useState<RiskGrowthProfileValue | ''>('');
  const [name, setName] = useState('');
  const [pdp, setPdp] = useState('');
  const [stp, setStp] = useState(''); // No default value - user must specify
  const [budget, setBudget] = useState('');
  const [testPrice, setTestPrice] = useState('');
  const [swingHoldRatio, setSwingHoldRatio] = useState('');
  const [stockCommission, setStockCommission] = useState('');
  const [htp, setHtp] = useState(''); // Optional field, start empty

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setSymbol('');
      setStockType('');
      setRegion('');
      setStockTrend(null);
      setMarketCategory('');
      setRiskGrowthProfile('');
      setName('');
      setPdp('');
      setStp(''); // Reset to empty - no default value
      setBudget('');
      setTestPrice('');
      setSwingHoldRatio('');
      setStockCommission('');
      setHtp(''); // Reset to empty
      setError(null);
    }
  }, [isOpen]);

  // Handle form submission
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    // --- Basic Validation ---
    if (!symbol || !stockType || !region || !marketCategory || !riskGrowthProfile) {
      setError('Symbol, Security Type, Region, Market Sector, and Risk Profile are required.');
      setIsLoading(false);
      return;
    }

    // Validate SHR (required, must be between 0 and 100)
    if (!swingHoldRatio || swingHoldRatio.trim() === '') {
      setError('Swing-Hold Ratio (SHR) is required.');
      setIsLoading(false);
      return;
    }
    const shrValue = parseFloat(swingHoldRatio);
    if (isNaN(shrValue) || shrValue < 0 || shrValue > 100) {
      setError('Swing-Hold Ratio must be a number between 0 and 100.');
      setIsLoading(false);
      return;
    }

    // Validate PDP (required, must be >= 0)
    if (!pdp || pdp.trim() === '') {
      setError('Price Drop Percentage (PDP) is required.');
      setIsLoading(false);
      return;
    }
    const pdpValue = parseFloat(pdp);
    if (isNaN(pdpValue) || pdpValue < 0) {
      setError('Price Drop Percentage must be a number >= 0.');
      setIsLoading(false);
      return;
    }

    // Validate STP (required, must be > 0)
    if (!stp || stp.trim() === '') {
      setError('Swing Take Profit (STP) is required.');
      setIsLoading(false);
      return;
    }
    const stpValue = parseFloat(stp);
    if (isNaN(stpValue) || stpValue <= 0) {
      setError('Swing Take Profit must be a number > 0.');
      setIsLoading(false);
      return;
    }

    // Validate HTP (must be >= 0 if provided)
    const htpValue = htp ? parseFloat(htp) : null;
    if (htpValue !== null && (isNaN(htpValue) || htpValue < 0)) {
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

    // --- Prepare data payload ---
    const stockDataPayload = {
      symbol: symbol.toUpperCase(),
      stockType: stockType as StockTypeValue,
      region: region as RegionValue,
      stockTrend: stockTrend as StockTrendValue,
      marketCategory: marketCategory as MarketCategoryValue,
      riskGrowthProfile: riskGrowthProfile as RiskGrowthProfileValue,
      name: name || undefined,
      pdp: pdpValue, // PDP is now required
      stp: stpValue, // STP is now required
      budget: budget ? parseFloat(budget) : null,
      testPrice: testPriceValue,
      swingHoldRatio: shrValue, // SHR is now required
      stockCommission: stockCommission ? parseFloat(stockCommission) : null,
      htp: htpValue, // Include HTP value or null if not provided
    };

    try {
      console.log('Creating stock input:', stockDataPayload);
      const { errors } = await client.models.PortfolioStock.create(stockDataPayload);
      if (errors) throw errors;

      console.log('Stock added successfully!');
      onStockAdded(); // Notify parent
    } catch (err: unknown) {
      console.error("Error saving stock:", err);
      const errorMessage = Array.isArray(err) ? (err as Array<{message: string}>)[0].message : ((err as Error).message || "An unexpected error occurred.");
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
      <div style={modalContentStyle} data-testid="portfolio-add-stock-modal">
        <form onSubmit={handleSubmit} style={{ 
          padding: '1.5rem'
        }}>
          <h2 style={{ margin: '0 0 20px 0', textAlign: 'center' }}>Add New Stock to Portfolio</h2>
          
          {error && (
            <p style={{ 
              color: 'red', 
              background: '#331a1a', 
              padding: '8px', 
              borderRadius: '4px', 
              border: '1px solid #663333', 
              margin: '0 0 20px 0', 
              fontSize: '0.9em' 
            }} role="alert">
              {error}
            </p>
          )}

          {/* 3-Column Layout */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: '20px',
            marginBottom: '20px'
          }}>
            {/* Column 1: Basic Info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <h3 style={{ margin: '0 0 10px 0', borderBottom: '1px solid #333', paddingBottom: '5px' }}>Basics</h3>
              
              <div>
                <label htmlFor="symbol" style={{display: 'block', marginBottom: '3px', fontWeight: 'normal'}}>
                  {ALL_FIELDS.symbol.label} {ALL_FIELDS.symbol.required && <span style={{color: 'red', fontSize: '0.8em'}}>*</span>}
                </label>
                <input 
                  id="symbol" 
                  data-testid="portfolio-add-stock-symbol"
                  value={symbol} 
                  onChange={(e) => setSymbol(e.target.value)} 
                  placeholder={ALL_FIELDS.symbol.placeholder}
                  required={ALL_FIELDS.symbol.required}
                  disabled={isLoading} 
                  style={{width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #555', backgroundColor: '#2a2a2a', color: 'white'}}
                />
              </div>

              <div>
                <label htmlFor="name" style={{display: 'block', marginBottom: '3px', fontWeight: 'normal'}}>
                  {ALL_FIELDS.name.label}
                </label>
                <input 
                  id="name" 
                  data-testid="portfolio-add-stock-name"
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  placeholder={ALL_FIELDS.name.placeholder}
                  disabled={isLoading}
                  style={{width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #555', backgroundColor: '#2a2a2a', color: 'white'}}
                />
              </div>
              
              <div>
                <label htmlFor="type" style={{display: 'block', marginBottom: '3px', fontWeight: 'normal'}}>
                  {ALL_FIELDS.stockType.label} {ALL_FIELDS.stockType.required && <span style={{color: 'red', fontSize: '0.8em'}}>*</span>}
                </label>
                <select 
                  id="type" 
                  data-testid="portfolio-add-stock-type"
                  value={stockType} 
                  onChange={(e) => setStockType(e.target.value as StockTypeValue)} 
                  required={ALL_FIELDS.stockType.required}
                  disabled={isLoading}
                  style={{width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #555', backgroundColor: '#2a2a2a', color: 'white'}}
                >
                  <option value="">{ALL_FIELDS.stockType.defaultOption}</option>
                  {ALL_FIELDS.stockType.options.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label htmlFor="region" style={{display: 'block', marginBottom: '3px', fontWeight: 'normal'}}>
                  {ALL_FIELDS.region.label} {ALL_FIELDS.region.required && <span style={{color: 'red', fontSize: '0.8em'}}>*</span>}
                </label>
                <select 
                  id="region" 
                  data-testid="portfolio-add-stock-region"
                  value={region} 
                  onChange={(e) => setRegion(e.target.value as RegionValue)} 
                  required={ALL_FIELDS.region.required}
                  disabled={isLoading}
                  style={{width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #555', backgroundColor: '#2a2a2a', color: 'white'}}
                >
                  <option value="">{ALL_FIELDS.region.defaultOption}</option>
                  {ALL_FIELDS.region.options.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="marketCategory" style={{display: 'block', marginBottom: '3px', fontWeight: 'normal'}}>
                  {ALL_FIELDS.marketCategory.label} {ALL_FIELDS.marketCategory.required && <span style={{color: 'red', fontSize: '0.8em'}}>*</span>}
                </label>
                <select 
                  id="marketCategory" 
                  data-testid="portfolio-add-stock-market-category"
                  value={marketCategory} 
                  onChange={(e) => setMarketCategory(e.target.value as MarketCategoryValue)} 
                  required={ALL_FIELDS.marketCategory.required}
                  disabled={isLoading}
                  style={{width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #555', backgroundColor: '#2a2a2a', color: 'white'}}
                >
                  <option value="">{ALL_FIELDS.marketCategory.defaultOption}</option>
                  {ALL_FIELDS.marketCategory.options.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="riskGrowthProfile" style={{display: 'block', marginBottom: '3px', fontWeight: 'normal'}}>
                  {ALL_FIELDS.riskGrowthProfile.label} {ALL_FIELDS.riskGrowthProfile.required && <span style={{color: 'red', fontSize: '0.8em'}}>*</span>}
                </label>
                <select 
                  id="riskGrowthProfile" 
                  data-testid="portfolio-add-stock-risk-profile"
                  value={riskGrowthProfile} 
                  onChange={(e) => setRiskGrowthProfile(e.target.value as RiskGrowthProfileValue)} 
                  required={ALL_FIELDS.riskGrowthProfile.required}
                  disabled={isLoading}
                  style={{width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #555', backgroundColor: '#2a2a2a', color: 'white'}}
                >
                  <option value="">{ALL_FIELDS.riskGrowthProfile.defaultOption}</option>
                  {ALL_FIELDS.riskGrowthProfile.options.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Column 2: Market Data */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <h3 style={{ margin: '0 0 10px 0', borderBottom: '1px solid #333', paddingBottom: '5px' }}>Data</h3>
              
              <div>
                <label htmlFor="testPrice" style={{display: 'block', marginBottom: '3px', fontWeight: 'normal'}}>
                  {ALL_FIELDS.testPrice.label}
                </label>
                <input 
                  id="testPrice" 
                  data-testid="portfolio-add-stock-test-price"
                  type="number" 
                  step="any" 
                  min="0.01"
                  value={testPrice} 
                  onChange={(e) => setTestPrice(e.target.value)}
                  placeholder={ALL_FIELDS.testPrice.placeholder}
                  disabled={isLoading}
                  style={{width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #555', backgroundColor: '#2a2a2a', color: 'white'}}
                />
                {ALL_FIELDS.testPrice.helpText && (
                  <small style={{
                    color: '#aaa', 
                    fontSize: '0.8em', 
                    lineHeight: '1.3',
                    display: 'block',
                    marginTop: '5px'
                  }}>
                    {ALL_FIELDS.testPrice.helpText}
                  </small>
                )}
              </div>

              <div>
                <label htmlFor="budget" style={{display: 'block', marginBottom: '3px', fontWeight: 'normal'}}>
                  {ALL_FIELDS.budget.label}
                </label>
                <input 
                  id="budget" 
                  data-testid="portfolio-add-stock-budget"
                  type="number" 
                  step="any" 
                  value={budget} 
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder={ALL_FIELDS.budget.placeholder}
                  disabled={isLoading}
                  style={{width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #555', backgroundColor: '#2a2a2a', color: 'white'}}
                />
                {ALL_FIELDS.budget.helpText && (
                  <small style={{
                    color: '#aaa', 
                    fontSize: '0.8em', 
                    lineHeight: '1.3',
                    display: 'block',
                    marginTop: '5px'
                  }}>
                    {ALL_FIELDS.budget.helpText}
                  </small>
                )}
              </div>
              
              <div>
                <label htmlFor="stockTrend" style={{display: 'block', marginBottom: '3px', fontWeight: 'normal'}}>
                  {ALL_FIELDS.stockTrend.label}
                </label>
                <select 
                  id="stockTrend" 
                  data-testid="portfolio-add-stock-trend"
                  value={stockTrend || ''} 
                  onChange={(e) => setStockTrend(e.target.value as StockTrendValue || null)} 
                  disabled={isLoading}
                  style={{width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #555', backgroundColor: '#2a2a2a', color: 'white'}}
                >
                  <option value="">{ALL_FIELDS.stockTrend.defaultOption}</option>
                  {ALL_FIELDS.stockTrend.options.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                {ALL_FIELDS.stockTrend.helpText && (
                  <small style={{
                    color: '#aaa', 
                    fontSize: '0.8em', 
                    lineHeight: '1.3',
                    display: 'block',
                    marginTop: '5px'
                  }}>
                    {ALL_FIELDS.stockTrend.helpText}
                  </small>
                )}
              </div>

              <div>
                <label htmlFor="commission" style={{display: 'block', marginBottom: '3px', fontWeight: 'normal'}}>
                  {ALL_FIELDS.stockCommission.label}
                </label>
                <input 
                  id="commission" 
                  data-testid="portfolio-add-stock-commission"
                  type="number" 
                  step="any" 
                  value={stockCommission} 
                  onChange={(e) => setStockCommission(e.target.value)}
                  placeholder={ALL_FIELDS.stockCommission.placeholder}
                  disabled={isLoading}
                  style={{width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #555', backgroundColor: '#2a2a2a', color: 'white'}}
                />
                {ALL_FIELDS.stockCommission.helpText && (
                  <small style={{
                    color: '#aaa', 
                    fontSize: '0.8em', 
                    lineHeight: '1.3',
                    display: 'block',
                    marginTop: '5px'
                  }}>
                    {ALL_FIELDS.stockCommission.helpText}
                  </small>
                )}
              </div>
            </div>

            {/* Column 3: Trading Strategy */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <h3 style={{ margin: '0 0 10px 0', borderBottom: '1px solid #333', paddingBottom: '5px' }}>Strategy</h3>
              
              <div>
                <label htmlFor="shr" style={{display: 'block', marginBottom: '3px', fontWeight: 'normal'}}>
                  Swing-Hold Ratio (SHR) <span style={{color: 'red', fontSize: '0.8em'}}>*</span>
                </label>
                <input
                  id="shr"
                  data-testid="portfolio-add-stock-shr"
                  type="number"
                  step="any" 
                  min="0"   
                  max="100" 
                  value={swingHoldRatio}
                  onChange={(e) => setSwingHoldRatio(e.target.value)}
                  placeholder={ALL_FIELDS.swingHoldRatio.placeholder}
                  disabled={isLoading}
                  required={ALL_FIELDS.swingHoldRatio.required}
                  style={{width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #555', backgroundColor: '#2a2a2a', color: 'white'}}
                />
                {ALL_FIELDS.swingHoldRatio.helpText && (
                  <small style={{
                    color: '#aaa', 
                    fontSize: '0.8em', 
                    lineHeight: '1.3',
                    display: 'block',
                    marginTop: '5px'
                  }}>
                    {ALL_FIELDS.swingHoldRatio.helpText}
                  </small>
                )}
              </div>

              <div>
                <label htmlFor="pdp" style={{display: 'block', marginBottom: '3px', fontWeight: 'normal'}}>
                  Price Drop Percentage (PDP) <span style={{color: 'red', fontSize: '0.8em'}}>*</span>
                </label>
                <input 
                  id="pdp" 
                  data-testid="portfolio-add-stock-pdp"
                  type="number" 
                  step="any"
                  min="0" 
                  value={pdp} 
                  onChange={(e) => setPdp(e.target.value)}
                  placeholder={ALL_FIELDS.pdp.placeholder}
                  disabled={isLoading}
                  required={ALL_FIELDS.pdp.required}
                  style={{width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #555', backgroundColor: '#2a2a2a', color: 'white'}} 
                />
                {ALL_FIELDS.pdp.helpText && (
                  <small style={{
                    color: '#aaa', 
                    fontSize: '0.8em', 
                    lineHeight: '1.3',
                    display: 'block',
                    marginTop: '5px'
                  }}>
                    {ALL_FIELDS.pdp.helpText}
                  </small>
                )}
              </div>
              
              <div>
                <label htmlFor="stp" style={{display: 'block', marginBottom: '3px', fontWeight: 'normal'}}>
                  Swing Take Profit (STP) % <span style={{color: 'red', fontSize: '0.8em'}}>*</span>
                </label>
                <input 
                  id="stp" 
                  data-testid="portfolio-add-stock-stp"
                  type="number" 
                  step="any" 
                  value={stp} 
                  onChange={(e) => setStp(e.target.value)}
                  placeholder={ALL_FIELDS.stp.placeholder}
                  disabled={isLoading}
                  style={{width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #555', backgroundColor: '#2a2a2a', color: 'white'}}
                  min="0"
                  required={ALL_FIELDS.stp.required}
                />
                {ALL_FIELDS.stp.helpText && (
                  <small style={{
                    color: '#aaa', 
                    fontSize: '0.8em', 
                    lineHeight: '1.3',
                    display: 'block',
                    marginTop: '5px'
                  }}>
                    {ALL_FIELDS.stp.helpText}
                  </small>
                )}
              </div>

              <div>
                <label htmlFor="htp" style={{display: 'block', marginBottom: '3px', fontWeight: 'normal'}}>Hold Take Profit (HTP) %</label>
                <input 
                  id="htp" 
                  data-testid="portfolio-add-stock-htp"
                  type="number" 
                  step="any" 
                  min="0"
                  value={htp} 
                  onChange={(e) => setHtp(e.target.value)}
                  placeholder={ALL_FIELDS.htp.placeholder}
                  disabled={isLoading}
                  style={{width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #555', backgroundColor: '#2a2a2a', color: 'white'}}
                />
                {ALL_FIELDS.htp.helpText && (
                  <small style={{
                    color: '#aaa', 
                    fontSize: '0.8em', 
                    lineHeight: '1.3',
                    display: 'block',
                    marginTop: '5px'
                  }}>
                    {ALL_FIELDS.htp.helpText}
                  </small>
                )}
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid #333', paddingTop: '15px' }}>
            <button 
              type="button" 
              onClick={onCancel} 
              disabled={isLoading}
              style={{
                padding: '10px 20px',
                backgroundColor: '#555555',
                borderRadius: '4px',
                border: 'none',
                color: 'white',
                cursor: isLoading ? 'not-allowed' : 'pointer'
              }}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={isLoading}
              style={{
                padding: '10px 20px',
                backgroundColor: '#557100',
                borderRadius: '4px',
                border: 'none',
                color: 'white',
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
