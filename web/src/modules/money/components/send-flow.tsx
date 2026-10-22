"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { previewTransferAction, submitTransferAction } from "../actions/banking";
import type { Account, Recipient, Transfer, TransferKind, TransferPreview, TransferSpeed, TransferSpeedOption } from "../api/types";
import { accountLabel, fmt, fmtDate, parseAmount } from "../lib/format";
import { PersonAvatar } from "./bits";
import { Icon } from "./icons";
import { ExternalRecipientForm, MemberRecipientForm } from "./recipient-forms";
import { StepUpDialog } from "./step-up";

type Step = "details" | "review" | "done";

const COPY: Record<TransferKind, { title: string; verb: string; to: string }> = {
  external: { title: "Send to another bank", verb: "Send", to: "Who are you paying?" },
  internal: { title: "Send to someone at", verb: "Send", to: "Who are you paying?" },
  own: { title: "Move between your accounts", verb: "Move", to: "To" },
};

export interface SendFlowProps {
  kind: TransferKind;
  bank: string;
  sample: boolean;
  accounts: Account[];
  recipients: Recipient[];
  /** Speeds and fees from the bank (transferOptions). */
  speeds?: TransferSpeedOption[];
  initialTo?: string;
  initialFrom?: string;
  initialAmount?: string;
}

