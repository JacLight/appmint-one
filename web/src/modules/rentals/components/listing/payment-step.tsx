"use client";

import { useEffect, useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Elements, CardNumberElement, CardExpiryElement, CardCvcElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { stripeKeyAction } from "@/modules/rentals/actions/checkout";

// One Stripe instance per publishable key, memoized across mounts.
const cache = new Map<string, Promise<Stripe | null>>();
function getStripe(key: string) {
  if (!cache.has(key)) cache.set(key, loadStripe(key));
  return cache.get(key)!;
}

const STYLE = {
  style: {
    base: { fontSize: "15px", color: "#1b1d16", fontFamily: "Inter, system-ui, sans-serif", "::placeholder": { color: "#9a9885" } },
    invalid: { color: "#a5401f" },
  },
};

function CardForm({ label, onPay, busy }: { label: string; onPay: (paymentMethodId: string) => void; busy: boolean }) {
  const stripe = useStripe();
  const elements = useElements();
  const [err, setErr] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [name, setName] = useState("");
  const [line1, setLine1] = useState("");
  const [city, setCity] = useState("");
  const [zip, setZip] = useState("");

  async function submit() {
    if (!stripe || !elements) return;
    setErr(null); setWorking(true);
    const number = elements.getElement(CardNumberElement);
    if (!number) { setWorking(false); return; }
    // The card never touches our server — Stripe tokenizes it. Billing name +
    // address go to the gateway for AVS so legit cards aren't declined.
    const { error, paymentMethod } = await stripe.createPaymentMethod({
      type: "card", card: number,
      billing_details: { name: name || undefined, address: { line1: line1 || undefined, city: city || undefined, postal_code: zip || undefined } },
    });
    setWorking(false);
    if (error || !paymentMethod) { setErr(error?.message ?? "Please check your card details."); return; }
    onPay(paymentMethod.id);
  }

  return (
    <div className="pay-form">
      <label className="pay-lbl" htmlFor="pay-num">Card number</label>
      <div className="pay-field" id="pay-num"><CardNumberElement options={{ ...STYLE, showIcon: true }} /></div>
      <div className="pay-row2">
        <div>
          <label className="pay-lbl">Expiry</label>
          <div className="pay-field"><CardExpiryElement options={STYLE} /></div>
        </div>
        <div>
          <label className="pay-lbl">CVC</label>
          <div className="pay-field"><CardCvcElement options={STYLE} /></div>
        </div>
      </div>

      <label className="pay-lbl" htmlFor="pay-name" style={{ marginTop: 12 }}>Name on card</label>
      <input id="pay-name" className="pay-input" autoComplete="cc-name" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
      <label className="pay-lbl" htmlFor="pay-addr" style={{ marginTop: 12 }}>Billing address</label>
      <input id="pay-addr" className="pay-input" autoComplete="address-line1" placeholder="Street address" value={line1} onChange={(e) => setLine1(e.target.value)} />
      <div className="pay-row2" style={{ marginTop: 10 }}>
        <input className="pay-input" autoComplete="address-level2" placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
        <input className="pay-input" inputMode="numeric" autoComplete="postal-code" placeholder="ZIP" value={zip} onChange={(e) => setZip(e.target.value.replace(/[^0-9A-Za-z -]/g, "").slice(0, 10))} />
      </div>

      {err && <div className="bp-error" style={{ marginTop: 10 }}>{err}</div>}
      <button type="button" className="btn clay lg" style={{ width: "100%", justifyContent: "center", marginTop: 12 }}
        disabled={!stripe || working || busy} onClick={submit}>
        {working || busy ? "Processing…" : label}
      </button>
      <p className="note" style={{ textAlign: "center", marginTop: 8 }}>Secured by Stripe · your card is never stored by us.</p>
    </div>
  );
}

/** Card step: multi-field Stripe form (number / expiry / CVC — no ZIP or address),
 *  tokenizes in-browser and hands the payment-method id up. */
export function PaymentStep({ label, onPay, busy }: { label: string; onPay: (paymentMethodId: string) => void; busy: boolean }) {
  const [key, setKey] = useState<string | null>(null);
  const [fail, setFail] = useState(false);
  useEffect(() => {
    let live = true;
    stripeKeyAction().then((r) => { if (!live) return; r.ok ? setKey(r.publishableKey) : setFail(true); });
    return () => { live = false; };
  }, []);

  if (fail) return <div className="bp-error">Card payment isn’t available right now — please try again shortly.</div>;
  if (!key) return <div className="bp-quote-msg">Loading secure payment…</div>;
  return (
    <Elements stripe={getStripe(key)}>
      <CardForm label={label} onPay={onPay} busy={busy} />
    </Elements>
  );
}
