// app/(authed)/components/PortfolioOverview.tsx
'use client';

import React from 'react';

// Define props for the component with all the data it needs
interface PortfolioOverviewProps {
    isExpanded: boolean;
    toggleExpand: () => void;
    portfolioBudgetStats: {
        totalBudget: number;
        budgetLeft: number;
    };
    portfolioTransactionCounts: {
        buys: number;
        swingSells: number;
        holdSells: number;
        totalSells: number;
    };
    portfolioRealizedPL: {
        totalSwingPlDollars: number;
        avgSwingPlPercent: number | null;
        totalHoldPlDollars: number;
        avgHoldPlPercent: number | null;
        totalStockPlDollars: number;
        avgStockPlPercent: number | null;
    };
    portfolioUnrealizedPL: {
        unrealizedSwingDollars: number;
        unrealizedSwingPercent: number | null;
        unrealizedHoldDollars: number;
        unrealizedHoldPercent: number | null;
        unrealizedTotalDollars: number;
        unrealizedTotalPercent: number | null;
        partialDataUsed: boolean;
    };
    portfolioTotalPL: {
        totalSwingDollars: number;
        totalSwingPercent: number | null;
        totalHoldDollars: number;
        totalHoldPercent: number | null;
        totalStockDollars: number;
        totalStockPercent: number | null;
        partialDataUsed: boolean;
    };
    formatters: {
        formatCurrency: (value: number | null | undefined) => string;
        formatPercent: (value: number | null | undefined) => string;
    };
    precision: {
        CURRENCY_PRECISION: number;
        PERCENT_PRECISION: number;
    };
}

