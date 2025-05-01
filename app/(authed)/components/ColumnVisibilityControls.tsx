// app/(authed)/components/ColumnVisibilityControls.tsx
'use client';

import React from 'react';

// Define types for the component
export interface ReportColumnVisibilityState {
    fiveDayDip: boolean;
    lbd: boolean;
    swingWalletCount: boolean;
    sinceBuy: boolean;
    sinceSell: boolean;
    currentPrice: boolean;
    percentToBe: boolean;
    ltpiaTakeProfitPrice: boolean;
    percentToTp: boolean;
    tpShares: boolean;
}

interface ColumnVisibilityControlsProps {
    columnVisibility: ReportColumnVisibilityState;
    setColumnVisibility: React.Dispatch<React.SetStateAction<ReportColumnVisibilityState>>;
    columnLabels: Record<keyof ReportColumnVisibilityState, string>;
}

export default function ColumnVisibilityControls({
    columnVisibility,
    setColumnVisibility,
    columnLabels
}: ColumnVisibilityControlsProps) {
    return (
        <div style={{ marginBottom: '1rem', marginTop: '1rem', padding: '10px', border: '1px solid #353535', fontSize: '0.7em', color: "gray" }}>
            {(Object.keys(columnVisibility) as Array<keyof ReportColumnVisibilityState>).map((key) => (
                <label key={key} style={{ marginLeft: '15px', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                    <input
                        type="checkbox"
                        checked={columnVisibility[key]}
                        onChange={() =>
                            setColumnVisibility((prev) => ({
                                ...prev,
                                [key]: !prev[key],
                            }))
                        }
                        style={{ marginRight: '5px', cursor: 'pointer' }}
                    />
                    {columnLabels[key]}
                </label>
            ))}
        </div>
    );
}