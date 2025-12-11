"use client";

import { useState } from "react";

export interface AssetFormData {
  symbol: string;
  name: string;
  type: "STOCK" | "ETF" | "CRYPTO";
  commission: number | null;
  status: "ACTIVE" | "HIDDEN" | "ARCHIVED";
}

interface AssetFormProps {
  onSubmit: (data: AssetFormData) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
  initialData?: AssetFormData;
}

export function AssetForm({ onSubmit, onCancel, isSubmitting, initialData }: AssetFormProps) {
  const isEditMode = !!initialData;
  const [formData, setFormData] = useState<AssetFormData>(
    initialData ?? {
      symbol: "",
      name: "",
      type: "STOCK",
      commission: null,
      status: "ACTIVE",
    }
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    if (!formData.symbol.trim()) {
      newErrors.symbol = "Symbol is required";
    }

    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    }

    if (formData.commission !== null && formData.commission < 0) {
      newErrors.commission = "Commission cannot be negative";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!validate()) return;

    await onSubmit({
      ...formData,
      symbol: formData.symbol.trim().toUpperCase(),
      name: formData.name.trim(),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="symbol"
          className="block text-sm font-medium text-card-foreground mb-1"
        >
          Symbol *
        </label>
        <input
          type="text"
          id="symbol"
          value={formData.symbol}
          onChange={(e) =>
            setFormData({ ...formData, symbol: e.target.value })
          }
          className="w-full px-3 py-2 bg-background border border-border rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-border"
          placeholder="e.g., AAPL"
        />
        {errors.symbol && (
          <p className="text-red-500 text-sm mt-1">{errors.symbol}</p>
        )}
      </div>

      <div>
        <label
          htmlFor="name"
          className="block text-sm font-medium text-card-foreground mb-1"
        >
          Name *
        </label>
        <input
          type="text"
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full px-3 py-2 bg-background border border-border rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-border"
          placeholder="e.g., Apple Inc."
        />
        {errors.name && (
          <p className="text-red-500 text-sm mt-1">{errors.name}</p>
        )}
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
          value={formData.type}
          onChange={(e) =>
            setFormData({
              ...formData,
              type: e.target.value as "STOCK" | "ETF" | "CRYPTO",
            })
          }
          className="w-full px-3 py-2 bg-background border border-border rounded text-foreground focus:outline-none focus:ring-2 focus:ring-border"
        >
          <option value="STOCK">Stock</option>
          <option value="ETF">ETF</option>
          <option value="CRYPTO">Crypto</option>
        </select>
      </div>

      <div>
        <label
          htmlFor="commission"
          className="block text-sm font-medium text-card-foreground mb-1"
        >
          Commission (%)
        </label>
        <input
          type="number"
          id="commission"
          step="0.01"
          value={formData.commission ?? ""}
          onChange={(e) =>
            setFormData({
              ...formData,
              commission: e.target.value ? parseFloat(e.target.value) : null,
            })
          }
          className="w-full px-3 py-2 bg-background border border-border rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-border"
          placeholder="e.g., 0.5"
        />
        {errors.commission && (
          <p className="text-red-500 text-sm mt-1">{errors.commission}</p>
        )}
      </div>

      <div>
        <label
          htmlFor="status"
          className="block text-sm font-medium text-card-foreground mb-1"
        >
          Status *
        </label>
        <select
          id="status"
          value={formData.status}
          onChange={(e) =>
            setFormData({
              ...formData,
              status: e.target.value as "ACTIVE" | "HIDDEN" | "ARCHIVED",
            })
          }
          className="w-full px-3 py-2 bg-background border border-border rounded text-foreground focus:outline-none focus:ring-2 focus:ring-border"
        >
          <option value="ACTIVE">Active</option>
          <option value="HIDDEN">Hidden</option>
          <option value="ARCHIVED">Archived</option>
        </select>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded hover:bg-muted"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 text-sm bg-foreground text-background rounded hover:opacity-90 disabled:opacity-50"
        >
          {isSubmitting
            ? isEditMode
              ? "Saving..."
              : "Creating..."
            : isEditMode
            ? "Save Changes"
            : "Create Asset"}
        </button>
      </div>
    </form>
  );
}
