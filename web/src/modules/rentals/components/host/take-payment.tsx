"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createPaymentRequestAction, paymentRequestStatusAction, sendReceiptAction } from "@/modules/rentals/actions/host-payments";
import { formatMoney } from "@/lib/utils";
import type { PaymentCategory, PaymentRequestCreated } from "@/api/rentals";

const CATEGORIES: { k: PaymentCategory; label: string }[] = [
  { k: "adhoc", label: "Walk-up" },
  { k: "booking", label: "Booking" },
  { k: "addon", label: "Extra" },
  { k: "tip", label: "Tip" },
  { k: "other", label: "Other" },
];

/** A QR for the pay link, rendered without shipping a QR library — the image API is
 *  fine here because the link is a public bearer URL and nothing secret is in it. */
function Qr({ url }: { url: string }) {
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=8&data=${encodeURIComponent(url)}`;
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="tp-qr" src={src} alt="Scan to pay" width={260} height={260} />;
}

/** Take money in person: name an amount, then either hand over a QR to scan or text /
 *  email the link. The row is pending until the customer pays; this screen watches it
 *  and flips itself the moment it lands, so the host knows without asking. */
export type TakePaymentPreset = { amount?: number; category?: PaymentCategory; bookingId?: string; reference?: string; description?: string };

export function TakePayment({ preset }: { preset?: TakePaymentPreset } = {}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  // A preset comes from a booking page ("Take payment · $14.60"): amount + booking are
  // fixed by the bill, so they're shown, not retyped.
  const blank = { amount: "", category: "adhoc" as PaymentCategory, description: "", reference: "", email: "", phone: "", send: false };
  const fromPreset = preset ? {
    ...blank,
    amount: preset.amount != null ? preset.amount.toFixed(2) : "",
    category: preset.category ?? "booking",
    description: preset.description ?? (preset.reference ? `Booking #${preset.reference}` : "Booking balance"),
    reference: preset.reference ?? "",
  } : blank;
  const [f, setF] = useState(fromPreset);
  const [req, setReq] = useState<PaymentRequestCreated | null>(null);
  const [paid, setPaid] = useState(false);
  const [paidRef, setPaidRef] = useState<string | null>(null);
  const [rcpt, setRcpt] = useState<{ mode: "none" | "ask"; to: string; msg: string | null }>({ mode: "none", to: "", msg: null });
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Watch the pending row while the customer pays.
  useEffect(() => {
    if (!req || paid) return;
    timer.current = setInterval(async () => {
      const r = await paymentRequestStatusAction(req.paymentRequestId);
      if (r.ok && r.status.paid) {
        setPaid(true);
        setPaidRef(r.status.ref ?? null);
        if (timer.current) clearInterval(timer.current);
        // The ledger beside this panel is server-rendered — without a refresh it keeps
        // showing the payment we just took as still "waiting to be paid".
        router.refresh();
      }
    }, 3000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [req, paid]);

  const money = (n: number, c = "USD") => formatMoney(Math.round((n ?? 0) * 100), c);

  function create() {
    setErr(null);
    start(async () => {
      const r = await createPaymentRequestAction({
        amount: Number(f.amount), currency: "USD", category: f.category,
        bookingId: preset?.bookingId || undefined,
        description: f.description.trim() || undefined,
        reference: f.reference.trim() || undefined,
        email: f.email.trim() || undefined,
        phone: f.phone.trim() || undefined,
        send: f.send && !!(f.email.trim() || f.phone.trim()),
      });
      if (r.ok) { setReq(r.request); setPaid(false); }
      else setErr(r.error);
    });
  }

  function reset() {
    if (timer.current) clearInterval(timer.current);
    router.refresh();
    setReq(null); setPaid(false); setPaidRef(null); setErr(null); setCopied(false); setRcpt({ mode: "none", to: "", msg: null });
    setF(blank);
    // A preset belongs to ONE booking — once it's paid, the next payment starts clean.
    if (preset) router.replace("/host/payments");
  }

  function receipt(to?: string) {
    if (!paidRef) return;
    const v = (to ?? "").trim(); const isEmail = v.includes("@");
    start(async () => {
      const r = await sendReceiptAction(paidRef, { ...(v ? (isEmail ? { email: v } : { phone: v }) : {}), ...(preset?.bookingId ? { bookingId: preset.bookingId } : {}) });
      setRcpt({ mode: "none", to: "", msg: r.ok ? (r.to === "email" ? `Emailed to ${v}.` : r.to === "phone" ? `Texted to ${v}.` : "Receipt sent to the booking customer.") : r.error });
    });
  }

  if (req) {
    return (
      <div className={`tp-card${paid ? " tp-paid" : ""}`}>
        {paid ? (
          <>
            <div className="tp-tick" aria-hidden>✓</div>
            <h3>Paid — {money(req.amount, req.currency)}</h3>
            <p className="tp-sub">The customer has paid. It’s recorded against your account.</p>
            {paidRef && (
              <div className="tp-receipt">
                {rcpt.mode === "none" ? (
                  <div className="ht-row">
                    {preset?.bookingId && <button type="button" className="ht-link" disabled={pending} onClick={() => receipt()}>Send receipt to customer</button>}
                    <button type="button" className="ht-link" onClick={() => setRcpt({ mode: "ask", to: "", msg: null })}>Email / text receipt…</button>
                    <button type="button" className="ht-link" onClick={() => window.print()}>Print</button>
                  </div>
                ) : (
                  <div className="ht-form">
                    <input className="ht-input" placeholder="Email or mobile" value={rcpt.to} onChange={(e) => setRcpt({ ...rcpt, to: e.target.value })} autoFocus />
                    <div className="ht-form-row">
                      <button type="button" className="ht-btn primary" disabled={pending || !rcpt.to.trim()} onClick={() => receipt(rcpt.to)}>{pending ? "Sending…" : "Send"}</button>
                      <button type="button" className="ht-btn ghost" onClick={() => setRcpt({ mode: "none", to: "", msg: null })}>Cancel</button>
                    </div>
                  </div>
                )}
                {rcpt.msg && <div className="ht-ok" style={{ marginTop: 8 }}>{rcpt.msg}</div>}
              </div>
            )}
            <button type="button" className="btn clay" onClick={reset}>{preset ? "Done" : "Take another payment"}</button>
          </>
        ) : (
          <>
            <p className="eyebrow">Waiting for payment</p>
            <h3>{money(req.amount, req.currency)}</h3>
            <p className="tp-sub">Have them scan this, or send the link. This updates itself when they pay.</p>
            <Qr url={req.url} />
            <div className="tp-link">
              <input readOnly value={req.url} onFocus={(e) => e.currentTarget.select()} />
              <button type="button" className="btn ghost sm" onClick={() => { navigator.clipboard?.writeText(req.url); setCopied(true); setTimeout(() => setCopied(false), 1600); }}>
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            {req.sent && <p className="tp-sent">Link sent ✓</p>}
            <div className="tp-waiting"><span className="tp-dot" />Waiting for the customer…</div>
            <button type="button" className="tp-cancel" onClick={reset}>Cancel</button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="tp-card">
      <h3>{preset ? "Collect the balance" : "Take a payment"}</h3>
      <p className="tp-sub">{preset ? <>For booking <b>#{preset.reference || preset.bookingId}</b> — the amount is what the bill says is owed.</> : "For a walk-up, an extra, or a tip — they pay by card, no account needed."}</p>

      <label className="set-field tp-amount"><span>Amount</span>
        <input value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} placeholder="0.00" inputMode="decimal" autoFocus />
      </label>

      <div className="tp-cats">
        {CATEGORIES.map((c) => (
          <button key={c.k} type="button" className={`tp-cat${f.category === c.k ? " on" : ""}`} onClick={() => setF({ ...f, category: c.k })}>{c.label}</button>
        ))}
      </div>

      <label className="set-field"><span>What’s it for</span>
        <input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Oversize bag — day rate" />
      </label>
      <label className="set-field"><span>Reference <em>(optional — plate, name, invoice)</em></span>
        <input value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} placeholder="ABC-1234" />
      </label>

      <div className="tp-send">
        <label className="ao-check">
          <input type="checkbox" checked={f.send} onChange={(e) => setF({ ...f, send: e.target.checked })} />
          <span>Send them the link <em>(otherwise just show the QR)</em></span>
        </label>
        {f.send && (
          <div className="ao-row2">
            <label className="set-field"><span>Email</span><input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="them@example.com" inputMode="email" /></label>
            <label className="set-field"><span>Mobile</span><input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="+1 214…" inputMode="tel" /></label>
          </div>
        )}
      </div>

      {err && <div className="bp-error" style={{ marginBottom: 10 }}>{err}</div>}

      <button type="button" className="btn clay" style={{ width: "100%", justifyContent: "center" }} disabled={pending || !(Number(f.amount) > 0)} onClick={create}>
        {pending ? "Creating…" : f.amount ? `Request ${money(Number(f.amount) || 0)}` : "Request payment"}
      </button>
    </div>
  );
}
