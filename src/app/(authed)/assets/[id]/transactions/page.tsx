"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { client } from "@/utils/amplify-client";
import { SortableTable, Column } from "@/components/SortableTable";
import { ColumnToggle } from "@/components/ColumnToggle";
import { useColumnVisibility } from "@/hooks/useColumnVisibility";
import { TransactionModal, Transaction, TransactionAllocation } from "@/components/TransactionModal";
import { SellModal, SellData } from "@/components/SellModal";

type TransactionType = "BUY" | "SELL" | "DIVIDEND" | "SPLIT" | "SLP";
type TransactionSignal = "REPULL" | "CUSTOM" | "INITIAL" | "EOM" | "ENTAR" | "TP";

interface Asset {
  id: string;
  symbol: string;
  name: string;
  commission: number | null;
  testPrice: number | null;
}

interface ProfitTarget {
  id: string;
  name: string;
  targetPercent: number;
  sortOrder: number;
}

interface EntryTarget {
  id: string;
  name: string;
  targetPercent: number;
  sortOrder: number;
}

interface TransactionRow {
  id: string;
  date: string;
  assetId: string;
  type: TransactionType;
  signal: TransactionSignal | null;
  quantity: number | null;
  amount: number | null;
  price: number | null;
  investment: number | null;
  splitRatio: number | null;
  entryTargetPrice: number | null;
  entryTargetPercent: number | null;
}

interface WalletRow {
  id: string;
  price: number;
  shares: number;
  investment: number;
  profitTargetId: string;
  profitTargetPrice: number;
}

