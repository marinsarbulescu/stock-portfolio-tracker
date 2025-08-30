import React, { useState } from 'react';
import { formatCurrency, formatShares } from '@/app/utils/financialCalculations';
import { SHARE_PRECISION } from '@/app/config/constants';
import { getFieldTooltip } from '@/app/config/fieldDefinitions';
import type { RealizedPLStats, UnrealizedPLStats, CombinedPLStats, TransactionCounts, CurrentShares } from '../types';

// Simple tooltip component
interface TooltipProps {
  children: React.ReactNode;
  content: string;
}

function Tooltip({ children, content }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div 
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#333',
            color: '#fff',
            padding: '8px 12px',
            borderRadius: '4px',
            fontSize: '0.75em',
            width: '200px',
            textAlign: 'center',
            zIndex: 1000,
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            marginBottom: '5px',
          }}
        >
          {content}
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '5px solid transparent',
              borderRight: '5px solid transparent',
              borderTop: '5px solid #333',
            }}
          />
        </div>
      )}
    </div>
  );
}

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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: '0px 15px', marginTop: '10px' }}>

              <div>
                <p style={{ fontWeight: 'bold', fontSize: '1.1em' }}>Settings</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                  <div>
                    <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>Budget</p>
                    <p data-testid="overview-settings-budget">{formatCurrency(stockBudget ?? 0)}</p>
                  </div>
                  <div>
                    <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>tInv</p>
                    <p data-testid="overview-settings-invested">{formatCurrency(totalTiedUpInvestment)}</p>
                  </div>
                  <div>
                    <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em' }}>r-Inv</p>
                    <p data-testid="overview-settings-risk-investment">{formatCurrency(riskInvestment)}</p>
                  </div>
                </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                    <div>
                      <Tooltip content={getFieldTooltip('PDP')}>
                        <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em', cursor: 'help', textDecoration: 'underline dotted' }}>PDP</p>
                      </Tooltip>
                      <p data-testid="overview-settings-pdp">{stockPdp != null ? `${stockPdp}%` : 'N/A'}</p>
                      <Tooltip content={getFieldTooltip('STP')}>
                        <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em', cursor: 'help', textDecoration: 'underline dotted' }}>STP</p>
                      </Tooltip>
                      <p data-testid="overview-settings-stp">{stockStp != null ? stockStp : 'N/A'}</p>
                    </div>
                    <div>
                      <Tooltip content={getFieldTooltip('SHR')}>
                        <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em', cursor: 'help', textDecoration: 'underline dotted' }}>SHR</p>
                      </Tooltip>
                      <p data-testid="overview-settings-shr">{stockShr != null ? `${stockShr}% Swing` : 'N/A'}</p>
                      <Tooltip content={getFieldTooltip('HTP')}>
                        <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '0.9em', cursor: 'help', textDecoration: 'underline dotted' }}>HTP</p>
                      </Tooltip>
                      <p data-testid="overview-settings-htp">{stockHtp != null && stockHtp !== 0 ? `${stockHtp}%` : 'N/A'}</p>
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
