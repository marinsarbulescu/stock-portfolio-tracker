"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useAuthenticator } from "@aws-amplify/ui-react";
import { client } from "@/utils/amplify-client";
import { SortableTable, Column } from "@/components/SortableTable";
import { usePrices } from "@/contexts/PriceContext";
import { getEffectivePrice, getHistoricalCloses } from "@/utils/price-utils";
import {
  calculatePullbackPercent,
  isPullbackTriggered,
  calculateDaysSince,
  getDaysSinceColor,
  calculatePctToTarget,
  getPct2PTColor,
  calculate5DPullback,
} from "@/utils/dashboard-calculations";

interface DashboardAsset {
  id: string;
  symbol: string;
  currentPrice: number | null;
  isTestPrice: boolean;
  lastBuyPrice: number | null;
  lastBuyDate: string | null;
  entryTargetPercent: number | null;
  pullbackPercent: number | null;
  daysSinceLastBuy: number | null;
  lowestPTPrice: number | null;
  pctToLowestPT: number | null;
  fiveDPullback: number | null;
  firstEntryTargetPercent: number | null;
  available: number | null;
}

interface RawAssetData {
  id: string;
  symbol: string;
  testPrice: number | null;
  lastBuyPrice: number | null;
  lastBuyDate: string | null;
  entryTargetPercent: number | null;
  lowestPTPrice: number | null;
  firstEntryTargetPercent: number | null;
  maxOOP: number | null;
  balance: number;
}

