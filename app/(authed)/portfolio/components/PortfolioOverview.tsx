// app/(authed)/portfolio/components/PortfolioOverview.tsx
'use client';

import React from 'react';

// Import types from the portfolio types file
import type {
  RegionDistribution,
  StockTypeDistribution,
  RegionStats,
  PortfolioOverviewProps,
} from '../types';

export default function PortfolioOverview({
  isOverviewExpanded,
  setIsOverviewExpanded,
  regionDistribution,
  stockTypeDistribution,
  percentages,
  stockTypePercentages,
  usRegionStats,
  euRegionStats,
  intlRegionStats,
  apacRegionStats,
}: PortfolioOverviewProps) {
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
            {/* Region Distribution */}
            <div style={{ borderRight: '1px solid #444', marginRight: '5px', paddingRight: '5px' }}>
              <p style={{ fontWeight: 'bold', fontSize: '1.1em', marginBottom: '5px' }}>Holdings By Region</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px' }}>
                <div>
                  <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>US</p>
                  <p>{percentages.US}% ({regionDistribution.US})</p>
                </div>
                <div>
                  <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>EU</p>
                  <p>{percentages.EU}% ({regionDistribution.EU})</p>
                </div>
                <div>
                  <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>Intl</p>
                  <p>{percentages.Intl}% ({regionDistribution.Intl})</p>
                </div>
                <div>
                  <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>APAC</p>
                  <p>{percentages.APAC}% ({regionDistribution.APAC})</p>
                </div>
              </div>
            </div>

            {/* Stock Type Distribution */}
            <div>
              <p style={{ fontWeight: 'bold', fontSize: '1.1em', marginBottom: '5px' }}>Holdings By Type</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <div>
                  <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>Stock</p>
                  <p>{stockTypePercentages.Stock}% ({stockTypeDistribution.Stock})</p>
                </div>
                <div>
                  <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>ETF</p>
                  <p>{stockTypePercentages.ETF}% ({stockTypeDistribution.ETF})</p>
                </div>
                <div>
                  <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>Crypto</p>
                  <p>{stockTypePercentages.Crypto}% ({stockTypeDistribution.Crypto})</p>
                </div>
              </div>
            </div>
          </div>

          {/* Investment Tables */}
          <div style={{ marginTop: '20px', marginBottom: '20px' }}>
            <p style={{ fontWeight: 'bold', fontSize: '1.1em', marginBottom: '10px' }}>Tied-up Investment by Region</p>
            
            {/* US Region Table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #444', marginBottom: '20px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #444', background: '#1e1e1e' }}>
                  <th style={{ padding: '8px', textAlign: 'center', width: '25%' }}>US</th>
                  <th style={{ padding: '8px', textAlign: 'center', width: '25%', borderLeft: '1px solid #444', fontSize: '0.9em' }}>Stock</th>
                  <th style={{ padding: '8px', textAlign: 'center', width: '25%', borderLeft: '1px solid #444', fontSize: '0.9em' }}>ETF</th>
                  <th style={{ padding: '8px', textAlign: 'center', width: '25%', borderLeft: '1px solid #444', fontSize: '0.9em' }}>All Holdings</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #444' }}>
                  <td style={{ padding: '8px', fontSize: '0.9em' }}># Holdings</td>
                  <td style={{ padding: '8px', textAlign: 'center', borderLeft: '1px solid #444' }}>
                    {usRegionStats.counts.stock} ({Math.round((usRegionStats.counts.stock / usRegionStats.counts.total) * 100) || 0}%)
                  </td>
                  <td style={{ padding: '8px', textAlign: 'center', borderLeft: '1px solid #444' }}>
                    {usRegionStats.counts.etf} ({Math.round((usRegionStats.counts.etf / usRegionStats.counts.total) * 100) || 0}%)
                  </td>
                  <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold', borderLeft: '1px solid #444' }}>
                    {usRegionStats.counts.total} (100%)
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid #444' }}>
                  <td style={{ padding: '8px', fontSize: '0.9em' }}>Swing Inv</td>
                  <td style={{ padding: '8px', textAlign: 'center', borderLeft: '1px solid #444' }}>
                    ${Math.round(usRegionStats.swingInvestment.stock.value).toLocaleString()} ({usRegionStats.swingInvestment.stock.pct}%)
                  </td>
                  <td style={{ padding: '8px', textAlign: 'center', borderLeft: '1px solid #444' }}>
                    ${Math.round(usRegionStats.swingInvestment.etf.value).toLocaleString()} ({usRegionStats.swingInvestment.etf.pct}%)
                  </td>
                  <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold', borderLeft: '1px solid #444' }}>
                    ${Math.round(usRegionStats.swingInvestment.total.value).toLocaleString()} (100%)
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid #444' }}>
                  <td style={{ padding: '8px', fontSize: '0.9em' }}>Hold Inv</td>
                  <td style={{ padding: '8px', textAlign: 'center', borderLeft: '1px solid #444' }}>
                    ${Math.round(usRegionStats.holdInvestment.stock.value).toLocaleString()} ({usRegionStats.holdInvestment.stock.pct}%)
                  </td>
                  <td style={{ padding: '8px', textAlign: 'center', borderLeft: '1px solid #444' }}>
                    ${Math.round(usRegionStats.holdInvestment.etf.value).toLocaleString()} ({usRegionStats.holdInvestment.etf.pct}%)
                  </td>
                  <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold', borderLeft: '1px solid #444' }}>
                    ${Math.round(usRegionStats.holdInvestment.total.value).toLocaleString()} (100%)
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '8px', fontSize: '0.9em' }}>Total Inv</td>
                  <td style={{ padding: '8px', textAlign: 'center', borderLeft: '1px solid #444' }}>
                    ${Math.round(usRegionStats.totalInvestment.stock.value).toLocaleString()} ({usRegionStats.totalInvestment.stock.pct}%)
                  </td>
                  <td style={{ padding: '8px', textAlign: 'center', borderLeft: '1px solid #444' }}>
                    ${Math.round(usRegionStats.totalInvestment.etf.value).toLocaleString()} ({usRegionStats.totalInvestment.etf.pct}%)
                  </td>
                  <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold', borderLeft: '1px solid #444' }}>
                    ${Math.round(usRegionStats.totalInvestment.total.value).toLocaleString()} (100%)
                  </td>
                </tr>
              </tbody>
            </table>

            {/* EU Region Table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #444', marginBottom: '20px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #444', background: '#1e1e1e' }}>
                  <th style={{ padding: '8px', textAlign: 'center', width: '25%' }}>EU</th>
                  <th style={{ padding: '8px', textAlign: 'center', width: '25%', borderLeft: '1px solid #444', fontSize: '0.9em' }}>Stock</th>
                  <th style={{ padding: '8px', textAlign: 'center', width: '25%', borderLeft: '1px solid #444', fontSize: '0.9em' }}>ETF</th>
                  <th style={{ padding: '8px', textAlign: 'center', width: '25%', borderLeft: '1px solid #444', fontSize: '0.9em' }}>All Holdings</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #444' }}>
                  <td style={{ padding: '8px', fontSize: '0.9em' }}># Holdings</td>
                  <td style={{ padding: '8px', textAlign: 'center', borderLeft: '1px solid #444' }}>
                    {euRegionStats.counts.stock} ({Math.round((euRegionStats.counts.stock / euRegionStats.counts.total) * 100) || 0}%)
                  </td>
                  <td style={{ padding: '8px', textAlign: 'center', borderLeft: '1px solid #444' }}>
                    {euRegionStats.counts.etf} ({Math.round((euRegionStats.counts.etf / euRegionStats.counts.total) * 100) || 0}%)
                  </td>
                  <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold', borderLeft: '1px solid #444' }}>
                    {euRegionStats.counts.total} (100%)
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid #444' }}>
                  <td style={{ padding: '8px', fontSize: '0.9em' }}>Swing Inv</td>
                  <td style={{ padding: '8px', textAlign: 'center', borderLeft: '1px solid #444' }}>
                    ${Math.round(euRegionStats.swingInvestment.stock.value).toLocaleString()} ({euRegionStats.swingInvestment.stock.pct}%)
                  </td>
                  <td style={{ padding: '8px', textAlign: 'center', borderLeft: '1px solid #444' }}>
                    ${Math.round(euRegionStats.swingInvestment.etf.value).toLocaleString()} ({euRegionStats.swingInvestment.etf.pct}%)
                  </td>
                  <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold', borderLeft: '1px solid #444' }}>
                    ${Math.round(euRegionStats.swingInvestment.total.value).toLocaleString()} (100%)
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid #444' }}>
                  <td style={{ padding: '8px', fontSize: '0.9em' }}>Hold Inv</td>
                  <td style={{ padding: '8px', textAlign: 'center', borderLeft: '1px solid #444' }}>
                    ${Math.round(euRegionStats.holdInvestment.stock.value).toLocaleString()} ({euRegionStats.holdInvestment.stock.pct}%)
                  </td>
                  <td style={{ padding: '8px', textAlign: 'center', borderLeft: '1px solid #444' }}>
                    ${Math.round(euRegionStats.holdInvestment.etf.value).toLocaleString()} ({euRegionStats.holdInvestment.etf.pct}%)
                  </td>
                  <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold', borderLeft: '1px solid #444' }}>
                    ${Math.round(euRegionStats.holdInvestment.total.value).toLocaleString()} (100%)
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '8px', fontSize: '0.9em' }}>Total Inv</td>
                  <td style={{ padding: '8px', textAlign: 'center', borderLeft: '1px solid #444' }}>
                    ${Math.round(euRegionStats.totalInvestment.stock.value).toLocaleString()} ({euRegionStats.totalInvestment.stock.pct}%)
                  </td>
                  <td style={{ padding: '8px', textAlign: 'center', borderLeft: '1px solid #444' }}>
                    ${Math.round(euRegionStats.totalInvestment.etf.value).toLocaleString()} ({euRegionStats.totalInvestment.etf.pct}%)
                  </td>
                  <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold', borderLeft: '1px solid #444' }}>
                    ${Math.round(euRegionStats.totalInvestment.total.value).toLocaleString()} (100%)
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Intl Region Table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #444', marginBottom: '20px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #444', background: '#1e1e1e' }}>
                  <th style={{ padding: '8px', textAlign: 'center', width: '20%' }}>Intl</th>
                  <th style={{ padding: '8px', textAlign: 'center', width: '20%', borderLeft: '1px solid #444', fontSize: '0.9em' }}>Stock</th>
                  <th style={{ padding: '8px', textAlign: 'center', width: '20%', borderLeft: '1px solid #444', fontSize: '0.9em' }}>ETF</th>
                  <th style={{ padding: '8px', textAlign: 'center', width: '20%', borderLeft: '1px solid #444', fontSize: '0.9em' }}>Crypto</th>
                  <th style={{ padding: '8px', textAlign: 'center', width: '20%', borderLeft: '1px solid #444', fontSize: '0.9em' }}>All Holdings</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #444' }}>
                  <td style={{ padding: '8px', fontSize: '0.9em' }}># Holdings</td>
                  <td style={{ padding: '8px', textAlign: 'center', borderLeft: '1px solid #444' }}>
                    {intlRegionStats.counts.stock} ({Math.round((intlRegionStats.counts.stock / intlRegionStats.counts.total) * 100) || 0}%)
                  </td>
                  <td style={{ padding: '8px', textAlign: 'center', borderLeft: '1px solid #444' }}>
                    {intlRegionStats.counts.etf} ({Math.round((intlRegionStats.counts.etf / intlRegionStats.counts.total) * 100) || 0}%)
                  </td>
                  <td style={{ padding: '8px', textAlign: 'center', borderLeft: '1px solid #444' }}>
                    {intlRegionStats.counts.crypto} ({Math.round((intlRegionStats.counts.crypto! / intlRegionStats.counts.total) * 100) || 0}%)
                  </td>
                  <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold', borderLeft: '1px solid #444' }}>
                    {intlRegionStats.counts.total} (100%)
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid #444' }}>
                  <td style={{ padding: '8px', fontSize: '0.9em' }}>Swing Inv</td>
                  <td style={{ padding: '8px', textAlign: 'center', borderLeft: '1px solid #444' }}>
                    ${Math.round(intlRegionStats.swingInvestment.stock.value).toLocaleString()} ({intlRegionStats.swingInvestment.stock.pct}%)
                  </td>
                  <td style={{ padding: '8px', textAlign: 'center', borderLeft: '1px solid #444' }}>
                    ${Math.round(intlRegionStats.swingInvestment.etf.value).toLocaleString()} ({intlRegionStats.swingInvestment.etf.pct}%)
                  </td>
                  <td style={{ padding: '8px', textAlign: 'center', borderLeft: '1px solid #444' }}>
                    ${Math.round(intlRegionStats.swingInvestment.crypto!.value).toLocaleString()} ({intlRegionStats.swingInvestment.crypto!.pct}%)
                  </td>
                  <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold', borderLeft: '1px solid #444' }}>
                    ${Math.round(intlRegionStats.swingInvestment.total.value).toLocaleString()} (100%)
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid #444' }}>
                  <td style={{ padding: '8px', fontSize: '0.9em' }}>Hold Inv</td>
                  <td style={{ padding: '8px', textAlign: 'center', borderLeft: '1px solid #444' }}>
                    ${Math.round(intlRegionStats.holdInvestment.stock.value).toLocaleString()} ({intlRegionStats.holdInvestment.stock.pct}%)
                  </td>
                  <td style={{ padding: '8px', textAlign: 'center', borderLeft: '1px solid #444' }}>
                    ${Math.round(intlRegionStats.holdInvestment.etf.value).toLocaleString()} ({intlRegionStats.holdInvestment.etf.pct}%)
                  </td>
                  <td style={{ padding: '8px', textAlign: 'center', borderLeft: '1px solid #444' }}>
                    ${Math.round(intlRegionStats.holdInvestment.crypto!.value).toLocaleString()} ({intlRegionStats.holdInvestment.crypto!.pct}%)
                  </td>
                  <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold', borderLeft: '1px solid #444' }}>
                    ${Math.round(intlRegionStats.holdInvestment.total.value).toLocaleString()} (100%)
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '8px', fontSize: '0.9em' }}>Total Inv</td>
                  <td style={{ padding: '8px', textAlign: 'center', borderLeft: '1px solid #444' }}>
                    ${Math.round(intlRegionStats.totalInvestment.stock.value).toLocaleString()} ({intlRegionStats.totalInvestment.stock.pct}%)
                  </td>
                  <td style={{ padding: '8px', textAlign: 'center', borderLeft: '1px solid #444' }}>
                    ${Math.round(intlRegionStats.totalInvestment.etf.value).toLocaleString()} ({intlRegionStats.totalInvestment.etf.pct}%)
                  </td>
                  <td style={{ padding: '8px', textAlign: 'center', borderLeft: '1px solid #444' }}>
                    ${Math.round(intlRegionStats.totalInvestment.crypto!.value).toLocaleString()} ({intlRegionStats.totalInvestment.crypto!.pct}%)
                  </td>
                  <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold', borderLeft: '1px solid #444' }}>
                    ${Math.round(intlRegionStats.totalInvestment.total.value).toLocaleString()} (100%)
                  </td>
                </tr>
              </tbody>
            </table>

            {/* APAC Region Table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #444' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #444', background: '#1e1e1e' }}>
                  <th style={{ padding: '8px', textAlign: 'center', width: '25%' }}>APAC</th>
                  <th style={{ padding: '8px', textAlign: 'center', width: '25%', borderLeft: '1px solid #444', fontSize: '0.9em' }}>Stock</th>
                  <th style={{ padding: '8px', textAlign: 'center', width: '25%', borderLeft: '1px solid #444', fontSize: '0.9em' }}>ETF</th>
                  <th style={{ padding: '8px', textAlign: 'center', width: '25%', borderLeft: '1px solid #444', fontSize: '0.9em' }}>All Holdings</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #444' }}>
                  <td style={{ padding: '8px', fontSize: '0.9em' }}># Holdings</td>
                  <td style={{ padding: '8px', textAlign: 'center', borderLeft: '1px solid #444' }}>
                    {apacRegionStats.counts.stock} ({Math.round((apacRegionStats.counts.stock / apacRegionStats.counts.total) * 100) || 0}%)
                  </td>
                  <td style={{ padding: '8px', textAlign: 'center', borderLeft: '1px solid #444' }}>
                    {apacRegionStats.counts.etf} ({Math.round((apacRegionStats.counts.etf / apacRegionStats.counts.total) * 100) || 0}%)
                  </td>
                  <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold', borderLeft: '1px solid #444' }}>
                    {apacRegionStats.counts.total} (100%)
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid #444' }}>
                  <td style={{ padding: '8px', fontSize: '0.9em' }}>Swing Inv</td>
                  <td style={{ padding: '8px', textAlign: 'center', borderLeft: '1px solid #444' }}>
                    ${Math.round(apacRegionStats.swingInvestment.stock.value).toLocaleString()} ({apacRegionStats.swingInvestment.stock.pct}%)
                  </td>
                  <td style={{ padding: '8px', textAlign: 'center', borderLeft: '1px solid #444' }}>
                    ${Math.round(apacRegionStats.swingInvestment.etf.value).toLocaleString()} ({apacRegionStats.swingInvestment.etf.pct}%)
                  </td>
                  <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold', borderLeft: '1px solid #444' }}>
                    ${Math.round(apacRegionStats.swingInvestment.total.value).toLocaleString()} (100%)
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid #444' }}>
                  <td style={{ padding: '8px', fontSize: '0.9em' }}>Hold Inv</td>
                  <td style={{ padding: '8px', textAlign: 'center', borderLeft: '1px solid #444' }}>
                    ${Math.round(apacRegionStats.holdInvestment.stock.value).toLocaleString()} ({apacRegionStats.holdInvestment.stock.pct}%)
                  </td>
                  <td style={{ padding: '8px', textAlign: 'center', borderLeft: '1px solid #444' }}>
                    ${Math.round(apacRegionStats.holdInvestment.etf.value).toLocaleString()} ({apacRegionStats.holdInvestment.etf.pct}%)
                  </td>
                  <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold', borderLeft: '1px solid #444' }}>
                    ${Math.round(apacRegionStats.holdInvestment.total.value).toLocaleString()} (100%)
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '8px', fontSize: '0.9em' }}>Total Inv</td>
                  <td style={{ padding: '8px', textAlign: 'center', borderLeft: '1px solid #444' }}>
                    ${Math.round(apacRegionStats.totalInvestment.stock.value).toLocaleString()} ({apacRegionStats.totalInvestment.stock.pct}%)
                  </td>
                  <td style={{ padding: '8px', textAlign: 'center', borderLeft: '1px solid #444' }}>
                    ${Math.round(apacRegionStats.totalInvestment.etf.value).toLocaleString()} ({apacRegionStats.totalInvestment.etf.pct}%)
                  </td>
                  <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold', borderLeft: '1px solid #444' }}>
                    ${Math.round(apacRegionStats.totalInvestment.total.value).toLocaleString()} (100%)
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>      )}
    </div>
  );
}
