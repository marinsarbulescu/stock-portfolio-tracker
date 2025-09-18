// app/(authed)/wallets/[stockId]/components/WalletsTransactionsTable.tsx
import React from 'react';
import type { TransactionDataType, TransactionTableColumnVisibilityState, SortableTxnKey, SortConfig } from '../types';
import { formatCurrency, formatPercent, formatShares } from '@/app/utils/financialCalculations';
import { formatToMDYYYY, formatToShortDateTime } from '@/app/utils/dateFormatter';
import { FaEdit, FaTrashAlt } from 'react-icons/fa';
import { SHARE_PRECISION } from '@/app/config/constants';

export interface WalletsTransactionsTableProps {
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

export default function WalletsTransactionsTable({
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
}: WalletsTransactionsTableProps) {
  const visibleKeys = Object.keys(columnVisibility) as (keyof TransactionTableColumnVisibilityState)[];
  const colspan = visibleKeys.filter(k => columnVisibility[k]).length + 1; // +1 for Actions
  const truncateId = (id?: string | null, length = 8) => !id ? '-' : (id.length <= length ? id : `${id.slice(0, length)}...`);

  return (
    <div style={{ marginTop: '2rem' }}>
      <p style={{ fontSize: '1.3em' }} data-testid="wallets-transactions-section-header">Transactions</p>

      {isLoading && <p>Loading transaction history...</p>}
      {error && <p style={{ color: 'red' }}>Error loading transactions: {error}</p>}

      {/* Column toggles */}
      <div style={{ marginBottom: '1rem', marginTop: '1rem', padding: '10px', border: '1px solid #353535', fontSize: '0.7em', color: 'gray' }}>
        {visibleKeys.map(key => (
          <label key={key} style={{ marginLeft: '15px', whiteSpace: 'nowrap', cursor: 'pointer' }}>
            <input
              data-testid={`wallets-transaction-table-toggle-column-${key}-checkbox`}
              type="checkbox"
              checked={columnVisibility[key]}
              onChange={() => setColumnVisibility(prev => ({ ...prev, [key]: !prev[key] }))}
              style={{ marginRight: '5px', cursor: 'pointer' }}
            />
            {columnLabels[key]}
          </label>
        ))}
      </div>

      {/* --- START: Wallets Transactions Table --- */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem', fontSize: '0.8em' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>
            {columnVisibility.date && 
              <th data-testid={`wallets-transaction-table-date-header`} style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestSort('date')}>
                {columnLabels.date} {sortConfig?.key === 'date' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
              </th>
            }
            {columnVisibility.action && 
              <th data-testid={`wallets-transaction-table-action-header`} style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestSort('action')}>
                {columnLabels.action} {sortConfig?.key === 'action' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
              </th>
            }
            {columnVisibility.txnType && 
              <th data-testid={`wallets-transaction-table-txnType-header`} style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestSort('txnType')}>
                {columnLabels.txnType} {sortConfig?.key === 'txnType' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
              </th>
            }
            {columnVisibility.signal && 
              <th data-testid={`wallets-transaction-table-signal-header`} style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestSort('signal')}>
                {columnLabels.signal} {sortConfig?.key === 'signal' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
              </th>
            }
            {columnVisibility.price && 
              <th data-testid={`wallets-transaction-table-price-header`} style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestSort('price')}>
                {columnLabels.price} {sortConfig?.key === 'price' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
              </th>
            }
            {columnVisibility.lbd && 
              <th data-testid={`wallets-transaction-table-lbd-header`} style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestSort('lbd')}>
                {columnLabels.lbd} {sortConfig?.key === 'lbd' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
              </th>
            }
            {columnVisibility.investment && 
              <th data-testid={`wallets-transaction-table-investment-header`} style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestSort('investment')}>
                {columnLabels.investment} {sortConfig?.key === 'investment' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
              </th>
            }
            {columnVisibility.amount && 
              <th data-testid={`wallets-transaction-table-amount-header`} style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestSort('amount')}>
                {columnLabels.amount} {sortConfig?.key === 'amount' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
              </th>
            }
            {columnVisibility.quantity && 
              <th data-testid={`wallets-transaction-table-quantity-header`} style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestSort('quantity')}>
                {columnLabels.quantity} {sortConfig?.key === 'quantity' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
              </th>
            }
            {columnVisibility.proceeds && 
              <th data-testid={`wallets-transaction-table-proceeds-header`} style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestSort('proceeds')}>
                {columnLabels.proceeds} {sortConfig?.key === 'proceeds' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
              </th>
            }
            {columnVisibility.txnProfit && 
              <th data-testid={`wallets-transaction-table-txnProfit-header`} style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestSort('txnProfit')}>
                {columnLabels.txnProfit} {sortConfig?.key === 'txnProfit' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
              </th>
            }
            {columnVisibility.txnProfitPercent && 
              <th data-testid={`wallets-transaction-table-txnProfitPercent-header`} style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestSort('txnProfitPercent')}>
                {columnLabels.txnProfitPercent} {sortConfig?.key === 'txnProfitPercent' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
              </th>
            }
            {columnVisibility.completedTxnId && 
              <th data-testid={`wallets-transaction-table-completedTxnId-header`} style={{ padding: '5px', fontSize: '0.9em', color: 'grey' }}>
                {columnLabels.completedTxnId}
              </th>
            }
            {columnVisibility.createdAt && 
              <th data-testid={`wallets-transaction-table-createdAt-header`} style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestSort('createdAt')}>
                {columnLabels.createdAt} {sortConfig?.key === 'createdAt' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
              </th>
            }
            <th data-testid={`wallets-transaction-table-actions-header`} style={{ padding: '5px', textAlign: 'center' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {transactions.length === 0 ? (
            <tr>
              <td colSpan={colspan} style={{ textAlign:'center', padding:'1rem' }} data-testid="wallets-transaction-table-no-transactions-message">No transactions found for this stock.</td>
            </tr>
          ) : (
            transactions.map((txn, index) => (
              <tr key={txn.id} style={{ backgroundColor:index%2!==0?'#151515':'transparent' }} data-testid="wallets-transaction-table-transaction-row">
                {columnVisibility.date && 
                  <td style={{ padding: '5px' }} data-testid="wallets-transaction-table-date-display">
                    {formatToMDYYYY(txn.date)}
                  </td>
                }
                {columnVisibility.action && 
                  <td style={{ padding: '5px' }} data-testid="wallets-transaction-table-action-display">
                    {txn.action}
                  </td>
                }
                {columnVisibility.txnType && 
                  <td style={{ padding: '5px' }} data-testid="wallets-transaction-table-txnType-display">
                    {txn.txnType??'-'}
                  </td>
                }
                {columnVisibility.signal && 
                  <td style={{ padding: '5px' }} data-testid="wallets-transaction-table-signal-display">
                    {txn.signal??'-'}
                  </td>
                }
                {columnVisibility.price && 
                  <td style={{ padding: '5px' }} data-testid="wallets-transaction-table-price-display">
                    {(txn.action === 'Div' || txn.action === 'SLP') ? '-' : formatCurrency(txn.price??0)}
                  </td>
                }
                {columnVisibility.lbd && 
                  <td style={{ padding: '5px' }} data-testid="wallets-transaction-table-lbd-display">
                    {txn.action==='Buy'?formatCurrency(txn.lbd??0):'-'}
                  </td>
                }
                {columnVisibility.investment && 
                  <td style={{ padding: '5px' }} data-testid="wallets-transaction-table-investment-display">
                    {txn.action === 'Buy' ? formatCurrency(txn.investment ?? 0) : '-'}
                  </td>
                }
                {columnVisibility.amount && 
                  <td style={{ padding: '5px' }} data-testid="wallets-transaction-table-amount-display">
                    {(txn.action === 'Div' || txn.action === 'SLP') ? formatCurrency(txn.amount ?? 0) : '-'}
                  </td>
                }
                {columnVisibility.quantity && 
                  <td style={{ padding: '5px' }} data-testid="wallets-transaction-table-quantity-display">
                    {txn.action === 'SLP' ? '-' : formatShares(txn.quantity ?? 0, SHARE_PRECISION)}
                  </td>
                }
                {columnVisibility.proceeds && 
                  <td style={{ padding: '5px' }} data-testid="wallets-transaction-table-proceeds-display">
                    {txn.action==='Sell'&&typeof txn.price==='number'&&typeof txn.quantity==='number'?formatCurrency(txn.price*txn.quantity):'-'}
                  </td>
                }
                {columnVisibility.txnProfit && 
                  <td style={{ padding: '5px', color:txn.action!=='Sell'||txn.txnProfit==null?'inherit':(txn.txnProfit>=0?'#01ff00':'#ff0000')}} data-testid="wallets-transaction-table-txnProfit-display">
                    {txn.action==='Sell'?formatCurrency(txn.txnProfit??0):'-'}
                  </td>
                }
                {columnVisibility.txnProfitPercent && 
                  <td style={{ padding: '5px', color: txn.action!=='Sell' || txn.txnProfitPercent == null ? 'inherit' : (txn.txnProfitPercent >= 0 ? '#01ff00' : '#ff0000') }} data-testid="wallets-transaction-table-txnProfitPercent-display">
                    {txn.action === 'Sell' ? formatPercent(txn.txnProfitPercent ?? 0) : '-'}
                  </td>
                }
                {columnVisibility.completedTxnId && 
                  <td style={{ padding: '5px', fontSize: '0.9em', color: 'grey' }} data-testid="wallets-transaction-table-completedTxnId-display">
                    {txn.action==='Sell'?truncateId(txn.completedTxnId):'-'}
                  </td>
                }
                {columnVisibility.createdAt && 
                  <td style={{ padding: '5px', fontSize: '0.7em', color: 'grey' }} data-testid="wallets-transaction-table-createdAt-display">
                    {formatToShortDateTime(txn.createdAt)}
                  </td>
                }
                <td style={{ padding: '5px', textAlign: 'center' }}>
                  <button 
                    data-testid={`wallets-transaction-table-txn-edit-button-${txn.id}`} 
                    onClick={() => onEdit(txn)} 
                    title="Edit Transaction" 
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '5px', color: 'gray', marginRight: '5px' }}>
                      <FaEdit />
                    </button>
                  <button 
                    data-testid={`wallets-transaction-table-txn-delete-button-${txn.id}`} 
                    onClick={() => onDelete(txn)} 
                    title="Delete Transaction" 
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '5px', color: 'gray' }}>
                      <FaTrashAlt />
                    </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
        {/* --- END: Wallets Transactions Table --- */}
      </table>
    </div>
  );
}
