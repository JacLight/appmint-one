"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { routes } from "@/lib/nav";
import { createDiscountAction, updateDiscountAction } from "@/modules/rentals/actions/discounts-host";
import { formatMoney } from "@/lib/utils";
import { fmtDate } from "@/lib/dates";
import type { HostDiscount } from "@/api/rentals";
import { couponScope } from "@/modules/rentals/lib/coupons";
import type { Envelope } from "@/lib/api";

const blank = { code: "", name: "", description: "", type: "percent" as "percent" | "fixed", value: "", maxDiscount: "", minCartValue: "", firstOrderOnly: false, startDate: "", endDate: "", usageLimit: "", usageLimitPerCustomer: "", scope: "this" as "this" | "all" };

/** "10% off (at most $5) · min spend $20 · first booking only · until Sep 30 · 3/50 used" */
export function describeCoupon(d: HostDiscount, cur = "USD"): string {
  const money = (n: number) => formatMoney(Math.round(n * 100), cur);
  const bits = [d.type === "fixed" ? `${money(Number(d.value ?? 0))} off` : `${Number(d.value ?? 0)}% off${d.maxDiscount != null ? ` (at most ${money(Number(d.maxDiscount))})` : ""}`];
  if (d.minCartValue != null && Number(d.minCartValue) > 0) bits.push(`min spend ${money(Number(d.minCartValue))}`);
  if (d.firstOrderOnly) bits.push("first booking only");
  if (d.startDate) bits.push(`from ${fmtDate(d.startDate)}`);
  if (d.endDate) bits.push(`until ${fmtDate(d.endDate)}`);
  if (d.usageLimit != null) bits.push(`${d.usageCount ?? 0}/${d.usageLimit} used`);
  else if (d.usageCount) bits.push(`used ${d.usageCount}×`);
  return bits.join(" · ");
}

/** The host's coupon codes. A code is a storefront discount the server keeps inside this
 *  host's listings — it can never discount someone else's space. Guests type it on the
 *  listing, in the cart or at checkout; hosts can key it in on a walk-in or reservation. */
