'use client';

import React, { useState } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';

const client = generateClient<Schema>();

interface HistoricalClose {
  date: string;
  close: number;
}

interface StockDataResult {
  symbol: string;
  currentPrice: number | null;
  historicalCloses: HistoricalClose[];
}

export default function StockDataDownloadPage() {
  const [symbol, setSymbol] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastDownload, setLastDownload] = useState<string | null>(null);

  const downloadStockData = async () => {
    if (!symbol.trim()) {
      setError('Please enter a stock symbol');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Calculate start date for 5 years ago
      const endDate = new Date();
      const startDate = new Date();
      startDate.setFullYear(endDate.getFullYear() - 5);

      // Format dates as ISO strings (YYYY-MM-DD format)
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      console.log(`Fetching 5-year data for ${symbol.toUpperCase()} from ${startDateStr} to ${endDateStr}`);

      // Call the new historical data function
      const response = await client.queries.getHistoricalData({
        symbols: [symbol.toUpperCase()],
        startDate: startDateStr,
        endDate: endDateStr
      });

      if (response.errors) {
        throw new Error(response.errors[0].message);
      }

      const data = response.data as StockDataResult[];
      
      if (!data || data.length === 0) {
        throw new Error('No data returned for the symbol');
      }

      const stockData = data[0];
      
      if (!stockData.historicalCloses || stockData.historicalCloses.length === 0) {
        throw new Error(`No historical data found for ${symbol.toUpperCase()}`);
      }

      // Convert data to CSV format
      const csvContent = convertToCSV(stockData);
      
      // Create and trigger download
      downloadCSV(csvContent, `${symbol.toUpperCase()}_5year_data.csv`);
      
      setLastDownload(`${symbol.toUpperCase()} - ${stockData.historicalCloses.length} data points`);
      setSymbol(''); // Clear the input

    } catch (err: any) {
      console.error('Error fetching stock data:', err);
      setError(err.message || 'Failed to fetch stock data');
    } finally {
      setIsLoading(false);
    }
  };

  const convertToCSV = (stockData: StockDataResult): string => {
    const headers = ['Date', 'Symbol', 'Close Price', 'Current Price'];
    const rows = [headers.join(',')];

    // Sort historical data by date (oldest first)
    const sortedData = [...stockData.historicalCloses].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Add historical data rows
    sortedData.forEach(item => {
      const row = [
        item.date,
        stockData.symbol,
        item.close.toFixed(2),
        stockData.currentPrice?.toFixed(2) || 'N/A'
      ];
      rows.push(row.join(','));
    });

    return rows.join('\n');
  };

  const downloadCSV = (csvContent: string, filename: string) => {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      downloadStockData();
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      padding: '2rem',
      backgroundColor: '#1a1a1a'
    }}>
      <div style={{
        backgroundColor: '#2a2a2a',
        padding: '3rem',
        borderRadius: '8px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
        width: '100%',
        maxWidth: '500px',
        textAlign: 'center'
      }}>
        <h1 style={{ 
          marginBottom: '2rem', 
          color: '#ffffff',
          fontSize: '1.8rem',
          fontWeight: 'bold'
        }}>
          Stock Data Download
        </h1>
        
        <p style={{ 
          marginBottom: '2rem', 
          color: '#cccccc',
          fontSize: '0.9rem',
          lineHeight: '1.5'
        }}>
          Enter a stock symbol to download the last 5 years of historical data as a CSV file.
        </p>

        <div style={{ marginBottom: '1.5rem' }}>
          <input
            type="text"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            onKeyPress={handleKeyPress}
            placeholder="Enter stock symbol (e.g., AAPL)"
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '12px 16px',
              fontSize: '1rem',
              border: '1px solid #555',
              borderRadius: '4px',
              backgroundColor: '#3a3a3a',
              color: '#ffffff',
              marginBottom: '1rem'
            }}
          />
          
          <button
            onClick={downloadStockData}
            disabled={isLoading || !symbol.trim()}
            style={{
              width: '100%',
              padding: '12px 16px',
              fontSize: '1rem',
              fontWeight: 'bold',
              color: '#ffffff',
              backgroundColor: isLoading ? '#666666' : '#0066cc',
              border: 'none',
              borderRadius: '4px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s'
            }}
          >
            {isLoading ? 'Fetching Data...' : 'Download CSV'}
          </button>
        </div>

        {error && (
          <div style={{
            padding: '12px',
            backgroundColor: '#dc3545',
            color: '#ffffff',
            borderRadius: '4px',
            marginBottom: '1rem',
            fontSize: '0.9rem'
          }}>
            {error}
          </div>
        )}

        {lastDownload && (
          <div style={{
            padding: '12px',
            backgroundColor: '#28a745',
            color: '#ffffff',
            borderRadius: '4px',
            marginBottom: '1rem',
            fontSize: '0.9rem'
          }}>
            ✓ Downloaded: {lastDownload}
          </div>
        )}

        <div style={{
          marginTop: '2rem',
          fontSize: '0.8rem',
          color: '#888888',
          lineHeight: '1.4'
        }}>
          <p>• Data source: Yahoo Finance</p>
          <p>• Historical period: Last 5 years</p>
          <p>• File format: CSV with Date, Symbol, Close Price, Current Price</p>
        </div>
      </div>
    </div>
  );
}
