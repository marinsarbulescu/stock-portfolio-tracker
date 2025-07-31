// app/(authed)/portfolio/components/PortfolioStockSplitModal.tsx
'use client';

import React, { useState } from 'react';
import { stockSplitProcessor, type StockSplitData } from '@/app/utils/stockSplitProcessor';
import { useOwnerId } from '@/app/hooks/useOwnerId';

interface PortfolioStockSplitModalProps {
  isOpen: boolean;
  onClose: () => void;
  stockId: string;
  stockSymbol: string;
  currentPrice?: number;
  onSplitProcessed?: () => void;
}

export default function PortfolioStockSplitModal({
  isOpen,
  onClose,
  stockId,
  stockSymbol,
  currentPrice,
  onSplitProcessed
}: PortfolioStockSplitModalProps) {
  const [splitRatio, setSplitRatio] = useState('2');
  const [splitDate, setSplitDate] = useState(new Date().toISOString().split('T')[0]);
  const [preSplitPrice, setPreSplitPrice] = useState(currentPrice?.toString() || '');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');

  const { ownerId } = useOwnerId();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!ownerId) {
      setError('Owner ID not available');
      return;
    }

    const ratio = parseFloat(splitRatio);
    const preSplit = parseFloat(preSplitPrice);

    if (ratio <= 0 || !preSplit || preSplit <= 0) {
      setError('Please enter valid split ratio and pre-split price');
      return;
    }

    const postSplitPrice = preSplit / ratio;

    setIsProcessing(true);
    setError('');

    try {
      const splitData: StockSplitData = {
        portfolioStockId: stockId,
        splitDate,
        splitRatio: ratio,
        preSplitPrice: preSplit,
        postSplitPrice,
        owner: ownerId
      };

      await stockSplitProcessor.processStockSplit(splitData);
      
      alert(`✅ Stock split processed successfully!\n\n${stockSymbol}: ${ratio}:1 split\nPre-split price: $${preSplit}\nPost-split price: $${postSplitPrice.toFixed(2)}`);
      
      onSplitProcessed?.();
      onClose();
      
      // Reset form
      setSplitRatio('2');
      setSplitDate(new Date().toISOString().split('T')[0]);
      setPreSplitPrice('');
      
    } catch (err: any) {
      console.error('Split processing error:', err);
      setError(`Failed to process split: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (!isProcessing) {
      setError('');
      onClose();
    }
  };

  if (!isOpen) return null;

  const postSplitPrice = preSplitPrice ? (parseFloat(preSplitPrice) / parseFloat(splitRatio)).toFixed(2) : '0.00';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-96 max-w-full mx-4">
        <h2 className="text-xl font-bold mb-4">Process Stock Split - {stockSymbol}</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Split Date
            </label>
            <input
              type="date"
              value={splitDate}
              onChange={(e) => setSplitDate(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              disabled={isProcessing}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Split Ratio (new shares per old share)
            </label>
            <select
              value={splitRatio}
              onChange={(e) => setSplitRatio(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isProcessing}
            >
              <option value="1.5">3:2 Split (1.5:1)</option>
              <option value="2">2:1 Split</option>
              <option value="3">3:1 Split</option>
              <option value="4">4:1 Split</option>
              <option value="5">5:1 Split</option>
              <option value="6">6:1 Split</option>
              <option value="7">7:1 Split</option>
              <option value="10">10:1 Split</option>
            </select>
            <div className="text-sm text-gray-500 mt-1">
              Custom ratio: 
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={splitRatio}
                onChange={(e) => setSplitRatio(e.target.value)}
                className="ml-2 w-20 p-1 border border-gray-300 rounded text-sm"
                disabled={isProcessing}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Pre-Split Price
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={preSplitPrice}
              onChange={(e) => setPreSplitPrice(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter price before split"
              required
              disabled={isProcessing}
            />
          </div>

          <div className="bg-gray-50 p-3 rounded">
            <div className="text-sm text-gray-600">
              <div><strong>Split Preview:</strong></div>
              <div>Pre-split price: ${preSplitPrice || '0.00'}</div>
              <div>Post-split price: ${postSplitPrice}</div>
              <div>Ratio: {splitRatio}:1</div>
              <div className="text-xs mt-2 text-gray-500">
                • Share quantities will be multiplied by {splitRatio}
                <br />
                • Buy prices will be divided by {splitRatio}
                <br />
                • Total investment amounts remain unchanged
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded">
              {error}
            </div>
          )}

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 disabled:opacity-50"
              disabled={isProcessing}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isProcessing}
            >
              {isProcessing ? 'Processing...' : 'Process Split'}
            </button>
          </div>
        </form>

        <div className="mt-4 text-xs text-gray-500">
          <strong>⚠️ Warning:</strong> This action will adjust all existing wallet transactions for this stock. 
          Make sure the split details are correct before proceeding.
        </div>
      </div>
    </div>
  );
}
