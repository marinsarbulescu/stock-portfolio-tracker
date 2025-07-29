import React from 'react';
import { formatCurrency } from '@/app/utils/financialCalculations';

export interface WalletsHeaderProps {
  name: string;
  symbol?: string | null;
  price?: number | null;
  isTestPrice?: boolean;
  pricesLoading: boolean;
  onAddTransaction: () => void; // Changed from onAddBuy to be more generic
  onEditStock: () => void;
}

export default function WalletsHeader({
  name,
  symbol,
  price,
  isTestPrice = false,
  pricesLoading,
  onAddTransaction,
  onEditStock,
}: WalletsHeaderProps) {
  const displayPrice =
    typeof price === 'number'
      ? formatCurrency(price)
      : pricesLoading
      ? 'Loading...'
      : 'N/A';

  // Truncate name to 27 characters
  const truncatedName = name.length > 36 ? `${name.substring(0, 36)}...` : name;

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
      <div>
        <p style={{ fontSize: '1.5em' }}>
          {truncatedName} (
          <span 
            data-testid="wallet-page-title"
            onClick={onEditStock}
            style={{ 
              cursor: 'pointer', 
              textDecoration: 'underline',
              color: '#0078d4'
            }}
            title="Click to edit stock settings"
          >
            {symbol?.toUpperCase()}
          </span>
          )
        </p>
        <p style={{ 
          fontSize: '1.2em',
          color: isTestPrice ? '#9f4f96' : 'inherit'
        }}
        data-testid="wallets-header-price">
          {displayPrice}
        </p>
      </div>
      <button data-testid="add-transaction-button" onClick={onAddTransaction} style={{ padding: '8px 15px' }}>
        Add Transaction
      </button>
    </div>
  );
}
