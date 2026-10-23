"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cancelRequestAction, createRequestAction, declineRequestAction, payRequestAction } from "../actions/banking";
import type { Account, MoneyRequest, Transfer } from "../api/types";
import { accountLabel, fmt, fmtDate, parseAmount } from "../lib/format";
import { PersonAvatar, StatusChip } from "./bits";
import { Icon } from "./icons";
import { StepUpDialog } from "./step-up";

/** Ask someone at the bank (or anyone, by link) to pay you. */
export function RequestForm({ accounts, bank }: { accounts: Account[]; bank: string }) {
  const router = useRouter();
  const open = accounts.filter((a) => a.status === "open");
  const [who, setWho] = useState<"member" | "link">("member");
  const [from, setFrom] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [to, setTo] = useState(open.find((a) => a.type === "checking")?.id || open[0]?.id || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ msg: string; field?: string } | null>(null);
  const [made, setMade] = useState<MoneyRequest | null>(null);
  const [copied, setCopied] = useState(false);

  const submit = async () => {
    const cents = parseAmount(amount);
    if (!cents) return setErr({ msg: "Enter an amount.", field: "amount" });
    if (who === "member" && !from.trim()) return setErr({ msg: `Who should pay you? Enter their @handle, email or phone.`, field: "from" });
    setBusy(true); setErr(null);
    const r = await createRequestAction({ toAccountId: to, amount: { amount: cents, currency: "USD" }, memo: memo.trim() || undefined, from: who === "member" ? from.trim() : undefined });
    setBusy(false);
    if (!r.ok) return setErr({ msg: r.error, field: r.field });
    setMade(r.data);
    router.refresh();
  };

  if (made) {
    const link = made.payUrl || "";
    return (
      <section className="mn-panel">
        <div className="mn-done" style={{ paddingTop: 10 }}>
          <span className="mn-done-ic"><Icon name="check" size={32} stroke={2.2} /></span>
          <h2>Request sent</h2>
          <p>{made.counterparty ? `We’ve asked ${made.counterparty.name} for ${fmt(made.amount)}.` : `Share this link — anyone can pay ${fmt(made.amount)} through it.`} It stays open until {fmtDate(made.expiresAt, { month: "long", day: "numeric" })}.</p>
        </div>
        {link && (
          <>
            <div className="mn-paylink" style={{ marginTop: 16 }}><Icon name="link" size={16} />{link}</div>
            <div className="mn-actions" style={{ justifyContent: "flex-start" }}>
              <button type="button" className="btn ghost sm" onClick={async () => { try { await navigator.clipboard.writeText(link); } catch {} setCopied(true); }}><Icon name={copied ? "check" : "copy"} size={15} />{copied ? "Copied" : "Copy link"}</button>
              <button type="button" className="btn ghost sm" onClick={() => navigator.share?.({ title: `Pay ${fmt(made.amount)}`, text: made.memo || "Payment request", url: link }).catch(() => {})}><Icon name="share" size={15} />Share</button>
            </div>
          </>
        )}
        <div className="mn-actions">
          <button type="button" className="btn clay sm" onClick={() => { setMade(null); setAmount(""); setMemo(""); setFrom(""); setCopied(false); }}>New request</button>
        </div>
      </section>
    );
  }

  return (
    <section className="mn-panel">
      <div className="mn-panel-hd"><span>New request</span></div>
      <div className="mn-field">
        <span className="mn-label">Ask</span>
        <div className="mn-seg" role="group">
          <button type="button" aria-pressed={who === "member"} onClick={() => setWho("member")}>Someone at {bank}</button>
          <button type="button" aria-pressed={who === "link"} onClick={() => setWho("link")}>Share a link</button>
        </div>
      </div>
      {who === "member" && (
        <div className={`mn-field${err?.field === "from" ? " invalid" : ""}`}>
          <label htmlFor="rq-from">Their @handle, email or phone</label>
          <input id="rq-from" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="@name" autoComplete="off" />
        </div>
      )}
      <div className={`mn-field${err?.field === "amount" ? " invalid" : ""}`}>
        <label htmlFor="rq-amt">Amount</label>
        <div className="mn-amount"><span>$</span><input id="rq-amt" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" /></div>
      </div>
      <div className="mn-field">
        <label htmlFor="rq-memo">What’s it for?</label>
        <input id="rq-memo" value={memo} onChange={(e) => setMemo(e.target.value)} maxLength={80} placeholder="e.g. Concert tickets" />
      </div>
      <div className="mn-field">
        <label htmlFor="rq-to">Pay into</label>
        <select id="rq-to" value={to} onChange={(e) => setTo(e.target.value)}>
          {open.map((a) => <option key={a.id} value={a.id}>{accountLabel(a)}</option>)}
        </select>
      </div>
      {err && <div className="mn-formerr" role="alert"><Icon name="alert" size={16} />{err.msg}</div>}
      <div className="mn-actions"><button type="button" className="btn clay sm" disabled={busy} onClick={submit}>{busy ? "Sending…" : who === "link" ? "Create link" : "Send request"}</button></div>
    </section>
  );
}

