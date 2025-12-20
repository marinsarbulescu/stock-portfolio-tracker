"use client";

import { useState, useEffect } from "react";
import { Modal } from "./Modal";

type TransactionType = "BUY" | "SELL" | "DIVIDEND" | "SPLIT" | "SLP";
type TransactionSignal = "REPULL" | "CUSTOM" | "INITIAL" | "EOM" | "ENTAR" | "PROFITTARGET";

export interface TransactionAllocation {
  profitTargetId: string;
  percentage: number;
  shares: number;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  date: string;
  signal: TransactionSignal | null;
  quantity: number | null;
  amount: number | null;
  splitRatio: number | null;
  price: number | null;
  investment: number | null;
  assetId: string;
  allocations?: TransactionAllocation[];
  entryTargetPrice?: number | null;
  entryTargetPercent?: number | null;
}

interface Asset {
  id: string;
  symbol: string;
  name: string;
}

interface ProfitTarget {
  id: string;
  name: string;
  targetPercent: number;
  allocationPercent: number | null;
  sortOrder: number;
}

interface EntryTarget {
  id: string;
  name: string;
  targetPercent: number;
  sortOrder: number;
}

interface TransactionModalProps {
  isOpen: boolean;
  mode: "create" | "edit";
  transaction?: Transaction | null;
  assets: Asset[];
  profitTargets?: ProfitTarget[];
  entryTargets?: EntryTarget[];
  onClose: () => void;
  onSave: (data: Omit<Transaction, "id">) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

interface FormData {
  assetId: string;
  type: TransactionType;
  date: string;
  signal: TransactionSignal | "";
  quantity: string;
  amount: string;
  splitRatio: string;
  price: string;
  investment: string;
  allocations: Record<string, string>; // profitTargetId -> percentage string
}

const TRANSACTION_TYPES: { value: TransactionType; label: string }[] = [
  { value: "BUY", label: "Buy" },
  { value: "DIVIDEND", label: "Dividend" },
  { value: "SPLIT", label: "Split" },
  { value: "SLP", label: "Stock Lending Payment" },
];

const SIGNAL_TYPES: { value: TransactionSignal; label: string }[] = [
  { value: "INITIAL", label: "Initial" },
  { value: "ENTAR", label: "Entry Target" },
  { value: "PROFITTARGET", label: "Profit Target" },
  { value: "EOM", label: "End of Month" },
  { value: "REPULL", label: "Recent Pullback" },
  { value: "CUSTOM", label: "Custom" },
];

function getFieldsForType(type: TransactionType): string[] {
  switch (type) {
    case "SLP":
    case "DIVIDEND":
      return ["date", "amount"];
    case "SPLIT":
      return ["date", "splitRatio"];
    case "BUY":
      return ["date", "signal", "price", "investment"];
    case "SELL":
      return ["date", "signal", "price", "quantity"];
  }
}

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

export function TransactionModal({
  isOpen,
  mode,
  transaction,
  assets,
  profitTargets = [],
  entryTargets = [],
  onClose,
  onSave,
  onDelete,
}: TransactionModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({
    assetId: "",
    type: "BUY",
    date: getDefaultDateTime(),
    signal: "",
    quantity: "",
    amount: "",
    splitRatio: "",
    price: "",
    investment: "",
    allocations: {},
  });

  // Reset form when modal opens/closes or transaction changes
  useEffect(() => {
    if (isOpen) {
      if (mode === "edit" && transaction) {
        // Convert existing allocations to form format
        const allocationsMap: Record<string, string> = {};
        if (transaction.allocations) {
          transaction.allocations.forEach((alloc) => {
            allocationsMap[alloc.profitTargetId] = alloc.percentage.toString();
          });
        }
        setFormData({
          assetId: transaction.assetId,
          type: transaction.type,
          date: formatDateTimeLocal(transaction.date),
          signal: transaction.signal || "",
          quantity: transaction.quantity?.toString() || "",
          amount: transaction.amount?.toString() || "",
          splitRatio: transaction.splitRatio?.toString() || "",
          price: transaction.price?.toString() || "",
          investment: transaction.investment?.toString() || "",
          allocations: allocationsMap,
        });
      } else {
        // Build default allocations from profit target allocationPercent values
        const defaultAllocations: Record<string, string> = {};
        profitTargets.forEach((pt) => {
          if (pt.allocationPercent !== null && pt.allocationPercent > 0) {
            defaultAllocations[pt.id] = pt.allocationPercent.toString();
          }
        });

        setFormData({
          assetId: assets[0]?.id || "",
          type: "BUY",
          date: getDefaultDateTime(),
          signal: "",
          quantity: "",
          amount: "",
          splitRatio: "",
          price: "",
          investment: "",
          allocations: defaultAllocations,
        });
      }
      setError(null);
    }
  }, [isOpen, mode, transaction, assets, profitTargets]);

  const visibleFields = getFieldsForType(formData.type);

  // Calculate total shares from price and investment
  const totalShares =
    formData.price && formData.investment
      ? parseFloat(formData.investment) / parseFloat(formData.price)
      : 0;

  // Sort profit targets by sortOrder
  const sortedProfitTargets = [...profitTargets].sort(
    (a, b) => a.sortOrder - b.sortOrder
  );

  // Calculate final allocations with auto-fill
  function calculateFinalAllocations(): TransactionAllocation[] {
    if (profitTargets.length === 0 || totalShares === 0) return [];

    const specified: { id: string; pct: number }[] = [];
    const unspecified: string[] = [];
    let specifiedTotal = 0;

    sortedProfitTargets.forEach((pt) => {
      const val = formData.allocations[pt.id];
      if (val && parseFloat(val) > 0) {
        const pct = parseFloat(val);
        specified.push({ id: pt.id, pct });
        specifiedTotal += pct;
      } else {
        unspecified.push(pt.id);
      }
    });

    const remaining = 100 - specifiedTotal;
    const perUnspecified =
      unspecified.length > 0 ? remaining / unspecified.length : 0;

    const result: TransactionAllocation[] = [];

    sortedProfitTargets.forEach((pt) => {
      const specifiedEntry = specified.find((s) => s.id === pt.id);
      const percentage = specifiedEntry ? specifiedEntry.pct : perUnspecified;
      result.push({
        profitTargetId: pt.id,
        percentage,
        shares: parseFloat(((percentage / 100) * totalShares).toFixed(5)),
      });
    });

    return result;
  }

  // Get sum of specified allocation percentages
  function getSpecifiedTotal(): number {
    return Object.values(formData.allocations).reduce((sum, val) => {
      const num = parseFloat(val);
      return sum + (isNaN(num) ? 0 : num);
    }, 0);
  }

  function validate(): boolean {
    if (!formData.assetId) {
      setError("Please select an asset");
      return false;
    }
    if (!formData.date) {
      setError("Date is required");
      return false;
    }

    const type = formData.type;

    if ((type === "SLP" || type === "DIVIDEND") && !formData.amount) {
      setError("Amount is required");
      return false;
    }

    if (type === "SPLIT" && !formData.splitRatio) {
      setError("Split ratio is required");
      return false;
    }

    if (type === "BUY") {
      if (!formData.signal) {
        setError("Signal is required");
        return false;
      }
      if (!formData.price) {
        setError("Price is required");
        return false;
      }
      if (!formData.investment) {
        setError("Investment is required");
        return false;
      }
      // Validate allocations if profit targets exist
      if (profitTargets.length > 0) {
        const specifiedTotal = getSpecifiedTotal();
        if (specifiedTotal > 100) {
          setError("Total allocation cannot exceed 100%");
          return false;
        }
        // At least one allocation must be specified
        const hasAnyAllocation = Object.values(formData.allocations).some(
          (val) => val && parseFloat(val) > 0
        );
        if (!hasAnyAllocation) {
          setError("Please specify allocation for at least one profit target");
          return false;
        }
      }
    }

    if (type === "SELL") {
      if (!formData.signal) {
        setError("Signal is required");
        return false;
      }
      if (!formData.price) {
        setError("Price is required");
        return false;
      }
      if (!formData.quantity) {
        setError("Quantity is required");
        return false;
      }
    }

    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const price = formData.price ? parseFloat(formData.price) : null;
      const investment = formData.investment ? parseFloat(formData.investment) : null;

      // Auto-calculate quantity for BUY transactions
      let quantity = formData.quantity ? parseFloat(formData.quantity) : null;
      if (formData.type === "BUY" && price && investment) {
        quantity = investment / price;
      }

      // Amount is only for DIVIDEND/SLP
      const amount = formData.amount ? parseFloat(formData.amount) : null;

      // Calculate allocations for BUY transactions
      const allocations =
        formData.type === "BUY" && profitTargets.length > 0
          ? calculateFinalAllocations()
          : undefined;

      // Calculate entry target for BUY transactions
      let entryTargetPrice: number | null = null;
      let entryTargetPercent: number | null = null;
      if (formData.type === "BUY" && price && entryTargets.length > 0) {
        // Use the first entry target by sortOrder
        const sortedEntryTargets = [...entryTargets].sort((a, b) => a.sortOrder - b.sortOrder);
        const firstET = sortedEntryTargets[0];
        if (firstET) {
          entryTargetPercent = firstET.targetPercent;
          // ET is a buy signal when price drops - subtract the percentage
          entryTargetPrice = price * (1 - Math.abs(firstET.targetPercent) / 100);
        }
      }

      await onSave({
        assetId: formData.assetId,
        type: formData.type,
        date: new Date(formData.date).toISOString(),
        signal: formData.signal || null,
        quantity,
        amount,
        splitRatio: formData.splitRatio ? parseFloat(formData.splitRatio) : null,
        price,
        investment,
        allocations,
        entryTargetPrice,
        entryTargetPercent,
      });
      onClose();
    } catch {
      setError("Failed to save transaction");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!transaction || !onDelete) return;
    if (!confirm("Are you sure you want to delete this transaction?")) return;

    setIsSubmitting(true);
    try {
      await onDelete(transaction.id);
      onClose();
    } catch {
      setError("Failed to delete transaction");
    } finally {
      setIsSubmitting(false);
    }
  }