export function CouponsPanel({ listingName, listingTitle, mine, currency = "USD" }: {
  /** the listing this console is for — new coupons default to "this space only" */
  listingName: string;
  listingTitle?: string;
  mine: Envelope<HostDiscount>[];
  currency?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [open, setOpen] = useState(false);
  const [more, setMore] = useState(false);
  const [f, setF] = useState({ ...blank });

  const num = (v: string) => (v.trim() === "" ? undefined : Number(v));

  function create() {
    setMsg(null);
    start(async () => {
      const r = await createDiscountAction({
        code: f.code, name: f.name || undefined, description: f.description || undefined,
        type: f.type, value: Number(f.value || 0), maxDiscount: num(f.maxDiscount), minCartValue: num(f.minCartValue),
        firstOrderOnly: f.firstOrderOnly,
        startDate: f.startDate ? new Date(f.startDate).toISOString() : undefined,
        endDate: f.endDate ? new Date(f.endDate).toISOString() : undefined,
        usageLimit: num(f.usageLimit), usageLimitPerCustomer: num(f.usageLimitPerCustomer),
        listings: f.scope === "this" ? [listingName] : [],
      });
      if (r.ok) { setF({ ...blank }); setOpen(false); setMore(false); setMsg({ kind: "ok", text: "Coupon created — guests can use it now." }); router.refresh(); }
      else setMsg({ kind: "err", text: r.error });
    });
  }
  function toggle(e: Envelope<HostDiscount>) {
    const next = e.data?.status === "active" ? "inactive" : "active";
    start(async () => {
      const r = await updateDiscountAction(e.sk, { status: next });
      if (r.ok) { setMsg({ kind: "ok", text: next === "active" ? "Coupon switched on." : "Coupon paused — the code won’t work until you switch it back on." }); router.refresh(); }
      else setMsg({ kind: "err", text: r.error });
    });
  }

  const here = mine.filter((e) => { const l = couponScope(e.data); return l.length === 0 || l.includes(listingName); });
  const elsewhere = mine.filter((e) => !here.includes(e));

  return (
    <div className="ao-panel">
      <div className="ao-head">
        <div>
          <h3>Coupons</h3>
          <p className="ao-sub">Codes guests type on the listing, in the cart or at checkout — and you can key in at the counter. Discounts come off the space price before fees and tax, and only ever apply to your own spaces. <Link href={routes.hostCoupons}>Manage all coupons, usage &amp; stats →</Link></p>
        </div>
        <button type="button" className="btn clay sm" onClick={() => { setOpen(!open); setMsg(null); }}>
          {open ? "Cancel" : "+ New coupon"}
        </button>
      </div>

      {msg && <div className={msg.kind === "ok" ? "set-ok" : "bp-error"} style={{ marginBottom: 12 }}>{msg.text}</div>}

      {open && (
        <div className="ao-form">
          <div className="ao-row2">
            <label className="set-field"><span>Code <em>(3–24 letters, numbers, - or _)</em></span>
              <input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "") })} placeholder="SUMMER10" spellCheck={false} /></label>
            <label className="set-field"><span>{f.type === "percent" ? "Percent off" : "Amount off"}</span>
              <div className="fee-amt">
                <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as "percent" | "fixed" })} aria-label="Percent or fixed">
                  <option value="percent">%</option><option value="fixed">$</option>
                </select>
                <input value={f.value} onChange={(e) => setF({ ...f, value: e.target.value.replace(/[^0-9.]/g, "") })} placeholder={f.type === "percent" ? "10" : "5.00"} inputMode="decimal" />
              </div></label>
          </div>
          <div className="ao-row2">
            <label className="set-field"><span>Name <em>(shown on the bill)</em></span>
              <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Summer 10% off" /></label>
            <label className="set-field"><span>Applies to</span>
              <select value={f.scope} onChange={(e) => setF({ ...f, scope: e.target.value as "this" | "all" })}>
                <option value="this">{listingTitle ? `${listingTitle} only` : "This space only"}</option>
                <option value="all">All my spaces</option>
              </select></label>
          </div>

          <button type="button" className="fee-more" onClick={() => setMore(!more)}>{more ? "− Fewer rules" : "+ Limits & rules"}</button>
          {more && (
            <div className="fee-rules">
              <div className="ao-row2">
                {f.type === "percent" && <label className="set-field"><span>Discount at most</span>
                  <input value={f.maxDiscount} onChange={(e) => setF({ ...f, maxDiscount: e.target.value.replace(/[^0-9.]/g, "") })} placeholder="no cap" inputMode="decimal" /></label>}
                <label className="set-field"><span>Minimum spend</span>
                  <input value={f.minCartValue} onChange={(e) => setF({ ...f, minCartValue: e.target.value.replace(/[^0-9.]/g, "") })} placeholder="—" inputMode="decimal" /></label>
              </div>
              <div className="ao-row2">
                <label className="set-field"><span>Valid from</span><input type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></label>
                <label className="set-field"><span>Valid until</span><input type="date" value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} /></label>
              </div>
              <div className="ao-row2">
                <label className="set-field"><span>Total uses <em>(empty = unlimited)</em></span>
                  <input value={f.usageLimit} onChange={(e) => setF({ ...f, usageLimit: e.target.value.replace(/[^0-9]/g, "") })} placeholder="—" inputMode="numeric" /></label>
                <label className="set-field"><span>Uses per guest</span>
                  <input value={f.usageLimitPerCustomer} onChange={(e) => setF({ ...f, usageLimitPerCustomer: e.target.value.replace(/[^0-9]/g, "") })} placeholder="—" inputMode="numeric" /></label>
              </div>
              <label className="set-field ao-check"><input type="checkbox" checked={f.firstOrderOnly} onChange={(e) => setF({ ...f, firstOrderOnly: e.target.checked })} /><span>First booking only <em>(guests with a past booking can’t use it)</em></span></label>
              <label className="set-field"><span>Description <em>(for you)</em></span>
                <textarea rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Where you’re promoting this." /></label>
            </div>
          )}

          <button type="button" className="btn clay" disabled={pending || f.code.length < 3 || !(Number(f.value) > 0)} onClick={create}>
            {pending ? "Saving…" : "Create coupon"}
          </button>
        </div>
      )}

      {mine.length === 0 ? (
        <div className="ao-empty">
          <p>You haven’t created any coupons yet.</p>
          <p className="muted">A launch code, a repeat-guest thank-you, a slow-season nudge — set the rules and share the code.</p>
        </div>
      ) : (
        <>
          <div className="ao-list">
            {here.map((e) => <CouponRow key={e.sk} e={e} listingName={listingName} pending={pending} onToggle={() => toggle(e)} describe={(d) => describeCoupon(d, currency)} />)}
          </div>
          {elsewhere.length > 0 && (
            <>
              <p className="muted" style={{ fontSize: 12.5, margin: "14px 0 6px" }}>Your coupons for other spaces</p>
              <div className="ao-list">
                {elsewhere.map((e) => <CouponRow key={e.sk} e={e} listingName={listingName} pending={pending} onToggle={() => toggle(e)} describe={(d) => describeCoupon(d, currency)} />)}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function CouponRow({ e, listingName, pending, onToggle, describe }: {
  e: Envelope<HostDiscount>; listingName: string; pending: boolean; onToggle: () => void; describe: (d: HostDiscount) => string;
}) {
  const d = e.data ?? ({} as HostDiscount);
  const scope = couponScope(d);
  const active = d.status === "active";
  const scopeLabel = scope.length === 0 ? "all your spaces" : scope.length === 1 && scope[0] === listingName ? "this space" : `${scope.length} space${scope.length === 1 ? "" : "s"}`;
  return (
    <div className={`ao-item${active ? " on" : ""}`}>
      <div className="ao-pick" style={{ cursor: "default" }}>
        <span className="ao-main">
          <b><code className="cp-code">{d.code}</code>{d.name ? ` ${d.name}` : ""}{!active && <span className="addon-svc">{d.status === "inactive" ? "paused" : d.status}</span>}</b>
          <span className="ao-desc">{describe(d)} · {scopeLabel}</span>
          {d.description && <span className="ao-desc">{d.description}</span>}
        </span>
      </div>
      <div className="ao-right">
        <button type="button" className="ao-del" disabled={pending} onClick={onToggle}>{active ? "Pause" : "Switch on"}</button>
      </div>
    </div>
  );
}
