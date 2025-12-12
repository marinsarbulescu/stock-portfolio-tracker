"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { client } from "@/utils/amplify-client";
import { SortableTable, Column } from "@/components/SortableTable";
import { ColumnToggle } from "@/components/ColumnToggle";
import { useColumnVisibility } from "@/hooks/useColumnVisibility";
import { TransactionModal, Transaction, TransactionAllocation } from "@/components/TransactionModal";

type TransactionType = "BUY" | "SELL" | "DIVIDEND" | "SPLIT" | "SLP";
type TransactionSignal = "REPULL" | "CUSTOM" | "INITIAL" | "EOM" | "ENTAR" | "TP";

interface Asset {
  id: string;
  symbol: string;
  name: string;
}

interface ProfitTarget {
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
}

interface WalletRow {
  id: string;
  price: number;
  shares: number;
  investment: number;
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
  const [wallets, setWallets] = useState<WalletRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

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
      }));
      // Sort by price descending
      walletData.sort((a, b) => b.price - a.price);
      setWallets(walletData);
    } catch (err) {
      console.error("Error fetching wallets:", err);
    }
  }, [assetId]);

  // Wallet helper functions
  async function findWalletByPrice(price: number) {
    const response = await client.models.Wallet.list({
      filter: {
        assetId: { eq: assetId },
        price: { eq: price },
      },
    });
    return response.data[0] || null;
  }

  async function upsertWallet(price: number, investmentDelta: number) {
    const existing = await findWalletByPrice(price);

    if (existing) {
      const newInvestment = existing.investment + investmentDelta;
      const newShares = newInvestment / price;

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
    } else if (investmentDelta > 0) {
      // Create new wallet
      await client.models.Wallet.create({
        assetId,
        price,
        investment: investmentDelta,
        shares: investmentDelta / price,
      });
    }
  }

  const handleDeleteFromTable = useCallback(async (id: string) => {
    if (!confirm("Are you sure you want to delete this transaction?")) return;

    // Find transaction to get wallet info before deleting
    const txn = transactions.find((t) => t.id === id);

    try {
      // Delete allocations first
      const allocationsResponse = await client.models.TransactionAllocation.list({
        filter: { transactionId: { eq: id } },
      });
      for (const alloc of allocationsResponse.data) {
        await client.models.TransactionAllocation.delete({ id: alloc.id });
      }

      await client.models.Transaction.delete({ id });

      // Update wallet if it was a BUY transaction
      if (txn?.type === "BUY" && txn.price && txn.investment) {
        await upsertWallet(txn.price, -txn.investment);
        await fetchWallets();
      }

      await fetchTransactions();
    } catch {
      setError("Failed to delete transaction");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchTransactions, fetchWallets, transactions]);

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
              ? item.quantity.toLocaleString(undefined, { maximumFractionDigits: 4 })
              : "-";
          }
          return "-";
        },
      },
      {
        key: "amount",
        header: "Amount",
        render: (item) => {
          if (item.type === "DIVIDEND" || item.type === "SLP") {
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
    [handleDeleteFromTable]
  );

  // Column visibility toggle
  const { visibleKeys, hiddenColumns, toggle: toggleColumn } = useColumnVisibility(
    columns,
    { storageKey: "transactions-columns" }
  );

  // Wallet columns
  const walletColumns: Column<WalletRow>[] = useMemo(
    () => [
      {
        key: "price",
        header: "Price",
        render: (item) => formatCurrency(item.price),
      },
      {
        key: "shares",
        header: "Shares",
        render: (item) =>
          item.shares.toLocaleString(undefined, { maximumFractionDigits: 4 }),
      },
      {
        key: "investment",
        header: "Investment",
        render: (item) => formatCurrency(item.investment),
      },
    ],
    []
  );

  useEffect(() => {
    fetchAsset();
    fetchTransactions();
    fetchProfitTargets();
    fetchWallets();
  }, [fetchAsset, fetchTransactions, fetchProfitTargets, fetchWallets]);

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
        // For BUY edits, subtract old values from old wallet before updating
        if (selectedTransaction.type === "BUY" && selectedTransaction.price && selectedTransaction.investment) {
          await upsertWallet(selectedTransaction.price, -selectedTransaction.investment);
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

        // Delete old allocations when editing
        if (data.type === "BUY") {
          const existingAllocations = await client.models.TransactionAllocation.list({
            filter: { transactionId: { eq: transactionId } },
          });
          for (const alloc of existingAllocations.data) {
            await client.models.TransactionAllocation.delete({ id: alloc.id });
          }
        }
      } else {
        return;
      }

      // Create new allocations for BUY transactions
      if (data.type === "BUY" && allocations && allocations.length > 0) {
        for (const alloc of allocations) {
          await client.models.TransactionAllocation.create({
            transactionId,
            profitTargetId: alloc.profitTargetId,
            percentage: alloc.percentage,
            shares: alloc.shares,
          });
        }
      }

      // Update wallet for BUY transactions
      if (data.type === "BUY" && data.price && data.investment) {
        await upsertWallet(data.price, data.investment);
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

    // Delete allocations first
    try {
      const allocations = await client.models.TransactionAllocation.list({
        filter: { transactionId: { eq: id } },
      });
      for (const alloc of allocations.data) {
        await client.models.TransactionAllocation.delete({ id: alloc.id });
      }
    } catch (err) {
      console.error("Error deleting allocations:", err);
    }

    await client.models.Transaction.delete({ id });

    // Update wallet if it was a BUY transaction
    if (txn?.type === "BUY" && txn.price && txn.investment) {
      await upsertWallet(txn.price, -txn.investment);
      await fetchWallets();
    }

    await fetchTransactions();
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
        <h2 className="text-2xl font-bold text-foreground">
          {asset?.symbol || "..."} Transactions
        </h2>
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

      {/* Wallets Table */}
      {wallets.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-foreground mb-4">Wallets</h3>
          <div className="bg-card border border-border rounded-lg">
            <SortableTable
              data={wallets}
              columns={walletColumns}
              keyField="id"
              emptyMessage="No wallets yet."
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
          onClose={() => setIsModalOpen(false)}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
