"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { forgotPasswordAction } from "@/app/actions/auth";
import { Alert } from "@/components/alert";

export function ForgotPasswordForm() {
  const [pending, start] = useTransition();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await forgotPasswordAction(email);
      if (r.ok) setSent(true); else setError(r.error || "Could not send the reset link.");
    });
  }

  return (
    <div className="auth">
      <div className="authcard">
        <h1>Reset your password</h1>
        {sent ? (
          <>
            <Alert kind="success">If {email} has an account, a reset link is on its way. It works for 10 minutes.</Alert>
            <Link className="btn ghost" style={{ width: "100%", justifyContent: "center" }} href="/login">Back to sign in</Link>
          </>
        ) : (
          <>
            <p className="lead">Enter the email on your account and we’ll send you a link to choose a new password.</p>
            {error && <Alert kind="error" onDismiss={() => setError(null)}>{error}</Alert>}
            <form onSubmit={submit}>
              <div className="field">
                <label htmlFor="fp-email">Email</label>
                <input id="fp-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" />
              </div>
              <button type="submit" className="btn clay" style={{ width: "100%", justifyContent: "center" }} disabled={pending}>
                {pending ? "Sending…" : "Send reset link"}
              </button>
            </form>
            <div className="auth-foot">Remembered it? <Link href="/login">Sign in</Link></div>
          </>
        )}
      </div>
    </div>
  );
}
