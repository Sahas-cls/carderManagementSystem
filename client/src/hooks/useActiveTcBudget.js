import { useEffect, useState } from "react";
import { getTcBudgets } from "../services/tcBudgetServices";

/**
 * Loads the currently active TC (Training Center) Budget Master entry (if any) for a factory.
 * Daily Data Entry's Training Center "Planned" field mirrors whatever TC budget is active for
 * the selected factory, so this re-fetches whenever `factoryId` changes.
 */
export default function useActiveTcBudget(factoryId) {
  const [activeTcBudget, setActiveTcBudget] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!factoryId) {
        if (!cancelled) setActiveTcBudget(null);
        return;
      }
      setLoading(true);
      try {
        const tcBudgets = await getTcBudgets(factoryId);
        if (!cancelled) setActiveTcBudget(tcBudgets.find((b) => b.status) || null);
      } catch {
        if (!cancelled) setActiveTcBudget(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [factoryId]);

  return { activeTcBudget, loading };
}
