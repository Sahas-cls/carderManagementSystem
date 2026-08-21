import { useState } from "react";
import Card from "../../../components/ui/Card";
import { CountBadge } from "../../../components/ui/Badge";

const TH = "border border-slate-400 p-1.5";
const TD = "border border-slate-400 p-1.5 break-words";

/** One factory + week block on the Weekly Data View page. Rows toggle a highlight on click. */
export default function WeeklyGroupTable({ week, factory, rows }) {
  const [selected, setSelected] = useState(() => new Set());

  const toggleRow = (i) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  return (
    <Card
      title={`${factory} — ${week}`}
      variant="orange"
      actions={
        <CountBadge>
          {rows.length} daily record{rows.length === 1 ? "" : "s"}
        </CountBadge>
      }
    >
      <div className="p-4 overflow-auto">
        <table className="w-full table-fixed border-collapse text-[10px]">
          <thead>
            <tr className="bg-navy text-white text-[11px] leading-tight h-[55px]">
              <th className={TH} rowSpan={2}>
                Company Name
              </th>
              <th className={TH} rowSpan={2}>
                Week No/ Date
              </th>
              <th className={TH} colSpan={3}>
                Allocated_ MO/TMO
              </th>
              <th className={TH} colSpan={3}>
                Absent. MO/ TMO
              </th>
              <th className={TH} colSpan={3}>
                Present MO/TMO
              </th>
              <th className={TH} colSpan={3}>
                TMO_ Training Center
              </th>
            </tr>
            <tr className="bg-[#376c9e] text-white h-9">
              <th className={TH}>MO</th>
              <th className={TH}>TMO</th>
              <th className={TH}>Total</th>
              <th className={TH}>MO</th>
              <th className={TH}>TMO</th>
              <th className={TH}>Total</th>
              <th className={TH}>MO</th>
              <th className={TH}>TMO</th>
              <th className={TH}>Total</th>
              <th className={TH}>Allocated</th>
              <th className={TH}>Absent.</th>
              <th className={TH}>Present</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={i}
                onClick={() => toggleRow(i)}
                title="Click to highlight this record"
                className={`cursor-pointer text-center transition-colors ${
                  selected.has(i) ? "bg-[#dceeed]" : "bg-white hover:bg-[#eef6f7]"
                }`}
              >
                <td className={TD}>{r.factory || "-"}</td>
                <td className={TD}>
                  {r.week || "-"}
                  {r.date ? (
                    <>
                      <br />
                      {r.date}
                    </>
                  ) : null}
                </td>
                <td className={TD}>{r.amo}</td>
                <td className={TD}>{r.atmo}</td>
                <td className={`${TD} font-bold`}>{r.at}</td>
                <td className={TD}>{r.abmo}</td>
                <td className={TD}>{r.abtmo}</td>
                <td className={`${TD} font-bold`}>{r.abt}</td>
                <td className={TD}>{r.prmo}</td>
                <td className={TD}>{r.prtmo}</td>
                <td className={`${TD} font-bold`}>{r.prt}</td>
                <td className={TD}>{r.tca}</td>
                <td className={TD}>{r.tcab}</td>
                <td className={`${TD} font-bold`}>{r.tcpresent}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
