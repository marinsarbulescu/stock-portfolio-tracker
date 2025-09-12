//app/(authed)/wallets/[stockId]/components/WalletsTabs.tsx
import React from 'react';
import { StockWalletDataType, WalletsTableColumnVisibilityState, WalletsTableSortableKey } from '../types';
import { isHtpSignalActive, getHtpDisplayValue } from '@/app/utils/htpCalculations';
import type { Dispatch, SetStateAction } from 'react';
import { formatCurrency, formatShares } from '@/app/utils/financialCalculations';
import { formatPercent } from '@/app/utils/financialCalculations';
import { SHARE_EPSILON, SHARE_PRECISION } from '@/app/config/constants';

export interface WalletsTabsProps {
  swingWallets: StockWalletDataType[];
  holdWallets: StockWalletDataType[];
  walletColumnVisibility: WalletsTableColumnVisibilityState;
  columnLabels: Record<keyof WalletsTableColumnVisibilityState, string>;
  setWalletColumnVisibility: Dispatch<SetStateAction<WalletsTableColumnVisibilityState>>;
  walletSortConfig: { key: WalletsTableSortableKey; direction: 'ascending' | 'descending' } | null;
  requestWalletSort: (key: WalletsTableSortableKey) => void;
  activeTab: 'Swing' | 'Hold';
  setActiveTab: Dispatch<SetStateAction<'Swing' | 'Hold'>>;
  error: string | null;
  latestPrices: Record<string, { currentPrice: number | null; previousClose?: number } | null>;
  stockSymbol?: string;
  onSell: (wallet: StockWalletDataType) => void;
  onDelete: (wallet: StockWalletDataType) => void;
  showEmptyWallets: boolean;
  setShowEmptyWallets: Dispatch<SetStateAction<boolean>>;
  stockHtp?: number | null;
  stockCommission?: number | null;
}

