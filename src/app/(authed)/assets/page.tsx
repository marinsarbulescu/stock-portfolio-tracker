"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { client } from "@/utils/amplify-client";
import { Modal } from "@/components/Modal";
import { AssetForm, AssetFormData } from "@/components/AssetForm";
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);

  const columns: Column<Asset>[] = useMemo(
    () => [
      {
        key: "symbol",
        header: "Symbol",
        render: (item) => (
          <button
            onClick={() => handleEditClick(item)}
            className="font-medium text-blue-400 hover:text-blue-300 hover:underline"
          >
            {item.symbol}
          </button>
        ),
      },
      {
        key: "name",
        header: "Name",
      },
      {
        key: "type",
        header: "Type",
      },
      {
        key: "commission",
        header: "Commission",
        render: (item) =>
          item.commission !== null ? `${item.commission}%` : "-",
      },
      {
        key: "status",
        header: "Status",
      },
    ],
    []
  );

  function handleEditClick(asset: Asset) {
    setEditingAsset(asset);
    setIsModalOpen(true);
  }

  function handleNewAssetClick() {
    setEditingAsset(null);
    setIsModalOpen(true);
  }

  function handleCloseModal() {
    setIsModalOpen(false);
    setEditingAsset(null);
  }

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

  async function handleCreateAsset(data: AssetFormData) {
    setIsSubmitting(true);
    try {
      await client.models.Asset.create({
        symbol: data.symbol,
        name: data.name,
        type: data.type,
        commission: data.commission,
        status: data.status,
      });
      await fetchAssets();
      handleCloseModal();
    } catch (err) {
      console.error("Error creating asset:", err);
      setError("Failed to create asset");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUpdateAsset(data: AssetFormData) {
    if (!editingAsset) return;

    setIsSubmitting(true);
    try {
      await client.models.Asset.update({
        id: editingAsset.id,
        symbol: data.symbol,
        name: data.name,
        type: data.type,
        commission: data.commission,
        status: data.status,
      });
      await fetchAssets();
      handleCloseModal();
    } catch (err) {
      console.error("Error updating asset:", err);
      setError("Failed to update asset");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-foreground">Assets</h2>
        <button
          onClick={handleNewAssetClick}
          className="px-4 py-2 text-sm bg-foreground text-background rounded hover:opacity-90"
        >
          New Asset
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/20 text-red-400 rounded">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">
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

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingAsset ? `Edit ${editingAsset.symbol}` : "New Asset"}
      >
        <AssetForm
          onSubmit={editingAsset ? handleUpdateAsset : handleCreateAsset}
          onCancel={handleCloseModal}
          isSubmitting={isSubmitting}
          initialData={
            editingAsset
              ? {
                  symbol: editingAsset.symbol,
                  name: editingAsset.name,
                  type: editingAsset.type,
                  commission: editingAsset.commission,
                  status: editingAsset.status,
                }
              : undefined
          }
        />
      </Modal>
    </div>
  );
}
