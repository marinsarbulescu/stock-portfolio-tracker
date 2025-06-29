// app/(authed)/portfolio/components/PortfolioTable.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { FaEdit, FaEye, FaEyeSlash, FaArchive, FaTrashRestore } from 'react-icons/fa';
import { formatCurrency } from '@/app/utils/financialCalculations';

// Import types from the portfolio types file
import type {
  PortfolioStockDataType,
  SortableStockKey,
  StockSortConfig,
  LatestPrices,
  PortfolioTableProps,
  PortfolioColumnVisibilityState,
  PortfolioColumnKey,
} from '../types';

import { STOCK_COLUMN_LABELS, PORTFOLIO_COLUMN_LABELS } from '../types';

export default function PortfolioTable({
  isLoading,
  error,
  sortedStocks,
  stockSortConfig,
  stockInvestments,
  latestPrices,
  pricesLoading,
  showArchived,
  archivedCount,
  columnVisibility,
  setColumnVisibility,
  visibleColumnCount,
  requestStockSort,
  handleEditClick,
  handleToggleHidden,
  handleArchiveStock,
}: PortfolioTableProps) {
  if (isLoading) {
    return <p>Loading stocks...</p>;
  }

  if (error) {
    return <p style={{ color: 'red' }}>Error: {error}</p>;
  }

  return (
    <div>
      {/* Column Visibility Controls */}
      <div style={{ marginBottom: '1rem', marginTop: '1rem', padding: '10px', border: '1px solid #353535', fontSize: '0.7em', color: "gray" }}>
        {(Object.keys(columnVisibility) as Array<keyof PortfolioColumnVisibilityState>).map((key) => (
          <label key={key} style={{ marginLeft: '15px', whiteSpace: 'nowrap', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={columnVisibility[key]}
              onChange={() =>
                setColumnVisibility((prev) => ({
                  ...prev,
                  [key]: !prev[key],
                }))
              }
              style={{ marginRight: '5px', cursor: 'pointer' }}
            />
            {PORTFOLIO_COLUMN_LABELS[key]}
          </label>
        ))}
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem', fontSize: '0.8em' }}>
      <thead>
        <tr style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>
          <th 
            data-testid="portfolio-page-table-symbol-header"
            style={{ padding: '5px', cursor: 'pointer' }} 
            onClick={() => requestStockSort('symbol')}
          >
            {STOCK_COLUMN_LABELS.symbol} {stockSortConfig?.key === 'symbol' ? (stockSortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
          </th>
          {columnVisibility.name && (
            <th 
              data-testid="portfolio-page-table-name-header"
              style={{ padding: '5px', cursor: 'pointer' }} 
              onClick={() => requestStockSort('name')}
            >
              {STOCK_COLUMN_LABELS.name} {stockSortConfig?.key === 'name' ? (stockSortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
            </th>
          )}
          {columnVisibility.stockType && (
            <th
              data-testid="portfolio-page-table-stockType-header"
              style={{ padding: '5px', cursor: 'pointer' }} 
              onClick={() => requestStockSort('stockType')}
            >
              {STOCK_COLUMN_LABELS.stockType} {stockSortConfig?.key === 'stockType' ? (stockSortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
            </th>
          )}
          {columnVisibility.region && (
            <th
              data-testid="portfolio-page-table-region-header"
              style={{ padding: '5px', cursor: 'pointer' }}
              onClick={() => requestStockSort('region')}
            >
              {STOCK_COLUMN_LABELS.region} {stockSortConfig?.key === 'region' ? (stockSortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
            </th>
          )}
          {columnVisibility.currentPrice && (
            <th
              data-testid="portfolio-page-table-currentPrice-header"
              style={{ padding: '5px', cursor: 'pointer' }}
              onClick={() => requestStockSort('currentPrice')}
            >
              {STOCK_COLUMN_LABELS.currentPrice} {stockSortConfig?.key === 'currentPrice' ? (stockSortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
            </th>
          )}
          {columnVisibility.pdp && (
            <th
              data-testid="portfolio-page-table-pdp-header"
              style={{ padding: '5px', cursor: 'pointer' }}
              onClick={() => requestStockSort('pdp')}
            >
              {STOCK_COLUMN_LABELS.pdp} {stockSortConfig?.key === 'pdp' ? (stockSortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
            </th>
          )}
          {columnVisibility.htp && (
            <th
              data-testid="portfolio-page-table-htp-header"
              style={{ padding: '5px', cursor: 'pointer' }}
              onClick={() => requestStockSort('htp')}
            >
              {STOCK_COLUMN_LABELS.htp} {stockSortConfig?.key === 'htp' ? (stockSortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
            </th>
          )}
          {columnVisibility.plr && (
            <th
              data-testid="portfolio-page-table-plr-header"
              style={{ padding: '5px', cursor: 'pointer' }}
              onClick={() => requestStockSort('plr')}
            >
              {STOCK_COLUMN_LABELS.plr} {stockSortConfig?.key === 'plr' ? (stockSortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
            </th>
          )}
          {columnVisibility.stockCommission && (
            <th
              data-testid="portfolio-page-table-stockCommission-header"
              style={{ padding: '5px', cursor: 'pointer' }}
              onClick={() => requestStockSort('stockCommission')}
            >
              {STOCK_COLUMN_LABELS.stockCommission} {stockSortConfig?.key === 'stockCommission' ? (stockSortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
            </th>
          )}
          {columnVisibility.budget && (
            <th
              data-testid="portfolio-page-table-budget-header"
              style={{ padding: '5px', cursor: 'pointer' }}
              onClick={() => requestStockSort('budget')}
            >
              {STOCK_COLUMN_LABELS.budget} {stockSortConfig?.key === 'budget' ? (stockSortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
            </th>
          )}
          {columnVisibility.investment && (
            <th
              data-testid="portfolio-page-table-investment-header"
              style={{ padding: '5px', cursor: 'pointer' }}
              onClick={() => requestStockSort('investment')}
            >
              {STOCK_COLUMN_LABELS.investment} {stockSortConfig?.key === 'investment' ? (stockSortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
            </th>
          )}
          <th style={{ padding: '5px', textAlign: 'center' }}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {sortedStocks.length === 0 ? (
          <tr>
            <td
              data-testid="portfolio-page-table-empty-message"
              colSpan={visibleColumnCount}
              style={{ textAlign: 'center', padding: '1rem' }}
            >
              Your portfolio is empty.
            </td>
          </tr>
        ) : (
          sortedStocks.map((stock, index) => {
            const isHidden = stock.isHidden;
            const rowStyle = {
              backgroundColor: index % 2 !== 0 ? '#151515' : 'transparent',
              color: isHidden ? '#595959' : 'inherit'
            };
            const cellStyle = { 
              padding: '5px',
              color: isHidden ? '#595959' : 'inherit'
            };
            
            return (
            <tr key={stock.id} style={rowStyle}>
              <td style={cellStyle}>
                <Link 
                  href={`/wallets/${stock.id}`} 
                  data-testid={`portfolio-page-table-wallet-link-${stock.symbol?.toUpperCase()}`}                  
                >
                  {stock.symbol?.toUpperCase()}
                </Link>
              </td>
              {columnVisibility.name && (
                <td
                  data-testid={`portfolio-page-table-name-${stock.symbol?.toUpperCase()}`}
                  style={cellStyle}>
                  {stock.name ? 
                    (stock.name.length > 15 ? 
                      `${stock.name.substring(0, 15)}...` : 
                      stock.name) 
                    : '-'}
                </td>
              )}
              {columnVisibility.stockType && (
                <td
                  data-testid={`portfolio-page-table-type-${stock.symbol?.toUpperCase()}`}
                  style={cellStyle}>{stock.stockType}</td>
              )}
              {columnVisibility.region && (
                <td
                  data-testid={`portfolio-page-table-region-${stock.symbol?.toUpperCase()}`}
                  style={cellStyle}>{stock.region}</td>
              )}
              {columnVisibility.currentPrice && (
                <td
                  data-testid={`portfolio-page-table-price-${stock.symbol?.toUpperCase()}`}
                  style={cellStyle}>
                  {pricesLoading ? '...' : (latestPrices[stock.symbol]?.currentPrice !== null && typeof latestPrices[stock.symbol]?.currentPrice === 'number' ? formatCurrency(latestPrices[stock.symbol]!.currentPrice!) : 'N/A')}
                </td>
              )}
              {columnVisibility.pdp && (
                <td
                  data-testid={`portfolio-page-table-pdp-${stock.symbol?.toUpperCase()}`}
                  style={cellStyle}>{stock.pdp ?? '-'}</td>
              )}
              {columnVisibility.htp && (
                <td
                  data-testid={`portfolio-page-table-htp-${stock.symbol?.toUpperCase()}`}
                  style={cellStyle}>{stock.htp ?? '-'}</td>
              )}
              {columnVisibility.plr && (
                <td
                  data-testid={`portfolio-page-table-plr-${stock.symbol?.toUpperCase()}`}
                  style={cellStyle}>{stock.plr ?? '-'}</td>
              )}
              {columnVisibility.stockCommission && (
                <td
                  data-testid={`portfolio-page-table-stockCommission-${stock.symbol?.toUpperCase()}`}
                  style={cellStyle}>{stock.stockCommission ?? '-'}</td>
              )}
              {columnVisibility.budget && (
                <td
                  data-testid={`portfolio-page-table-budget-${stock.symbol?.toUpperCase()}`}
                  style={cellStyle}>{typeof stock.budget === 'number' ? formatCurrency(stock.budget??0) : '-'}</td>
              )}
              {columnVisibility.investment && (
                <td
                  data-testid={`portfolio-page-table-investment-${stock.symbol?.toUpperCase()}`}
                  style={cellStyle}>{typeof stockInvestments[stock.id] === 'number' ? stockInvestments[stock.id].toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : '-'}</td>
              )}
              {/* Actions */}
              <td style={{ padding: '5px', textAlign: 'center' }}>
                <button 
                  data-testid="portfolio-page-table-action-edit-button"
                  onClick={() => handleEditClick(stock)} 
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '5px', color: 'gray', marginRight: '5px' }}
                  title="Edit Stock">
                    <FaEdit />
                </button>
                
                {!showArchived && (
                  <button
                    data-testid="portfolio-page-table-action-hide-button"
                    onClick={() => handleToggleHidden(stock)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '5px', color: 'gray', marginRight: '5px' }}
                    title={stock.isHidden ? "Show in Reports" : "Hide from Reports"}>
                      {stock.isHidden ? <FaEyeSlash /> : <FaEye />}
                  </button>
                )}
                
                <button
                  data-testid="portfolio-page-table-action-archive-button"
                  onClick={() => handleArchiveStock(stock)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '5px', color: 'gray' }}
                  title={showArchived ? "Restore Stock" : "Archive Stock"}>
                    {showArchived ? <FaTrashRestore /> : <FaArchive />}
                </button>
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
