"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmCard } from "@/modules/logistics/components/shared/confirm-card";
import { foodDeliveryPaidAction, foodPlaceAction, foodPrepareAction } from "../actions/checkout";
import type { Cart } from "../lib/types";
import { money2 } from "../lib/money";
import { optionsText, instructionsOf } from "../lib/options";
import { cartChanged } from "./bag";
import { CardStep } from "./card-step";
import { EatAddress } from "./eat-address";
import { Icon } from "./icons";

/**
 * Food checkout. The numbers are the engine's: the basket's total (store pricing) and
 * the delivery fee (the Logistics quote to this address). Placing the order re-checks
 * both before any card is touched, pays the food, writes the order, books the courier
 * and pays the delivery at the fee shown — then opens the live order.
 */
export function FoodCheckout({ cart, restaurant, address, addressLabel, fee, total, eta }: {
  cart: Cart; restaurant: { title: string; image?: string; street?: string }; address: string; addressLabel?: string;
  fee: number; total: number; eta?: [number, number] | null;
}) {
  const router = useRouter();
  const [handTo, setHandTo] = useState(false);
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const cur = cart.totals.currency;

  const pay = ([pmFood, pmDelivery]: string[]) => start(async () => {
    setErr(null);
    const prep = await foodPrepareAction(address, { food: cart.totals.total, fee });
    if (!prep.ok) { setErr(prep.error); if (prep.changed) router.refresh(); if (prep.signIn) router.push("/login?next=/eat/checkout"); return; }
    const food = await confirmCard(prep.clientSecret, pmFood);
    if (!food.ok) { setErr(food.error); return; }
    const placed = await foodPlaceAction({ address, dropoff: { handTo, instructions: note }, paymentIntentId: food.paymentIntentId, fee: prep.fee });
    if (!placed.ok) { setErr(placed.error); return; }
    cartChanged("food");
    const to = `/account/orders/${encodeURIComponent(placed.orderNumber)}?placed=1`;
    if (!placed.jobId || !placed.deliverySecret) { router.push(to); return; }
    const d = await confirmCard(placed.deliverySecret, pmDelivery);
    if (d.ok) await foodDeliveryPaidAction(placed.jobId, d.paymentIntentId);
    router.push(to);
  });

  return (
    <div className="ea-co">
      <div className="ea-co-main">
        <section className="ea-co-card">
          <h2>Delivery details</h2>
          <EatAddress address={address} label={addressLabel} />
          <div className="ea-co-drop">
            <button type="button" className={!handTo ? "on" : ""} onClick={() => setHandTo(false)}><b>Leave at door</b><small>We’ll send a photo when it’s there</small></button>
            <button type="button" className={handTo ? "on" : ""} onClick={() => setHandTo(true)}><b>Hand it to me</b><small>Meet the courier at the door</small></button>
          </div>
          <label className="ea-co-note">Drop-off instructions <em>optional</em>
            <textarea rows={2} maxLength={240} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Gate code, building, which door…" />
          </label>
          {eta && <p className="ea-co-eta"><Icon name="clock" size={16} />Arrives in about {eta[0]}–{eta[1]} min</p>}
        </section>
        <section className="ea-co-card">
          <h2>Payment</h2>
          {err && <p className="sf-err">{err}</p>}
          <CardStep label={`Place order · ${money2(total, cur)}`} count={2} busy={pending} onPay={pay} />
          <p className="sf-fine">Your card shows two charges: {money2(cart.totals.total, cur)} for the food and {money2(fee, cur)} for delivery.</p>
        </section>
      </div>
      <aside className="ea-co-side">
        <div className="ea-co-rest">{restaurant.image && <img src={restaurant.image} alt="" />}<span><b>{restaurant.title}</b><small>{restaurant.street}</small></span></div>
        <ul className="ea-co-lines">
          {cart.lines.map((l, i) => (
            <li key={`${l.sku}-${i}`}>
              <span className="ea-co-q">{l.quantity}×</span>
              <span className="ea-co-ln"><b>{l.name}</b>{optionsText(l.options) && <small>{optionsText(l.options)}</small>}{instructionsOf(l.options) && <small>“{instructionsOf(l.options)}”</small>}</span>
              <span>{money2(l.lineTotal ?? 0, cur)}</span>
            </li>
          ))}
        </ul>
        <div className="sf-sumrow"><span>Subtotal</span><b>{money2(cart.totals.subtotal, cur)}</b></div>
        {cart.totals.discount > 0 && <div className="sf-sumrow save"><span>Savings</span><b>−{money2(cart.totals.discount, cur)}</b></div>}
        <div className="sf-sumrow"><span>Taxes</span><b>{money2(cart.totals.tax, cur)}</b></div>
        <div className="sf-sumrow"><span>Delivery fee</span><b>{money2(fee, cur)}</b></div>
        <div className="sf-sumrow total"><span>Total</span><b>{money2(total, cur)}</b></div>
      </aside>
    </div>
  );
}
