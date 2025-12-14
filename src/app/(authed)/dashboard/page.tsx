"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { client } from "@/utils/amplify-client";
import { SortableTable, Column } from "@/components/SortableTable";
import {
  calculatePullbackPercent,
  isPullbackTriggered,
  calculateDaysSince,
  getDaysSinceColor,
  calculatePctToTarget,
  getPct2PTColor,
} from "@/utils/dashboard-calculations";

interface DashboardAsset {
  id: string;
  symbol: string;
  currentPrice: number | null;
  lastBuyPrice: number | null;
  lastBuyDate: string | null;
  entryTargetPercent: number | null;
  pullbackPercent: number | null;
  daysSinceLastBuy: number | null;
  lowestPTPrice: number | null;
  pctToLowestPT: number | null;
}

export default function Dashboard() {
  const [dashboardData, setDashboardData] = useState<DashboardAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Parallel fetch all required data
      const [assetsResponse, transactionsResponse, walletsResponse] =
        await Promise.all([
          client.models.Asset.list({
            filter: { status: { eq: "ACTIVE" } },
          }),
          client.models.Transaction.list({
            filter: { type: { eq: "BUY" } },
          }),
          client.models.Wallet.list(),
        ]);

      const assets = assetsResponse.data;
      const transactions = transactionsResponse.data;
      const wallets = walletsResponse.data;

      // Process data for each asset
      const processedAssets: DashboardAsset[] = assets.map((asset) => {
        // Find most recent BUY transaction for this asset
        const assetBuyTransactions = transactions
          .filter((t) => t.assetId === asset.id)
          .sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          );

        const lastBuy = assetBuyTransactions[0] || null;

        // Find all wallets for this asset and get lowest profitTargetPrice
        const assetWallets = wallets.filter((w) => w.assetId === asset.id);
        const lowestPTPrice =
          assetWallets.length > 0
            ? Math.min(...assetWallets.map((w) => w.profitTargetPrice))
            : null;

        // Calculate derived values
        const currentPrice = asset.testPrice ?? null;
        const lastBuyPrice = lastBuy?.price ?? null;
        const lastBuyDate = lastBuy?.date ?? null;
        const entryTargetPercent = lastBuy?.entryTargetPercent ?? null;

        const pullbackPercent = calculatePullbackPercent(
          currentPrice,
          lastBuyPrice
        );
        const daysSinceLastBuy = calculateDaysSince(lastBuyDate);
        const pctToLowestPT = calculatePctToTarget(currentPrice, lowestPTPrice);

        return {
          id: asset.id,
          symbol: asset.symbol,
          currentPrice,
          lastBuyPrice,
          lastBuyDate,
          entryTargetPercent,
          pullbackPercent,
          daysSinceLastBuy,
          lowestPTPrice,
          pctToLowestPT,
        };
      });

      // Sort by symbol alphabetically
      processedAssets.sort((a, b) => a.symbol.localeCompare(b.symbol));

      setDashboardData(processedAssets);
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
      setError("Failed to load dashboard data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const columns: Column<DashboardAsset>[] = useMemo(
    () => [
      {
        key: "symbol",
        header: "Symbol",
        render: (item) => (
          <Link
            href={`/assets/${item.id}/transactions`}
            className="font-medium text-blue-400 hover:text-blue-300 hover:underline"
          >
            {item.symbol}
          </Link>
        ),
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
            return <span className="text-muted-foreground">-</span>;
          }

          return <span>{item.pullbackPercent.toFixed(2)}%</span>;
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
          const colorClass =
            color === "red"
              ? "text-red-400"
              : color === "yellow"
                ? "text-yellow-400"
                : "";

          return <span className={colorClass}>{item.daysSinceLastBuy}d</span>;
        },
      },
      {
        key: "pctToLowestPT",
        header: "%2PT",
        sortable: true,
        render: (item) => {
          if (item.pctToLowestPT === null) {
            return <span className="text-muted-foreground">-</span>;
          }

          const color = getPct2PTColor(item.pctToLowestPT);
          const colorClass =
            color === "green"
              ? "text-green-400"
              : color === "yellow"
                ? "text-yellow-400"
                : "";

          return (
            <span className={colorClass}>
              {item.pctToLowestPT >= 0 ? "+" : ""}
              {item.pctToLowestPT.toFixed(2)}%
            </span>
          );
        },
      },
    ],
    []
  );

  return (
    <div>
      <h2 className="text-2xl font-bold text-foreground mb-6">Dashboard</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-500/20 text-red-400 rounded">
          {error}
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
          />
        </div>
      )}
    </div>
  );
}
