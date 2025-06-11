import React from 'react';
import type { TransactionDataType } from '../types';
import { formatCurrency, formatPercent, formatShares } from '@/app/utils/financialCalculations';

export interface WalletsTransactionsSectionProps {
  transactions: TransactionDataType[];
  txnColumnVisibility: Record<string, boolean>;
  setTxnColumnVisibility: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  txnSortConfig: { key: string; direction: 'ascending' | 'descending' } | null;
  requestTxnSort: (key: string) => void;
  sortedTransactions: TransactionDataType[];
  pricesLoading: boolean;
  txnError: string | null;
}

export default function WalletsTransactionsSection({
  transactions,
  txnColumnVisibility,
  setTxnColumnVisibility,
  txnSortConfig,
  requestTxnSort,
  sortedTransactions,
  pricesLoading,
  txnError,
}: WalletsTransactionsSectionProps) {
  // Implement the transactions table rendering here
  return (
    <div style={{ marginTop: '2rem' }}>
      <p style={{ fontSize: '1.3em' }}>Transactions</p>

      {pricesLoading && <p>Loading transaction history...</p>}
      {txnError && <p style={{ color: 'red' }}>Error loading transactions: {txnError}</p>}

      {/* Column toggles */}
      <div style={{ marginBottom: '1rem', marginTop: '1rem', padding: '10px', border: '1px solid #353535', fontSize: '0.7em', color: 'gray' }}>
        {Object.keys(txnColumnVisibility).map(key => (
          <label key={key} style={{ marginLeft: '15px', whiteSpace: 'nowrap', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={txnColumnVisibility[key]}
              onChange={() => setTxnColumnVisibility(prev => ({ ...prev, [key]: !prev[key] }))}
              style={{ marginRight: '5px', cursor: 'pointer' }}
            />
            {key}
          </label>
        ))}
      </div>

      {/* Transactions table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem', fontSize: '0.8em' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>
            {/* Map header cells similar to page.tsx */}
          </tr>
        </thead>
        <tbody>
          {/* Map sortedTransactions into rows */}
        </tbody>
      </table>
    </div>
  );
}
