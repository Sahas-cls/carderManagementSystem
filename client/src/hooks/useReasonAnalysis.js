import { useEffect, useState } from "react";
import { getReasonAnalysis } from "../services/employeeServices";

/**
 * Loads this year's resigned-employee counts grouped by resignation reason,
 * optionally scoped to one factory - backs the Dashboard's "LTO by Reason"
 * pie chart (mirrors the "LTO_ Analysis_Reason" sheet in the HR Performance
 * Analysis report). Re-fetches whenever `factoryId` or `year` changes.
 */
export default function useReasonAnalysis({ factoryId, year } = {}) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const data = await getReasonAnalysis({ factoryId, year });
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
  }, [factoryId, year]);

  return { analysis, loading, error };
}
