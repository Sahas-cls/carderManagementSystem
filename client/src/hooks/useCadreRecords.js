import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "cadreRecords";

function loadRecords() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

/**
 * Persists cadre daily records to localStorage, same storage key/shape as
 * the original static prototype so existing saved data keeps working.
 */
export default function useCadreRecords() {
  const [records, setRecords] = useState(loadRecords);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }, [records]);

  const addRecord = useCallback((record) => {
    setRecords((prev) => [...prev, record]);
  }, []);

  const updateRecord = useCallback((index, record) => {
    setRecords((prev) => prev.map((r, i) => (i === index ? record : r)));
  }, []);

  const deleteRecord = useCallback((index) => {
    setRecords((prev) => prev.filter((_, i) => i !== index));
  }, []);

  return { records, addRecord, updateRecord, deleteRecord };
}
