// app/(authed)/portfolio/components/PortfolioOverview.tsx
'use client';

import React, { useMemo } from 'react';
import type { PortfolioOverviewProps } from '../types';

export default function PortfolioOverview({
  isOverviewExpanded,
  setIsOverviewExpanded,
  usRegionStats,
  euRegionStats,
  intlRegionStats,
  apacRegionStats,
  stockInvestments,
  stockRiskInvestments,
  visibleStocks,
}: PortfolioOverviewProps) {
  // Calculate regional investment totals
  const regionalInvestmentData = useMemo(() => {
    // Group stocks by region and calculate actual investments
    const regionGroups = {
      US: visibleStocks.filter(stock => stock.region === 'US'),
      EU: visibleStocks.filter(stock => stock.region === 'EU'),
      Intl: visibleStocks.filter(stock => stock.region === 'Intl'),
      APAC: visibleStocks.filter(stock => stock.region === 'APAC'),
    };

    const investmentData = Object.entries(regionGroups).map(([region, stocks]) => {
      const investment = stocks.reduce((sum, stock) => sum + (stockInvestments[stock.id] ?? 0), 0);
      const riskInvestment = stocks.reduce((sum, stock) => sum + (stockRiskInvestments[stock.id] ?? 0), 0);
      
      return {
        region,
        investment,
        riskInvestment,
      };
    });

    // Calculate total investment for percentage calculations
    const totalInvestment = investmentData.reduce((sum, item) => sum + item.investment, 0);
    const totalRiskInvestment = investmentData.reduce((sum, item) => sum + item.riskInvestment, 0);

    return investmentData.map(item => ({
      ...item,
      investmentPct: totalInvestment > 0 ? Math.round((item.investment / totalInvestment) * 100) : 0,
      riskInvestmentPct: totalRiskInvestment > 0 ? Math.round((item.riskInvestment / totalRiskInvestment) * 100) : 0,
    }));
  }, [visibleStocks, stockInvestments, stockRiskInvestments]);

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
          {/* Investment by Region Table */}
          <div style={{ marginBottom: '1rem' }}>
            <h4 style={{ marginBottom: '0.5rem', marginTop: '0' }}>Investment by Region</h4>
            <table style={{ 
              width: '100%', 
              borderCollapse: 'collapse',
              fontSize: '0.9em',
            }}>
              <thead>
                <tr style={{ backgroundColor: '#333', color: '#fff' }}>
                  <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #555' }}>Region</th>
                  <th style={{ padding: '8px', textAlign: 'right', border: '1px solid #555' }}>Investment</th>
                  <th style={{ padding: '8px', textAlign: 'right', border: '1px solid #555' }}>%</th>
                  <th style={{ padding: '8px', textAlign: 'right', border: '1px solid #555' }}>r-Investment</th>
                  <th style={{ padding: '8px', textAlign: 'right', border: '1px solid #555' }}>%</th>
                </tr>
              </thead>
              <tbody>
                {regionalInvestmentData.map((row) => (
                  <tr key={row.region} style={{ backgroundColor: '#222', color: '#fff' }}>
                    <td style={{ padding: '8px', border: '1px solid #555' }}>{row.region}</td>
                    <td style={{ padding: '8px', textAlign: 'right', border: '1px solid #555' }}>
                      ${row.investment.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right', border: '1px solid #555' }}>
                      {row.investmentPct}%
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right', border: '1px solid #555' }}>
                      ${row.riskInvestment.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right', border: '1px solid #555' }}>
                      {row.riskInvestmentPct}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
