// app/(authed)/portfolio/components/PortfolioOverview.tsx
'use client';

import React, { useMemo } from 'react';
import type { PortfolioOverviewProps } from '../types';
import { calculateGroupedInvestmentData, formatGroupName, type GroupedInvestmentData } from '@/app/utils/portfolioGroupedCalculations';
import { getMarketCategoryLabel } from '../types';

export default function PortfolioOverview({
  isOverviewExpanded,
  setIsOverviewExpanded,
  stockInvestments,
  stockOOPInvestments,
  visibleStocks,
  wallets,
  latestPrices,
}: PortfolioOverviewProps) {
  // Calculate grouped investment data for all three tables
  const regionInvestmentData = useMemo(() => {
    return calculateGroupedInvestmentData({
      groupBy: 'region',
      stocks: visibleStocks,
      stockOOPInvestments,
      stockInvestments,
      wallets,
      latestPrices,
    });
  }, [visibleStocks, stockOOPInvestments, stockInvestments, wallets, latestPrices]);

  const marketSectorInvestmentData = useMemo(() => {
    return calculateGroupedInvestmentData({
      groupBy: 'marketCategory',
      stocks: visibleStocks,
      stockOOPInvestments,
      stockInvestments,
      wallets,
      latestPrices,
    });
  }, [visibleStocks, stockOOPInvestments, stockInvestments, wallets, latestPrices]);

  const riskProfileInvestmentData = useMemo(() => {
    return calculateGroupedInvestmentData({
      groupBy: 'riskGrowthProfile',
      stocks: visibleStocks,
      stockOOPInvestments,
      stockInvestments,
      wallets,
      latestPrices,
    });
  }, [visibleStocks, stockOOPInvestments, stockInvestments, wallets, latestPrices]);

  // Shared table styles
  const tableStyles = {
    table: {
      width: '100%',
      borderCollapse: 'collapse' as const,
      fontSize: '0.9em',
    },
    headerRow: {
      backgroundColor: '#333',
      color: '#fff',
    },
    headerCell: {
      padding: '8px',
      textAlign: 'left' as const,
      border: '1px solid #555',
    },
    headerCellRight: {
      padding: '8px',
      textAlign: 'right' as const,
      border: '1px solid #555',
    },
    bodyRow: {
      backgroundColor: '#222',
      color: '#fff',
    },
    bodyCell: {
      padding: '8px',
      border: '1px solid #555',
    },
    bodyCellRight: {
      padding: '8px',
      textAlign: 'right' as const,
      border: '1px solid #555',
    },
  };

  const renderInvestmentTable = (
    title: string,
    data: GroupedInvestmentData[],
    groupColumnName: string,
    groupBy: 'region' | 'marketCategory' | 'riskGrowthProfile'
  ) => (
    <div style={{ marginBottom: '1rem' }}>
      <h4 style={{ marginBottom: '0.5rem', marginTop: '0' }}>{title}</h4>
      <table style={tableStyles.table}>
        <thead>
          <tr style={tableStyles.headerRow}>
            <th style={tableStyles.headerCell}>{groupColumnName}</th>
            <th style={tableStyles.headerCellRight}>Max Risk</th>
            <th style={tableStyles.headerCellRight}>Max Risk %</th>
            <th style={tableStyles.headerCellRight}>OOP</th>
            <th style={tableStyles.headerCellRight}>Tied-up</th>
            <th style={tableStyles.headerCellRight}>Market Value +inv</th>
            <th style={tableStyles.headerCellRight}>ROIC</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.groupName} style={tableStyles.bodyRow}>
              <td style={tableStyles.bodyCell}>
                {groupBy === 'marketCategory'
                  ? getMarketCategoryLabel(row.groupName)
                  : formatGroupName(row.groupName, groupBy)}
              </td>
              <td
                style={tableStyles.bodyCellRight}
                data-testid={`portfolio-overview-${groupBy}-${row.groupName.replace(/[_\s]/g, '')}-maxrisk`}
              >
                ${row.maxRisk.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td
                style={tableStyles.bodyCellRight}
                data-testid={`portfolio-overview-${groupBy}-${row.groupName.replace(/[_\s]/g, '')}-maxriskpct`}
              >
                {row.maxRiskPercentage.toFixed(2)}%
              </td>
              <td style={tableStyles.bodyCellRight}>
                ${row.oop.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td style={tableStyles.bodyCellRight}>
                ${row.tiedUp.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td style={tableStyles.bodyCellRight}>
                ${row.marketValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td style={tableStyles.bodyCellRight}>
                {row.roic.toFixed(2)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div
      data-testid="portfolio-page-overview-section"
      style={{
        marginBottom: '1rem',
        border: '1px solid #444',
      }}
    >
      <p
        data-testid="portfolio-page-overview-header"
        style={{
          marginTop: 0,
          marginBottom: 0,
          padding: '10px 15px',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
        onClick={() => setIsOverviewExpanded(!isOverviewExpanded)}
      >
        <span data-testid="portfolio-page-overview-title">Overview</span>
        <span data-testid="portfolio-page-overview-toggle" style={{ fontSize: '0.8em' }}>
          {isOverviewExpanded ? '▼' : '▶'}
        </span>
      </p>

      {isOverviewExpanded && (
        <div
          data-testid="portfolio-page-overview-expanded"
          style={{ padding: '15px', borderTop: '1px solid #444', fontSize: '0.8em' }}
        >
          {/* Region Investment Table */}
          {renderInvestmentTable('Region', regionInvestmentData, 'Region', 'region')}
          
          {/* Market Sector Investment Table */}
          {renderInvestmentTable('Market Sector', marketSectorInvestmentData, 'Market Sector', 'marketCategory')}
          
          {/* Risk Profile Investment Table */}
          {renderInvestmentTable('Risk Profile', riskProfileInvestmentData, 'Risk Profile', 'riskGrowthProfile')}
        </div>
      )}
    </div>
  );
}