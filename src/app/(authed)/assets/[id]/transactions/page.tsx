"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuthenticator } from "@aws-amplify/ui-react";
import { client } from "@/utils/amplify-client";
import { usePrices } from "@/contexts/PriceContext";
import { getEffectivePrice } from "@/utils/price-utils";
import { getPct2PTColor } from "@/utils/dashboard-calculations";
import { recalculateAssetFinancials } from "@/utils/asset-financials";
import { SortableTable, Column } from "@/components/SortableTable";
import { ColumnToggle } from "@/components/ColumnToggle";
import { useColumnVisibility } from "@/hooks/useColumnVisibility";
import { TransactionModal, Transaction, TransactionAllocation } from "@/components/TransactionModal";
import { SellModal, SellData } from "@/components/SellModal";

type TransactionType = "BUY" | "SELL" | "DIVIDEND" | "SPLIT" | "SLP";
type TransactionSignal = "REPULL" | "CUSTOM" | "INITIAL" | "EOM" | "ENTAR" | "PROFITTARGET";

interface Asset {
  id: string;
  symbol: string;
  name: string;
  buyFee: number | null;
  sellFee: number | null;
  testPrice: number | null;
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
  costBasis: number | null;
  walletId: string | null;
  walletPrice: number | null;
  profitTargetPercent: number | null;
}

interface AllocationInfo {
  profitTargetId: string;
  walletId: string;
  percentage: number;
}

interface WalletRow {
  id: string;
  price: number;
  shares: number;
  investment: number;
  profitTargetId: string;
  profitTargetPrice: number;
  originalShares?: number | null; // Deprecated: kept for backward compatibility
}

const SIGNAL_LABELS: Record<TransactionSignal, string> = {
  REPULL: "Recent Pullback",
  CUSTOM: "Custom",
  INITIAL: "Initial",
  EOM: "EOM",
  ENTAR: "Entry Target",
  PROFITTARGET: "Profit Target",
};

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatCurrency(value: number | null): string {
  if (value === null) return "-";
  const absValue = Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return value < 0 ? `-$${absValue}` : `$${absValue}`;
}

// Helper function to apply a split to all wallets (direct mutation)
// On split: shares *= ratio, price /= ratio, profitTargetPrice /= ratio
// Investment stays the same (shares × price = constant)
async function applySplitToWallets(assetId: string, ratio: number): Promise<number> {
  try {
    const walletsResponse = await client.models.Wallet.list({
      filter: { assetId: { eq: assetId } },
      limit: 5000
    });

    let updatedCount = 0;

    for (const wallet of walletsResponse.data) {
      const newShares = parseFloat((wallet.shares * ratio).toFixed(5));
      const newPrice = parseFloat((wallet.price / ratio).toFixed(5));
      const newPTPrice = parseFloat((wallet.profitTargetPrice / ratio).toFixed(5));

      await client.models.Wallet.update({
        id: wallet.id,
        shares: newShares,
        price: newPrice,
        profitTargetPrice: newPTPrice,
        // Investment stays the same (shares × price = constant)
      });
      updatedCount++;
    }

    console.log(`Applied split (${ratio}:1) to ${updatedCount} wallet(s)`);
    return updatedCount;
  } catch (error) {
    console.error(`Error applying split to wallets:`, error);
    throw error;
  }
}

// Helper function to reverse a split on all wallets
// Reverse: shares /= ratio, price *= ratio, profitTargetPrice *= ratio
async function reverseSplitOnWallets(assetId: string, ratio: number): Promise<number> {
  try {
    const walletsResponse = await client.models.Wallet.list({
      filter: { assetId: { eq: assetId } },
      limit: 5000
    });

    let updatedCount = 0;

    for (const wallet of walletsResponse.data) {
      const newShares = parseFloat((wallet.shares / ratio).toFixed(5));
      const newPrice = parseFloat((wallet.price * ratio).toFixed(5));
      const newPTPrice = parseFloat((wallet.profitTargetPrice * ratio).toFixed(5));

      await client.models.Wallet.update({
        id: wallet.id,
        shares: newShares,
        price: newPrice,
        profitTargetPrice: newPTPrice,
        // Investment stays the same
      });
      updatedCount++;
    }

    console.log(`Reversed split (${ratio}:1) on ${updatedCount} wallet(s)`);
    return updatedCount;
  } catch (error) {
    console.error(`Error reversing split on wallets:`, error);
    throw error;
  }
}

