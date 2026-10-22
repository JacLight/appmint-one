"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { resetPasswordAction } from "@/app/actions/auth";
import { Alert } from "@/components/alert";

export function ResetPasswordForm({ token }: { token: string }) {
  const [pending, start] = useTransition();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (pw !== pw2) { setError("The passwords don’t match."); return; }
    start(async () => {
      const r = await resetPasswordAction(token, pw);
      if (r.ok) setDone(true); else setError(r.error || "Could not reset the password.");
    });
  }

  return (
    <div className="auth">
      <div className="authcard">
        <h1>Choose a new password</h1>
        {done ? (
          <>
            <Alert kind="success">Your password is changed. Sign in with the new one.</Alert>
            <Link className="btn clay" style={{ width: "100%", justifyContent: "center" }} href="/login">Sign in</Link>
          </>
        ) : !token ? (
          <>
            <Alert kind="error">This reset link is incomplete or has expired.</Alert>
            <Link className="btn ghost" style={{ width: "100%", justifyContent: "center" }} href="/forgot-password">Request a new link</Link>
          </>
        ) : (
          <>
            <p className="lead">At least 8 characters. You’ll sign in with it next time.</p>
            {error && <Alert kind="error" onDismiss={() => setError(null)}>{error}</Alert>}
            <form onSubmit={submit}>
              <div className="field"><label htmlFor="rp-1">New password</label><input id="rp-1" type="password" autoComplete="new-password" minLength={8} required value={pw} onChange={(e) => setPw(e.target.value)} /></div>
              <div className="field"><label htmlFor="rp-2">Confirm password</label><input id="rp-2" type="password" autoComplete="new-password" minLength={8} required value={pw2} onChange={(e) => setPw2(e.target.value)} /></div>
              <button type="submit" className="btn clay" style={{ width: "100%", justifyContent: "center" }} disabled={pending}>{pending ? "Saving…" : "Save new password"}</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
