"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createDiscountAction, updateDiscountAction } from "@/modules/rentals/actions/discounts-host";
import { describeCoupon } from "@/modules/rentals/components/host/coupons-panel";
import { couponScope } from "@/modules/rentals/lib/coupons";
import { formatMoney } from "@/lib/utils";
import { fmtDate } from "@/lib/dates";
import { routes } from "@/lib/nav";
import type { HostDiscount } from "@/api/rentals";
import type { Envelope } from "@/lib/api";

export type ScopeListing = { code: string; title: string; status?: string };
export type CouponStats = { bookings: number; discounted: number; revenue: number; lastUsed: string | null; released: number };
export type Redemption = { booking: string; reference: string | null; customer: string | null; listingTitle: string | null; status: string; discount: number; total: number; at: string | null };

const blank = { code: "", name: "", description: "", type: "percent" as "percent" | "fixed", value: "", maxDiscount: "", minCartValue: "", firstOrderOnly: false, startDate: "", endDate: "", usageLimit: "", usageLimitPerCustomer: "", scope: [] as string[] };
const toDateInput = (iso?: string | null) => (iso ? String(iso).slice(0, 10) : "");

/** Every coupon the host owns, with live usage, and the controls: switch on/off, retire,
 *  edit the rules, and pick exactly which spaces each code reaches. The server owns the
 *  scope rule (a code never leaves this host's listings); this screen only says which. */
