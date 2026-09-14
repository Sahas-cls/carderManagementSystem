/** Auto-clearing success/error banner. Pair with the useNotice hook. */
export default function Notice({ message, type }) {
  if (!message) return null; 

  const styles =
    type === "ok"
      ? "bg-green-soft text-green-800 border border-green-200"
      : "bg-red-50 text-red-700 border border-red-200";

  return <div className={`px-3.5 py-2.5 rounded-md mb-3.5 text-sm ${styles}`}>{message}</div>;
}
