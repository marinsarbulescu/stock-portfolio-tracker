// app/(authed)/stocks-listing/page.tsx - Refactored with ["type"] pattern
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';
import AddStockForm from '@/app/components/AddStockForm';
import { FaEdit, FaTrashAlt, FaEye, FaEyeSlash } from 'react-icons/fa';
import Link from 'next/link';
import { usePrices } from '@/app/contexts/PriceContext';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';

// Register Chart.js components and plugins
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, ChartDataLabels);

// Use the simpler data type for state
type PortfolioStockDataType = Schema["PortfolioStock"]["type"];
// Define type needed for update payload
type PortfolioStockUpdateInput = Partial<PortfolioStockDataType> & { id: string };

type PriceMap = Record<string, number | null>; // Symbol -> Price or null

const client = generateClient<Schema>();

// Create a wrapper component that safely uses the context
function StocksListingContent() {
  // --- STATE using PortfolioStockDataType[] ---
  const [portfolioStocksData, setPortfolioStocksData] = useState<PortfolioStockDataType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- State for editing and modal ---
  const [isAddModalOpen, setIsAddModalOpen] = useState(false); // For Add Stock modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false); // For Edit Stock modal
  const [editingStockId, setEditingStockId] = useState<string | null>(null);
  const [stockToEditData, setStockToEditData] = useState<PortfolioStockDataType | null>(null);
  const [isOverviewExpanded, setIsOverviewExpanded] = useState(false); // For collapsible overview

  // Inside your component function - this will now work because we're in a client component under the provider
  const { latestPrices, pricesLoading, pricesError } = usePrices();

  const handleToggleHidden = async (stock: PortfolioStockDataType) => {
    const newHiddenState = !stock.isHidden; // Calculate the new state
    // Optional confirmation for clarity
    if (!window.confirm(`Are you sure you want to ${newHiddenState ? 'hide' : 'show'} ${stock.symbol?.toUpperCase()} in reports?`)) {
        return;
    }

    console.log(`Attempting to set isHidden=${newHiddenState} for stock id: ${stock.id}`);
    setError(null); // Clear previous errors

    try {
        // Update only the isHidden field
        const { data: updatedStock, errors } = await client.models.PortfolioStock.update({
            id: stock.id,
            isHidden: newHiddenState,
        });

        if (errors) {
            console.error('Error updating stock hidden status:', errors);
            setError(errors[0]?.message || 'Failed to update stock.');
        } else {
            console.log('Stock hidden status updated successfully:', updatedStock);
            // Refresh the portfolio list to potentially update UI indication if needed
            fetchPortfolio();
        }
    } catch (err: any) {
        console.error('Unexpected error updating stock hidden status:', err);
        setError(err.message || 'An error occurred during update.');
    }
};

  // Fetch Portfolio Function
  const fetchPortfolio = useCallback(async () => {
    setIsLoading(true); // Set loading at the start
    setError(null);

    try {
      // --- Fetch Portfolio Stocks ONCE ---
      console.log("Fetching portfolio stocks...");
      const { data: stocks, errors } = await client.models.PortfolioStock.list({
        // Fetch all fields needed for the table AND the toggle button logic
        selectionSet: [
            'id',
            'symbol',
            'name',
            'stockType', // Assuming 'stockType' is the correct field name based on your JSX
            'region',
            'pdp',
            'plr',
            'budget',
            'isHidden',  // <<< Ensure isHidden is included here
            'swingHoldRatio',
        ]
      });
      // --- End Fetch ---

      if (errors) {
          console.error("Error fetching portfolio:", errors);
          throw errors; // Throw error to be caught below
      }

      // Set state with the fetched data (which includes isHidden)
      setPortfolioStocksData(stocks as PortfolioStockDataType[]);
      console.log('Fetched portfolio count:', stocks.length);

    } catch (err: any) {
      console.error("Error fetching portfolio:", err);
      const errorMessage = Array.isArray(err?.errors) ? err.errors[0].message : (err.message || "An unexpected error occurred fetching portfolio.");
      setError(errorMessage);
      setPortfolioStocksData([]); // Clear data on error
    } finally {
      setIsLoading(false); // Set loading false when done (success or error)
    }
  }, []);
  
  // Keep your useEffect to call fetchPortfolio
  useEffect(() => { fetchPortfolio(); }, [fetchPortfolio]);

  // Delete Handler (uses ID directly)
  const handleDeleteStock = async (idToDelete: string) => {
    if (!window.confirm('Are you sure?')) return;
    setError(null);
    try {
      await client.models.PortfolioStock.delete({ id: idToDelete });
      console.log('Stock deleted!');
      fetchPortfolio(); // Refresh list
    } catch (err: any) { /* ... error handling ... */ }
  };

  // Modal Handlers
  const openAddModal = () => {
    setIsAddModalOpen(true);
  };

  const closeAddModal = () => {
    setIsAddModalOpen(false);
  };

  const handleAddSuccess = () => {
    fetchPortfolio(); // Refresh the list
    closeAddModal(); // Close the modal
  };

  // Edit Click Handler (sets up edit modal)
  const handleEditClick = (stockData: PortfolioStockDataType) => {
    console.log('Editing stock data:', stockData);
    setEditingStockId(stockData.id);
    setStockToEditData(stockData);
    setIsEditModalOpen(true);
  };

  // Cancel Edit Handler
  const handleCancelEdit = () => {
    setIsEditModalOpen(false);
    setEditingStockId(null);
    setStockToEditData(null);
  };

  // Update Stock Handler (receives plain object from form, uses ID from state)
  const handleUpdateStock = async (updatePayload: PortfolioStockUpdateInput) => {
    if (!editingStockId) return;
    console.log('Attempting to update stock:', editingStockId, updatePayload);
    setError(null);

    try {
      const { data: updatedStock, errors } = await client.models.PortfolioStock.update(updatePayload);
      if (errors) throw errors;

      console.log('Stock updated successfully:', updatedStock);
      fetchPortfolio(); // Refresh the list
      handleCancelEdit(); // Close edit modal

    } catch (err: any) {
      console.error('Error updating stock:', err);
      const message = Array.isArray(err) ? err[0].message : err.message;
      setError(message || 'Failed to update stock.');
    }
  };

  // Modal styles
  const modalOverlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000
  };

  const modalContentStyle: React.CSSProperties = {
    backgroundColor: '#1e1e1e',
    borderRadius: '8px',
    maxHeight: '90vh',
    width: '90%',
    maxWidth: '500px',
    overflowY: 'auto',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)'
  };
  
  // Calculate region distribution
  const regionDistribution = useMemo(() => {
    // Initialize counters for each region
    const distribution = {
        US: 0,
        Intl: 0,
        APAC: 0,
        EU: 0
    };
    
    // Count stocks in each region
    portfolioStocksData.forEach(stock => {
        if (stock.region) {
            if (distribution.hasOwnProperty(stock.region)) {
                distribution[stock.region as keyof typeof distribution]++;
            }
        }
    });
    
    return distribution;
  }, [portfolioStocksData]);
  
  // Calculate detailed breakdown by region and stock type
  const detailedDistribution = useMemo(() => {
    // Create a structure to hold counts for each region and stock type
    const distribution: Record<string, Record<string, number>> = {
      US: { Stock: 0, ETF: 0, Crypto: 0 },
      Intl: { Stock: 0, ETF: 0, Crypto: 0 },
      APAC: { Stock: 0, ETF: 0, Crypto: 0 },
      EU: { Stock: 0, ETF: 0, Crypto: 0 }
    };

    // Count stocks by region and type
    portfolioStocksData.forEach(stock => {
      if (stock.region && stock.stockType) {
        const region = stock.region as keyof typeof distribution;
        const stockType = stock.stockType as keyof typeof distribution.US;
        
        if (distribution[region] && distribution[region][stockType] !== undefined) {
          distribution[region][stockType]++;
        }
      }
    });

    return distribution;
  }, [portfolioStocksData]);

  // Calculate percentages
  const percentages = useMemo(() => {
    const total = Object.values(regionDistribution).reduce((sum, count) => sum + count, 0);
    return {
      US: total > 0 ? Math.round((regionDistribution.US / total) * 100) : 0,
      Intl: total > 0 ? Math.round((regionDistribution.Intl / total) * 100) : 0,
      APAC: total > 0 ? Math.round((regionDistribution.APAC / total) * 100) : 0,
      EU: total > 0 ? Math.round((regionDistribution.EU / total) * 100) : 0
    };
  }, [regionDistribution]);
  
  // Prepare data for the region distribution pie chart
  const regionChartData = {
    labels: ['US', 'International', 'Asia-Pacific', 'Europe'],
    datasets: [
      {
          data: [
              regionDistribution.US,
              regionDistribution.Intl,
              regionDistribution.APAC,
              regionDistribution.EU
          ],
          backgroundColor: [
              'rgba(54, 162, 235, 0.6)', // US - Blue
              'rgba(255, 159, 64, 0.6)', // Intl - Orange
              'rgba(255, 252, 99, 0.6)',  // APAC - Yellow
              'rgba(75, 192, 81, 0.6)'   // EU - Green
          ],
          borderColor: [
              'rgba(54, 162, 235, 1)', // US - Blue
              'rgba(255, 159, 64, 1)', // Intl - Orange
              'rgba(255, 252, 99, 1)',  // APAC - Yellow
              'rgba(75, 192, 81, 1)'   // EU - Green
          ],
          borderWidth: 1,
      },
    ],
  };

  // Chart options
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          color: '#fff', // Light text color for dark theme
          boxWidth: 15,
          font: {
            size: 10
          }
        }
      },
      tooltip: {
        callbacks: {
          title: () => '',
          label: (context: any) => {
            const label = context.label || '';
            const value = context.raw || 0;
            const total = context.chart.data.datasets[0].data.reduce((a: number, b: number) => a + b, 0);
            const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
            return `${label}: ${value} (${percentage}%)`;
          }
        }
      },
      datalabels: {
        // Configure the data labels plugin
        color: '#fff',
        font: {
          weight: 'bold',
          size: 11
        },
        textStrokeColor: 'black',
        textStrokeWidth: 1,
        textShadowBlur: 5,
        textShadowColor: 'rgba(0, 0, 0, 0.5)',
        align: 'outer',
        anchor: 'end',
        offset: 10,
        formatter: (value: number, context: any) => {
          const total = context.dataset.data.reduce((sum: number, val: number) => sum + val, 0);
          const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
          return `${value} (${percentage}%)`;
        },
        display: (context: any) => {
          // Only show labels for segments that aren't too small
          const value = context.dataset.data[context.dataIndex];
          const total = context.dataset.data.reduce((sum: number, val: number) => sum + val, 0);
          return value / total > 0.05; // Only show if the segment is at least 5% of the total
        }
      }
    }
  };

  // Get region colors for the stacked bar chart
  const regionColors = {
    US: 'rgba(54, 162, 235, 0.7)',    // Blue
    Intl: 'rgba(255, 159, 64, 0.7)',  // Orange
    EU: 'rgba(75, 192, 192, 0.7)',    // Green
    APAC: 'rgba(255, 99, 132, 0.7)'   // Red
  };

  // Get colors for stock types within each bar
  const stockTypeColors = {
    Stock: 'rgba(54, 162, 235, 0.9)',  // Darker blue
    ETF: 'rgba(255, 205, 86, 0.9)',    // Yellow
    Crypto: 'rgba(153, 102, 255, 0.9)' // Purple
  };

  return (
    <div>
      <h2>Portfolio</h2>
      
      {/* Collapsible Overview Section */}
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
          onClick={() => setIsOverviewExpanded(!isOverviewExpanded)}
        >                   
          Overview
          <span style={{ fontSize: '0.8em' }}>{isOverviewExpanded ? '▼' : '▶'}</span>
        </p>

        {isOverviewExpanded && (
          <div style={{
            padding: '15px',
            borderTop: '1px solid #444',
            fontSize: '0.8em'
          }}>
            <p style={{ fontWeight: 'bold', fontSize: '1.1em', marginBottom: '10px' }}>Region Distribution</p>
            <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                gap: '20px',
                alignItems: 'center',
                marginBottom: '25px'
            }}>
              {/* Chart container */}
              <div style={{ height: '180px', position: 'relative' }}>
                {/* @ts-ignore */}
                <Pie data={regionChartData} options={chartOptions} />
              </div>

              {/* Text representation of the data */}
              {/* <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <p style={{ 
                        marginTop: '5px', 
                        fontWeight: 'bold', 
                        color: 'rgba(54, 162, 235, 0.9)' 
                    }}>US</p>
                    <p>{percentages.US}%</p>
                    <p style={{ marginTop: '15px', fontWeight: 'bold', color: 'rgba(255, 99, 132, 0.9)' }}>Asia-Pacific</p>
                    <p>{percentages.APAC}%</p>
                  </div>
                  <div>
                    <p style={{ marginTop: '5px', fontWeight: 'bold', color: 'rgba(255, 159, 64, 0.9)' }}>International</p>
                    <p>{percentages.Intl}%</p>
                    <p style={{ marginTop: '15px', fontWeight: 'bold', color: 'rgba(75, 192, 192, 0.9)' }}>Europe</p>
                    <p>{percentages.EU}%</p>
                  </div>
                </div>
                <p style={{ marginTop: '15px', fontSize: '0.9em' }}>
                  Total Stocks: {regionDistribution.US + regionDistribution.Intl + regionDistribution.APAC + regionDistribution.EU}
                </p>
              </div> */}
            </div>

            {/* Stock Type Distribution by Region - Bar Chart Visualization */}
            <p style={{ fontWeight: 'bold', fontSize: '1.1em', marginTop: '20px', marginBottom: '20px' }}>Region & Stock Type Distribution</p>
            
            {/* Custom bar chart visualization */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              height: '260px',
              width: '100%',
              borderBottom: '2px solid #666',
              position: 'relative',
              marginBottom: '30px'
            }}>
              {/* Render bars for each region */}
              {['EU', 'Intl', 'US', 'APAC'].map(region => {
                const regionKey = region as keyof typeof detailedDistribution;
                const totalInRegion = Object.values(detailedDistribution[regionKey]).reduce((sum, count) => sum + count, 0);
                const regionPercentage = percentages[regionKey as keyof typeof percentages];
                
                // Skip regions with no data
                if (totalInRegion === 0) return null;

                // Calculate relative bar height (max height is 200px)
                const barHeight = Math.max(30, (totalInRegion / 10) * 200);
                const barWidth = 80;
                
                return (
                  <div key={region} style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    position: 'relative'
                  }}>
                    {/* Region total and percentage at the top */}
                    <div style={{
                      fontSize: '0.85em',
                      fontWeight: 'bold',
                      marginBottom: '2px',
                      textAlign: 'center'
                    }}>
                      {totalInRegion}
                      <br />
                      <span style={{ fontSize: '0.9em' }}>({regionPercentage}%)</span>
                    </div>
                    
                    {/* Bar container */}
                    <div style={{
                      width: `${barWidth}px`,
                      height: `${barHeight}px`,
                      display: 'flex',
                      flexDirection: 'column-reverse', // Stack segments from bottom
                      overflow: 'visible',
                      position: 'relative'
                    }}>
                      {/* Render segments for each stock type */}
                      {(Object.keys(detailedDistribution[regionKey]) as Array<keyof typeof detailedDistribution.US>)
                        .filter(stockType => detailedDistribution[regionKey][stockType] > 0)
                        .map(stockType => {
                          const count = detailedDistribution[regionKey][stockType];
                          const segmentPercentage = totalInRegion > 0 
                            ? Math.round((count / totalInRegion) * 100) 
                            : 0;
                          
                          // Calculate segment height proportional to its count within region's total
                          const segmentHeight = count > 0 
                            ? (count / totalInRegion) * barHeight 
                            : 0;
                          
                          return (
                            <div key={`${region}-${stockType}`}
                              style={{
                                width: '100%',
                                height: `${segmentHeight}px`,
                                backgroundColor: stockTypeColors[stockType as keyof typeof stockTypeColors],
                                border: '1px solid rgba(255, 255, 255, 0.3)',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                position: 'relative',
                                overflow: 'visible'
                              }}
                            >
                              {/* Label inside bar if there's enough space */}
                              {segmentHeight > 25 && (
                                <div style={{
                                  color: '#fff',
                                  fontSize: '0.8em',
                                  fontWeight: 'bold',
                                  textShadow: '0px 0px 2px rgba(0,0,0,0.7)'
                                }}>
                                  {count} ({segmentPercentage}%)
                                </div>
                              )}
                              
                              {/* Label to the side if bar is too small */}
                              {segmentHeight <= 25 && segmentHeight > 0 && (
                                <div style={{
                                  position: 'absolute',
                                  right: '-45px',
                                  top: '50%',
                                  transform: 'translateY(-50%)',
                                  fontSize: '0.7em',
                                  color: '#ddd',
                                  whiteSpace: 'nowrap'
                                }}>
                                  {count} ({segmentPercentage}%)
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                    
                    {/* X-axis region label */}
                    <div style={{
                      marginTop: '5px',
                      fontWeight: 'bold',
                      fontSize: '0.9em'
                    }}>
                      {region}
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Legend for stock types */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '20px',
              marginTop: '5px'
            }}>
              {Object.entries(stockTypeColors).map(([type, color]) => (
                <div key={type} style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{
                    width: '15px',
                    height: '15px',
                    backgroundColor: color,
                    marginRight: '5px'
                  }}></div>
                  <span style={{ fontSize: '0.9em' }}>{type}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Button to open Add Stock modal */}
      <button 
        onClick={openAddModal} 
        style={{
          marginTop: '1rem',
          padding: '8px 16px',
          background: '#557100',
          borderRadius: '4px',
          color: 'white',
          cursor: 'pointer'
        }}
      >
        Add New Stock
      </button>

      {isLoading && <p>Loading stocks...</p>}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}

      {/* Table Display */}
      {!isLoading && !error && (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem', fontSize: '0.8em' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>
              {/* Headers */}
              <th style={{ padding: '5px' }}>Ticker</th>
              <th style={{ padding: '5px' }}>Name</th>
              <th style={{ padding: '5px' }}>Type</th>
              <th style={{ padding: '5px' }}>Region</th>
              <th style={{ padding: '5px' }}>Last Price</th>
              <th style={{ padding: '5px' }}>PDP (%)</th>
              <th style={{ padding: '5px' }}>PLR (%)</th>
              <th style={{ padding: '5px' }}>Budget</th>
              <th style={{ padding: '5px', textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {portfolioStocksData.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '1rem' }}>Your portfolio is empty.</td></tr>
            ) : (
              portfolioStocksData.map((stock, index) => (
                <tr key={stock.id} style={{ backgroundColor: index % 2 !== 0 ? '#151515' : 'transparent' }}>
                  <td style={{ padding: '5px' }}><Link href={`/wallets/${stock.id}`}>{stock.symbol?.toUpperCase()}</Link></td>
                  <td style={{ padding: '5px' }}>
                    {stock.name ? 
                      (stock.name.length > 15 ? 
                        `${stock.name.substring(0, 15)}...` : 
                        stock.name) 
                      : '-'}
                  </td>
                  <td style={{ padding: '5px' }}>{stock.stockType}</td>
                  <td style={{ padding: '5px' }}>{stock.region}</td>
                  <td style={{ padding: '5px' }}>
                    {pricesLoading ? '...' : (latestPrices[stock.symbol]?.currentPrice?.toFixed(2) ?? 'N/A')}
                  </td>
                  <td style={{ padding: '5px' }}>{stock.pdp ?? '-'}</td>
                  <td style={{ padding: '5px' }}>{stock.plr ?? '-'}</td>
                  <td style={{ padding: '5px' }}>{typeof stock.budget === 'number' ? stock.budget.toLocaleString('en-US', {style:'currency', currency:'USD'}) : '-'}</td>
                  {/* Actions */}
                  <td style={{ padding: '5px', textAlign: 'center' }}>
                    <button 
                      onClick={() => handleEditClick(stock)} 
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '5px', color: 'gray', marginRight: '5px' }}
                      title="Edit Stock">
                        <FaEdit />
                    </button>
                    <button 
                      onClick={() => handleToggleHidden(stock)} 
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '5px', color: 'gray' }}
                      title={stock.isHidden ? "Show in Reports" : "Hide from Reports"}>
                        {stock.isHidden ? <FaEyeSlash /> : <FaEye />}
                    </button>
                    {/* <button onClick={() => handleDeleteStock(stock.id)} title="Delete Stock"><FaTrashAlt /></button> */}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}

      {/* Add Stock Modal */}
      {isAddModalOpen && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <AddStockForm
              isEditMode={false}
              onStockAdded={handleAddSuccess}
              onCancel={closeAddModal}
            />
          </div>
        </div>
      )}

      {/* Edit Stock Modal */}
      {isEditModalOpen && stockToEditData && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <AddStockForm
              isEditMode={true}
              initialData={stockToEditData}
              onUpdate={handleUpdateStock}
              onCancel={handleCancelEdit}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Main page component wrapped with error handling
export default function StocksListingPage() {
  // Use error boundary pattern to catch any context errors
  const [hasError, setHasError] = useState(false);

  // If there's an error with context, show a fallback UI
  if (hasError) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>Something went wrong</h2>
        <p>There was an issue loading the stocks listing page.</p>
        <button 
          onClick={() => window.location.reload()}
          style={{
            marginTop: '1rem',
            padding: '8px 16px',
            background: '#444',
            borderRadius: '4px',
            color: 'white',
            cursor: 'pointer'
          }}
        >
          Reload page
        </button>
      </div>
    );
  }

  // Try to render the content component
  try {
    return <StocksListingContent />;
  } catch (error) {
    console.error("Error in StocksListingPage:", error);
    setHasError(true);
    return null; // Will re-render with the error state
  }
}