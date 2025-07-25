import React from 'react';
import { formatCurrency, formatShares } from '@/app/utils/financialCalculations';
import { SHARE_PRECISION } from '@/app/config/constants';
import type { PLStats, UnrealizedPLStats, TotalPLStats, TransactionCounts, CurrentShares } from '../types';

export interface WalletsOverviewProps {
  isExpanded: boolean;
  onToggle: () => void;
  stockBudget?: number | null;
  stockPdp?: number | null;
  stockShr?: number | null;
  stockPlr?: number | null;
  stockHtp?: number | null;
  totalTiedUpInvestment: number;
  transactionCounts: TransactionCounts;
  currentShares: CurrentShares;
  plStats: PLStats;
  unrealizedPlStats: UnrealizedPLStats;
  totalPlStats: TotalPLStats;
  pricesLoading: boolean;
}

export default function WalletsOverview({
  isExpanded,
  onToggle,
  stockBudget,
  stockPdp,
  stockShr,
  stockPlr,
  stockHtp,
  totalTiedUpInvestment,
  transactionCounts,
  currentShares,
  plStats,
  unrealizedPlStats,
  totalPlStats,
  pricesLoading,
}: WalletsOverviewProps) {
  return (
    <div style={{ marginBottom: '1rem', border: '1px solid #444' }}>
      <p
        style={{
          marginTop: 0,
          marginBottom: 0,
          padding: '10px 15px',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
        onClick={onToggle}
      >
        Overview
        <span style={{ fontSize: '0.8em' }}>{isExpanded ? '▼' : '▶'}</span>
      </p>

      {isExpanded && (
        <div style={{ padding: '0px 15px 10px 15px', borderTop: '1px solid #444', fontSize: '0.8em' }}>
          {stockBudget === undefined || stockPdp === undefined || stockShr === undefined || stockPlr === undefined || stockHtp === undefined ? (
            <p>Loading details...</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: '0px 15px', marginTop: '10px' }}>

              <div>
                <p style={{ fontWeight: 'bold', fontSize: '1.1em' }}>Settings</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                  <div>
                    <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>Budget</p>
                    <p data-testid="overview-settings-budget">{formatCurrency(stockBudget ?? 0)}</p>
                  </div>
                  <div>
                    <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>Invested</p>
                    <p data-testid="overview-settings-invested">{formatCurrency(totalTiedUpInvestment)}</p>
                  </div>
                </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                    <div>
                      <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>PDP</p>
                      <p data-testid="overview-settings-pdp">{stockPdp != null ? `${stockPdp}%` : 'Not set'}</p>
                      <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>SHR</p>
                      <p data-testid="overview-settings-shr">{stockShr != null ? `${stockShr}% Swing` : 'Not set'}</p>
                    </div>
                    <div>
                      <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>PLR</p>
                      <p data-testid="overview-settings-plr">{stockPlr != null ? stockPlr : 'Not set'}</p>
                      <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>HTP</p>
                      <p data-testid="overview-settings-htp">{stockHtp != null ? `${stockHtp}%` : 'Not set'}</p>
                    </div>
                </div>
              </div>

              <div>
                <p style={{ fontWeight: 'bold', fontSize: '1.1em' }}>Txns & Shs</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                  <div>
                    <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>Buys</p>
                    <p data-testid="overview-txns-buys">{transactionCounts.buys}</p>
                    <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>Swing Sells</p>
                    <p data-testid="overview-txns-swing-sells">{transactionCounts.swingSells}</p>
                    <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>Swing shs</p>
                    <p data-testid="overview-shares-swing">{formatShares(currentShares.swing, SHARE_PRECISION)}</p>
                  </div>
                  <div>
                    <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>Sells</p>
                    <p data-testid="overview-txns-total-sells">{transactionCounts.totalSells}</p>
                    <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>Hold Sells</p>
                    <p data-testid="overview-txns-hold-sells">{transactionCounts.holdSells}</p>
                    <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>Hold shs</p>
                    <p data-testid="overview-shares-hold">{formatShares(currentShares.hold, SHARE_PRECISION)}</p>
                  </div>
                </div>
                <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>Total shs</p>
                <p data-testid="overview-shares-total">{formatShares(currentShares.total, SHARE_PRECISION)}</p>
              </div>

              <div>
                <p style={{ fontWeight: 'bold', fontSize: '1.1em' }}>Realized P/L</p>
                <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>Swing</p>
                <p>
                  <span data-testid="overview-realized-swing-pl-dollars">{formatCurrency(plStats.totalSwingPlDollars ?? 0)}</span>
                  &nbsp;(
                  <span data-testid="overview-realized-swing-pl-percent">{`${plStats.avgSwingPlPercent ?? 0}%`}</span>
                  )
                </p>
                <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>Hold</p>
                <p>
                  <span data-testid="overview-realized-hold-pl-dollars">{formatCurrency(plStats.totalHoldPlDollars ?? 0)}</span>
                  &nbsp;(
                  <span data-testid="overview-realized-hold-pl-percent">{`${plStats.avgHoldPlPercent ?? 0}%`}</span>
                  )
                </p>
                <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>Stock</p>
                <p>
                  <span data-testid="overview-realized-stock-pl-dollars">{formatCurrency(plStats.totalStockPlDollars ?? 0)}</span>
                  &nbsp;(
                  <span data-testid="overview-realized-stock-pl-percent">{`${plStats.avgStockPlPercent ?? 0}%`}</span>
                  )
                </p>
              </div>

              <div>
                <p style={{ fontWeight: 'bold', fontSize: '1.1em' }}>Unrealized P/L</p>
                <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>Swing</p>
                <p>
                  {unrealizedPlStats.unrealizedSwingDollars === null ? (pricesLoading ? 'Loading Price...' : 'N/A') : formatCurrency(unrealizedPlStats.unrealizedSwingDollars ?? 0)}
                  &nbsp;({unrealizedPlStats.unrealizedSwingPercent ?? 0}%)
                </p>
                <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>Hold</p>
                <p>
                  {unrealizedPlStats.unrealizedHoldDollars === null ? (pricesLoading ? 'Loading Price...' : 'N/A') : formatCurrency(unrealizedPlStats.unrealizedHoldDollars ?? 0)}
                  &nbsp;({unrealizedPlStats.unrealizedHoldPercent ?? 0}%)
                </p>
                <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>Stock</p>
                <p>
                  {unrealizedPlStats.unrealizedTotalDollars === null ? (pricesLoading ? 'Loading Price...' : 'N/A') : formatCurrency(unrealizedPlStats.unrealizedTotalDollars ?? 0)}
                  &nbsp;({unrealizedPlStats.unrealizedTotalPercent ?? 0}%)
                </p>
              </div>

              <div>
                <p style={{ fontWeight: 'bold', fontSize: '1.1em' }}>Total P/L</p>
                <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>Swing</p>
                <p>
                  {totalPlStats.totalSwingPlDollars === null ? (pricesLoading ? 'Loading Price...' : 'N/A') : formatCurrency(totalPlStats.totalSwingPlDollars ?? 0)}
                  &nbsp;({totalPlStats.totalSwingPercent ?? 0}%)
                </p>
                <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>Hold</p>
                <p>
                  {totalPlStats.totalHoldPlDollars === null ? (pricesLoading ? 'Loading Price...' : 'N/A') : formatCurrency(totalPlStats.totalHoldPlDollars ?? 0)}
                  &nbsp;({totalPlStats.totalHoldPercent ?? 0}%)
                </p>
                <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>Stock</p>
                <p>
                  {totalPlStats.totalStockPlDollars === null ? (pricesLoading ? 'Loading Price...' : 'N/A') : formatCurrency(totalPlStats.totalStockPlDollars ?? 0)}
                  &nbsp;({totalPlStats.totalStockPercent ?? 0}%)
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
