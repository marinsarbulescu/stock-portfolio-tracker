// app/(authed)/components/StockTable.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { ReportColumnVisibilityState } from './ColumnVisibilityControls';
import { formatCurrency, formatPercent, formatShares } from '@/app/utils/financialCalculations';

export interface ReportDataItem {
    id: string;
    symbol: string;
    currentPrice: number | null;
    fiveDayDip: number | null;
    lbd: number | null;
    sinceBuy: number | null;
    sinceSell: number | null;
    swingWalletCount: number;
    buys: number;
    percentToBe: number | null;
    ltpiaTakeProfitPrice: number | null;
    percentToTp: number | null;
    tpShares: number | null;
    totalCurrentShares: number;
    incompleteBuyCount: number;
}

export type ReportColumnKey = 
    'symbol' | 
    'currentPrice' | 
    'fiveDayDip' | 
    'lbd' | 
    'sinceBuy' |
    'sinceSell' | 
    'swingWalletCount' |
    'incompleteBuyCount' | 
    'percentToBe' | 
    'percentToTp' | 
    'ltpiaTakeProfitPrice' | 
    'tpShares';

interface StockTableProps {
    isLoading: boolean;
    reportColumnVisibility: ReportColumnVisibilityState;
    sortedTableData: ReportDataItem[];
    visibleColumnCount: number;
    requestSort: (key: ReportColumnKey) => void;
    sortConfig: { key: ReportColumnKey; direction: 'ascending' | 'descending' } | null;
    formatters: {
        formatPercent: (value: number | null | undefined) => string;
    };
    cellStyles: {
        getBreakEvenCellStyle: (percent: number | null) => React.CSSProperties;
        getSinceBuyCellStyle: (days: number | null, swingWalletCount: number) => React.CSSProperties;
    };
}

