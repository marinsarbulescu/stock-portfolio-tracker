// app/(authed)/stocks-listing/components/PortfolioTable.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { FaEdit, FaEye, FaEyeSlash } from 'react-icons/fa';
import { formatCurrency } from '@/app/utils/financialCalculations';
import type { Schema } from '@/amplify/data/resource';

type PortfolioStockDataType = Schema["PortfolioStock"]["type"];

// Define sortable keys for the Stock Portfolio Table
type SortableStockKey = 
  | 'symbol'
  | 'name'
  | 'stockType'
  | 'region'
  | 'currentPrice'
  | 'pdp'
  | 'plr'
  | 'budget'
  | 'investment';

interface StockSortConfig {
  key: SortableStockKey;
  direction: 'ascending' | 'descending';
}

type PriceData = {
  currentPrice: number | null;
  [key: string]: any;
};

type LatestPrices = Record<string, PriceData | null>;

export interface PortfolioTableProps {
  isLoading: boolean;
  error: string | null;
  sortedStocks: PortfolioStockDataType[];
  stockSortConfig: StockSortConfig | null;
  stockInvestments: Record<string, number>;
  latestPrices: LatestPrices;
  pricesLoading: boolean;
  requestStockSort: (key: SortableStockKey) => void;
  handleEditClick: (stock: PortfolioStockDataType) => void;
  handleToggleHidden: (stock: PortfolioStockDataType) => void;
}

// Column labels for the stock table
const STOCK_COLUMN_LABELS: Record<SortableStockKey, string> = {
  symbol: 'Ticker',
  name: 'Name',
  stockType: 'Type',
  region: 'Region',
  currentPrice: 'Last Price',
  pdp: 'PDP (%)',
  plr: 'PLR (%)',
  budget: 'Budget',
  investment: 'Inv.',
};

