"use client";
import { useEffect, useState } from "react";
import { bankAutopayStatusAction, bankAutopayChangeAction } from "../actions/banking";
import { useBankVerification } from "./bank-verification";
import { parseAmount, accountLabel, fmt } from "../lib/format";
import type { Account } from "../api/types";
export function BankAutopay({ loan, accounts }: { loan: string; accounts: Account[] }) {
  const [status, setStatus] = useState<any>(null), [error, setError] = useState("");
  const [busy, setBusy] = useState(false), [account, setAccount] = useState("");
  const [startsOn, setStartsOn] = useState(""), [maximum, setMaximum] = useState("");
  const verification = useBankVerification();
  async function refresh() { const result = await bankAutopayStatusAction(loan); if (result.ok) setStatus(result.data); else setError(result.error); }
  useEffect(() => { void refresh(); }, [loan]);
  async function change(action: "agreement" | "confirm" | "revoke") {
    setBusy(true); setError("");
    try {
      const amount = parseAmount(maximum);
      if (action === "agreement" && (!account || !startsOn || !amount || amount < 1)) throw new Error("Choose your account, first date and a positive maximum.");
      const request = action === "agreement" ? { account, startsOn, maximum: amount } : { instructionId: status.instructionId };
      const operation = `autopay_${action}`;
      const idempotencyKey = await verification.keyFor(JSON.stringify([operation, loan, status.instructionId, request]));
      const bankingProof = await verification.confirm(operation, { ...request, id: loan, idempotencyKey });
      const result = await bankAutopayChangeAction(action, loan, { ...request, idempotencyKey, bankingProof });
      if (!result.ok) throw new Error(result.error);
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "The bank did not confirm this instruction."); }
    finally { setBusy(false); }
  }
  return <section className="mn-panel" style={{ marginTop: 16 }}><h3>Automatic loan payments</h3>{error && <p role="alert" className="mn-formerr">{error}</p>}{!status ? <button onClick={refresh}>Load status</button> : <>
    <p>Status: {String(status.status).replaceAll("_", " ")}</p>
    {!status.available && <p>The bank has not enabled signed automatic payments for this loan. Make each payment yourself.</p>}
    {status.reason && <p>{status.reason}</p>}
    {status.maximum != null && <p>Authorized maximum: {fmt({ amount: status.maximum, currency: "USD" })}</p>}
    {status.attempt && <p>Latest attempt: {status.attempt.status}. Only a posted payment counts as paid.</p>}
    {status.available && ["off", "revoked"].includes(status.status) && <><p>Request a bank agreement for scheduled payments from your own account. Requesting an agreement does not activate payments. Sign through the bank’s existing agreement flow, then check its status here.</p><label>Pay from your account<select value={account} onChange={e => setAccount(e.target.value)} disabled={busy}><option value="">Choose account</option>{accounts.filter(a => a.status === "open").map(a => <option key={a.id} value={a.id}>{accountLabel(a)}</option>)}</select></label><label>First eligible payment date<input type="date" value={startsOn} onChange={e => setStartsOn(e.target.value)} disabled={busy} /></label><label>Maximum per automatic payment (USD)<input inputMode="decimal" value={maximum} onChange={e => setMaximum(e.target.value)} disabled={busy} /></label><button className="btn clay" disabled={busy} onClick={() => change("agreement")}>Request signing agreement</button></>}
    {status.instructionId && ["awaiting_agreement", "consented", "awaiting_review"].includes(status.status) && <><p>Complete the bank’s signing email or form. Checking here verifies actual completion; it does not sign the agreement.</p><button className="btn ghost" disabled={busy} onClick={() => change("confirm")}>Check signed agreement</button></>}
    {status.instructionId && !["off", "revoked", "completed"].includes(status.status) && <button className="btn ghost" disabled={busy} onClick={() => { if (window.confirm("Revoke future automatic payments? This does not reverse a payment already started. Check the latest attempt separately.")) void change("revoke"); }}>Revoke future payments</button>}
    <button className="btn ghost" disabled={busy} onClick={refresh}>Refresh status</button>
  </>}</section>;
}
