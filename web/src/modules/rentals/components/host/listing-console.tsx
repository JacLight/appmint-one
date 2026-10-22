"use client";

import { useState } from "react";
import Link from "next/link";
import { routes } from "@/lib/nav";
import { formatMoney } from "@/lib/utils";
import { ListingActions } from "@/modules/rentals/components/host/listing-actions";
import { BookingCalendar } from "@/modules/rentals/components/host/booking-calendar";
import type { Envelope } from "@/lib/api";
import type { StowboListing, StowboUnit, StowboBooking, StowboCalendar, StowboAddOn, StowboFee, HostDiscount } from "@/api/rentals";
import { couponScope } from "@/modules/rentals/lib/coupons";
import { AddonsPanel } from "@/modules/rentals/components/host/addons-panel";
import { FeesPanel } from "@/modules/rentals/components/host/fees-panel";
import { CouponsPanel } from "@/modules/rentals/components/host/coupons-panel";

const dFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
function d(v?: string) { if (!v) return null; const t = new Date(v); return isNaN(t.getTime()) ? null : t; }
function range(a?: string, b?: string) { const s = d(a), e = d(b); if (!s && !e) return "—"; if (s && e) return `${dFmt.format(s)} – ${dFmt.format(e)}`; return dFmt.format((s || e)!); }
function money(v?: number, cur = "USD") { return formatMoney(Number(v ?? 0) * 100, cur); }
function guestShort(g?: string) { if (!g) return "Guest"; const n = g.split("@")[0].replace(/[._]/g, " "); return n.charAt(0).toUpperCase() + n.slice(1); }

const STATUS_STYLE: Record<string, { bg: string; fg: string; border: string; label: string }> = {
  active: { bg: "var(--accent-soft)", fg: "var(--accent-strong)", border: "#bcd3b0", label: "Active" },
  draft: { bg: "var(--primary-soft)", fg: "var(--primary-strong)", border: "#ecd3c2", label: "Draft" },
  paused: { bg: "var(--primary-soft)", fg: "var(--primary-strong)", border: "#ecd3c2", label: "Paused" },
  inactive: { bg: "var(--border-2)", fg: "var(--muted)", border: "var(--border)", label: "Inactive" },
};
const BSTATUS: Record<string, { bg: string; fg: string }> = {
  settled: { bg: "var(--accent-soft)", fg: "var(--accent-strong)" }, in_custody: { bg: "var(--accent-soft)", fg: "var(--accent-strong)" },
  confirmed: { bg: "var(--primary-soft)", fg: "var(--primary-strong)" }, requested: { bg: "var(--border-2)", fg: "var(--muted)" },
  cancelled: { bg: "#fbe9e2", fg: "#a5401f" }, disputed: { bg: "#fbe9e2", fg: "#a5401f" },
};
function StatusBadge({ status }: { status?: string }) {
  const s = STATUS_STYLE[status || ""] || STATUS_STYLE.draft;
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: ".03em", textTransform: "uppercase", color: s.fg, background: s.bg, border: `1px solid ${s.border}`, borderRadius: 999, padding: "4px 12px" }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: s.fg }} />{s.label}</span>;
}
function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return <div className="tcard"><p className="eyebrow">{label}</p><div style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 700, marginTop: 4 }}>{value}</div>{sub && <p className="muted" style={{ fontSize: 12.5 }}>{sub}</p>}</div>;
}

type Bk = { sk: string; data: StowboBooking };

function BookingRow({ b, cur }: { b: Bk; cur: string }) {
  const first = b.data?.items?.[0];
  const bst = BSTATUS[b.data?.status || ""] || BSTATUS.requested;
  return (
    <Link href={`/host/custody/${b.data?.name || b.sk}`} className="tcard" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
      <div style={{ minWidth: 0 }}>
        <b style={{ fontFamily: "var(--font-display)" }}>{guestShort(b.data?.customer)}</b>
        <div className="muted" style={{ fontSize: 13 }}>{range(first?.startDate, first?.endDate)}{first?.quantity ? ` · qty ${first.quantity}` : ""}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flex: "none" }}>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>{money(b.data?.total, b.data?.currency || cur)}</span>
        <span className="fpill" style={{ fontSize: 11, color: bst.fg, background: bst.bg, border: 0 }}>{(b.data?.status || "").replace(/_/g, " ")}</span>
      </div>
    </Link>
  );
}

