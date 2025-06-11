import React from 'react';
import { formatCurrency } from '@/app/utils/financialCalculations';

export interface WalletsPageHeaderProps {
  name: string;
  symbol?: string | null;
  price?: number | null;
  pricesLoading: boolean;
  onAddBuy: () => void;
}

export default function WalletsPageHeader({ name, symbol, price, pricesLoading, onAddBuy }: WalletsPageHeaderProps) {
  const displayPrice =
    typeof price === 'number'
      ? formatCurrency(price)
      : pricesLoading
      ? 'Loading...'
      : 'N/A';

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
      <div>
        <p style={{ fontSize: '1.5em' }}>
          {name} (<span data-testid="wallet-page-title">{symbol?.toUpperCase()}</span>)
        </p>
        <p style={{ fontSize: '1.2em' }}>{displayPrice}</p>
      </div>
      <button data-testid="add-buy-transaction-button" onClick={onAddBuy} style={{ padding: '8px 15px' }}>
        Add Buy Transaction
      </button>
    </div>
  );
}
