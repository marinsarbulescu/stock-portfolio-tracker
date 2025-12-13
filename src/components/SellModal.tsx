"use client";

import { useState, useEffect, useMemo } from "react";
import { Modal } from "./Modal";

type TransactionSignal = "TP" | "CUSTOM";

interface WalletRow {
  id: string;
  price: number;
  shares: number;
  investment: number;
  profitTargetId: string;
}

interface Asset {
  id: string;
  symbol: string;
  name: string;
  commission: number | null;
}

export interface SellData {
  date: string;
  signal: TransactionSignal;
  price: number;
  quantity: number;
  netProceeds: number;
}

interface SellModalProps {
  isOpen: boolean;
  wallet: WalletRow | null;
  asset: Asset | null;
  onClose: () => void;
  onSave: (data: SellData) => Promise<void>;
}

const SIGNAL_TYPES: { value: TransactionSignal; label: string }[] = [
  { value: "TP", label: "Take Profit" },
  { value: "CUSTOM", label: "Custom" },
];

function formatDateTimeLocal(isoString: string): string {
  const date = new Date(isoString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function getDefaultDateTime(): string {
  return formatDateTimeLocal(new Date().toISOString());
}

export function SellModal({
  isOpen,
  wallet,
  asset,
  onClose,
  onSave,
}: SellModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState(getDefaultDateTime());
  const [signal, setSignal] = useState<TransactionSignal>("TP");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");

  // Reset form when modal opens with a wallet
  useEffect(() => {
    if (isOpen && wallet) {
      setDate(getDefaultDateTime());
      setSignal("TP");
      setPrice("");
      // Default quantity to full wallet shares (5 decimal precision)
      setQuantity(wallet.shares.toFixed(5));
      setError(null);
    }
  }, [isOpen, wallet]);

  // Calculate proceeds
  const calculations = useMemo(() => {
    const priceNum = parseFloat(price) || 0;
    const quantityNum = parseFloat(quantity) || 0;
    const commission = asset?.commission || 0;

    const grossProceeds = priceNum * quantityNum;
    const commissionAmount = grossProceeds * (commission / 100);
    const netProceeds = grossProceeds - commissionAmount;

    return {
      grossProceeds,
      commission,
      commissionAmount,
      netProceeds,
    };
  }, [price, quantity, asset?.commission]);

  function validate(): boolean {
    if (!date) {
      setError("Date is required");
      return false;
    }
    if (!signal) {
      setError("Signal is required");
      return false;
    }
    if (!price || parseFloat(price) <= 0) {
      setError("Price must be greater than 0");
      return false;
    }
    if (!quantity || parseFloat(quantity) <= 0) {
      setError("Quantity must be greater than 0");
      return false;
    }
    if (wallet && parseFloat(quantity) > wallet.shares) {
      setError(`Quantity cannot exceed available shares (${wallet.shares.toFixed(5)})`);
      return false;
    }
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await onSave({
        date: new Date(date).toISOString(),
        signal,
        price: parseFloat(price),
        quantity: parseFloat(quantity),
        netProceeds: calculations.netProceeds,
      });
      onClose();
    } catch {
      setError("Failed to save sell transaction");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!wallet || !asset) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Sell ${asset.symbol}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-500/20 text-red-400 rounded text-sm">
            {error}
          </div>
        )}

        {/* Wallet Info */}
        <div className="p-3 bg-muted/50 rounded text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Buy Price:</span>
            <span className="text-card-foreground">
              ${wallet.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Available Shares:</span>
            <span className="text-card-foreground">
              {wallet.shares.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 5 })}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Investment:</span>
            <span className="text-card-foreground">
              ${wallet.investment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Date */}
        <div>
          <label
            htmlFor="sell-date"
            className="block text-sm font-medium text-card-foreground mb-1"
          >
            Date & Time *
          </label>
          <input
            type="datetime-local"
            id="sell-date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2 bg-background border border-border rounded text-foreground focus:outline-none focus:ring-2 focus:ring-border"
          />
        </div>

        {/* Signal */}
        <div>
          <label
            htmlFor="sell-signal"
            className="block text-sm font-medium text-card-foreground mb-1"
          >
            Signal *
          </label>
          <select
            id="sell-signal"
            value={signal}
            onChange={(e) => setSignal(e.target.value as TransactionSignal)}
            className="w-full px-3 py-2 bg-background border border-border rounded text-foreground focus:outline-none focus:ring-2 focus:ring-border"
          >
            {SIGNAL_TYPES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {/* Price */}
        <div>
          <label
            htmlFor="sell-price"
            className="block text-sm font-medium text-card-foreground mb-1"
          >
            Sell Price *
          </label>
          <input
            type="number"
            id="sell-price"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Price per share"
            className="w-full px-3 py-2 bg-background border border-border rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-border"
          />
        </div>

        {/* Quantity */}
        <div>
          <label
            htmlFor="sell-quantity"
            className="block text-sm font-medium text-card-foreground mb-1"
          >
            Quantity *
          </label>
          <input
            type="number"
            id="sell-quantity"
            step="0.00001"
            min="0"
            max={wallet.shares}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="Number of shares"
            className="w-full px-3 py-2 bg-background border border-border rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-border"
          />
        </div>

        {/* Proceeds Calculation */}
        {price && quantity && (
          <div className="p-3 bg-muted/50 rounded text-sm space-y-1 border-t border-border">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Gross Proceeds:</span>
              <span className="text-card-foreground">
                ${calculations.grossProceeds.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            {calculations.commission > 0 && (
              <div className="flex justify-between text-yellow-500">
                <span>Commission ({calculations.commission}%):</span>
                <span>
                  -${calculations.commissionAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            )}
            <div className="flex justify-between font-medium border-t border-border pt-1 mt-1">
              <span className="text-card-foreground">Net Proceeds:</span>
              <span className="text-green-400">
                ${calculations.netProceeds.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
          >
            {isSubmitting ? "Selling..." : "Sell"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
