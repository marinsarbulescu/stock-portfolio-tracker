"use client";

import { useState } from "react";

export interface Budget {
  id: string;
  year: number;
  amount: number;
}

interface BudgetListProps {
  assetId: string;
  budgets: Budget[];
  onCreate: (data: Omit<Budget, "id">) => Promise<void>;
  onUpdate: (id: string, data: Partial<Budget>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onError: (message: string) => void;
}

interface BudgetForm {
  year: string;
  amount: string;
}

export function BudgetList({
  budgets,
  onCreate,
  onUpdate,
  onDelete,
  onError,
}: BudgetListProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newBudget, setNewBudget] = useState<BudgetForm>({
    year: String(new Date().getFullYear()),
    amount: "",
  });
  const [editBudget, setEditBudget] = useState<BudgetForm>({
    year: "",
    amount: "",
  });

  function resetNewForm() {
    setNewBudget({
      year: String(new Date().getFullYear()),
      amount: "",
    });
  }

  function startAdding() {
    resetNewForm();
    setIsAdding(true);
  }

  function startEditing(budget: Budget) {
    setEditingId(budget.id);
    setEditBudget({
      year: String(budget.year),
      amount: String(budget.amount),
    });
  }

  function cancelEditing() {
    setEditingId(null);
  }

  // Check if year already exists (for validation)
  function yearExists(year: number, excludeId?: string): boolean {
    return budgets.some((b) => b.year === year && b.id !== excludeId);
  }

  async function handleCreate() {
    if (!newBudget.year || !newBudget.amount) {
      onError("Year and amount are required");
      return;
    }

    const year = parseInt(newBudget.year);
    if (yearExists(year)) {
      onError(`Budget for year ${year} already exists`);
      return;
    }

    setIsSubmitting(true);
    try {
      await onCreate({
        year,
        amount: parseFloat(newBudget.amount),
      });
      setIsAdding(false);
      resetNewForm();
    } catch {
      onError("Failed to create budget");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUpdate(id: string) {
    if (!editBudget.year || !editBudget.amount) {
      onError("Year and amount are required");
      return;
    }

    const year = parseInt(editBudget.year);
    if (yearExists(year, id)) {
      onError(`Budget for year ${year} already exists`);
      return;
    }

    setIsSubmitting(true);
    try {
      await onUpdate(id, {
        year,
        amount: parseFloat(editBudget.amount),
      });
      setEditingId(null);
    } catch {
      onError("Failed to update budget");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this budget?")) return;

    try {
      await onDelete(id);
    } catch {
      onError("Failed to delete budget");
    }
  }

  const sortedBudgets = [...budgets].sort((a, b) => b.year - a.year);

  return (
    <div className="bg-card border border-border rounded-lg">
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-card-foreground">Yearly Budgets</h3>
          {!isAdding && (
            <button
              onClick={startAdding}
              className="text-sm text-blue-400 hover:text-blue-300"
              data-testid="budget-add-btn"
            >
              + Add
            </button>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          The yearly budget represents the maximum out of pocket that you are willing to invest in this asset, in one year.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-4 py-2 font-medium text-muted-foreground">Year</th>
              <th className="px-4 py-2 font-medium text-muted-foreground">Amount</th>
              <th className="px-4 py-2 font-medium text-muted-foreground w-20"></th>
            </tr>
          </thead>
          <tbody>
            {sortedBudgets.map((budget) => (
              <tr key={budget.id} className="border-b border-border" data-testid={`budget-row-${budget.year}`}>
                {editingId === budget.id ? (
                  <>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        value={editBudget.year}
                        onChange={(e) =>
                          setEditBudget({ ...editBudget, year: e.target.value })
                        }
                        className="w-24 px-2 py-1 bg-background border border-border rounded text-foreground text-sm"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        step="0.01"
                        value={editBudget.amount}
                        onChange={(e) =>
                          setEditBudget({ ...editBudget, amount: e.target.value })
                        }
                        className="w-32 px-2 py-1 bg-background border border-border rounded text-foreground text-sm"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUpdate(budget.id)}
                          disabled={isSubmitting}
                          className="text-green-400 hover:text-green-300 disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          onClick={cancelEditing}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          Cancel
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-2 text-card-foreground">{budget.year}</td>
                    <td className="px-4 py-2 text-card-foreground">
                      ${budget.amount.toLocaleString()}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => startEditing(budget)}
                          className="text-blue-400 hover:text-blue-300"
                          data-testid={`budget-edit-${budget.year}`}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(budget.id)}
                          className="text-red-400 hover:text-red-300"
                          data-testid={`budget-delete-${budget.year}`}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}

            {isAdding && (
              <tr className="border-b border-border bg-muted/30" data-testid="budget-new-row">
                <td className="px-4 py-2">
                  <input
                    type="number"
                    value={newBudget.year}
                    onChange={(e) =>
                      setNewBudget({ ...newBudget, year: e.target.value })
                    }
                    placeholder="Year"
                    className="w-24 px-2 py-1 bg-background border border-border rounded text-foreground text-sm"
                    data-testid="budget-new-year"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    type="number"
                    step="0.01"
                    value={newBudget.amount}
                    onChange={(e) =>
                      setNewBudget({ ...newBudget, amount: e.target.value })
                    }
                    placeholder="Amount"
                    className="w-32 px-2 py-1 bg-background border border-border rounded text-foreground text-sm"
                    data-testid="budget-new-amount"
                  />
                </td>
                <td className="px-4 py-2">
                  <div className="flex gap-2">
                    <button
                      onClick={handleCreate}
                      disabled={isSubmitting}
                      className="text-green-400 hover:text-green-300 disabled:opacity-50"
                      data-testid="budget-new-submit"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => setIsAdding(false)}
                      className="text-muted-foreground hover:text-foreground"
                      data-testid="budget-new-cancel"
                    >
                      Cancel
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {budgets.length === 0 && !isAdding && (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-4 text-center text-muted-foreground"
                >
                  No budgets yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