export function ListingConsole({ id, l, units, bookings, calendar, myAddons, addonsSupported = true, myFees, feesSupported = true, myDiscounts, discountsSupported = true }: {
  id: string; l: StowboListing; units: Envelope<StowboUnit>[]; bookings: Bk[]; calendar: StowboCalendar | null;
  myAddons?: Envelope<StowboAddOn>[];
  /** false when this backend has no add-on routes — hide the tab instead of showing a dead one. */
  addonsSupported?: boolean;
  myFees?: Envelope<StowboFee>[];
  feesSupported?: boolean;
  myDiscounts?: Envelope<HostDiscount>[];
  discountsSupported?: boolean;
}) {
  const [tab, setTab] = useState<"overview" | "calendar" | "bookings" | "units" | "addons" | "fees" | "coupons">("overview");
  const cur = bookings[0]?.data?.currency || "USD";
  const revenue = bookings.reduce((s, b) => s + Number(b.data?.total ?? 0), 0);
  const inCustody = bookings.reduce((n, b) => n + ((b.data?.items ?? []).filter((it) => it.state === "stored").length), 0);
  const addr = l?.address;
  const addrLine = [addr?.street1, addr?.city, addr?.state].filter(Boolean).join(", ") || "Address private until a booking is confirmed";
  const upcoming = (calendar?.upcoming ?? []).slice(0, 4);

  const feeNames = (Array.isArray(l?.fees) ? (l!.fees as unknown[]) : []).filter((x): x is string => typeof x === "string");
  // Active coupons that reach this space (scoped to it, or to all of the host's spaces).
  const couponsHere = (myDiscounts ?? []).filter((e) => e.data?.status === "active" && (couponScope(e.data).length === 0 || couponScope(e.data).includes(l?.name))).length;
  const TABS = [
    { k: "overview", label: "Overview" },
    { k: "calendar", label: "Calendar" },
    { k: "bookings", label: `Bookings${bookings.length ? ` (${bookings.length})` : ""}` },
    { k: "units", label: `Units${units.length ? ` (${units.length})` : ""}` },
    ...(addonsSupported ? [{ k: "addons", label: `Add-ons${(l?.addOns ?? []).length ? ` (${(l!.addOns ?? []).length})` : ""}` }] : []),
    // Only NAME entries count — an older listing may still carry legacy fee objects the server ignores.
    ...(feesSupported ? [{ k: "fees", label: `Fees${feeNames.length ? ` (${feeNames.length})` : ""}` }] : []),
    ...(discountsSupported ? [{ k: "coupons", label: `Coupons${couponsHere ? ` (${couponsHere})` : ""}` }] : []),
  ] as const;

  return (
    <div>
      <style>{`.lc-seg{display:flex;gap:4px;background:var(--bg-2);border-radius:13px;padding:4px;margin:0 0 20px;overflow-x:auto}
        .lc-seg button{flex:1 1 0;min-width:max-content;border:0;background:none;cursor:pointer;padding:10px 12px;border-radius:9px;font-family:var(--font-display);font-weight:600;font-size:14px;color:var(--text-2);white-space:nowrap;transition:.12s}
        .lc-seg button.on{background:var(--surface);color:var(--text);box-shadow:0 1px 2px rgba(0,0,0,.07)}
        .lc-seg::-webkit-scrollbar{height:0}`}</style>

      {/* header / status — always visible */}
      <div className="tcard" style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <div>
            <StatusBadge status={l?.status} />
            <div style={{ marginTop: 10, fontFamily: "var(--font-display)", fontWeight: 600, color: "var(--text-2)" }}>{addrLine}</div>
            <div className="muted" style={{ fontSize: 13.5, marginTop: 4 }}>
              {(l?.spaceType || "space").replace(/-/g, " ")}{l?.accessHours ? ` · ${l.accessHours}` : ""}{l?.staffing ? ` · ${l.staffing}` : ""}
            </div>
          </div>
        </div>
        <ListingActions id={id} status={l?.status} />
      </div>

      {/* section switcher — segmented control (works on mobile + desktop) */}
      <div className="lc-seg" role="tablist">
        {TABS.map((t) => <button key={t.k} role="tab" aria-selected={tab === t.k} className={tab === t.k ? "on" : ""} onClick={() => setTab(t.k as any)}>{t.label}</button>)}
      </div>

      {/* OVERVIEW */}
      {tab === "overview" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 14, marginBottom: 24 }}>
            <Stat label="Price" value={l?.price != null ? `$${l.price}` : "—"} sub={l?.price != null ? `per ${l.priceUnit || "day"}` : "no price set"} />
            <Stat label="Capacity" value={l?.capacity ?? 1} sub={l?.size || "units / slots"} />
            <Stat label="Units" value={units.length} sub="physical units" />
            <Stat label="Bookings" value={bookings.length} sub="all time" />
            <Stat label="Revenue" value={money(revenue, cur)} sub="booked value" />
            <Stat label="In custody now" value={inCustody} sub="items stored" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 20 }}>
            <div>
              <h3 style={{ fontSize: 16, marginBottom: 10 }}>Coming up</h3>
              {upcoming.length === 0 ? (
                <div className="tcard"><p className="muted" style={{ margin: 0 }}>No reservations scheduled.</p></div>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {upcoming.map((u, i) => (
                    <Link key={i} href={`/host/custody/${u.booking}`} className="tcard" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                      <div><b style={{ fontFamily: "var(--font-display)" }}>{guestShort(u.guest)}</b><div className="muted" style={{ fontSize: 13 }}>{range(u.startDate, u.endDate)}{u.unit ? ` · ${u.unit}` : ""}{u.quantity && u.quantity > 1 ? ` · ×${u.quantity}` : ""}</div></div>
                      <span className="fpill" style={{ fontSize: 11 }}>{u.state}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <div>
              <h3 style={{ fontSize: 16, marginBottom: 10 }}>Recent bookings</h3>
              {bookings.length === 0 ? (
                <div className="tcard"><p className="muted" style={{ margin: 0 }}>No bookings yet.</p></div>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>{bookings.slice(0, 3).map((b) => <BookingRow key={b.sk} b={b} cur={cur} />)}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CALENDAR */}
      {tab === "calendar" && (calendar ? <BookingCalendar id={id} initial={calendar} /> : <div className="tcard"><p className="muted" style={{ margin: 0 }}>Calendar unavailable.</p></div>)}

      {/* BOOKINGS */}
      {tab === "bookings" && (
        bookings.length === 0
          ? <div className="tcard"><p className="muted" style={{ margin: 0 }}>No bookings yet. Once it&apos;s live in Browse, reservations show up here.</p></div>
          : <div style={{ display: "grid", gap: 10 }}>{bookings.map((b) => <BookingRow key={b.sk} b={b} cur={cur} />)}</div>
      )}

      {/* UNITS */}
      {tab === "units" && (
        units.length === 0
          ? <div className="tcard"><p className="muted" style={{ margin: 0 }}>No physical units — this space books against its capacity of {l?.capacity ?? 1}. Add numbered units under <Link href={`${routes.hostListing(id)}/edit`} style={{ color: "var(--primary)", fontWeight: 600 }}>Edit</Link> if you track individual doors/spots.</p></div>
          : <div style={{ display: "grid", gap: 10 }}>{units.map((u) => (
              <div key={u.sk} className="tcard" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
                <b style={{ fontFamily: "var(--font-display)" }}>{u.data?.unitNumber || "Unit"}</b>
                <span className="fpill on" style={{ fontSize: 12 }}>{u.data?.status || "vacant"}</span>
              </div>
            ))}</div>
      )}

      {tab === "addons" && (
        <AddonsPanel listingId={id} mine={myAddons ?? []} attached={l?.addOns ?? []} />
      )}

      {tab === "fees" && (
        <FeesPanel listingId={id} mine={myFees ?? []} attached={feeNames} currency={cur} />
      )}

      {tab === "coupons" && (
        <CouponsPanel listingName={l?.name} listingTitle={l?.title} mine={myDiscounts ?? []} currency={cur} />
      )}
    </div>
  );
}
