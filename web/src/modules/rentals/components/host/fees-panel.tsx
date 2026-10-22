"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createFeeAction, deleteFeeAction, setListingFeesAction } from "@/modules/rentals/actions/fees-host";
import { formatMoney } from "@/lib/utils";
import type { StowboFee } from "@/api/rentals";
import type { Envelope } from "@/lib/api";

const TRIGGERS: { k: NonNullable<StowboFee["trigger"]>; label: string }[] = [
  { k: "booking", label: "Every booking" },
  { k: "cancellation", label: "On cancellation" },
  { k: "late_pickup", label: "Late pick-up" },
  { k: "no_show", label: "No-show" },
];
const CHANNELS = [
  { k: "web", label: "Website" }, { k: "app", label: "App" }, { k: "walkin", label: "Walk-in" }, { k: "reservation", label: "Host reservation" },
];

const blank = { title: "", description: "", basis: "fixed" as "fixed" | "percent", amount: "", appliesTo: "checkout" as "checkout" | "item", paidBy: "guest" as "guest" | "host", trigger: "booking" as NonNullable<StowboFee["trigger"]>, priceFrom: "", priceTo: "", minFee: "", maxFee: "", channels: [] as string[], taxable: true, refundable: false };

/** One line that says what a fee does: "$3.00 per order · subtotal ≥ $0.01 · at most $5". */
export function describeFee(f: StowboFee, cur = "USD"): string {
  const money = (n: number) => formatMoney(Math.round(n * 100), cur);
  const amt = f.basis === "percent" ? `${Number(f.amount ?? 0)}%` : money(Number(f.amount ?? 0));
  const bits = [`${amt} ${f.appliesTo === "item" ? "per item" : "per order"}`];
  if (f.priceFrom != null && f.priceFrom !== undefined) bits.push(`subtotal ≥ ${money(Number(f.priceFrom))}`);
  if (f.priceTo != null && f.priceTo !== undefined) bits.push(`subtotal ≤ ${money(Number(f.priceTo))}`);
  if (f.minFee != null) bits.push(`at least ${money(Number(f.minFee))}`);
  if (f.maxFee != null) bits.push(`at most ${money(Number(f.maxFee))}`);
  if (f.paidBy === "host") bits.push("off your payout");
  if (f.trigger && f.trigger !== "booking") bits.push(TRIGGERS.find((t) => t.k === f.trigger)?.label.toLowerCase() || f.trigger);
  if (f.channels?.length) bits.push(f.channels.map((c) => CHANNELS.find((x) => x.k === c)?.label || c).join(" / "));
  return bits.join(" · ");
}

/** The host's own fees: define them once, tick which apply to this space. A fee is a
 *  row of money that is neither the space nor an add-on — booking fee, cleaning, late
 *  pick-up. Guest-paid fees appear on the bill; host-paid come off the payout. */