export default function WalletsTabs({
  swingWallets,
  holdWallets,
  walletColumnVisibility,
  columnLabels,
  setWalletColumnVisibility,
  walletSortConfig,
  requestWalletSort,
  activeTab,
  setActiveTab,
  error,
  latestPrices,
  stockSymbol,
  onSell,
  onDelete,
  showEmptyWallets,
  setShowEmptyWallets,
  stockHtp,
  stockCommission,
}: WalletsTabsProps) {
  const truncateId = (id: string | null | undefined, length = 8): string => {
    if (!id) return '-';
    return id.slice(0, length) + (id.length > length ? '...' : '');
  };

  const getTpCellStyle = (wallet: StockWalletDataType, currentStockPrice: number | null | undefined) => {
    const remaining = wallet.remainingShares ?? 0;
    const tp = wallet.tpValue;
    if (
      remaining > SHARE_EPSILON &&
      typeof tp === 'number' &&
      typeof currentStockPrice === 'number' &&
      tp <= currentStockPrice
    ) {
      return { color: 'lightgreen' };
    }
    return {};
  };

  // Helper function to check if TP is highlighted (take profit condition met)
  const isTpHighlighted = (wallet: StockWalletDataType, currentStockPrice: number | null | undefined) => {
    const remaining = wallet.remainingShares ?? 0;
    const tp = wallet.tpValue;
    return (
      remaining > SHARE_EPSILON &&
      typeof tp === 'number' &&
      typeof currentStockPrice === 'number' &&
      tp <= currentStockPrice
    );
  };

  // HTP Sell Signal Logic - Only for Hold wallets
  const getHtpCellStyle = (wallet: StockWalletDataType, currentStockPrice: number | null | undefined) => {
    // Only apply HTP logic for Hold wallets
    if (wallet.walletType !== 'Hold') {
      return {};
    }

    const remaining = wallet.remainingShares ?? 0;
    const buyPrice = wallet.buyPrice;

    // Must have remaining shares, valid buy price, valid current price, and valid HTP
    if (
      remaining <= SHARE_EPSILON ||
      typeof buyPrice !== 'number' ||
      typeof currentStockPrice !== 'number' ||
      typeof stockHtp !== 'number' ||
      stockHtp <= 0 ||
      buyPrice <= 0
    ) {
      return {};
    }

    // Use shared utility to check if HTP signal is active
    if (isHtpSignalActive(buyPrice, stockHtp, currentStockPrice, stockCommission)) {
      return { color: 'lightgreen' };
    }

    return {};
  };

  // HTP Display Value function - calculates percentage from buy price to current price for HTP signals
  const getHtpDisplayValueForWallet = (wallet: StockWalletDataType, currentStockPrice: number | null | undefined) => {
    // Only show HTP value for Hold wallets with HTP signal
    if (wallet.walletType !== 'Hold') {
      return '-';
    }

    const remaining = wallet.remainingShares ?? 0;
    const buyPrice = wallet.buyPrice;

    // Must have remaining shares, valid buy price, valid current price, and valid HTP
    if (
      remaining <= SHARE_EPSILON ||
      typeof buyPrice !== 'number' ||
      typeof currentStockPrice !== 'number' ||
      typeof stockHtp !== 'number' ||
      stockHtp <= 0 ||
      buyPrice <= 0
    ) {
      return '-';
    }

    // Use shared utility to get HTP display value
    return getHtpDisplayValue(buyPrice, stockHtp, currentStockPrice, stockCommission);
  };

  const visibleColumns = Object.keys(walletColumnVisibility) as Array<keyof WalletsTableColumnVisibilityState>;

  const currentPrice = latestPrices[stockSymbol ?? '']?.currentPrice;

  // Filter wallets based on showEmptyWallets toggle
  const filterWallets = (wallets: StockWalletDataType[]) => {
    if (showEmptyWallets) return wallets;
    return wallets.filter(wallet => (wallet.remainingShares ?? 0) > SHARE_EPSILON);
  };

  const filteredSwingWallets = filterWallets(swingWallets);
  const filteredHoldWallets = filterWallets(holdWallets);

  // Count wallets for display
  const getWalletCounts = (wallets: StockWalletDataType[]) => {
    const total = wallets.length;
    const withShares = wallets.filter(wallet => (wallet.remainingShares ?? 0) > SHARE_EPSILON).length;
    return { total, withShares };
  };

  const swingCounts = getWalletCounts(swingWallets);
  const holdCounts = getWalletCounts(holdWallets);

  return (
    <div>
      <p style={{ fontSize: '1.3em', marginTop: '40px' }}>Wallets</p>

      <div style={{ marginBottom: '1rem', marginTop: '0.5rem', padding: '10px', border: '1px solid #353535', fontSize: '0.7em', color: 'gray' }}>
        {visibleColumns.map((key) => (
          <label key={key} style={{ marginLeft: '15px', whiteSpace: 'nowrap', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={walletColumnVisibility[key]}
              onChange={() => setWalletColumnVisibility(prev => ({ ...prev, [key]: !prev[key] }))}
              style={{ marginRight: '5px', cursor: 'pointer' }}
            />
            {columnLabels[key]}
          </label>
        ))}
      </div>      <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <button
            data-testid="wallet-tab-Swing"
            onClick={() => setActiveTab('Swing')}
            style={{
              padding: '8px 15px',
              marginRight: '10px',
              cursor: 'pointer',
              border: 'none',
              borderBottom: activeTab === 'Swing' ? '2px solid lightblue' : '2px solid transparent',
              background: 'none',
              color: activeTab === 'Swing' ? 'lightblue' : 'inherit',
              fontSize: '1em',
            }}
          >
            Swing ({showEmptyWallets ? swingCounts.total : swingCounts.withShares})
          </button>
          <button
            data-testid="wallet-tab-Hold"
            onClick={() => setActiveTab('Hold')}
            style={{
              padding: '8px 15px',
              cursor: 'pointer',
              border: 'none',
              borderBottom: activeTab === 'Hold' ? '2px solid lightgreen' : '2px solid transparent',
              background: 'none',
              color: activeTab === 'Hold' ? 'lightgreen' : 'inherit',
              fontSize: '1em',
            }}
          >
            Hold ({showEmptyWallets ? holdCounts.total : holdCounts.withShares})
          </button>
        </div>
        <button
          data-testid="wallet-toggle-empty"
          onClick={() => setShowEmptyWallets(!showEmptyWallets)}
          style={{
            padding: '6px 12px',
            cursor: 'pointer',
            border: '1px solid #555',
            borderRadius: '4px',
            background: '#2a2a2a',
            color: 'inherit',
            fontSize: '0.9em',
          }}
        >
          {showEmptyWallets ? 'Hide Empty' : 'Show All'}
        </button>
      </div>

      {error && <p style={{ color: 'red' }}>Error loading wallets: {error}</p>}

      <table data-testid="wallets-table" style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem', fontSize: '0.8em' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>
            {walletColumnVisibility.id && <th style={{ padding: '5px', fontSize: '0.9em', color: 'grey' }}>Wallet ID</th>}
            {walletColumnVisibility.buyPrice && <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestWalletSort('buyPrice')}>Buy Price {walletSortConfig?.key === 'buyPrice' ? (walletSortConfig.direction === 'ascending' ? '▲' : '▼') : ''}</th>}
            {walletColumnVisibility.totalInvestment && <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestWalletSort('totalInvestment')}>Inv {walletSortConfig?.key === 'totalInvestment' ? (walletSortConfig.direction === 'ascending' ? '▲' : '▼') : ''}</th>}
            {walletColumnVisibility.tpValue && (
              <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestWalletSort('tpValue')}>
                TP
                {typeof stockCommission === 'number' && stockCommission > 0 && (
                  <span 
                    title={`TP includes the ${stockCommission}% stock commission`}
                    style={{ color: 'orange', marginLeft: '2px', fontSize: '0.8em' }}
                  >
                    *
                  </span>
                )}
                {' '}
                {walletSortConfig?.key === 'tpValue' ? (walletSortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
              </th>
            )}
            {walletColumnVisibility.htp && <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestWalletSort('htp')}>HTP (%) {walletSortConfig?.key === 'htp' ? (walletSortConfig.direction === 'ascending' ? '▲' : '▼') : ''}</th>}
            {walletColumnVisibility.sellTxnCount && <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestWalletSort('sellTxnCount')}>Sells {walletSortConfig?.key === 'sellTxnCount' ? (walletSortConfig.direction === 'ascending' ? '▲' : '▼') : ''}</th>}
            {walletColumnVisibility.sharesSold && <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestWalletSort('sharesSold')}>Shs Sold {walletSortConfig?.key === 'sharesSold' ? (walletSortConfig.direction === 'ascending' ? '▲' : '▼') : ''}</th>}
            {walletColumnVisibility.realizedPl && <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestWalletSort('realizedPl')}>P/L {walletSortConfig?.key === 'realizedPl' ? (walletSortConfig.direction === 'ascending' ? '▲' : '▼') : ''}</th>}
            {walletColumnVisibility.realizedPlPercent && <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestWalletSort('realizedPlPercent')}>P/L (%) {walletSortConfig?.key === 'realizedPlPercent' ? (walletSortConfig.direction === 'ascending' ? '▲' : '▼') : ''}</th>}
            {walletColumnVisibility.remainingShares && <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestWalletSort('remainingShares')}>Shs Left {walletSortConfig?.key === 'remainingShares' ? (walletSortConfig.direction === 'ascending' ? '▲' : '▼') : ''}</th>}
            <th style={{ padding: '5px', textAlign: 'center' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {(activeTab === 'Swing' ? filteredSwingWallets : filteredHoldWallets).length === 0 ? (
            <tr>
              <td data-testid="wallet-notfound-display" colSpan={visibleColumns.filter(col => walletColumnVisibility[col]).length + 2} style={{ textAlign: 'center', padding: '1rem' }}>
                {showEmptyWallets 
                  ? `No ${activeTab} wallets found for this stock.`
                  : `No ${activeTab} wallets with shares found for this stock.`
                }
              </td>
            </tr>
          ) : (
            (activeTab === 'Swing' ? filteredSwingWallets : filteredHoldWallets).map((wallet, index) => {
              return (
                <tr key={wallet.id} style={{ backgroundColor: index % 2 !== 0 ? '#151515' : 'transparent' }}>
                  {walletColumnVisibility.id && <td data-testid="wallet-id-display" style={{ padding: '5px', fontSize: '0.9em', color: 'grey' }}>{truncateId(wallet.id)}</td>}
                  {walletColumnVisibility.buyPrice && <td data-testid="wallet-buyPrice-display" style={{ padding: '5px' }}>{formatCurrency(wallet.buyPrice ?? 0)}</td>}
                  {walletColumnVisibility.totalInvestment && <td data-testid="wallet-totalInvestment-display" style={{ padding: '5px' }}>{formatCurrency(wallet.totalInvestment ?? 0)}</td>}
                  {walletColumnVisibility.tpValue && <td data-testid="wallet-tpValue-display" style={{ padding: '5px', ...getTpCellStyle(wallet, currentPrice) }}>{formatCurrency(wallet.tpValue ?? 0)}</td>}
                  {walletColumnVisibility.htp && <td data-testid="wallet-htp-display" style={{ padding: '5px', ...getHtpCellStyle(wallet, currentPrice) }}>{getHtpDisplayValueForWallet(wallet, currentPrice)}</td>}
                  {walletColumnVisibility.sellTxnCount && <td data-testid="wallet-sellTxnCount-display" style={{ padding: '5px' }}>{wallet.sellTxnCount ?? 0}</td>}
                  {walletColumnVisibility.sharesSold && <td data-testid="wallet-sharesSold-display" style={{ padding: '5px' }}>{formatShares(wallet.sharesSold ?? 0, SHARE_PRECISION)}</td>}
                  {walletColumnVisibility.realizedPl && <td data-testid="wallet-realizedPl-display" style={{ padding: '5px' }}>{formatCurrency(wallet.realizedPl ?? 0)}</td>}
                  {walletColumnVisibility.realizedPlPercent && <td data-testid="wallet-realizedPlPercent-display" style={{ padding: '5px' }}>{formatPercent(wallet.realizedPlPercent ?? 0)}</td>}
                  {walletColumnVisibility.remainingShares && <td data-testid="wallet-remainingShares-display" style={{ padding: '5px' }}>{formatShares(wallet.remainingShares ?? 0, SHARE_PRECISION)}</td>}
                  <td style={{ padding: '5px', textAlign: 'center' }}>
                    {(wallet.remainingShares ?? 0) > SHARE_EPSILON && (
                      <button 
                        data-testid="wallet-sell-icon" 
                        onClick={() => onSell(wallet)} 
                        title="Sell from wallet" 
                        style={{ 
                          background: 'none', 
                          border: 'none', 
                          cursor: 'pointer', 
                          padding: '5px', 
                          color: isTpHighlighted(wallet, currentPrice) ? 'lightgreen' : 'gray'
                        }}
                      >
                        Sell
                      </button>
                    )}
                    {Math.abs(wallet.remainingShares ?? 0) < SHARE_EPSILON && (
                      <button data-testid="wallet-delete-icon" onClick={() => onDelete(wallet)} title="Delete wallet" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '5px', color: 'gray' }}>
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
