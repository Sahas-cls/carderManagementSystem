import { useCallback, useEffect, useState } from "react";
import { getFactories } from "../services/cadreServices";
import { createDailyRecord, deleteDailyRecord, listDailyRecords, updateDailyRecord } from "../services/dailyCadreServices";
import { getWeeks } from "../services/weekServices";

const now = new Date();

/**
 * Backs the Daily Data Entry page: loads one calendar month's records from
 * the Node backend (newest-entered first) - `period` picks which month
 * (defaults to the current one, so old data users entered under a past
 * month stays reachable via the page's month filter), plus the
 * factory/week lists the form needs, and exposes add/update/delete that
 * hit the API and refresh the list. When `factoryId` is given, the
 * "Daily Data Records" table is scoped to that factory (re-fetches
 * whenever it changes) - otherwise every factory's records are shown.
 */
export default function useDailyCadreRecords(factoryId, period) {
  const year = period?.year ?? now.getFullYear();
  const month = period?.month ?? now.getMonth() + 1;
  const [records, setRecords] = useState([]);
  const [factories, setFactories] = useState([]);
  const [weeks, setWeeks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const refetch = useCallback(() => setReloadToken((n) => n + 1), []);

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
  }, [reloadToken]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const data = await listDailyRecords({ year, month, factoryId });
        if (!cancelled) {
          setRecords(data);
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
  }, [reloadToken, factoryId, year, month]);

  const addRecord = useCallback(
    async (payload) => {
      await createDailyRecord(payload);
      refetch();
    },
    [refetch]
  );

  const updateRecord = useCallback(
    async (batchId, payload) => {
      await updateDailyRecord(batchId, payload);
      refetch();
    },
    [refetch]
  );

  const deleteRecord = useCallback(
    async (batchId) => {
      await deleteDailyRecord(batchId);
      refetch();
    },
    [refetch]
  );

  return { records, factories, weeks, loading, error, addRecord, updateRecord, deleteRecord, refetch };
}
