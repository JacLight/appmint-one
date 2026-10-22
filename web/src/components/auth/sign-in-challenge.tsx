"use client";

import { afterAuth } from "@/lib-client/after-auth";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resendSignInChallengeAction, verifySignInChallengeAction } from "@/app/actions/auth";
import { Alert } from "@/components/alert";

export function SignInChallenge({ challengeToken, method, onCancel }: {
  challengeToken: string;
  method: string;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [code, setCode] = useState("");
  const [trustDevice, setTrustDevice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(30);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  function verify(event: React.FormEvent) {
    event.preventDefault();
    setError(null); setInfo(null);
    start(async () => {
      const result = await verifySignInChallengeAction({ challengeToken, code, trustDevice });
      if (result.ok) {
        router.push(afterAuth(result.redirectTo));
        router.refresh();
      } else setError("error" in result ? result.error : "Please sign in again to restart verification.");
    });
  }

  function resend() {
    setError(null); setInfo(null);
    start(async () => {
      const result = await resendSignInChallengeAction(challengeToken);
      if (result.ok) { setInfo("A new code has been sent."); setCooldown(30); }
      else setError(result.error || "Could not send the code. Please try again.");
    });
  }

  return <>
    <h1>Verify your sign-in</h1>
    <p className="lead">{method === "authenticator" ? "Enter the code from your authenticator app, or a backup code." : method === "sms" ? "Enter the code sent to your phone." : "Enter the code sent to your email."}</p>
    {error && <Alert kind="error" onDismiss={() => setError(null)}>{error}</Alert>}
    {info && <Alert kind="info" onDismiss={() => setInfo(null)}>{info}</Alert>}
    <form onSubmit={verify}>
      <div className="field">
        <label htmlFor="signin-code">Verification code</label>
        <input id="signin-code" autoComplete="one-time-code" autoFocus required maxLength={32}
          value={code} onChange={(event) => setCode(event.target.value)} disabled={pending} />
      </div>
      <label className="checkrow"><input type="checkbox" checked={trustDevice} onChange={(event) => setTrustDevice(event.target.checked)} disabled={pending} />Trust this device for 30 days</label>
      <button type="submit" className="btn clay" style={{ width: "100%", justifyContent: "center" }} disabled={pending || !code.trim()}>{pending ? "Please wait…" : "Verify & sign in"}</button>
    </form>
    {method !== "authenticator" && <button type="button" className="btn ghost" style={{ width: "100%", justifyContent: "center", marginTop: 12 }} disabled={pending || cooldown > 0} onClick={resend}>{cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}</button>}
    <button type="button" className="btn ghost" style={{ width: "100%", justifyContent: "center", marginTop: 12 }} disabled={pending} onClick={onCancel}>Back to sign in</button>
  </>;
}
