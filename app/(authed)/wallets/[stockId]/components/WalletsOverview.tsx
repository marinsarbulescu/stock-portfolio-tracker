import React from 'react';
import { formatCurrency, formatShares } from '@/app/utils/financialCalculations';
import { SHARE_PRECISION } from '@/app/config/constants';
import { WALLETS_OVERVIEW_TOOLTIPS } from '@/app/config/tooltips';
import type { RealizedPLStats, UnrealizedPLStats, CombinedPLStats, TransactionCounts, CurrentShares } from '../types';

export interface WalletsOverviewProps {
  isExpanded: boolean;
  onToggle: () => void;
  stockBudget?: number | null;
  stockPdp?: number | null;
  stockShr?: number | null;
  stockStp?: number | null;
  stockHtp?: number | null;
  totalTiedUpInvestment: number;
  riskInvestment: number;
  transactionCounts: TransactionCounts;
  currentShares: CurrentShares;
  realizedPlStats: RealizedPLStats;
  unrealizedPlStats: UnrealizedPLStats;
  combinedPlStats: CombinedPLStats;
  pricesLoading: boolean;
  roicValue?: number | null;
  totalOOP: number;
  currentCashBalance: number;
  marketValue: number;
  budgetUsed: number;
  budgetAvailable: number;
}

