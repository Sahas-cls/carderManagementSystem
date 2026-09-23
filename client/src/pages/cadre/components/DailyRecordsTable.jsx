import { useState } from "react";
import Card from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import { CountBadge } from "../../../components/ui/Badge";

const TH = "border border-slate-400 p-1.5";
const TD = "border border-slate-400 p-1.5";

// Clickable header cell - click toggles asc/desc on that field, or switches
// to sorting by this field (ascending) if a different column was active.
function SortableTH({ label, sortKey, currentSort, onSort, className, ...rest }) {
  const active = currentSort.key === sortKey;
  return (
    <th
      className={`${className} cursor-pointer select-none hover:bg-white/20`}
      onClick={() => onSort(sortKey)}
      title="Click to sort"
      {...rest}
    >
      {label}
      <span className="inline-block w-2.5 ml-0.5">
        {active ? (currentSort.dir === "asc" ? "▲" : "▼") : ""}
      </span>
    </th>
  );
}
// Grand-total footer cells for columns that are a point-in-time snapshot
// (planned/allocated/shortage/net/current headcount) rather than a daily
// flow - summing them across the month wouldn't be a meaningful total, so
// they're muted with a dash instead of a number.
const TD_NA =
  "border border-slate-400 p-1.5 bg-slate-100 text-slate-300 font-normal";

