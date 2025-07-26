// app/(authed)/signals/components/SignalsTable.tsx
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { formatCurrency } from '@/app/utils/financialCalculations';
import type { 
  ReportColumnVisibilityState, 
  ReportDataItem, 
  ReportColumnKey, 
  SignalsTableProps 
} from '../types';

// Helper component for stock trend visual indicator
const StockTrendIndicator: React.FC<{ stockTrend?: string | null }> = ({ stockTrend }) => {
    if (!stockTrend || stockTrend === 'Sideways') return null;
    
    const dotStyle: React.CSSProperties = {
        display: 'inline-block',
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        marginLeft: '6px',
        backgroundColor: stockTrend === 'Up' ? '#22c55e' : stockTrend === 'Down' ? '#ef4444' : 'transparent'
    };
    
    return <span style={dotStyle} title={`Stock trend: ${stockTrend}`}></span>;
};

export default function SignalsTable({
    isLoading,
    reportColumnVisibility,
    setReportColumnVisibility,
    columnLabels,
    sortedTableData,
    visibleColumnCount,
    requestSort,
    sortConfig,
    formatters,
    cellStyles
}: SignalsTableProps) {
    const { formatPercent } = formatters;
    const { getBreakEvenCellStyle, getSinceBuyCellStyle } = cellStyles;

    // State to track which rows are expanded
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

    // Function to toggle row expansion
    const toggleRowExpansion = (stockId: string) => {
        setExpandedRows(prev => {
            const newSet = new Set(prev);
            if (newSet.has(stockId)) {
                newSet.delete(stockId);
            } else {
                newSet.add(stockId);
            }
            return newSet;
        });
    };

    if (isLoading) return <p>Loading...</p>;

    return (
        <div>
            {/* Column Visibility Controls */}
            <div style={{ marginBottom: '1rem', marginTop: '1rem', padding: '10px', border: '1px solid #353535', fontSize: '0.7em', color: "gray" }}>
                {(Object.keys(reportColumnVisibility) as Array<keyof ReportColumnVisibilityState>).map((key) => (
                    <label key={key} style={{ marginLeft: '15px', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={reportColumnVisibility[key]}
                            onChange={() =>
                                setReportColumnVisibility((prev) => ({
                                    ...prev,
                                    [key]: !prev[key],
                                }))
                            }
                            style={{ marginRight: '5px', cursor: 'pointer' }}
                        />
                        {columnLabels[key]}
                    </label>
                ))}
            </div>

            {/* Stock Table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem', fontSize: '0.8em' }}>
                <thead>
                    <tr style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>
                        <th style={{ padding: '5px', width: '30px' }}>
                            {/* Empty header for expand/collapse column */}
                        </th>
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
                            <td colSpan={visibleColumnCount + 1} style={{ textAlign: 'center', padding: '1rem' }}>
                                No stocks in portfolio.
                            </td>
                        </tr>
                    ) : (
                        sortedTableData.map((item, index) => (
                            <React.Fragment key={item.id}>
                                <tr style={{ backgroundColor: index % 2 !== 0 ? '#151515' : 'transparent' }}>
                                    <td style={{ padding: '5px', textAlign: 'center' }}>
                                        <button
                                            data-testid="signals-table-toggle-row-expansion-button"
                                            onClick={() => toggleRowExpansion(item.id)}
                                            style={{
                                                background: item.hasHtpSignal ? 'green' : 'none',
                                                border: 'none',
                                                cursor: 'pointer',
                                                color: item.hasHtpSignal ? 'white' : '#ccc',
                                                fontSize: '0.8em',
                                                padding: '2px'
                                            }}
                                            title={
                                                item.hasHtpSignal 
                                                    ? `${expandedRows.has(item.id) ? 'Collapse' : 'Expand'} details (HTP Signal Active)`
                                                    : `${expandedRows.has(item.id) ? 'Collapse' : 'Expand'} details`
                                            }
                                        >
                                            {expandedRows.has(item.id) ? '▼' : '▶'}
                                        </button>
                                    </td>
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
                                    <td style={{ padding: '5px', textAlign: 'left', color: item.isTestPrice ? '#9f4f96' : 'inherit' }}>
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
                                {/* Expanded row content */}
                                {expandedRows.has(item.id) && (
                                    <tr style={{ backgroundColor: index % 2 !== 0 ? '#151515' : 'transparent' }}>
                                        <td colSpan={visibleColumnCount + 1} style={{ padding: '10px', borderTop: '1px solid #333' }}>
                                            <div style={{ fontSize: '0.9em', color: '#ccc' }}>
                                                {/* Stock Trend Indicator */}
                                                {item.stockTrend && item.stockTrend !== 'Sideways' && (
                                                    <p style={{ margin: '5px 0' }}>
                                                        <strong>Trend:</strong>{' '}
                                                        <span style={{ 
                                                            display: 'inline-flex', 
                                                            alignItems: 'center', 
                                                            gap: '6px' 
                                                        }}>
                                                            {item.stockTrend}
                                                            <StockTrendIndicator stockTrend={item.stockTrend} />
                                                        </span>
                                                    </p>
                                                )}
                                                {/* Show HTP values if HTP signal is active */}
                                                {item.hasHtpSignal && item.htpValues.length > 0 && (
                                                    <p>
                                                        <strong style={{ color: 'lightgreen' }}>HTP:</strong>{' '}
                                                        <span style={{ color: 'lightgreen' }}>
                                                            {item.htpValues.join(', ')}
                                                        </span>
                                                    </p>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}