const SIGNAL_LABELS: Record<TransactionSignal, string> = {
  REPULL: "Recent Pullback",
  CUSTOM: "Custom",
  INITIAL: "Initial",
  EOM: "EOM",
  ENTAR: "EnTar",
  TP: "TP",
};

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatCurrency(value: number | null): string {
  if (value === null) return "-";
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function AssetTransactionsPage() {
  const params = useParams();
  const assetId = params.id as string;

  const [asset, setAsset] = useState<Asset | null>(null);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [profitTargets, setProfitTargets] = useState<ProfitTarget[]>([]);
  const [entryTargets, setEntryTargets] = useState<EntryTarget[]>([]);
  const [wallets, setWallets] = useState<WalletRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProfitTargetId, setSelectedProfitTargetId] = useState<string | null>(null); // null = "All"

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  // Sell modal state
  const [sellWallet, setSellWallet] = useState<WalletRow | null>(null);

  async function handleRowClick(transaction: TransactionRow) {
    // Fetch allocations for BUY transactions
    let allocations: TransactionAllocation[] | undefined;
    if (transaction.type === "BUY") {
      try {
        const response = await client.models.TransactionAllocation.list({
          filter: { transactionId: { eq: transaction.id } },
        });
        allocations = response.data.map((item) => ({
          profitTargetId: item.profitTargetId,
          percentage: item.percentage,
          shares: item.shares,
        }));
      } catch (err) {
        console.error("Error fetching allocations:", err);
      }
    }

    setSelectedTransaction({
      id: transaction.id,
      type: transaction.type,
      date: transaction.date,
      signal: transaction.signal,
      quantity: transaction.quantity,
      amount: transaction.amount,
      splitRatio: transaction.splitRatio,
      price: transaction.price,
      investment: transaction.investment,
      assetId: transaction.assetId,
      allocations,
    });
    setModalMode("edit");
    setIsModalOpen(true);
  }

  const fetchAsset = useCallback(async () => {
    try {
      const response = await client.models.Asset.get({ id: assetId });
      if (response.data) {
        setAsset({
          id: response.data.id,
          symbol: response.data.symbol,
          name: response.data.name,
          commission: response.data.commission ?? null,
          testPrice: response.data.testPrice ?? null,
        });
      }
    } catch (err) {
      console.error("Error fetching asset:", err);
      setError("Failed to load asset");
    }
  }, [assetId]);

  const fetchProfitTargets = useCallback(async () => {
    try {
      const response = await client.models.ProfitTarget.list({
        filter: { assetId: { eq: assetId } },
      });
      const targets = response.data.map((item) => ({
        id: item.id,
        name: item.name,
        targetPercent: item.targetPercent,
        sortOrder: item.sortOrder,
      }));
      setProfitTargets(targets);
    } catch (err) {
      console.error("Error fetching profit targets:", err);
    }
  }, [assetId]);

  const fetchEntryTargets = useCallback(async () => {
    try {
      const response = await client.models.EntryTarget.list({
        filter: { assetId: { eq: assetId } },
      });
      const targets = response.data.map((item) => ({
        id: item.id,
        name: item.name,
        targetPercent: item.targetPercent,
        sortOrder: item.sortOrder,
      }));
      setEntryTargets(targets);
    } catch (err) {
      console.error("Error fetching entry targets:", err);
    }
  }, [assetId]);

  const fetchTransactions = useCallback(async () => {
    try {
      setError(null);
      const response = await client.models.Transaction.list({
        filter: { assetId: { eq: assetId } },
      });

      const transactionData = response.data.map((item) => ({
        id: item.id,
        date: item.date,
        assetId: item.assetId,
        type: item.type as TransactionType,
        signal: (item.signal as TransactionSignal) || null,
        quantity: item.quantity ?? null,
        amount: item.amount ?? null,
        price: item.price ?? null,
        investment: item.investment ?? null,
        splitRatio: item.splitRatio ?? null,
        entryTargetPrice: item.entryTargetPrice ?? null,
        entryTargetPercent: item.entryTargetPercent ?? null,
      }));

      // Sort by date descending (newest first)
      transactionData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setTransactions(transactionData);
    } catch (err) {
      console.error("Error fetching transactions:", err);
      setError("Failed to load transactions");
    } finally {
      setIsLoading(false);
    }
  }, [assetId]);

  const fetchWallets = useCallback(async () => {
    try {
      const response = await client.models.Wallet.list({
        filter: { assetId: { eq: assetId } },
      });
      const walletData = response.data.map((w) => ({
        id: w.id,
        price: w.price,
        shares: w.shares,
        investment: w.investment,
        profitTargetId: w.profitTargetId,
        profitTargetPrice: w.profitTargetPrice,
      }));
      // Sort by price descending
      walletData.sort((a, b) => b.price - a.price);
      setWallets(walletData);
    } catch (err) {
      console.error("Error fetching wallets:", err);
    }
  }, [assetId]);

  // Wallet helper functions - now using composite key (assetId, price, profitTargetId)
  async function findWalletByCompositeKey(price: number, profitTargetId: string) {
    const response = await client.models.Wallet.list({
      filter: {
        assetId: { eq: assetId },
        price: { eq: price },
        profitTargetId: { eq: profitTargetId },
      },
    });
    return response.data[0] || null;
  }

  async function upsertWallet(
    price: number,
    profitTargetId: string,
    investmentDelta: number,
    profitTargetPrice?: number
  ) {
    const existing = await findWalletByCompositeKey(price, profitTargetId);

    if (existing) {
      const newInvestment = existing.investment + investmentDelta;
      const newShares = parseFloat((newInvestment / price).toFixed(5));

      if (newInvestment <= 0) {
        // Delete wallet if no investment left
        await client.models.Wallet.delete({ id: existing.id });
      } else {
        await client.models.Wallet.update({
          id: existing.id,
          investment: newInvestment,
          shares: newShares,
        });
      }
    } else if (investmentDelta > 0 && profitTargetPrice !== undefined) {
      // Create new wallet for this (assetId, price, profitTargetId) combination
      await client.models.Wallet.create({
        assetId,
        price,
        profitTargetId,
        investment: investmentDelta,
        shares: parseFloat((investmentDelta / price).toFixed(5)),
        profitTargetPrice,
      });
    }
  }

  const handleDeleteFromTable = useCallback(async (id: string) => {
    if (!confirm("Are you sure you want to delete this transaction?")) return;

    // Find transaction to get wallet info before deleting
    const txn = transactions.find((t) => t.id === id);

    try {
      // Get allocations before deleting (needed for wallet updates)
      const allocationsResponse = await client.models.TransactionAllocation.list({
        filter: { transactionId: { eq: id } },
      });
      const allocations = allocationsResponse.data;

      // Delete allocations first
      for (const alloc of allocations) {
        await client.models.TransactionAllocation.delete({ id: alloc.id });
      }

      await client.models.Transaction.delete({ id });

      // Update wallets if it was a BUY transaction - one per allocation
      if (txn?.type === "BUY" && txn.price && txn.investment) {
        for (const alloc of allocations) {
          const allocationInvestment = (alloc.percentage / 100) * txn.investment;
          await upsertWallet(txn.price, alloc.profitTargetId, -allocationInvestment);
        }
        await fetchWallets();
      }

      await fetchTransactions();
    } catch {
      setError("Failed to delete transaction");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchTransactions, fetchWallets, transactions]);

  // Find the last (most recent) BUY transaction for ET highlighting
  const lastBuyTransaction = useMemo(() => {
    // transactions are sorted by date descending, so first BUY is the most recent
    return transactions.find((t) => t.type === "BUY") || null;
  }, [transactions]);

  // Get first entry target for column header
  const firstEntryTarget = useMemo(() => {
    if (entryTargets.length === 0) return null;
    return [...entryTargets].sort((a, b) => a.sortOrder - b.sortOrder)[0];
  }, [entryTargets]);

  const columns: Column<TransactionRow>[] = useMemo(
    () => [
      {
        key: "date",
        header: "Date",
        render: (item) => (
          <button
            onClick={() => handleRowClick(item)}
            className="text-blue-400 hover:text-blue-300 hover:underline"
          >
            {formatDate(item.date)}
          </button>
        ),
      },
      {
        key: "type",
        header: "Type",
      },
      {
        key: "signal",
        header: "Signal",
        render: (item) =>
          item.signal ? SIGNAL_LABELS[item.signal] || item.signal : "-",
      },
      {
        key: "quantity",
        header: "Quantity",
        render: (item) => {
          if (item.type === "SPLIT") {
            return item.splitRatio ? `${item.splitRatio}:1` : "-";
          }
          if (item.type === "BUY" || item.type === "SELL") {
            return item.quantity !== null
              ? item.quantity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
              : "-";
          }
          return "-";
        },
      },
      {
        key: "amount",
        header: "Amount",
        render: (item) => {
          if (item.type === "DIVIDEND" || item.type === "SLP" || item.type === "SELL") {
            return item.amount !== null ? formatCurrency(item.amount) : "-";
          }
          return "-";
        },
      },
      {
        key: "price",
        header: "Price",
        render: (item) => formatCurrency(item.price),
      },
      {
        key: "investment",
        header: "Investment",
        render: (item) => formatCurrency(item.investment),
      },
      {
        key: "entryTarget",
        header: firstEntryTarget ? `ET (-${Math.abs(firstEntryTarget.targetPercent)}%)` : "ET",
        render: (item) => {
          if (item.type !== "BUY" || item.entryTargetPrice === null) {
            return "-";
          }
          const isLastBuy = lastBuyTransaction?.id === item.id;
          const shouldHighlight = isLastBuy && asset?.testPrice !== null && asset?.testPrice !== undefined && asset.testPrice <= item.entryTargetPrice;
          return (
            <span className={shouldHighlight ? "text-green-400 font-medium" : ""}>
              {formatCurrency(item.entryTargetPrice)}
            </span>
          );
        },
      },
      {
        key: "actions",
        header: "",
        sortable: false,
        toggleable: false,
        render: (item) => (
          <button
            onClick={() => handleDeleteFromTable(item.id)}
            className="text-muted-foreground hover:text-red-400 p-1"
            aria-label="Delete transaction"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        ),
      },
    ],
    [handleDeleteFromTable, firstEntryTarget, lastBuyTransaction, asset]
  );

  // Column visibility toggle
  const { visibleKeys, hiddenColumns, toggle: toggleColumn } = useColumnVisibility(
    columns,
    { storageKey: "transactions-columns" }
  );

  // Wallet columns - include Action column only on PT tabs (not on "All" tab)
  const walletColumns = useMemo(() => {
    const baseColumns: Column<WalletRow>[] = [
      {
        key: "price",
        header: "Price",
        render: (item) => formatCurrency(item.price),
      },
      {
        key: "shares",
        header: "Shares",
        render: (item) =>
          item.shares.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      },
      {
        key: "investment",
        header: "Investment",
        render: (item) => formatCurrency(item.investment),
      },
    ];

    // Add Action column only when viewing a specific PT (not "All" tab)
    if (selectedProfitTargetId !== null) {
      baseColumns.push({
        key: "action",
        header: "Action",
        sortable: false,
        render: (item) => (
          <button
            onClick={() => setSellWallet(item)}
            className="text-red-400 hover:text-red-300 hover:underline text-sm"
          >
            Sell
          </button>
        ),
      });
    }

    return baseColumns;
  }, [selectedProfitTargetId]);

  // Filter/aggregate wallets based on selected profit target tab
  const displayWallets = useMemo((): WalletRow[] => {
    if (selectedProfitTargetId === null) {
      // "All" tab: aggregate wallets by price (sum across all PTs)
      const aggregated = wallets.reduce((acc, wallet) => {
        const key = wallet.price;
        if (!acc[key]) {
          acc[key] = { id: `agg-${key}`, price: wallet.price, shares: 0, investment: 0, profitTargetId: "", profitTargetPrice: 0 };
        }
        acc[key].shares += wallet.shares;
        acc[key].investment += wallet.investment;
        return acc;
      }, {} as Record<number, WalletRow>);
      return Object.values(aggregated).sort((a, b) => b.price - a.price);
    } else {
      // Specific PT tab: filter wallets for that PT
      return wallets
        .filter((w) => w.profitTargetId === selectedProfitTargetId)
        .sort((a, b) => b.price - a.price);
    }
  }, [wallets, selectedProfitTargetId]);

  // Count wallets per profit target
  const walletCountByPT = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const wallet of wallets) {
      counts[wallet.profitTargetId] = (counts[wallet.profitTargetId] || 0) + 1;
    }
    return counts;
  }, [wallets]);

  // Calculate which PTs are "hit" based on lowest profitTargetPrice
  const hitProfitTargetIds = useMemo(() => {
    if (!asset?.testPrice) return new Set<string>();

    const hitIds = new Set<string>();

    for (const pt of profitTargets) {
      // Get wallets for this PT
      const ptWallets = wallets.filter((w) => w.profitTargetId === pt.id);
      if (ptWallets.length === 0) continue;

      // Find lowest profitTargetPrice (from lowest buy price wallet)
      const lowestTargetPrice = Math.min(...ptWallets.map((w) => w.profitTargetPrice));

      // Check if current price meets target
      if (asset.testPrice >= lowestTargetPrice) {
        hitIds.add(pt.id);
      }
    }

    return hitIds;
  }, [asset?.testPrice, profitTargets, wallets]);

  useEffect(() => {
    fetchAsset();
    fetchTransactions();
    fetchProfitTargets();
    fetchEntryTargets();
    fetchWallets();
  }, [fetchAsset, fetchTransactions, fetchProfitTargets, fetchEntryTargets, fetchWallets]);

  function handleNewTransaction() {
    setSelectedTransaction(null);
    setModalMode("create");
    setIsModalOpen(true);
  }

  async function handleSave(data: Omit<Transaction, "id">) {
    // Always use the current asset ID
    const { allocations, ...transactionFields } = data;
    const transactionData = { ...transactionFields, assetId };

    try {
      let transactionId: string;

      if (modalMode === "create") {
        const result = await client.models.Transaction.create(transactionData);
        if (result.errors) {
          console.error("Create errors:", result.errors);
          setError("Failed to create transaction: " + result.errors.map(e => e.message).join(", "));
          return;
        }
        transactionId = result.data!.id;
      } else if (selectedTransaction) {
        // For BUY edits, subtract old values from old wallets (per allocation) before updating
        if (selectedTransaction.type === "BUY" && selectedTransaction.price && selectedTransaction.investment) {
          const oldAllocations = await client.models.TransactionAllocation.list({
            filter: { transactionId: { eq: selectedTransaction.id } },
          });
          for (const alloc of oldAllocations.data) {
            const allocationInvestment = (alloc.percentage / 100) * selectedTransaction.investment;
            await upsertWallet(selectedTransaction.price, alloc.profitTargetId, -allocationInvestment);
          }
          // Delete old allocations
          for (const alloc of oldAllocations.data) {
            await client.models.TransactionAllocation.delete({ id: alloc.id });
          }
        }

        const result = await client.models.Transaction.update({
          id: selectedTransaction.id,
          ...transactionData,
        });
        if (result.errors) {
          console.error("Update errors:", result.errors);
          setError("Failed to update transaction: " + result.errors.map(e => e.message).join(", "));
          return;
        }
        transactionId = selectedTransaction.id;
      } else {
        return;
      }

      // Create new allocations and wallets for BUY transactions
      if (data.type === "BUY" && allocations && allocations.length > 0 && data.price && data.investment) {
        const commission = asset?.commission ?? 0;

        for (const alloc of allocations) {
          // Create allocation record
          await client.models.TransactionAllocation.create({
            transactionId,
            profitTargetId: alloc.profitTargetId,
            percentage: alloc.percentage,
            shares: alloc.shares,
          });

          // Calculate profitTargetPrice for this wallet
          const pt = profitTargets.find((p) => p.id === alloc.profitTargetId);
          const ptPercent = pt?.targetPercent ?? 0;
          // Formula: buyPrice × (1 + PT%) / (1 - commission%)
          const profitTargetPrice = data.price * (1 + ptPercent / 100) / (1 - commission / 100);

          // Create/update wallet for this profit target
          const allocationInvestment = (alloc.percentage / 100) * data.investment;
          await upsertWallet(data.price, alloc.profitTargetId, allocationInvestment, profitTargetPrice);
        }
        await fetchWallets();
      }

      await fetchTransactions();
    } catch (err) {
      console.error("Save error:", err);
      setError("Failed to save transaction");
    }
  }

  async function handleDelete(id: string) {
    // Find transaction to get wallet info before deleting
    const txn = transactions.find((t) => t.id === id);

    // Get and delete allocations first (needed for wallet updates)
    try {
      const allocationsResponse = await client.models.TransactionAllocation.list({
        filter: { transactionId: { eq: id } },
      });
      const allocations = allocationsResponse.data;

      for (const alloc of allocations) {
        await client.models.TransactionAllocation.delete({ id: alloc.id });
      }

      await client.models.Transaction.delete({ id });

      // Update wallets if it was a BUY transaction - one per allocation
      if (txn?.type === "BUY" && txn.price && txn.investment) {
        for (const alloc of allocations) {
          const allocationInvestment = (alloc.percentage / 100) * txn.investment;
          await upsertWallet(txn.price, alloc.profitTargetId, -allocationInvestment);
        }
        await fetchWallets();
      }
    } catch (err) {
      console.error("Error deleting transaction:", err);
    }

    await fetchTransactions();
  }

  // Handle sell from wallet
  async function handleSell(data: SellData) {
    if (!sellWallet) return;

    try {
      // 1. Create SELL transaction with walletId
      const result = await client.models.Transaction.create({
        type: "SELL",
        date: data.date,
        signal: data.signal,
        price: data.price,
        quantity: data.quantity,
        amount: data.netProceeds,
        walletId: sellWallet.id,
        assetId,
      });

      if (result.errors) {
        console.error("Create SELL errors:", result.errors);
        setError("Failed to create sell transaction: " + result.errors.map(e => e.message).join(", "));
        return;
      }

      // 2. Update wallet - reduce shares and investment
      const newShares = sellWallet.shares - data.quantity;
      if (newShares <= 0) {
        // Delete wallet if no shares left
        await client.models.Wallet.delete({ id: sellWallet.id });
      } else {
        // Update wallet with remaining shares
        const newInvestment = newShares * sellWallet.price;
        await client.models.Wallet.update({
          id: sellWallet.id,
          shares: parseFloat(newShares.toFixed(5)),
          investment: newInvestment,
        });
      }

      // 3. Refresh data and close modal
      await fetchWallets();
      await fetchTransactions();
      setSellWallet(null);
    } catch (err) {
      console.error("Sell error:", err);
      setError("Failed to process sell transaction");
    }
  }

  // Auto-dismiss error
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  if (isLoading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Loading transactions...
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
            href={`/assets/${assetId}`}
            className="text-muted-foreground hover:text-foreground"
          >
            Edit Asset
          </Link>
        </div>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            {asset ? `${asset.symbol} ${asset.name}` : "..."}
          </h2>
          {asset?.testPrice !== null && asset?.testPrice !== undefined && (
            <p className="text-muted-foreground">
              {formatCurrency(asset.testPrice)}
            </p>
          )}
        </div>
        <button
          onClick={handleNewTransaction}
          className="px-4 py-2 text-sm bg-foreground text-background rounded hover:opacity-90"
        >
          New Transaction
        </button>
      </div>

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

      {/* Wallets Section with PT Tabs */}
      {(wallets.length > 0 || profitTargets.length > 0) && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-foreground mb-4">Wallets</h3>

          {/* Profit Target Tabs */}
          <div className="flex gap-2 mb-4 flex-wrap">
            <button
              onClick={() => setSelectedProfitTargetId(null)}
              className={`px-3 py-1.5 text-sm rounded transition-colors ${
                selectedProfitTargetId === null
                  ? "bg-blue-600 text-white"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              All{wallets.length > 0 && ` (${wallets.length})`}
            </button>
            {profitTargets
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((pt) => {
                const count = walletCountByPT[pt.id] || 0;
                const isHit = hitProfitTargetIds.has(pt.id);
                return (
                  <button
                    key={pt.id}
                    onClick={() => setSelectedProfitTargetId(pt.id)}
                    className={`px-3 py-1.5 text-sm rounded transition-colors ${
                      selectedProfitTargetId === pt.id
                        ? "bg-blue-600 text-white"
                        : isHit
                          ? "bg-card border border-green-500 text-green-400 font-medium"
                          : "bg-card border border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {pt.name}{count > 0 && ` (${count})`}
                  </button>
                );
              })}
          </div>

          <div className="bg-card border border-border rounded-lg">
            <SortableTable
              data={displayWallets}
              columns={walletColumns}
              keyField="id"
              emptyMessage={
                selectedProfitTargetId === null
                  ? "No wallets yet."
                  : "No wallets for this profit target."
              }
            />
          </div>
        </div>
      )}

      {/* Transactions Table */}
      <h3 className="text-lg font-semibold text-foreground mb-4">Transactions</h3>
      <ColumnToggle
        columns={columns}
        visibleKeys={visibleKeys}
        onToggle={toggleColumn}
      />

      <div className="bg-card border border-border rounded-lg">
        <SortableTable
          data={transactions}
          columns={columns}
          keyField="id"
          emptyMessage="No transactions yet. Click 'New Transaction' to add one."
          hiddenColumns={hiddenColumns}
        />
      </div>

      {asset && (
        <TransactionModal
          isOpen={isModalOpen}
          mode={modalMode}
          transaction={selectedTransaction}
          assets={[asset]}
          profitTargets={profitTargets}
          entryTargets={entryTargets}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}

      {/* Sell Modal */}
      <SellModal
        isOpen={sellWallet !== null}
        wallet={sellWallet}
        asset={asset}
        onClose={() => setSellWallet(null)}
        onSave={handleSell}
      />
    </div>
  );
}
