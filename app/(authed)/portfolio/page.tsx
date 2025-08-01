// app/(authed)/portfolio/page.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';
import { usePrices } from '@/app/contexts/PriceContext';
import { mergeTestPricesWithRealPrices } from '@/app/utils/priceUtils';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import {
  SHARE_EPSILON,
  FETCH_LIMIT_STOCKS_STANDARD
} from '@/app/config/constants';

// Import the new components
import PortfolioOverview from './components/PortfolioOverview';
import PortfolioTable from './components/PortfolioTable';
import AddStockModal from './components/PortfolioAddStockModal';
import EditStockModal from './components/PortfolioEditStockModal';

// Import types from the types file
import type {
  PortfolioStockDataType,
  StockWalletDataType,
  PortfolioStockUpdateInput,
  SortableStockKey,
  StockSortConfig,
  PortfolioColumnVisibilityState,
} from './types';

// Register Chart.js components and plugins
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, ChartDataLabels);

const client = generateClient<Schema>();

// Create a wrapper component that safely uses the context
function PortfolioContent() {
  // --- STATE using PortfolioStockDataType[] ---
  const [portfolioStocksData, setPortfolioStocksData] = useState<PortfolioStockDataType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // --- State for sorting ---
  const [stockSortConfig, setStockSortConfig] = useState<StockSortConfig | null>(null);

  // Sort request handler
  const requestStockSort = (key: SortableStockKey) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (stockSortConfig && stockSortConfig.key === key && stockSortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setStockSortConfig({ key, direction });
  };

  // --- State for editing and modal ---
  const [isAddModalOpen, setIsAddModalOpen] = useState(false); // For Add Stock modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false); // For Edit Stock modal
  const [editingStockId, setEditingStockId] = useState<string | null>(null);
  const [stockToEditData, setStockToEditData] = useState<PortfolioStockDataType | null>(null);
  const [isOverviewExpanded, setIsOverviewExpanded] = useState(false); // For collapsible overview

  // Inside your component function - this will now work because we're in a client component under the provider
  const { latestPrices, pricesLoading } = usePrices();

  // Create merged prices that include test price overrides
  const mergedPrices = useMemo(() => {
    return mergeTestPricesWithRealPrices(latestPrices, portfolioStocksData);
  }, [latestPrices, portfolioStocksData]);

  // State to manage showing/hiding archived stocks
  const [showArchived, setShowArchived] = useState(false);

  // --- State for column visibility ---
  const [columnVisibility, setColumnVisibility] = useState<PortfolioColumnVisibilityState>({
    name: false,
    stockType: false,
    region: false,
    stockTrend: false,
    currentPrice: false,
    pdp: true,
    htp: true,
    plr: true,
    stockCommission: true,
    budget: false,
    investment: true,
    riskInvestment: true,
  });

  // Calculate visible column count
  const visibleColumnCount = useMemo(() => {
    return Object.values(columnVisibility).filter(Boolean).length + 2; // +2 for symbol and actions columns
  }, [columnVisibility]);

  // Create separate filtered arrays for active and archived stocks
  const activeStocks = useMemo(() => {
    // console.log("Calculating activeStocks. Input length:", portfolioStocksData.length);
    const filtered = portfolioStocksData.filter(stock => !stock.archived);
    // console.log("ActiveStocks count:", filtered.length);
    return filtered;
  }, [portfolioStocksData]);

  const archivedStocks = useMemo(() => {
    // console.log("Calculating archivedStocks. Input length:", portfolioStocksData.length);
    const filtered = portfolioStocksData.filter(stock => stock.archived);
    // console.log("ArchivedStocks count:", filtered.length);
    return filtered;
  }, [portfolioStocksData]);

  // Create a visibleStocks array that includes ALL stocks (including hidden) for overview calculations
  // Hidden stocks should now show up in reports per new requirements
  const visibleStocks = useMemo(() => {
    // console.log("Recalculating visibleStocks. Input length:", activeStocks.length);
    const filtered = activeStocks; // No longer filtering out hidden stocks for overview calculations
    // console.log("VisibleStocks count:", filtered.length);
    return filtered;
  }, [activeStocks]); // Depends on activeStocks instead of portfolioStocksData

  // State to hold all stock wallets for investment calculation
  const [allWallets, setAllWallets] = useState<StockWalletDataType[]>([]);

  // Fetch all wallets separately for investment calculation
  const fetchWallets = useCallback(async () => {
    try {
      const { data, errors } = await client.models.StockWallet.list({
        limit: FETCH_LIMIT_STOCKS_STANDARD,
        selectionSet: ['id', 'portfolioStockId', 'remainingShares', 'buyPrice', 'totalInvestment', 'totalSharesQty', 'tpValue'],
      });
      if (!errors && data) {
        setAllWallets(data as StockWalletDataType[]);
      }
    } catch (err) {
      console.warn('Failed to fetch wallets for investment calculation:', err);
    }
  }, []);

  // Compute total invested amount per stock by summing remainingShares × buyPrice for all wallets
  const stockInvestments = useMemo(() => {
    const invMap: Record<string, number> = {};
    
    // Group wallets by stock ID and calculate investment
    allWallets.forEach(wallet => {
      if (wallet.portfolioStockId) {
        const investment = (wallet.remainingShares ?? 0) * (wallet.buyPrice ?? 0);
        invMap[wallet.portfolioStockId] = (invMap[wallet.portfolioStockId] ?? 0) + investment;
      }
    });
    
    return invMap;
  }, [allWallets]);

  // Compute risk investment per stock (investment in wallets where TP hasn't been met)
  const stockRiskInvestments = useMemo(() => {
    const riskMap: Record<string, number> = {};
    const totalInvestmentMap: Record<string, number> = {};
    
    // First, calculate total investment per stock
    allWallets.forEach(wallet => {
      if (wallet.portfolioStockId) {
        const stockId = wallet.portfolioStockId;
        const remainingShares = wallet.remainingShares ?? 0;
        
        // Skip if no remaining shares
        if (remainingShares <= 0.000001) { // Using SHARE_EPSILON equivalent
          return;
        }
        
        // Calculate tied-up investment for this wallet
        const totalInvestment = wallet.totalInvestment ?? 0;
        const totalShares = wallet.totalSharesQty ?? 0;
        const investmentPerShare = (totalShares > 0.000001) ? (totalInvestment / totalShares) : 0;
        const tiedUpInvestment = investmentPerShare * remainingShares;
        
        totalInvestmentMap[stockId] = (totalInvestmentMap[stockId] ?? 0) + tiedUpInvestment;
      }
    });
    
    // Then, calculate investment with met TP per stock
    allWallets.forEach(wallet => {
      if (wallet.portfolioStockId) {
        const stockId = wallet.portfolioStockId;
        const remainingShares = wallet.remainingShares ?? 0;
        const tp = wallet.tpValue;
        
        // Skip if no remaining shares
        if (remainingShares <= 0.000001) {
          return;
        }
        
        // Get current price from mergedPrices (includes test price)
        const stockSymbol = activeStocks.find(s => s.id === stockId)?.symbol || 
                           archivedStocks.find(s => s.id === stockId)?.symbol;
        const currentPrice = mergedPrices[stockSymbol || '']?.currentPrice;
        
        // If no current price, all investment is at risk
        if (typeof currentPrice !== 'number') {
          riskMap[stockId] = totalInvestmentMap[stockId] ?? 0;
          return;
        }
        
        // If TP has been met (tp <= currentPrice), calculate investment with met TP
        if (typeof tp === 'number' && tp <= currentPrice) {
          const totalInvestment = wallet.totalInvestment ?? 0;
          const totalShares = wallet.totalSharesQty ?? 0;
          const investmentPerShare = (totalShares > 0.000001) ? (totalInvestment / totalShares) : 0;
          const investmentWithMetTP = investmentPerShare * remainingShares;
          
          riskMap[stockId] = (riskMap[stockId] ?? 0) - investmentWithMetTP;
        }
      }
    });
    
    // Final calculation: riskInvestment = totalInvestment - investmentWithMetTP
    Object.keys(totalInvestmentMap).forEach(stockId => {
      if (!(stockId in riskMap)) {
        riskMap[stockId] = totalInvestmentMap[stockId];
      } else {
        riskMap[stockId] = totalInvestmentMap[stockId] + riskMap[stockId];
      }
    });
    
    return riskMap;
  }, [allWallets, activeStocks, archivedStocks, mergedPrices]);

  // Sorted stocks for the table display
  const sortedStocks = useMemo(() => {
    // Use either active or archived stocks based on current display mode
    const stocksToSort = showArchived ? archivedStocks : activeStocks;
    const sortableItems = [...stocksToSort];

    if (stockSortConfig !== null) {
      sortableItems.sort((a, b) => {
        const handleNulls = (val: unknown) => {
          if (val === null || val === undefined) {
            return stockSortConfig.direction === 'ascending' ? Infinity : -Infinity;
          }
          return val;
        };

        let valA: unknown;
        let valB: unknown;

        // Get values based on sort key
        switch (stockSortConfig.key) {
          case 'symbol':
            valA = a.symbol?.toLowerCase() ?? '';
            valB = b.symbol?.toLowerCase() ?? '';
            break;
          case 'name':
            valA = a.name?.toLowerCase() ?? '';
            valB = b.name?.toLowerCase() ?? '';
            break;
          case 'stockType':
            valA = a.stockType?.toLowerCase() ?? '';
            valB = b.stockType?.toLowerCase() ?? '';
            break;
          case 'region':
            valA = a.region?.toLowerCase() ?? '';
            valB = b.region?.toLowerCase() ?? '';
            break;
          case 'stockTrend':
            valA = a.stockTrend?.toLowerCase() ?? '';
            valB = b.stockTrend?.toLowerCase() ?? '';
            break;
          case 'currentPrice':
            valA = mergedPrices[a.symbol ?? '']?.currentPrice ?? null;
            valB = mergedPrices[b.symbol ?? '']?.currentPrice ?? null;
            break;
          case 'pdp':
            valA = a.pdp;
            valB = b.pdp;
            break;
          case 'htp':
            valA = a.htp;
            valB = b.htp;
            break;
          case 'plr':
            valA = a.plr;
            valB = b.plr;
            break;
          case 'stockCommission':
            valA = a.stockCommission;
            valB = b.stockCommission;
            break;
          case 'budget':
            valA = a.budget;
            valB = b.budget;
            break;
          case 'investment':
            valA = stockInvestments[a.id] ?? null;
            valB = stockInvestments[b.id] ?? null;
            break;
          case 'riskInvestment':
            valA = stockRiskInvestments[a.id] ?? null;
            valB = stockRiskInvestments[b.id] ?? null;
            break;
          default:
            valA = '';
            valB = '';
        }

        const resolvedA = handleNulls(valA);
        const resolvedB = handleNulls(valB);

        let comparison = 0;

        if (typeof resolvedA === 'string' && typeof resolvedB === 'string') {
          comparison = resolvedA.localeCompare(resolvedB);
        } else if (typeof resolvedA === 'number' && typeof resolvedB === 'number') {
          comparison = resolvedA - resolvedB;
        } else {
          if (resolvedA < resolvedB) comparison = -1;
          else if (resolvedA > resolvedB) comparison = 1;
        }

        return stockSortConfig.direction === 'ascending' ? comparison : comparison * -1;
      });
    } else {
      // Default sort by symbol
      sortableItems.sort((a, b) => (a.symbol ?? '').localeCompare(b.symbol ?? ''));
    }

    return sortableItems;
  }, [activeStocks, archivedStocks, showArchived, stockSortConfig, mergedPrices, stockInvestments, stockRiskInvestments]);

  // Fetch Portfolio Function
  const fetchPortfolio = useCallback(async () => {
    setIsLoading(true); // Set loading at the start
    setError(null);

    try {
      // --- Fetch Portfolio Stocks ONCE ---
      // console.log("Fetching portfolio stocks...");
      const { data, errors } = await client.models.PortfolioStock.list({
        selectionSet: [
          'id',
          'symbol',
          'name',
          'region',
          'stockType',
          'stockTrend',
          'budget',
          'testPrice',
          'pdp',
          'plr',
          'isHidden',
          'archived',
          'archivedAt',
          'swingHoldRatio',
          'stockCommission',
          'htp'
        ]
      });

      if (errors) {
          console.error("Error fetching portfolio:", errors);
          throw errors; // Throw error to be caught below
      }

      // Set state with the fetched data (which includes testPrice)
      setPortfolioStocksData(data as PortfolioStockDataType[]);
      // console.log('Fetched portfolio count:', data.length);

      // Also fetch wallets for investment calculation
      fetchWallets();

    } catch (err: unknown) {
      console.error("Error fetching portfolio:", err);
      const errorMessage = Array.isArray((err as { errors?: Array<{ message: string }> })?.errors) 
        ? (err as { errors: Array<{ message: string }> }).errors[0].message 
        : ((err as Error)?.message || "An unexpected error occurred fetching portfolio.");
      setError(errorMessage);
      setPortfolioStocksData([]); // Clear data on error
    } finally {
      setIsLoading(false); // Set loading false when done (success or error)
    }
  }, [fetchWallets]);
  
  // Keep your useEffect to call fetchPortfolio
  useEffect(() => { fetchPortfolio(); }, [fetchPortfolio]);

  // Delete Handler (uses ID directly) - Currently unused but kept for future use
  // const handleDeleteStock = async (idToDelete: string) => {
  //   if (!window.confirm('Are you sure?')) return;
  //   setError(null);
  //   try {
  //     await client.models.PortfolioStock.delete({ id: idToDelete });
  //     console.log('Stock deleted!');
  //     fetchPortfolio(); // Refresh list
  //   } catch {
  //     /* ... error handling ... */
  //   }
  // };

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

    } catch (err: unknown) {
      console.error('Error updating stock:', err);
      const message = Array.isArray(err) 
        ? (err as Array<{ message: string }>)[0].message 
        : (err as Error).message;
      setError(message || 'Failed to update stock.');
    }
  };

  const handleToggleHidden = async (stock: PortfolioStockDataType) => {
    const newHiddenState = !stock.isHidden; // Calculate the new state
    // Updated confirmation message with specific details about what happens
    const confirmMessage = newHiddenState 
      ? `This action will hide ${stock.symbol} from the Signals table and stop fetching the latest price.`
      : `This action will show ${stock.symbol} in the Signals table and start fetching the latest price.`;
    
    if (!window.confirm(confirmMessage)) {
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
    } catch (err: unknown) {
        console.error('Unexpected error updating stock hidden status:', err);
        setError((err as Error).message || 'An error occurred during update.');
    }  };

  // Archive Handler
  const handleArchiveStock = async (stock: PortfolioStockDataType) => {
    const isArchiving = !stock.archived;
    const action = isArchiving ? 'archive' : 'restore';
    
    // Custom confirmation messages based on action
    const confirmMessage = isArchiving 
      ? `This action will hide ${stock.symbol?.toUpperCase()} from everywhere (reporting and UI). To see it again, click "Show Archived" button and restore it.`
      : `This action will restore ${stock.symbol?.toUpperCase()} and it will be reincluded in the reporting and UI.`;
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    console.log(`Attempting to ${action} stock: ${stock.id}`);
    setError(null);

    try {
      const updateData = {
        id: stock.id,
        archived: isArchiving,
        archivedAt: isArchiving ? new Date().toISOString() : null,
      };

      // TODO: In a full implementation, we should also archive related transactions and wallets
      // For now, we'll just archive the stock itself
      
      const { data: updatedStock, errors } = await client.models.PortfolioStock.update(updateData);

      if (errors) {
        console.error(`Error ${action}ing stock:`, errors);
        setError(errors[0]?.message || `Failed to ${action} stock.`);
      } else {
        console.log(`Stock ${action}d successfully:`, updatedStock);
        fetchPortfolio(); // Refresh the list
      }
    } catch (err: unknown) {
      console.error(`Unexpected error ${action}ing stock:`, err);
      setError((err as Error).message || `An error occurred during ${action}.`);
    }
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
  
  // Calculate detailed breakdown by region and stock type - Currently unused but kept for future use
  // const detailedDistribution = useMemo(() => {
  //   // Create a structure to hold counts for each region and stock type
  //   const distribution: Record<string, Record<string, number>> = {
  //     US: { Stock: 0, ETF: 0, Crypto: 0 },
  //     Intl: { Stock: 0, ETF: 0, Crypto: 0 },
  //     APAC: { Stock: 0, ETF: 0, Crypto: 0 },
  //     EU: { Stock: 0, ETF: 0, Crypto: 0 }
  //   };

  //   // Count stocks by region and type
  //   portfolioStocksData.forEach(stock => {
  //     if (stock.region && stock.stockType) {
  //       const region = stock.region as keyof typeof distribution;
  //       const stockType = stock.stockType as keyof typeof distribution.US;
        
  //       if (distribution[region] && distribution[region][stockType] !== undefined) {
  //         distribution[region][stockType]++;
  //       }
  //     }
  //   });

  //   return distribution;
  // }, [portfolioStocksData]);

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
  
  // Get region colors for the stacked bar chart - Currently unused but kept for future use
  // const regionColors = {
  //   US: 'rgba(54, 162, 235, 0.7)',    // Blue
  //   Intl: 'rgba(255, 159, 64, 0.7)',  // Orange
  //   EU: 'rgba(75, 192, 192, 0.7)',    // Green
  //   APAC: 'rgba(255, 99, 132, 0.7)'   // Red
  // };

  // Get colors for stock types within each bar - Currently unused but kept for future use  
  // const stockTypeColors = {
  //   Stock: 'rgba(54, 162, 235, 0.9)',  // Darker blue
  //   ETF: 'rgba(255, 205, 86, 0.9)',    // Yellow
  //   Crypto: 'rgba(153, 102, 255, 0.9)' // Purple
  // };

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
  // --- Corrected US Region Stats Calculation ---
  const usRegionStats = useMemo(() => {
    // console.log("[Memo] Calculating usRegionStats");
    // Use visibleStocks to exclude hidden ones
    const usStocks = visibleStocks.filter(stock => stock.region === 'US');

    let stockCount = 0;
    let etfCount = 0;
    let stockSwingInvestment = 0;
    let etfSwingInvestment = 0;
    let stockHoldInvestment = 0;
    let etfHoldInvestment = 0;

    usStocks.forEach(stock => {
        // Increment counts
        if (stock.stockType === 'Stock') stockCount++;
        else if (stock.stockType === 'ETF') etfCount++;

        // Safely access wallets, default to empty array if null/undefined
        const wallets = (stock.stockWallets as unknown as StockWalletDataType[] ?? []); // Use correct type

        wallets.forEach(wallet => {
            // Check for remaining shares and valid buy price
            if ((wallet.remainingShares ?? 0) > SHARE_EPSILON && typeof wallet.buyPrice === 'number') {
                // Calculate tied-up investment for this wallet
                const tiedUpInvestment = wallet.buyPrice * wallet.remainingShares!;

                // Add to the correct bucket based on stockType and walletType
                if (stock.stockType === 'Stock') {
                    if (wallet.walletType === 'Swing') {
                        stockSwingInvestment += tiedUpInvestment;
                    } else if (wallet.walletType === 'Hold') {
                        stockHoldInvestment += tiedUpInvestment;
                    }
                } else if (stock.stockType === 'ETF') {
                     if (wallet.walletType === 'Swing') {
                        etfSwingInvestment += tiedUpInvestment;
                    } else if (wallet.walletType === 'Hold') {
                        etfHoldInvestment += tiedUpInvestment;
                    }
                }
            }
        });
    });

    const totalCount = stockCount + etfCount;
    const totalSwingInvestment = stockSwingInvestment + etfSwingInvestment;
    const totalHoldInvestment = stockHoldInvestment + etfHoldInvestment;
    const stockTotalInvestment = stockSwingInvestment + stockHoldInvestment;
    const etfTotalInvestment = etfSwingInvestment + etfHoldInvestment;
    const totalInvestment = totalSwingInvestment + totalHoldInvestment; // Total tied-up

    // Calculate percentages based on the new investment totals
    const stockSwingPct = totalSwingInvestment > SHARE_EPSILON ? Math.round((stockSwingInvestment / totalSwingInvestment) * 100) : 0;
    const etfSwingPct = totalSwingInvestment > SHARE_EPSILON ? Math.round((etfSwingInvestment / totalSwingInvestment) * 100) : 0;

    const stockHoldPct = totalHoldInvestment > SHARE_EPSILON ? Math.round((stockHoldInvestment / totalHoldInvestment) * 100) : 0;
    const etfHoldPct = totalHoldInvestment > SHARE_EPSILON ? Math.round((etfHoldInvestment / totalHoldInvestment) * 100) : 0;

    const stockTotalPct = totalInvestment > SHARE_EPSILON ? Math.round((stockTotalInvestment / totalInvestment) * 100) : 0;
    const etfTotalPct = totalInvestment > SHARE_EPSILON ? Math.round((etfTotalInvestment / totalInvestment) * 100) : 0;

    // console.log("[Memo] usRegionStats Result:", { counts: {stockCount, etfCount, totalCount }, /* ... other stats */ });

    return {
      counts: { stock: stockCount, etf: etfCount, total: totalCount },
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
    // Depend on visibleStocks now
  }, [visibleStocks]);
  // --- End Corrected US Region Stats ---

  // Calculate EU region investment statistics
  const euRegionStats = useMemo(() => {
    // console.log("[Memo] Calculating euRegionStats");
    // Use visibleStocks to exclude hidden ones
    const euStocks = visibleStocks.filter(stock => stock.region === 'EU');

    let stockCount = 0;
    let etfCount = 0;
    let stockSwingInvestment = 0;
    let etfSwingInvestment = 0;
    let stockHoldInvestment = 0;
    let etfHoldInvestment = 0;

    euStocks.forEach(stock => {
        // Increment counts
        if (stock.stockType === 'Stock') stockCount++;
        else if (stock.stockType === 'ETF') etfCount++;

        // Safely access wallets, default to empty array if null/undefined
        const wallets = (stock.stockWallets as unknown as StockWalletDataType[] ?? []); // Use correct type

        wallets.forEach(wallet => {
            // Check for remaining shares and valid buy price
            if ((wallet.remainingShares ?? 0) > SHARE_EPSILON && typeof wallet.buyPrice === 'number') {
                // Calculate tied-up investment for this wallet
                const tiedUpInvestment = wallet.buyPrice * wallet.remainingShares!;

                // Add to the correct bucket based on stockType and walletType
                if (stock.stockType === 'Stock') {
                    if (wallet.walletType === 'Swing') {
                        stockSwingInvestment += tiedUpInvestment;
                    } else if (wallet.walletType === 'Hold') {
                        stockHoldInvestment += tiedUpInvestment;
                    }
                } else if (stock.stockType === 'ETF') {
                     if (wallet.walletType === 'Swing') {
                        etfSwingInvestment += tiedUpInvestment;
                    } else if (wallet.walletType === 'Hold') {
                        etfHoldInvestment += tiedUpInvestment;
                    }
                }
            }
        });
    });

    const totalCount = stockCount + etfCount;
    const totalSwingInvestment = stockSwingInvestment + etfSwingInvestment;
    const totalHoldInvestment = stockHoldInvestment + etfHoldInvestment;
    const stockTotalInvestment = stockSwingInvestment + stockHoldInvestment;
    const etfTotalInvestment = etfSwingInvestment + etfHoldInvestment;
    const totalInvestment = totalSwingInvestment + totalHoldInvestment; // Total tied-up

    // Calculate percentages based on the new investment totals
    const stockSwingPct = totalSwingInvestment > SHARE_EPSILON ? Math.round((stockSwingInvestment / totalSwingInvestment) * 100) : 0;
    const etfSwingPct = totalSwingInvestment > SHARE_EPSILON ? Math.round((etfSwingInvestment / totalSwingInvestment) * 100) : 0;

    const stockHoldPct = totalHoldInvestment > SHARE_EPSILON ? Math.round((stockHoldInvestment / totalHoldInvestment) * 100) : 0;
    const etfHoldPct = totalHoldInvestment > SHARE_EPSILON ? Math.round((etfHoldInvestment / totalHoldInvestment) * 100) : 0;

    const stockTotalPct = totalInvestment > SHARE_EPSILON ? Math.round((stockTotalInvestment / totalInvestment) * 100) : 0;
    const etfTotalPct = totalInvestment > SHARE_EPSILON ? Math.round((etfTotalInvestment / totalInvestment) * 100) : 0;

    // console.log("[Memo] euRegionStats Result:", { counts: {stockCount, etfCount, totalCount }, /* ... other stats */ });

    return {
      counts: { stock: stockCount, etf: etfCount, total: totalCount },
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
    // Depend on visibleStocks now
  }, [visibleStocks]);

  const intlRegionStats = useMemo(() => {
    // console.log("[Memo] Calculating intlRegionStats");
    const intlStocks = visibleStocks.filter(stock => stock.region === 'Intl');

    let stockCount = 0;
    let etfCount = 0;
    let cryptoCount = 0; // <-- ADDED: Crypto count
    let stockSwingInvestment = 0;
    let etfSwingInvestment = 0;
    let cryptoSwingInvestment = 0; // <-- ADDED: Crypto swing investment
    let stockHoldInvestment = 0;
    let etfHoldInvestment = 0;
    let cryptoHoldInvestment = 0;  // <-- ADDED: Crypto hold investment

    intlStocks.forEach(stock => {
      // Increment counts including Crypto
      if (stock.stockType === 'Stock') stockCount++;
      else if (stock.stockType === 'ETF') etfCount++;
      else if (stock.stockType === 'Crypto') cryptoCount++; // <-- ADDED

      const wallets = (stock.stockWallets as unknown as StockWalletDataType[] ?? []);

      wallets.forEach(wallet => {
        if ((wallet.remainingShares ?? 0) > SHARE_EPSILON && typeof wallet.buyPrice === 'number') {
          const tiedUpInvestment = wallet.buyPrice * wallet.remainingShares!;

          // Add to the correct bucket based on stockType and walletType
          if (stock.stockType === 'Stock') {
            if (wallet.walletType === 'Swing') stockSwingInvestment += tiedUpInvestment;
            else if (wallet.walletType === 'Hold') stockHoldInvestment += tiedUpInvestment;
          } else if (stock.stockType === 'ETF') {
            if (wallet.walletType === 'Swing') etfSwingInvestment += tiedUpInvestment;
            else if (wallet.walletType === 'Hold') etfHoldInvestment += tiedUpInvestment;
          } else if (stock.stockType === 'Crypto') { // <-- ADDED Crypto case
             if (wallet.walletType === 'Swing') cryptoSwingInvestment += tiedUpInvestment;
             else if (wallet.walletType === 'Hold') cryptoHoldInvestment += tiedUpInvestment;
          }
        }
      });
    });

    // Update totals to include Crypto
    const totalCount = stockCount + etfCount + cryptoCount; // <-- ADDED
    const totalSwingInvestment = stockSwingInvestment + etfSwingInvestment + cryptoSwingInvestment; // <-- ADDED
    const totalHoldInvestment = stockHoldInvestment + etfHoldInvestment + cryptoHoldInvestment; // <-- ADDED
    const stockTotalInvestment = stockSwingInvestment + stockHoldInvestment;
    const etfTotalInvestment = etfSwingInvestment + etfHoldInvestment;
    const cryptoTotalInvestment = cryptoSwingInvestment + cryptoHoldInvestment; // <-- ADDED
    const totalInvestment = totalSwingInvestment + totalHoldInvestment; // Total tied-up

    // Calculate percentages including Crypto
    const stockSwingPct = totalSwingInvestment > SHARE_EPSILON ? Math.round((stockSwingInvestment / totalSwingInvestment) * 100) : 0;
    const etfSwingPct = totalSwingInvestment > SHARE_EPSILON ? Math.round((etfSwingInvestment / totalSwingInvestment) * 100) : 0;
    const cryptoSwingPct = totalSwingInvestment > SHARE_EPSILON ? Math.round((cryptoSwingInvestment / totalSwingInvestment) * 100) : 0; // <-- ADDED

    const stockHoldPct = totalHoldInvestment > SHARE_EPSILON ? Math.round((stockHoldInvestment / totalHoldInvestment) * 100) : 0;
    const etfHoldPct = totalHoldInvestment > SHARE_EPSILON ? Math.round((etfHoldInvestment / totalHoldInvestment) * 100) : 0;
    const cryptoHoldPct = totalHoldInvestment > SHARE_EPSILON ? Math.round((cryptoHoldInvestment / totalHoldInvestment) * 100) : 0; // <-- ADDED

    const stockTotalPct = totalInvestment > SHARE_EPSILON ? Math.round((stockTotalInvestment / totalInvestment) * 100) : 0;
    const etfTotalPct = totalInvestment > SHARE_EPSILON ? Math.round((etfTotalInvestment / totalInvestment) * 100) : 0;
    const cryptoTotalPct = totalInvestment > SHARE_EPSILON ? Math.round((cryptoTotalInvestment / totalInvestment) * 100) : 0; // <-- ADDED

    // console.log("[Memo] intlRegionStats Result:", { counts: {stockCount, etfCount, totalCount }, /* ... other stats */ });

    return {
      counts: { stock: stockCount, etf: etfCount, crypto: cryptoCount, total: totalCount }, // <-- ADDED
      swingInvestment: {
        stock: { value: stockSwingInvestment, pct: stockSwingPct },
        etf: { value: etfSwingInvestment, pct: etfSwingPct },
        crypto: { value: cryptoSwingInvestment, pct: cryptoSwingPct }, // <-- ADDED
        total: { value: totalSwingInvestment, pct: 100 }
      },
      holdInvestment: {
        stock: { value: stockHoldInvestment, pct: stockHoldPct },
        etf: { value: etfHoldInvestment, pct: etfHoldPct },
        crypto: { value: cryptoHoldInvestment, pct: cryptoHoldPct }, // <-- ADDED
        total: { value: totalHoldInvestment, pct: 100 }
      },
      totalInvestment: {
        stock: { value: stockTotalInvestment, pct: stockTotalPct },
        etf: { value: etfTotalInvestment, pct: etfTotalPct },
        crypto: { value: cryptoTotalInvestment, pct: cryptoTotalPct }, // <-- ADDED
        total: { value: totalInvestment, pct: 100 }
      }
    };
    // Depend on visibleStocks now
  }, [visibleStocks]);

  // Calculate APAC region investment statistics
  const apacRegionStats = useMemo(() => {
    // console.log("[Memo] Calculating apacRegionStats");
    // Use visibleStocks to exclude hidden ones
    const apacStocks = visibleStocks.filter(stock => stock.region === 'APAC');

    let stockCount = 0;
    let etfCount = 0;
    let stockSwingInvestment = 0;
    let etfSwingInvestment = 0;
    let stockHoldInvestment = 0;
    let etfHoldInvestment = 0;

    apacStocks.forEach(stock => {
        // Increment counts
        if (stock.stockType === 'Stock') stockCount++;
        else if (stock.stockType === 'ETF') etfCount++;

        // Safely access wallets, default to empty array if null/undefined
        const wallets = (stock.stockWallets as unknown as StockWalletDataType[] ?? []); // Use correct type

        wallets.forEach(wallet => {
            // Check for remaining shares and valid buy price
            if ((wallet.remainingShares ?? 0) > SHARE_EPSILON && typeof wallet.buyPrice === 'number') {
                // Calculate tied-up investment for this wallet
                const tiedUpInvestment = wallet.buyPrice * wallet.remainingShares!;

                // Add to the correct bucket based on stockType and walletType
                if (stock.stockType === 'Stock') {
                    if (wallet.walletType === 'Swing') {
                        stockSwingInvestment += tiedUpInvestment;
                    } else if (wallet.walletType === 'Hold') {
                        stockHoldInvestment += tiedUpInvestment;
                    }
                } else if (stock.stockType === 'ETF') {
                     if (wallet.walletType === 'Swing') {
                        etfSwingInvestment += tiedUpInvestment;
                    } else if (wallet.walletType === 'Hold') {
                        etfHoldInvestment += tiedUpInvestment;
                    }
                }
            }
        });
    });

    const totalCount = stockCount + etfCount;
    const totalSwingInvestment = stockSwingInvestment + etfSwingInvestment;
    const totalHoldInvestment = stockHoldInvestment + etfHoldInvestment;
    const stockTotalInvestment = stockSwingInvestment + stockHoldInvestment;
    const etfTotalInvestment = etfSwingInvestment + etfHoldInvestment;
    const totalInvestment = totalSwingInvestment + totalHoldInvestment; // Total tied-up

    // Calculate percentages based on the new investment totals
    const stockSwingPct = totalSwingInvestment > SHARE_EPSILON ? Math.round((stockSwingInvestment / totalSwingInvestment) * 100) : 0;
    const etfSwingPct = totalSwingInvestment > SHARE_EPSILON ? Math.round((etfSwingInvestment / totalSwingInvestment) * 100) : 0;

    const stockHoldPct = totalHoldInvestment > SHARE_EPSILON ? Math.round((stockHoldInvestment / totalHoldInvestment) * 100) : 0;
    const etfHoldPct = totalHoldInvestment > SHARE_EPSILON ? Math.round((etfHoldInvestment / totalHoldInvestment) * 100) : 0;

    const stockTotalPct = totalInvestment > SHARE_EPSILON ? Math.round((stockTotalInvestment / totalInvestment) * 100) : 0;
    const etfTotalPct = totalInvestment > SHARE_EPSILON ? Math.round((etfTotalInvestment / totalInvestment) * 100) : 0;

    // console.log("[Memo] apacRegionStats Result:", { counts: {stockCount, etfCount, totalCount }, /* ... other stats */ });

    return {
      counts: { stock: stockCount, etf: etfCount, total: totalCount },
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
    // Depend on visibleStocks now
  }, [visibleStocks]);
  return (
    <div>
      <h2 data-testid="portfolio-page-title">Portfolio</h2>

      {/* Portfolio Overview Section */}
      <PortfolioOverview
        isOverviewExpanded={isOverviewExpanded}
        setIsOverviewExpanded={setIsOverviewExpanded}
        regionDistribution={regionDistribution}
        stockTypeDistribution={stockTypeDistribution}
        percentages={percentages}
        stockTypePercentages={stockTypePercentages}
        usRegionStats={usRegionStats}
        euRegionStats={euRegionStats}
        intlRegionStats={intlRegionStats}
        apacRegionStats={apacRegionStats}
      />
      
      {/* Action buttons row */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginTop: '1rem' 
      }}>
        {/* Add New Stock button on the left */}
        <button 
          data-testid="portfolio-page-add-stock-button"
          onClick={openAddModal} 
          style={{
            padding: '8px 16px',
            background: '#557100',
            borderRadius: '4px',
            color: 'white',
            cursor: 'pointer',
            border: 'none'
          }}
        >
          Add New Stock
        </button>

        {/* Archive toggle button on the right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {showArchived && (
            <span style={{ color: '#666', fontSize: '0.9em', fontStyle: 'italic' }}>
              Viewing archived stocks
            </span>
          )}
          <button
            onClick={() => setShowArchived(!showArchived)}
            style={{
              padding: '8px 16px',
              backgroundColor: showArchived ? '#dc3545' : '#313131',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.9em'
            }}
            data-testid="portfolio-toggle-archived-button"
          >
            {showArchived ? 'Hide Archived' : `Show Archived (${archivedStocks.length})`}
          </button>
        </div>
      </div>

      {/* Portfolio Table */}
      <PortfolioTable
        isLoading={isLoading}
        error={error}
        sortedStocks={sortedStocks}
        stockSortConfig={stockSortConfig}
        stockInvestments={stockInvestments}
        stockRiskInvestments={stockRiskInvestments}
        latestPrices={mergedPrices}
        pricesLoading={pricesLoading}
        showArchived={showArchived}
        archivedCount={archivedStocks.length}
        columnVisibility={columnVisibility}
        setColumnVisibility={setColumnVisibility}
        visibleColumnCount={visibleColumnCount}
        requestStockSort={requestStockSort}
        handleEditClick={handleEditClick}
        handleToggleHidden={handleToggleHidden}
        handleArchiveStock={handleArchiveStock}
      />

      {/* Add Stock Modal */}
      <AddStockModal
        isOpen={isAddModalOpen}
        onStockAdded={handleAddSuccess}
        onCancel={closeAddModal}
      />

      {/* Edit Stock Modal */}
      <EditStockModal
        isOpen={isEditModalOpen}
        stockToEditData={stockToEditData}
        onUpdate={handleUpdateStock}
        onCancel={handleCancelEdit}
      />
    </div>
  );
}

// Main page component wrapped with error handling
export default function PortfolioPage() {
  // Use error boundary pattern to catch any context errors
  const [hasError, setHasError] = useState(false);

  // If there's an error with context, show a fallback UI
  if (hasError) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>Something went wrong</h2>
        <p>There was an issue loading the portfolio page.</p>
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
    return <PortfolioContent />;
  } catch (error) {
    console.error("Error in PortfolioPage:", error);
    setHasError(true);
    return null; // Will re-render with the error state
  }
}
