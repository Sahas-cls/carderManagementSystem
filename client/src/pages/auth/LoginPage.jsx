import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Button from "../../components/ui/Button";
import { FieldInput } from "../../components/ui/FormField";
import Notice from "../../components/ui/Notice";
import useAuth from "../../hooks/useAuth";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login({ email, password });
      const redirectTo = location.state?.from?.pathname || "/";
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.message || "Failed to log in.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white border border-app-border rounded-lg shadow-sm p-6 sm:p-8">
      <h2 className="text-xl font-semibold text-navy-dark mb-1">
        Welcome back
      </h2>
      <p className="text-sm text-app-muted mb-6">
        Log in to your workforce management account.
      </p>

      {error && <Notice message={error} type="err" />}

      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
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
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <Button
          type="submit"
          variant="primary"
          className="w-full mt-2"
          disabled={submitting}
        >
          {submitting ? "Logging in…" : "Log In"}
        </Button>
      </form>

      <p className="text-xs text-app-muted mt-6 text-center">
        Don&apos;t have an account?{" "}
        <Link
          to="/register"
          className="text-teal font-semibold hover:underline"
        >
          Register
        </Link>
      </p>
      <div className="mt-4">
        <p className="text-center text-xs text-slate-400">
          Powered by Concord IT Team
        </p>
      </div>
    </div>
  );
}
