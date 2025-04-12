// app/add-stocks/page.tsx
'use client'; // AddStockForm requires client-side rendering

import AddStockForm from '@/app/components/AddStockForm'; // Adjust path
import React from 'react';

export default function AddStocksPage() {

  const handleStockAdded = () => {
    // You might want to redirect the user or show a success message
    alert('Stock added successfully! View it in your portfolio.');
    // Example redirect (optional):
    // import { useRouter } from 'next/navigation';
    // const router = useRouter();
    // router.push('/stocks-listing');
    console.log("Stock added callback triggered on AddStocksPage.");
  };

  return (
    <div>
      <h1>Add New Stock</h1>
      <AddStockForm onStockAdded={handleStockAdded} />
    </div>
  );
}