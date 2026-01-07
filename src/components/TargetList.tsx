"use client";

import { useState } from "react";

export interface EntryTarget {
  id: string;
  name: string;
  targetPercent: number;
  sortOrder: number;
}

export interface ProfitTarget {
  id: string;
  name: string;
  targetPercent: number;
  allocationPercent: number | null;
  sortOrder: number;
}

interface BaseTargetListProps {
  assetId: string;
  onError: (message: string) => void;
}

interface EntryTargetListProps extends BaseTargetListProps {
  type: "entry";
  targets: EntryTarget[];
  onCreate: (data: Omit<EntryTarget, "id">) => Promise<void>;
  onUpdate: (id: string, data: Partial<EntryTarget>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

interface ProfitTargetListProps extends BaseTargetListProps {
  type: "profit";
  targets: ProfitTarget[];
  onCreate: (data: Omit<ProfitTarget, "id">) => Promise<void>;
  onUpdate: (id: string, data: Partial<ProfitTarget>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  walletCounts?: Record<string, number>;  // Wallet count per PT id - hides delete if > 0
}

type TargetListProps = EntryTargetListProps | ProfitTargetListProps;

interface NewTargetForm {
  name: string;
  targetPercent: string;
  allocationPercent: string;
  sortOrder: string;
}

export function TargetList(props: TargetListProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newTarget, setNewTarget] = useState<NewTargetForm>({
    name: "",
    targetPercent: "",
    allocationPercent: "",
    sortOrder: "",
  });
  const [editTarget, setEditTarget] = useState<NewTargetForm>({
    name: "",
    targetPercent: "",
    allocationPercent: "",
    sortOrder: "",
  });

  const isProfit = props.type === "profit";
  const title = isProfit ? "Profit Targets" : "Entry Targets";
  const targets = props.targets;

  // Calculate total allocation for profit targets (excluding a specific target if editing)
  function getTotalAllocation(excludeId?: string): number {
    if (!isProfit) return 0;
    const profitTargets = targets as ProfitTarget[];
    return profitTargets
      .filter((t) => t.id !== excludeId)
      .reduce((sum, t) => sum + (t.allocationPercent ?? 0), 0);
  }

  // Validate that adding this allocation won't exceed 100%
  function validateAllocation(newAllocation: number, excludeId?: string): string | null {
    const currentTotal = getTotalAllocation(excludeId);
    const newTotal = currentTotal + newAllocation;
    if (newTotal > 100) {
      const available = 100 - currentTotal;
      return `Total allocation cannot exceed 100%. You can only update this PT value to max ${available}%`;
    }
    return null;
  }

  function getNextSortOrder(): number {
    if (targets.length === 0) return 1;
    return Math.max(...targets.map((t) => t.sortOrder)) + 1;
  }

  function resetNewForm() {
    setNewTarget({
      name: "",
      targetPercent: "",
      allocationPercent: "",
      sortOrder: String(getNextSortOrder()),
    });
  }

  function startAdding() {
    resetNewForm();
    setNewTarget((prev) => ({ ...prev, sortOrder: String(getNextSortOrder()) }));
    setIsAdding(true);
  }

  function startEditing(target: EntryTarget | ProfitTarget) {
    setEditingId(target.id);
    setEditTarget({
      name: target.name,
      targetPercent: String(target.targetPercent),
      allocationPercent:
        "allocationPercent" in target && target.allocationPercent !== null
          ? String(target.allocationPercent)
          : "",
      sortOrder: String(target.sortOrder),
    });
  }

  function cancelEditing() {
    setEditingId(null);
  }

  async function handleCreate() {
    if (!newTarget.name.trim() || !newTarget.targetPercent) {
      props.onError("Name and target percent are required");
      return;
    }

    // Validate allocation for profit targets
    if (isProfit && newTarget.allocationPercent) {
      const allocationError = validateAllocation(parseFloat(newTarget.allocationPercent));
      if (allocationError) {
        props.onError(allocationError);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (isProfit) {
        await (props as ProfitTargetListProps).onCreate({
          name: newTarget.name.trim(),
          targetPercent: parseFloat(newTarget.targetPercent),
          allocationPercent: newTarget.allocationPercent
            ? parseFloat(newTarget.allocationPercent)
            : null,
          sortOrder: parseInt(newTarget.sortOrder) || getNextSortOrder(),
        });
      } else {
        await (props as EntryTargetListProps).onCreate({
          name: newTarget.name.trim(),
          targetPercent: parseFloat(newTarget.targetPercent),
          sortOrder: parseInt(newTarget.sortOrder) || getNextSortOrder(),
        });
      }
      setIsAdding(false);
      resetNewForm();
    } catch {
      props.onError(`Failed to create ${isProfit ? "profit" : "entry"} target`);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUpdate(id: string) {
    if (!editTarget.name.trim() || !editTarget.targetPercent) {
      props.onError("Name and target percent are required");
      return;
    }

    // Validate allocation for profit targets (exclude current target from total)
    if (isProfit && editTarget.allocationPercent) {
      const allocationError = validateAllocation(parseFloat(editTarget.allocationPercent), id);
      if (allocationError) {
        props.onError(allocationError);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (isProfit) {
        await (props as ProfitTargetListProps).onUpdate(id, {
          name: editTarget.name.trim(),
          targetPercent: parseFloat(editTarget.targetPercent),
          allocationPercent: editTarget.allocationPercent
            ? parseFloat(editTarget.allocationPercent)
            : null,
          sortOrder: parseInt(editTarget.sortOrder),
        });
      } else {
        await (props as EntryTargetListProps).onUpdate(id, {
          name: editTarget.name.trim(),
          targetPercent: parseFloat(editTarget.targetPercent),
          sortOrder: parseInt(editTarget.sortOrder),
        });
      }
      setEditingId(null);
    } catch {
      props.onError(`Failed to update ${isProfit ? "profit" : "entry"} target`);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    // For profit targets, skip confirmation here - handleDeleteProfitTarget shows a comprehensive dialog
    // For entry targets, confirm here
    if (!isProfit) {
      if (!confirm("Are you sure you want to delete this Entry Target?")) return;
    }

    try {
      await props.onDelete(id);
    } catch {
      props.onError(`Failed to delete ${isProfit ? "profit" : "entry"} target`);
    }
  }

  const sortedTargets = [...targets].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="bg-card border border-border rounded-lg">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h3 className="font-medium text-card-foreground">{title}</h3>
        {!isAdding && (
          <button
            onClick={startAdding}
            data-testid={`${props.type}-target-add-btn`}
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            + Add
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-4 py-2 font-medium text-muted-foreground">Name</th>
              <th className="px-4 py-2 font-medium text-muted-foreground">%</th>
              {isProfit && (
                <th className="px-4 py-2 font-medium text-muted-foreground">Alloc %</th>
              )}
              <th className="px-4 py-2 font-medium text-muted-foreground">Order</th>
              <th className="px-4 py-2 font-medium text-muted-foreground w-20"></th>
            </tr>
          </thead>
          <tbody>
            {sortedTargets.map((target) => (
              <tr key={target.id} className="border-b border-border" data-testid={`${props.type}-target-row-${target.sortOrder}`}>
                {editingId === target.id ? (
                  <>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={editTarget.name}
                        onChange={(e) =>
                          setEditTarget({ ...editTarget, name: e.target.value })
                        }
                        data-testid={`${props.type}-target-edit-name-${target.sortOrder}`}
                        className="w-full px-2 py-1 bg-background border border-border rounded text-foreground text-sm"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        step="0.1"
                        value={editTarget.targetPercent}
                        onChange={(e) =>
                          setEditTarget({ ...editTarget, targetPercent: e.target.value })
                        }
                        data-testid={`${props.type}-target-edit-percent-${target.sortOrder}`}
                        className="w-20 px-2 py-1 bg-background border border-border rounded text-foreground text-sm"
                      />
                    </td>
                    {isProfit && (
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          step="1"
                          value={editTarget.allocationPercent}
                          onChange={(e) =>
                            setEditTarget({ ...editTarget, allocationPercent: e.target.value })
                          }
                          data-testid={`${props.type}-target-edit-alloc-${target.sortOrder}`}
                          className="w-20 px-2 py-1 bg-background border border-border rounded text-foreground text-sm"
                        />
                      </td>
                    )}
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        value={editTarget.sortOrder}
                        onChange={(e) =>
                          setEditTarget({ ...editTarget, sortOrder: e.target.value })
                        }
                        data-testid={`${props.type}-target-edit-order-${target.sortOrder}`}
                        className="w-16 px-2 py-1 bg-background border border-border rounded text-foreground text-sm"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUpdate(target.id)}
                          disabled={isSubmitting}
                          data-testid={`${props.type}-target-edit-save-${target.sortOrder}`}
                          className="text-green-400 hover:text-green-300 disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          onClick={cancelEditing}
                          data-testid={`${props.type}-target-edit-cancel-${target.sortOrder}`}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          Cancel
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-2 text-card-foreground" data-testid={`${props.type}-target-name-${target.sortOrder}`}>{target.name}</td>
                    <td className="px-4 py-2 text-card-foreground" data-testid={`${props.type}-target-percent-${target.sortOrder}`}>
                      {isProfit ? "+" : "-"}{target.targetPercent}%
                    </td>
                    {isProfit && (
                      <td className="px-4 py-2 text-card-foreground" data-testid={`${props.type}-target-alloc-${target.sortOrder}`}>
                        {"allocationPercent" in target && target.allocationPercent !== null
                          ? `${target.allocationPercent}%`
                          : "-"}
                      </td>
                    )}
                    <td className="px-4 py-2 text-card-foreground" data-testid={`${props.type}-target-order-${target.sortOrder}`}>{target.sortOrder}</td>
                    <td className="px-4 py-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => startEditing(target)}
                          data-testid={`${props.type}-target-edit-btn-${target.sortOrder}`}
                          className="text-blue-400 hover:text-blue-300"
                        >
                          Edit
                        </button>
                        {/* Hide delete for profit targets with wallets */}
                        {(props.type !== "profit" || !(props.walletCounts?.[target.id])) && (
                          <button
                            onClick={() => handleDelete(target.id)}
                            data-testid={`${props.type}-target-delete-btn-${target.sortOrder}`}
                            className="text-red-400 hover:text-red-300"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}

            {isAdding && (
              <tr className="border-b border-border bg-muted/30" data-testid={`${props.type}-target-new-row`}>
                <td className="px-4 py-2">
                  <input
                    type="text"
                    value={newTarget.name}
                    onChange={(e) =>
                      setNewTarget({ ...newTarget, name: e.target.value })
                    }
                    placeholder="Name"
                    data-testid={`${props.type}-target-new-name`}
                    className="w-full px-2 py-1 bg-background border border-border rounded text-foreground text-sm"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    type="number"
                    step="0.1"
                    value={newTarget.targetPercent}
                    onChange={(e) =>
                      setNewTarget({ ...newTarget, targetPercent: e.target.value })
                    }
                    placeholder="%"
                    data-testid={`${props.type}-target-new-percent`}
                    className="w-20 px-2 py-1 bg-background border border-border rounded text-foreground text-sm"
                  />
                </td>
                {isProfit && (
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      step="1"
                      value={newTarget.allocationPercent}
                      onChange={(e) =>
                        setNewTarget({ ...newTarget, allocationPercent: e.target.value })
                      }
                      placeholder="Alloc"
                      data-testid={`${props.type}-target-new-alloc`}
                      className="w-20 px-2 py-1 bg-background border border-border rounded text-foreground text-sm"
                    />
                  </td>
                )}
                <td className="px-4 py-2">
                  <input
                    type="number"
                    value={newTarget.sortOrder}
                    onChange={(e) =>
                      setNewTarget({ ...newTarget, sortOrder: e.target.value })
                    }
                    data-testid={`${props.type}-target-new-order`}
                    className="w-16 px-2 py-1 bg-background border border-border rounded text-foreground text-sm"
                  />
                </td>
                <td className="px-4 py-2">
                  <div className="flex gap-2">
                    <button
                      onClick={handleCreate}
                      disabled={isSubmitting}
                      data-testid={`${props.type}-target-new-submit`}
                      className="text-green-400 hover:text-green-300 disabled:opacity-50"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => setIsAdding(false)}
                      data-testid={`${props.type}-target-new-cancel`}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      Cancel
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {targets.length === 0 && !isAdding && (
              <tr>
                <td
                  colSpan={isProfit ? 5 : 4}
                  className="px-4 py-4 text-center text-muted-foreground"
                >
                  No {isProfit ? "profit" : "entry"} targets yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
