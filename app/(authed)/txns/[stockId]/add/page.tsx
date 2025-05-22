// app/(authed)/txns/[stockId]/add/page.tsx
// 'use client';

// import React, { useState, useEffect, useCallback, useMemo } from 'react';
// import { useParams } from 'next/navigation'; // Hook to get URL params
// import TransactionForm from '@/app/components/TransactionForm'; // Adjust path if needed
// import { generateClient } from 'aws-amplify/data';
// import type { Schema } from '@/amplify/data/resource';
// import { FaEdit, FaTrashAlt } from 'react-icons/fa';
// import type { GraphQLError } from 'graphql';

// const client = generateClient<Schema>();
// type TransactionItem = Schema['Transaction'];
// type TransactionDataType = Schema['Transaction']['type'];
// type PortfolioGoalsType = Schema['PortfolioGoals']['type'];

// type TxnActionValue = TransactionDataType['action']; // Expect: "Buy" | "Sell" | "Div"
// type TxnSignalValue = TransactionDataType['signal']; // Expect: "_5DD" | "Cust" | ... | null | undefined
// //type SharesTypeValue = TransactionDataType['sharesType']; // Expect: "Play" | "Hold" | null | undefined

// type TransactionCreateInput = Omit<TransactionDataType, 'id' | 'createdAt' | 'updatedAt' | 'owner' | 'portfolioStock' | 'completedTxnId'>; // Adjust omit list
// type TransactionUpdateInput = Partial<TransactionDataType> & { id: string };

// // --- ADD THIS TYPE DEFINITION ---
// // Derive the type returned by the list operation after awaiting
// type TransactionListResultType = Awaited<ReturnType<typeof client.models.Transaction.list>>;
// // This evaluates to something like:
// // { data: Schema['Transaction'][], errors?: readonly GraphQLError[], nextToken?: string | null }
// // --- END TYPE DEFINITION ---

// export default function AddTransactionForStockPage() {
//   return (
//     <div>
//         <h2>Transaction Add/Edit Page (Disabled)</h2>
//         <p>
//             This functionality has been moved. Please use the Wallets page to manage transactions.
//         </p>
//         {/* You could add a Link component here to redirect if desired */}
//     </div>
// );
// }