import Card from "../../../components/ui/Card";
import { FieldInput, FieldSelect } from "../../../components/ui/FormField";
import { matchWeekForDate } from "../../../utils/cadreCalculations";

/** Factory / Date / Week selection at the top of Daily Data Entry. Week is derived from the date, not picked. */
export default function RecordInfoCard({ form, onChange, factories, weeks }) {
  const matchedWeek = form.date ? matchWeekForDate(form.date, weeks) : null;
  const weekDisplay = !form.date ? "" : matchedWeek ? `Week of ${matchedWeek.week}` : "No week configured for this date";

  return (
    <Card title="Record Information">
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3.5">
        <FieldSelect label="Factory" value={form.factoryId} onChange={(e) => onChange("factoryId", e.target.value)}>
          <option value="">Select Factory</option>
          {factories.map((f) => (
            <option key={f.id} value={f.id}>
              {f.factoryName}
            </option>
          ))}
        </FieldSelect>

        <FieldInput label="Date" type="date" value={form.date} onChange={(e) => onChange("date", e.target.value)} />

        <FieldInput
          label="Week (auto-detected from Week Master)"
          value={weekDisplay}
          disabled
          className={!form.date || matchedWeek ? "" : "text-red-600"}
        />
      </div>
    </Card>
  );
}
