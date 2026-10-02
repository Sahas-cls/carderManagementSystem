import { useEffect, useState } from "react";
import { getAgeAnalysis } from "../services/employeeServices";

/**
 * Loads this year's resigned-employee counts grouped by age at resignation,
 * optionally scoped to one factory - backs the Dashboard's "LTO by Age"
 * donut chart. Re-fetches whenever `factoryId`, `year` or `month` changes. `month` (optional, 1-12) narrows it to one
 * calendar month - the dashboard's Month filter.
 */
export default function useAgeAnalysis({ factoryId, year, month } = {}) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const data = await getAgeAnalysis({ factoryId, year, month });
        if (!cancelled) {
          setAnalysis(data);
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
  }, [factoryId, year, month]);

  return { analysis, loading, error };
}
