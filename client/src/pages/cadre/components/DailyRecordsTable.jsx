import Card from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import { CountBadge } from "../../../components/ui/Badge";

const TH = "border border-slate-400 p-1.5";
const TD = "border border-slate-400 p-1.5";

export default function DailyRecordsTable({ records, onEdit, onDelete, month, onMonthChange }) {
  return (
    <Card
      title="Daily Data Records"
      variant="teal"
      actions={
        <div className="flex items-center gap-3">
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
      <div className="overflow-auto">
        <table className="border-collapse w-full min-w-[1900px] text-[10.5px]">
          <thead>
            <tr className="bg-navy text-white text-[11px] leading-tight h-[55px]">
              <th className={TH} rowSpan={2}>
                Date
              </th>
              <th className={TH} rowSpan={2}>
                Week No.
              </th>
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
              <th className={TH} rowSpan={2}>
                Action
              </th>
            </tr>
            <tr className="bg-[#376c9e] text-white text-[10px] h-9">
              <th className={TH}>MO</th>
              <th className={TH}>TMO</th>
              <th className={TH}>Total</th>
              <th className={TH}>MO</th>
              <th className={TH}>TMO</th>
              <th className={TH}>Total</th>
              <th className={TH}>MO</th>
              <th className={TH}>TMO</th>
              <th className={TH}>Total</th>
              <th className={TH}>MO</th>
              <th className={TH}>TMO</th>
              <th className={TH}>Total</th>
              <th className={TH}>MO</th>
              <th className={TH}>TMO</th>
              <th className={TH}>Total</th>
              <th className={TH}>MO</th>
              <th className={TH}>TMO</th>
              <th className={TH}>Total</th>
              <th className={TH}>MO</th>
              <th className={TH}>TMO</th>
              <th className={TH}>Total</th>
              <th className={TH}>MO</th>
              <th className={TH}>TMO</th>
              <th className={TH}>Total</th>
              <th className={TH}>MO</th>
              <th className={TH}>TMO</th>
              <th className={TH}>Total</th>
              <th className={TH}>MO</th>
              <th className={TH}>TMO</th>
              <th className={TH}>Total</th>
              <th className={TH}>MO</th>
              <th className={TH}>TMO</th>
              <th className={TH}>Total</th>
              <th className={TH}>MO</th>
              <th className={TH}>TMO</th>
              <th className={TH}>Total</th>
              {/* TRAINING CENTER COLS  */}
              <th className={TH}>Planned</th>
              <th className={TH}>Allocated</th>
              <th className={TH}>Recruit</th>
              <th className={TH}>Resigned</th>
              <th className={TH}>Transfer to Pro Line</th>
              <th className={TH}>Actual Allocated</th>
              <th className={TH}>Absent.</th>
              <th className={TH}>Present</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr>
                <td
                  colSpan={47}
                  className="p-8 text-center text-slate-400 border border-slate-400"
                >
                  No records for the selected month. Try a different month
                  above, or select a factory and enter the cadre details
                  above.
                </td>
              </tr>
            ) : (
              records.map((r) => (
                <tr
                  key={r.batchId}
                  className="bg-white hover:bg-sky-50 text-center"
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
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
