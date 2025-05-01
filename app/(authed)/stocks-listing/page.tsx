// app/(authed)/stocks-listing/page.tsx - Refactored with ["type"] pattern
'use client';

import React, { useState, useEffect, useCallback } from 'react'; // Added useCallback
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource'; // Adjust path if needed
import AddStockForm from '@/app/components/AddStockForm'; // Adjust path if needed
import { FaEdit, FaTrashAlt, FaEye, FaEyeSlash } from 'react-icons/fa'; // Add FaEye and FaEyeSlash here
import Link from 'next/link';
import { usePrices } from '@/app/contexts/PriceContext';

// Use the simpler data type for state
type PortfolioStockDataType = Schema["PortfolioStock"]["type"];
// Define type needed for update payload
type PortfolioStockUpdateInput = Partial<PortfolioStockDataType> & { id: string };

type PriceMap = Record<string, number | null>; // Symbol -> Price or null

const client = generateClient<Schema>();

export default function StocksListingPage() {
  // --- STATE using PortfolioStockDataType[] ---
  const [portfolioStocksData, setPortfolioStocksData] = useState<PortfolioStockDataType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- State for editing and modal ---
  const [isAddModalOpen, setIsAddModalOpen] = useState(false); // For Add Stock modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false); // For Edit Stock modal
  const [editingStockId, setEditingStockId] = useState<string | null>(null);
  const [stockToEditData, setStockToEditData] = useState<PortfolioStockDataType | null>(null);

  // Inside your component function
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

  return (
    <div>
      <h2>Portfolio</h2>
      
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
              <th>Ticker</th>
              <th style={{  maxWidth: '100px', }}>Name</th>
              <th>Type</th>
              <th>Region</th>
              <th>Last Price</th>
              <th>PDP (%)</th>
              <th>PLR (%)</th>
              <th>Budget</th>
              <th style={{ padding: '5px', textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {portfolioStocksData.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '1rem' }}>Your portfolio is empty.</td></tr>
            ) : (
              portfolioStocksData.map((stock, index) => (
                <tr key={stock.id} style={{ backgroundColor: index % 2 !== 0 ? '#151515' : 'transparent' }}>
                  <td><Link href={`/wallets/${stock.id}`}>{stock.symbol?.toUpperCase()}</Link></td>
                  <td style={{ maxWidth: '100px' }}>
                    {stock.name ? 
                      (stock.name.length > 15 ? 
                        `${stock.name.substring(0, 15)}...` : 
                        stock.name) 
                      : '-'}
                  </td>
                  <td>{stock.stockType}</td>
                  <td>{stock.region}</td>
                  <td>
                    {pricesLoading ? '...' : (latestPrices[stock.symbol]?.currentPrice?.toFixed(2) ?? 'N/A')}
                  </td>
                  <td>{stock.pdp ?? '-'}</td>
                  <td>{stock.plr ?? '-'}</td>
                  <td>{typeof stock.budget === 'number' ? stock.budget.toLocaleString('en-US', {style:'currency', currency:'USD'}) : '-'}</td>
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