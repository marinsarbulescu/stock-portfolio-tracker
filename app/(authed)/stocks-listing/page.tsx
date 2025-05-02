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

  // Calculate stock type distribution
  const stockTypeDistribution = useMemo(() => {
    // Initialize counters for each stock type
    const distribution = {
      Stock: 0,
      ETF: 0, 
      Crypto: 0
    };
    
    // Count stocks by type
    portfolioStocksData.forEach(stock => {
      if (stock.stockType && Object.keys(distribution).includes(stock.stockType)) {
        distribution[stock.stockType as keyof typeof distribution]++;
      }
    });
    
    return distribution;
  }, [portfolioStocksData]);

  // Calculate stock type percentages
  const stockTypePercentages = useMemo(() => {
    const total = Object.values(stockTypeDistribution).reduce((sum, count) => sum + count, 0);
    return {
      Stock: total > 0 ? Math.round((stockTypeDistribution.Stock / total) * 100) : 0,
      ETF: total > 0 ? Math.round((stockTypeDistribution.ETF / total) * 100) : 0,
      Crypto: total > 0 ? Math.round((stockTypeDistribution.Crypto / total) * 100) : 0
    };
  }, [stockTypeDistribution]);

  // Calculate US region investment statistics
  const usRegionStats = useMemo(() => {
    // Filter for only US region stocks
    const usStocks = portfolioStocksData.filter(stock => stock.region === 'US');
    
    // Count US stocks by type 
    const stockCount = usStocks.filter(s => s.stockType === 'Stock').length;
    const etfCount = usStocks.filter(s => s.stockType === 'ETF').length;
    const totalCount = stockCount + etfCount;
    
    // Sum up investment amounts - using budget as investment value for demonstration
    // In real app, you might want to use actual investment amounts
    const stockSwingInvestment = usStocks
      .filter(s => s.stockType === 'Stock' && s.swingHoldRatio && s.budget)
      .reduce((sum, stock) => {
        const swingRatio = stock.swingHoldRatio ? stock.swingHoldRatio / 100 : 0;
        return sum + (stock.budget || 0) * swingRatio;
      }, 0);
    
    const etfSwingInvestment = usStocks
      .filter(s => s.stockType === 'ETF' && s.swingHoldRatio && s.budget)
      .reduce((sum, stock) => {
        const swingRatio = stock.swingHoldRatio ? stock.swingHoldRatio / 100 : 0;
        return sum + (stock.budget || 0) * swingRatio;
      }, 0);
    
    const totalSwingInvestment = stockSwingInvestment + etfSwingInvestment;
    
    const stockHoldInvestment = usStocks
      .filter(s => s.stockType === 'Stock' && s.swingHoldRatio && s.budget)
      .reduce((sum, stock) => {
        const holdRatio = stock.swingHoldRatio ? (100 - stock.swingHoldRatio) / 100 : 1;
        return sum + (stock.budget || 0) * holdRatio;
      }, 0);
    
    const etfHoldInvestment = usStocks
      .filter(s => s.stockType === 'ETF' && s.swingHoldRatio && s.budget)
      .reduce((sum, stock) => {
        const holdRatio = stock.swingHoldRatio ? (100 - stock.swingHoldRatio) / 100 : 1;
        return sum + (stock.budget || 0) * holdRatio;
      }, 0);
    
    const totalHoldInvestment = stockHoldInvestment + etfHoldInvestment;
    
    const stockTotalInvestment = usStocks
      .filter(s => s.stockType === 'Stock' && s.budget)
      .reduce((sum, stock) => sum + (stock.budget || 0), 0);
    
    const etfTotalInvestment = usStocks
      .filter(s => s.stockType === 'ETF' && s.budget)
      .reduce((sum, stock) => sum + (stock.budget || 0), 0);
    
    const totalInvestment = stockTotalInvestment + etfTotalInvestment;
    
    // Calculate percentages
    const stockSwingPct = totalSwingInvestment > 0 ? Math.round((stockSwingInvestment / totalSwingInvestment) * 100) : 0;
    const etfSwingPct = totalSwingInvestment > 0 ? Math.round((etfSwingInvestment / totalSwingInvestment) * 100) : 0;
    
    const stockHoldPct = totalHoldInvestment > 0 ? Math.round((stockHoldInvestment / totalHoldInvestment) * 100) : 0;
    const etfHoldPct = totalHoldInvestment > 0 ? Math.round((etfHoldInvestment / totalHoldInvestment) * 100) : 0;
    
    const stockTotalPct = totalInvestment > 0 ? Math.round((stockTotalInvestment / totalInvestment) * 100) : 0;
    const etfTotalPct = totalInvestment > 0 ? Math.round((etfTotalInvestment / totalInvestment) * 100) : 0;
    
    return {
      counts: {
        stock: stockCount,
        etf: etfCount,
        total: totalCount,
      },
      swingInvestment: {
        stock: { value: stockSwingInvestment, pct: stockSwingPct },
        etf: { value: etfSwingInvestment, pct: etfSwingPct },
        total: { value: totalSwingInvestment, pct: 100 }
      },
      holdInvestment: {
        stock: { value: stockHoldInvestment, pct: stockHoldPct },
        etf: { value: etfHoldInvestment, pct: etfHoldPct },
        total: { value: totalHoldInvestment, pct: 100 }
      },
      totalInvestment: {
        stock: { value: stockTotalInvestment, pct: stockTotalPct },
        etf: { value: etfTotalInvestment, pct: etfTotalPct },
        total: { value: totalInvestment, pct: 100 }
      }
    };
  }, [portfolioStocksData]);

  // Calculate EU region investment statistics
  const euRegionStats = useMemo(() => {
    // Filter for only EU region stocks
    const euStocks = portfolioStocksData.filter(stock => stock.region === 'EU');
    
    // Count EU stocks by type 
    const stockCount = euStocks.filter(s => s.stockType === 'Stock').length;
    const etfCount = euStocks.filter(s => s.stockType === 'ETF').length;
    const totalCount = stockCount + etfCount;
    
    // Sum up investment amounts
    const stockSwingInvestment = euStocks
      .filter(s => s.stockType === 'Stock' && s.swingHoldRatio && s.budget)
      .reduce((sum, stock) => {
        const swingRatio = stock.swingHoldRatio ? stock.swingHoldRatio / 100 : 0;
        return sum + (stock.budget || 0) * swingRatio;
      }, 0);
    
    const etfSwingInvestment = euStocks
      .filter(s => s.stockType === 'ETF' && s.swingHoldRatio && s.budget)
      .reduce((sum, stock) => {
        const swingRatio = stock.swingHoldRatio ? stock.swingHoldRatio / 100 : 0;
        return sum + (stock.budget || 0) * swingRatio;
      }, 0);
    
    const totalSwingInvestment = stockSwingInvestment + etfSwingInvestment;
    
    const stockHoldInvestment = euStocks
      .filter(s => s.stockType === 'Stock' && s.swingHoldRatio && s.budget)
      .reduce((sum, stock) => {
        const holdRatio = stock.swingHoldRatio ? (100 - stock.swingHoldRatio) / 100 : 1;
        return sum + (stock.budget || 0) * holdRatio;
      }, 0);
    
    const etfHoldInvestment = euStocks
      .filter(s => s.stockType === 'ETF' && s.swingHoldRatio && s.budget)
      .reduce((sum, stock) => {
        const holdRatio = stock.swingHoldRatio ? (100 - stock.swingHoldRatio) / 100 : 1;
        return sum + (stock.budget || 0) * holdRatio;
      }, 0);
    
    const totalHoldInvestment = stockHoldInvestment + etfHoldInvestment;
    
    const stockTotalInvestment = euStocks
      .filter(s => s.stockType === 'Stock' && s.budget)
      .reduce((sum, stock) => sum + (stock.budget || 0), 0);
    
    const etfTotalInvestment = euStocks
      .filter(s => s.stockType === 'ETF' && s.budget)
      .reduce((sum, stock) => sum + (stock.budget || 0), 0);
    
    const totalInvestment = stockTotalInvestment + etfTotalInvestment;
    
    // Calculate percentages
    const stockSwingPct = totalSwingInvestment > 0 ? Math.round((stockSwingInvestment / totalSwingInvestment) * 100) : 0;
    const etfSwingPct = totalSwingInvestment > 0 ? Math.round((etfSwingInvestment / totalSwingInvestment) * 100) : 0;
    
    const stockHoldPct = totalHoldInvestment > 0 ? Math.round((stockHoldInvestment / totalHoldInvestment) * 100) : 0;
    const etfHoldPct = totalHoldInvestment > 0 ? Math.round((etfHoldInvestment / totalHoldInvestment) * 100) : 0;
    
    const stockTotalPct = totalInvestment > 0 ? Math.round((stockTotalInvestment / totalInvestment) * 100) : 0;
    const etfTotalPct = totalInvestment > 0 ? Math.round((etfTotalInvestment / totalInvestment) * 100) : 0;
    
    return {
      counts: {
        stock: stockCount,
        etf: etfCount,
        total: totalCount,
      },
      swingInvestment: {
        stock: { value: stockSwingInvestment, pct: stockSwingPct },
        etf: { value: etfSwingInvestment, pct: etfSwingPct },
        total: { value: totalSwingInvestment, pct: 100 }
      },
      holdInvestment: {
        stock: { value: stockHoldInvestment, pct: stockHoldPct },
        etf: { value: etfHoldInvestment, pct: etfHoldPct },
        total: { value: totalHoldInvestment, pct: 100 }
      },
      totalInvestment: {
        stock: { value: stockTotalInvestment, pct: stockTotalPct },
        etf: { value: etfTotalInvestment, pct: etfTotalPct },
        total: { value: totalInvestment, pct: 100 }
      }
    };
  }, [portfolioStocksData]);

  // Calculate APAC region investment statistics
  const apacRegionStats = useMemo(() => {
    // Filter for only APAC region stocks
    const apacStocks = portfolioStocksData.filter(stock => stock.region === 'APAC');
    
    // Count APAC stocks by type 
    const stockCount = apacStocks.filter(s => s.stockType === 'Stock').length;
    const etfCount = apacStocks.filter(s => s.stockType === 'ETF').length;
    const totalCount = stockCount + etfCount;
    
    // Sum up investment amounts
    const stockSwingInvestment = apacStocks
      .filter(s => s.stockType === 'Stock' && s.swingHoldRatio && s.budget)
      .reduce((sum, stock) => {
        const swingRatio = stock.swingHoldRatio ? stock.swingHoldRatio / 100 : 0;
        return sum + (stock.budget || 0) * swingRatio;
      }, 0);
    
    const etfSwingInvestment = apacStocks
      .filter(s => s.stockType === 'ETF' && s.swingHoldRatio && s.budget)
      .reduce((sum, stock) => {
        const swingRatio = stock.swingHoldRatio ? stock.swingHoldRatio / 100 : 0;
        return sum + (stock.budget || 0) * swingRatio;
      }, 0);
    
    const totalSwingInvestment = stockSwingInvestment + etfSwingInvestment;
    
    const stockHoldInvestment = apacStocks
      .filter(s => s.stockType === 'Stock' && s.swingHoldRatio && s.budget)
      .reduce((sum, stock) => {
        const holdRatio = stock.swingHoldRatio ? (100 - stock.swingHoldRatio) / 100 : 1;
        return sum + (stock.budget || 0) * holdRatio;
      }, 0);
    
    const etfHoldInvestment = apacStocks
      .filter(s => s.stockType === 'ETF' && s.swingHoldRatio && s.budget)
      .reduce((sum, stock) => {
        const holdRatio = stock.swingHoldRatio ? (100 - stock.swingHoldRatio) / 100 : 1;
        return sum + (stock.budget || 0) * holdRatio;
      }, 0);
    
    const totalHoldInvestment = stockHoldInvestment + etfHoldInvestment;
    
    const stockTotalInvestment = apacStocks
      .filter(s => s.stockType === 'Stock' && s.budget)
      .reduce((sum, stock) => sum + (stock.budget || 0), 0);
    
    const etfTotalInvestment = apacStocks
      .filter(s => s.stockType === 'ETF' && s.budget)
      .reduce((sum, stock) => sum + (stock.budget || 0), 0);
    
    const totalInvestment = stockTotalInvestment + etfTotalInvestment;
    
    // Calculate percentages
    const stockSwingPct = totalSwingInvestment > 0 ? Math.round((stockSwingInvestment / totalSwingInvestment) * 100) : 0;
    const etfSwingPct = totalSwingInvestment > 0 ? Math.round((etfSwingInvestment / totalSwingInvestment) * 100) : 0;
    
    const stockHoldPct = totalHoldInvestment > 0 ? Math.round((stockHoldInvestment / totalHoldInvestment) * 100) : 0;
    const etfHoldPct = totalHoldInvestment > 0 ? Math.round((etfHoldInvestment / totalHoldInvestment) * 100) : 0;
    
    const stockTotalPct = totalInvestment > 0 ? Math.round((stockTotalInvestment / totalInvestment) * 100) : 0;
    const etfTotalPct = totalInvestment > 0 ? Math.round((etfTotalInvestment / totalInvestment) * 100) : 0;
    
    return {
      counts: {
        stock: stockCount,
        etf: etfCount,
        total: totalCount,
      },
      swingInvestment: {
        stock: { value: stockSwingInvestment, pct: stockSwingPct },
        etf: { value: etfSwingInvestment, pct: etfSwingPct },
        total: { value: totalSwingInvestment, pct: 100 }
      },
      holdInvestment: {
        stock: { value: stockHoldInvestment, pct: stockHoldPct },
        etf: { value: etfHoldInvestment, pct: etfHoldPct },
        total: { value: totalHoldInvestment, pct: 100 }
      },
      totalInvestment: {
        stock: { value: stockTotalInvestment, pct: stockTotalPct },
        etf: { value: etfTotalInvestment, pct: etfTotalPct },
        total: { value: totalInvestment, pct: 100 }
      }
    };
  }, [portfolioStocksData]);

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
          <div style={{ padding: '15px', borderTop: '1px solid #444', fontSize: '0.8em' }}>            
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>              
              {/* Region Distribution - Text only */}    
              <div style={{ borderRight: '1px solid #444', marginRight: '5px', paddingRight: '5px' }}>
                <p style={{ fontWeight: 'bold', fontSize: '1.1em', marginBottom: '5px' }}>By Region</p>
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

              {/* Stock Type Distribution - Text only */}
              <div>
                <p style={{ fontWeight: 'bold', fontSize: '1.1em', marginBottom: '5px' }}>By Type</p>
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
            
            {/* US Region Statistics Table */}
            <div style={{ marginTop: '20px', marginBottom: '20px' }}>
              <p style={{ fontWeight: 'bold', fontSize: '1.1em', marginBottom: '10px' }}>US Region Statistics</p>
              <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #444' }}>
                {/* Table Header */}
                <thead>
                  <tr style={{ borderBottom: '1px solid #444', background: '#1e1e1e' }}>
                    <th style={{ padding: '8px', textAlign: 'center', width: '25%' }}>US</th>
                    <th style={{ padding: '8px', textAlign: 'center', width: '25%', borderLeft: '1px solid #444', fontSize: '0.9em' }}>Stock</th>
                    <th style={{ padding: '8px', textAlign: 'center', width: '25%', borderLeft: '1px solid #444', fontSize: '0.9em' }}>ETF</th>
                    <th style={{ padding: '8px', textAlign: 'center', width: '25%', borderLeft: '1px solid #444', fontSize: '0.9em' }}>Total</th>
                  </tr>
                </thead>
                
                {/* Table Body */}
                <tbody>
                  {/* Count of stocks row */}
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
                  
                  {/* Swing Investment row */}
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
                  
                  {/* Hold Investment row */}
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
                  
                  {/* Total Investment row */}
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
            </div>

            {/* EU Region Statistics Table */}
            <div style={{ marginTop: '20px', marginBottom: '20px' }}>
              <p style={{ fontWeight: 'bold', fontSize: '1.1em', marginBottom: '10px' }}>EU Region Statistics</p>
              <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #444' }}>
                {/* Table Header */}
                <thead>
                  <tr style={{ borderBottom: '1px solid #444', background: '#1e1e1e' }}>
                    <th style={{ padding: '8px', textAlign: 'center', width: '25%' }}>EU</th>
                    <th style={{ padding: '8px', textAlign: 'center', width: '25%', borderLeft: '1px solid #444', fontSize: '0.9em' }}>Stock</th>
                    <th style={{ padding: '8px', textAlign: 'center', width: '25%', borderLeft: '1px solid #444', fontSize: '0.9em' }}>ETF</th>
                    <th style={{ padding: '8px', textAlign: 'center', width: '25%', borderLeft: '1px solid #444', fontSize: '0.9em' }}>Total</th>
                  </tr>
                </thead>
                
                {/* Table Body */}
                <tbody>
                  {/* Count of stocks row */}
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
                  
                  {/* Swing Investment row */}
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
                  
                  {/* Hold Investment row */}
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
                  
                  {/* Total Investment row */}
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
            </div>

            {/* APAC Region Statistics Table */}
            <div style={{ marginTop: '20px' }}>
              <p style={{ fontWeight: 'bold', fontSize: '1.1em', marginBottom: '10px' }}>APAC Region Statistics</p>
              <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #444' }}>
                {/* Table Header */}
                <thead>
                  <tr style={{ borderBottom: '1px solid #444', background: '#1e1e1e' }}>
                    <th style={{ padding: '8px', textAlign: 'center', width: '25%' }}>APAC</th>
                    <th style={{ padding: '8px', textAlign: 'center', width: '25%', borderLeft: '1px solid #444', fontSize: '0.9em' }}>Stock</th>
                    <th style={{ padding: '8px', textAlign: 'center', width: '25%', borderLeft: '1px solid #444', fontSize: '0.9em' }}>ETF</th>
                    <th style={{ padding: '8px', textAlign: 'center', width: '25%', borderLeft: '1px solid #444', fontSize: '0.9em' }}>Total</th>
                  </tr>
                </thead>
                
                {/* Table Body */}
                <tbody>
                  {/* Count of stocks row */}
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
                  
                  {/* Swing Investment row */}
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
                  
                  {/* Hold Investment row */}
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
                  
                  {/* Total Investment row */}
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