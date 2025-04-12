// app/(authed)/stocks-listing/page.tsx - Refactored with ["type"] pattern
'use client';

import React, { useState, useEffect, useCallback } from 'react'; // Added useCallback
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource'; // Adjust path if needed
import AddStockForm from '@/app/components/AddStockForm'; // Adjust path if needed
import { FaEdit, FaTrashAlt } from 'react-icons/fa';
import Link from 'next/link';
import { usePrices } from '@/app/contexts/PriceContext';

// Use the simpler data type for state
type PortfolioStockDataType = Schema["PortfolioStock"]["type"];
// Define type needed for update payload
type PortfolioStockUpdateInput = Partial<PortfolioStockDataType> & { id: string };

type PriceMap = Record<string, number | null>; // Symbol -> Price or null

const client = generateClient<Schema>();

export default function StocksListingPage() {
  //const [latestPrices, setLatestPrices] = useState<PriceMap>({});
  //const [pricesLoading, setPricesLoading] = useState<boolean>(false);
  //const [pricesError, setPricesError] = useState<string | null>(null);
  
  // --- STATE using PortfolioStockDataType[] ---
  const [portfolioStocksData, setPortfolioStocksData] = useState<PortfolioStockDataType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- State for editing ---
  const [isEditing, setIsEditing] = useState(false);
  const [editingStockId, setEditingStockId] = useState<string | null>(null); // Store ID separately
  const [stockToEditData, setStockToEditData] = useState<PortfolioStockDataType | null>(null); // Store data with simpler type

  // Inside your component function
  const { latestPrices, pricesLoading, pricesError } = usePrices();

  // Fetch Portfolio Function
  const fetchPortfolio = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    //setPricesLoading(true); // Also set prices loading true initially
    //setPricesError(null);
    //setLatestPrices({});
    
    try {
      // --- Fetch Portfolio Stocks (Your existing code) ---
      const { data: stocks, errors } = await client.models.PortfolioStock.list({
        selectionSet: ['id', 'symbol', 'name', 'stockType', 'region', 'pdp', 'plr', 'budget'] // Ensure 'symbol' is selected
      });
      if (errors) throw errors; // Throw stock fetching errors
  
      // Set the portfolio stocks state (Your existing code - use the correct setter)
      setPortfolioStocksData(stocks as PortfolioStockDataType[]); // Use your state setter
      console.log('Fetched portfolio:', stocks);
      // --- End Fetch Portfolio Stocks ---
  
    } catch (err: any) { // Catch errors from fetching stocks OR prices
      console.error("Error fetching portfolio or prices:", err);
      const errorMessage = Array.isArray(err.errors) ? err.errors[0].message : (err.message || "An unexpected error occurred.");
      setError(errorMessage); // Set general error state
      // Ensure loading states are reset if error happens before price fetch finishes
      //setPricesLoading(false);
    } finally {
      setIsLoading(false); // Set stock loading false
      // pricesLoading is handled within its own try/finally or after symbol check
    }
  }, []); // Add dependencies if needed, e.g., [client] - though client is usually stable
  
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

  // Edit Click Handler (sets simpler type state + ID)
  const handleEditClick = (stockData: PortfolioStockDataType) => { // Parameter uses simpler type
    console.log('Editing stock data:', stockData);
    // --- Check for TS errors accessing stockData.id ---
    setEditingStockId(stockData.id);
    setStockToEditData(stockData);
    setIsEditing(true);
  };

  // Cancel Edit Handler
  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditingStockId(null);
    setStockToEditData(null);
  };

  // Update Stock Handler (receives plain object from form, uses ID from state)
  const handleUpdateStock = async (updatePayload: PortfolioStockUpdateInput) => {
    if (!editingStockId) return; // Should have ID if editing
    console.log('Attempting to update stock:', editingStockId, updatePayload);
    setError(null);
    // Add isSaving state if needed

    try {
      // update function expects object with ID + changed fields
      const { data: updatedStock, errors } = await client.models.PortfolioStock.update(updatePayload);
      if (errors) throw errors;

      console.log('Stock updated successfully:', updatedStock);
      fetchPortfolio(); // Refresh the list
      handleCancelEdit(); // Close edit form

    } catch (err: any) {
      console.error('Error updating stock:', err);
      const message = Array.isArray(err) ? err[0].message : err.message;
      setError(message || 'Failed to update stock.');
    } finally {
      // Stop isSaving state if added
    }
  };

  return (
    <div>
      <h1>Your Stock Portfolio</h1>
      {isLoading && <p>Loading stocks...</p>}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}

      {/* Table Display (Only when NOT editing) */}
      {!isLoading && !error && !isEditing && (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>
              {/* Headers */}
              <th>Symbol</th>
              <th style={{  maxWidth: '150px', }}>Name</th>
              <th>Type</th>
              <th>Region</th>
              <th>Last Price</th>
              <th>PDP (%)</th>
              <th>PLR (%)</th>
              <th>Budget ($)</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {portfolioStocksData.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '1rem' }}>Your portfolio is empty.</td></tr>
            ) : (
              // --- Map over portfolioStocksData (simpler type) ---
              portfolioStocksData.map((stock) => (
                // --- Check for TS errors accessing stock properties below ---
                <tr key={stock.id} style={{ borderBottom: '1px solid #eee' }}>
                  {/* Symbol Link */}
                  <td><Link href={`/txns/${stock.id}/add`} /*...*/ >{stock.symbol?.toUpperCase()}</Link></td>
                  {/* Other Data Cells */}
                  <td>{stock.name ?? '--'}</td>
                  <td>{stock.stockType}</td>
                  <td>{stock.region}</td>
                  <td>
                    {pricesLoading ? '...' : (latestPrices[stock.symbol]?.currentPrice?.toFixed(2) ?? 'N/A')}
                  </td>
                  <td>{stock.pdp ?? '--'}</td>
                  <td>{stock.plr ?? '--'}</td>
                  <td>{typeof stock.budget === 'number' ? stock.budget.toLocaleString('en-US', {style:'currency', currency:'USD'}) : '--'}</td>
                  {/* Actions */}
                  <td style={{ textAlign: 'center' }}>
                    <button onClick={() => handleEditClick(stock)} /* Pass stock data */ title="Edit Stock" /*...*/><FaEdit /></button>
                    <button onClick={() => handleDeleteStock(stock.id)} /* Pass ID */ title="Delete Stock" /*...*/><FaTrashAlt /></button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}

      {/* Conditional Edit Form */}
      {isEditing && stockToEditData && (
        <div style={{ marginTop: '2rem', border: '1px solid #ccc', padding: '1rem' }}>
          <h2>Edit Stock: {stockToEditData.symbol?.toUpperCase()}</h2>
          <AddStockForm
            isEditMode={true}
            initialData={stockToEditData} // Pass simpler data type
            onUpdate={handleUpdateStock}
            onCancel={handleCancelEdit}
          />
        </div>
      )}

      {/* Button/Link to Add New Stock (opens form or navigates) - Optional */}
      {!isEditing && (
         <button onClick={() => setIsEditing(true)} style={{marginTop: '1rem'}}>Add New Stock</button>
         // When isEditing becomes true without stockToEditData, the form should show in 'Add' mode
         // OR navigate to a separate /add-stocks page which renders <AddStockForm />
      )}
       {/* If using the same form for Add mode: */}
       {isEditing && !stockToEditData && (
         <div style={{ marginTop: '2rem', border: '1px solid #ccc', padding: '1rem' }}>
           <h2>Add New Stock</h2>
           <AddStockForm
             isEditMode={false} // Explicitly Add mode
             // No initialData needed
             onStockAdded={() => { fetchPortfolio(); setIsEditing(false); }} // Refresh list and close form on add
             onCancel={handleCancelEdit} // Use cancel handler to close form
           />
         </div>
       )}


    </div>
  );
}