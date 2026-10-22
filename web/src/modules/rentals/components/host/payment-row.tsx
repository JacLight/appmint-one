"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { routes } from "@/lib/nav";
import { formatMoney } from "@/lib/utils";
import { fmtFull } from "@/lib/dates";
import { refundTransactionAction, sendReceiptAction, cancelPaymentRequestAction } from "@/modules/rentals/actions/host-payments";
import type { HostPayment } from "@/api/rentals";

const CHANNEL: Record<string, string> = { link: "Link / QR", tap_to_pay: "Tap to Pay", terminal: "Card reader", card_reader: "Card reader", web: "Online card", card: "Card" };
const CATEGORY: Record<string, string> = { balance: "Balance due", booking: "Booking payment", deposit: "Deposit", addon: "Add-on", damage: "Damage", overstay: "Overstay", tip: "Tip", other: "Payment" };

export function paymentTitle(r: HostPayment): string {
  if (r.kind === "refund") return `Refund${r.description ? ` · ${r.description}` : ""}`;
  return r.description || CATEGORY[r.category] || r.reference || CHANNEL[r.channel || ""] || "Payment";
}

/** One transaction — the row, and the detail drawer it opens: who, what for, how it was
 *  taken, the gateway reference, timestamps, and what the host can still do with it
 *  (refund, resend the receipt, void a pending link). */
