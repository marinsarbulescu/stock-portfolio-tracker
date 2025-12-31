"use client";

import { Column } from "./SortableTable";

interface ColumnToggleProps<T> {
  columns: Column<T>[];
  visibleKeys: Set<string>;
  onToggle: (key: string) => void;
}

export function ColumnToggle<T>({
  columns,
  visibleKeys,
  onToggle,
}: ColumnToggleProps<T>) {
  // Only show toggles for columns that have a header (skip action columns with empty headers)
  const toggleableColumns = columns.filter(
    (col) => col.header && col.toggleable !== false
  );

  if (toggleableColumns.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 mb-4 text-sm">
      {toggleableColumns.map((column) => {
        const key = String(column.key);
        const isVisible = visibleKeys.has(key);

        return (
          <label
            key={key}
            className="flex items-center gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground select-none"
          >
            <input
              type="checkbox"
              data-testid={`column-toggle-${key}`}
              checked={isVisible}
              onChange={() => onToggle(key)}
              className="w-3.5 h-3.5 rounded border-border bg-background text-foreground focus:ring-1 focus:ring-border cursor-pointer"
            />
            <span className={isVisible ? "text-foreground" : ""}>
              {column.header}
            </span>
          </label>
        );
      })}
    </div>
  );
}
