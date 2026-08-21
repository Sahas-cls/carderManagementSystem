import Card from "../../../components/ui/Card";
import { FieldInput, FieldSelect } from "../../../components/ui/FormField";
import { FACTORIES, WEEKS } from "../../../constants/cadre";

/** Factory / Date / Week No. selection at the top of Daily Data Entry. */
export default function RecordInfoCard({ form, onChange }) {
  return (
    <Card title="Record Information">
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3.5">
        <FieldSelect label="Factory" value={form.factory} onChange={(e) => onChange("factory", e.target.value)}>
          <option value="">Select Factory</option>
          {FACTORIES.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </FieldSelect>

        <FieldInput label="Date" type="date" value={form.date} onChange={(e) => onChange("date", e.target.value)} />

        <FieldSelect label="Week No." value={form.week} onChange={(e) => onChange("week", e.target.value)}>
          <option value="">Select Week</option>
          {WEEKS.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </FieldSelect>
      </div>
    </Card>
  );
}
