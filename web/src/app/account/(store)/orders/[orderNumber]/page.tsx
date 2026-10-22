import type { Metadata } from "next";
import type { CSSProperties } from "react";
import "@/modules/store/storefront.css"; // Appmint One: the flat order layout (sf-od / sf-ty)
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/guards";
import { getSetup } from "@/lib/setup";
import { getMapsKey } from "@/modules/rentals/lib/maps";
import { trackDelivery } from "@/api/logistics";
import { wordsFor } from "@/modules/logistics/lib/words";
import { ACTIVE_STATUSES, UNPAID_STATUSES, customerLabel, isLive, pickupOf, dropoffOf, stopAddress } from "@/modules/logistics/lib/status";
import { CustomerSteps, fmtTime } from "@/modules/logistics/components/shared/bits";
import { DriverCard } from "@/modules/logistics/components/shared/driver-card";
import { LiveRefresh } from "@/modules/logistics/components/shared/live-refresh";
import { RouteMap } from "@/modules/logistics/components/map/route-map";
import { FinishPayment } from "@/modules/logistics/components/account/finish-payment";
import { myOrder, myReturns } from "@/api/store";
import { kindOf } from "@/modules/store/lib/scope";
import { jobForOrder } from "@/modules/store/lib/food";
import { money2 } from "@/modules/store/lib/money";
import { optionsText, instructionsOf } from "@/modules/store/lib/options";
import { OrderPill, fmtDate, orderLabel } from "@/modules/store/components/order-bits";
import { ReturnForm } from "@/modules/store/components/return-form";
import { Icon } from "@/modules/store/components/icons";

