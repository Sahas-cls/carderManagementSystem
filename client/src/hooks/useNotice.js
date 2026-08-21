import { useCallback, useRef, useState } from "react";

/**
 * Small helper for the "notice" banner shown at the top of a page
 * (success/error toast that auto-clears after 3s).
 * Usage: const [notice, showNotice] = useNotice();
 */
export default function useNotice() {
  const [notice, setNotice] = useState(null); // { message, type: 'ok' | 'err' }
  const timerRef = useRef(null);

  const showNotice = useCallback((message, type = "ok") => {
    setNotice({ message, type });
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setNotice(null), 3000);
  }, []);

  return [notice, showNotice];
}
