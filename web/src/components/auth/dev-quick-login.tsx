"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { devLoginOptions, devLoginAction } from "@/app/actions/dev-login";
import { routes } from "@/lib/nav";

/** A dev convenience: pick a demo account and one-click in. Renders ONLY on
 *  localhost (checked client-side) and the server action is disabled in prod —
 *  passwords never leave .env.local. */
export function DevQuickLogin() {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [opts, setOpts] = useState<{ email: string; label: string; role?: string }[]>([]);
  const [sel, setSel] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const h = window.location.hostname;
    if (h === "localhost" || h === "127.0.0.1" || h.endsWith(".local")) {
      setShow(true);
      devLoginOptions().then((o) => { setOpts(o); if (o[0]) setSel(o[0].email); });
    }
  }, []);

  if (!show) return null;

  async function go() {
    setErr(null); setBusy(true);
    const r = await devLoginAction(sel);
    setBusy(false);
    if (r.ok) { router.push(r.redirectTo || routes.account); router.refresh(); }
    else setErr(r.error || "Login failed.");
  }

  return (
    <div className="devlogin">
      <div className="devlogin-hd"><span className="devlogin-bolt">⚡</span> Dev quick login <span className="devlogin-tag">localhost only</span></div>
      {opts.length === 0 ? (
        <p className="devlogin-empty">Add a <code>DEV_QUICK_LOGINS</code> JSON array to <code>.env.local</code> to enable.</p>
      ) : (
        <>
          <div className="devlogin-row">
            <select value={sel} onChange={(e) => setSel(e.target.value)}>
              {opts.map((o) => <option key={o.email} value={o.email}>{o.label}{o.role ? ` · ${o.role}` : ""}</option>)}
            </select>
            <button type="button" onClick={go} disabled={busy || !sel}>{busy ? "Signing in…" : "Log in"}</button>
          </div>
          {err && <div className="devlogin-err">{err}</div>}
        </>
      )}
    </div>
  );
}