export default function StockTable({
    isLoading,
    reportColumnVisibility,
    sortedTableData,
    visibleColumnCount,
    requestSort,
    sortConfig,
    formatters,
    cellStyles
}: StockTableProps) {
    const { formatPercent } = formatters;
    const { getBreakEvenCellStyle, getSinceBuyCellStyle } = cellStyles;

    if (isLoading) return <p>Loading...</p>;

    return (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem', fontSize: '0.8em' }}>
            <thead>
                <tr style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>
                    <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestSort('symbol')}>
                        Ticker {sortConfig?.key === 'symbol' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
                    </th>
                    {reportColumnVisibility.fiveDayDip && (
                        <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestSort('fiveDayDip')}>
                            5DD (%) {sortConfig?.key === 'fiveDayDip' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
                        </th>
                    )}
                    {reportColumnVisibility.lbd && (
                        <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestSort('lbd')}>
                            LBD (%) {sortConfig?.key === 'lbd' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
                        </th>
                    )}
                    {reportColumnVisibility.swingWalletCount && (
                        <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestSort('swingWalletCount')}>
                            Sw Wlts {sortConfig?.key === 'swingWalletCount' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
                        </th>
                    )}
                    {reportColumnVisibility.sinceBuy && (
                        <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestSort('sinceBuy')}>
                            L Buy {sortConfig?.key === 'sinceBuy' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
                        </th>
                    )}
                    {reportColumnVisibility.sinceSell && (
                        <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestSort('sinceSell')}>
                            L Sell {sortConfig?.key === 'sinceSell' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
                        </th>
                    )}
                    {reportColumnVisibility.currentPrice && (
                        <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestSort('currentPrice')}>
                            Price {sortConfig?.key === 'currentPrice' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
                        </th>
                    )}
                    {reportColumnVisibility.percentToBe && (
                        <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestSort('percentToBe')}>
                            %2BE {sortConfig?.key === 'percentToBe' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
                        </th>
                    )}
                    {reportColumnVisibility.ltpiaTakeProfitPrice && (
                        <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestSort('ltpiaTakeProfitPrice')}>
                            TP {sortConfig?.key === 'ltpiaTakeProfitPrice' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
                        </th>
                    )}
                    {reportColumnVisibility.percentToTp && (
                        <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestSort('percentToTp')}>
                            %2TP {sortConfig?.key === 'percentToTp' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
                        </th>
                    )}
                    
                    {reportColumnVisibility.tpShares && (
                        <th onClick={() => requestSort('tpShares')}>TP-Shs</th>
                    )}
                </tr>
            </thead>
            <tbody>
                {sortedTableData.length === 0 ? (
                    <tr>
                        <td colSpan={visibleColumnCount} style={{ textAlign: 'center', padding: '1rem' }}>
                            No stocks in portfolio.
                        </td>
                    </tr>
                ) : (
                    sortedTableData.map((item, index) => (
                        <tr key={item.id} style={{ backgroundColor: index % 2 !== 0 ? '#151515' : 'transparent' }}>
                            <td style={{ padding: '5px' }}>
                                <Link
                                    href={`/wallets/${item.id}`}
                                    style={{
                                        textDecoration: 'none',
                                        color: item.totalCurrentShares === 0 ? 'red' : 'inherit'
                                    }}
                                >
                                    {item.symbol}
                                </Link>
                            </td>                                
                            {reportColumnVisibility.fiveDayDip && (
                                <td style={{ padding: '5px' }}>
                                    {typeof item.fiveDayDip === 'number' && Math.abs(item.fiveDayDip) > 0.0001 ? `${item.fiveDayDip.toFixed(2)}%` : '-'}
                                </td>
                            )}
                            {reportColumnVisibility.lbd && (
                                <td style={{ padding: '5px' }}>
                                    {typeof item.lbd === 'number' ? `${item.lbd.toFixed(2)}%` : '-'}
                                </td>
                            )}
                            {reportColumnVisibility.swingWalletCount && (
                                <td style={{
                                    padding: '5px',
                                    ...getSinceBuyCellStyle(item.sinceBuy, item.swingWalletCount)
                                    }}>{item.swingWalletCount}
                                </td>
                            )}
                            {reportColumnVisibility.sinceBuy && (
                                <td style={{
                                    padding: '5px',
                                    ...getSinceBuyCellStyle(item.sinceBuy, item.swingWalletCount)
                                    }}>
                                    {item.sinceBuy != null ? `${item.sinceBuy} d` : '-'}
                                </td>
                            )}
                            {reportColumnVisibility.sinceSell && (
                                <td style={{ padding: '5px' }}>{item.sinceSell != null ? `${item.sinceSell} d` : '-'}</td>
                            )}
                            {reportColumnVisibility.currentPrice && (
                                <td style={{ padding: '5px' }}>
                                    {typeof item.currentPrice === 'number' ? formatCurrency(item.currentPrice??0) : '-'}
                                </td>
                            )}
                            {reportColumnVisibility.percentToBe && (
                                <td style={{ padding: '5px', ...getBreakEvenCellStyle(item.percentToBe) }}>
                                    {typeof item.percentToBe === 'number'
                                        ? `${item.percentToBe.toFixed(2)}%`
                                        : '-'}
                                </td>
                            )}
                            {reportColumnVisibility.ltpiaTakeProfitPrice && (
                                <td style={{ padding: '5px' }}>
                                    {typeof item.ltpiaTakeProfitPrice === 'number' ? formatCurrency(item.ltpiaTakeProfitPrice??0) : '-'}
                                </td>
                            )}
                            {reportColumnVisibility.percentToTp && (
                                <td style={{ padding: '5px', ...getBreakEvenCellStyle(item.percentToTp) }}>
                                    {typeof item.percentToTp === 'number'
                                        ? `${item.percentToTp.toFixed(2)}%`
                                        : '-'}
                                </td>
                            )}
                            {reportColumnVisibility.tpShares && (
                                <td style={{ padding: '5px' }}>
                                    {typeof item.tpShares === 'number'
                                        ? item.tpShares.toFixed(5)
                                        : '-'}
                                </td>
                            )}
                        </tr>
                    ))
                )}
            </tbody>
        </table>
    );
}