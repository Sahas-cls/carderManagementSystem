import { useCallback, useEffect, useState } from "react";
import { getFactories, getWeeklyCadre } from "../services/cadreServices";
import { getWeeks } from "../services/weekServices";

/**
 * Backs the Weekly Data View page: loads the factory/week filter option
 * lists once, then loads the weekly cadre rows (re-fetched whenever the
 * factory/week filter changes) from the Node backend.
 */
export default function useWeeklyCadre({ factoryId, weekId } = {}) {
  const [factories, setFactories] = useState([]);
  const [weeks, setWeeks] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [weeksReloadToken, setWeeksReloadToken] = useState(0);
  const [rowsReloadToken, setRowsReloadToken] = useState(0);

  const refetchWeeks = useCallback(() => setWeeksReloadToken((n) => n + 1), []);
  const refetch = useCallback(() => setRowsReloadToken((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [factoryList, weekList] = await Promise.all([getFactories(), getWeeks()]);
        if (!cancelled) {
          setFactories(factoryList);
          setWeeks(weekList);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [weeksReloadToken]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const data = await getWeeklyCadre({ factoryId, weekId });
        if (!cancelled) {
          setRows(data);
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
  }, [factoryId, weekId, rowsReloadToken]);

  return { rows, factories, weeks, loading, error, refetch, refetchWeeks };
}
