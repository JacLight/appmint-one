"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addPayoutMethodAction, removePayoutMethodAction, setDefaultPayoutMethodAction } from "@/modules/rentals/actions/payout-methods";
import type { HostPayoutMethod as PayoutMethod } from "@/api/rentals";

/** One line that says where a saved destination sends money, without exposing it. */
export function methodLabel(m: PayoutMethod): string {
  if (m.type === "bank") {
    const b: any = m.bank || {};
    const last4 = b.accountNumberLast4 || b.last4 || "";
    return `${b.bankName || "Bank account"}${b.accountType ? ` · ${b.accountType}` : ""}${last4 ? ` ····${last4}` : ""}`;
  }
  if (m.type === "paypal") return `PayPal · ${m.paypal?.email || ""}`;
  return m.label || m.type;
}

const EMPTY = { type: "paypal" as "bank" | "paypal", label: "", email: "", holder: "", bankName: "", accountType: "checking", routing: "", account: "", makeDefault: true };

/** Where payouts go: the saved destinations, which one is the default, and a form to
 *  add a bank account or a PayPal email. Everything else about paying out lives in
 *  the cash-out control above; this only manages destinations. */
export function PayoutMethods({ methods }: { methods: PayoutMethod[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(methods.length === 0);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [f, setF] = useState(EMPTY);

  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>, okText: string) => {
    setMsg(null);
    start(async () => {
      const r = await fn();
      if (r.ok) { setMsg({ kind: "ok", text: okText }); router.refresh(); }
      else setMsg({ kind: "err", text: r.error });
    });
  };

  function add() {
    const payload: PayoutMethod = f.type === "bank"
      ? { type: "bank", label: f.label || undefined, isDefault: f.makeDefault || methods.length === 0, bank: { accountHolderName: f.holder.trim(), bankName: f.bankName.trim() || undefined, accountType: f.accountType, routingNumber: f.routing.trim(), accountNumber: f.account.trim() } }
      : { type: "paypal", label: f.label || undefined, isDefault: f.makeDefault || methods.length === 0, paypal: { email: f.email.trim() } };
    setMsg(null);
    start(async () => {
      const r = await addPayoutMethodAction(payload);
      if (r.ok) { setMsg({ kind: "ok", text: "Saved. Payouts can go there now." }); setF(EMPTY); setOpen(false); router.refresh(); }
      else setMsg({ kind: "err", text: r.error });
    });
  }

  return (
    <div className="tcard pm">
      <div className="pm-head">
        <div>
          <h3>Where payouts go</h3>
          <p className="muted">A bank account or a PayPal email. The default is used unless you pick another when cashing out.</p>
        </div>
        {methods.length > 0 && <button type="button" className="btn ghost sm" onClick={() => { setOpen(!open); setMsg(null); }}>{open ? "Cancel" : "+ Add destination"}</button>}
      </div>

      {msg && <div className={msg.kind === "ok" ? "set-ok" : "bp-error"} style={{ marginBottom: 10 }}>{msg.text}</div>}

      {methods.length > 0 && (
        <div className="pm-list">
          {methods.map((m) => (
            <div className={`pm-row${m.isDefault ? " on" : ""}`} key={m.id}>
              <div className="pm-main">
                <b>{m.label || (m.type === "bank" ? "Bank account" : m.type === "paypal" ? "PayPal" : m.type)} {m.isDefault && <span className="hp-pill ok">Default</span>}{(m as any).status === "disabled" && <span className="hp-pill off">Disabled</span>}</b>
                <span className="pm-meta">{methodLabel(m)}</span>
              </div>
              <div className="pm-actions">
                {!m.isDefault && <button type="button" className="ht-link" disabled={pending} onClick={() => run(() => setDefaultPayoutMethodAction(m.id!), "Default updated.")}>Make default</button>}
                <button type="button" className="ht-link danger" disabled={pending} onClick={() => run(() => removePayoutMethodAction(m.id!), "Removed.")}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {methods.length === 0 && !open && null}

      {open && (
        <div className="ao-form pm-form">
          {methods.length === 0 && <p className="muted" style={{ margin: "0 0 10px", fontSize: 13.5 }}>Add one destination to start cashing out.</p>}
          <div className="pm-rails">
            {(["paypal", "bank"] as const).map((t) => (
              <label key={t} className={`dlg-verify-opt${f.type === t ? " on" : ""}`}>
                <input type="radio" name="rail" checked={f.type === t} onChange={() => setF({ ...f, type: t })} />
                <span><b>{t === "paypal" ? "PayPal" : "Bank account (ACH)"}</b><em>{t === "paypal" ? "Sent to the email on your PayPal account." : "US checking or savings. Numbers are stored sealed; only the last four show."}</em></span>
              </label>
            ))}
          </div>

          {f.type === "paypal" ? (
            <label className="set-field"><span>PayPal email</span><input inputMode="email" autoComplete="off" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="you@example.com" /></label>
          ) : (
            <>
              <div className="ao-row2">
                <label className="set-field"><span>Name on the account</span><input autoComplete="off" value={f.holder} onChange={(e) => setF({ ...f, holder: e.target.value })} /></label>
                <label className="set-field"><span>Bank name <em>(optional)</em></span><input autoComplete="off" value={f.bankName} onChange={(e) => setF({ ...f, bankName: e.target.value })} /></label>
              </div>
              <div className="ao-row2">
                <label className="set-field"><span>Routing number</span><input inputMode="numeric" autoComplete="off" maxLength={9} value={f.routing} onChange={(e) => setF({ ...f, routing: e.target.value.replace(/\D/g, "") })} /></label>
                <label className="set-field"><span>Account number</span><input inputMode="numeric" autoComplete="off" maxLength={17} value={f.account} onChange={(e) => setF({ ...f, account: e.target.value.replace(/\D/g, "") })} /></label>
              </div>
              <label className="set-field"><span>Account type</span>
                <select value={f.accountType} onChange={(e) => setF({ ...f, accountType: e.target.value })}><option value="checking">Checking</option><option value="savings">Savings</option></select>
              </label>
            </>
          )}
          <div className="ao-row2">
            <label className="set-field"><span>Nickname <em>(optional)</em></span><input autoComplete="off" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} placeholder="e.g. Business checking" /></label>
            <label className="set-field pm-default"><span>&nbsp;</span><span className="pm-check"><input type="checkbox" checked={f.makeDefault || methods.length === 0} disabled={methods.length === 0} onChange={(e) => setF({ ...f, makeDefault: e.target.checked })} /> Use as default</span></label>
          </div>
          <button type="button" className="btn clay" disabled={pending} onClick={add}>{pending ? "Saving…" : "Save destination"}</button>
        </div>
      )}
    </div>
  );
}