/** Requests waiting on you, and the ones you sent. */
export function RequestLists({ incoming, outgoing, accounts, sample }: { incoming: MoneyRequest[]; outgoing: MoneyRequest[]; accounts: Account[]; sample: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useState<"in" | "out">(incoming.some((r) => r.status === "open") ? "in" : "out");
  const [paying, setPaying] = useState<MoneyRequest | null>(null);
  const [payFrom, setPayFrom] = useState(accounts.find((a) => a.type === "checking")?.id || accounts[0]?.id || "");
  const [stepUp, setStepUp] = useState(false);
  const [paid, setPaid] = useState<Transfer | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [key] = useState(() => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now())));

  const act = async (id: string, fn: (id: string) => Promise<{ ok: boolean; error?: string }>) => {
    setBusy(id); setErr(null);
    const r = await fn(id);
    setBusy(null);
    if (!r.ok) setErr(r.error || "That didn’t work.");
    router.refresh();
  };
  const list = tab === "in" ? incoming : outgoing;

  return (
    <section className="mn-panel">
      <div className="mn-seg" role="tablist" style={{ marginBottom: 10 }}>
        <button type="button" aria-pressed={tab === "in"} onClick={() => setTab("in")}>Waiting on you{incoming.filter((r) => r.status === "open").length ? ` · ${incoming.filter((r) => r.status === "open").length}` : ""}</button>
        <button type="button" aria-pressed={tab === "out"} onClick={() => setTab("out")}>You asked{outgoing.filter((r) => r.status === "open").length ? ` · ${outgoing.filter((r) => r.status === "open").length}` : ""}</button>
      </div>
      {err && <div className="mn-formerr" role="alert"><Icon name="alert" size={16} />{err}</div>}
      {paid && <div className="mn-notice" style={{ marginTop: 0, marginBottom: 8 }}><Icon name="check" size={16} />Paid {fmt(paid.amount)} to {paid.to.name}. Confirmation {paid.reference}.{sample ? " Sample confirmation — no money moved." : ""}</div>}
      {list.length === 0 ? (
        <div className="mn-empty"><b>{tab === "in" ? "Nothing waiting on you" : "No requests yet"}</b><p>{tab === "in" ? "When someone asks you for money, it shows up here." : "Ask someone at the bank, or share a link anyone can pay."}</p></div>
      ) : list.map((r, i) => (
        <div key={r.id} id={r.id} className="mn-reqrow">
          <PersonAvatar name={r.counterparty?.name || "Link"} tone={i} />
          <span>
            <b>{r.counterparty ? (tab === "in" ? `${r.counterparty.name} asked you` : `You asked ${r.counterparty.name}`) : "Payment link"}</b>
            <small>{r.memo || "No note"} · {r.status === "paid" && r.paidAt ? `paid ${fmtDate(r.paidAt)}` : `${fmtDate(r.createdAt)}${r.status === "open" ? ` · open until ${fmtDate(r.expiresAt)}` : ""}`}</small>
          </span>
          <span className="mn-reqrow-r">
            <b className="mn-bal" style={{ fontSize: 16 }}>{fmt(r.amount)}</b>
            {r.status !== "open" ? <StatusChip status={r.status} /> : tab === "in" ? (
              <span className="mn-reqrow-acts">
                <button type="button" className="btn ghost xs" disabled={busy === r.id} onClick={() => act(r.id, declineRequestAction)}>Decline</button>
                <button type="button" className="btn clay xs" onClick={() => { setPaying(r); setPaid(null); }}>Pay</button>
              </span>
            ) : (
              <span className="mn-reqrow-acts">
                {r.payUrl && <button type="button" className="btn ghost xs" onClick={async () => { try { await navigator.clipboard.writeText(r.payUrl!); } catch {} setBusy(`c${r.id}`); setTimeout(() => setBusy(null), 1400); }}>{busy === `c${r.id}` ? "Copied" : "Copy link"}</button>}
                <button type="button" className="btn ghost xs" disabled={busy === r.id} onClick={() => act(r.id, cancelRequestAction)}>Cancel</button>
              </span>
            )}
          </span>
        </div>
      ))}

      {paying && !stepUp && (
        <div className="mn-dialog-bg" onClick={() => setPaying(null)}>
          <div className="mn-dialog" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="mn-x" aria-label="Close" onClick={() => setPaying(null)}><Icon name="x" size={16} /></button>
            <PersonAvatar name={paying.counterparty?.name || "?"} size={46} />
            <h2>Pay {paying.counterparty?.name}</h2>
            <p>{fmt(paying.amount)}{paying.memo ? ` for “${paying.memo}”` : ""}. It arrives instantly.</p>
            <div className="mn-field">
              <label htmlFor="pay-from">Pay from</label>
              <select id="pay-from" value={payFrom} onChange={(e) => setPayFrom(e.target.value)}>
                {accounts.filter((a) => a.status === "open").map((a) => <option key={a.id} value={a.id}>{accountLabel(a)} · {fmt(a.balances.available)}</option>)}
              </select>
            </div>
            <div className="mn-actions"><button type="button" className="btn ghost sm" onClick={() => setPaying(null)}>Cancel</button><button type="button" className="btn clay sm" onClick={() => setStepUp(true)}><Icon name="lock" size={15} />Pay {fmt(paying.amount)}</button></div>
          </div>
        </div>
      )}
      {paying && stepUp && (
        <StepUpDialog
          action="pay_request"
          title="Confirm it’s you"
          body={`Paying ${fmt(paying.amount)} to ${paying.counterparty?.name}.`}
          confirmLabel={`Pay ${fmt(paying.amount)}`}
          sample={sample}
          onCancel={() => { setStepUp(false); setPaying(null); }}
          onConfirm={async (proof) => {
            const r = await payRequestAction(paying.id, payFrom, `${key}-${paying.id}`, proof);
            if (r.ok) { setPaid(r.data); setStepUp(false); setPaying(null); router.refresh(); }
            else if (!r.code.startsWith("STEP_UP")) setErr(r.error);
            return r;
          }}
        />
      )}
      <p className="mn-muted" style={{ marginTop: 12 }}>Paid requests land in your account straight away. <Link className="mn-link" href="/account/banking/transactions?cat=transfers">See transfers</Link></p>
    </section>
  );
}
