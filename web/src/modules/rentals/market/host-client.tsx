"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ClientCfg } from "./config";
import { blockDatesAction, listingStatusAction, saveMarketListingAction, unblockAction, type MarketListingForm } from "./actions";
import { uploadPhotoAction } from "@/modules/rentals/actions/host";
import { I } from "./icons";
import { addDays, money } from "./shared";

export function StatusToggle({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const live = status === "active";
  return (
    <button type="button" className="mk-btn sm quiet" disabled={busy} onClick={async () => {
      setBusy(true); await listingStatusAction(id, live ? "paused" : "active"); setBusy(false); router.refresh();
    }}>{busy ? "…" : live ? "Pause" : "Publish"}</button>
  );
}

export interface HCalDay { date: string; state: "free" | "booked" | "blocked" | "past"; guest?: string; booking?: string; blackout?: string }

/** Month grid: booked nights show the guest, blocked nights are hatched; pick a range to block. */
export function HostCalendar({ listingId, days, lead, price, unit }: { listingId: string; days: HCalDay[]; lead: number; price: number | null; unit: string }) {
  const router = useRouter();
  const [a, setA] = useState<string | null>(null);
  const [b, setB] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const byDate = useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);
  const lo = a && b ? (a < b ? a : b) : a;
  const hi = a && b ? (a < b ? b : a) : a;
  const sel = (d: string) => !!lo && !!hi && d >= lo && d <= hi;
  const selBlack = lo && lo === hi ? byDate.get(lo)?.blackout : undefined;

  function click(d: HCalDay) {
    if (d.state === "past") return;
    setMsg(null);
    if (!a || (a && b)) { setA(d.date); setB(null); } else setB(d.date);
  }
  async function block() {
    if (!lo || !hi) return;
    setBusy(true);
    const r = await blockDatesAction(listingId, `${lo}T06:00:00.000Z`, `${addDays(hi, 1)}T05:00:00.000Z`, "Blocked by host");
    setBusy(false);
    if (!r.ok) { setMsg(r.error || "Could not block."); return; }
    setMsg(r.conflicts ? `Blocked — note ${r.conflicts} existing booking${r.conflicts === 1 ? "" : "s"} overlap and still stand.` : "Blocked.");
    setA(null); setB(null); router.refresh();
  }
  async function unblock(id: string) {
    setBusy(true);
    const r = await unblockAction(listingId, id);
    setBusy(false);
    if (!r.ok) { setMsg(r.error || "Could not unblock."); return; }
    setMsg("Opened up again."); setA(null); setB(null); router.refresh();
  }

  return (
    <div className="mk-hcal">
      <div className="mk-hcal-grid">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="mk-cal-dow">{d}</div>)}
        {Array.from({ length: lead }, (_, i) => <div key={`e${i}`} className="mk-hcal-day empty" />)}
        {days.map((d) => (
          <button type="button" key={d.date} className={`mk-hcal-day ${d.state}${sel(d.date) ? " sel" : ""}`} onClick={() => click(d)} disabled={d.state === "past"}>
            <span>{Number(d.date.slice(8, 10))}</span>
            {d.state === "booked" && <span className="g">{d.guest || "Booked"}</span>}
            {d.state === "blocked" && <span className="g" style={{ color: "var(--muted)" }}>Blocked</span>}
            {d.state === "free" && price != null && <span className="p">{money(price)}</span>}
          </button>
        ))}
      </div>
      <div className="mk-hcal-legend">
        <span><i style={{ background: "var(--primary-soft)" }} />Booked</span>
        <span><i style={{ background: "repeating-linear-gradient(-45deg,#f3f3f3,#f3f3f3 3px,#e3e3e3 3px,#e3e3e3 6px)" }} />Blocked</span>
        <span><i />Open at {price != null ? `${money(price)} / ${unit}` : "your rate"}</span>
      </div>
      {(lo || msg) && (
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginTop: 16 }}>
          {lo && !selBlack && <button type="button" className="mk-btn" disabled={busy} onClick={block}>{busy ? "Saving…" : lo === hi ? `Block ${shortDay(lo)}` : `Block ${shortDay(lo)} – ${shortDay(hi!)}`}</button>}
          {selBlack && <button type="button" className="mk-btn ghost" disabled={busy} onClick={() => unblock(selBlack)}>{busy ? "Saving…" : "Unblock these dates"}</button>}
          {lo && <button type="button" className="mk-link" onClick={() => { setA(null); setB(null); }}>Clear</button>}
          {msg && <span className="mk-muted" style={{ fontSize: 14 }}>{msg}</span>}
          {!lo && !msg ? null : !b && lo && !selBlack ? <span className="mk-muted" style={{ fontSize: 13.5 }}>Tap another day to block a range.</span> : null}
        </div>
      )}
    </div>
  );
}

