// app/(authed)/portfolio/components/PortfolioAddEditStockModal.tsx
'use client';

import React, { useState } from 'react';
import { type Schema } from '@/amplify/data/resource';
import { generateClient } from 'aws-amplify/data';

// Import types from the portfolio types file
import type {
  PortfolioStockCreateInput,
  PortfolioStockUpdateInput,
  StockTypeValue,
  RegionValue,
  StockTrendValue,
  MarketCategoryValue,
  RiskGrowthProfileValue,
  PortfolioAddEditStockModalProps,
} from '../types';

import { modalOverlayStyle, modalContentStyle } from '../types';
import { ALL_FIELDS } from '../constants/fieldDefinitions';

const client = generateClient<Schema>();

export default function PortfolioAddEditStockModal({
  mode,
  isOpen,
  initialData,
  onSuccess,
  onCancel,
}: PortfolioAddEditStockModalProps) {
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

  // Reset form when modal opens or mode changes
  React.useEffect(() => {
    if (isOpen) {
      setError(null);
      
      if (mode === 'edit' && initialData) {
        // Populate form fields from initialData for edit mode
        setSymbol(initialData.symbol || '');
        setStockType(initialData.stockType || '');
        setRegion(initialData.region || '');
        setStockTrend(initialData.stockTrend || null);
        setMarketCategory(initialData.marketCategory || '');
        setRiskGrowthProfile(initialData.riskGrowthProfile || '');
        setName(initialData.name || '');
        setPdp(initialData.pdp?.toString() || '');
        setStp(initialData.stp?.toString() || '');
        setBudget(initialData.budget?.toString() || '');
        setTestPrice(initialData.testPrice?.toString() || '');
        setSwingHoldRatio(initialData.swingHoldRatio?.toString() || '');
        setStockCommission(initialData.stockCommission?.toString() || '');
        setHtp(initialData.htp?.toString() || '');
      } else {
        // Reset form for add mode
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
        setHtp('');
      }
    }
  }, [isOpen, mode, initialData]);

  // Handle form submission
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    // --- Basic Validation ---
    if (!symbol || !stockType || !region || !marketCategory || !riskGrowthProfile) {
      setError('Please fill in all required fields (Symbol, Type, Region, Market Sector, Risk Profile).');
      setIsLoading(false);
      return;
    }

    if (!stp || parseFloat(stp) <= 0) {
      setError('Swing Take Profit (STP) % is required and must be greater than 0.');
      setIsLoading(false);
      return;
    }

    try {
      // Parse numeric values with validation
      const pdpValue = pdp ? parseFloat(pdp) : undefined;
      const stpValue = parseFloat(stp);
      const budgetValue = budget ? parseFloat(budget) : undefined;
      const testPriceValue = testPrice ? parseFloat(testPrice) : undefined;
      const swingHoldRatioValue = swingHoldRatio ? parseFloat(swingHoldRatio) : undefined;
      const stockCommissionValue = stockCommission ? parseFloat(stockCommission) : undefined;
      const htpValue = htp ? parseFloat(htp) : undefined;

      if (mode === 'add') {
        // Create new stock
        const stockData: PortfolioStockCreateInput = {
          symbol: symbol.toUpperCase().trim(),
          stockType: stockType as StockTypeValue,
          region: region as RegionValue,
          stockTrend: stockTrend,
          marketCategory: marketCategory || undefined,
          riskGrowthProfile: riskGrowthProfile || undefined,
          name: name.trim() || undefined,
          pdp: pdpValue,
          stp: stpValue,
          budget: budgetValue,
          testPrice: testPriceValue,
          swingHoldRatio: swingHoldRatioValue,
          stockCommission: stockCommissionValue,
          htp: htpValue,
          isHidden: false,
          archived: false,
        };

        const { data: createdStock, errors } = await client.models.PortfolioStock.create(stockData);
        if (errors) throw errors;
        
        console.log('Stock created successfully:', createdStock);
        onSuccess(createdStock);
        
      } else {
        // Update existing stock
        if (!initialData?.id) {
          throw new Error('Stock ID is required for update');
        }

        const updateData: PortfolioStockUpdateInput = {
          id: initialData.id,
          symbol: symbol.toUpperCase().trim(),
          stockType: stockType as StockTypeValue,
          region: region as RegionValue,
          stockTrend: stockTrend,
          marketCategory: marketCategory || undefined,
          riskGrowthProfile: riskGrowthProfile || undefined,
          name: name.trim() || undefined,
          pdp: pdpValue,
          stp: stpValue,
          budget: budgetValue,
          testPrice: testPriceValue,
          swingHoldRatio: swingHoldRatioValue,
          stockCommission: stockCommissionValue,
          htp: htpValue,
        };

        const { data: updatedStock, errors } = await client.models.PortfolioStock.update(updateData);
        if (errors) throw errors;
        
        console.log('Stock updated successfully:', updatedStock);
        onSuccess(updatedStock);
      }

    } catch (err: unknown) {
      console.error(`Error ${mode === 'add' ? 'creating' : 'updating'} stock:`, err);
      const errorMessage = Array.isArray(err) 
        ? (err as Array<{message: string}>)[0].message 
        : ((err as Error).message || `An unexpected error occurred while ${mode === 'add' ? 'creating' : 'updating'} the stock.`);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  // Mode-specific content
  const modalTitle = mode === 'add' 
    ? 'Add New Stock to Portfolio' 
    : `Edit ${initialData?.symbol || 'Stock'}`;
  
  const submitButtonText = mode === 'add' ? 'Add Stock' : 'Update Stock';
  
  const dataTestidPrefix = mode === 'add' ? 'portfolio-add-stock' : 'portfolio-edit-stock';

  return (
    <div style={modalOverlayStyle}>
      <div style={modalContentStyle} data-testid={`${dataTestidPrefix}-modal`}>
        <form onSubmit={handleSubmit} style={{ 
          padding: '1.5rem'
        }}>
          <h2 style={{ margin: '0 0 20px 0', textAlign: 'center' }}>{modalTitle}</h2>
          
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
                  data-testid={`${dataTestidPrefix}-symbol`}
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
                  data-testid={`${dataTestidPrefix}-name`}
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  placeholder={ALL_FIELDS.name.placeholder}
                  disabled={isLoading}
                  style={{width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #555', backgroundColor: '#2a2a2a', color: 'white'}}
                />
              </div>

              <div>
                <label htmlFor="stockType" style={{display: 'block', marginBottom: '3px', fontWeight: 'normal'}}>
                  {ALL_FIELDS.stockType.label} {ALL_FIELDS.stockType.required && <span style={{color: 'red', fontSize: '0.8em'}}>*</span>}
                </label>
                <select 
                  id="stockType" 
                  data-testid={`${dataTestidPrefix}-type`}
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
                  data-testid={`${dataTestidPrefix}-region`}
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
                  {ALL_FIELDS.marketCategory.label}
                </label>
                <select 
                  id="marketCategory" 
                  data-testid={`${dataTestidPrefix}-market-category`}
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
                  {ALL_FIELDS.riskGrowthProfile.label}
                </label>
                <select 
                  id="riskGrowthProfile" 
                  data-testid={`${dataTestidPrefix}-risk-growth-profile`}
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
                  data-testid={`${dataTestidPrefix}-test-price`}
                  type="number" 
                  step="any" 
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
                  data-testid={`${dataTestidPrefix}-budget`}
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
                  data-testid={`${dataTestidPrefix}-trend`}
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
              </div>

              <div>
                <label htmlFor="stockCommission" style={{display: 'block', marginBottom: '3px', fontWeight: 'normal'}}>
                  {ALL_FIELDS.stockCommission.label}
                </label>
                <input 
                  id="stockCommission" 
                  data-testid={`${dataTestidPrefix}-commission`}
                  type="number" 
                  step="any" 
                  min="0"
                  max="100"
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

            {/* Column 3: Strategy */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <h3 style={{ margin: '0 0 10px 0', borderBottom: '1px solid #333', paddingBottom: '5px' }}>Strategy</h3>
              
              <div>
                <label htmlFor="shr" style={{display: 'block', marginBottom: '3px', fontWeight: 'normal'}}>
                  Swing-Hold Ratio (SHR) <span style={{color: 'red', fontSize: '0.8em'}}>*</span>
                </label>
                <input
                  id="shr"
                  data-testid={`${dataTestidPrefix}-shr`}
                  type="number"
                  step="any" 
                  min="0"   
                  max="100" 
                  value={swingHoldRatio}
                  onChange={(e) => setSwingHoldRatio(e.target.value)}
                  placeholder={ALL_FIELDS.swingHoldRatio.placeholder}
                  disabled={isLoading}
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
                  Price Drop Percentage (PDP) %
                </label>
                <input 
                  id="pdp" 
                  data-testid={`${dataTestidPrefix}-pdp`}
                  type="number" 
                  step="any" 
                  value={pdp} 
                  onChange={(e) => setPdp(e.target.value)}
                  placeholder={ALL_FIELDS.pdp.placeholder}
                  disabled={isLoading}
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
                  data-testid={`${dataTestidPrefix}-stp`}
                  type="number" 
                  step="any" 
                  value={stp} 
                  onChange={(e) => setStp(e.target.value)}
                  placeholder={ALL_FIELDS.stp.placeholder}
                  disabled={isLoading}
                  style={{width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #555', backgroundColor: '#2a2a2a', color: 'white'}}
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
                <label htmlFor="htp" style={{display: 'block', marginBottom: '3px', fontWeight: 'normal'}}>
                  Hold Take Profit (HTP) %
                </label>
                <input 
                  id="htp" 
                  data-testid={`${dataTestidPrefix}-htp`}
                  type="number" 
                  step="any" 
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
              data-testid={`${dataTestidPrefix}-cancel-button`}
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
              data-testid={`${dataTestidPrefix}-submit-button`}
              style={{
                padding: '10px 20px',
                backgroundColor: '#557100',
                borderRadius: '4px',
                border: 'none',
                color: 'white',
                cursor: isLoading ? 'not-allowed' : 'pointer'
              }}
            >
              {isLoading ? (mode === 'add' ? 'Adding...' : 'Updating...') : submitButtonText}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}