export default function WalletsOverview({
  isExpanded,
  onToggle,
  stockBudget,
  stockPdp,
  stockShr,
  stockStp,
  stockHtp,
  totalTiedUpInvestment,
  riskInvestment,
  transactionCounts,
  currentShares,
  realizedPlStats,
  unrealizedPlStats,
  combinedPlStats,
  pricesLoading,
  roicValue,
  totalOOP,
  currentCashBalance,
  marketValue,
  budgetUsed,
  budgetAvailable,
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
          {stockBudget === undefined || stockPdp === undefined || stockShr === undefined || stockStp === undefined || stockHtp === undefined ? (
            <p>Loading details...</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr', gap: '0px 15px', marginTop: '10px' }}>

              <div>
                <p style={{ fontWeight: 'bold', fontSize: '1.1em' }}>Settings</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                  <div>
                    <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }} title={WALLETS_OVERVIEW_TOOLTIPS.RISK_BUDGET}>Risk Budget</p>
                    <p data-testid="overview-settings-budget">{formatCurrency(stockBudget ?? 0)}</p>
                  </div>
                  <div>
                    <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }} title={WALLETS_OVERVIEW_TOOLTIPS.BUDGET_USED}>Budget Used</p>
                    <p data-testid="overview-settings-budget-used">{formatCurrency(budgetUsed)}</p>
                  </div>
                  <div>
                    <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }} title={WALLETS_OVERVIEW_TOOLTIPS.BUDGET_AVAILABLE}>Budget Available</p>
                    <p data-testid="overview-settings-budget-available">{formatCurrency(budgetAvailable)}</p>
                  </div>
                  <div>
                    <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }} title={WALLETS_OVERVIEW_TOOLTIPS.TIED_UP}>Tied-Up</p>
                    <p data-testid="overview-settings-invested">{formatCurrency(totalTiedUpInvestment)}</p>
                  </div>
                  <div>
                    <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>r-Inv</p>
                    <p data-testid="overview-settings-risk-investment">{formatCurrency(riskInvestment)}</p>
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
                      <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>STP</p>
                      <p data-testid="overview-settings-stp">{stockStp != null ? `${stockStp}%` : 'Not set'}</p>
                      <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>HTP</p>
                      <p data-testid="overview-settings-htp">{stockHtp != null && stockHtp > 0 ? `${stockHtp}%` : '-'}</p>
                    </div>
                </div>
              </div>

              <div>
                <p style={{ fontWeight: 'bold', fontSize: '1.1em' }}>$ Performance</p>
                <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }} title={WALLETS_OVERVIEW_TOOLTIPS.TOTAL_OOP}>Total OOP</p>
                <p data-testid="overview-cash-total-oop">{formatCurrency(totalOOP)}</p>
                <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }} title={WALLETS_OVERVIEW_TOOLTIPS.CASH_BALANCE}>$ Balance</p>
                <p data-testid="overview-cash-balance">{formatCurrency(currentCashBalance)}</p>
                <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>Market Value</p>
                <p data-testid="overview-market-value">{pricesLoading ? 'Loading...' : formatCurrency(marketValue)}</p>
                <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }} title={WALLETS_OVERVIEW_TOOLTIPS.ROIC}>ROIC</p>
                <p>
                  <span data-testid="overview-roic-value">
                    {(roicValue === null || roicValue === undefined) ? (pricesLoading ? 'Loading...' : 'N/A') : `${roicValue.toFixed(2)}%`}
                  </span>
                </p>
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
                  <span data-testid="overview-realized-swing-pl-dollars">{formatCurrency(realizedPlStats.realizedSwingPL ?? 0)}</span>
                  &nbsp;(
                  <span data-testid="overview-realized-swing-pl-percent">{`${realizedPlStats.realizedSwingPercent ?? 0}%`}</span>
                  )
                </p>
                <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>Hold</p>
                <p>
                  <span data-testid="overview-realized-hold-pl-dollars">{formatCurrency(realizedPlStats.realizedHoldPL ?? 0)}</span>
                  &nbsp;(
                  <span data-testid="overview-realized-hold-pl-percent">{`${realizedPlStats.realizedHoldPercent ?? 0}%`}</span>
                  )
                </p>
                <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>Stock</p>
                <p>
                  <span data-testid="overview-realized-stock-pl-dollars">{formatCurrency(realizedPlStats.realizedStockPL ?? 0)}</span>
                  &nbsp;(
                  <span data-testid="overview-realized-stock-pl-percent">{`${realizedPlStats.realizedStockPercent ?? 0}%`}</span>
                  )
                </p>
              </div>

              <div>
                <p style={{ fontWeight: 'bold', fontSize: '1.1em' }}>Unrealized P/L</p>
                <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>Swing</p>
                <p>
                  <span data-testid="overview-unrealized-swing-pl-dollars">{unrealizedPlStats.unrealizedSwingPL === null ? (pricesLoading ? 'Loading Price...' : 'N/A') : formatCurrency(unrealizedPlStats.unrealizedSwingPL ?? 0)}</span>
                  &nbsp;(<span data-testid="overview-unrealized-swing-pl-percent">{unrealizedPlStats.unrealizedSwingPercent ?? 0}%</span>)
                </p>
                <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>Hold</p>
                <p>
                  <span data-testid="overview-unrealized-hold-pl-dollars">{unrealizedPlStats.unrealizedHoldPL === null ? (pricesLoading ? 'Loading Price...' : 'N/A') : formatCurrency(unrealizedPlStats.unrealizedHoldPL ?? 0)}</span>
                  &nbsp;(<span data-testid="overview-unrealized-hold-pl-percent">{unrealizedPlStats.unrealizedHoldPercent ?? 0}%</span>)
                </p>
                <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>Stock</p>
                <p>
                  <span data-testid="overview-unrealized-stock-pl-dollars">{unrealizedPlStats.unrealizedStockPL === null ? (pricesLoading ? 'Loading Price...' : 'N/A') : formatCurrency(unrealizedPlStats.unrealizedStockPL ?? 0)}</span>
                  &nbsp;(<span data-testid="overview-unrealized-stock-pl-percent">{unrealizedPlStats.unrealizedStockPercent ?? 0}%</span>)
                </p>
              </div>

              <div>
                <p style={{ fontWeight: 'bold', fontSize: '1.1em' }}>Combined P/L</p>
                <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>Swing</p>
                <p>
                  <span data-testid="overview-combined-swing-pl-dollars">{combinedPlStats.combinedSwingPL === null ? (pricesLoading ? 'Loading Price...' : 'N/A') : formatCurrency(combinedPlStats.combinedSwingPL ?? 0)}</span>
                  &nbsp;(<span data-testid="overview-combined-swing-pl-percent">{combinedPlStats.combinedSwingPercent ?? 0}%</span>)
                </p>
                <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>Hold</p>
                <p>
                  <span data-testid="overview-combined-hold-pl-dollars">{combinedPlStats.combinedHoldPL === null ? (pricesLoading ? 'Loading Price...' : 'N/A') : formatCurrency(combinedPlStats.combinedHoldPL ?? 0)}</span>
                  &nbsp;(<span data-testid="overview-combined-hold-pl-percent">{combinedPlStats.combinedHoldPercent ?? 0}%</span>)
                </p>
                <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>Income</p>
                <p>
                  <span data-testid="overview-combined-income-pl-dollars">{formatCurrency(realizedPlStats.totalIncomeFromDivAndSlp ?? 0)}</span>
                </p>
                <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>Stock</p>
                <p>
                  <span data-testid="overview-combined-stock-pl-dollars">{combinedPlStats.combinedStockPL === null ? (pricesLoading ? 'Loading Price...' : 'N/A') : formatCurrency(combinedPlStats.combinedStockPL ?? 0)}</span>
                  &nbsp;(<span data-testid="overview-combined-stock-pl-percent">{combinedPlStats.combinedStockPercent ?? 0}%</span>)
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
