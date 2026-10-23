"use client";

import { useState } from "react";
import { revealAccountNumberAction } from "../actions/banking";
import type { ReceiveDetails } from "../api/types";
import { Icon } from "./icons";
import { StepUpDialog } from "./step-up";

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (key: string, text: string) => {
    try { await navigator.clipboard.writeText(text); } catch { /* clipboard blocked: nothing to do */ }
    setCopied(key);
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 1600);
  };
  return { copied, copy };
}

/** Account + routing numbers, masked until the customer confirms it's them. */
export function ReceivePanel({ details, sample }: { details: ReceiveDetails; sample: boolean }) {
  const [full, setFull] = useState<string | null>(details.revealRequiresVerification === false ? details.accountNumber || null : null);
  const [show, setShow] = useState(false);
  const [stepUp, setStepUp] = useState(false);
  const [pending, setPending] = useState<null | "show" | "copy" | "share">(null);
  const { copied, copy } = useCopy();
  const [shared, setShared] = useState<string | null>(null);

  const text = (acct: string) =>
    `${details.accountHolder}\n${details.bankName} — ${details.accountType === "savings" ? "Savings" : "Checking"}\nRouting number: ${details.routingNumber}\nAccount number: ${acct}\n${details.bankAddress || ""}`;

  const share = async (acct: string) => {
    const body = text(acct);
    if (navigator.share) {
      try { await navigator.share({ title: `My ${details.bankName} account details`, text: body }); setShared("Shared"); return; } catch { /* closed */ return; }
    }
    await copy("all", body);
    setShared("Copied — paste it into a message or your employer’s form.");
  };

  const need = (what: "show" | "copy" | "share") => {
    if (full) {
      if (what === "show") setShow((s) => !s);
      if (what === "copy") copy("acct", full);
      if (what === "share") share(full);
      return;
    }
    setPending(what);
    setStepUp(true);
  };

  const acctShown = full && show ? full.replace(/(\d{4})(?=\d)/g, "$1 ") : `•••• •••• ${details.accountMask}`;

  return (
    <>
      <section className="mn-panel">
        <div className="mn-panel-hd"><span>{details.bankName} {details.accountType === "savings" ? "Savings" : "Checking"} ••{details.accountMask}</span><span className="mn-chip s-active">Receiving account details</span></div>
        <div className="mn-detail">
          <div><span>Account holder</span><b>{details.accountHolder}</b></div>
        </div>
        <div className="mn-detail">
          <div><span>Routing number (ACH)</span><b>{details.routingNumber}</b></div>
          <div className="mn-detail-acts">
            <button type="button" className={`mn-iconbtn${copied === "rn" ? " mn-copied" : ""}`} aria-label="Copy routing number" onClick={() => copy("rn", details.routingNumber)}><Icon name={copied === "rn" ? "check" : "copy"} size={16} /></button>
          </div>
        </div>
        <div className="mn-detail">
          <div><span>Account number</span><b>{acctShown}</b></div>
          <div className="mn-detail-acts">
            <button type="button" className="mn-iconbtn" aria-label={show ? "Hide account number" : "Show account number"} onClick={() => need("show")}><Icon name={show ? "eyeOff" : "eye"} size={16} /></button>
            <button type="button" className={`mn-iconbtn${copied === "acct" ? " mn-copied" : ""}`} aria-label="Copy account number" onClick={() => need("copy")}><Icon name={copied === "acct" ? "check" : "copy"} size={16} /></button>
          </div>
        </div>
        {details.wireRoutingNumber && (
          <div className="mn-detail"><div><span>Wire routing number</span><b>{details.wireRoutingNumber}</b></div></div>
        )}
        <div className="mn-detail">
          <div><span>Account type</span><b style={{ fontSize: 16 }}>{details.accountType === "savings" ? "Savings" : "Checking"}</b></div>
        </div>
        {details.bankAddress && <div className="mn-detail">
          <div><span>Bank address</span><b style={{ fontSize: 15, fontFamily: "var(--font-body)", fontWeight: 500, letterSpacing: 0, whiteSpace: "normal" }}>{details.bankName}, {details.bankAddress}</b></div>
        </div>}
        <p className="mn-secure" style={{ justifyContent: "flex-start" }}><Icon name="lock" size={14} />{details.revealRequiresVerification === false ? "Keep your account details private. Show and copy them only when needed." : "Your full account number shows only after you confirm it’s you."}</p>
      </section>

      <aside className="mn-side">
        <section className="mn-share-card">
          <h3>Get paid into this account</h3>
          <p>Send these details to your employer for direct deposit, or to anyone paying you from another bank.</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn sm" onClick={() => need("share")}><Icon name="share" size={16} />Share details</button>
            <button type="button" className="btn sm alt" onClick={() => (full ? copy("all", text(full)) : need("share"))}><Icon name={copied === "all" ? "check" : "copy"} size={16} />{copied === "all" ? "Copied" : "Copy all"}</button>
          </div>
          {shared && <p style={{ margin: "12px 0 0", fontSize: 13 }}>{shared}</p>}
        </section>
        <section className="mn-panel">
          <div className="mn-panel-hd"><span>When money arrives</span></div>
          {details.notes?.length ? <ul className="mn-bullets">{details.notes.map(note => <li key={note}><span>{note}</span></li>)}</ul> : <ul className="mn-bullets">
            <li><b>From someone at {details.bankName}</b><span>Instantly, any day.</span></li>
            <li><b>Bank transfers (ACH)</b><span>Usually 1–2 business days after they send.</span></li>
            <li><b>Direct deposit</b><span>On payday, as soon as your employer’s file arrives.</span></li>
          </ul>}
        </section>
      </aside>

      {stepUp && (
        <StepUpDialog
          action="reveal_account_number"
          title="Show your account number"
          confirmLabel="Show number"
          sample={sample}
          onCancel={() => { setStepUp(false); setPending(null); }}
          onConfirm={async (proof) => {
            const r = await revealAccountNumberAction(details.accountId, proof);
            if (r.ok && r.data.accountNumber) {
              const n = r.data.accountNumber;
              setFull(n);
              setStepUp(false);
              if (pending === "show") setShow(true);
              if (pending === "copy") { setShow(true); copy("acct", n); }
              if (pending === "share") { setShow(true); share(n); }
              setPending(null);
            }
            return r;
          }}
        />
      )}
    </>
  );
}