export default function AssetTransactionsPage() {
  const { authStatus } = useAuthenticator((context) => [context.authStatus]);
  const params = useParams();
  const assetId = params.id as string;
  const { prices } = usePrices();

  const [asset, setAsset] = useState<Asset | null>(null);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [profitTargets, setProfitTargets] = useState<ProfitTarget[]>([]);
  const [entryTargets, setEntryTargets] = useState<EntryTarget[]>([]);
  const [wallets, setWallets] = useState<WalletRow[]>([]);
  const [allocationsMap, setAllocationsMap] = useState<Map<string, AllocationInfo[]>>(new Map());
  const [maxOOP, setMaxOOP] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProfitTargetId, setSelectedProfitTargetId] = useState<string | null>(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  // Sell modal state
  const [sellWallet, setSellWallet] = useState<WalletRow | null>(null);

  // Delete all state
  const [isDeleting, setIsDeleting] = useState(false);

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
      walletId: transaction.walletId,
      walletPrice: transaction.walletPrice,
      profitTargetPercent: transaction.profitTargetPercent,
      costBasis: transaction.costBasis,
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
          buyFee: response.data.buyFee ?? null,
          sellFee: response.data.sellFee ?? null,
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
        allocationPercent: item.allocationPercent ?? null,
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
        costBasis: item.costBasis ?? null,
        walletId: item.walletId ?? null,
        walletPrice: item.walletPrice ?? null,
        profitTargetPercent: item.profitTargetPercent ?? null,
      }));

      // Sort by date descending (newest first)
      transactionData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setTransactions(transactionData);

      // Fetch allocations for all BUY transactions
      const buyTxnIds = transactionData.filter(t => t.type === "BUY").map(t => t.id);
      if (buyTxnIds.length > 0) {
        const allocMap = new Map<string, AllocationInfo[]>();
        for (const txnId of buyTxnIds) {
          const allocResponse = await client.models.TransactionAllocation.list({
            filter: { transactionId: { eq: txnId } },
          });
          if (allocResponse.data.length > 0) {
            allocMap.set(txnId, allocResponse.data.map(a => ({
              profitTargetId: a.profitTargetId,
              walletId: a.walletId,
              percentage: a.percentage,
            })));
          }
        }
        setAllocationsMap(allocMap);
      }
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
        originalShares: w.originalShares,
      }));
      // Sort by price ascending (lowest price first)
      walletData.sort((a, b) => a.price - b.price);
      setWallets(walletData);
    } catch (err) {
      console.error("Error fetching wallets:", err);
    }
  }, [assetId]);

  const fetchMaxOOP = useCallback(async () => {
    try {
      const currentYear = new Date().getFullYear();
      const response = await client.models.YearlyBudget.list({
        filter: {
          assetId: { eq: assetId },
          year: { eq: currentYear },
        },
      });
      if (response.data.length > 0) {
        setMaxOOP(response.data[0].amount);
      } else {
        setMaxOOP(null);
      }
    } catch (err) {
      console.error("Error fetching yearly budget:", err);
    }
  }, [assetId]);

  // Wallet helper functions - now using composite key (assetId, price, profitTargetId)
  const findWalletByCompositeKey = useCallback(async (price: number, profitTargetId: string) => {
    const response = await client.models.Wallet.list({
      filter: {
        assetId: { eq: assetId },
        price: { eq: price },
        profitTargetId: { eq: profitTargetId },
      },
    });
    return response.data[0] || null;
  }, [assetId]);

  const upsertWallet = useCallback(async (
    price: number,
    profitTargetId: string,
    investmentDelta: number,
    profitTargetPrice?: number
  ): Promise<string | undefined> => {
    const existing = await findWalletByCompositeKey(price, profitTargetId);

    if (existing) {
      const newInvestment = existing.investment + investmentDelta;
      const newShares = parseFloat((newInvestment / price).toFixed(5));

      if (newInvestment <= 0) {
        // Delete wallet if no investment left
        await client.models.Wallet.delete({ id: existing.id });
        return undefined;
      } else {
        await client.models.Wallet.update({
          id: existing.id,
          investment: newInvestment,
          shares: newShares,
        });
        return existing.id;
      }
    } else if (investmentDelta > 0 && profitTargetPrice !== undefined) {
      // Create new wallet for this (assetId, price, profitTargetId) combination
      const shares = parseFloat((investmentDelta / price).toFixed(5));
      const result = await client.models.Wallet.create({
        assetId,
        price,
        profitTargetId,
        investment: investmentDelta,
        shares,
        profitTargetPrice,
        // Legacy fields - kept for backward compatibility with existing schema
        originalShares: shares,
        originalPrice: price,
        originalProfitTargetPrice: profitTargetPrice,
      });
      return result.data?.id;
    }
    return undefined;
  }, [assetId, findWalletByCompositeKey]);

  // Core delete logic (no confirmation dialog)
  const handleDeleteTransaction = useCallback(async (id: string) => {
    // Find transaction to get wallet info before deleting
    const txn = transactions.find((t) => t.id === id);
    if (!txn) return;

    // For SELL transactions, special handling
    if (txn.type === "SELL") {
      // Validate required data for wallet restoration
      if (!txn.walletId || !txn.walletPrice || !txn.quantity || txn.profitTargetPercent === null) {
        alert("Cannot delete: missing wallet restoration data.");
        return;
      }

      // Find PT by percentage
      const pt = profitTargets.find(p => p.targetPercent === txn.profitTargetPercent);
      if (!pt) {
        alert("Cannot delete: the Profit Target for this transaction no longer exists.");
        return;
      }

      try {
        // Calculate wallet data
        const buyPrice = txn.walletPrice;
        const sharesToRestore = txn.quantity;
        const investmentToRestore = buyPrice * sharesToRestore;
        const sellFee = asset?.sellFee ?? 0;
        const profitTargetPrice = parseFloat((buyPrice * (1 + pt.targetPercent / 100) / (1 - sellFee / 100)).toFixed(5));

        // First try to find wallet by original ID
        let existingWallet = wallets.find(w => w.id === txn.walletId);
        const oldWalletId = txn.walletId;

        // If not found by ID, check for wallet with same price and profit target
        if (!existingWallet) {
          existingWallet = wallets.find(w => w.price === buyPrice && w.profitTargetId === pt.id);
        }

        if (existingWallet) {
          // Update existing wallet - add shares back
          await client.models.Wallet.update({
            id: existingWallet.id,
            shares: existingWallet.shares + sharesToRestore,
            investment: existingWallet.investment + investmentToRestore,
          });

          // Update TransactionAllocations that pointed to old wallet ID to point to existing wallet
          if (existingWallet.id !== oldWalletId) {
            const allocResponse = await client.models.TransactionAllocation.list({
              filter: { walletId: { eq: oldWalletId } },
            });
            for (const alloc of allocResponse.data) {
              await client.models.TransactionAllocation.update({
                id: alloc.id,
                walletId: existingWallet.id,
              });
            }
          }
        } else {
          // Create new wallet only if no matching wallet exists
          const newWallet = await client.models.Wallet.create({
            assetId,
            price: buyPrice,
            shares: sharesToRestore,
            investment: investmentToRestore,
            profitTargetId: pt.id,
            profitTargetPrice,
            // Legacy fields - kept for backward compatibility
            originalShares: sharesToRestore,
            originalPrice: buyPrice,
            originalProfitTargetPrice: profitTargetPrice,
          });

          // Update TransactionAllocations that pointed to old wallet
          if (newWallet.data?.id) {
            const allocResponse = await client.models.TransactionAllocation.list({
              filter: { walletId: { eq: oldWalletId } },
            });
            for (const alloc of allocResponse.data) {
              await client.models.TransactionAllocation.update({
                id: alloc.id,
                walletId: newWallet.data.id,
              });
            }
          }
        }

        // Delete the SELL transaction
        await client.models.Transaction.delete({ id });
        await recalculateAssetFinancials(assetId);
        await fetchTransactions();
        await fetchWallets();
      } catch (err) {
        console.error("Error deleting SELL transaction:", err);
        setError("Failed to delete SELL transaction");
      }
      return;
    }

    // For SPLIT transactions, check for subsequent transactions
    if (txn.type === "SPLIT") {
      const hasSubsequentTxns = transactions.some(
        (t) => t.id !== id && new Date(t.date) > new Date(txn.date)
      );
      if (hasSubsequentTxns) {
        setError("Cannot delete this SPLIT transaction because there are subsequent transactions.");
        return;
      }

      try {
        // Reverse the split on all wallets before deleting
        if (txn.splitRatio) {
          await reverseSplitOnWallets(assetId, txn.splitRatio);
        }

        // Delete the split transaction
        await client.models.Transaction.delete({ id });

        await fetchWallets();
        await fetchTransactions();
      } catch (err) {
        console.error("Error deleting SPLIT transaction:", err);
        setError("Failed to delete SPLIT transaction");
      }
      return;
    }

    // For non-SELL, non-SPLIT transactions (BUY, DIVIDEND, SLP)
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
      if (txn.type === "BUY" && txn.price && txn.investment) {
        for (const alloc of allocations) {
          const allocationInvestment = (alloc.percentage / 100) * txn.investment;
          await upsertWallet(txn.price, alloc.profitTargetId, -allocationInvestment);
        }
        await fetchWallets();
      }

      await recalculateAssetFinancials(assetId);
      await fetchTransactions();
    } catch {
      setError("Failed to delete transaction");
    }
  }, [transactions, profitTargets, asset?.sellFee, wallets, assetId, fetchTransactions, fetchWallets, upsertWallet]);

  // Wrapper with confirmation dialog for table delete button
  const handleDeleteFromTable = useCallback(async (id: string) => {
    if (!confirm("Are you sure you want to delete this transaction?")) return;
    await handleDeleteTransaction(id);
  }, [handleDeleteTransaction]);

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

  // Calculate effective price and whether it's a test price
  const { effectivePrice, isTestPrice } = useMemo(() => {
    if (!asset) return { effectivePrice: null, isTestPrice: false };

    const price = getEffectivePrice(asset.symbol, prices, asset.testPrice);
    const priceData = prices[asset.symbol];
    const isTest =
      price !== null &&
      (!priceData ||
        priceData.currentPrice === null ||
        priceData.currentPrice === 0);

    return { effectivePrice: price, isTestPrice: isTest };
  }, [asset, prices]);

  // Calculate balance and OOP by processing transactions chronologically
  // balance: running net position (negative = invested, positive = cash available)
  // oop: maximum out-of-pocket investment (tracks the deepest investment point)
  const { balance, oop } = useMemo(() => {
    // Sort by date ascending (oldest first)
    const sorted = [...transactions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    let balance = 0;
    let oop = 0;

    for (const txn of sorted) {
      if (txn.type === "BUY" && txn.investment !== null) {
        balance -= txn.investment;
        oop = Math.max(oop, Math.abs(balance));
      } else if ((txn.type === "SELL" || txn.type === "DIVIDEND" || txn.type === "SLP") && txn.amount !== null) {
        balance += txn.amount;
      }
    }

    return { balance, oop };
  }, [transactions]);

  // Derived value for display
  const cashBalance = oop + balance;

  // Calculate transaction counts and shares
  const txnStats = useMemo(() => {
    let buyCount = 0;
    let sellCount = 0;

    for (const txn of transactions) {
      if (txn.type === "BUY") {
        buyCount++;
      } else if (txn.type === "SELL") {
        sellCount++;
      }
    }

    // Total shares from wallets (current holdings)
    const totalShares = wallets.reduce((sum, w) => sum + w.shares, 0);

    // Shares per profit target
    const sharesByPT: Record<string, number> = {};
    for (const wallet of wallets) {
      sharesByPT[wallet.profitTargetId] = (sharesByPT[wallet.profitTargetId] || 0) + wallet.shares;
    }

    return { buyCount, sellCount, totalShares, sharesByPT };
  }, [transactions, wallets]);

  // Helper to capitalize type values (BUY -> Buy)
  const formatType = (type: string) => {
    return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
  };

  const columns: Column<TransactionRow>[] = useMemo(
    () => {
      const hasSubsequentTransactions = (txn: TransactionRow) => {
        return transactions.some(
          (t) => t.id !== txn.id && new Date(t.date) > new Date(txn.date)
        );
      };

      return [
      {
        key: "date",
        header: "Date",
        defaultHidden: true,
        render: (item) => (
          <button
            onClick={() => handleRowClick(item)}
            data-testid={`transaction-edit-${item.id}`}
            className="text-blue-400 hover:text-blue-300 hover:underline"
          >
            {formatDate(item.date)}
          </button>
        ),
      },
      {
        key: "type",
        header: "Type",
        render: (item) => <span data-testid="txn-type">{formatType(item.type)}</span>,
      },
      {
        key: "signal",
        header: "Signal",
        render: (item) => (
          <span data-testid="txn-signal">
            {item.signal ? SIGNAL_LABELS[item.signal] || item.signal : "-"}
          </span>
        ),
      },
      {
        key: "price",
        header: "Price",
        render: (item) => <span data-testid="txn-price">{formatCurrency(item.price)}</span>,
      },
      {
        key: "quantity",
        header: "Quantity",
        render: (item) => {
          let content: string;
          if (item.type === "SPLIT") {
            content = item.splitRatio ? `${item.splitRatio}:1` : "-";
          } else if (item.type === "BUY" || item.type === "SELL") {
            content = item.quantity !== null
              ? item.quantity.toLocaleString(undefined, { minimumFractionDigits: 5, maximumFractionDigits: 5 })
              : "-";
          } else {
            content = "-";
          }
          return <span data-testid="txn-quantity">{content}</span>;
        },
      },
      {
        key: "investment",
        header: "Investment",
        render: (item) => <span data-testid="txn-investment">{formatCurrency(item.investment)}</span>,
      },
      {
        key: "amount",
        header: "Amount",
        render: (item) => {
          const content = (item.type === "SELL" || item.type === "DIVIDEND" || item.type === "SLP")
            ? formatCurrency(item.amount)
            : "-";
          return <span data-testid="txn-amount">{content}</span>;
        },
      },
      {
        key: "wallet",
        header: "Wallet",
        defaultHidden: true,
        render: (item) => {
          if (item.type !== "BUY") return "-";
          const allocations = allocationsMap.get(item.id);
          if (!allocations || allocations.length === 0) return "-";

          // Sort allocations by PT sortOrder
          const sortedAllocations = [...allocations].sort((a, b) => {
            const ptA = profitTargets.find(p => p.id === a.profitTargetId);
            const ptB = profitTargets.find(p => p.id === b.profitTargetId);
            return (ptA?.sortOrder ?? 0) - (ptB?.sortOrder ?? 0);
          });

          // Show PT name with shortened wallet ID, one per line
          return (
            <div className="flex flex-col text-xs text-muted-foreground">
              {sortedAllocations.map((alloc) => {
                const pt = profitTargets.find(p => p.id === alloc.profitTargetId);
                const ptPercent = pt?.targetPercent ?? 0;
                const ptName = pt ? `+${ptPercent}%` : "PT";
                const shortWalletId = alloc.walletId.substring(0, 8);
                return (
                  <span
                    key={alloc.walletId}
                    data-testid={`txn-wallet-pt-${ptPercent}-${shortWalletId}`}
                  >
                    {ptName}: {shortWalletId}
                  </span>
                );
              })}
            </div>
          );
        },
      },
      {
        key: "entryTarget",
        header: firstEntryTarget ? `${firstEntryTarget.name}` : "ET",
        headerTestId: "txn-table-header-entryTarget",
        render: (item) => {
          if (item.type !== "BUY" || item.entryTargetPrice === null) {
            return "-";
          }
          const isLastBuy = lastBuyTransaction?.id === item.id;
          const shouldHighlight = isLastBuy && effectivePrice !== null && effectivePrice <= item.entryTargetPrice;
          return (
            <span className={shouldHighlight ? "text-green-400 font-medium" : ""} data-testid="txn-entry-target">
              {formatCurrency(item.entryTargetPrice)}
            </span>
          );
        },
      },
      {
        key: "pl",
        header: "P/L",
        render: (item) => {
          if (item.type !== "SELL" || item.amount === null || item.costBasis === null) {
            return "-";
          }
          const pl = item.amount - item.costBasis;
          return formatCurrency(pl);
        },
      },
      {
        key: "plPercent",
        header: "P/L (%)",
        render: (item) => {
          if (item.type !== "SELL" || item.amount === null || item.costBasis === null || item.costBasis === 0) {
            return "-";
          }
          const pl = item.amount - item.costBasis;
          const plPercent = (pl / item.costBasis) * 100;
          return `${plPercent.toFixed(2)}%`;
        },
      },
      {
        key: "actions",
        header: "",
        sortable: false,
        toggleable: false,
        render: (item) => (
          <div className="flex items-center gap-2">
            {!hasSubsequentTransactions(item) && (
              <button
                onClick={() => handleRowClick(item)}
                data-testid={`transaction-edit-${item.id}`}
                className="text-muted-foreground hover:text-foreground p-1"
                aria-label="Edit transaction"
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
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              </button>
            )}
            {!hasSubsequentTransactions(item) && (
              <button
                onClick={() => handleDeleteFromTable(item.id)}
                data-testid={`transaction-delete-${item.id}`}
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
            )}
          </div>
        ),
      },
    ];
    },
    [handleDeleteFromTable, firstEntryTarget, lastBuyTransaction, effectivePrice, allocationsMap, profitTargets, transactions]
  );

  // Column visibility toggle for transactions
  const { visibleKeys, hiddenColumns, toggle: toggleColumn } = useColumnVisibility(
    columns,
    { storageKey: "transactions-columns" }
  );

  // Filter wallets for selected profit target
  const displayWallets = useMemo((): WalletRow[] => {
    if (!selectedProfitTargetId) return [];
    return wallets
      .filter((w) => w.profitTargetId === selectedProfitTargetId)
      .sort((a, b) => a.price - b.price);
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
    if (!effectivePrice) return new Set<string>();

    const hitIds = new Set<string>();

    for (const pt of profitTargets) {
      // Get wallets for this PT
      const ptWallets = wallets.filter((w) => w.profitTargetId === pt.id);
      if (ptWallets.length === 0) continue;

      // Find lowest profitTargetPrice (from lowest buy price wallet)
      const lowestTargetPrice = Math.min(...ptWallets.map((w) => w.profitTargetPrice));

      // Check if current price meets target
      if (effectivePrice >= lowestTargetPrice) {
        hitIds.add(pt.id);
      }
    }

    return hitIds;
  }, [effectivePrice, profitTargets, wallets]);

  // Wallet columns
  const walletColumns: Column<WalletRow>[] = useMemo(() => [
    {
      key: "walletId",
      header: "Wallet ID",
      defaultHidden: true,
      render: (item) => (
        <span
          className="text-xs text-muted-foreground font-mono"
          data-testid={`wallet-id-${item.id.substring(0, 8)}`}
        >
          {item.id.substring(0, 8)}
        </span>
      ),
    },
    {
      key: "price",
      header: "Price",
      render: (item) => formatCurrency(item.price),
    },
    {
      key: "shares",
      header: "Shares",
      render: (item) =>
        item.shares.toLocaleString(undefined, { minimumFractionDigits: 5, maximumFractionDigits: 5 }),
    },
    {
      key: "investment",
      header: "Investment",
      render: (item) => formatCurrency(item.investment),
    },
    {
      key: "pt",
      header: "PT",
      render: (item) => {
        if (!effectivePrice || !item.profitTargetPrice) {
          return formatCurrency(item.profitTargetPrice);
        }
        const pct2pt = ((effectivePrice - item.profitTargetPrice) / item.profitTargetPrice) * 100;
        const color = getPct2PTColor(pct2pt);
        const colorClass = color === "green" ? "text-green-400"
          : color === "yellow" ? "text-yellow-400" : "";
        return <span className={colorClass}>{formatCurrency(item.profitTargetPrice)}</span>;
      },
    },
    {
      key: "pct2pt",
      header: "%2PT",
      render: (item) => {
        if (!effectivePrice || !item.profitTargetPrice) return "-";
        const pct2pt = ((effectivePrice - item.profitTargetPrice) / item.profitTargetPrice) * 100;
        const color = getPct2PTColor(pct2pt);
        const colorClass = color === "green" ? "text-green-400"
          : color === "yellow" ? "text-yellow-400" : "";
        // Avoid displaying "-0.00%" - show "0.00%" for values that round to zero
        const displayValue = Math.abs(pct2pt) < 0.005 ? "0.00" : pct2pt.toFixed(2);
        return (
          <span className={colorClass}>
            {displayValue}%
          </span>
        );
      },
    },
    {
      key: "action",
      header: "Action",
      sortable: false,
      toggleable: false,
      render: (item) => {
        let colorClass = "text-muted-foreground hover:text-foreground";
        if (effectivePrice && item.profitTargetPrice) {
          const pct2pt = ((effectivePrice - item.profitTargetPrice) / item.profitTargetPrice) * 100;
          const color = getPct2PTColor(pct2pt);
          if (color === "green") {
            colorClass = "text-green-400 hover:text-green-300";
          } else if (color === "yellow") {
            colorClass = "text-yellow-400 hover:text-yellow-300";
          }
        }
        return (
          <button
            onClick={() => setSellWallet(item)}
            data-testid={`wallet-sell-${item.id}`}
            className={`hover:underline text-sm ${colorClass}`}
          >
            Sell
          </button>
        );
      },
    },
  ], [effectivePrice]);

  // Column visibility toggle for wallets
  const { visibleKeys: walletVisibleKeys, hiddenColumns: walletHiddenColumns, toggle: toggleWalletColumn } = useColumnVisibility(
    walletColumns,
    { storageKey: "wallets-columns" }
  );

  useEffect(() => {
    if (authStatus === "authenticated") {
      fetchAsset();
      fetchTransactions();
      fetchProfitTargets();
      fetchEntryTargets();
      fetchWallets();
      fetchMaxOOP();
    }
  }, [authStatus, fetchAsset, fetchTransactions, fetchProfitTargets, fetchEntryTargets, fetchWallets, fetchMaxOOP]);

  // Auto-select first PT when profit targets load
  useEffect(() => {
    if (profitTargets.length > 0 && selectedProfitTargetId === null) {
      const sortedPTs = [...profitTargets].sort((a, b) => a.sortOrder - b.sortOrder);
      setSelectedProfitTargetId(sortedPTs[0].id);
    }
  }, [profitTargets, selectedProfitTargetId]);

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

        // For SPLIT edits, reverse old split ratio before applying new one
        if (selectedTransaction.type === "SPLIT" && selectedTransaction.splitRatio) {
          await reverseSplitOnWallets(assetId, selectedTransaction.splitRatio);
        }

        // For SELL edits, handle wallet restoration and re-deduction
        if (selectedTransaction.type === "SELL") {
          const oldQuantity = selectedTransaction.quantity;
          const newQuantity = data.quantity;
          const walletPrice = selectedTransaction.walletPrice;
          const walletId = selectedTransaction.walletId;
          const profitTargetPercent = selectedTransaction.profitTargetPercent;

          // Validate required data
          if (!walletId || !walletPrice || !oldQuantity || profitTargetPercent === null || profitTargetPercent === undefined) {
            setError("Cannot edit: missing wallet restoration data.");
            return;
          }

          // Check for subsequent transactions
          const hasSubsequentTxns = transactions.some(
            (t) => t.id !== selectedTransaction.id && new Date(t.date) > new Date(selectedTransaction.date)
          );
          if (hasSubsequentTxns) {
            setError("Cannot edit this SELL transaction because there are subsequent transactions.");
            return;
          }

          // Find PT by percentage
          const pt = profitTargets.find(p => p.targetPercent === profitTargetPercent);
          if (!pt) {
            setError("Cannot edit: the Profit Target for this transaction no longer exists.");
            return;
          }

          const sellFee = asset?.sellFee ?? 0;
          const profitTargetPrice = parseFloat((walletPrice * (1 + pt.targetPercent / 100) / (1 - sellFee / 100)).toFixed(5));

          // Step 1: Restore old wallet (add old shares back)
          const oldInvestment = walletPrice * oldQuantity;
          // First try to find wallet by original ID
          let existingWallet = wallets.find(w => w.id === walletId);

          // If not found by ID, check for wallet with same price and profit target
          if (!existingWallet) {
            existingWallet = wallets.find(w => w.price === walletPrice && w.profitTargetId === pt.id);
          }

          if (existingWallet) {
            // Update existing wallet - add shares back
            await client.models.Wallet.update({
              id: existingWallet.id,
              shares: existingWallet.shares + oldQuantity,
              investment: existingWallet.investment + oldInvestment,
            });

            // Update TransactionAllocations that pointed to old wallet ID to point to existing wallet
            if (existingWallet.id !== walletId) {
              const allocResponse = await client.models.TransactionAllocation.list({
                filter: { walletId: { eq: walletId } },
              });
              for (const alloc of allocResponse.data) {
                await client.models.TransactionAllocation.update({
                  id: alloc.id,
                  walletId: existingWallet.id,
                });
              }
            }

            existingWallet = {
              ...existingWallet,
              shares: existingWallet.shares + oldQuantity,
              investment: existingWallet.investment + oldInvestment,
            };
          } else {
            // Create new wallet only if no matching wallet exists
            const newWallet = await client.models.Wallet.create({
              assetId,
              price: walletPrice,
              shares: oldQuantity,
              investment: oldInvestment,
              profitTargetId: pt.id,
              profitTargetPrice,
              // Legacy fields - kept for backward compatibility
              originalShares: oldQuantity,
              originalPrice: walletPrice,
              originalProfitTargetPrice: profitTargetPrice,
            });

            if (newWallet.data?.id) {
              // Update TransactionAllocations that pointed to old wallet
              const allocResponse = await client.models.TransactionAllocation.list({
                filter: { walletId: { eq: walletId } },
              });
              for (const alloc of allocResponse.data) {
                await client.models.TransactionAllocation.update({
                  id: alloc.id,
                  walletId: newWallet.data.id,
                });
              }
              existingWallet = {
                id: newWallet.data.id,
                price: walletPrice,
                shares: oldQuantity,
                investment: oldInvestment,
                profitTargetId: pt.id,
                profitTargetPrice,
              } as WalletRow;
            }
          }

          // Step 2: Validate and deduct new values
          if (existingWallet && newQuantity && newQuantity > existingWallet.shares) {
            setError(`Cannot edit: quantity (${newQuantity}) exceeds available shares (${existingWallet.shares.toFixed(5)}).`);
            return;
          }

          // Step 3: Deduct new shares from wallet
          if (existingWallet && newQuantity) {
            const newShares = existingWallet.shares - newQuantity;
            if (newShares <= 0) {
              await client.models.Wallet.delete({ id: existingWallet.id });
            } else {
              const newInvestment = newShares * walletPrice;
              await client.models.Wallet.update({
                id: existingWallet.id,
                shares: parseFloat(newShares.toFixed(5)),
                investment: newInvestment,
              });
            }
          }

          // Step 4: Update transaction with recalculated values
          const newCostBasis = walletPrice * (newQuantity || 0);
          const grossProceeds = (data.price || 0) * (newQuantity || 0);
          const newAmount = grossProceeds * (1 - sellFee / 100);

          const result = await client.models.Transaction.update({
            id: selectedTransaction.id,
            date: data.date,
            signal: data.signal,
            price: data.price,
            quantity: newQuantity,
            costBasis: newCostBasis,
            amount: newAmount,
          });

          if (result.errors) {
            console.error("Update errors:", result.errors);
            setError("Failed to update transaction: " + result.errors.map(e => e.message).join(", "));
            return;
          }

          await recalculateAssetFinancials(assetId);
          await fetchWallets();
          await fetchTransactions();
          return;
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
        const sellFee = asset?.sellFee ?? 0;

        for (const alloc of allocations) {
          // Calculate profitTargetPrice for this wallet
          const pt = profitTargets.find((p) => p.id === alloc.profitTargetId);
          const ptPercent = pt?.targetPercent ?? 0;
          // Formula: buyPrice × (1 + PT%) / (1 - sellFee%)
          const profitTargetPrice = parseFloat((data.price * (1 + ptPercent / 100) / (1 - sellFee / 100)).toFixed(5));

          // Create/update wallet for this profit target FIRST to get wallet ID
          const allocationInvestment = (alloc.percentage / 100) * data.investment;
          const walletId = await upsertWallet(data.price, alloc.profitTargetId, allocationInvestment, profitTargetPrice);

          // Create allocation record with walletId
          if (walletId) {
            await client.models.TransactionAllocation.create({
              transactionId,
              profitTargetId: alloc.profitTargetId,
              walletId,
              percentage: alloc.percentage,
              shares: alloc.shares,
            });
          }
        }
        await fetchWallets();
      }

      // Apply split to all wallets if this is a SPLIT transaction
      if (data.type === "SPLIT" && data.splitRatio) {
        try {
          const count = await applySplitToWallets(assetId, data.splitRatio);
          console.log(`Split applied: adjusted ${count} wallet(s)`);
          await fetchWallets();
        } catch (err) {
          console.error("Failed to apply split:", err);
          setError("Split transaction created but failed to adjust wallets. Please try again.");
          return;
        }
      }

      // Recalculate balance and OOP for non-SPLIT transactions
      if (data.type !== "SPLIT") {
        await recalculateAssetFinancials(assetId);
      }
      await fetchTransactions();
    } catch (err) {
      console.error("Save error:", err);
      setError("Failed to save transaction");
    }
  }

  // Delete all transactions and wallets for this asset
  async function handleDeleteAll() {
    const confirmation = prompt(
      `This will delete ALL transactions and wallets for this asset.\n\nType "DELETE" to confirm:`
    );

    if (confirmation !== "DELETE") {
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      // Fetch ALL records directly from DB with high limit (DynamoDB needs this for filtered queries)
      const FETCH_LIMIT = 5000;

      // 1. Fetch and delete all transactions for this asset
      const txnResponse = await client.models.Transaction.list({
        filter: { assetId: { eq: assetId } },
        limit: FETCH_LIMIT,
      });
      const allTransactions = txnResponse.data;

      // 2. Delete all transaction allocations first
      for (const txn of allTransactions) {
        const allocationsResponse = await client.models.TransactionAllocation.list({
          filter: { transactionId: { eq: txn.id } },
          limit: FETCH_LIMIT,
        });
        for (const alloc of allocationsResponse.data) {
          await client.models.TransactionAllocation.delete({ id: alloc.id });
        }
      }

      // 3. Delete all transactions
      for (const txn of allTransactions) {
        await client.models.Transaction.delete({ id: txn.id });
      }

      // 4. Fetch and delete all wallets for this asset
      const walletResponse = await client.models.Wallet.list({
        filter: { assetId: { eq: assetId } },
        limit: FETCH_LIMIT,
      });
      for (const wallet of walletResponse.data) {
        await client.models.Wallet.delete({ id: wallet.id });
      }

      // Reset balance and OOP (will be 0 after deleting all transactions)
      await recalculateAssetFinancials(assetId);
      // Refresh data
      await fetchTransactions();
      await fetchWallets();
    } catch (err) {
      console.error("Delete all error:", err);
      setError("Failed to delete all data");
    } finally {
      setIsDeleting(false);
    }
  }

  // Handle sell from wallet
  async function handleSell(data: SellData) {
    if (!sellWallet) return;

    try {
      // Calculate costBasis: buyPrice × quantity (what was originally paid for these shares)
      const costBasis = sellWallet.price * data.quantity;

      // Get PT percentage from the wallet's profit target
      const pt = profitTargets.find(p => p.id === sellWallet.profitTargetId);
      const profitTargetPercent = pt?.targetPercent ?? null;

      // 1. Create SELL transaction with walletId, costBasis, PT%, and walletPrice
      const result = await client.models.Transaction.create({
        type: "SELL",
        date: data.date,
        signal: data.signal,
        price: data.price,
        quantity: data.quantity,
        amount: data.netProceeds,
        costBasis,
        profitTargetPercent,
        walletPrice: sellWallet.price,
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

      // 3. Recalculate balance and OOP
      await recalculateAssetFinancials(assetId);

      // 4. Refresh data and close modal
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
            data-testid="link-edit-asset"
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
          {effectivePrice !== null && (
            <p
              data-testid="asset-current-price"
              className={isTestPrice ? "text-purple-400" : "text-muted-foreground"}
            >
              {formatCurrency(effectivePrice)}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {(transactions.length > 0 || wallets.length > 0) && (
            <button
              onClick={handleDeleteAll}
              disabled={isDeleting}
              className="px-4 py-2 text-sm border border-red-500 text-red-500 rounded hover:bg-red-500/10 disabled:opacity-50"
            >
              {isDeleting ? "Deleting..." : "Delete All"}
            </button>
          )}
          {entryTargets.length > 0 && (
            <button
              onClick={handleNewTransaction}
              data-testid="btn-new-transaction"
              className="px-4 py-2 text-sm bg-foreground text-background rounded hover:opacity-90"
            >
              New Transaction
            </button>
          )}
        </div>
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

      {/* Overview Section */}
      <div className="mb-8 bg-card border border-border rounded-lg p-4">
        <h3 className="text-lg font-semibold text-foreground mb-4">Overview</h3>
        <div className="grid grid-cols-3 gap-8">
          {/* Budget Column */}
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-3">Budget</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Max OOP</span>
                <span className="text-sm text-foreground">
                  {maxOOP !== null ? formatCurrency(maxOOP) : "-"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">OOP</span>
                <span className="text-sm text-foreground" data-testid="overview-oop">{formatCurrency(oop)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Available</span>
                <span className="text-sm text-foreground" data-testid="overview-available">
                  {maxOOP !== null
                    ? formatCurrency(maxOOP - oop + cashBalance)
                    : "-"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">ET</span>
                <span className="text-sm text-foreground">
                  {firstEntryTarget ? `${firstEntryTarget.targetPercent}%` : "-"}
                </span>
              </div>
            </div>
          </div>

          {/* $ Performance Column */}
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-3">$ Performance</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Market Value</span>
                <span className="text-sm text-foreground" data-testid="overview-market-value">
                  {effectivePrice !== null
                    ? formatCurrency(txnStats.totalShares * effectivePrice)
                    : "-"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">ROI</span>
                <span className="text-sm text-foreground" data-testid="overview-roi">
                  {effectivePrice !== null && oop > 0
                    ? (() => {
                        const marketValue = txnStats.totalShares * effectivePrice;
                        const roi = ((balance + marketValue) / oop) * 100;
                        return `${roi.toFixed(2)}%`;
                      })()
                    : "-"}
                </span>
              </div>
            </div>
          </div>

          {/* Txns & Shs Column */}
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-3">Txns &amp; Shs</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Buys</span>
                <span className="text-sm text-foreground">{txnStats.buyCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Sells</span>
                <span className="text-sm text-foreground">{txnStats.sellCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Total shs</span>
                <span className="text-sm text-foreground" data-testid="overview-total-shares">
                  {txnStats.totalShares.toLocaleString(undefined, { minimumFractionDigits: 5, maximumFractionDigits: 5 })}
                </span>
              </div>
              {profitTargets
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((pt) => {
                  const shares = txnStats.sharesByPT[pt.id] || 0;
                  return (
                    <div key={pt.id} className="flex justify-between" data-testid={`overview-pt-shares-${pt.targetPercent}`}>
                      <span className="text-sm text-muted-foreground">
                        PT +{pt.targetPercent}%
                      </span>
                      <span className="text-sm text-foreground">
                        {shares.toLocaleString(undefined, { minimumFractionDigits: 5, maximumFractionDigits: 5 })}
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      </div>

      {/* Wallets Section with PT Tabs */}
      {(wallets.length > 0 || profitTargets.length > 0) && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-foreground mb-4">Wallets</h3>

          {/* Profit Target Tabs */}
          <div className="flex gap-2 mb-4 flex-wrap" data-testid="wallet-tabs">
            {profitTargets
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((pt) => {
                const count = walletCountByPT[pt.id] || 0;
                const isHit = hitProfitTargetIds.has(pt.id);
                return (
                  <button
                    key={pt.id}
                    onClick={() => setSelectedProfitTargetId(pt.id)}
                    data-testid={`wallet-tab-pt-${pt.targetPercent}`}
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

          <ColumnToggle
            columns={walletColumns}
            visibleKeys={walletVisibleKeys}
            onToggle={toggleWalletColumn}
          />

          <div className="bg-card border border-border rounded-lg">
            <SortableTable
              data={displayWallets}
              columns={walletColumns}
              keyField="id"
              emptyMessage="No wallets for this profit target."
              hiddenColumns={walletHiddenColumns}
              rowTestId={(item) => `wallet-row-${item.id}`}
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
          rowTestId={(item) => `transaction-row-${item.id}`}
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
          onDelete={handleDeleteTransaction}
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
