// app/(authed)/signals/components/SignalsOverview.tsx
'use client';

import React from 'react';
import { SIGNALS_OVERVIEW_TOOLTIPS } from '@/app/config/tooltips';
import Tooltip from '@/app/components/Tooltip';
import type { SignalsOverviewProps } from '../types';

export default function SignalsOverview({
    isExpanded,
    toggleExpand,
    portfolioBudgetStats,
    portfolioTransactionCounts,
    portfolioPerformanceMetrics,
    portfolioRealizedPL,
    portfolioUnrealizedPL,
    portfolioTotalPL,
    formatters,
    precision
}: SignalsOverviewProps) {
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
                    {/* First row with existing data */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr', gap: '0px 15px', marginTop: '10px' }}>
                        <div>
                            <p style={{ fontWeight: 'bold', fontSize: '1.1em' }}>Budget</p>

                            <Tooltip content={SIGNALS_OVERVIEW_TOOLTIPS.RISK_BUDGET}>
                                <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em', cursor: 'help' }}>Max Risk</p>
                            </Tooltip>
                            <p>
                                ${portfolioBudgetStats.totalBudget.toLocaleString(undefined, {
                                    minimumFractionDigits: CURRENCY_PRECISION,
                                    maximumFractionDigits: CURRENCY_PRECISION,
                                })}
                            </p>

                            <Tooltip content={SIGNALS_OVERVIEW_TOOLTIPS.BUDGET_USED}>
                                <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em', cursor: 'help' }}>Used</p>
                            </Tooltip>
                            <p>
                                ${portfolioBudgetStats.totalBudgetUsed.toLocaleString(undefined, {
                                    minimumFractionDigits: CURRENCY_PRECISION,
                                    maximumFractionDigits: CURRENCY_PRECISION,
                                })}
                            </p>

                            <Tooltip content={SIGNALS_OVERVIEW_TOOLTIPS.BUDGET_AVAILABLE}>
                                <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em', cursor: 'help' }}>Available</p>
                            </Tooltip>
                            <p>
                                ${portfolioBudgetStats.totalBudgetAvailable.toLocaleString(undefined, {
                                    minimumFractionDigits: CURRENCY_PRECISION,
                                    maximumFractionDigits: CURRENCY_PRECISION,
                                })}
                            </p>

                            <Tooltip content={SIGNALS_OVERVIEW_TOOLTIPS.TIED_UP}>
                                <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em', cursor: 'help' }}>Tied-Up</p>
                            </Tooltip>
                            <p>
                                ${portfolioBudgetStats.totalInvested.toLocaleString(undefined, {
                                    minimumFractionDigits: CURRENCY_PRECISION,
                                    maximumFractionDigits: CURRENCY_PRECISION,
                                })}
                            </p>

                            <Tooltip content={SIGNALS_OVERVIEW_TOOLTIPS.R_INV}>
                                <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em', cursor: 'help' }}>r-Inv</p>
                            </Tooltip>
                            <p>
                                ${portfolioBudgetStats.totalRiskInvestment.toLocaleString(undefined, {
                                    minimumFractionDigits: CURRENCY_PRECISION,
                                    maximumFractionDigits: CURRENCY_PRECISION,
                                })}
                            </p>                            
                        </div>

                        <div>
                            <p style={{ fontWeight: 'bold', fontSize: '1.1em' }}>$ Performance</p>
                            <Tooltip content={SIGNALS_OVERVIEW_TOOLTIPS.TOTAL_OOP}>
                                <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em', cursor: 'help' }}>Total OOP</p>
                            </Tooltip>
                            <p data-testid="portfolio-performance-total-oop">
                                {formatCurrency(portfolioPerformanceMetrics.totalOOP)}
                            </p>
                            <Tooltip content={SIGNALS_OVERVIEW_TOOLTIPS.CASH_BALANCE}>
                                <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em', cursor: 'help' }}>$ Balance</p>
                            </Tooltip>
                            <p data-testid="portfolio-performance-cash-balance">
                                {formatCurrency(portfolioPerformanceMetrics.totalCashBalance)}
                            </p>
                            <Tooltip content={SIGNALS_OVERVIEW_TOOLTIPS.MARKET_VALUE}>
                                <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em', cursor: 'help' }}>Market Value</p>
                            </Tooltip>
                            <p data-testid="portfolio-performance-market-value">
                                {formatCurrency(portfolioPerformanceMetrics.totalMarketValue)}
                            </p>
                            <Tooltip content={SIGNALS_OVERVIEW_TOOLTIPS.ROIC}>
                                <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em', cursor: 'help' }}>ROIC</p>
                            </Tooltip>
                            <p>
                                <span data-testid="portfolio-performance-roic">
                                    {portfolioPerformanceMetrics.portfolioROIC !== null 
                                        ? `${portfolioPerformanceMetrics.portfolioROIC.toFixed(PERCENT_PRECISION)}%`
                                        : 'N/A'
                                    }
                                </span>
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
                                {formatCurrencyWithProperNegative(portfolioRealizedPL.totalSwingPlDollars??0)}
                                &nbsp;
                                ({portfolioRealizedPL.avgSwingPlPercent !== null ? `${portfolioRealizedPL.avgSwingPlPercent.toFixed(PERCENT_PRECISION)}%` : 'N/A'})
                            </p>

                            <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>Hold</p>
                            <p>
                                {formatCurrencyWithProperNegative(portfolioRealizedPL.totalHoldPlDollars??0)}
                                &nbsp;
                                ({portfolioRealizedPL.avgHoldPlPercent !== null ? `${portfolioRealizedPL.avgHoldPlPercent.toFixed(PERCENT_PRECISION)}%` : 'N/A'})
                            </p>

                            <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>Div&SLP</p>
                            <p>
                                {formatCurrencyWithProperNegative(portfolioRealizedPL.totalIncomeFromDivAndSlp??0)}
                            </p>

                            <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>Stock</p>
                            <p>
                                {formatCurrencyWithProperNegative(portfolioRealizedPL.totalStockPlDollars??0)}
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
                                {formatCurrencyWithProperNegative(portfolioUnrealizedPL.unrealizedSwingDollars??0)}
                                &nbsp;
                                ({formatPercent(portfolioUnrealizedPL.unrealizedSwingPercent)})
                            </p>

                            <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>Hold</p>
                            <p>
                                {formatCurrencyWithProperNegative(portfolioUnrealizedPL.unrealizedHoldDollars??0)}
                                &nbsp;
                                ({formatPercent(portfolioUnrealizedPL.unrealizedHoldPercent)})
                            </p>

                            <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>Stock</p>
                            <p>
                                {formatCurrencyWithProperNegative(portfolioUnrealizedPL.unrealizedTotalDollars??0)}
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
                                {formatCurrencyWithProperNegative(portfolioTotalPL.totalSwingDollars??0)}
                                &nbsp;
                                ({formatPercent(portfolioTotalPL.totalSwingPercent)})
                            </p>

                            <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>Hold</p>
                            <p>
                                {formatCurrencyWithProperNegative(portfolioTotalPL.totalHoldDollars??0)}
                                &nbsp;
                                ({formatPercent(portfolioTotalPL.totalHoldPercent)})
                            </p>

                            <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>Div&SLP</p>
                            <p>
                                {formatCurrencyWithProperNegative(portfolioTotalPL.totalIncomeFromDivAndSlp??0)}
                            </p>

                            <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>Stock</p>
                            <p>
                                {formatCurrencyWithProperNegative(portfolioTotalPL.totalStockDollars??0)}
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
