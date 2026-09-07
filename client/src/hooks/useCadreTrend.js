import { useEffect, useState } from "react";
import { getCadreTrend } from "../services/dailyCadreServices";

/**
 * Loads the Group-wide Budget vs Allocated (Actual) trend for a calendar
 * year (defaults to the current year) - backs the Dashboard's "Cadre
 * Trend" chart. Re-fetches whenever `year` or `factoryId` changes.
 */
export default function useCadreTrend({ year, factoryId } = {}) {
  const [trend, setTrend] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const data = await getCadreTrend({ year, factoryId });
        if (!cancelled) {
          setTrend(data);
          setError("");
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [year, factoryId]);

  return { trend, loading, error };
}
