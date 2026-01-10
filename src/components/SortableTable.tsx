"use client";

import { useState, useMemo } from "react";

export interface Column<T> {
  key: keyof T | string;
  header: string;
  headerTestId?: string; // Optional data-testid for the header cell
  sortable?: boolean;
  toggleable?: boolean; // Set to false to always show column (e.g., actions)
  defaultHidden?: boolean; // Set to true to hide column by default (user can toggle)
  render?: (item: T) => React.ReactNode;
}

interface SortableTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyField: keyof T;
  emptyMessage?: string;
  hiddenColumns?: Set<string>; // Keys of columns to hide
  rowTestId?: (item: T) => string; // Generate data-testid for each row
  rowClassName?: (item: T) => string; // Generate additional className for each row
}

type SortDirection = "asc" | "desc";

export function SortableTable<T>({
  data,
  columns,
  keyField,
  emptyMessage = "No data available",
  hiddenColumns,
  rowTestId,
  rowClassName,
}: SortableTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  // Filter out hidden columns
  const visibleColumns = useMemo(() => {
    if (!hiddenColumns || hiddenColumns.size === 0) return columns;
    return columns.filter((col) => !hiddenColumns.has(String(col.key)));
  }, [columns, hiddenColumns]);

  const sortedData = useMemo(() => {
    if (!sortKey) return data;

    return [...data].sort((a, b) => {
      const aValue = (a as Record<string, unknown>)[sortKey];
      const bValue = (b as Record<string, unknown>)[sortKey];

      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      let comparison = 0;
      if (typeof aValue === "string" && typeof bValue === "string") {
        comparison = aValue.localeCompare(bValue);
      } else if (typeof aValue === "number" && typeof bValue === "number") {
        comparison = aValue - bValue;
      } else {
        comparison = String(aValue).localeCompare(String(bValue));
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [data, sortKey, sortDirection]);

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  }

  function renderSortIndicator(key: string) {
    if (sortKey !== key) {
      return <span className="text-muted-foreground/50 ml-1">↕</span>;
    }
    return (
      <span className="ml-1">{sortDirection === "asc" ? "↑" : "↓"}</span>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            {visibleColumns.map((column) => (
              <th
                key={String(column.key)}
                className={`px-4 py-3 text-left text-sm font-medium text-muted-foreground ${
                  column.sortable !== false
                    ? "cursor-pointer hover:text-foreground select-none"
                    : ""
                }`}
                onClick={() =>
                  column.sortable !== false && handleSort(String(column.key))
                }
                data-testid={column.headerTestId}
              >
                {column.header}
                {column.sortable !== false && renderSortIndicator(String(column.key))}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedData.map((item) => {
            const customRowClass = rowClassName ? rowClassName(item) : "";
            // Use custom row class for text color, or default to text-card-foreground
            const textColorClass = customRowClass || "text-card-foreground";
            return (
            <tr
              key={String((item as Record<string, unknown>)[keyField as string])}
              className={`border-b border-border hover:bg-muted/50 ${textColorClass}`}
              data-testid={rowTestId ? rowTestId(item) : undefined}
            >
              {visibleColumns.map((column) => (
                <td
                  key={String(column.key)}
                  className="px-4 py-3 text-sm"
                >
                  {column.render
                    ? column.render(item)
                    : String((item as Record<string, unknown>)[column.key as string] ?? "-")}
                </td>
              ))}
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