const US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC"];

/** Create / edit a stay or rental listing — every field the guest page shows. */
export function ListingEditor({ cfg, vertical, market, initial, id }: { cfg: ClientCfg; vertical: string; market?: string; initial: MarketListingForm; id: string | null }) {
  const router = useRouter();
  const [f, setF] = useState<MarketListingForm>(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [upl, setUpl] = useState(false);
  const [rules, setRules] = useState((initial.details.houseRules || []).join("\n"));
  const [includes, setIncludes] = useState((initial.details.includes || []).join("\n"));
  const set = (patch: Partial<MarketListingForm>) => setF((x) => ({ ...x, ...patch }));
  const setD = (patch: Record<string, any>) => setF((x) => ({ ...x, details: { ...x.details, ...patch } }));
  const stays = cfg.experience === "stays";
  const n = (v: string) => (v === "" ? 0 : Number(v));
  // Rooms, rules and the kit list live in the listing's `details`, which the engine
  // takes when a listing is created; its host edit route doesn't change them.
  const fixed = !!id;
  const fixedNote = fixed ? <p className="mk-muted" style={{ fontSize: 13.5 }}>These are fixed once the listing is published.</p> : null;

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setUpl(true); setErr(null);
    const urls: string[] = [];
    for (const file of Array.from(files).slice(0, 12)) {
      const fd = new FormData(); fd.set("file", file);
      const r = await uploadPhotoAction(fd);
      if (r.ok && r.file.url) urls.push(r.file.url); else if (!r.ok) setErr(r.error);
    }
    setUpl(false);
    set({ images: [...f.images, ...urls] });
  }

  async function save() {
    setBusy(true); setErr(null); setOk(null);
    const body: MarketListingForm = {
      ...f, vertical, market,
      details: { ...f.details, ...(stays ? { houseRules: rules.split("\n").map((s: string) => s.trim()).filter(Boolean), minNights: f.minimum } : { includes: includes.split("\n").map((s: string) => s.trim()).filter(Boolean) }) },
    };
    const r = await saveMarketListingAction(id, body);
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    setOk("Saved.");
    if (!id) router.push(`/host/listings/${r.id}/edit?created=1`); else router.refresh();
  }

  return (
    <div className="mk-form" style={{ maxWidth: 820 }}>
      <div className="mk-box">
        <h2>The basics</h2>
        <div className="mk-form">
          <label>Title <input className="mk-in" value={f.title} maxLength={70} onChange={(e) => set({ title: e.target.value })} placeholder={stays ? "Kestrel Ridge A-Frame" : "Sony FX3 Cinema Kit"} /></label>
          <div className="two">
            <label>Type
              <select value={f.spaceType} onChange={(e) => set({ spaceType: e.target.value })}>
                {cfg.types.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </label>
            {stays ? <label>What guests will call it <small>e.g. A-frame, log cabin, loft</small><input className="mk-in" disabled={fixed} value={f.details.propertyType || ""} onChange={(e) => setD({ propertyType: e.target.value })} /></label>
              : <label>Condition <input className="mk-in" disabled={fixed} value={f.details.condition || ""} onChange={(e) => setD({ condition: e.target.value })} placeholder="Excellent" /></label>}
          </div>
          {!stays && (
            <div className="two">
              <label>Brand <input className="mk-in" disabled={fixed} value={f.details.brand || ""} onChange={(e) => setD({ brand: e.target.value })} /></label>
              <label>Model <input className="mk-in" disabled={fixed} value={f.details.model || ""} onChange={(e) => setD({ model: e.target.value })} /></label>
            </div>
          )}
          <label>Description <textarea className="mk-ta" style={{ minHeight: 160 }} value={f.description} onChange={(e) => set({ description: e.target.value })} /></label>
        </div>
      </div>

      <div className="mk-box">
        <h2>Photos</h2>
        <div className="mk-photos">
          {f.images.map((u, i) => (
            <div key={u + i}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u.replace("w=1600", "w=400")} alt="" />
              <button type="button" aria-label="Remove photo" onClick={() => set({ images: f.images.filter((_, k) => k !== i) })}>✕</button>
            </div>
          ))}
          <label style={{ display: "grid", placeItems: "center", aspectRatio: "4/3", border: "1.5px dashed #b0b3b6", borderRadius: 10, cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
            {upl ? "Uploading…" : "+ Add photos"}
            <input type="file" accept="image/*" multiple hidden onChange={(e) => addFiles(e.target.files)} />
          </label>
        </div>
        <p className="mk-muted" style={{ fontSize: 13.5, marginTop: 8 }}>The first photo is your cover. Bright, wide shots of the outside and the main room work best.</p>
      </div>

      <div className="mk-box">
        <h2>{stays ? "Location" : "Pick-up location"}</h2>
        <div className="mk-form">
          <label>Street address <input className="mk-in" value={f.address.street1 || ""} onChange={(e) => set({ address: { ...f.address, street1: e.target.value } })} /></label>
          <div className="three">
            <label>City <input className="mk-in" value={f.address.city || ""} onChange={(e) => set({ address: { ...f.address, city: e.target.value } })} /></label>
            <label>State <select value={f.address.state || ""} onChange={(e) => set({ address: { ...f.address, state: e.target.value } })}><option value="">—</option>{US_STATES.map((s) => <option key={s}>{s}</option>)}</select></label>
            <label>ZIP <input className="mk-in" value={f.address.zip || ""} onChange={(e) => set({ address: { ...f.address, zip: e.target.value } })} /></label>
          </div>
          {!stays && <label>Pick-up details <input className="mk-in" disabled={fixed} value={f.details.pickup || ""} onChange={(e) => setD({ pickup: e.target.value })} placeholder="Deep Ellum studio, weekdays 9–6" /></label>}
          <p className="mk-muted" style={{ fontSize: 13.5 }}>{stays ? "Guests see the town on the map; the street address is shared once they book." : "Renters see the area; the exact address is shared once they book."}</p>
        </div>
      </div>

      <div className="mk-box">
        <h2>{stays ? "Rooms and guests" : "What's included"}</h2>
        {fixedNote}
        {stays ? (
          <div className="mk-form">
            <div className="four">
              {(["sleeps", "bedrooms", "beds", "baths"] as const).map((k) => (
                <label key={k}>{k === "sleeps" ? "Guests" : k[0].toUpperCase() + k.slice(1)}<input className="mk-in" disabled={fixed} inputMode="decimal" value={f.details[k] ?? ""} onChange={(e) => setD({ [k]: n(e.target.value.replace(/[^0-9.]/g, "")) })} /></label>
              ))}
            </div>
            <div className="two">
              <label>Check-in from <input className="mk-in" disabled={fixed} value={f.details.checkIn || ""} onChange={(e) => setD({ checkIn: e.target.value })} placeholder="4:00 PM" /></label>
              <label>Checkout by <input className="mk-in" disabled={fixed} value={f.details.checkOut || ""} onChange={(e) => setD({ checkOut: e.target.value })} placeholder="10:00 AM" /></label>
            </div>
            <label style={{ display: "flex", gap: 10, alignItems: "center", fontWeight: 500 }}><input type="checkbox" disabled={fixed} checked={f.details.pets !== false} onChange={(e) => setD({ pets: e.target.checked })} /> Pets allowed</label>
            <label>House rules <small>one per line</small><textarea className="mk-ta" disabled={fixed} value={rules} onChange={(e) => setRules(e.target.value)} placeholder={"No parties or events\nQuiet hours 10:00 PM – 7:00 AM"} /></label>
          </div>
        ) : (
          <label className="mk-form">In the kit <small>one item per line</small><textarea className="mk-ta" disabled={fixed} value={includes} onChange={(e) => setIncludes(e.target.value)} /></label>
        )}
      </div>

      <div className="mk-box">
        <h2>{cfg.copy.offersTitle}</h2>
        <div className="mk-amen-pick">
          {cfg.amenities.map((a) => (
            <button type="button" key={a} className={`mk-chip${f.features.includes(a) ? " on" : ""}`} onClick={() => set({ features: f.features.includes(a) ? f.features.filter((x) => x !== a) : [...f.features, a] })}>{a}</button>
          ))}
        </div>
      </div>

      <div className="mk-box">
        <h2>Price and booking</h2>
        <div className="mk-form">
          <div className="three">
            <label>Price per {f.unit} ($) <input className="mk-in" inputMode="decimal" value={f.price || ""} onChange={(e) => set({ price: n(e.target.value.replace(/[^0-9.]/g, "")) })} /></label>
            <label>Minimum {f.unit === "night" ? "nights" : f.unit === "hour" ? "hours" : "days"} <input className="mk-in" inputMode="numeric" value={f.minimum || ""} onChange={(e) => set({ minimum: n(e.target.value.replace(/\D/g, "")) || 1 })} /></label>
            {stays ? <label>Cleaning fee ($) <input className="mk-in" inputMode="decimal" value={f.cleaningFee ?? ""} onChange={(e) => set({ cleaningFee: n(e.target.value.replace(/[^0-9.]/g, "")) })} /></label>
              : <label>Refundable deposit ($) <input className="mk-in" inputMode="decimal" value={f.deposit ?? ""} onChange={(e) => set({ deposit: n(e.target.value.replace(/[^0-9.]/g, "")) })} /></label>}
          </div>
          <div className="two">
            <label>Cancellation
              <select value={f.cancellationPolicy} onChange={(e) => set({ cancellationPolicy: e.target.value as any })}>
                <option value="flexible">Flexible — full refund until check-in</option>
                <option value="moderate">Moderate — full refund up to 24 hours before</option>
                <option value="strict">Strict — full refund up to 48 hours before</option>
              </select>
            </label>
          </div>
          <label>Local tax rate (%) <small>added to the guest&apos;s total by the server</small><input className="mk-in" inputMode="decimal" value={f.taxRate ?? ""} onChange={(e) => set({ taxRate: n(e.target.value.replace(/[^0-9.]/g, "")) })} style={{ maxWidth: 200 }} /></label>
          <label>{stays ? "Check-in instructions" : "Hand-over instructions"} <small>shown to guests once they book</small><textarea className="mk-ta" value={f.bookingInstructions || ""} onChange={(e) => set({ bookingInstructions: e.target.value })} /></label>
        </div>
      </div>

      {err && <p className="mk-err">{err}</p>}
      {ok && <p className="mk-ok">{ok}</p>}
      <div style={{ display: "flex", gap: 12, alignItems: "center", position: "sticky", bottom: 0, background: "#fff", padding: "14px 0", borderTop: "1px solid var(--border)" }}>
        <button type="button" className="mk-btn lg" disabled={busy || upl} onClick={save}>{busy ? "Saving…" : id ? "Save changes" : "Publish listing"}</button>
        {id && <Link className="mk-link" href={`/listing/${id}`}>View listing</Link>}
      </div>
    </div>
  );
}

function shortDay(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}