export function CouponsManager({ mine, listings, stats, redemptions = {}, statsAvailable, currency = "USD" }: {
  mine: Envelope<HostDiscount>[];
  listings: ScopeListing[];
  stats: Record<string, CouponStats>;
  redemptions?: Record<string, Redemption[]>;
  statsAvailable: boolean;
  currency?: string;
}) {
  const [usersOpen, setUsersOpen] = useState<string | null>(null); // code whose "who used it" list is open
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null); // sk of the coupon whose drawer is open
  const [f, setF] = useState({ ...blank });
  const [filter, setFilter] = useState<"all" | "active" | "off">("all");

  const money = (n: number) => formatMoney(Math.round(n * 100), currency);
  const num = (v: string) => (v.trim() === "" ? null : Number(v));
  const titleOf = (code: string) => listings.find((l) => l.code === code)?.title || code;

  function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>, done: string, after?: () => void) {
    setMsg(null);
    start(async () => {
      const r = await fn();
      if (r.ok) { setMsg({ kind: "ok", text: done }); after?.(); router.refresh(); }
      else setMsg({ kind: "err", text: r.error });
    });
  }

  const payload = (v: typeof f) => ({
    name: v.name || undefined, description: v.description || undefined,
    type: v.type, value: Number(v.value || 0), maxDiscount: v.type === "percent" ? num(v.maxDiscount) : null, minCartValue: num(v.minCartValue),
    firstOrderOnly: v.firstOrderOnly,
    startDate: v.startDate ? new Date(v.startDate).toISOString() : null,
    endDate: v.endDate ? new Date(`${v.endDate}T23:59:59`).toISOString() : null,
    usageLimit: num(v.usageLimit), usageLimitPerCustomer: num(v.usageLimitPerCustomer),
    listings: v.scope,
  });

  function openEdit(e: Envelope<HostDiscount>) {
    const d = e.data ?? ({} as HostDiscount);
    setF({
      code: d.code || "", name: d.name || "", description: d.description || "", type: (d.type as "percent" | "fixed") || "percent",
      value: d.value != null ? String(d.value) : "", maxDiscount: d.maxDiscount != null ? String(d.maxDiscount) : "", minCartValue: d.minCartValue != null ? String(d.minCartValue) : "",
      firstOrderOnly: !!d.firstOrderOnly, startDate: toDateInput(d.startDate), endDate: toDateInput(d.endDate),
      usageLimit: d.usageLimit != null ? String(d.usageLimit) : "", usageLimitPerCustomer: d.usageLimitPerCustomer != null ? String(d.usageLimitPerCustomer) : "",
      scope: couponScope(d),
    });
    setEditing(e.sk); setCreating(false); setMsg(null);
  }
  const toggleScope = (code: string) => setF((s) => ({ ...s, scope: s.scope.includes(code) ? s.scope.filter((c) => c !== code) : [...s.scope, code] }));

  const shown = mine.filter((e) => filter === "all" ? true : filter === "active" ? e.data?.status === "active" : e.data?.status !== "active");
  const totals = mine.reduce((t, e) => { const s = stats[(e.data?.code || "").toUpperCase()]; if (s) { t.bookings += s.bookings; t.discounted += s.discounted; t.revenue += s.revenue; } return t; }, { bookings: 0, discounted: 0, revenue: 0 });
  const editingRec = editing ? mine.find((e) => e.sk === editing) : null;

  // A render helper, NOT a nested component: a component defined inside render would
  // remount (and lose focus in) every input on each keystroke.
  const renderForm = (mode: "create" | "edit") => (
    <div className="ao-form">
      <div className="ao-row2">
        <label className="set-field"><span>Code {mode === "edit" && <em>(can’t change — retire and make a new one)</em>}</span>
          <input value={f.code} disabled={mode === "edit"} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "") })} placeholder="SUMMER10" spellCheck={false} /></label>
        <label className="set-field"><span>{f.type === "percent" ? "Percent off" : "Amount off"}</span>
          <div className="fee-amt">
            <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as "percent" | "fixed" })} aria-label="Percent or fixed"><option value="percent">%</option><option value="fixed">$</option></select>
            <input value={f.value} onChange={(e) => setF({ ...f, value: e.target.value.replace(/[^0-9.]/g, "") })} placeholder={f.type === "percent" ? "10" : "5.00"} inputMode="decimal" />
          </div></label>
      </div>
      <label className="set-field"><span>Name <em>(shown on the guest’s bill)</em></span>
        <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Summer 10% off" /></label>

      <div className="set-field">
        <span>Spaces this code works on <em>(none ticked = every space you have, now or later)</em></span>
        <div className="cpm-scope">
          {listings.map((l) => (
            <label key={l.code} className={`cpm-scope-item${f.scope.includes(l.code) ? " on" : ""}`}>
              <input type="checkbox" checked={f.scope.includes(l.code)} onChange={() => toggleScope(l.code)} />
              <span>{l.title}{l.status && l.status !== "active" ? <em> · {l.status}</em> : null}</span>
            </label>
          ))}
          {listings.length === 0 && <p className="muted" style={{ margin: 0 }}>No listings yet.</p>}
        </div>
        <p className="muted" style={{ fontSize: 12.5, margin: "6px 0 0" }}>{f.scope.length === 0 ? "Applies to all your spaces." : `Applies to ${f.scope.length} space${f.scope.length === 1 ? "" : "s"}.`}</p>
      </div>

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
        <label className="set-field ao-check"><input type="checkbox" checked={f.firstOrderOnly} onChange={(e) => setF({ ...f, firstOrderOnly: e.target.checked })} /><span>First booking only</span></label>
        <label className="set-field"><span>Notes <em>(for you)</em></span>
          <textarea rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Where you’re promoting this." /></label>
      </div>

      <div className="ht-form-row">
        {mode === "create" ? (
          <button type="button" className="btn clay" disabled={pending || f.code.length < 3 || !(Number(f.value) > 0)} onClick={() => run(() => createDiscountAction({ code: f.code, ...payload(f) }), "Coupon created — guests can use it now.", () => { setF({ ...blank }); setCreating(false); })}>
            {pending ? "Saving…" : "Create coupon"}
          </button>
        ) : (
          <button type="button" className="btn clay" disabled={pending || !(Number(f.value) > 0) || !editing} onClick={() => run(() => updateDiscountAction(editing!, payload(f)), "Coupon updated.", () => setEditing(null))}>
            {pending ? "Saving…" : "Save changes"}
          </button>
        )}
        <button type="button" className="btn ghost" disabled={pending} onClick={() => { setCreating(false); setEditing(null); }}>Cancel</button>
      </div>
    </div>
  );

  return (
    <div>
      <div className="cpm-stats">
        <div className="tcard"><p className="eyebrow">Coupons</p><div className="earn-stat">{mine.length}</div><p className="muted" style={{ fontSize: 12.5, margin: 0 }}>{mine.filter((e) => e.data?.status === "active").length} live</p></div>
        <div className="tcard"><p className="eyebrow">Bookings with a code</p><div className="earn-stat">{statsAvailable ? totals.bookings : "—"}</div><p className="muted" style={{ fontSize: 12.5, margin: 0 }}>{statsAvailable ? "cancelled ones not counted" : "needs the latest server"}</p></div>
        <div className="tcard"><p className="eyebrow">Given away</p><div className="earn-stat">{statsAvailable ? money(totals.discounted) : "—"}</div><p className="muted" style={{ fontSize: 12.5, margin: 0 }}>total taken off bills</p></div>
        <div className="tcard"><p className="eyebrow">Booked with codes</p><div className="earn-stat">{statsAvailable ? money(totals.revenue) : "—"}</div><p className="muted" style={{ fontSize: 12.5, margin: 0 }}>bill totals after the discount</p></div>
      </div>

      <div className="cpm-bar">
        <div className="lc-seg cpm-filter" role="tablist">
          {(["all", "active", "off"] as const).map((k) => <button key={k} role="tab" aria-selected={filter === k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>{k === "all" ? "All" : k === "active" ? "Live" : "Paused"}</button>)}
        </div>
        <button type="button" className="btn clay sm" onClick={() => { setCreating(!creating); setEditing(null); setF({ ...blank }); setMsg(null); }}>{creating ? "Cancel" : "+ New coupon"}</button>
      </div>

      {msg && <div className={msg.kind === "ok" ? "set-ok" : "bp-error"} style={{ marginBottom: 12 }}>{msg.text}</div>}
      {creating && <div className="tcard" style={{ marginBottom: 16 }}><h3 style={{ marginTop: 0 }}>New coupon</h3>{renderForm("create")}</div>}

      {shown.length === 0 ? (
        <div className="tcard ao-empty" style={{ textAlign: "center" }}>
          <p>{mine.length === 0 ? "You haven’t created any coupons yet." : "Nothing in this view."}</p>
          {mine.length === 0 && <p className="muted">A launch code, a repeat-guest thank-you, a slow-season nudge — set the rules and share the code.</p>}
        </div>
      ) : (
        <div className="cpm-list">
          {shown.map((e) => {
            const d = e.data ?? ({} as HostDiscount);
            const code = (d.code || "").toUpperCase();
            const s = stats[code];
            const scope = couponScope(d);
            const active = d.status === "active";
            const retired = d.status === "retired";
            const isOpen = editing === e.sk;
            return (
              <div className={`tcard cpm-row${active ? "" : " off"}`} key={e.sk}>
                <div className="cpm-head">
                  <div className="cpm-main">
                    <div className="cpm-title"><code className="cp-code">{d.code}</code><b>{d.name || ""}</b>
                      <span className={`hp-pill ${active ? "ok" : "off"}`}>{active ? "Live" : retired ? "Retired" : d.status === "inactive" ? "Paused" : d.status}</span>
                    </div>
                    <div className="cpm-rule">{describeCoupon(d, currency)}</div>
                    <div className="cpm-scope-line">
                      {scope.length === 0 ? <span>All your spaces</span> : scope.map((c) => <span className="cpm-chip" key={c}>{titleOf(c)}</span>)}
                    </div>
                  </div>
                  <div className="cpm-usage">
                    <div><b>{d.usageCount ?? 0}</b><span>redeemed{d.usageLimit != null ? ` of ${d.usageLimit}` : ""}</span></div>
                    {statsAvailable && s ? (
                      <>
                        <div><b>{s.bookings}</b><span>booking{s.bookings === 1 ? "" : "s"}</span></div>
                        <div><b>{money(s.discounted)}</b><span>given away</span></div>
                        <div><b>{money(s.revenue)}</b><span>booked</span></div>
                        {s.lastUsed && <div><b>{fmtDate(s.lastUsed)}</b><span>last used</span></div>}
                      </>
                    ) : statsAvailable ? <div><b>0</b><span>bookings</span></div> : null}
                  </div>
                </div>
                {!retired && (
                  <div className="cpm-actions">
                    {(redemptions[code]?.length ?? 0) > 0 && (
                      <button type="button" className="ht-link" onClick={() => setUsersOpen(usersOpen === code ? null : code)}>{usersOpen === code ? "Hide who used it" : `Who used it (${redemptions[code].length})`}</button>
                    )}
                    <button type="button" className="ht-link" disabled={pending} onClick={() => (isOpen ? setEditing(null) : openEdit(e))}>{isOpen ? "Close" : "Edit rules & spaces"}</button>
                    {/* The server's "retire" is the same write as pause (status → inactive), so one
                        control: a paused code stops working immediately and keeps its history. */}
                    <button type="button" className="ht-link" disabled={pending} onClick={() => run(() => updateDiscountAction(e.sk, { status: active ? "inactive" : "active" }), active ? "Coupon paused — the code stops working until you switch it back on." : "Coupon switched on.")}>{active ? "Pause" : "Switch on"}</button>
                  </div>
                )}
                {usersOpen === code && (
                  <div className="cpm-users">
                    <div className="cpm-users-hd"><span>When</span><span>Guest</span><span>Space</span><span>Status</span><span className="r">Off the bill</span><span className="r">Paid total</span></div>
                    {redemptions[code].map((u) => (
                      <Link key={u.booking} href={`${routes.hostCustody}/${u.booking}`} className={`cpm-user${["cancelled", "no_show"].includes(u.status) ? " off" : ""}`}>
                        <span>{u.at ? fmtDate(u.at) : "—"}</span>
                        <span className="cpm-user-guest">{u.customer || "Guest"}{u.reference ? <em> #{u.reference}</em> : null}</span>
                        <span>{u.listingTitle || "—"}</span>
                        <span><span className={`hp-pill ${["cancelled", "no_show"].includes(u.status) ? "off" : "ok"}`}>{u.status.replace(/_/g, " ")}</span></span>
                        <span className="r">{u.discount ? `−${money(u.discount)}` : "—"}</span>
                        <span className="r">{money(u.total)}</span>
                      </Link>
                    ))}
                  </div>
                )}
                {isOpen && editingRec && renderForm("edit")}
              </div>
            );
          })}
        </div>
      )}
      <p className="muted" style={{ fontSize: 12.5, marginTop: 14 }}>Guests type a code on the <Link href={routes.browse}>listing</Link>, in the cart or at checkout; you can key one in when taking someone in. Amounts come off the space price before fees and tax, and a code only ever applies to your own spaces.</p>
    </div>
  );
}
