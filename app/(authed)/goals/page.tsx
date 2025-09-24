// app/(authed)/goals/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource'; // Adjust path if needed

// Define the type for the Goals model instance (includes id, etc.)
type GoalsDataType = Schema["PortfolioGoals"]["type"];
//type GoalsItem = Schema['PortfolioGoals'];
// Define the type for the form data (just the fields)
type GoalsFormData = Omit<GoalsDataType, 'id' | 'createdAt' | 'updatedAt' | 'owner'>;

const client = generateClient<Schema>();

export default function GoalsPage() {
  // State for the existing goals record (if found)
  const [existingGoalsId, setExistingGoalsId] = useState<string | null>(null); // Store ID separately

  // State for individual form fields (bound to inputs)
  const [totalBudget, setTotalBudget] = useState('');
  const [usBudgetPercent, setUsBudgetPercent] = useState('');
  const [intBudgetPercent, setIntBudgetPercent] = useState('');
  const [usStocksTarget, setUsStocksTarget] = useState('');
  const [usEtfsTarget, setUsEtfsTarget] = useState('');
  const [intStocksTarget, setIntStocksTarget] = useState('');
  const [intEtfsTarget, setIntEtfsTarget] = useState('');

  // State for loading, saving, errors, success
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Function to populate form state from fetched data
  const populateForm = (goalsData: GoalsDataType | null | undefined) => {
    setTotalBudget(goalsData?.totalBudget?.toString() ?? '');
    setUsBudgetPercent(goalsData?.usBudgetPercent?.toString() ?? '');
    setIntBudgetPercent(goalsData?.intBudgetPercent?.toString() ?? '');
    setUsStocksTarget(goalsData?.usStocksTarget?.toString() ?? '');
    setUsEtfsTarget(goalsData?.usEtfsTarget?.toString() ?? '');
    setIntStocksTarget(goalsData?.intStocksTarget?.toString() ?? '');
    setIntEtfsTarget(goalsData?.intEtfsTarget?.toString() ?? '');
  };

  // Fetch existing goals for the current user
  const fetchGoals = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Owner auth rules mean list() will return 0 or 1 item for the logged-in user
      const { data: goalsList, errors } = await client.models.PortfolioGoals.list({});
      if (errors) throw errors;

      const currentGoals = goalsList[0]; // This is ClientModel<...>
      if (currentGoals) {
          setExistingGoalsId(currentGoals.id); // Store ID
          // --- Store data using simpler type (with cast) ---
          populateForm(currentGoals as GoalsDataType);
      } else { /* ... handle no goals found ... */ }
    } catch { /* ... error handling ... */ }
    finally { setIsLoading(false); }
  }, []);

  // Fetch goals on initial load
  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);


  // Handle saving the goals (Create or Update)
  const handleSaveGoals = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      // Prepare payload with parsed numbers (handle empty strings)
      const payload: GoalsFormData = {
        totalBudget: totalBudget ? parseFloat(totalBudget) : null,
        usBudgetPercent: usBudgetPercent ? parseFloat(usBudgetPercent) : null,
        intBudgetPercent: intBudgetPercent ? parseFloat(intBudgetPercent) : null,
        usStocksTarget: usStocksTarget ? parseInt(usStocksTarget, 10) : null,
        usEtfsTarget: usEtfsTarget ? parseInt(usEtfsTarget, 10) : null,
        intStocksTarget: intStocksTarget ? parseInt(intStocksTarget, 10) : null,
        intEtfsTarget: intEtfsTarget ? parseInt(intEtfsTarget, 10) : null,
      };

      let savedGoals: GoalsDataType | undefined;
      let saveErrors;

      if (existingGoalsId) { // Use ID from state
        // UPDATE
        const { data, errors } = await client.models.PortfolioGoals.update({ id: existingGoalsId, ...payload });
        savedGoals = data ?? undefined; // Assign the returned data
        saveErrors = errors;
      } else {
          // CREATE
          const { data, errors } = await client.models.PortfolioGoals.create(payload);
          savedGoals = data ?? undefined; // Assign the returned data
          saveErrors = errors;
          // Update state if needed
          if (savedGoals) {
              setExistingGoalsId(savedGoals.id);
              populateForm(savedGoals as GoalsDataType);
          }
      }

      if (saveErrors) throw saveErrors;

      console.log('Goals saved successfully:', savedGoals);
      setSuccess('Goals saved successfully!');

      if (savedGoals) {
        setExistingGoalsId(savedGoals.id); // Update ID
        // Ensure we cast the potentially full ClientModel to GoalsDataType for state
        populateForm(savedGoals as GoalsDataType);
      }

    } catch (err: unknown) {
      console.error("Error saving goals:", err);
      const errorMessage = Array.isArray(err) ? (err as Array<{message: string}>)[0].message : ((err as Error).message || "An unexpected error occurred.");
      setError(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  // Render UI
  if (isLoading) {
    return <p>Loading goals...</p>;
  }

  return (
    <div>
      <h2>Portfolio Goals</h2>
      <form onSubmit={handleSaveGoals} style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '500px' }}>
        {error && <p style={{ color: 'red' }}>Error: {error}</p>}
        {success && <p style={{ color: 'green' }}>{success}</p>}

        <div>
          <label htmlFor="totalBudget">Annual Total Budget ($):</label>
          <input id="totalBudget" type="number" step="0.01" value={totalBudget} onChange={e => setTotalBudget(e.target.value)} disabled={isSaving} style={{ width: '100%' }} />
        </div>
        <div>
          <label htmlFor="usBudgetPercent">Annual US Budget (%):</label>
          <input id="usBudgetPercent" type="number" step="0.01" value={usBudgetPercent} onChange={e => setUsBudgetPercent(e.target.value)} disabled={isSaving} style={{ width: '100%' }} />
        </div>
         <div>
          <label htmlFor="intBudgetPercent">Annual Int&apos;l Budget (%):</label>
          <input id="intBudgetPercent" type="number" step="0.01" value={intBudgetPercent} onChange={e => setIntBudgetPercent(e.target.value)} disabled={isSaving} style={{ width: '100%' }} />
        </div>
         <div>
          <label htmlFor="usStocksTarget">Target # US Stocks:</label>
          <input id="usStocksTarget" type="number" step="1" value={usStocksTarget} onChange={e => setUsStocksTarget(e.target.value)} disabled={isSaving} style={{ width: '100%' }} />
        </div>
         <div>
          <label htmlFor="usEtfsTarget">Target # US ETFs:</label>
          <input id="usEtfsTarget" type="number" step="1" value={usEtfsTarget} onChange={e => setUsEtfsTarget(e.target.value)} disabled={isSaving} style={{ width: '100%' }} />
        </div>
        <div>
          <label htmlFor="intStocksTarget">Target # Int&apos;l Stocks:</label>
          <input id="intStocksTarget" type="number" step="1" value={intStocksTarget} onChange={e => setIntStocksTarget(e.target.value)} disabled={isSaving} style={{ width: '100%' }} />
        </div>
         <div>
          <label htmlFor="intEtfsTarget">Target # Int&apos;l ETFs:</label>
          <input id="intEtfsTarget" type="number" step="1" value={intEtfsTarget} onChange={e => setIntEtfsTarget(e.target.value)} disabled={isSaving} style={{ width: '100%' }} />
        </div>

        <button type="submit" disabled={isSaving} style={{ marginTop: '1rem', padding: '10px' }}>
          {isSaving ? 'Saving...' : 'Save Goals'}
        </button>
      </form>
    </div>
  );
}