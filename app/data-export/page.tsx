'use client';

import { useState } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>();

interface ExportStats {
  stocks: number;
  transactions: number;
  wallets: number;
  goals: number;
}

export default function DataExportPage() {
  const [isExporting, setIsExporting] = useState(false);
  const [exportComplete, setExportComplete] = useState(false);
  const [exportStats, setExportStats] = useState<ExportStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const exportAllData = async () => {
    setIsExporting(true);
    setError(null);
    
    try {
      console.log('🚀 Starting production data export...');
      
      // Export all data models
      const [stocksResult, transactionsResult, walletsResult, goalsResult] = await Promise.all([
        client.models.PortfolioStock.list({ limit: 1000 }),
        client.models.Transaction.list({ limit: 5000 }),
        client.models.StockWallet.list({ limit: 2000 }),
        client.models.PortfolioGoals.list({ limit: 100 })
      ]);

      const exportData = {
        exportDate: new Date().toISOString(),
        portfolioStocks: stocksResult.data || [],
        transactions: transactionsResult.data || [],
        stockWallets: walletsResult.data || [],
        portfolioGoals: goalsResult.data || [],
        metadata: {
          totalRecords: (stocksResult.data?.length || 0) + 
                       (transactionsResult.data?.length || 0) + 
                       (walletsResult.data?.length || 0) + 
                       (goalsResult.data?.length || 0),
          exportedBy: 'production-app',
          version: '1.0.0'
        }
      };

      // Download as JSON file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
        type: 'application/json' 
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `portfolio-data-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Update stats
      const stats: ExportStats = {
        stocks: stocksResult.data?.length || 0,
        transactions: transactionsResult.data?.length || 0,
        wallets: walletsResult.data?.length || 0,
        goals: goalsResult.data?.length || 0
      };
      
      setExportStats(stats);
      setExportComplete(true);
      console.log('✅ Export completed successfully!', stats);

    } catch (err) {
      console.error('❌ Export failed:', err);
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="container mx-auto p-8 max-w-2xl">
      <div className="bg-white shadow-lg rounded-lg p-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Data Export</h1>
        <p className="text-gray-600 mb-6">
          Export all your portfolio data for migration testing or backup purposes.
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
            <div className="flex">
              <div className="text-red-800">
                <p className="font-medium">Export Error</p>
                <p className="text-sm mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {exportComplete && exportStats && (
          <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-6">
            <div className="text-green-800">
              <p className="font-medium">✅ Export Completed Successfully!</p>
              <div className="text-sm mt-2 space-y-1">
                <p>📊 Portfolio Stocks: {exportStats.stocks}</p>
                <p>💰 Transactions: {exportStats.transactions}</p>
                <p>📂 Stock Wallets: {exportStats.wallets}</p>
                <p>🎯 Portfolio Goals: {exportStats.goals}</p>
                <p className="font-medium pt-1">
                  Total Records: {exportStats.stocks + exportStats.transactions + exportStats.wallets + exportStats.goals}
                </p>
              </div>
              <p className="text-sm mt-3 text-green-600">
                The JSON file has been downloaded to your Downloads folder.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <button
            onClick={exportAllData}
            disabled={isExporting}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-3 px-4 rounded-md transition-colors duration-200"
          >
            {isExporting ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Exporting Data...
              </div>
            ) : (
              'Export All Data'
            )}
          </button>

          <div className="text-sm text-gray-500 space-y-2">
            <p><strong>What will be exported:</strong></p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>All portfolio stocks and their settings</li>
              <li>All transactions (buy, sell, dividends, splits)</li>
              <li>All stock wallets with profit/loss data</li>
              <li>Portfolio goals and targets</li>
            </ul>
            <p className="pt-2">
              <strong>Note:</strong> This export includes all your production data. 
              Use this file to import data into your development environment for testing migrations.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}