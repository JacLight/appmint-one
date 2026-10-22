"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateProfileAction, signOutAction } from "@/app/actions/auth";

/** Real profile settings — name + phone, saved to the account. Email is the
 *  login identity (read-only here). */
export function ProfileSettings({ email, firstName, lastName, phone }: { email: string; firstName?: string; lastName?: string; phone?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [first, setFirst] = useState(firstName ?? "");
  const [last, setLast] = useState(lastName ?? "");
  const [ph, setPh] = useState(phone ?? "");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  function save() {
    setMsg(null);
    start(async () => {
      const r = await updateProfileAction({ firstName: first.trim(), lastName: last.trim(), phone: ph.trim() });
      if (r.ok) setMsg({ kind: "ok", text: "Saved ✓" });
      else setMsg({ kind: "err", text: r.error });
    });
  }

  return (
    <div className="tcard set-card">
      <h3>Profile</h3>
      <div className="set-row2">
        <label className="set-field"><span>First name</span><input value={first} onChange={(e) => setFirst(e.target.value)} placeholder="First" autoComplete="given-name" /></label>
        <label className="set-field"><span>Last name</span><input value={last} onChange={(e) => setLast(e.target.value)} placeholder="Last" autoComplete="family-name" /></label>
      </div>
      <label className="set-field"><span>Phone</span><input value={ph} onChange={(e) => setPh(e.target.value)} placeholder="+1 214…" inputMode="tel" autoComplete="tel" /></label>
      <label className="set-field"><span>Email <em>(your login — contact support to change)</em></span><input value={email} disabled /></label>

      {msg && <div className={msg.kind === "ok" ? "set-ok" : "bp-error"} style={{ marginTop: 4 }}>{msg.text}</div>}

      <div className="set-foot">
        <button type="button" className="set-signout" onClick={() => start(async () => { await signOutAction(); router.push("/"); router.refresh(); })} disabled={pending}>Sign out</button>
        <button type="button" className="btn clay" onClick={save} disabled={pending}>{pending ? "Saving…" : "Save changes"}</button>
      </div>
    </div>
  );
}