/** Details → review (priced by the bank) → security code → confirmation. */
export function SendFlow({ kind, bank, sample, accounts, recipients: initialRecipients, speeds, initialTo, initialFrom, initialAmount }: SendFlowProps) {
  const router = useRouter();
  const open = accounts.filter((a) => a.status === "open");
  const [step, setStep] = useState<Step>("details");
  const [recipients, setRecipients] = useState(initialRecipients);
  const [to, setTo] = useState<string>(kind === "own" ? (open.find((a) => a.id !== (initialFrom || open[0]?.id))?.id || "") : initialTo && initialRecipients.some((r) => r.id === initialTo) ? initialTo : "");
  const [adding, setAdding] = useState(kind !== "own" && initialRecipients.length === 0);
  const [from, setFrom] = useState(initialFrom && open.some((a) => a.id === initialFrom) ? initialFrom : open.find((a) => a.type === "checking")?.id || open[0]?.id || "");
  const [amount, setAmount] = useState(initialAmount || "");
  const [speed, setSpeed] = useState<TransferSpeed>("standard");
  const [when, setWhen] = useState<"now" | "later">("now");
  const [date, setDate] = useState("");
  const [memo, setMemo] = useState("");
  const [err, setErr] = useState<{ msg: string; field?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<TransferPreview | null>(null);
  const [stepUp, setStepUp] = useState(false);
  const [done, setDone] = useState<Transfer | null>(null);
  const [key, setKey] = useState("");

  const fromAcc = open.find((a) => a.id === from);
  const cents = parseAmount(amount);
  const minDate = useMemo(() => new Date(Date.now() + 864e5).toISOString().slice(0, 10), []);
  const title = kind === "internal" ? `${COPY.internal.title} ${bank}` : COPY[kind].title;

  if (open.length === 0) {
    return <div className="mn-empty"><b>No open accounts to send from</b><p>Message us and we’ll help you get set up.</p><Link className="btn clay sm" href="/account/messages">Message us</Link></div>;
  }

  const review = async () => {
    if (kind !== "own" && !to) return setErr({ msg: "Choose who you’re paying.", field: "to" });
    if (kind === "own" && (!to || to === from)) return setErr({ msg: "Choose a different account to move money to.", field: "to" });
    if (!cents || cents < 1) return setErr({ msg: "Enter an amount.", field: "amount" });
    if (when === "later" && !date) return setErr({ msg: "Pick the date to send it.", field: "date" });
    setErr(null);
    setBusy(true);
    const r = await previewTransferAction({
      kind, fromAccountId: from, amount: { amount: cents, currency: "USD" },
      ...(kind === "own" ? { toAccountId: to } : { recipientId: to }),
      memo: memo.trim() || undefined,
      speed: kind === "external" ? speed : undefined,
      scheduledFor: when === "later" && kind !== "internal" ? date : undefined,
    });
    setBusy(false);
    if (!r.ok) return setErr({ msg: r.error, field: r.field });
    setPreview(r.data);
    setKey(crypto.randomUUID());
    setStep("review");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async (proof?: { challengeId: string; code: string }) => {
    if (!preview) return { ok: false as const, error: "Review expired.", code: "PREVIEW_EXPIRED" as const };
    const r = await submitTransferAction(preview.previewId, key, proof);
    if (r.ok) {
      setStepUp(false);
      setDone(r.data);
      setStep("done");
      router.refresh();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (!r.code.startsWith("STEP_UP")) {
      setStepUp(false);
      setErr({ msg: r.error });
      if (r.code === "PREVIEW_EXPIRED" || r.code === "INSUFFICIENT_FUNDS" || r.code === "LIMIT_EXCEEDED") setStep("details");
    }
    return r;
  };
  const confirm = () => (preview?.stepUp ? setStepUp(true) : (setBusy(true), submit().finally(() => setBusy(false))));

  /* ───────── done ───────── */
  if (step === "done" && done) {
    const scheduled = done.status === "scheduled";
    return (
      <div className="mn-flow">
        <div className="mn-panel">
          <div className="mn-done">
            <span className="mn-done-ic"><Icon name="check" size={34} stroke={2.2} /></span>
            <h2>{scheduled ? "Transfer scheduled" : kind === "own" ? "Money moved" : done.status === "completed" ? "Sent" : "On its way"}</h2>
            <p>
              {fmt(done.amount)} {scheduled ? "will go" : kind === "own" ? "is now in" : "to"} {kind === "own" ? done.to.detail : done.to.name}
              {scheduled ? ` on ${fmtDate(done.scheduledFor || done.arrivesBy, { weekday: "long", month: "long", day: "numeric" })}.` : kind === "external" ? `. It arrives by ${fmtDate(done.arrivesBy, { weekday: "long", month: "long", day: "numeric" })}.` : "."}
            </p>
          </div>
          <dl className="mn-dl" style={{ marginTop: 18 }}>
            <dt>From</dt><dd>{done.from.detail}</dd>
            <dt>To</dt><dd>{done.to.name}{done.to.detail && done.to.detail !== done.to.name ? ` · ${done.to.detail}` : ""}</dd>
            <dt>Amount</dt><dd>{fmt(done.amount)}</dd>
            {done.fee.amount > 0 && <><dt>Fee</dt><dd>{fmt(done.fee)}</dd></>}
            <dt className="mn-total-row">Total</dt><dd className="mn-total-row">{fmt(done.total)}</dd>
            {done.memo && <><dt>Note</dt><dd>{done.memo}</dd></>}
            <dt>Confirmation</dt><dd className="mono">{done.reference}</dd>
          </dl>
          {sample && <div className="mn-notice"><Icon name="info" size={16} />Sample confirmation — the banking API isn’t connected, so no money moved and your balances haven’t changed.</div>}
          <div className="mn-actions">
            <Link className="btn ghost sm" href={kind === "own" ? "/account/banking/send/own" : `/account/banking/send/${kind}`} onClick={() => { setStep("details"); setAmount(""); setMemo(""); setPreview(null); setDone(null); }}>{kind === "own" ? "Move more" : "Send another"}</Link>
            <Link className="btn clay sm" href="/account/banking/home">Done</Link>
          </div>
        </div>
      </div>
    );
  }

  /* ───────── review ───────── */
  if (step === "review" && preview) {
    return (
      <div className="mn-flow">
        <div className="mn-steps" aria-hidden><i className="on" /><i className="on" /><i /></div>
        <div className="mn-review">
          <div className="mn-review-top">
            <span className="mn-muted">{kind === "own" ? "You’re moving" : "You’re sending"}</span>
            <span className="mn-txd-amt">{fmt(preview.amount)}</span>
            <span className="mn-muted">to <b style={{ color: "var(--text)" }}>{preview.to.name}</b></span>
          </div>
          <dl className="mn-dl">
            <dt>From</dt><dd>{preview.from.detail}</dd>
            <dt>To</dt><dd>{preview.to.detail}</dd>
            {kind === "external" && <><dt>Speed</dt><dd>{preview.speed === "same_day" ? "Same day" : "Standard"}</dd></>}
            <dt>{preview.scheduledFor ? "Sends on" : "Arrives"}</dt>
            <dd>{preview.scheduledFor ? fmtDate(preview.scheduledFor, { weekday: "short", month: "short", day: "numeric", year: "numeric" }) : preview.speed === "instant" ? "Instantly" : `By ${fmtDate(preview.arrivesBy, { weekday: "short", month: "short", day: "numeric" })}`}</dd>
            {preview.memo && <><dt>Note</dt><dd>{preview.memo}</dd></>}
            <dt>Fee</dt><dd>{preview.fee.amount ? fmt(preview.fee) : "Free"}</dd>
            <dt className="mn-total-row">Total</dt><dd className="mn-total-row">{fmt(preview.total)}</dd>
            {preview.availableAfter && <><dt>Available after</dt><dd>{fmt(preview.availableAfter)}</dd></>}
          </dl>
        </div>
        {preview.notices?.map((n) => <div key={n} className="mn-notice"><Icon name="info" size={16} />{n}</div>)}
        {err && <div className="mn-formerr" role="alert" style={{ marginTop: 12 }}><Icon name="alert" size={16} />{err.msg}</div>}
        <div className="mn-actions">
          <button type="button" className="btn ghost sm" onClick={() => { setStep("details"); setErr(null); }} disabled={busy}>Edit</button>
          <button type="button" className="btn clay sm" onClick={confirm} disabled={busy}>
            {preview.stepUp && <Icon name="lock" size={15} />}
            {busy ? "Sending…" : `${preview.scheduledFor ? "Schedule" : COPY[kind].verb} ${fmt(preview.total)}`}
          </button>
        </div>
        <p className="mn-secure"><Icon name="shield" size={14} />{preview.stepUp ? "We’ll text you a code to confirm it’s you." : "Moves between your own accounts are instant and free."}</p>
        {stepUp && (
          <StepUpDialog
            action="transfer"
            title="Confirm it’s you"
            body={`Sending ${fmt(preview.total)} to ${preview.to.name}.`}
            confirmLabel={`${COPY[kind].verb} ${fmt(preview.total)}`}
            sample={sample}
            onCancel={() => setStepUp(false)}
            onConfirm={submit}
          />
        )}
      </div>
    );
  }

  /* ───────── details ───────── */
  const picked = recipients.find((r) => r.id === to);
  return (
    <div className="mn-flow">
      <div className="mn-steps" aria-hidden><i className="on" /><i /><i /></div>
      <h2 className="mn-h2">{title}</h2>

      {kind !== "own" && (
        <section className="mn-panel" style={{ marginBottom: 16 }}>
          <div className="mn-panel-hd"><span>{COPY[kind].to}</span>{!adding && <button type="button" className="mn-link as-btn" onClick={() => setAdding(true)}><Icon name="plus" size={15} />New recipient</button>}</div>
          {adding ? (
            kind === "external"
              ? <ExternalRecipientForm sample={sample} submitLabel="Save and continue" onCancel={recipients.length ? () => setAdding(false) : undefined} onSaved={(r) => { setRecipients((x) => [r, ...x]); setTo(r.id); setAdding(false); }} />
              : <MemberRecipientForm bank={bank} onCancel={recipients.length ? () => setAdding(false) : undefined} onSaved={(r) => { setRecipients((x) => [r, ...x.filter((y) => y.id !== r.id)]); setTo(r.id); setAdding(false); }} />
          ) : (
            <div className={`mn-choice${err?.field === "to" || err?.field === "recipientId" ? " invalid" : ""}`}>
              {recipients.map((r, i) => (
                <button type="button" key={r.id} className={`mn-opt${to === r.id ? " on" : ""}`} onClick={() => setTo(r.id)} aria-pressed={to === r.id}>
                  <PersonAvatar name={r.name} size={38} tone={i} />
                  <span>
                    <b>{r.nickname ? `${r.nickname} · ${r.name}` : r.name}</b>
                    <small>{r.kind === "external" ? `${r.external!.bankName} · ${r.external!.accountType === "savings" ? "Savings" : "Checking"} ••${r.external!.accountMask}` : `${r.internal!.handle} · ${bank}`}</small>
                  </span>
                  <span className="mn-radio" aria-hidden />
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {!adding && (
        <section className="mn-panel">
          <div className="mn-row2">
            <div className="mn-field">
              <label htmlFor="sf-from">From</label>
              <select id="sf-from" value={from} onChange={(e) => { setFrom(e.target.value); if (kind === "own" && e.target.value === to) setTo(open.find((a) => a.id !== e.target.value)?.id || ""); }}>
                {open.map((a) => <option key={a.id} value={a.id}>{accountLabel(a)}</option>)}
              </select>
            </div>
            {kind === "own" ? (
              <div className={`mn-field${err?.field === "to" || err?.field === "toAccountId" ? " invalid" : ""}`}>
                <label htmlFor="sf-to">To</label>
                <select id="sf-to" value={to} onChange={(e) => setTo(e.target.value)}>
                  {open.filter((a) => a.id !== from).map((a) => <option key={a.id} value={a.id}>{accountLabel(a)}</option>)}
                </select>
              </div>
            ) : (
              <div className="mn-field">
                <span className="mn-label">To</span>
                <div className="mn-input" style={{ color: picked ? "var(--text)" : "var(--muted)" }}>{picked ? picked.nickname || picked.name : "Choose above"}</div>
              </div>
            )}
          </div>

          <div className={`mn-field${err?.field === "amount" ? " invalid" : ""}`}>
            <label htmlFor="sf-amt">Amount</label>
            <div className="mn-amount">
              <span>$</span>
              <input id="sf-amt" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))} inputMode="decimal" placeholder="0.00" autoComplete="off" />
            </div>
            {fromAcc && <div className="mn-avail"><span>{accountLabel(fromAcc)}</span><span>{fmt(fromAcc.balances.available)} available</span></div>}
          </div>

          {kind === "external" && (
            <div className="mn-field">
              <span className="mn-label">Speed</span>
              <div className="mn-choice mn-choice-2">
                {(speeds && speeds.length ? speeds : [
                  { speed: "standard" as const, label: "Standard", timing: "1–3 business days", fee: null },
                  { speed: "same_day" as const, label: "Same day", timing: "Today if sent by 4 PM CT", fee: null },
                ]).map((o) => (
                  <button key={o.speed} type="button" className={`mn-opt${speed === o.speed ? " on" : ""}`} onClick={() => setSpeed(o.speed)} aria-pressed={speed === o.speed}>
                    <span><b>{o.label}</b><small>{o.timing} · {o.fee ? (o.fee.amount ? `${fmt(o.fee)} fee` : "free") : "fee shown on review"}</small></span><span className="mn-radio" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {kind !== "internal" && (
            <div className={`mn-field${err?.field === "date" ? " invalid" : ""}`}>
              <span className="mn-label">When</span>
              <div className="mn-seg" role="group">
                <button type="button" aria-pressed={when === "now"} onClick={() => setWhen("now")}>Now</button>
                <button type="button" aria-pressed={when === "later"} onClick={() => setWhen("later")}>Later</button>
              </div>
              {when === "later" && <input type="date" min={minDate} value={date} onChange={(e) => setDate(e.target.value)} aria-label="Send on" style={{ maxWidth: 240, marginTop: 8 }} />}
            </div>
          )}

          <div className="mn-field">
            <label htmlFor="sf-memo">Note <span className="mn-muted">(optional)</span></label>
            <input id="sf-memo" value={memo} onChange={(e) => setMemo(e.target.value)} maxLength={80} placeholder={kind === "own" ? "e.g. Emergency fund" : "What’s it for?"} />
          </div>

          {err && <div className="mn-formerr" role="alert"><Icon name="alert" size={16} />{err.msg}</div>}
          <div className="mn-actions">
            <Link className="btn ghost sm" href="/account/banking/send">Cancel</Link>
            <button type="button" className="btn clay sm" onClick={review} disabled={busy}>{busy ? "Checking…" : "Review"}</button>
          </div>
        </section>
      )}
    </div>
  );
}
