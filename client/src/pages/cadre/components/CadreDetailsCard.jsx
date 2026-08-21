import Card from "../../../components/ui/Card";
import CadreGroup from "./CadreGroup";
import GroupField from "./GroupField";

/** The full "Cadre / Recruitment Details" form: editable groups + their derived totals. */
export default function CadreDetailsCard({ form, totals, onChange }) {
  const setField = (field) => (e) => onChange(field, e.target.value);

  return (
    <Card title="Cadre / Recruitment Details">
      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <CadreGroup title="Planned MO/TMO">
          <GroupField label="MO" type="number" min="0" value={form.plannedMO} onChange={setField("plannedMO")} />
          <GroupField label="TMO" type="number" min="0" value={form.plannedTMO} onChange={setField("plannedTMO")} />
          <GroupField label="Total" total readOnly value={totals.plannedTotal} />
        </CadreGroup>

        <CadreGroup title="Allocated_Actual MO/TMO">
          <GroupField label="MO" type="number" min="0" value={form.allocActualMO} onChange={setField("allocActualMO")} />
          <GroupField label="TMO" type="number" min="0" value={form.allocActualTMO} onChange={setField("allocActualTMO")} />
          <GroupField label="Total" total readOnly value={totals.allocActualTotal} />
        </CadreGroup>

        <CadreGroup title="Shortage MO/TMO">
          <GroupField label="MO" total readOnly value={totals.shortageMO} />
          <GroupField label="TMO" total readOnly value={totals.shortageTMO} />
          <GroupField label="Total" total readOnly value={totals.shortageTotal} />
        </CadreGroup>

        <CadreGroup
          variant="blue"
          title={
            <>
              New Recr. MO_
              <br />
              Rejoined MO_TMO
              <br />
              released from Tr. Cen.
            </>
          }
        >
          <GroupField label="MO" type="number" min="0" value={form.newRecMO} onChange={setField("newRecMO")} />
          <GroupField label="TMO" type="number" min="0" value={form.newRecTMO} onChange={setField("newRecTMO")} />
          <GroupField label="Total" total readOnly value={totals.newRecTotal} />
        </CadreGroup>

        <CadreGroup
          title={
            <>
              Resigned /<br />
              Terminated
            </>
          }
        >
          <GroupField label="MO" type="number" min="0" value={form.resignedMO} onChange={setField("resignedMO")} />
          <GroupField label="TMO" type="number" min="0" value={form.resignedTMO} onChange={setField("resignedTMO")} />
          <GroupField label="Total" total readOnly value={totals.resignedTotal} />
        </CadreGroup>

        <CadreGroup
          title={
            <>
              Net
              <br />
              Increase/Decrease
            </>
          }
        >
          <GroupField label="MO" total readOnly value={totals.netMO} />
          <GroupField label="TMO" total readOnly value={totals.netTMO} />
          <GroupField label="Total" total readOnly value={totals.netTotal} />
        </CadreGroup>

        <CadreGroup
          title={
            <>
              Allocated_Current
              <br />
              MO/TMO
            </>
          }
        >
          <GroupField label="MO" total readOnly value={totals.currentMO} />
          <GroupField label="TMO" total readOnly value={totals.currentTMO} />
          <GroupField label="Total" total readOnly value={totals.currentTotal} />
        </CadreGroup>

        <CadreGroup title="Absenteeism">
          <GroupField label="MO" type="number" min="0" value={form.absentMO} onChange={setField("absentMO")} />
          <GroupField label="TMO" type="number" min="0" value={form.absentTMO} onChange={setField("absentTMO")} />
          <GroupField label="Total" total readOnly value={totals.absentTotal} />
        </CadreGroup>

        <CadreGroup title="Present MO/TMO">
          <GroupField label="MO" total readOnly value={totals.presentMO} />
          <GroupField label="TMO" total readOnly value={totals.presentTMO} />
          <GroupField label="Total" total readOnly value={totals.presentTotal} />
        </CadreGroup>

        <CadreGroup title="TMO_Training Center" columns={4} full>
          <GroupField label="Planned" type="number" min="0" value={form.tcPlanned} onChange={setField("tcPlanned")} />
          <GroupField label="Allocated" type="number" min="0" value={form.tcAllocated} onChange={setField("tcAllocated")} />
          <GroupField label="Recruit." type="number" min="0" value={form.tcRecruit} onChange={setField("tcRecruit")} />
          <GroupField label="Resigned" type="number" min="0" value={form.tcResigned} onChange={setField("tcResigned")} />
          <GroupField
            label="Transfer to Pro Line"
            type="number"
            min="0"
            value={form.tcTransfer}
            onChange={setField("tcTransfer")}
          />
          <GroupField label="Actual Allocated" type="number" min="0" value={form.tcActual} onChange={setField("tcActual")} />
          <GroupField label="Absent." type="number" min="0" value={form.tcAbsent} onChange={setField("tcAbsent")} />
          <GroupField label="Present" total readOnly value={totals.tcPresent} />
        </CadreGroup>
      </div>
    </Card>
  );
}