export default function PortfolioTable({
  isLoading,
  error,
  sortedStocks,
  stockSortConfig,
  stockInvestments,
  latestPrices,
  pricesLoading,
  requestStockSort,
  handleEditClick,
  handleToggleHidden,
}: PortfolioTableProps) {
  if (isLoading) {
    return <p>Loading stocks...</p>;
  }

  if (error) {
    return <p style={{ color: 'red' }}>Error: {error}</p>;
  }

  return (
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
          <th 
            data-testid="portfolio-page-table-name-header"
            style={{ padding: '5px', cursor: 'pointer' }} 
            onClick={() => requestStockSort('name')}
          >
            {STOCK_COLUMN_LABELS.name} {stockSortConfig?.key === 'name' ? (stockSortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
          </th>
          <th
            data-testid="portfolio-page-table-stockType-header"
            style={{ padding: '5px', cursor: 'pointer' }} 
            onClick={() => requestStockSort('stockType')}
          >
            {STOCK_COLUMN_LABELS.stockType} {stockSortConfig?.key === 'stockType' ? (stockSortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
          </th>
          <th
            data-testid="portfolio-page-table-region-header"
            style={{ padding: '5px', cursor: 'pointer' }}
            onClick={() => requestStockSort('region')}
          >
            {STOCK_COLUMN_LABELS.region} {stockSortConfig?.key === 'region' ? (stockSortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
          </th>
          <th
            data-testid="portfolio-page-table-currentPrice-header"
            style={{ padding: '5px', cursor: 'pointer' }}
            onClick={() => requestStockSort('currentPrice')}
          >
            {STOCK_COLUMN_LABELS.currentPrice} {stockSortConfig?.key === 'currentPrice' ? (stockSortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
          </th>
          <th
            data-testid="portfolio-page-table-pdp-header"
            style={{ padding: '5px', cursor: 'pointer' }}
            onClick={() => requestStockSort('pdp')}
          >
            {STOCK_COLUMN_LABELS.pdp} {stockSortConfig?.key === 'pdp' ? (stockSortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
          </th>
          <th
            data-testid="portfolio-page-table-plr-header"
            style={{ padding: '5px', cursor: 'pointer' }}
            onClick={() => requestStockSort('plr')}
          >
            {STOCK_COLUMN_LABELS.plr} {stockSortConfig?.key === 'plr' ? (stockSortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
          </th>
          <th
            data-testid="portfolio-page-table-budget-header"
            style={{ padding: '5px', cursor: 'pointer' }}
            onClick={() => requestStockSort('budget')}
          >
            {STOCK_COLUMN_LABELS.budget} {stockSortConfig?.key === 'budget' ? (stockSortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
          </th>
          <th
            data-testid="portfolio-page-table-investment-header"
            style={{ padding: '5px', cursor: 'pointer' }}
            onClick={() => requestStockSort('investment')}
          >
            {STOCK_COLUMN_LABELS.investment} {stockSortConfig?.key === 'investment' ? (stockSortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
          </th>
          <th style={{ padding: '5px', textAlign: 'center' }}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {sortedStocks.length === 0 ? (
          <tr>
            <td
              data-testid="portfolio-page-table-empty-message"
              colSpan={10}
              style={{ textAlign: 'center', padding: '1rem' }}
            >
              Your portfolio is empty.
            </td>
          </tr>
        ) : (
          sortedStocks.map((stock, index) => (
            <tr key={stock.id} style={{ backgroundColor: index % 2 !== 0 ? '#151515' : 'transparent' }}>
              <td style={{ padding: '5px' }}>
                <Link 
                  href={`/wallets/${stock.id}`} 
                  data-testid={`portfolio-page-table-wallet-link-${stock.symbol?.toUpperCase()}`}
                >
                  {stock.symbol?.toUpperCase()}
                </Link>
              </td>
              <td
                data-testid={`portfolio-page-table-name-${stock.symbol?.toUpperCase()}`}
                style={{ padding: '5px' }}>
                {stock.name ? 
                  (stock.name.length > 15 ? 
                    `${stock.name.substring(0, 15)}...` : 
                    stock.name) 
                  : '-'}
              </td>
              <td
                data-testid={`portfolio-page-table-type-${stock.symbol?.toUpperCase()}`}
                style={{ padding: '5px' }}>{stock.stockType}</td>
              <td
                data-testid={`portfolio-page-table-region-${stock.symbol?.toUpperCase()}`}
                style={{ padding: '5px' }}>{stock.region}</td>
              <td
                data-testid={`portfolio-page-table-price-${stock.symbol?.toUpperCase()}`}
                style={{ padding: '5px' }}>
                {pricesLoading ? '...' : (latestPrices[stock.symbol]?.currentPrice !== null && typeof latestPrices[stock.symbol]?.currentPrice === 'number' ? formatCurrency(latestPrices[stock.symbol]!.currentPrice!) : 'N/A')}
              </td>
              <td
                data-testid={`portfolio-page-table-pdp-${stock.symbol?.toUpperCase()}`}
                style={{ padding: '5px' }}>{stock.pdp ?? '-'}</td>
              <td
                data-testid={`portfolio-page-table-plr-${stock.symbol?.toUpperCase()}`}
                style={{ padding: '5px' }}>{stock.plr ?? '-'}</td>
              <td
                data-testid={`portfolio-page-table-budget-${stock.symbol?.toUpperCase()}`}
                style={{ padding: '5px' }}>{typeof stock.budget === 'number' ? formatCurrency(stock.budget??0) : '-'}</td>
              <td
                data-testid={`portfolio-page-table-investment-${stock.symbol?.toUpperCase()}`}
                style={{ padding: '5px' }}>{typeof stockInvestments[stock.id] === 'number' ? stockInvestments[stock.id].toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : '-'}</td>
              {/* Actions */}
              <td style={{ padding: '5px', textAlign: 'center' }}>
                <button 
                  data-testid="portfolio-page-table-action-edit-button"
                  onClick={() => handleEditClick(stock)} 
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '5px', color: 'gray', marginRight: '5px' }}
                  title="Edit Stock">
                    <FaEdit />
                </button>
                <button
                  data-testid="portfolio-page-table-action-hide-button"
                  onClick={() => handleToggleHidden(stock)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '5px', color: 'gray' }}
                  title={stock.isHidden ? "Show in Reports" : "Hide from Reports"}>
                    {stock.isHidden ? <FaEyeSlash /> : <FaEye />}
                </button>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