export default function PortfolioOverview({
    isExpanded,
    toggleExpand,
    portfolioBudgetStats,
    portfolioTransactionCounts,
    portfolioRealizedPL,
    portfolioUnrealizedPL,
    portfolioTotalPL,
    formatters,
    precision
}: PortfolioOverviewProps) {
    const { formatCurrency, formatPercent } = formatters;
    const { CURRENCY_PRECISION, PERCENT_PRECISION } = precision;

    // Local wrapper for formatCurrency to handle negative values correctly
    const formatCurrencyWithProperNegative = (value: number | null | undefined) => {
        if (typeof value !== 'number') return formatCurrency(value);
        if (value < 0) {
            // For negative values, return with minus sign before the dollar sign
            return `-${formatCurrency(Math.abs(value))}`;
        }
        return formatCurrency(value);
    };

    return (
        <div style={{
            marginBottom: '1rem',
            border: '1px solid #444',
        }}>
            <p
                style={{
                    marginTop: 0, marginBottom: 0,
                    padding: '10px 15px',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}
                onClick={toggleExpand}
            >                   
                Overview
                <span style={{ fontSize: '0.8em' }}>{isExpanded ? '▼' : '▶'}</span>
            </p>

            {isExpanded && (
                <div style={{
                    padding: '0px 15px 10px 15px',
                    borderTop: '1px solid #444',
                    fontSize: '0.8em'
                }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: '0px 15px', marginTop: '10px' }}>
                        <div>
                            <p style={{ fontWeight: 'bold', fontSize: '1.1em' }}>Budget</p>

                            <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>Annual</p>
                            <p>
                                ${portfolioBudgetStats.totalBudget.toLocaleString(undefined, {
                                    minimumFractionDigits: CURRENCY_PRECISION,
                                    maximumFractionDigits: CURRENCY_PRECISION,
                                })}
                            </p>
                            
                            <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>Available</p>
                            <p>
                                ${portfolioBudgetStats.budgetLeft.toLocaleString(undefined, {
                                    minimumFractionDigits: CURRENCY_PRECISION,
                                    maximumFractionDigits: CURRENCY_PRECISION,
                                })}
                            </p>                             
                        </div>

                        <div>
                            <p style={{ fontWeight: 'bold', fontSize: '1.1em' }}>Transactions</p>
                                
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                                <div>
                                    <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>Buys</p>
                                    <p>
                                        {portfolioTransactionCounts.buys}
                                    </p>

                                    <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>Sw Sells</p>
                                    <p>
                                        {portfolioTransactionCounts.swingSells}
                                    </p>
                                </div>
                                <div>    
                                    <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>Sells</p>
                                    <p>
                                        {portfolioTransactionCounts.totalSells}
                                    </p>
                                    
                                    <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>Hld Sells</p>
                                    <p>
                                        {portfolioTransactionCounts.holdSells}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div>
                            <p style={{ fontWeight: 'bold', fontSize: '1.1em' }}>Realized P/L</p>

                            <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>Swing</p>
                            <p>
                                ${portfolioRealizedPL.totalSwingPlDollars.toFixed(CURRENCY_PRECISION)}
                                &nbsp;
                                ({portfolioRealizedPL.avgSwingPlPercent !== null ? `${portfolioRealizedPL.avgSwingPlPercent.toFixed(PERCENT_PRECISION)}%` : 'N/A'})
                            </p>

                            <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>Hold</p>
                            <p>
                                ${portfolioRealizedPL.totalHoldPlDollars.toFixed(CURRENCY_PRECISION)}
                                &nbsp;
                                ({portfolioRealizedPL.avgHoldPlPercent !== null ? `${portfolioRealizedPL.avgHoldPlPercent.toFixed(PERCENT_PRECISION)}%` : 'N/A'})
                            </p>

                            <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>Stock</p>
                            <p>
                                ${portfolioRealizedPL.totalStockPlDollars.toFixed(CURRENCY_PRECISION)}
                                &nbsp;
                                ({portfolioRealizedPL.avgStockPlPercent !== null ? `${portfolioRealizedPL.avgStockPlPercent.toFixed(PERCENT_PRECISION)}%` : 'N/A'})
                            </p>
                        </div>

                        <div>
                            <p style={{ fontWeight: 'bold', fontSize: '1.1em' }}>
                                Unrealized P/L
                                {portfolioUnrealizedPL.partialDataUsed && (
                                    <span style={{
                                        marginLeft: '3px',
                                        fontSize: '1.1em',
                                        color: 'orange',
                                        fontWeight: 'normal'
                                    }}>
                                        *
                                    </span>
                                )}
                            </p>
                            
                            <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>Swing</p>
                            <p>
                                {formatCurrencyWithProperNegative(portfolioUnrealizedPL.unrealizedSwingDollars)}
                                &nbsp;
                                ({formatPercent(portfolioUnrealizedPL.unrealizedSwingPercent)})
                            </p>

                            <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>Hold</p>
                            <p>
                                {formatCurrencyWithProperNegative(portfolioUnrealizedPL.unrealizedHoldDollars)}
                                &nbsp;
                                ({formatPercent(portfolioUnrealizedPL.unrealizedHoldPercent)})
                            </p>

                            <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>Stock</p>
                            <p>
                                {formatCurrencyWithProperNegative(portfolioUnrealizedPL.unrealizedTotalDollars)}
                                &nbsp;
                                ({formatPercent(portfolioUnrealizedPL.unrealizedTotalPercent)})
                            </p>
                        </div>

                        <div>
                            <p style={{ fontWeight: 'bold', fontSize: '1.1em' }}>
                                Total P/L
                                {portfolioTotalPL.partialDataUsed && (
                                    <span style={{
                                        marginLeft: '3px',
                                        fontSize: '1.1em',
                                        color: 'orange',
                                        fontWeight: 'normal'
                                    }}>
                                        *
                                    </span>
                                )}
                            </p>
                            
                            <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>Swing</p>
                            <p>
                                {formatCurrencyWithProperNegative(portfolioTotalPL.totalSwingDollars)}
                                &nbsp;
                                ({formatPercent(portfolioTotalPL.totalSwingPercent)})
                            </p>

                            <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>Hold</p>
                            <p>
                                {formatCurrencyWithProperNegative(portfolioTotalPL.totalHoldDollars)}
                                &nbsp;
                                ({formatPercent(portfolioTotalPL.totalHoldPercent)})
                            </p>

                            <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>Stock</p>
                            <p>
                                {formatCurrencyWithProperNegative(portfolioTotalPL.totalStockDollars)}
                                &nbsp;
                                ({formatPercent(portfolioTotalPL.totalStockPercent)})
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}