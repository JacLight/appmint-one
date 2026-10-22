"use client";

import { afterAuth } from "@/lib-client/after-auth";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendMagicLinkAction, sendMagicCodeAction, verifyMagicCodeAction } from "@/app/actions/auth";
import { Alert } from "@/components/alert";

type Stage = "email" | "code-sent";

export function Passwordless({
  email,
  setEmail,
  onCancel,
}: {
  email: string;
  setEmail: (v: string) => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<Stage>("email");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  function link() {
    setError(null); setInfo(null);
    start(async () => {
      const r = await sendMagicLinkAction(email);
      if (r.ok) setInfo(`We emailed a sign-in link to ${email}. Open it on this device to finish.`);
      else setError(r.error || "Could not send the link.");
    });
  }
  function code_() {
    setError(null); setInfo(null);
    start(async () => {
      const r = await sendMagicCodeAction(email);
      if (r.ok) { setStage("code-sent"); setInfo(`We emailed a 6-digit code to ${email}.`); }
      else setError(r.error || "Could not send the code.");
    });
  }
  function verify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await verifyMagicCodeAction(email, code);
      if (r.ok) { router.push(afterAuth(r.redirectTo)); router.refresh(); }
      else setError(("error" in r && r.error) || "That code didn't work.");
    });
  }

  return (
    <div>
      {error && <Alert kind="error" onDismiss={() => setError(null)}>{error}</Alert>}
      {info && <Alert kind="info" onDismiss={() => setInfo(null)}>{info}</Alert>}

      {stage === "code-sent" ? (
        <form onSubmit={verify}>
          <div className="field">
            <label>Enter the 6-digit code sent to {email}</label>
            <input inputMode="numeric" pattern="[0-9]*" maxLength={6} required value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="123456"
              style={{ letterSpacing: "0.3em", fontSize: 18, textAlign: "center" }} />
          </div>
          <button type="submit" className="btn clay" style={{ width: "100%", justifyContent: "center" }} disabled={pending || code.length < 6}>
            {pending ? "Verifying…" : "Verify & sign in"}
          </button>
          <p style={{ textAlign: "center", fontSize: 13, marginTop: 12 }}>
            <button type="button" onClick={() => { setStage("email"); setError(null); setInfo(null); }} style={{ color: "var(--primary)", fontWeight: 600, background: "none", border: 0, cursor: "pointer" }}>
              Use a different email
            </button>
          </p>
        </form>
      ) : (
        <>
          <div className="field">
            <label>Email</label>
            <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <button type="button" className="btn ink" style={{ justifyContent: "center" }} disabled={pending || !email} onClick={link}>Email me a link</button>
            <button type="button" className="btn ghost" style={{ justifyContent: "center" }} disabled={pending || !email} onClick={code_}>Email me a code</button>
          </div>
          {onCancel && (
            <p style={{ textAlign: "center", fontSize: 13, marginTop: 14 }}>
              <button type="button" onClick={onCancel} style={{ color: "var(--muted)", fontWeight: 600, background: "none", border: 0, cursor: "pointer" }}>← Back to password</button>
            </p>
          )}
        </>
      )}
    </div>
  );
}
