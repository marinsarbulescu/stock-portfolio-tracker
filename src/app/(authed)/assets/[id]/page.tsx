"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthenticator } from "@aws-amplify/ui-react";
import { client } from "@/utils/amplify-client";
import { usePrices } from "@/contexts/PriceContext";
import { TargetList, EntryTarget, ProfitTarget } from "@/components/TargetList";
import { BudgetList, Budget } from "@/components/BudgetList";

type AssetType = "STOCK" | "ETF" | "CRYPTO";
type AssetStatus = "ACTIVE" | "HIDDEN" | "ARCHIVED";

interface Asset {
  id: string;
  symbol: string;
  name: string;
  type: AssetType;
  testPrice: number | null;
  commission: number | null;
  status: AssetStatus;
}

interface FormData {
  symbol: string;
  name: string;
  type: AssetType;
  testPrice: string;
  commission: string;
  status: AssetStatus;
}

export default function EditAssetPage() {
  const { authStatus } = useAuthenticator((context) => [context.authStatus]);
  const params = useParams();
  const router = useRouter();
  const assetId = params.id as string;
  const { clearPrice } = usePrices();

  const [asset, setAsset] = useState<Asset | null>(null);
  const [isLoading, setIsLoading] = useState(true);
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

  const [entryTargets, setEntryTargets] = useState<EntryTarget[]>([]);
  const [profitTargets, setProfitTargets] = useState<ProfitTarget[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);

  // Auto-dismiss error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const fetchAsset = useCallback(async () => {
    try {
      setError(null);
      const response = await client.models.Asset.get({ id: assetId });

      if (!response.data) {
        setError("Asset not found");
        return;
      }

      const data = response.data;
      setAsset({
        id: data.id,
        symbol: data.symbol,
        name: data.name,
        type: data.type as AssetType,
        testPrice: data.testPrice ?? null,
        commission: data.commission ?? null,
        status: data.status as AssetStatus,
      });

      setFormData({
        symbol: data.symbol,
        name: data.name,
        type: data.type as AssetType,
        testPrice: data.testPrice?.toString() ?? "",
        commission: data.commission?.toString() ?? "",
        status: data.status as AssetStatus,
      });
    } catch (err) {
      console.error("Error fetching asset:", err);
      setError("Failed to load asset");
    } finally {
      setIsLoading(false);
    }
  }, [assetId]);

  const fetchEntryTargets = useCallback(async () => {
    try {
      const response = await client.models.EntryTarget.list({
        filter: { assetId: { eq: assetId } },
      });

      setEntryTargets(
        response.data.map((t) => ({
          id: t.id,
          name: t.name,
          targetPercent: t.targetPercent,
          sortOrder: t.sortOrder,
        }))
      );
    } catch (err) {
      console.error("Error fetching entry targets:", err);
    }
  }, [assetId]);

  const fetchProfitTargets = useCallback(async () => {
    try {
      const response = await client.models.ProfitTarget.list({
        filter: { assetId: { eq: assetId } },
      });

      setProfitTargets(
        response.data.map((t) => ({
          id: t.id,
          name: t.name,
          targetPercent: t.targetPercent,
          allocationPercent: t.allocationPercent ?? null,
          sortOrder: t.sortOrder,
        }))
      );
    } catch (err) {
      console.error("Error fetching profit targets:", err);
    }
  }, [assetId]);

  const fetchBudgets = useCallback(async () => {
    try {
      const response = await client.models.YearlyBudget.list({
        filter: { assetId: { eq: assetId } },
      });

      setBudgets(
        response.data.map((b) => ({
          id: b.id,
          year: b.year,
          amount: b.amount,
        }))
      );
    } catch (err) {
      console.error("Error fetching budgets:", err);
    }
  }, [assetId]);

  useEffect(() => {
    if (authStatus === "authenticated") {
      fetchAsset();
      fetchEntryTargets();
      fetchProfitTargets();
      fetchBudgets();
    }
  }, [authStatus, fetchAsset, fetchEntryTargets, fetchProfitTargets, fetchBudgets]);

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
      const symbol = formData.symbol.trim().toUpperCase();
      const newCommission = formData.commission ? parseFloat(formData.commission) : null;
      const oldCommission = asset?.commission ?? null;
      const commissionChanged = newCommission !== oldCommission;

      await client.models.Asset.update({
        id: assetId,
        symbol,
        name: formData.name.trim(),
        type: formData.type,
        testPrice: formData.testPrice ? parseFloat(formData.testPrice) : null,
        commission: newCommission,
        status: formData.status,
      });

      // Clear cached Yahoo Finance price so testPrice takes precedence
      if (formData.testPrice) {
        clearPrice(symbol);
      }

      // If commission changed, recalculate all wallet profitTargetPrices
      if (commissionChanged) {
        await recalculateWalletProfitTargetPrices(newCommission ?? 0);
      }

      await fetchAsset();
    } catch (err) {
      console.error("Error updating asset:", err);
      setError("Failed to update asset");
    } finally {
      setIsSubmitting(false);
    }
  }

  /**
   * Recalculate profitTargetPrice for all wallets when commission changes.
   * Formula: buyPrice × (1 + PT%) / (1 - commission%)
   */
  async function recalculateWalletProfitTargetPrices(newCommission: number) {
    try {
      // Fetch all wallets for this asset
      const walletResponse = await client.models.Wallet.list({
        filter: { assetId: { eq: assetId } },
        limit: 5000,
      });

      // Fetch profit targets directly from DB to ensure we have the latest data
      // (don't rely on component state which may not be populated yet)
      const ptResponse = await client.models.ProfitTarget.list({
        filter: { assetId: { eq: assetId } },
      });

      // Build a map of profitTargetId -> targetPercent
      const ptPercentMap = new Map<string, number>();
      for (const pt of ptResponse.data) {
        ptPercentMap.set(pt.id, pt.targetPercent);
      }

      // Update each wallet's profitTargetPrice
      for (const wallet of walletResponse.data) {
        const ptPercent = ptPercentMap.get(wallet.profitTargetId) ?? 0;
        const newProfitTargetPrice = wallet.price * (1 + ptPercent / 100) / (1 - newCommission / 100);

        await client.models.Wallet.update({
          id: wallet.id,
          profitTargetPrice: newProfitTargetPrice,
        });
      }

      console.log(`[EditAsset] Recalculated profitTargetPrice for ${walletResponse.data.length} wallets with new commission ${newCommission}%`);
    } catch (err) {
      console.error("Error recalculating wallet profit target prices:", err);
      throw err;
    }
  }

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this asset? This will also delete all transactions, wallets, entry targets, profit targets, and budgets.")) {
      return;
    }

    setIsSubmitting(true);
    try {
      const FETCH_LIMIT = 5000;

      // Delete all transactions and their allocations
      const txnResponse = await client.models.Transaction.list({
        filter: { assetId: { eq: assetId } },
        limit: FETCH_LIMIT,
      });
      for (const txn of txnResponse.data) {
        // Delete allocations for this transaction
        const allocResponse = await client.models.TransactionAllocation.list({
          filter: { transactionId: { eq: txn.id } },
          limit: FETCH_LIMIT,
        });
        for (const alloc of allocResponse.data) {
          await client.models.TransactionAllocation.delete({ id: alloc.id });
        }
        // Delete the transaction
        await client.models.Transaction.delete({ id: txn.id });
      }

      // Delete all wallets
      const walletResponse = await client.models.Wallet.list({
        filter: { assetId: { eq: assetId } },
        limit: FETCH_LIMIT,
      });
      for (const wallet of walletResponse.data) {
        await client.models.Wallet.delete({ id: wallet.id });
      }

      // Delete entry targets
      for (const target of entryTargets) {
        await client.models.EntryTarget.delete({ id: target.id });
      }

      // Delete profit targets
      for (const target of profitTargets) {
        await client.models.ProfitTarget.delete({ id: target.id });
      }

      // Delete budgets
      for (const budget of budgets) {
        await client.models.YearlyBudget.delete({ id: budget.id });
      }

      // Delete asset
      await client.models.Asset.delete({ id: assetId });

      router.push("/assets");
    } catch (err) {
      console.error("Error deleting asset:", err);
      setError("Failed to delete asset");
      setIsSubmitting(false);
    }
  }

  // Entry Target handlers
  async function handleCreateEntryTarget(data: Omit<EntryTarget, "id">) {
    await client.models.EntryTarget.create({
      ...data,
      assetId,
    });
    await fetchEntryTargets();
  }

  async function handleUpdateEntryTarget(id: string, data: Partial<EntryTarget>) {
    await client.models.EntryTarget.update({
      id,
      ...data,
    });
    await fetchEntryTargets();
  }

  async function handleDeleteEntryTarget(id: string) {
    await client.models.EntryTarget.delete({ id });
    await fetchEntryTargets();
  }

  // Profit Target handlers
  async function handleCreateProfitTarget(data: Omit<ProfitTarget, "id">) {
    await client.models.ProfitTarget.create({
      ...data,
      assetId,
    });
    await fetchProfitTargets();
  }

  async function handleUpdateProfitTarget(id: string, data: Partial<ProfitTarget>) {
    await client.models.ProfitTarget.update({
      id,
      ...data,
    });
    await fetchProfitTargets();
  }

  async function handleDeleteProfitTarget(id: string) {
    await client.models.ProfitTarget.delete({ id });
    await fetchProfitTargets();
  }

  // Budget handlers
  async function handleCreateBudget(data: Omit<Budget, "id">) {
    await client.models.YearlyBudget.create({
      ...data,
      assetId,
    });
    await fetchBudgets();
  }

  async function handleUpdateBudget(id: string, data: Partial<Budget>) {
    await client.models.YearlyBudget.update({
      id,
      ...data,
    });
    await fetchBudgets();
  }

  async function handleDeleteBudget(id: string) {
    await client.models.YearlyBudget.delete({ id });
    await fetchBudgets();
  }

  if (isLoading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Loading asset...
      </div>
    );
  }

  if (!asset) {
    return (
      <div>
        <Link
          href="/assets"
          className="text-muted-foreground hover:text-foreground"
        >
          &larr; Back to Assets
        </Link>
        <div className="mt-4 p-4 bg-red-500/20 text-red-400 rounded">
          {error || "Asset not found"}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link
            href="/assets"
            className="text-muted-foreground hover:text-foreground"
          >
            &larr; Back to Assets
          </Link>
          <span className="text-muted-foreground">|</span>
          <Link
            href={`/assets/${assetId}/transactions`}
            data-testid="link-transactions"
            className="text-muted-foreground hover:text-foreground"
          >
            Transactions
          </Link>
        </div>
        <button
          onClick={handleDelete}
          disabled={isSubmitting}
          data-testid="btn-delete-asset"
          className="text-sm text-red-400 hover:text-red-300 disabled:opacity-50"
        >
          Delete Asset
        </button>
      </div>

      <h2 className="text-2xl font-bold text-foreground mb-6">
        Edit {asset.symbol}
      </h2>

      {error && (
        <div className="mb-4 p-3 bg-red-500/20 text-red-400 rounded flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-4 text-red-400 hover:text-red-300"
            aria-label="Dismiss error"
          >
            &times;
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mb-8">
        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          <h3 className="font-medium text-card-foreground border-b border-border pb-2">
            Asset Details
          </h3>

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

          <div className="flex justify-end pt-4 border-t border-border">
            <button
              type="submit"
              disabled={isSubmitting}
              data-testid="asset-form-submit"
              className="px-4 py-2 text-sm bg-foreground text-background rounded hover:opacity-90 disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </form>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TargetList
          type="entry"
          assetId={assetId}
          targets={entryTargets}
          onCreate={handleCreateEntryTarget}
          onUpdate={handleUpdateEntryTarget}
          onDelete={handleDeleteEntryTarget}
          onError={setError}
        />

        <TargetList
          type="profit"
          assetId={assetId}
          targets={profitTargets}
          onCreate={handleCreateProfitTarget}
          onUpdate={handleUpdateProfitTarget}
          onDelete={handleDeleteProfitTarget}
          onError={setError}
        />
      </div>

      <div className="mt-6">
        <BudgetList
          assetId={assetId}
          budgets={budgets}
          onCreate={handleCreateBudget}
          onUpdate={handleUpdateBudget}
          onDelete={handleDeleteBudget}
          onError={setError}
        />
      </div>
    </div>
  );
}
