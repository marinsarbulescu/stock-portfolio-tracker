import React from 'react';
import type { TransactionDataType, TransactionTableColumnVisibilityState, SortableTxnKey, SortConfig } from '../types';
import { formatCurrency, formatPercent, formatShares } from '@/app/utils/financialCalculations';
import { formatToMDYYYY } from '@/app/utils/dateFormatter';
import { FaEdit, FaTrashAlt } from 'react-icons/fa';
import { SHARE_PRECISION } from '@/app/config/constants';

export interface WalletsTransactionsSectionProps {
  transactions: TransactionDataType[];
  isLoading: boolean;
  error: string | null;
  columnVisibility: TransactionTableColumnVisibilityState;
  columnLabels: Record<keyof TransactionTableColumnVisibilityState, string>;
  setColumnVisibility: React.Dispatch<React.SetStateAction<TransactionTableColumnVisibilityState>>;
  sortConfig: SortConfig<SortableTxnKey> | null;
  requestSort: (key: SortableTxnKey) => void;
  onEdit: (txn: TransactionDataType) => void;
  onDelete: (txn: TransactionDataType) => void;
}

export default function WalletsTransactionsSection({
  transactions,
  isLoading,
  error,
  columnVisibility,
  columnLabels,
  setColumnVisibility,
  sortConfig,
  requestSort,
  onEdit,
  onDelete,
}: WalletsTransactionsSectionProps) {
  const visibleKeys = Object.keys(columnVisibility) as (keyof TransactionTableColumnVisibilityState)[];
  const colspan = visibleKeys.filter(k => columnVisibility[k]).length + 1; // +1 for Actions
  const truncateId = (id?: string | null, length = 8) => !id ? '-' : (id.length <= length ? id : `${id.slice(0, length)}...`);

  return (
    <div style={{ marginTop: '2rem' }}>
      <p style={{ fontSize: '1.3em' }}>Transactions</p>

      {isLoading && <p>Loading transaction history...</p>}
      {error && <p style={{ color: 'red' }}>Error loading transactions: {error}</p>}

      {/* Column toggles */}
      <div style={{ marginBottom: '1rem', marginTop: '1rem', padding: '10px', border: '1px solid #353535', fontSize: '0.7em', color: 'gray' }}>
        {visibleKeys.map(key => (
          <label key={key} style={{ marginLeft: '15px', whiteSpace: 'nowrap', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={columnVisibility[key]}
              onChange={() => setColumnVisibility(prev => ({ ...prev, [key]: !prev[key] }))}
              style={{ marginRight: '5px', cursor: 'pointer' }}
            />
            {columnLabels[key]}
          </label>
        ))}
      </div>

      {/* Transactions table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem', fontSize: '0.8em' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>
            {columnVisibility.date && <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestSort('date')}>{columnLabels.date} {sortConfig?.key === 'date' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}</th>}
            {columnVisibility.action && <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestSort('action')}>{columnLabels.action} {sortConfig?.key === 'action' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}</th>}
            {columnVisibility.txnType && <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestSort('txnType')}>{columnLabels.txnType} {sortConfig?.key === 'txnType' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}</th>}
            {columnVisibility.signal && <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestSort('signal')}>{columnLabels.signal} {sortConfig?.key === 'signal' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}</th>}
            {columnVisibility.price && <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestSort('price')}>{columnLabels.price} {sortConfig?.key === 'price' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}</th>}
            {columnVisibility.lbd && <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestSort('lbd')}>{columnLabels.lbd} {sortConfig?.key === 'lbd' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}</th>}
            {columnVisibility.investment && <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestSort('investment')}>{columnLabels.investment} {sortConfig?.key === 'investment' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}</th>}
            {columnVisibility.quantity && <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestSort('quantity')}>{columnLabels.quantity} {sortConfig?.key === 'quantity' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}</th>}
            {columnVisibility.proceeds && <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestSort('proceeds')}>{columnLabels.proceeds} {sortConfig?.key === 'proceeds' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}</th>}
            {columnVisibility.txnProfit && <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestSort('txnProfit')}>{columnLabels.txnProfit} {sortConfig?.key === 'txnProfit' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}</th>}
            {columnVisibility.txnProfitPercent && <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestSort('txnProfitPercent')}>{columnLabels.txnProfitPercent} {sortConfig?.key === 'txnProfitPercent' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}</th>}
            {columnVisibility.completedTxnId && <th style={{ padding: '5px', fontSize: '0.9em', color: 'grey' }}>{columnLabels.completedTxnId}</th>}
            <th style={{ padding: '5px', textAlign: 'center' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {transactions.length === 0 ? (
            <tr>
              <td colSpan={colspan} style={{ textAlign:'center', padding:'1rem' }} data-testid="no-transactions-message">No transactions found for this stock.</td>
            </tr>
          ) : (
            transactions.map((txn, index) => (
              <tr key={txn.id} style={{ backgroundColor:index%2!==0?'#151515':'transparent' }} data-testid="transaction-row">
                {columnVisibility.date && <td style={{ padding: '5px' }} data-testid="transaction-date-display">{formatToMDYYYY(txn.date)}</td>}
                {columnVisibility.action && <td style={{ padding: '5px' }} data-testid="transaction-action-display">{txn.action}</td>}
                {columnVisibility.txnType && <td style={{ padding: '5px' }} data-testid="transaction-txnType-display">{txn.txnType??'-'}</td>}
                {columnVisibility.signal && <td style={{ padding: '5px' }} data-testid="transaction-signal-display">{txn.signal??'-'}</td>}
                {columnVisibility.price && <td style={{ padding: '5px' }} data-testid="transaction-price-display">{formatCurrency(txn.price??0)}</td>}
                {columnVisibility.lbd && <td style={{ padding: '5px' }} data-testid="transaction-lbd-display">{txn.action==='Buy'?formatCurrency(txn.lbd??0):'-'}</td>}
                {columnVisibility.investment && <td style={{ padding: '5px' }} data-testid="transaction-investment-display">{txn.action!=='Sell'?formatCurrency(txn.investment??0):'-'}</td>}
                {columnVisibility.quantity && <td style={{ padding: '5px' }} data-testid="transaction-quantity-display">{formatShares(txn.quantity ?? 0, SHARE_PRECISION)}</td>}
                {columnVisibility.proceeds && <td style={{ padding: '5px' }} data-testid="transaction-proceeds-display">{txn.action==='Sell'&&typeof txn.price==='number'&&typeof txn.quantity==='number'?formatCurrency(txn.price*txn.quantity):'-'}</td>}
                {columnVisibility.txnProfit && <td style={{ padding: '5px', color:txn.action!=='Sell'||txn.txnProfit==null?'inherit':(txn.txnProfit>=0?'#01ff00':'#ff0000')}} data-testid="transaction-txnProfit-display">{txn.action==='Sell'?formatCurrency(txn.txnProfit??0):'-'}</td>}
                {columnVisibility.txnProfitPercent && <td style={{ padding: '5px', color: txn.action!=='Sell' || txn.txnProfitPercent == null ? 'inherit' : (txn.txnProfitPercent >= 0 ? '#01ff00' : '#ff0000') }} data-testid="transaction-txnProfitPercent-display">{txn.action === 'Sell' ? formatPercent(txn.txnProfitPercent ?? 0) : '-'}</td>}
                {columnVisibility.completedTxnId && <td style={{ padding: '5px', fontSize: '0.9em', color: 'grey' }} data-testid="transaction-completedTxnId-display">{txn.action==='Sell'?truncateId(txn.completedTxnId):'-'}</td>}
                <td style={{ padding: '5px', textAlign: 'center' }}>
                  <button data-testid={`transaction-edit-button-${txn.id}`} onClick={() => onEdit(txn)} title="Edit Transaction" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '5px', color: 'gray', marginRight: '5px' }}><FaEdit /></button>
                  <button data-testid={`transaction-delete-button-${txn.id}`} onClick={() => onDelete(txn)} title="Delete Transaction" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '5px', color: 'gray' }}><FaTrashAlt /></button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
