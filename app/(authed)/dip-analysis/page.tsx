'use client';

import React, { useState } from 'react';
import { useDipAnalysis } from '@/app/contexts/DipAnalysisContext';
import type { AnalysisResult } from '@/app/utils/dipRecoveryAnalysis';

export default function DipAnalysisPage() {
  const {
    analysisResults,
    analysisLoading,
    analysisError,
    progressMessage,
    analyzeDipsForSymbol
  } = useDipAnalysis();

  const [symbol, setSymbol] = useState('QQQM');
  const [months, setMonths] = useState<number>(6);
  const [investment, setInvestment] = useState<string>('1000'); // Investment per trade
  const [currentResult, setCurrentResult] = useState<AnalysisResult | null>(null);

  const handleAnalyze = async () => {
    const investmentAmount = parseFloat(investment) || 0;
    const result = await analyzeDipsForSymbol(symbol, months, {
      investmentPerTrade: investmentAmount > 0 ? investmentAmount : undefined
    });
    if (result) {
      setCurrentResult(result);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !analysisLoading) {
      handleAnalyze();
    }
  };

  // Use either newly fetched result or cached result
  const displayResult = currentResult || analysisResults[symbol.toUpperCase()];

  return (
    <div style={{
      minHeight: '100vh',
      padding: '2rem',
      backgroundColor: '#1a1a1a'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        {/* Header */}
        <h1 style={{
          color: '#ffffff',
          fontSize: '2rem',
          fontWeight: 'bold',
          marginBottom: '1rem',
          textAlign: 'center'
        }}>
          Dip-Recovery Pattern Analysis
        </h1>

        <p style={{
          color: '#cccccc',
          textAlign: 'center',
          marginBottom: '2rem',
          fontSize: '0.95rem'
        }}>
          Identify optimal buy/sell signals based on historical price dip patterns
        </p>

        {/* Input Section */}
        <div style={{
          backgroundColor: '#2a2a2a',
          padding: '2rem',
          borderRadius: '8px',
          marginBottom: '2rem'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1fr 1fr',
            gap: '1rem',
            marginBottom: '1rem'
          }}>
            {/* Symbol Input */}
            <div>
              <label style={{
                display: 'block',
                color: '#cccccc',
                marginBottom: '0.5rem',
                fontSize: '0.9rem'
              }}>
                Stock Symbol
              </label>
              <input
                type="text"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                onKeyPress={handleKeyPress}
                placeholder="e.g., QQQM"
                disabled={analysisLoading}
                data-testid="dip-analysis-symbol-input"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  fontSize: '1rem',
                  border: '1px solid #555',
                  borderRadius: '4px',
                  backgroundColor: '#3a3a3a',
                  color: '#ffffff'
                }}
              />
            </div>

            {/* Time Period Selector */}
            <div>
              <label style={{
                display: 'block',
                color: '#cccccc',
                marginBottom: '0.5rem',
                fontSize: '0.9rem'
              }}>
                Time Period
              </label>
              <select
                value={months}
                onChange={(e) => setMonths(Number(e.target.value))}
                disabled={analysisLoading}
                data-testid="dip-analysis-period-select"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  fontSize: '1rem',
                  border: '1px solid #555',
                  borderRadius: '4px',
                  backgroundColor: '#3a3a3a',
                  color: '#ffffff'
                }}
              >
                <option value={3}>3 Months</option>
                <option value={6}>6 Months</option>
                <option value={12}>12 Months</option>
                <option value={24}>24 Months</option>
              </select>
            </div>

            {/* Investment Input */}
            <div>
              <label style={{
                display: 'block',
                color: '#cccccc',
                marginBottom: '0.5rem',
                fontSize: '0.9rem'
              }}>
                Investment/Trade ($)
              </label>
              <input
                type="number"
                value={investment}
                onChange={(e) => setInvestment(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="1000"
                disabled={analysisLoading}
                data-testid="dip-analysis-investment-input"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  fontSize: '1rem',
                  border: '1px solid #555',
                  borderRadius: '4px',
                  backgroundColor: '#3a3a3a',
                  color: '#ffffff'
                }}
              />
            </div>

            {/* Analyze Button */}
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button
                onClick={handleAnalyze}
                disabled={analysisLoading || !symbol.trim()}
                data-testid="dip-analysis-analyze-button"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  color: '#ffffff',
                  backgroundColor: analysisLoading ? '#666666' : '#007155',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: analysisLoading ? 'not-allowed' : 'pointer',
                  transition: 'background-color 0.2s'
                }}
              >
                {analysisLoading ? 'Analyzing...' : 'Analyze'}
              </button>
            </div>
          </div>

          {/* Progress/Error Messages */}
          {progressMessage && (
            <div style={{
              padding: '10px',
              backgroundColor: '#3a3a3a',
              color: '#ffffff',
              borderRadius: '4px',
              marginTop: '1rem',
              fontSize: '0.9rem',
              textAlign: 'center'
            }}>
              {progressMessage}
            </div>
          )}

          {analysisError && (
            <div style={{
              padding: '10px',
              backgroundColor: '#dc3545',
              color: '#ffffff',
              borderRadius: '4px',
              marginTop: '1rem',
              fontSize: '0.9rem'
            }}>
              Error: {analysisError}
            </div>
          )}
        </div>

        {/* Results Section */}
        {displayResult && (
          <div>
            {/* Summary Card */}
            <div style={{
              backgroundColor: '#2a2a2a',
              padding: '2rem',
              borderRadius: '8px',
              marginBottom: '1.5rem',
              border: '2px solid #007155'
            }}>
              <h2 style={{
                color: '#ffffff',
                fontSize: '1.5rem',
                marginBottom: '1.5rem',
                textAlign: 'center'
              }}>
                Analysis Summary - {displayResult.symbol}
              </h2>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1.5rem'
              }}>
                {/* Key Metric Cards */}
                <MetricCard
                  label="Suggested Buy Threshold"
                  value={`${displayResult.recommendation.suggestedBuyThreshold.toFixed(2)}%`}
                  highlight={true}
                />
                <MetricCard
                  label="Average Dip"
                  value={`${displayResult.statistics.averageDrop.toFixed(2)}%`}
                />
                <MetricCard
                  label="Median Dip"
                  value={`${displayResult.statistics.medianDrop.toFixed(2)}%`}
                />
                <MetricCard
                  label="Total Cycles"
                  value={displayResult.statistics.totalDips.toString()}
                />
                <MetricCard
                  label="Recovery Rate"
                  value={`${displayResult.statistics.recoveryRate.toFixed(1)}%`}
                />
                <MetricCard
                  label="Avg Recovery Time"
                  value={`${Math.round(displayResult.statistics.averageRecoveryDays)} days`}
                />
              </div>

              {/* Recommendation */}
              <div style={{
                marginTop: '1.5rem',
                padding: '1rem',
                backgroundColor: '#1a4d3a',
                borderRadius: '6px',
                border: '1px solid #00a86b'
              }}>
                <h3 style={{
                  color: '#ffffff',
                  fontSize: '1rem',
                  marginBottom: '0.5rem'
                }}>
                  Trading Recommendation
                </h3>
                <p style={{
                  color: '#cccccc',
                  fontSize: '0.9rem',
                  margin: '0.25rem 0'
                }}>
                  <strong>Buy Signal:</strong> Consider buying when price drops by {displayResult.recommendation.suggestedBuyThreshold.toFixed(2)}%
                </p>
                <p style={{
                  color: '#cccccc',
                  fontSize: '0.9rem',
                  margin: '0.25rem 0'
                }}>
                  <strong>Sell Strategy:</strong> {displayResult.recommendation.suggestedSellStrategy}
                </p>
                <p style={{
                  color: '#cccccc',
                  fontSize: '0.9rem',
                  margin: '0.25rem 0'
                }}>
                  <strong>Expected Recovery:</strong> ~{displayResult.recommendation.expectedRecoveryDays} days
                </p>
              </div>
            </div>

            {/* ROIC Simulation Results */}
            {displayResult.roicSimulation && (
              <div style={{
                backgroundColor: '#2a2a2a',
                padding: '2rem',
                borderRadius: '8px',
                marginBottom: '1.5rem',
                border: '2px solid #ffa500'
              }}>
                <h2 style={{
                  color: '#ffffff',
                  fontSize: '1.5rem',
                  marginBottom: '1.5rem',
                  textAlign: 'center'
                }}>
                  ROIC Simulation - ${parseFloat(investment).toLocaleString()} per Trade
                </h2>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '1.5rem'
                }}>
                  <MetricCard
                    label="ROIC"
                    value={`${displayResult.roicSimulation.roicPercent.toFixed(2)}%`}
                    highlight={true}
                  />
                  <MetricCard
                    label="Total Profit"
                    value={`$${displayResult.roicSimulation.totalProfit.toFixed(2)}`}
                  />
                  <MetricCard
                    label="Total Invested"
                    value={`$${displayResult.roicSimulation.totalInvestmentUsed.toLocaleString()}`}
                  />
                  <MetricCard
                    label="Total Returned"
                    value={`$${displayResult.roicSimulation.totalCashReturned.toLocaleString()}`}
                  />
                  <MetricCard
                    label="Success Rate"
                    value={`${displayResult.roicSimulation.successRate.toFixed(1)}%`}
                  />
                  <MetricCard
                    label="Avg Profit/Trade"
                    value={`$${displayResult.roicSimulation.averageProfitPerTrade.toFixed(2)}`}
                  />
                  <MetricCard
                    label="Completed Trades"
                    value={displayResult.roicSimulation.tradeCount.toString()}
                  />
                  <MetricCard
                    label="Profitable Trades"
                    value={displayResult.roicSimulation.successfulTrades.toString()}
                  />
                  <MetricCard
                    label="Largest Gain"
                    value={`$${displayResult.roicSimulation.largestGain.toFixed(2)}`}
                  />
                  <MetricCard
                    label="Largest Loss"
                    value={`$${displayResult.roicSimulation.largestLoss.toFixed(2)}`}
                  />
                </div>

                <div style={{
                  marginTop: '1.5rem',
                  padding: '1rem',
                  backgroundColor: '#3a2a1a',
                  borderRadius: '6px',
                  border: '1px solid #ffa500'
                }}>
                  <h3 style={{
                    color: '#ffffff',
                    fontSize: '1rem',
                    marginBottom: '0.5rem'
                  }}>
                    Performance Summary
                  </h3>
                  <p style={{
                    color: '#cccccc',
                    fontSize: '0.9rem',
                    margin: '0.25rem 0'
                  }}>
                    <strong>Investment per Trade:</strong> ${parseFloat(investment).toLocaleString()}
                  </p>
                  <p style={{
                    color: '#cccccc',
                    fontSize: '0.9rem',
                    margin: '0.25rem 0'
                  }}>
                    <strong>Total Profit/Loss:</strong> ${displayResult.roicSimulation.totalProfit.toFixed(2)} ({displayResult.roicSimulation.totalProfitPercent.toFixed(2)}%)
                  </p>
                  <p style={{
                    color: '#cccccc',
                    fontSize: '0.9rem',
                    margin: '0.25rem 0'
                  }}>
                    <strong>Return on Initial Capital (ROIC):</strong> {displayResult.roicSimulation.roicPercent.toFixed(2)}%
                  </p>
                  <p style={{
                    color: '#888888',
                    fontSize: '0.85rem',
                    marginTop: '0.75rem',
                    fontStyle: 'italic'
                  }}>
                    Based on {displayResult.roicSimulation.tradeCount} completed dip-recovery cycles. Simulates buying at suggested threshold and selling at recovery.
                  </p>
                </div>
              </div>
            )}

            {/* Detailed Statistics */}
            <div style={{
              backgroundColor: '#2a2a2a',
              padding: '2rem',
              borderRadius: '8px',
              marginBottom: '1.5rem'
            }}>
              <h3 style={{
                color: '#ffffff',
                fontSize: '1.3rem',
                marginBottom: '1rem'
              }}>
                Detailed Statistics
              </h3>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '1rem'
              }}>
                <StatRow label="Analysis Period" value={`${displayResult.periodStart} to ${displayResult.periodEnd}`} />
                <StatRow label="Trading Days Analyzed" value={displayResult.totalDays.toString()} />
                <StatRow label="Dips Recovered" value={`${displayResult.statistics.recoveredCount} of ${displayResult.statistics.totalDips}`} />
                <StatRow label="Min Dip Observed" value={`${displayResult.statistics.minDrop.toFixed(2)}%`} />
                <StatRow label="Max Dip Observed" value={`${displayResult.statistics.maxDrop.toFixed(2)}%`} />
                <StatRow label="Std Deviation" value={`${displayResult.statistics.stdDeviation.toFixed(2)}%`} />
                <StatRow label="Median Recovery Time" value={`${Math.round(displayResult.statistics.medianRecoveryDays)} days`} />
              </div>
            </div>

            {/* Frequency Distribution */}
            <div style={{
              backgroundColor: '#2a2a2a',
              padding: '2rem',
              borderRadius: '8px'
            }}>
              <h3 style={{
                color: '#ffffff',
                fontSize: '1.3rem',
                marginBottom: '1rem'
              }}>
                Dip Frequency Distribution
              </h3>

              <div style={{ marginBottom: '1rem' }}>
                {displayResult.frequencyDistribution.map((bucket, index) => (
                  <FrequencyBar
                    key={index}
                    label={bucket.rangeLabel}
                    count={bucket.count}
                    maxCount={Math.max(...displayResult.frequencyDistribution.map(b => b.count))}
                  />
                ))}
              </div>

              <p style={{
                color: '#888888',
                fontSize: '0.85rem',
                marginTop: '1rem',
                fontStyle: 'italic'
              }}>
                Note: This shows how often dips of different magnitudes occur. Use this to set your buy thresholds.
              </p>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!displayResult && !analysisLoading && !analysisError && (
          <div style={{
            backgroundColor: '#2a2a2a',
            padding: '3rem',
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <p style={{
              color: '#888888',
              fontSize: '1.1rem'
            }}>
              Enter a stock symbol and click &quot;Analyze&quot; to get started
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper Components

function MetricCard({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{
      padding: '1rem',
      backgroundColor: highlight ? '#1a4d3a' : '#3a3a3a',
      borderRadius: '6px',
      textAlign: 'center',
      border: highlight ? '2px solid #00a86b' : 'none'
    }}>
      <div style={{
        color: '#888888',
        fontSize: '0.85rem',
        marginBottom: '0.5rem',
        textTransform: 'uppercase',
        letterSpacing: '0.5px'
      }}>
        {label}
      </div>
      <div style={{
        color: highlight ? '#00ff88' : '#ffffff',
        fontSize: '1.5rem',
        fontWeight: 'bold'
      }}>
        {value}
      </div>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      padding: '0.75rem',
      backgroundColor: '#3a3a3a',
      borderRadius: '4px'
    }}>
      <span style={{ color: '#cccccc', fontSize: '0.9rem' }}>{label}:</span>
      <span style={{ color: '#ffffff', fontSize: '0.9rem', fontWeight: '500' }}>{value}</span>
    </div>
  );
}

function FrequencyBar({ label, count, maxCount }: { label: string; count: number; maxCount: number }) {
  const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;

  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '0.25rem'
      }}>
        <span style={{ color: '#cccccc', fontSize: '0.9rem' }}>{label}</span>
        <span style={{ color: '#ffffff', fontSize: '0.9rem', fontWeight: '500' }}>{count}</span>
      </div>
      <div style={{
        width: '100%',
        height: '24px',
        backgroundColor: '#3a3a3a',
        borderRadius: '4px',
        overflow: 'hidden'
      }}>
        <div style={{
          width: `${percentage}%`,
          height: '100%',
          backgroundColor: '#007155',
          transition: 'width 0.3s ease'
        }} />
      </div>
    </div>
  );
}
