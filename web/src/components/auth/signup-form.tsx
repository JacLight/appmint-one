"use client";

import { afterAuth } from "@/lib-client/after-auth";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signUpAction } from "@/app/actions/auth";
import { SocialButtons } from "./social-buttons";
import { Alert } from "@/components/alert";
import type { AuthCopy } from "./login-form";

export function SignupForm({ copy }: { copy: AuthCopy }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "", phone: "" });
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!agree) { setError("Please accept the Terms and Privacy Policy to continue."); return; }
    start(async () => {
      const r = await signUpAction({ ...form });
      if (r.ok) {
        router.push(afterAuth("/account"));
        router.refresh();
      } else if ("error" in r) {
        setError(r.error);
      } else {
        setError("Could not create the account.");
      }
    });
  }

  return (
    <div className="auth">
      <div className="authcard">
        <h1>Create your account</h1>
        <p className="lead">{copy.signupLead}</p>

        {error && <Alert kind="error" onDismiss={() => setError(null)}>{error}</Alert>}

        <SocialButtons />
        <div className="divider">or sign up with email</div>

        <form onSubmit={submit}>
          <div className="frow">
            <div className="field"><label htmlFor="signup-first-name">First name</label><input id="signup-first-name" autoComplete="given-name" required value={form.firstName} onChange={set("firstName")} /></div>
            <div className="field"><label htmlFor="signup-last-name">Last name</label><input id="signup-last-name" autoComplete="family-name" required value={form.lastName} onChange={set("lastName")} /></div>
          </div>
          <div className="field"><label htmlFor="signup-email">Email</label><input id="signup-email" type="email" autoComplete="email" required value={form.email} onChange={set("email")} placeholder="you@email.com" /></div>
          <div className="field"><label htmlFor="signup-password">Password</label><input id="signup-password" type="password" autoComplete="new-password" required minLength={8} value={form.password} onChange={set("password")} /><div className="hint">At least 8 characters</div></div>
          <div className="field"><label htmlFor="signup-phone">Phone <span style={{ color: "var(--faint)" }}>(optional)</span></label><input id="signup-phone" type="tel" autoComplete="tel" value={form.phone} onChange={set("phone")} /><div className="hint">{copy.phoneHint}</div></div>

          <label className="checkrow">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span>I agree to the <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link>.</span>
          </label>

          <button type="submit" className="btn clay" style={{ width: "100%", justifyContent: "center", marginTop: 8 }} disabled={pending}>
            {pending ? "Creating…" : "Create account"}
          </button>
        </form>

        <div className="auth-foot">
          Already have an account? <Link href="/login">Sign in</Link>
          {copy.providerCta && <div style={{ marginTop: 4 }}>{copy.providerCta.prompt} <Link href={copy.providerCta.href}>{copy.providerCta.label}</Link></div>}
        </div>
      </div>
    </div>
  );
}
