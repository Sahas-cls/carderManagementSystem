import { useEffect, useState } from "react";
import { getBudgets } from "../services/budgetServices";

/**
 * Loads the currently active Budget Master entry (if any) for a factory. Daily Data Entry's
 * "Planned MO/TMO" section mirrors whatever budget is active for the selected factory, so this
 * re-fetches whenever `factoryId` changes.
 */
export default function useActiveBudget(factoryId) {
  const [activeBudget, setActiveBudget] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!factoryId) {
        if (!cancelled) setActiveBudget(null);
        return;
      }
      setLoading(true);
      try {
        const budgets = await getBudgets(factoryId);
        if (!cancelled) setActiveBudget(budgets.find((b) => b.status) || null);
      } catch {
        if (!cancelled) setActiveBudget(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [factoryId]);

  return { activeBudget, loading };
}