export default function Dashboard() {
  const { authStatus } = useAuthenticator((context) => [context.authStatus]);
  const [rawAssetData, setRawAssetData] = useState<RawAssetData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    prices,
    lastFetchTimestamp,
    isLoading: isFetchingPrices,
    error: priceError,
    progressMessage,
    fetchPrices,
  } = usePrices();

  const fetchDashboardData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Parallel fetch all required data
      const currentYear = new Date().getFullYear();
      const [assetsResponse, transactionsResponse, walletsResponse, entryTargetsResponse, yearlyBudgetsResponse] =
        await Promise.all([
          client.models.Asset.list({
            filter: { status: { eq: "ACTIVE" } },
          }),
          client.models.Transaction.list(), // Fetch all transactions for balance/OOP calculation
          client.models.Wallet.list(),
          client.models.EntryTarget.list(),
          client.models.YearlyBudget.list({
            filter: { year: { eq: currentYear } },
          }),
        ]);

      const assets = assetsResponse.data.filter(Boolean);
      const transactions = transactionsResponse.data.filter(Boolean);
      const wallets = walletsResponse.data.filter(Boolean);
      const entryTargets = entryTargetsResponse.data.filter(Boolean);
      const yearlyBudgets = yearlyBudgetsResponse.data.filter(Boolean);

      // Process raw data for each asset (without effective price calculation)
      const processedRawData: RawAssetData[] = assets.map((asset) => {
        // Get all transactions for this asset
        const assetTransactions = transactions.filter((t) => t.assetId === asset.id);

        // Find most recent BUY transaction for this asset
        const assetBuyTransactions = assetTransactions
          .filter((t) => t.type === "BUY")
          .sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          );

        const lastBuy = assetBuyTransactions[0] || null;

        // Calculate balance and OOP from transactions
        const sortedTransactions = [...assetTransactions].sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        let balance = 0;

        for (const txn of sortedTransactions) {
          if (txn.type === "BUY" && txn.investment !== null) {
            balance -= txn.investment;
          } else if ((txn.type === "SELL" || txn.type === "DIVIDEND" || txn.type === "SLP") && txn.amount !== null) {
            balance += txn.amount;
          }
        }

        // Find all wallets for this asset and get lowest profitTargetPrice
        const assetWallets = wallets.filter((w) => w.assetId === asset.id);
        const lowestPTPrice =
          assetWallets.length > 0
            ? Math.min(...assetWallets.map((w) => w.profitTargetPrice))
            : null;

        // Find first entry target for this asset (lowest sortOrder)
        const assetEntryTargets = entryTargets
          .filter((et) => et.assetId === asset.id)
          .sort((a, b) => a.sortOrder - b.sortOrder);
        const firstEntryTargetPercent = assetEntryTargets[0]?.targetPercent ?? null;

        // Find yearly budget for this asset (maxOOP)
        const assetBudget = yearlyBudgets.find((b) => b.assetId === asset.id);
        const maxOOP = assetBudget?.amount ?? null;

        return {
          id: asset.id,
          symbol: asset.symbol,
          testPrice: asset.testPrice ?? null,
          lastBuyPrice: lastBuy?.price ?? null,
          lastBuyDate: lastBuy?.date ?? null,
          entryTargetPercent: lastBuy?.entryTargetPercent ?? null,
          lowestPTPrice,
          firstEntryTargetPercent,
          maxOOP,
          balance,
        };
      });

      // Sort by symbol alphabetically
      processedRawData.sort((a, b) => a.symbol.localeCompare(b.symbol));

      setRawAssetData(processedRawData);
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
      setError("Failed to load dashboard data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authStatus === "authenticated") {
      fetchDashboardData();
    }
  }, [authStatus, fetchDashboardData]);

  // Compute dashboard data with effective prices
  const dashboardData: DashboardAsset[] = useMemo(() => {
    return rawAssetData.map((asset) => {
      const currentPrice = getEffectivePrice(
        asset.symbol,
        prices,
        asset.testPrice
      );

      // Check if price is from testPrice (not from Yahoo Finance)
      const priceData = prices[asset.symbol];
      const isTestPrice =
        currentPrice !== null &&
        (!priceData ||
          priceData.currentPrice === null ||
          priceData.currentPrice === 0);

      const pullbackPercent = calculatePullbackPercent(
        currentPrice,
        asset.lastBuyPrice
      );
      const daysSinceLastBuy = calculateDaysSince(asset.lastBuyDate);
      const pctToLowestPT = calculatePctToTarget(
        currentPrice,
        asset.lowestPTPrice
      );

      // Calculate 5D Pullback using historical closes and first entry target
      const historicalCloses = getHistoricalCloses(asset.symbol, prices);
      const fiveDPullback = calculate5DPullback(
        currentPrice,
        historicalCloses,
        asset.firstEntryTargetPercent
      );

      // Calculate available: maxOOP + balance (matches Transactions page formula)
      // balance is negative for invested amounts, positive when sells/dividends exceed buys
      // Only show if maxOOP is set
      const available = asset.maxOOP !== null
        ? asset.maxOOP + asset.balance
        : null;

      return {
        id: asset.id,
        symbol: asset.symbol,
        currentPrice,
        isTestPrice,
        lastBuyPrice: asset.lastBuyPrice,
        lastBuyDate: asset.lastBuyDate,
        entryTargetPercent: asset.entryTargetPercent,
        pullbackPercent,
        daysSinceLastBuy,
        lowestPTPrice: asset.lowestPTPrice,
        pctToLowestPT,
        fiveDPullback,
        firstEntryTargetPercent: asset.firstEntryTargetPercent,
        available,
      };
    });
  }, [rawAssetData, prices]);

  const handleFetchPrices = useCallback(() => {
    const symbols = rawAssetData.map((a) => a.symbol);
    fetchPrices(symbols);
  }, [rawAssetData, fetchPrices]);

  const columns: Column<DashboardAsset>[] = useMemo(
    () => [
      {
        key: "available",
        header: "Available",
        sortable: true,
        render: (item) => {
          if (item.available === null) {
            return <span className="text-muted-foreground" data-testid={`dashboard-available-${item.symbol}`}>-</span>;
          }
          const isNegative = item.available < 0;
          const displayValue = Math.abs(item.available).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          return (
            <span data-testid={`dashboard-available-${item.symbol}`}>
              {isNegative ? `-$${displayValue}` : `$${displayValue}`}
            </span>
          );
        },
      },
      {
        key: "symbol",
        header: "Symbol",
        render: (item) => {
          const isGrayRow = item.available !== null && item.available < 0;
          return (
            <Link
              href={`/assets/${item.id}/transactions`}
              className={`font-medium hover:underline ${isGrayRow ? "hover:text-muted-foreground/80" : "text-blue-400 hover:text-blue-300"}`}
            >
              {item.symbol}
            </Link>
          );
        },
      },
      {
        key: "currentPrice",
        header: "Price",
        sortable: true,
        render: (item) => {
          if (item.currentPrice === null) {
            return <span className="text-muted-foreground">-</span>;
          }
          const isGrayRow = item.available !== null && item.available < 0;
          // Only show purple for test price if row is not grayed out
          const colorClass = isGrayRow ? "" : (item.isTestPrice ? "text-purple-400" : "");
          return (
            <span className={colorClass}>
              ${item.currentPrice.toFixed(2)}
            </span>
          );
        },
      },
      {
        key: "pullbackPercent",
        header: "Pullback",
        sortable: true,
        render: (item) => {
          const triggered = isPullbackTriggered(
            item.pullbackPercent,
            item.entryTargetPercent
          );

          if (!triggered || item.pullbackPercent === null) {
            return <span className="text-muted-foreground" data-testid={`dashboard-pullback-${item.symbol}`}>-</span>;
          }

          return <span data-testid={`dashboard-pullback-${item.symbol}`}>{item.pullbackPercent.toFixed(2)}%</span>;
        },
      },
      {
        key: "fiveDPullback",
        header: "5D Pullback",
        sortable: true,
        render: (item) => {
          if (item.fiveDPullback === null) {
            return <span className="text-muted-foreground">-</span>;
          }

          return <span>{item.fiveDPullback.toFixed(2)}%</span>;
        },
      },
      {
        key: "daysSinceLastBuy",
        header: "Last Buy",
        sortable: true,
        render: (item) => {
          if (item.daysSinceLastBuy === null) {
            return <span className="text-muted-foreground">-</span>;
          }

          const color = getDaysSinceColor(item.daysSinceLastBuy);
          // Always set explicit color to override gray row styling
          const colorClass =
            color === "red"
              ? "text-red-400"
              : color === "yellow"
                ? "text-yellow-400"
                : "text-card-foreground";

          return <span className={colorClass}>{item.daysSinceLastBuy}</span>;
        },
      },
      {
        key: "pctToLowestPT",
        header: "%2PT",
        sortable: true,
        render: (item) => {
          if (item.pctToLowestPT === null) {
            return (
              <span
                className="text-muted-foreground"
                data-testid={`dashboard-pct2pt-${item.symbol}`}
              >
                -
              </span>
            );
          }

          const color = getPct2PTColor(item.pctToLowestPT);
          const colorClass =
            color === "green"
              ? "text-green-400"
              : color === "yellow"
                ? "text-yellow-400"
                : "";

          // Avoid displaying "-0.00%" - show "0.00%" for values that round to zero
          const displayValue = Math.abs(item.pctToLowestPT) < 0.005 ? "0.00" : item.pctToLowestPT.toFixed(2);
          return (
            <span
              className={colorClass}
              data-testid={`dashboard-pct2pt-${item.symbol}`}
            >
              {displayValue}%
            </span>
          );
        },
      },
    ],
    []
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-foreground">Dashboard</h2>
        <div className="flex items-center gap-4">
          {lastFetchTimestamp && (
            <span className="text-sm text-muted-foreground">
              Last fetch: {lastFetchTimestamp.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={handleFetchPrices}
            disabled={isFetchingPrices || isLoading || rawAssetData.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {isFetchingPrices ? "Fetching..." : "Fetch Prices"}
          </button>
        </div>
      </div>

      {progressMessage && (
        <div className="mb-4 p-3 bg-blue-500/20 text-blue-400 rounded">
          {progressMessage}
        </div>
      )}

      {(error || priceError) && (
        <div className="mb-4 p-3 bg-red-500/20 text-red-400 rounded">
          {error || priceError}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">
          Loading dashboard...
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg">
          <SortableTable
            data={dashboardData}
            columns={columns}
            keyField="id"
            emptyMessage="No active assets. Add assets to see signals."
            rowTestId={(item) => `dashboard-row-${item.symbol}`}
            rowClassName={(item) => item.available !== null && item.available < 0 ? "text-muted-foreground" : ""}
          />
        </div>
      )}
    </div>
  );
}
