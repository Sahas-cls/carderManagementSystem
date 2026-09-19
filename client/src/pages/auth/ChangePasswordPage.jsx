import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../components/ui/Button";
import { FieldInput } from "../../components/ui/FormField";
import Notice from "../../components/ui/Notice";
import useAuth from "../../hooks/useAuth";

const MIN_PASSWORD_LENGTH = 8;

/** Forced after an admin resets a user's password - see ProtectedRoute's mustChangePassword redirect. */
export default function ChangePasswordPage() {
  const { changePassword, logout } = useAuth();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords don't match.");
      return;
    }

    setSubmitting(true);
    try {
      await changePassword({ currentPassword, newPassword });
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message || "Failed to change password.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white border border-app-border rounded-lg shadow-sm p-6 sm:p-8">
      <h2 className="text-xl font-semibold text-navy-dark mb-1">
        Set a new password
      </h2>
      <p className="text-sm text-app-muted mb-6">
        Your password was reset by an administrator. Choose a new password to
        continue.
      </p>

      {error && <Notice message={error} type="err" />}

      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <FieldInput
          label="Current (temporary) password"
          type="password"
          required
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
        <FieldInput
          label="New password"
          type="password"
          required
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <FieldInput
          label="Confirm new password"
          type="password"
          required
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />

        <Button
          type="submit"
          variant="primary"
          className="w-full mt-2"
          disabled={submitting}
        >
          {submitting ? "Saving…" : "Save new password"}
        </Button>
      </form>

      <p className="text-xs text-app-muted mt-6 text-center">
        Wrong account?{" "}
        <button
          type="button"
          className="text-teal font-semibold hover:underline"
          onClick={logout}
        >
          Log out
        </button>
      </p>
    </div>
  );
}
