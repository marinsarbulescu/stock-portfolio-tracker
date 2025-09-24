// app/(authed)/signals/components/SignalsTable.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { formatCurrency } from '@/app/utils/financialCalculations';
import type { 
  ReportColumnVisibilityState,
  SignalsTableProps 
} from '../types';

// Helper component for stock trend visual indicator - currently unused
// const StockTrendIndicator: React.FC<{ stockTrend?: string | null }> = ({ stockTrend }) => {
//     if (!stockTrend || stockTrend === 'Sideways') return null;
//
//     const dotStyle: React.CSSProperties = {
//         display: 'inline-block',
//         width: '8px',
//         height: '8px',
//         borderRadius: '50%',
//         marginLeft: '6px',
//         backgroundColor: stockTrend === 'Up' ? '#22c55e' : stockTrend === 'Down' ? '#ef4444' : 'transparent'
//     };
//
//     return <span style={dotStyle} title={`Stock trend: ${stockTrend}`}></span>;
// };

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
    // const { formatPercent } = formatters; // unused
    const { getBreakEvenCellStyle, getSinceBuyCellStyle } = cellStyles;

    if (isLoading) return <p>Loading...</p>;

    return (
        <div>
            {/* Column Visibility Controls */}
            <div style={{ marginBottom: '1rem', marginTop: '1rem', padding: '10px', border: '1px solid #353535', fontSize: '0.7em', color: "gray" }}>
                {(Object.keys(reportColumnVisibility) as Array<keyof ReportColumnVisibilityState>).map((key) => (
                    <label key={key} data-testid={`signals-column-visibility-${key}`} style={{ marginLeft: '15px', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            data-testid={`signals-column-checkbox-${key}`}
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
            <table data-testid="signals-table" style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem', fontSize: '0.8em' }}>
                <thead>
                    <tr style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>
                        {reportColumnVisibility.riskInvestment && (
                            <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestSort('riskInvestment')}>
                                r-Inv {sortConfig?.key === 'riskInvestment' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
                            </th>
                        )}
                        {reportColumnVisibility.budgetAvailable && (
                            <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestSort('budgetAvailable')}>
                                Available {sortConfig?.key === 'budgetAvailable' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
                            </th>
                        )}
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
                            <th data-testid="signals-table-price-header" style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestSort('currentPrice')}>
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
                                %2STP {sortConfig?.key === 'percentToTp' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
                            </th>
                        )}
                        {reportColumnVisibility.percentToHtp && (
                            <th style={{ padding: '5px', cursor: 'pointer' }} onClick={() => requestSort('percentToHtp')}>
                                %2HTP {sortConfig?.key === 'percentToHtp' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
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
                        sortedTableData.map((item, index) => {
                            // Check if budget available is negative for gray styling
                            const shouldGrayOut = typeof item.budgetAvailable === 'number' && 
                                                typeof item.budget === 'number' && 
                                                item.budgetAvailable <= 0;
                            
                            const textColor = shouldGrayOut ? '#9d9d9d' : 'inherit';
                            
                            return (
                            <React.Fragment key={item.id}>
                                <tr 
                                    data-testid={`signals-table-row-${item.symbol.toUpperCase()}`}
                                    style={{ 
                                    backgroundColor: index % 2 !== 0 ? '#151515' : 'transparent',
                                    color: textColor
                                }}>
                                    {reportColumnVisibility.riskInvestment && (
                                        <td
                                            data-testid={`signals-table-riskInvestment-${item.symbol.toUpperCase()}`}
                                            style={{ padding: '5px' }}>
                                            {typeof item.riskInvestment === 'number' ? item.riskInvestment.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : '-'}
                                        </td>
                                    )}
                                    {reportColumnVisibility.budgetAvailable && (
                                        <td
                                            data-testid={`signals-table-budgetAvailable-${item.symbol.toUpperCase()}`}
                                            style={{ padding: '5px' }}>
                                            {typeof item.budgetAvailable === 'number' ? item.budgetAvailable.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : '-'}
                                        </td>
                                    )}
                                    <td style={{ padding: '5px' }}>
                                        <Link
                                            href={`/wallets/${item.id}`}
                                            data-testid={`signals-table-ticker-${item.symbol.toUpperCase()}`}
                                            style={{
                                                textDecoration: 'none',
                                                color: item.totalCurrentShares === 0 ? 'red' : (shouldGrayOut ? '#9d9d9d' : 'inherit')
                                            }}
                                        >
                                            {item.symbol}
                                        </Link>                                        
                                    </td>                                
                                {reportColumnVisibility.fiveDayDip && (
                                    <td 
                                        style={{ padding: '5px' }}
                                        data-testid={`signals-table-5dd-${item.symbol.toUpperCase()}`}
                                    >
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
                                    <td 
                                        style={{
                                            padding: '5px',
                                            ...getSinceBuyCellStyle(item.sinceBuy, item.swingWalletCount)
                                        }}
                                        data-testid={`signals-table-last-buy-${item.symbol.toUpperCase()}`}
                                    >
                                        {item.sinceBuy != null ? `${item.sinceBuy} d` : '-'}
                                    </td>
                                )}
                                {reportColumnVisibility.sinceSell && (
                                    <td style={{ padding: '5px' }}>{item.sinceSell != null ? `${item.sinceSell} d` : '-'}</td>
                                )}
                                {reportColumnVisibility.currentPrice && (
                                    <td 
                                        data-testid={`signals-table-price-${item.symbol.toUpperCase()}`}
                                        style={{ 
                                        padding: '5px', 
                                        textAlign: 'left', 
                                        color: item.isTestPrice ? '#9f4f96' : (shouldGrayOut ? '#9d9d9d' : 'inherit')
                                    }}>
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
                                    <td 
                                        data-testid={`signals-table-percent-stp-${item.symbol.toUpperCase()}`}
                                        style={{ padding: '5px', ...getBreakEvenCellStyle(item.percentToTp) }}>
                                        {typeof item.percentToTp === 'number'
                                            ? `${item.percentToTp.toFixed(2)}%`
                                            : '-'}
                                    </td>
                                )}
                                {reportColumnVisibility.percentToHtp && (
                                    <td 
                                        data-testid={`signals-table-percent-htp-${item.symbol.toUpperCase()}`}
                                        style={{ padding: '5px', ...getBreakEvenCellStyle(item.percentToHtp) }}>
                                        {typeof item.percentToHtp === 'number'
                                            ? `${item.percentToHtp.toFixed(2)}%`
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
                            </React.Fragment>
                            );
                        })
                    )}
                </tbody>
            </table>
        </div>
    );
}
