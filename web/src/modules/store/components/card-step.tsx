"use client";

import { useEffect, useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Elements, CardNumberElement, CardExpiryElement, CardCvcElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { stripeKeyAction } from "@/modules/rentals/actions/checkout";

const cache = new Map<string, Promise<Stripe | null>>();
const getStripe = (key: string) => { if (!cache.has(key)) cache.set(key, loadStripe(key)); return cache.get(key)!; };
const STYLE = { style: { base: { fontSize: "15px", color: "#111", fontFamily: "Inter, system-ui, sans-serif", "::placeholder": { color: "#9a9a92" } }, invalid: { color: "#b3261e" } } };

/**
 * The shared card step (same fields and look as rentals' PaymentStep), but it hands
 * up `count` PaymentMethods from ONE card entry. A food order is two charges — the food
 * (store order) and the delivery (courier job) — and Stripe lets an unattached
 * PaymentMethod pay only one PaymentIntent.
 */
function Form({ label, count, onPay, busy }: { label: string; count: number; onPay: (pms: string[]) => void; busy: boolean }) {
  const stripe = useStripe();
  const elements = useElements();
  const [err, setErr] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [name, setName] = useState("");
  const [zip, setZip] = useState("");

  async function submit() {
    if (!stripe || !elements) return;
    const number = elements.getElement(CardNumberElement);
    if (!number) return;
    setErr(null); setWorking(true);
    const pms: string[] = [];
    for (let i = 0; i < count; i++) {
      const { error, paymentMethod } = await stripe.createPaymentMethod({ type: "card", card: number, billing_details: { name: name || undefined, address: { postal_code: zip || undefined } } });
      if (error || !paymentMethod) { setWorking(false); setErr(error?.message ?? "Please check your card details."); return; }
      pms.push(paymentMethod.id);
    }
    setWorking(false);
    onPay(pms);
  }

  return (
    <div className="pay-form">
      <label className="pay-lbl" htmlFor="cs-num">Card number</label>
      <div className="pay-field" id="cs-num"><CardNumberElement options={{ ...STYLE, showIcon: true }} /></div>
      <div className="pay-row2">
        <div><label className="pay-lbl">Expiry</label><div className="pay-field"><CardExpiryElement options={STYLE} /></div></div>
        <div><label className="pay-lbl">CVC</label><div className="pay-field"><CardCvcElement options={STYLE} /></div></div>
      </div>
      <div className="pay-row2" style={{ marginTop: 10 }}>
        <input className="pay-input" autoComplete="cc-name" placeholder="Name on card" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="pay-input" inputMode="numeric" autoComplete="postal-code" placeholder="Billing ZIP" value={zip} onChange={(e) => setZip(e.target.value.replace(/[^0-9A-Za-z -]/g, "").slice(0, 10))} />
      </div>
      {err && <p className="sf-err" style={{ marginTop: 10 }}>{err}</p>}
      <button type="button" className="ea-btn block lg" style={{ marginTop: 14 }} disabled={!stripe || working || busy} onClick={submit}>
        {working || busy ? "Placing order…" : label}
      </button>
      <p className="sf-fine center">Secured by Stripe · your card is never stored by us.</p>
    </div>
  );
}

export function CardStep({ label, count = 1, onPay, busy }: { label: string; count?: number; onPay: (pms: string[]) => void; busy: boolean }) {
  const [key, setKey] = useState<string | null>(null);
  const [fail, setFail] = useState(false);
  useEffect(() => { let live = true; stripeKeyAction().then((r) => { if (!live) return; r.ok ? setKey(r.publishableKey) : setFail(true); }); return () => { live = false; }; }, []);
  if (fail) return <p className="sf-err">Card payment isn’t available right now — please try again shortly.</p>;
  if (!key) return <p className="sf-fine">Loading secure payment…</p>;
  return <Elements stripe={getStripe(key)}><Form label={label} count={count} onPay={onPay} busy={busy} /></Elements>;
}
