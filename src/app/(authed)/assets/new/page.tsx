"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { client } from "@/utils/amplify-client";

type AssetType = "STOCK" | "ETF" | "CRYPTO";
type AssetStatus = "ACTIVE" | "HIDDEN" | "ARCHIVED";

interface FormData {
  symbol: string;
  name: string;
  type: AssetType;
  testPrice: string;
  commission: string;
  status: AssetStatus;
}

export default function NewAssetPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({
    symbol: "",
    name: "",
    type: "STOCK",
    testPrice: "",
    commission: "",
    status: "ACTIVE",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    if (!formData.symbol.trim()) {
      newErrors.symbol = "Symbol is required";
    }

    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    }

    if (formData.commission && parseFloat(formData.commission) < 0) {
      newErrors.commission = "Commission cannot be negative";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!validate()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await client.models.Asset.create({
        symbol: formData.symbol.trim().toUpperCase(),
        name: formData.name.trim(),
        type: formData.type,
        testPrice: formData.testPrice ? parseFloat(formData.testPrice) : null,
        commission: formData.commission ? parseFloat(formData.commission) : null,
        status: formData.status,
      });

      if (result.data?.id) {
        router.push(`/assets/${result.data.id}`);
      }
    } catch (err) {
      console.error("Error creating asset:", err);
      setError("Failed to create asset");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/assets"
          className="text-muted-foreground hover:text-foreground"
        >
          &larr; Back to Assets
        </Link>
      </div>

      <h2 className="text-2xl font-bold text-foreground mb-6">New Asset</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-500/20 text-red-400 rounded">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="max-w-2xl">
        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                data-testid="asset-form-symbol"
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
                data-testid="asset-form-name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full px-3 py-2 bg-background border border-border rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-border"
                placeholder="e.g., Apple Inc."
              />
              {errors.name && (
                <p className="text-red-500 text-sm mt-1">{errors.name}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="type"
                className="block text-sm font-medium text-card-foreground mb-1"
              >
                Type *
              </label>
              <select
                id="type"
                data-testid="asset-form-type"
                value={formData.type}
                onChange={(e) =>
                  setFormData({ ...formData, type: e.target.value as AssetType })
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
                htmlFor="testPrice"
                className="block text-sm font-medium text-card-foreground mb-1"
              >
                Test Price
              </label>
              <input
                type="number"
                id="testPrice"
                data-testid="asset-form-testPrice"
                step="0.01"
                value={formData.testPrice}
                onChange={(e) =>
                  setFormData({ ...formData, testPrice: e.target.value })
                }
                className="w-full px-3 py-2 bg-background border border-border rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-border"
                placeholder="For E2E testing"
              />
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
                data-testid="asset-form-commission"
                step="0.01"
                value={formData.commission}
                onChange={(e) =>
                  setFormData({ ...formData, commission: e.target.value })
                }
                className="w-full px-3 py-2 bg-background border border-border rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-border"
                placeholder="e.g., 0.5"
              />
              {errors.commission && (
                <p className="text-red-500 text-sm mt-1">{errors.commission}</p>
              )}
            </div>
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
              data-testid="asset-form-status"
              value={formData.status}
              onChange={(e) =>
                setFormData({ ...formData, status: e.target.value as AssetStatus })
              }
              className="w-full px-3 py-2 bg-background border border-border rounded text-foreground focus:outline-none focus:ring-2 focus:ring-border max-w-xs"
            >
              <option value="ACTIVE">Active</option>
              <option value="HIDDEN">Hidden</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Link
              href="/assets"
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded hover:bg-muted"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              data-testid="asset-form-submit"
              className="px-4 py-2 text-sm bg-foreground text-background rounded hover:opacity-90 disabled:opacity-50"
            >
              {isSubmitting ? "Creating..." : "Create Asset"}
            </button>
          </div>
        </div>
      </form>

      <div className="mt-6 p-4 bg-muted rounded-lg max-w-2xl">
        <p className="text-sm text-muted-foreground">
          After creating the asset, you&apos;ll be able to add entry targets and profit targets.
        </p>
      </div>
    </div>
  );
}
