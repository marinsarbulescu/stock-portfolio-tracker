"use client";

import { useState, useCallback, useMemo } from "react";
import { Column } from "@/components/SortableTable";

interface UseColumnVisibilityOptions {
  storageKey?: string; // Optional localStorage key for persistence
}

export function useColumnVisibility<T>(
  columns: Column<T>[],
  options: UseColumnVisibilityOptions = {}
) {
  const { storageKey } = options;

  // Get initial visible keys from localStorage or default based on column config
  const getInitialVisibleKeys = (): Set<string> => {
    // Get all toggleable column keys
    const allToggleableKeys = new Set(
      columns
        .filter((col) => col.toggleable !== false)
        .map((col) => String(col.key))
    );

    // Get keys that should be hidden by default
    const defaultHiddenKeys = new Set(
      columns
        .filter((col) => col.toggleable !== false && col.defaultHidden === true)
        .map((col) => String(col.key))
    );

    if (storageKey && typeof window !== "undefined") {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        try {
          const storedKeys = new Set<string>(JSON.parse(stored));
          // Add any new columns that weren't in storage (show by default unless defaultHidden)
          allToggleableKeys.forEach((key) => {
            if (!storedKeys.has(key) && !defaultHiddenKeys.has(key)) {
              storedKeys.add(key);
            }
          });
          // Remove any stored keys that no longer exist in columns
          storedKeys.forEach((key) => {
            if (!allToggleableKeys.has(key)) {
              storedKeys.delete(key);
            }
          });
          return storedKeys;
        } catch {
          // Invalid JSON, fall through to default
        }
      }
    }
    // Default: all toggleable columns are visible except those with defaultHidden
    const visibleByDefault = new Set<string>();
    allToggleableKeys.forEach((key) => {
      if (!defaultHiddenKeys.has(key)) {
        visibleByDefault.add(key);
      }
    });
    return visibleByDefault;
  };

  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(
    getInitialVisibleKeys
  );

  const toggle = useCallback(
    (key: string) => {
      setVisibleKeys((prev) => {
        const next = new Set(prev);
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
        }

        // Persist to localStorage if storageKey provided
        if (storageKey && typeof window !== "undefined") {
          localStorage.setItem(storageKey, JSON.stringify(Array.from(next)));
        }

        return next;
      });
    },
    [storageKey]
  );

  // Calculate hidden columns (inverse of visible)
  const hiddenColumns = useMemo(() => {
    const hidden = new Set<string>();
    columns.forEach((col) => {
      const key = String(col.key);
      // Only consider toggleable columns
      if (col.toggleable !== false && !visibleKeys.has(key)) {
        hidden.add(key);
      }
    });
    return hidden;
  }, [columns, visibleKeys]);

  return {
    visibleKeys,
    hiddenColumns,
    toggle,
  };
}