type Params = { params: Promise<{ orderNumber: string }>; searchParams: Promise<{ placed?: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  return { title: `Order #${decodeURIComponent((await params).orderNumber)}` };
}

const RETAIL_STEPS = ["Placed", "Preparing", "Shipped", "Delivered"];
const retailIndex = (s: string) => (["delivered", "completed"].includes(s) ? 3 : s === "shipped" ? 2 : ["processing", "ready"].includes(s) ? 1 : 0);
const pt = (s: any) => (s?.location?.lat != null && s?.location?.lng != null ? { lat: Number(s.location.lat), lng: Number(s.location.lng) } : null);

/** One order. Food: the live delivery (Logistics' steps, map, courier card) above the
 *  receipt. Shop: shipping progress, the receipt, and returns. */
export default async function OrderPage({ params, searchParams }: Params) {
  await requireSession();
  const [{ orderNumber: raw }, sp, setup] = await Promise.all([params, searchParams, getSetup()]);
  const n = decodeURIComponent(raw);
  const o = await myOrder(n);
  if (!o) notFound();
  const k = await kindOf(o);
  if (!k) notFound();
  const cur = o.currency;
  const placed = sp.placed === "1";

  const receipt = (
    <section className="sf-ocard">
      <h2>{k.kind === "food" ? "Your order" : "Items"}</h2>
      <ul className="sf-olines">
        {o.lines.map((l, i) => (
          <li key={i}>
            {l.image ? <img src={l.image} alt="" /> : <i />}
            <span><b>{l.quantity > 1 ? `${l.quantity}× ` : ""}{l.name}</b>{optionsText(l.options) && <small>{optionsText(l.options)}</small>}{instructionsOf(l.options) && <small>“{instructionsOf(l.options)}”</small>}</span>
            <em>{money2(l.amount, cur)}</em>
          </li>
        ))}
      </ul>
      <div className="sf-sumrow"><span>Subtotal</span><b>{money2(o.subtotal, cur)}</b></div>
      {(o.discount ?? 0) > 0 && <div className="sf-sumrow save"><span>Savings</span><b>−{money2(o.discount, cur)}</b></div>}
      {k.kind === "shop" && <div className="sf-sumrow"><span>Shipping</span><b>{(o.shipping ?? 0) > 0 ? money2(o.shipping, cur) : "Free"}</b></div>}
      <div className="sf-sumrow"><span>Tax</span><b>{money2(o.tax, cur)}</b></div>
      <div className="sf-sumrow total"><span>{k.kind === "food" ? "Food total" : "Total"}</span><b>{money2(o.total, cur)}</b></div>
    </section>
  );

  if (k.kind === "food") {
    const w = wordsFor(setup);
    const env = await jobForOrder(o.orderNumber);
    const [track, apiKey] = env ? await Promise.all([trackDelivery(env.sk).catch(() => null), getMapsKey().catch(() => null)]) : [null, null];
    const j = env?.data;
    const status = j?.status;
    const unpaid = !!status && UNPAID_STATUSES.includes(status);
    const live = !!status && isLive(status);
    const agent = track?.agent || null;
    const driverName = agent?.name || j?.assignment?.agentName || "";
    const point = status && ACTIVE_STATUSES.includes(status) ? (track?.tracking?.currentLocation || agent?.currentLocation || j?.tracking?.liveLocation || null) : null;
    const pu = j ? pickupOf(j) : undefined, dr = j ? dropoffOf(j) : undefined;
    const fee = j ? Number(j.payment?.amount ?? j.pricing?.total ?? 0) : 0;
    return (
      <div className="sf-order food">
        <LiveRefresh active={live} seconds={10} />
        <Link className="sf-back" href="/account/orders"><Icon name="back" size={16} />Orders</Link>
        {placed && <div className="sf-banner ok"><Icon name="check" size={16} />Order placed · #{o.orderNumber}</div>}
        <div className="sf-order-grid">
          <div>
            <section className="sf-ocard sf-track">
              <p className="sf-track-kind">{k.restaurant?.title || "Food"} · #{o.orderNumber}</p>
              <h1>{status ? customerLabel(status, w, "food") : orderLabel(o.status)}</h1>
              <p className="sf-track-sub">Ordered {fmtTime(o.createdate)}{pu ? ` · from ${stopAddress(pu)}` : ""}</p>
              {env && !unpaid && status !== "cancelled" && <div className="sf-track-steps"><CustomerSteps env={env} words={w} kind="food" /></div>}
              {env && unpaid && (
                <div className="sf-banner warn">
                  <p>Your food is paid. The delivery isn’t booked until its payment goes through.</p>
                  <FinishPayment jobId={env.sk} amount={fee} currency={j?.payment?.currency || "USD"} jobWord="Delivery" />
                </div>
              )}
              {!env && <div className="sf-banner warn">Your food is paid and the kitchen has it. We’re still booking a courier — <Link href="/account/support">message support</Link> if this doesn’t update in a few minutes.</div>}
              {env && (
                <div className="sf-track-map">
                  <RouteMap apiKey={apiKey} pickup={pt(pu)} dropoff={pt(dr)} driver={point} fromLabel={stopAddress(pu)} toLabel={stopAddress(dr)} />
                </div>
              )}
              {driverName && <DriverCard name={driverName} photo={agent?.photo} rating={agent?.rating} vehicle={agent?.vehicle} note={live ? `Your ${w.provider.toLowerCase()}` : undefined} />}
              {env && <Link className="sf-link" href={`/trip/${env.sk}`}>Open full-screen tracking</Link>}
            </section>
          </div>
          <div>
            {receipt}
            {env && (
              <section className="sf-ocard">
                <div className="sf-sumrow"><span>Delivery fee</span><b>{money2(fee, cur)}</b></div>
                <div className="sf-sumrow"><span>Deliver to</span><b className="addr">{stopAddress(dr)}</b></div>
              </section>
            )}
          </div>
        </div>
      </div>
    );
  }

  const returns = (await myReturns().catch(() => [])).filter((r) => r.orderNumber === o.orderNumber);
  const canReturn = ["processing", "shipped", "delivered", "completed", "ready"].includes(o.status) && !returns.some((r) => !["cancelled", "rejected"].includes(r.status));
  const a = o.shippingAddress || {};
  const cancelled = ["cancelled", "refunded", "failed"].includes(o.status);
  // Appmint One: a shop order reads like its receipt — progress as one flat track, the
  // things bought with the totals under them, and shipping and returns beside them. No boxes in boxes.
  const stage = retailIndex(o.status);
  const NOTES = ["We have your order", "Being prepared and packed", "On its way to you", "It has arrived"];
  return (
    <div className="sf-order sf-od">
      <Link className="sf-back" href="/account/orders"><Icon name="back" size={16} />Orders</Link>
      {placed && <div className="sf-banner ok"><Icon name="check" size={16} />Thank you — order #{o.orderNumber} is confirmed. A receipt is on its way to {o.email}.</div>}
      <header className="sf-od-hd">
        <div>
          <p className="sf-ty-eyebrow">Placed {fmtDate(o.createdate)}</p>
          <h1>Order #{o.orderNumber}</h1>
        </div>
        <OrderPill status={o.status} />
      </header>
      {!cancelled && (
        <ol className="sf-ty-track" style={{ ["--at" as string]: stage } as CSSProperties} aria-label="Order progress">
          {RETAIL_STEPS.map((label, i) => (
            <li key={label} className={i < stage ? "done" : i === stage ? "now" : ""} aria-current={i === stage ? "step" : undefined}>
              <span className="dot" aria-hidden="true">{i <= stage && <Icon name="check" size={12} />}</span>
              <strong>{label}</strong>
              <span>{i <= stage ? NOTES[i] : i === stage + 1 ? "Next" : ""}</span>
            </li>
          ))}
        </ol>
      )}
      <div className="sf-od-grid">
        <section className="sf-od-items" aria-label="Items">
          <h2>Items</h2>
          <ul className="sf-ty-lines">
            {o.lines.map((l, i) => (
              <li key={i}>
                <span className="sf-ty-thumb">{l.image ? <img src={l.image} alt="" /> : null}<b>{l.quantity}</b></span>
                <span className="sf-ty-line-copy">
                  <strong>{l.name}</strong>
                  {optionsText(l.options) && <span>{optionsText(l.options)}</span>}
                  {instructionsOf(l.options) && <span>“{instructionsOf(l.options)}”</span>}
                </span>
                <span className="sf-ty-amt">{money2(l.amount, cur)}</span>
              </li>
            ))}
          </ul>
          <dl className="sf-ty-sums">
            <div><dt>Subtotal</dt><dd>{money2(o.subtotal, cur)}</dd></div>
            {(o.discount ?? 0) > 0 && <div><dt>Savings</dt><dd className="save">−{money2(o.discount, cur)}</dd></div>}
            <div><dt>Shipping</dt><dd>{(o.shipping ?? 0) > 0 ? money2(o.shipping, cur) : "Free"}</dd></div>
            <div><dt>Tax</dt><dd>{money2(o.tax, cur)}</dd></div>
            <div className="grand"><dt>Total</dt><dd>{money2(o.total, cur)}</dd></div>
          </dl>
        </section>
        <aside className="sf-od-side">
          <section>
            <h2>Shipping to</h2>
            <p className="sf-addr">{[a.name, a.street1, a.street2, [a.city, a.state, a.zip].filter(Boolean).join(" ")].filter(Boolean).map((x, i) => <span key={i}>{x}</span>)}</p>
          </section>
          <section>
            <h2>Returns</h2>
            {returns.map((r) => (
              <p key={r.sk} className="sf-ret-line"><b>{r.rmaNumber}</b> · {orderLabel(r.status)} · {r.items.map((i) => `${i.returnQuantity}× ${i.name}`).join(", ")}</p>
            ))}
            {canReturn ? <ReturnForm orderNumber={o.orderNumber} lines={o.lines} currency={cur} /> : !returns.length && <p className="sf-fine">{cancelled ? "This order was cancelled." : "You can start a return once your order is on its way."}</p>}
            <Link className="sf-link" href="/account/returns">All returns</Link>
          </section>
          <section>
            <h2>Need help?</h2>
            <p className="sf-fine">Questions about this order? <Link className="sf-link" href="/account/support">Contact support</Link></p>
          </section>
        </aside>
      </div>
    </div>
  );
}
