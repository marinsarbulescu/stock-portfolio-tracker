import React from 'react';
import type { StockWalletDataType } from '../types';
import { formatCurrency } from '@/app/utils/financialCalculations';
//import { SHARE_EPSILON, SHARE_PRECISION, CURRENCY_PRECISION, PERCENT_PRECISION } from '@/app/config/constants';
import type { Schema } from '@/amplify/data/resource';
//import { formatToMDYYYY } from '@/app/utils/dateFormatter';

export interface WalletsSellTransactionModalProps {
  show: boolean;
  wallet: StockWalletDataType;
  sellDate: string;
  sellQuantity: string;
  sellPrice: string;
  sellSignal?: Schema['Transaction']['type']['signal'];
  sellError: string | null;
  isSelling: boolean;
  onDateChange: (date: string) => void;
  onQuantityChange: (quantity: string) => void;
  onPriceChange: (price: string) => void;
  onSignalChange: (signal: Schema['Transaction']['type']['signal']) => void;
  onCancel: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

// Styles
const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  backgroundColor: 'rgba(0,0,0,0.5)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
};
const modalContentStyle: React.CSSProperties = {
  backgroundColor: '#1e1e1e',
  padding: '20px',
  borderRadius: '8px',
  color: 'white',
};
const formGroupStyle: React.CSSProperties = { marginBottom: '10px' };
const labelStyle: React.CSSProperties = { marginRight: '5px' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '5px', backgroundColor: '#2e2e2e', color: 'white', border: '1px solid #555', borderRadius: '4px' };

export default function WalletsSellTransactionModal({
  show,
  wallet,
  sellDate,
  sellQuantity,
  sellPrice,
  sellSignal,
  sellError,
  isSelling,
  onDateChange,
  onQuantityChange,
  onPriceChange,
  onSignalChange,
  onCancel,
  onSubmit,
}: WalletsSellTransactionModalProps) {
  if (!show) return null;

  return (
    <div style={modalOverlayStyle}>
      <div style={modalContentStyle}>
        <form onSubmit={onSubmit}>
          <h3>Sell Shares from Wallet</h3>
          <p style={{ marginBottom: '15px' }}>
            Stock: <strong>{wallet.portfolioStockId}</strong> | Buy Price: <strong>{formatCurrency(wallet.buyPrice ?? 0)}</strong>
          </p>

          {sellError && <p style={{ color: 'red' }}>{sellError}</p>}

          <div style={formGroupStyle}>
            <label htmlFor="sellDate" style={labelStyle}>Date:</label>
            <input
              id="sellDate"
              type="date"
              value={sellDate}
              onChange={e => onDateChange(e.target.value)}
              required
              disabled={isSelling}
              style={inputStyle}
            />
          </div>

          <div style={formGroupStyle}>
            <label htmlFor="sellPrice" style={labelStyle}>Price ($):</label>
            <input
              id="sellPrice"
              type="number"
              value={sellPrice}
              onChange={e => onPriceChange(e.target.value)}
              required
              disabled={isSelling}
              style={inputStyle}
            />
          </div>

          <div style={formGroupStyle}>
            <label htmlFor="sellQuantity" style={labelStyle}>Quantity:</label>
            <input
              id="sellQuantity"
              type="number"
              value={sellQuantity}
              onChange={e => onQuantityChange(e.target.value)}
              required
              disabled={isSelling}
              style={inputStyle}
            />
          </div>

          <div style={formGroupStyle}>
            <label htmlFor="sellSignal" style={labelStyle}>Signal:</label>
            <select
              id="sellSignal"
              value={sellSignal ?? ''}
              onChange={e => onSignalChange(e.target.value as Schema['Transaction']['type']['signal'])}
              required
              disabled={isSelling}
              style={inputStyle}
            >
              <option value="">-- Select Signal --</option>
              <option value="Cust">Cust</option>
              <option value="TP">TP</option>
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onCancel} disabled={isSelling} style={{ marginRight: '10px' }}>
              Cancel
            </button>
            <button type="submit" disabled={isSelling}>
              {isSelling ? 'Selling...' : 'Confirm Sale'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