export function PaymentRow({ r, cur }: { r: HostPayment; cur: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"none" | "refund" | "receipt" | "cancel">("none");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [to, setTo] = useState("");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const money = (n: number) => formatMoney(Math.round((n ?? 0) * 100), r.currency || cur);
  const isRefund = r.kind === "refund";
  const status = r.pending ? "pending" : isRefund ? "refunded" : (r.refunded ?? 0) >= r.amount && r.amount > 0 ? "refunded" : (r.refunded ?? 0) > 0 ? "part-refunded" : r.status === "cancelled" ? "cancelled" : "paid";
  const remaining = r.remaining ?? Math.max(0, r.amount - (r.refunded ?? 0));
  const canRefund = !r.pending && !isRefund && !!r.ref && remaining > 0 && r.status !== "cancelled";
  const canReceipt = !r.pending && !isRefund && !!r.ref;
  const canCancel = r.pending && !!r.request;
  const qr = r.url ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&data=${encodeURIComponent(r.url)}` : null;

  function run(fn: () => Promise<{ ok: boolean; error?: string; to?: string }>, done: (res: { ok: boolean; error?: string; to?: string }) => string) {
    setMsg(null);
    start(async () => {
      const res = await fn();
      if (res.ok) { setMsg({ kind: "ok", text: done(res) }); setMode("none"); setAmount(""); setReason(""); setTo(""); router.refresh(); }
      else setMsg({ kind: "err", text: res.error || "Couldn’t do that." });
    });
  }
  const refundAmt = amount.trim() === "" ? remaining : Number(amount);
  const refundValid = refundAmt > 0 && refundAmt <= remaining + 0.001;

  return (
    <>
      <button type="button" className={`hp-row hp-click${r.pending ? " hp-pending" : ""}${isRefund ? " hp-refund" : ""}`} onClick={() => { setOpen(true); setMsg(null); setMode("none"); }}>
        <div className="hp-what">
          <b>{paymentTitle(r)}</b>
          <span className="hp-meta">
            {r.customer ? <>{r.customer} · </> : null}
            {r.bookingRef ? <>#{r.bookingRef} · </> : null}
            {r.channel ? <>{CHANNEL[r.channel] || r.channel} · </> : null}
            {r.at ? fmtFull(r.at) : ""}
          </span>
        </div>
        <div className="hp-right">
          <span className={`hp-amt${isRefund ? " neg" : ""}`}>{isRefund ? "−" : ""}{money(r.amount)}</span>
          <span className={`hp-pill ${status === "paid" ? "ok" : status === "pending" ? "wait" : "off"}`}>{status === "part-refunded" ? "Part refunded" : status[0].toUpperCase() + status.slice(1)}</span>
        </div>
      </button>

      {open && (
        <div className="drw-ov" role="dialog" aria-modal="true" aria-label="Transaction" onClick={() => setOpen(false)}>
          <aside className="drw-panel" style={{ width: "min(460px, 100%)" }} onClick={(e) => e.stopPropagation()}>
            <div className="drw-hd">
              <div>
                <h2 className="drw-title">{isRefund ? "−" : ""}{money(r.amount)}</h2>
                <p className="drw-sub">{paymentTitle(r)} · <span className={`hp-pill ${status === "paid" ? "ok" : status === "pending" ? "wait" : "off"}`}>{status === "part-refunded" ? "Part refunded" : status[0].toUpperCase() + status.slice(1)}</span></p>
              </div>
              <button type="button" className="drw-x" onClick={() => setOpen(false)} aria-label="Close">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2}><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>
            <div className="drw-body">
              <dl className="tx-dl">
                {r.customer && <><dt>Customer</dt><dd>{r.customer}</dd></>}
                {r.booking && <><dt>Booking</dt><dd><Link href={`${routes.hostCustody}/${r.booking}`} onClick={() => setOpen(false)}>#{r.bookingRef || r.booking} →</Link></dd></>}
                <dt>What for</dt><dd>{CATEGORY[r.category] || r.category}{r.reference ? ` · ${r.reference}` : ""}</dd>
                {r.channel && <><dt>Taken by</dt><dd>{CHANNEL[r.channel] || r.channel}</dd></>}
                {r.at && <><dt>When</dt><dd>{fmtFull(r.at)}</dd></>}
                {(r.refunded ?? 0) > 0 && !isRefund && <><dt>Refunded</dt><dd>−{money(r.refunded!)} <span className="muted">({money(remaining)} left)</span></dd></>}
                {r.refundOf && <><dt>Refund of</dt><dd className="tx-mono">{r.refundOf}</dd></>}
                {r.ref && <><dt>Gateway ref</dt><dd className="tx-mono">{r.ref}</dd></>}
                {r.request && <><dt>Ledger id</dt><dd className="tx-mono">{r.request}</dd></>}
              </dl>

              {r.pending && r.url && (
                <div className="tx-pending">
                  <p className="muted" style={{ margin: "0 0 8px" }}>Still waiting to be paid — show the code or send the link again.</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {qr && <img src={qr} alt="Scan to pay" width={200} height={200} />}
                  <button type="button" className="btn ghost sm" onClick={() => { navigator.clipboard?.writeText(r.url!); setCopied(true); setTimeout(() => setCopied(false), 1600); }}>{copied ? "Copied" : "Copy pay link"}</button>
                </div>
              )}

              {(canRefund || canReceipt || canCancel) && mode === "none" && (
                <div className="ht-row" style={{ marginTop: 16 }}>
                  {canRefund && <button type="button" className="ht-link" onClick={() => setMode("refund")}>Refund</button>}
                  {canReceipt && <button type="button" className="ht-link" onClick={() => setMode("receipt")}>Send receipt</button>}
                  {canCancel && <button type="button" className="ht-link danger" onClick={() => setMode("cancel")}>Cancel request</button>}
                </div>
              )}

              {mode === "refund" && (
                <div className="ht-form" style={{ marginTop: 14 }}>
                  <p className="ht-q">Refund up to {money(remaining)}. Leave the amount empty for a full refund.</p>
                  <div className="ht-amt"><span>$</span><input className="ht-input" inputMode="decimal" placeholder={remaining.toFixed(2)} value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} /></div>
                  {amount.trim() !== "" && !refundValid && <p className="bp-error">Enter an amount between $0.01 and {money(remaining)}.</p>}
                  <input className="ht-input" placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
                  <div className="ht-form-row">
                    <button type="button" className="ht-btn primary" disabled={pending || !refundValid} onClick={() => run(() => refundTransactionAction(r.ref!, { ...(amount.trim() !== "" ? { amount: refundAmt } : {}), reason: reason || undefined }), () => `Refunded ${money(refundAmt)}.`)}>{pending ? "Refunding…" : `Refund ${money(refundAmt)}`}</button>
                    <button type="button" className="ht-btn ghost" disabled={pending} onClick={() => setMode("none")}>Cancel</button>
                  </div>
                </div>
              )}

              {mode === "receipt" && (
                <div className="ht-form" style={{ marginTop: 14 }}>
                  <p className="ht-q">Send to the booking’s customer, or type an email / phone.</p>
                  <input className="ht-input" placeholder="Email or phone (optional)" value={to} onChange={(e) => setTo(e.target.value)} />
                  <div className="ht-form-row">
                    <button type="button" className="ht-btn primary" disabled={pending} onClick={() => {
                      const v = to.trim(); const isEmail = v.includes("@");
                      run(() => sendReceiptAction(r.ref!, { ...(v ? (isEmail ? { email: v } : { phone: v }) : {}), ...(r.booking ? { bookingId: r.booking } : {}) }),
                        (res) => res.to === "email" ? `Emailed to ${v}.` : res.to === "phone" ? `Texted to ${v}.` : "Receipt sent to the booking customer.");
                    }}>{pending ? "Sending…" : "Send receipt"}</button>
                    <button type="button" className="ht-btn ghost" disabled={pending} onClick={() => setMode("none")}>Cancel</button>
                  </div>
                </div>
              )}

              {mode === "cancel" && (
                <div className="ht-form" style={{ marginTop: 14 }}>
                  <p className="ht-q">Cancel this request? Its link and QR stop working. Nothing has been charged.</p>
                  <div className="ht-form-row">
                    <button type="button" className="ht-btn danger" disabled={pending} onClick={() => run(() => cancelPaymentRequestAction(r.request!), () => "Request cancelled.")}>{pending ? "Cancelling…" : "Yes, cancel it"}</button>
                    <button type="button" className="ht-btn ghost" disabled={pending} onClick={() => setMode("none")}>Keep it</button>
                  </div>
                </div>
              )}

              {msg && <div className={msg.kind === "ok" ? "ht-ok" : "bp-error"} style={{ marginTop: 12 }}>{msg.kind === "ok" ? "✓ " : ""}{msg.text}</div>}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
