import { useState, type FormEvent } from "react";
import { api } from "./api.ts";

export function Login({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.login(password);
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="login" onSubmit={submit}>
      <h1>Startup Tracker</h1>
      <p className="muted">Private tool — enter your password.</p>
      <input type="password" autoFocus placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <button disabled={busy || !password}>{busy ? "Checking…" : "Log in"}</button>
      {error && <p className="warn-box small">{error}</p>}
    </form>
  );
}
