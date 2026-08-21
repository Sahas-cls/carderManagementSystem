import Card from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import { CountBadge } from "../../../components/ui/Badge";

const TH = "border border-slate-400 p-1.5";
const TD = "border border-slate-400 p-1.5";

export default function DailyRecordsTable({ records, onEdit, onDelete }) {
  return (
    <Card
      title="Daily Data Records"
      variant="teal"
      actions={
        <CountBadge>
          {records.length} record{records.length === 1 ? "" : "s"}
        </CountBadge>
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
                New Recr. MO_Rejoined MO_TMO
                <br />
                released from Tr. Cen.
              </th>
              <th className={TH} colSpan={3}>
                Resigned/Terminated
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
              <th className={TH}>Planned</th>
              <th className={TH}>Allocated</th>
              <th className={TH}>Recruit.</th>
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
                <td colSpan={37} className="p-8 text-center text-slate-400 border border-slate-400">
                  No records yet. Select a factory and enter the cadre details above.
                </td>
              </tr>
            ) : (
              records.map((r, i) => (
                <tr key={i} className="bg-white hover:bg-sky-50 text-center">
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
                  <td className={TD}>{r.rmo}</td>
                  <td className={TD}>{r.rtmo}</td>
                  <td className={`${TD} font-bold`}>{r.rt}</td>
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
                      <Button variant="edit" small onClick={() => onEdit(i)}>
                        Edit
                      </Button>
                      <Button variant="delete" small onClick={() => onDelete(i)}>
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
