import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Button from "../../components/ui/Button";
import { FieldInput } from "../../components/ui/FormField";
import Notice from "../../components/ui/Notice";
import useAuth from "../../hooks/useAuth";

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [userName, setUserName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setSubmitting(true);
    try {
      await register({ userName, email, password });
      setDone(true);
    } catch (err) {
      setError(err.message || "Failed to register.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="bg-white border border-app-border rounded-lg shadow-sm p-6 sm:p-8 text-center">
        <h2 className="text-xl font-semibold text-navy-dark mb-2">Account created 🎉</h2>
        <p className="text-sm text-app-muted mb-6">
          An administrator needs to activate your account before you can log in. Come back and sign in once
          that&apos;s done.
        </p>
        <Button variant="primary" className="w-full" onClick={() => navigate("/login")}>
          Back to Log In
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-white border border-app-border rounded-lg shadow-sm p-6 sm:p-8">
      <h2 className="text-xl font-semibold text-navy-dark mb-1">Create an account</h2>
      <p className="text-sm text-app-muted mb-6">Register to get access to the workforce management system.</p>

      {error && <Notice message={error} type="err" />}

      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <FieldInput
          label="Full Name"
          required
          autoComplete="name"
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
        />
        <FieldInput
          label="Email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <FieldInput
          label="Password"
          type="password"
          required
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <FieldInput
          label="Confirm Password"
          type="password"
          required
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />

        <Button type="submit" variant="primary" className="w-full mt-2" disabled={submitting}>
          {submitting ? "Creating account…" : "Register"}
        </Button>
      </form>

      <p className="text-xs text-app-muted mt-6 text-center">
        Already have an account?{" "}
        <Link to="/login" className="text-teal font-semibold hover:underline">
          Log In
        </Link>
      </p>
    </div>
  );
}