  const title = mode === "create" ? "New Transaction" : "Edit Transaction";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-500/20 text-red-400 rounded text-sm">
            {error}
          </div>
        )}

        {/* Asset and Type - always visible */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="assetId"
              className="block text-sm font-medium text-card-foreground mb-1"
            >
              Asset *
            </label>
            <select
              id="assetId"
              value={formData.assetId}
              onChange={(e) =>
                setFormData({ ...formData, assetId: e.target.value })
              }
              className="w-full px-3 py-2 bg-background border border-border rounded text-foreground focus:outline-none focus:ring-2 focus:ring-border"
            >
              {assets.length === 0 && (
                <option value="">No assets available</option>
              )}
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.symbol}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="type"
              className="block text-sm font-medium text-card-foreground mb-1"
            >
              Type *
            </label>
            <select
              id="type"
              data-testid="transaction-form-type"
              value={formData.type}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  type: e.target.value as TransactionType,
                  // Reset conditional fields when type changes
                  signal: "",
                  quantity: "",
                  amount: "",
                  splitRatio: "",
                  price: "",
                  investment: "",
                  allocations: {},
                })
              }
              className="w-full px-3 py-2 bg-background border border-border rounded text-foreground focus:outline-none focus:ring-2 focus:ring-border"
            >
              {TRANSACTION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Date - always visible */}
        {visibleFields.includes("date") && (
          <div>
            <label
              htmlFor="date"
              className="block text-sm font-medium text-card-foreground mb-1"
            >
              Date & Time *
            </label>
            <input
              type="datetime-local"
              id="date"
              data-testid="transaction-form-date"
              value={formData.date}
              onChange={(e) =>
                setFormData({ ...formData, date: e.target.value })
              }
              className="w-full px-3 py-2 bg-background border border-border rounded text-foreground focus:outline-none focus:ring-2 focus:ring-border"
            />
          </div>
        )}

        {/* Signal - for BUY/SELL */}
        {visibleFields.includes("signal") && (
          <div>
            <label
              htmlFor="signal"
              className="block text-sm font-medium text-card-foreground mb-1"
            >
              Signal *
            </label>
            <select
              id="signal"
              data-testid="transaction-form-signal"
              value={formData.signal}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  signal: e.target.value as TransactionSignal | "",
                })
              }
              className="w-full px-3 py-2 bg-background border border-border rounded text-foreground focus:outline-none focus:ring-2 focus:ring-border"
            >
              <option value="">Select signal</option>
              {SIGNAL_TYPES.filter(
                (s) => formData.type !== "BUY" || s.value !== "PROFITTARGET"
              ).map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Price - for BUY/SELL */}
        {visibleFields.includes("price") && (
          <div>
            <label
              htmlFor="price"
              className="block text-sm font-medium text-card-foreground mb-1"
            >
              Price *
            </label>
            <input
              type="number"
              id="price"
              data-testid="transaction-form-price"
              step="0.01"
              value={formData.price}
              onChange={(e) =>
                setFormData({ ...formData, price: e.target.value })
              }
              placeholder="Price per share"
              className="w-full px-3 py-2 bg-background border border-border rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-border"
            />
          </div>
        )}

        {/* Investment - for BUY */}
        {visibleFields.includes("investment") && (
          <div>
            <label
              htmlFor="investment"
              className="block text-sm font-medium text-card-foreground mb-1"
            >
              Investment *
            </label>
            <input
              type="number"
              id="investment"
              data-testid="transaction-form-investment"
              step="0.01"
              value={formData.investment}
              onChange={(e) =>
                setFormData({ ...formData, investment: e.target.value })
              }
              placeholder="Total investment amount"
              className="w-full px-3 py-2 bg-background border border-border rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-border"
            />
          </div>
        )}

        {/* Quantity - for SELL */}
        {visibleFields.includes("quantity") && (
          <div>
            <label
              htmlFor="quantity"
              className="block text-sm font-medium text-card-foreground mb-1"
            >
              Quantity *
            </label>
            <input
              type="number"
              id="quantity"
              step="0.01"
              value={formData.quantity}
              onChange={(e) =>
                setFormData({ ...formData, quantity: e.target.value })
              }
              placeholder="Number of shares"
              className="w-full px-3 py-2 bg-background border border-border rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-border"
            />
          </div>
        )}

        {/* Amount - for SLP, DIVIDEND */}
        {visibleFields.includes("amount") && (
          <div>
            <label
              htmlFor="amount"
              className="block text-sm font-medium text-card-foreground mb-1"
            >
              Amount *
            </label>
            <input
              type="number"
              id="amount"
              step="0.01"
              value={formData.amount}
              onChange={(e) =>
                setFormData({ ...formData, amount: e.target.value })
              }
              placeholder="Payment amount"
              className="w-full px-3 py-2 bg-background border border-border rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-border"
            />
          </div>
        )}

        {/* Split Ratio - for SPLIT */}
        {visibleFields.includes("splitRatio") && (
          <div>
            <label
              htmlFor="splitRatio"
              className="block text-sm font-medium text-card-foreground mb-1"
            >
              Split Ratio *
            </label>
            <input
              type="number"
              id="splitRatio"
              step="0.01"
              value={formData.splitRatio}
              onChange={(e) =>
                setFormData({ ...formData, splitRatio: e.target.value })
              }
              placeholder="e.g., 2 for 2:1 split"
              className="w-full px-3 py-2 bg-background border border-border rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-border"
            />
          </div>
        )}

        {/* Profit Target Allocations - for BUY with profit targets */}
        {formData.type === "BUY" && sortedProfitTargets.length > 0 && (
          <div className="border-t border-border pt-4 mt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-card-foreground">
                Profit Target Allocations *
              </h4>
              {totalShares > 0 && (
                <span className="text-xs text-muted-foreground">
                  Total: {totalShares.toLocaleString(undefined, { minimumFractionDigits: 5, maximumFractionDigits: 5 })} shares
                </span>
              )}
            </div>

            {totalShares === 0 ? (
              <p className="text-sm text-muted-foreground">
                Enter price and investment to allocate shares
              </p>
            ) : (
              <div className="space-y-2">
                {sortedProfitTargets.map((pt) => {
                  const inputValue = formData.allocations[pt.id] || "";
                  const percentage = inputValue ? parseFloat(inputValue) : 0;
                  const shares = (percentage / 100) * totalShares;
                  const specifiedTotal = getSpecifiedTotal();
                  const unspecifiedCount = sortedProfitTargets.filter(
                    (p) => !formData.allocations[p.id] || parseFloat(formData.allocations[p.id]) === 0
                  ).length;
                  const autoPercentage =
                    !inputValue && unspecifiedCount > 0
                      ? (100 - specifiedTotal) / unspecifiedCount
                      : 0;
                  const displayShares = inputValue
                    ? shares
                    : (autoPercentage / 100) * totalShares;

                  return (
                    <div
                      key={pt.id}
                      className="flex items-center gap-3 text-sm"
                    >
                      <span className="w-24 text-muted-foreground truncate">
                        {pt.name} (+{pt.targetPercent}%)
                      </span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          data-testid={`transaction-pt-alloc-${pt.targetPercent}`}
                          min="0"
                          max="100"
                          step="0.01"
                          value={inputValue}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              allocations: {
                                ...formData.allocations,
                                [pt.id]: e.target.value,
                              },
                            })
                          }
                          placeholder={autoPercentage > 0 ? autoPercentage.toFixed(1) : "0"}
                          className="w-16 px-2 py-1 bg-background border border-border rounded text-foreground text-right placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-border"
                        />
                        <span className="text-muted-foreground">%</span>
                      </div>
                      <span className="text-muted-foreground">→</span>
                      <span className="text-card-foreground">
                        {inputValue
                          ? displayShares.toLocaleString(undefined, { minimumFractionDigits: 5, maximumFractionDigits: 5 })
                          : autoPercentage > 0
                          ? `(${displayShares.toLocaleString(undefined, { minimumFractionDigits: 5, maximumFractionDigits: 5 })})`
                          : "-"}{" "}
                        shares
                      </span>
                    </div>
                  );
                })}

                <div className="flex items-center gap-3 text-sm border-t border-border pt-2 mt-2">
                  <span className="w-24 text-card-foreground font-medium">
                    Total
                  </span>
                  <span className="w-16 text-right font-medium text-card-foreground">
                    {getSpecifiedTotal() > 0
                      ? `${getSpecifiedTotal()}%`
                      : "100%"}
                  </span>
                  <span className="text-muted-foreground">→</span>
                  <span className="text-card-foreground font-medium">
                    {totalShares.toLocaleString(undefined, { minimumFractionDigits: 5, maximumFractionDigits: 5 })} shares
                  </span>
                </div>

                {getSpecifiedTotal() > 100 && (
                  <p className="text-xs text-red-400 mt-1">
                    Total allocation exceeds 100%
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex justify-between pt-4 border-t border-border">
          <div>
            {mode === "edit" && onDelete && (
              <button
                type="button"
                data-testid="transaction-form-delete"
                onClick={handleDelete}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm text-red-400 hover:text-red-300 disabled:opacity-50"
              >
                Delete
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              data-testid="transaction-form-cancel"
              onClick={onClose}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              data-testid="transaction-form-submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm bg-foreground text-background rounded hover:opacity-90 disabled:opacity-50"
            >
              {isSubmitting
                ? "Saving..."
                : mode === "create"
                ? "Create"
                : "Save"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
