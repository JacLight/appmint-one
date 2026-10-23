"use client";
import { useEffect, useState } from "react";
import { bankSecurityStatusAction, bankSecuritySetupAction, bankSecurityConfirmSetupAction, bankSecurityRotateAction } from "../actions/banking";
import { useBankVerification } from "./bank-verification";
export function BankSecurityPanel() {
  const [status, setStatus] = useState<any>(null), [setup, setSetup] = useState<any>(null);
  const [error, setError] = useState(""), [busy, setBusy] = useState(false), [code, setCode] = useState("");
  const verification = useBankVerification();
  async function refresh() { const result = await bankSecurityStatusAction(); if (result.ok) setStatus(result.data); else setError(result.error); }
  useEffect(() => { void refresh(); }, []);
  async function act(fn: () => Promise<void>) { setBusy(true); setError(""); try { await fn(); await refresh(); } catch (e) { setError(e instanceof Error ? e.message : "The bank did not confirm the change."); } finally { setBusy(false); } }
  return <section className="mn-card" style={{ padding: 24 }}><h2>Banking security</h2>{error && <p role="alert" className="mn-formerr">{error}</p>}{!status ? <button onClick={refresh}>Load security status</button> : <>
    <p>{status.note}</p><p>{status.approved ? "Your bank-approved authenticator is ready." : status.enrolled ? "Authenticator enrolled. Contact the bank for independent approval." : "No authenticator is enrolled."}</p>
    <p>Enrollment also adds an authenticator for account sign-in. Bank approval is a separate review. Keep your existing authenticator until any replacement is approved.</p>
    {!setup && <button className="btn clay" disabled={busy} onClick={() => act(async () => { const r = await bankSecuritySetupAction(); if (!r.ok) throw new Error(r.error); setSetup(r.data); })}>Enroll an authenticator</button>}
    {setup && <div><p>Scan this code in your authenticator app or enter the setup key. Keep this key private.</p>{typeof setup.qrCode === "string" && setup.qrCode.startsWith("data:image/") && <img src={setup.qrCode} alt="Authenticator enrollment QR code" width={220} height={220} />}<p><code>{setup.secret}</code></p><label>Code from the new authenticator<input inputMode="numeric" autoComplete="one-time-code" value={code} maxLength={6} onChange={e => setCode(e.target.value.replace(/\D/g, ""))} /></label><button className="btn clay" disabled={busy || code.length !== 6} onClick={() => act(async () => { const r = await bankSecurityConfirmSetupAction(code); if (!r.ok) throw new Error(r.error); setCode(""); setSetup(null); })}>Confirm enrollment</button></div>}
    {status.approved && <><h3>Replace your banking authenticator</h3><p>Enroll the new app first. Confirm replacement with your currently approved app. If it is lost, contact the bank for recovery.</p>{status.factors?.filter((f: any) => !f.approved).map((f: any, index: number) => <button key={f.id} className="btn ghost" disabled={busy} onClick={() => act(async () => { const idempotencyKey = await verification.keyFor(JSON.stringify(["rotate", f.id])); const bankingProof = await verification.confirm("rotate", { factorId: f.id, idempotencyKey }); const r = await bankSecurityRotateAction({ factorId: f.id, idempotencyKey, bankingProof }); if (!r.ok) throw new Error(r.error); })}>Use new authenticator {index + 1}</button>)}</>}
  </>}</section>;
}
