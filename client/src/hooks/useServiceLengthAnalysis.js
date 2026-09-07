import { useEffect, useState } from "react";
import { getServiceLengthAnalysis } from "../services/employeeServices";

/**
 * Loads this year's resigned-employee counts bucketed by length of service
 * at resignation, optionally scoped to one factory - backs the Dashboard's
 * "LTO by Length of Service" donut chart (mirrors the "LTO_Analysis_ Service"
 * sheet in the HR Performance Analysis report). Re-fetches whenever
 * `factoryId` or `year` changes.
 */
export default function useServiceLengthAnalysis({ factoryId, year } = {}) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const data = await getServiceLengthAnalysis({ factoryId, year });
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
