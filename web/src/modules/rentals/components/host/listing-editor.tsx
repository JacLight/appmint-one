"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/alert";
import { routes } from "@/lib/nav";
import {
  updateListingAction, setListingStatusAction, deleteListingAction, addUnitAction, updateUnitAction,
} from "@/modules/rentals/actions/host";
import type { StowboListing, StowboUnit, ListingStatus } from "@/api/rentals";
import countryOptions from "@/lib/country-options.json";
import { STORAGE_CLASSES } from "@/modules/rentals/lib/classes";

const TYPES = STORAGE_CLASSES.map((c) => ({ v: c.slug, label: c.label }));
const FEATURES = ["Indoor", "Covered", "Climate controlled", "Gated", "CCTV", "Drive-up", "24/7 access", "Ground floor", "Lighting", "EV charging"];
const UNIT_STATUSES = ["vacant", "maintenance", "overlocked"] as const;

type UnitRow = { sk?: string } & Partial<StowboUnit>;

export function ListingEditor({
  id, listingName, listing, units: initialUnits,
}: {
  id: string;
  listingName: string;
  listing: Partial<StowboListing>;
  units: UnitRow[];
}) {
  const router = useRouter();
  const [saving, startSave] = useTransition();
  const [statusPending, startStatus] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [units, setUnits] = useState<UnitRow[]>(initialUnits);

  const [f, setF] = useState({
    title: listing.title ?? "",
    spaceType: listing.spaceType ?? "",
    description: listing.description ?? "",
    bookingInstructions: listing.bookingInstructions ?? "",
    street1: listing.address?.street1 ?? "",
    city: listing.address?.city ?? "",
    country: listing.address?.country ?? "",
    state: listing.address?.state ?? "",
    zip: listing.address?.zip ?? "",
    capacity: String(listing.capacity ?? 1),
    size: listing.size ?? "",
    staffing: (listing.staffing ?? "unmanned") as "manned" | "unmanned",
    accessHours: (listing.accessHours ?? "24/7") as "24/7" | "daytime" | "by arrangement",
    features: listing.features ?? [],
    price: listing.price != null ? String(listing.price) : "",
    priceUnit: (listing.priceUnit ?? "day") as "hour" | "day" | "week" | "month",
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));
  const toggleFeat = (x: string) => setF((s) => ({ ...s, features: s.features.includes(x) ? s.features.filter((y) => y !== x) : [...s.features, x] }));

  const status = (listing.status ?? "draft") as ListingStatus;
  const bands = listing.rates?.bands ?? [];
  const hasBands = bands.length > 0;
  const bandHeadline = hasBands ? bands.map((b) => `$${b.amount} / ${b.per || "day"}`).join(" · ") : "";

  function save() {
    setError(null); setNotice(null);
    startSave(async () => {
      const r = await updateListingAction(id, {
        title: f.title.trim(),
        spaceType: f.spaceType,
        description: f.description.trim(),
        bookingInstructions: f.bookingInstructions.trim() || undefined,
        address: { ...(listing.address ?? {}), street1: f.street1.trim(), city: f.city.trim(), state: f.state.trim(), country: f.country, zip: f.zip.trim() },
        capacity: Number(f.capacity) || 1,
        size: f.size.trim(),
        staffing: f.staffing,
        accessHours: f.accessHours,
        features: f.features,
        // A listing priced by rate bands ignores the flat price — never write it from here.
        ...(hasBands ? {} : { price: f.price ? Number(f.price) : undefined, priceUnit: f.priceUnit }),
      });
      if (r.ok) { setNotice("Saved."); router.refresh(); }
      else setError(r.error);
    });
  }

  function changeStatus(next: ListingStatus) {
    setError(null); setNotice(null);
    startStatus(async () => {
      const r = await setListingStatusAction(id, next);
      if (r.ok) { setNotice(next === "active" ? "Listing is live." : next === "paused" ? "Listing paused — hidden from browse." : "Listing set to draft."); router.refresh(); }
      else setError(r.error);
    });
  }

  function remove() {
    setError(null);
    startStatus(async () => {
      const r = await deleteListingAction(id);
      if (r.ok) { router.push(routes.hostListings); router.refresh(); }
      else { setError(r.error); setConfirmDelete(false); }
    });
  }

  // ── units ──
  const [newUnit, setNewUnit] = useState("");
  const [unitPending, startUnit] = useTransition();
  function addUnit() {
    const label = newUnit.trim();
    if (!label) return;
    startUnit(async () => {
      const r = await addUnitAction({ listing: listingName, unitNumber: label, status: "vacant" });
      if (r.ok) { setUnits((u) => [...u, { unitNumber: label, status: "vacant", listing: listingName }]); setNewUnit(""); router.refresh(); }
      else setError(r.error);
    });
  }
  function setUnitStatus(u: UnitRow, next: StowboUnit["status"]) {
    if (!u.sk) return;
    startUnit(async () => {
      const r = await updateUnitAction(u.sk!, { status: next });
      if (r.ok) setUnits((list) => list.map((x) => (x.sk === u.sk ? { ...x, status: next } : x)));
      else setError(r.error);
    });
  }

  const statusColor: Record<string, string> = { active: "var(--accent-strong)", draft: "var(--muted)", paused: "var(--highlight)", inactive: "var(--primary-strong)" };

  return (
    <div style={{ display: "grid", gap: 22, maxWidth: 760 }}>
      {error && <Alert kind="error" onDismiss={() => setError(null)}>{error}</Alert>}
      {notice && <Alert kind="success" onDismiss={() => setNotice(null)}>{notice}</Alert>}

      {/* status + publish controls */}
      <div className="tcard" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <p className="eyebrow">Status</p>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, color: statusColor[status] ?? "var(--text)", textTransform: "capitalize" }}>{status}</div>
          <p className="muted" style={{ fontSize: 13, marginTop: 2 }}>
            {status === "active" ? "Live and bookable in Browse." : status === "paused" ? "Hidden from Browse — existing bookings stand." : "Not yet visible to guests. Publish when it's ready."}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {status !== "active" ? (
            <button className="btn clay" disabled={statusPending} onClick={() => changeStatus("active")}>{statusPending ? "…" : "Publish"}</button>
          ) : (
            <button className="btn ghost" disabled={statusPending} onClick={() => changeStatus("paused")}>{statusPending ? "…" : "Pause"}</button>
          )}
        </div>
      </div>

      {/* editable fields */}
      <div className="tcard" style={{ display: "grid", gap: 16 }}>
        <div className="field"><label>Title</label><input value={f.title} onChange={(e) => set("title", e.target.value)} /></div>
        <div className="field">
          <label>Type</label>
          <select value={f.spaceType} onChange={(e) => set("spaceType", e.target.value)}>
            <option value="">Choose a type…</option>
            {f.spaceType && !TYPES.some((t) => t.v === f.spaceType) && (
              <option value={f.spaceType}>{f.spaceType.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</option>
            )}
            {TYPES.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
          </select>
        </div>
        <div className="frow">
          <div className="field"><label>Street address</label><input value={f.street1} onChange={(e) => set("street1", e.target.value)} placeholder="1600 Market St" /></div>
          <div className="field"><label>City</label><input value={f.city} onChange={(e) => set("city", e.target.value)} placeholder="San Francisco" /></div>
        </div>
        <div className="field">
          <label htmlFor="listing-country">Country</label>
          <select id="listing-country" value={f.country} onChange={(e) => set("country", e.target.value)}>
            <option value="">Select country</option>
            {countryOptions.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}
          </select>
        </div>
        <div className="frow">
          <div className="field"><label>State</label><input value={f.state} onChange={(e) => set("state", e.target.value)} placeholder="CA" /></div>
          <div className="field"><label>ZIP</label><input value={f.zip} onChange={(e) => set("zip", e.target.value)} placeholder="94102" /></div>
        </div>
        <p className="muted" style={{ fontSize: 12.5, marginTop: -8 }}>The exact address stays private until a booking is confirmed. It's used to place your pin on the map.</p>
        <div className="frow">
          <div className="field"><label>Capacity (units / slots)</label><input type="number" min={1} value={f.capacity} onChange={(e) => set("capacity", e.target.value)} /></div>
          <div className="field"><label>Size / what fits</label><input value={f.size} onChange={(e) => set("size", e.target.value)} placeholder="5×5 ft · fits an SUV" /></div>
        </div>
        <div className="frow">
          <div className="field"><label>Staffing</label>
            <select value={f.staffing} onChange={(e) => set("staffing", e.target.value as typeof f.staffing)}><option value="unmanned">Unmanned (self-serve)</option><option value="manned">Manned (staffed)</option></select>
          </div>
          <div className="field"><label>Access hours</label>
            <select value={f.accessHours} onChange={(e) => set("accessHours", e.target.value as typeof f.accessHours)}><option value="24/7">24/7</option><option value="daytime">Daytime</option><option value="by arrangement">By arrangement</option></select>
          </div>
        </div>
        <div className="field">
          <label>Features</label>
          <div className="chips">
            {FEATURES.map((x) => <button key={x} type="button" className={`chip${f.features.includes(x) ? " on" : ""}`} onClick={() => toggleFeat(x)}>{x}</button>)}
          </div>
        </div>
        <div className="field"><label>Description</label><textarea rows={4} value={f.description} onChange={(e) => set("description", e.target.value)} /></div>
        <div className="field"><label>Booking instructions <span className="muted" style={{ fontWeight: 400 }}>— shown to the guest right after they book</span></label><textarea rows={4} value={f.bookingInstructions} onChange={(e) => set("bookingInstructions", e.target.value)} placeholder="Exactly how to drop off and collect: gate code, which locker/bay, where to meet, hours, and how to reach you on arrival." /></div>
        {hasBands ? (
          <div className="field"><label>Rate <span className="muted" style={{ fontWeight: 400 }}>— from the rate schedule</span></label>
            <div className="le-bands">{bandHeadline} <span className="muted">per item</span></div>
            <p className="muted" style={{ fontSize: 12.5, margin: "6px 0 0" }}>This space is priced by its rate schedule; a flat price here would be ignored, so it isn’t offered.</p>
          </div>
        ) : (
          <div className="frow">
            <div className="field"><label>Price</label><input type="number" min={0} step="0.5" value={f.price} onChange={(e) => set("price", e.target.value)} placeholder="0" /></div>
            <div className="field"><label>Per</label>
              <select value={f.priceUnit} onChange={(e) => set("priceUnit", e.target.value as typeof f.priceUnit)}><option value="hour">hour</option><option value="day">day</option><option value="week">week</option><option value="month">month</option></select>
            </div>
          </div>
        )}
        <div><button className="btn clay" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save changes"}</button></div>
      </div>

      {/* units */}
      <div className="tcard" style={{ display: "grid", gap: 14 }}>
        <div>
          <h2 style={{ fontSize: 18 }}>Units</h2>
          <p className="muted" style={{ fontSize: 13 }}>Individual bays, lockers or slots inside this listing. Add them if you want to track and hand over each one separately.</p>
        </div>
        {units.length > 0 && (
          <div style={{ display: "grid", gap: 8 }}>
            {units.map((u, i) => (
              <div key={u.sk ?? i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 12 }}>
                <b style={{ fontFamily: "var(--font-display)" }}>{u.unitNumber || `Unit ${i + 1}`}</b>
                <div style={{ display: "flex", gap: 6 }}>
                  {UNIT_STATUSES.map((s) => (
                    <button key={s} type="button" className={`chip${u.status === s ? " on" : ""}`} disabled={unitPending || !u.sk} onClick={() => setUnitStatus(u, s)} style={{ textTransform: "capitalize" }}>{s}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <input value={newUnit} onChange={(e) => setNewUnit(e.target.value)} placeholder="e.g. Bay 3 / Locker A12" style={{ flex: 1 }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addUnit(); } }} />
          <button className="btn ghost" disabled={unitPending || !newUnit.trim()} onClick={addUnit}>+ Add unit</button>
        </div>
      </div>

      {/* danger zone */}
      <div className="tcard" style={{ borderColor: "#e7b39c" }}>
        <h2 style={{ fontSize: 16, color: "var(--primary-strong)" }}>Delete listing</h2>
        <p className="muted" style={{ fontSize: 13, marginTop: 2 }}>Permanently removes this listing. This can't be undone.</p>
        {!confirmDelete ? (
          <button className="btn ghost sm" style={{ marginTop: 12, color: "var(--primary-strong)", borderColor: "#e7b39c" }} onClick={() => setConfirmDelete(true)}>Delete this listing</button>
        ) : (
          <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "center" }}>
            <span style={{ fontSize: 13.5 }}>Are you sure?</span>
            <button className="btn sm" style={{ background: "var(--primary-strong)", color: "#fff" }} disabled={statusPending} onClick={remove}>{statusPending ? "Deleting…" : "Yes, delete"}</button>
            <button className="btn ghost sm" onClick={() => setConfirmDelete(false)}>Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}
