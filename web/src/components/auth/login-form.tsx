"use client";

import { afterAuth } from "@/lib-client/after-auth";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signInAction } from "@/app/actions/auth";
import { SocialButtons } from "./social-buttons";
import { Passwordless } from "./passwordless";
import { SignInChallenge } from "./sign-in-challenge";
import { Alert } from "@/components/alert";

export interface AuthCopy {
  brandName: string;
  loginLead: string;
  signupLead: string;
  /** e.g. "One account works for both renting and hosting." — omitted when no provider side */
  roleNote?: string;
  /** e.g. { label: "List your space", href: "/host", prompt: "Want to host?" } */
  providerCta?: { prompt: string; label: string; href: string };
  /** Hint under the optional phone field, e.g. "For booking updates". */
  phoneHint: string;
}

export function LoginForm({ copy }: { copy: AuthCopy }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"password" | "passwordless">("password");
  const [error, setError] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<{ challengeToken: string; method: string } | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await signInAction({ email, password });
      if (r.ok) {
        router.push(afterAuth(r.redirectTo));
        router.refresh();
      } else if ("needs" in r) {
        if (r.needs === "2fa") { setChallenge(r); setPassword(""); }
        else setError(r.message || "You need to set a new password.");
      } else {
        setError(r.error);
      }
    });
  }

  if (challenge) return <div className="auth"><div className="authcard">
    <SignInChallenge {...challenge} onCancel={() => { setChallenge(null); setError(null); }} />
  </div></div>;

  return (
    <div className="auth">
      <div className="authcard">
        <h1>Welcome back</h1>
        <p className="lead">{copy.loginLead}</p>

        {error && <Alert kind="error" onDismiss={() => setError(null)}>{error}</Alert>}

        <SocialButtons />
        <div className="divider">or</div>

        {mode === "password" ? (
          <>
            <form onSubmit={submit}>
              <div className="field">
                <label htmlFor="signin-email">Email</label>
                <input id="signin-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" />
              </div>
              <div className="field">
                <label htmlFor="signin-password">Password</label>
                <input id="signin-password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "6px 0 16px" }}>
                <label className="checkrow" style={{ margin: 0 }}><input type="checkbox" /> Remember me</label>
                <Link href="/forgot-password" style={{ color: "var(--primary)", fontWeight: 600, fontSize: 13.5 }}>Forgot password?</Link>
              </div>
              <button type="submit" className="btn clay" style={{ width: "100%", justifyContent: "center" }} disabled={pending}>
                {pending ? "Signing in…" : "Sign in"}
              </button>
            </form>
            <p style={{ textAlign: "center", fontSize: 13.5, marginTop: 14 }}>
              <button type="button" onClick={() => { setError(null); setMode("passwordless"); }} style={{ color: "var(--primary)", fontWeight: 600, background: "none", border: 0, cursor: "pointer" }}>
                Sign in with a magic link or code instead
              </button>
            </p>
          </>
        ) : (
          <Passwordless email={email} setEmail={setEmail} onCancel={() => setMode("password")} />
        )}

        {copy.roleNote && (
          <p style={{ textAlign: "center", fontSize: 13, color: "var(--muted)", marginTop: 16 }}>
            {copy.roleNote}
          </p>
        )}
        <div className="auth-foot">
          New to {copy.brandName}? <Link href="/signup">Create an account</Link>
        </div>
      </div>
    </div>
  );
}