export default function DailyRecordsTable({
  records,
  highlightBatchId,
  onEdit,
  onDelete,
  month,
  onMonthChange,
  factories,
  factoryFilter,
  onFactoryFilterChange,
}) {
  // No handlers (SuperUser - view-only) means no Action column at all.
  const canEdit = !!(onEdit || onDelete);
  // Sums a numeric field across every currently-displayed (i.e. this month's) record for the grand-totals footer row.
  const sum = (key) =>
    records.reduce((total, r) => total + (Number(r[key]) || 0), 0);

  // Default: newest first, matching the previous fixed behavior.
  const [sort, setSort] = useState({ key: "date", dir: "desc" });
  const toggleSort = (key) =>
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );

  // Dates are ISO YYYY-MM-DD strings so a plain string compare is
  // chronological; blank dates sink to the bottom regardless of direction.
  // Every other column is a numeric field, compared as a number.
  const sortedRecords = [...records].sort((a, b) => {
    const dir = sort.dir === "asc" ? 1 : -1;
    if (sort.key === "date") {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return a.date.localeCompare(b.date) * dir;
    }
    return ((Number(a[sort.key]) || 0) - (Number(b[sort.key]) || 0)) * dir;
  });
  return (
    <Card
      title="Daily Data Records"
      variant="teal"
      actions={
        <div className="flex items-center gap-3">
          {onFactoryFilterChange && (
            <label className="flex items-center gap-1.5 text-xs font-normal text-white">
              Factory:
              <select
                value={factoryFilter || ""}
                onChange={(e) => onFactoryFilterChange(e.target.value)}
                className="rounded border border-white/40 bg-white/10 px-1.5 py-0.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-white [color-scheme:dark]"
              >
                {(factories || []).map((f) => (
                  <option key={f.id} value={f.id} className="text-slate-900">
                    {f.factoryName}
                  </option>
                ))}
              </select>
            </label>
          )}
          {onMonthChange && (
            <label className="flex items-center gap-1.5 text-xs font-normal text-white">
              Month:
              <input
                type="month"
                value={month}
                onChange={(e) => onMonthChange(e.target.value)}
                className="rounded border border-white/40 bg-white/10 px-1.5 py-0.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-white [color-scheme:dark]"
              />
            </label>
          )}
          <CountBadge>
            {records.length} record{records.length === 1 ? "" : "s"}
          </CountBadge>
        </div>
      }
    >
      <div className="overflow-auto max-h-[60vh] relative">
        <table className="border-collapse max-h-[200px] md:max-h-[400px] lg:max-h-[700px] text-[10.5px] relative">
          <thead className="sticky top-0">
            <tr className="bg-navy text-white text-[11px] leading-tight h-[55px]">
              <SortableTH
                label="Date"
                sortKey="date"
                currentSort={sort}
                onSort={toggleSort}
                className={TH}
                rowSpan={2}
              />
              <SortableTH
                label="Week No."
                sortKey="week"
                currentSort={sort}
                onSort={toggleSort}
                className={TH}
                rowSpan={2}
              />
              <th className={TH} colSpan={3}>
                Planned MO/TMO
              </th>
              <th className={TH} colSpan={3}>
                Allocated_Actual MO/TMO
              </th>
              <th className={TH} colSpan={3}>
                Shortage MO/TMO
              </th>
              <th className={TH} colSpan={3}>
                New Recruitments MO/TMO
              </th>
              <th className={TH} colSpan={3}>
                Rejoined MO/TMO
              </th>
              <th className={TH} colSpan={3}>
                Released from Tr. Cen. MO/TMO
              </th>
              <th className={TH} colSpan={3}>
                Resigned/Terminated
              </th>
              <th className={TH} colSpan={3}>
                Transfer
              </th>
              <th className={TH} colSpan={3}>
                Net Increase/Decrease
              </th>
              <th className={TH} colSpan={3}>
                Allocated_Current MO/TMO
              </th>
              <th className={TH} colSpan={3}>
                Absenteeism
              </th>
              <th className={TH} colSpan={3}>
                Present MO/TMO
              </th>
              <th className={TH} colSpan={8}>
                TMO_Training Center.
              </th>
              {canEdit && (
                <th className={TH} rowSpan={2}>
                  Action
                </th>
              )}
            </tr>
            <tr className="bg-[#376c9e] text-white text-[10px] h-9">
              <SortableTH label="MO" sortKey="pmo" currentSort={sort} onSort={toggleSort} className={TH} />
              <SortableTH label="TMO" sortKey="ptmo" currentSort={sort} onSort={toggleSort} className={TH} />
              <SortableTH label="Total" sortKey="pt" currentSort={sort} onSort={toggleSort} className={TH} />
              <SortableTH label="MO" sortKey="amo" currentSort={sort} onSort={toggleSort} className={TH} />
              <SortableTH label="TMO" sortKey="atmo" currentSort={sort} onSort={toggleSort} className={TH} />
              <SortableTH label="Total" sortKey="at" currentSort={sort} onSort={toggleSort} className={TH} />
              <SortableTH label="MO" sortKey="smo" currentSort={sort} onSort={toggleSort} className={TH} />
              <SortableTH label="TMO" sortKey="stmo" currentSort={sort} onSort={toggleSort} className={TH} />
              <SortableTH label="Total" sortKey="st" currentSort={sort} onSort={toggleSort} className={TH} />
              <SortableTH label="MO" sortKey="nmo" currentSort={sort} onSort={toggleSort} className={TH} />
              <SortableTH label="TMO" sortKey="ntmo" currentSort={sort} onSort={toggleSort} className={TH} />
              <SortableTH label="Total" sortKey="nt" currentSort={sort} onSort={toggleSort} className={TH} />
              <SortableTH label="MO" sortKey="rjmo" currentSort={sort} onSort={toggleSort} className={TH} />
              <SortableTH label="TMO" sortKey="rjtmo" currentSort={sort} onSort={toggleSort} className={TH} />
              <SortableTH label="Total" sortKey="rjt" currentSort={sort} onSort={toggleSort} className={TH} />
              <SortableTH label="MO" sortKey="relmo" currentSort={sort} onSort={toggleSort} className={TH} />
              <SortableTH label="TMO" sortKey="reltmo" currentSort={sort} onSort={toggleSort} className={TH} />
              <SortableTH label="Total" sortKey="relt" currentSort={sort} onSort={toggleSort} className={TH} />
              <SortableTH label="MO" sortKey="rmo" currentSort={sort} onSort={toggleSort} className={TH} />
              <SortableTH label="TMO" sortKey="rtmo" currentSort={sort} onSort={toggleSort} className={TH} />
              <SortableTH label="Total" sortKey="rt" currentSort={sort} onSort={toggleSort} className={TH} />
              <SortableTH label="MO" sortKey="tfmo" currentSort={sort} onSort={toggleSort} className={TH} />
              <SortableTH label="TMO" sortKey="tftmo" currentSort={sort} onSort={toggleSort} className={TH} />
              <SortableTH label="Total" sortKey="tft" currentSort={sort} onSort={toggleSort} className={TH} />
              <SortableTH label="MO" sortKey="netmo" currentSort={sort} onSort={toggleSort} className={TH} />
              <SortableTH label="TMO" sortKey="netto" currentSort={sort} onSort={toggleSort} className={TH} />
              <SortableTH label="Total" sortKey="nett" currentSort={sort} onSort={toggleSort} className={TH} />
              <SortableTH label="MO" sortKey="cmo" currentSort={sort} onSort={toggleSort} className={TH} />
              <SortableTH label="TMO" sortKey="ctmo" currentSort={sort} onSort={toggleSort} className={TH} />
              <SortableTH label="Total" sortKey="ct" currentSort={sort} onSort={toggleSort} className={TH} />
              <SortableTH label="MO" sortKey="abmo" currentSort={sort} onSort={toggleSort} className={TH} />
              <SortableTH label="TMO" sortKey="abtmo" currentSort={sort} onSort={toggleSort} className={TH} />
              <SortableTH label="Total" sortKey="abt" currentSort={sort} onSort={toggleSort} className={TH} />
              <SortableTH label="MO" sortKey="prmo" currentSort={sort} onSort={toggleSort} className={TH} />
              <SortableTH label="TMO" sortKey="prtmo" currentSort={sort} onSort={toggleSort} className={TH} />
              <SortableTH label="Total" sortKey="prt" currentSort={sort} onSort={toggleSort} className={TH} />
              {/* TRAINING CENTER COLS  */}
              <SortableTH label="Planned" sortKey="tcp" currentSort={sort} onSort={toggleSort} className={TH} />
              <SortableTH label="Allocated" sortKey="tca" currentSort={sort} onSort={toggleSort} className={TH} />
              <SortableTH label="Recruit" sortKey="tcr" currentSort={sort} onSort={toggleSort} className={TH} />
              <SortableTH label="Resigned" sortKey="tcs" currentSort={sort} onSort={toggleSort} className={TH} />
              <SortableTH label="Transfer to Pro Line" sortKey="tct" currentSort={sort} onSort={toggleSort} className={TH} />
              <SortableTH label="Actual Allocated" sortKey="tactual" currentSort={sort} onSort={toggleSort} className={TH} />
              <SortableTH label="Absent." sortKey="tcab" currentSort={sort} onSort={toggleSort} className={TH} />
              <SortableTH label="Present" sortKey="tcpresent" currentSort={sort} onSort={toggleSort} className={TH} />
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr>
                <td
                  colSpan={canEdit ? 47 : 46}
                  className="p-8 text-center text-slate-400 border border-slate-400"
                >
                  No records for the selected month. Try a different month
                  above, or select a factory and enter the cadre details above.
                </td>
              </tr>
            ) : (
              sortedRecords.map((r) => (
                <tr
                  key={r.batchId}
                  className={`text-center ${
                    r.batchId === highlightBatchId
                      ? "bg-amber-100 hover:bg-amber-200 text-navy-dark font-semibold"
                      : "bg-white hover:bg-sky-50"
                  }`}
                >
                  <td className={TD}>{r.date || "-"}</td>
                  <td className={TD}>{r.week || "-"}</td>
                  <td className={TD}>{r.pmo}</td>
                  <td className={TD}>{r.ptmo}</td>
                  <td className={`${TD} font-bold`}>{r.pt}</td>
                  <td className={TD}>{r.amo}</td>
                  <td className={TD}>{r.atmo}</td>
                  <td className={`${TD} font-bold`}>{r.at}</td>
                  <td className={TD}>{r.smo}</td>
                  <td className={TD}>{r.stmo}</td>
                  <td className={`${TD} font-bold`}>{r.st}</td>
                  <td className={TD}>{r.nmo}</td>
                  <td className={TD}>{r.ntmo}</td>
                  <td className={`${TD} font-bold`}>{r.nt}</td>
                  <td className={TD}>{r.rjmo}</td>
                  <td className={TD}>{r.rjtmo}</td>
                  <td className={`${TD} font-bold`}>{r.rjt}</td>
                  <td className={TD}>{r.relmo}</td>
                  <td className={TD}>{r.reltmo}</td>
                  <td className={`${TD} font-bold`}>{r.relt}</td>
                  <td className={TD}>{r.rmo}</td>
                  <td className={TD}>{r.rtmo}</td>
                  <td className={`${TD} font-bold`}>{r.rt}</td>
                  <td className={TD}>{r.tfmo}</td>
                  <td className={TD}>{r.tftmo}</td>
                  <td className={`${TD} font-bold`}>{r.tft}</td>
                  <td className={TD}>{r.netmo}</td>
                  <td className={TD}>{r.netto}</td>
                  <td className={`${TD} font-bold`}>{r.nett}</td>
                  <td className={TD}>{r.cmo}</td>
                  <td className={TD}>{r.ctmo}</td>
                  <td className={`${TD} font-bold`}>{r.ct}</td>
                  <td className={TD}>{r.abmo}</td>
                  <td className={TD}>{r.abtmo}</td>
                  <td className={`${TD} font-bold`}>{r.abt}</td>
                  <td className={TD}>{r.prmo}</td>
                  <td className={TD}>{r.prtmo}</td>
                  <td className={`${TD} font-bold`}>{r.prt}</td>
                  <td className={TD}>{r.tcp}</td>
                  <td className={TD}>{r.tca}</td>
                  <td className={TD}>{r.tcr}</td>
                  <td className={TD}>{r.tcs}</td>
                  <td className={TD}>{r.tct}</td>
                  <td className={TD}>{r.tactual}</td>
                  <td className={TD}>{r.tcab}</td>
                  <td className={`${TD} font-bold`}>{r.tcpresent}</td>
                  {canEdit && (
                    <td className={TD}>
                      <div className="flex gap-1.5 justify-center">
                        <Button variant="edit" small onClick={() => onEdit(r)}>
                          Edit
                        </Button>
                        <Button
                          variant="delete"
                          small
                          onClick={() => onDelete(r)}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
          {records.length > 0 && (
            <tfoot>
              <tr className="bg-teal-soft text-navy-dark font-bold text-center border-t-2 border-navy">
                <td className={TD} colSpan={2}>
                  Monthly Total <br />{" "}
                  <span className="text-transparent">|</span>
                </td>
                <td
                  className={TD_NA}
                  title="Not totaled - a planned/allocated snapshot, not a daily flow."
                >
                  —
                </td>
                <td
                  className={TD_NA}
                  title="Not totaled - a planned/allocated snapshot, not a daily flow."
                >
                  —
                </td>
                <td
                  className={TD_NA}
                  title="Not totaled - a planned/allocated snapshot, not a daily flow."
                >
                  —
                </td>
                <td
                  className={TD_NA}
                  title="Not totaled - a planned/allocated snapshot, not a daily flow."
                >
                  —
                </td>
                <td
                  className={TD_NA}
                  title="Not totaled - a planned/allocated snapshot, not a daily flow."
                >
                  —
                </td>
                <td
                  className={TD_NA}
                  title="Not totaled - a planned/allocated snapshot, not a daily flow."
                >
                  —
                </td>
                <td
                  className={TD_NA}
                  title="Not totaled - a planned/allocated snapshot, not a daily flow."
                >
                  —
                </td>
                <td
                  className={TD_NA}
                  title="Not totaled - a planned/allocated snapshot, not a daily flow."
                >
                  —
                </td>
                <td
                  className={TD_NA}
                  title="Not totaled - a planned/allocated snapshot, not a daily flow."
                >
                  —
                </td>
                <td className={TD}>{sum("nmo")}</td>
                <td className={TD}>{sum("ntmo")}</td>
                <td className={TD}>{sum("nt")}</td>
                <td className={TD}>{sum("rjmo")}</td>
                <td className={TD}>{sum("rjtmo")}</td>
                <td className={TD}>{sum("rjt")}</td>
                <td className={TD}>{sum("relmo")}</td>
                <td className={TD}>{sum("reltmo")}</td>
                <td className={TD}>{sum("relt")}</td>
                <td className={TD}>{sum("rmo")}</td>
                <td className={TD}>{sum("rtmo")}</td>
                <td className={TD}>{sum("rt")}</td>
                <td className={TD}>{sum("tfmo")}</td>
                <td className={TD}>{sum("tftmo")}</td>
                <td className={TD}>{sum("tft")}</td>
                <td
                  className={TD_NA}
                  title="Not totaled - a net-change snapshot, not a daily flow."
                >
                  —
                </td>
                <td
                  className={TD_NA}
                  title="Not totaled - a net-change snapshot, not a daily flow."
                >
                  —
                </td>
                <td
                  className={TD_NA}
                  title="Not totaled - a net-change snapshot, not a daily flow."
                >
                  —
                </td>
                <td
                  className={TD_NA}
                  title="Not totaled - a current-headcount snapshot, not a daily flow."
                >
                  —
                </td>
                <td
                  className={TD_NA}
                  title="Not totaled - a current-headcount snapshot, not a daily flow."
                >
                  —
                </td>
                <td
                  className={TD_NA}
                  title="Not totaled - a current-headcount snapshot, not a daily flow."
                >
                  —
                </td>
                <td className={TD}>{sum("abmo")}</td>
                <td className={TD}>{sum("abtmo")}</td>
                <td className={TD}>{sum("abt")}</td>
                <td className={TD}>{sum("prmo")}</td>
                <td className={TD}>{sum("prtmo")}</td>
                <td className={TD}>{sum("prt")}</td>
                <td
                  className={TD_NA}
                  title="Not totaled - a planned/allocated snapshot, not a daily flow."
                >
                  —
                </td>
                <td
                  className={TD_NA}
                  title="Not totaled - a planned/allocated snapshot, not a daily flow."
                >
                  —
                </td>
                <td className={TD}>{sum("tcr")}</td>
                <td className={TD}>{sum("tcs")}</td>
                <td className={TD}>{sum("tct")}</td>
                <td
                  className={TD_NA}
                  title="Not totaled - a planned/allocated snapshot, not a daily flow."
                >
                  —
                </td>
                <td className={TD}>{sum("tcab")}</td>
                <td className={TD}>{sum("tcpresent")}</td>
                {canEdit && <td className={TD} />}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </Card>
  );
}