export function FeesPanel({ listingId, mine, attached, currency = "USD" }: {
  listingId: string;
  mine: Envelope<StowboFee>[];
  attached: string[];
  currency?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [open, setOpen] = useState(false);
  const [more, setMore] = useState(false);
  const [f, setF] = useState({ ...blank });
  const [on, setOn] = useState<string[]>(attached ?? []);

  const num = (v: string) => (v.trim() === "" ? undefined : Number(v));

  function create() {
    setMsg(null);
    start(async () => {
      const r = await createFeeAction({
        title: f.title, description: f.description || undefined,
        basis: f.basis, amount: Number(f.amount || 0), appliesTo: f.appliesTo, paidBy: f.paidBy, trigger: f.trigger,
        priceFrom: num(f.priceFrom), priceTo: num(f.priceTo), minFee: num(f.minFee), maxFee: num(f.maxFee),
        channels: f.channels, taxable: f.taxable, refundable: f.refundable,
      });
      if (r.ok) { setF({ ...blank }); setOpen(false); setMore(false); setMsg({ kind: "ok", text: "Fee created — tick it below to apply it to this space." }); router.refresh(); }
      else setMsg({ kind: "err", text: r.error });
    });
  }

  function toggle(name: string) {
    const next = on.includes(name) ? on.filter((n) => n !== name) : [...on, name];
    const prev = on;
    setOn(next);
    start(async () => {
      const r = await setListingFeesAction(listingId, next);
      if (!r.ok) { setOn(prev); setMsg({ kind: "err", text: r.error }); }
      else router.refresh();
    });
  }

  function remove(id: string) {
    start(async () => {
      const r = await deleteFeeAction(id);
      if (r.ok) { setMsg({ kind: "ok", text: "Fee retired. Bookings that already carry it keep their line." }); router.refresh(); }
      else setMsg({ kind: "err", text: r.error });
    });
  }

  const toggleChannel = (k: string) => setF({ ...f, channels: f.channels.includes(k) ? f.channels.filter((c) => c !== k) : [...f.channels, k] });

  return (
    <div className="ao-panel">
      <div className="ao-head">
        <div>
          <h3>Fees for this space</h3>
          <p className="ao-sub">Booking fee, cleaning, late pick-up… Guest-paid fees go on the bill; host-paid ones come off your payout. Tick the ones this space charges.</p>
        </div>
        <button type="button" className="btn clay sm" onClick={() => { setOpen(!open); setMsg(null); }}>
          {open ? "Cancel" : "+ New fee"}
        </button>
      </div>

      {msg && <div className={msg.kind === "ok" ? "set-ok" : "bp-error"} style={{ marginBottom: 12 }}>{msg.text}</div>}

      {open && (
        <div className="ao-form">
          <div className="ao-row2">
            <label className="set-field"><span>Name</span>
              <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Cleaning fee" /></label>
            <label className="set-field"><span>{f.basis === "percent" ? "Percent of the space price" : "Amount"}</span>
              <div className="fee-amt">
                <select value={f.basis} onChange={(e) => setF({ ...f, basis: e.target.value as "fixed" | "percent" })} aria-label="Fixed or percent">
                  <option value="fixed">$</option><option value="percent">%</option>
                </select>
                <input value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/[^0-9.]/g, "") })} placeholder={f.basis === "percent" ? "5" : "3.00"} inputMode="decimal" />
              </div></label>
          </div>
          <div className="ao-row2">
            <label className="set-field"><span>Charged</span>
              <select value={f.appliesTo} onChange={(e) => setF({ ...f, appliesTo: e.target.value as "checkout" | "item" })}>
                <option value="checkout">Once per order</option>
                <option value="item">Per item (× quantity)</option>
              </select></label>
            <label className="set-field"><span>When</span>
              <select value={f.trigger} onChange={(e) => setF({ ...f, trigger: e.target.value as NonNullable<StowboFee["trigger"]> })}>
                {TRIGGERS.map((t) => <option key={t.k} value={t.k}>{t.label}</option>)}
              </select></label>
          </div>
          <label className="set-field"><span>Description <em>(shown to the guest)</em></span>
            <textarea rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="What this fee covers." /></label>

          <button type="button" className="fee-more" onClick={() => setMore(!more)}>{more ? "− Fewer rules" : "+ Limits & rules"}</button>
          {more && (
            <div className="fee-rules">
              <div className="ao-row2">
                <label className="set-field"><span>Only when subtotal is at least <em>(0.01 = skip free orders)</em></span>
                  <input value={f.priceFrom} onChange={(e) => setF({ ...f, priceFrom: e.target.value.replace(/[^0-9.]/g, "") })} placeholder="0.01" inputMode="decimal" /></label>
                <label className="set-field"><span>…and at most</span>
                  <input value={f.priceTo} onChange={(e) => setF({ ...f, priceTo: e.target.value.replace(/[^0-9.]/g, "") })} placeholder="no limit" inputMode="decimal" /></label>
              </div>
              <div className="ao-row2">
                <label className="set-field"><span>Fee at least</span>
                  <input value={f.minFee} onChange={(e) => setF({ ...f, minFee: e.target.value.replace(/[^0-9.]/g, "") })} placeholder="—" inputMode="decimal" /></label>
                <label className="set-field"><span>Fee at most</span>
                  <input value={f.maxFee} onChange={(e) => setF({ ...f, maxFee: e.target.value.replace(/[^0-9.]/g, "") })} placeholder="—" inputMode="decimal" /></label>
              </div>
              <label className="set-field"><span>Who pays</span>
                <select value={f.paidBy} onChange={(e) => setF({ ...f, paidBy: e.target.value as "guest" | "host" })}>
                  <option value="guest">The guest (a line on their bill)</option>
                  <option value="host">Me (deducted from my payout)</option>
                </select></label>
              <div className="set-field"><span>Only these channels <em>(none = all)</em></span>
                <div className="fee-chips">
                  {CHANNELS.map((c) => <button type="button" key={c.k} className={`fee-chip${f.channels.includes(c.k) ? " on" : ""}`} onClick={() => toggleChannel(c.k)}>{c.label}</button>)}
                </div></div>
              <div className="ao-row2">
                <label className="set-field ao-check"><input type="checkbox" checked={f.taxable} onChange={(e) => setF({ ...f, taxable: e.target.checked })} /><span>Taxable</span></label>
                <label className="set-field ao-check"><input type="checkbox" checked={f.refundable} onChange={(e) => setF({ ...f, refundable: e.target.checked })} /><span>Refundable on cancellation</span></label>
              </div>
            </div>
          )}

          <button type="button" className="btn clay" disabled={pending || !f.title.trim()} onClick={create}>
            {pending ? "Saving…" : "Create fee"}
          </button>
        </div>
      )}

      {mine.length === 0 ? (
        <div className="ao-empty">
          <p>You haven’t created any fees yet.</p>
          <p className="muted">A booking fee, a cleaning fee, a late pick-up charge — define it once, apply it to any space.</p>
        </div>
      ) : (
        <div className="ao-list">
          {mine.map((e) => {
            const a = e.data ?? ({} as StowboFee);
            const active = on.includes(a.name);
            return (
              <div className={`ao-item${active ? " on" : ""}`} key={e.sk}>
                <label className="ao-pick">
                  <input type="checkbox" checked={active} disabled={pending} onChange={() => toggle(a.name)} />
                  <span className="ao-main">
                    <b>{a.title || a.name}{a.paidBy === "host" && <span className="addon-svc">you pay</span>}</b>
                    <span className="ao-desc">{describeFee(a, currency)}</span>
                    {a.description && <span className="ao-desc">{a.description}</span>}
                  </span>
                </label>
                <div className="ao-right">
                  <span className="ao-price">{a.basis === "percent" ? `${Number(a.amount ?? 0)}%` : formatMoney(Math.round(Number(a.amount ?? 0) * 100), currency)}<em>{a.appliesTo === "item" ? "/ item" : ""}</em></span>
                  <button type="button" className="ao-del" disabled={pending} onClick={() => remove(e.sk)} title="Retire this fee">Remove</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
