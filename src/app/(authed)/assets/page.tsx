"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { client } from "@/utils/amplify-client";
import { SortableTable, Column } from "@/components/SortableTable";

interface Asset {
  id: string;
  symbol: string;
  name: string;
  type: "STOCK" | "ETF" | "CRYPTO";
  commission: number | null;
  status: "ACTIVE" | "HIDDEN" | "ARCHIVED";
}

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const columns: Column<Asset>[] = useMemo(
    () => [
      {
        key: "symbol",
        header: "Symbol",
        render: (item) => (
          <Link
            href={`/assets/${item.id}/transactions`}
            data-testid={`asset-table-symbol-${item.symbol}`}
            className="font-medium text-blue-400 hover:text-blue-300 hover:underline"
          >
            {item.symbol}
          </Link>
        ),
      },
      {
        key: "name",
        header: "Name",
        render: (item) => (
          <span data-testid={`asset-table-name-${item.symbol}`}>{item.name}</span>
        ),
      },
      {
        key: "type",
        header: "Type",
        render: (item) => (
          <span data-testid={`asset-table-type-${item.symbol}`}>
            {item.type.toLowerCase()}
          </span>
        ),
      },
      {
        key: "commission",
        header: "Commission",
        render: (item) => (
          <span data-testid={`asset-table-commission-${item.symbol}`}>
            {item.commission !== null ? `${item.commission.toFixed(2)}%` : "-"}
          </span>
        ),
      },
      {
        key: "status",
        header: "Status",
        render: (item) => (
          <span data-testid={`asset-table-status-${item.symbol}`}>
            {item.status.toLowerCase()}
          </span>
        ),
      },
      {
        key: "actions",
        header: "",
        sortable: false,
        render: (item) => (
          <Link
            href={`/assets/${item.id}`}
            data-testid={`asset-table-edit-${item.symbol}`}
            className="text-muted-foreground hover:text-foreground"
          >
            Edit
          </Link>
        ),
      },
    ],
    []
  );

  const fetchAssets = useCallback(async () => {
    try {
      setError(null);
      const response = await client.models.Asset.list();
      const assetData = response.data.map((item) => ({
        id: item.id,
        symbol: item.symbol,
        name: item.name,
        type: item.type as "STOCK" | "ETF" | "CRYPTO",
        commission: item.commission ?? null,
        status: item.status as "ACTIVE" | "HIDDEN" | "ARCHIVED",
      }));
      setAssets(assetData);
    } catch (err) {
      console.error("Error fetching assets:", err);
      setError("Failed to load assets");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-foreground">Assets</h2>
        <Link
          href="/assets/new"
          data-testid="btn-new-asset"
          className="px-4 py-2 text-sm bg-foreground text-background rounded hover:opacity-90"
        >
          New Asset
        </Link>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/20 text-red-400 rounded">
          {error}
        </div>
      )}

      {isLoading ? (
        <div data-testid="assets-loading" className="text-center py-8 text-muted-foreground">
          Loading assets...
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg">
          <SortableTable
            data={assets}
            columns={columns}
            keyField="id"
            emptyMessage="No assets yet. Click 'New Asset' to add one."
          />
        </div>
      )}
    </div>
  );
}
