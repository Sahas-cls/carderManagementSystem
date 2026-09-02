import { useState } from "react";
import Button from "../../../components/ui/Button";
import Card from "../../../components/ui/Card";
import { FieldInput, FieldSelect } from "../../../components/ui/FormField";
import Notice from "../../../components/ui/Notice";

/** Inline edit form for a single user's profile (name / email / role / assigned factory). */
export default function EditUserForm({
  user,
  roles,
  factories,
  onSubmit,
  onCancel,
}) {
  const [userName, setUserName] = useState(user.userName);
  const [email, setEmail] = useState(user.email);
  const [userRole, setUserRole] = useState(String(user.userRole));
  const [factoryId, setFactoryId] = useState(
    user.factory?.id ? String(user.factory.id) : "",
  );
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const handleSubmit = async () => {
    setFormError("");
    if (!userName.trim()) {
      setFormError("Name cannot be empty.");
      return;
    }
    if (!email.trim()) {
      setFormError("Email cannot be empty.");
      return;
    }

    setSaving(true);
    try {
      await onSubmit({
        userName: userName.trim(),
        email: email.trim(),
        userRole: Number(userRole),
        factoryId: factoryId ? Number(factoryId) : null,
      });
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title={`Edit User — ${user.userName}`} variant="teal">
      <div className="p-4 flex flex-col gap-3.5">
        {formError && <Notice message={formError} type="err" />}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3.5">
          <FieldInput
            label="Full Name"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
          />
          <FieldInput
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <FieldSelect
            label="Role"
            value={userRole}
            onChange={(e) => setUserRole(e.target.value)}
          >
            {roles.map((r) => (
              <option key={r.roleId} value={r.roleId}>
                {r.userRole}
              </option>
            ))}
          </FieldSelect>
          <FieldSelect
            label="Factory"
            value={factoryId}
            onChange={(e) => setFactoryId(e.target.value)}
          >
            <option value="">Unassigned</option>
            {factories.map((f) => (
              <option key={f.id} value={f.id}>
                {f.factoryName}
              </option>
            ))}
          </FieldSelect>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={saving}>
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
