"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Alert } from "@/components/alert";
import { hostBookAction, listingAddonsAction, type CatalogAddon } from "@/modules/rentals/actions/host";
import { formatMoney } from "@/lib/utils";

type Listing = { sk: string; title: string; spaceType?: string; capacity?: number; name?: string };

const NOUN: Record<string, string> = {
  parking: "vehicles", locker: "lockers", "box-storage": "boxes", "shared-space": "spaces",
  warehouse: "bays", "spare-room": "rooms", "cold-storage": "units", "bike-gear": "items", "event-bag-drop": "bags",
};
/** What one unit IS on this kind of space — the per-unit type defaults from it. */
const UNIT_TYPES: Record<string, string[]> = {
  parking: ["Vehicle", "Sedan", "SUV", "Truck", "Van", "Motorcycle", "EV"],
  "bike-gear": ["Bike", "E-bike", "Scooter", "Gear"],
  "event-bag-drop": ["Bag", "Suitcase", "Backpack", "Coat"],
  locker: ["Locker"],
  "box-storage": ["Box", "Crate", "Furniture"],
  warehouse: ["Pallet", "Crate", "Vehicle"],
};
const defaultType = (spaceType?: string) => (UNIT_TYPES[spaceType ?? ""] ?? ["Item"])[0];

/** Take someone in right now, or reserve a window for later. Who, what space, how many
 *  (each with its own type + registration when there's more than one), how long, plate,
 *  Extras from the space's add-on catalog, note. */
export function WalkInIntake({ listings, onDone }: { listings: Listing[]; onDone: () => void }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const [listingKey, setListingKey] = useState(listings[0]?.name || listings[0]?.sk || "");
  const [mode, setMode] = useState<"now" | "reserve">("now");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [plate, setPlate] = useState("");
  const [qty, setQty] = useState(1);
  // Per-unit rows are DERIVED from qty (+ whatever the host typed per row) so the
  // list always matches the stepper without effects re-setting state.
  const [unitEdits, setUnitEdits] = useState<Record<number, { type?: string; identifier?: string }>>({});
  const [openStay, setOpenStay] = useState(true);
  const [start_, setStart] = useState("");
  const [pickup, setPickup] = useState("");
  const [note, setNote] = useState("");
  const [promo, setPromo] = useState("");
  const [catalog, setCatalog] = useState<CatalogAddon[]>([]);
  const [extras, setExtras] = useState<string[]>([]);

  const selected = useMemo(() => listings.find((l) => (l.name || l.sk) === listingKey), [listings, listingKey]);
  const capacity = selected?.capacity ?? 0;
  const noun = NOUN[selected?.spaceType ?? ""] || "units";
  const maxQty = capacity > 0 ? capacity : 99;
  const types = UNIT_TYPES[selected?.spaceType ?? ""] ?? ["Item"];

  // Extras come from the space's own add-on catalog (what the host attached to it).
  useEffect(() => {
    let live = true;
    if (selected?.sk) listingAddonsAction(selected.sk).then((c) => { if (live) setCatalog(c); });
    return () => { live = false; };
  }, [selected?.sk]);
  const units = Array.from({ length: qty }, (_, i) => ({ type: unitEdits[i]?.type ?? defaultType(selected?.spaceType), identifier: unitEdits[i]?.identifier ?? "" }));
  const editUnit = (i: number, patch: { type?: string; identifier?: string }) => setUnitEdits((m) => ({ ...m, [i]: { ...m[i], ...patch } }));
  // Changing the space resets what depends on it: qty, per-unit types, extras, catalog.
  const changeListing = (key: string) => { setListingKey(key); setQty(1); setUnitEdits({}); setExtras([]); setCatalog([]); };

  const money = (n: number) => formatMoney(Math.round(n * 100), "USD");

  function submit() {
    setErr(null);
    if (!name.trim() && !phone.trim()) { setErr("Add the guest’s name or phone."); return; }
    if (mode === "reserve" && !start_) { setErr("Pick when they arrive."); return; }
    if (mode === "reserve" && !pickup) { setErr("A reservation needs a pick-up time."); return; }
    if (mode === "now" && !openStay && !pickup) { setErr("Pick a pick-up time, or choose an open stay."); return; }
    const notes = [note.trim(), phone.trim() ? `Phone: ${phone.trim()}` : ""].filter(Boolean).join(" · ");
    const perUnit = qty > 1 ? units.map((u) => ({ type: u.type || undefined, identifier: u.identifier.trim() || undefined })) : [];
    const anyUnitDetail = perUnit.some((u) => u.identifier || u.type);
    start(async () => {
      const r = await hostBookAction({
        listing: listingKey,
        customer: name.trim() || phone.trim() || undefined,
        // What the host typed, kept as-is so the booking page can show and dial it.
        guest: { ...(name.trim() ? { name: name.trim() } : {}), ...(phone.trim() ? { phone: phone.trim() } : {}) },
        identifier: qty === 1 ? (plate.trim() || undefined) : undefined,
        quantity: qty,
        ...(anyUnitDetail ? { units: perUnit } : {}),
        ...(mode === "reserve" ? { reserve: true, startDate: start_ } : {}),
        endDate: mode === "reserve" ? pickup : (openStay ? undefined : pickup),
        addOns: extras.map((n) => ({ name: n })),
        ...(promo.trim() ? { discountCode: promo.trim() } : {}),
        note: notes || undefined,
        movementIn: mode === "now",
      });
      if (r.ok) onDone();
      else setErr(r.error);
    });
  }

  const toggleExtra = (n: string) => setExtras((xs) => (xs.includes(n) ? xs.filter((x) => x !== n) : [...xs, n]));

  return (
    <div className="wi">
      <div className="wi-field">
        <span>What&apos;s happening?</span>
        <div className="wi-seg">
          <button type="button" className={mode === "now" ? "on" : ""} onClick={() => setMode("now")}>Take in now <em>they’re here</em></button>
          <button type="button" className={mode === "reserve" ? "on" : ""} onClick={() => setMode("reserve")}>Reserve for later <em>book a window</em></button>
        </div>
      </div>

      <label className="wi-field">
        <span>Space</span>
        <select value={listingKey} onChange={(e) => changeListing(e.target.value)}>
          {listings.map((l) => <option key={l.sk} value={l.name || l.sk}>{l.title}{l.capacity ? ` — holds ${l.capacity}` : ""}</option>)}
        </select>
      </label>

      <div className="wi-row2">
        <label className="wi-field"><span>Guest name</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" autoComplete="name" /></label>
        <label className="wi-field"><span>Phone</span><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 214…" inputMode="tel" /></label>
      </div>

      <div className="wi-row2">
        {qty === 1 ? (
          <label className="wi-field"><span>Plate / tag <em>optional</em></span><input value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="8HKL204" /></label>
        ) : <div />}
        <label className="wi-field">
          <span>How many {noun}?{capacity ? ` (up to ${maxQty})` : ""}</span>
          <div className="wi-stepper">
            <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1}>−</button>
            <input type="number" min={1} max={maxQty} value={qty} onChange={(e) => { const n = parseInt(e.target.value, 10); setQty(Number.isNaN(n) ? 1 : Math.min(maxQty, Math.max(1, n))); }} />
            <button type="button" onClick={() => setQty((q) => Math.min(maxQty, q + 1))} disabled={qty >= maxQty}>+</button>
          </div>
        </label>
      </div>

      {qty > 1 && (
        <div className="wi-field">
          <span>Each one <em>type + plate / tag, optional</em></span>
          <div className="wi-units">
            {units.map((u, i) => (
              <div className="wi-unit" key={i}>
                <span className="wi-n">{i + 1}.</span>
                <select value={u.type} onChange={(e) => editUnit(i, { type: e.target.value })}>
                  {types.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <input value={u.identifier} onChange={(e) => editUnit(i, { identifier: e.target.value })} placeholder="Plate / tag" />
              </div>
            ))}
          </div>
        </div>
      )}

      {mode === "reserve" ? (
        <div className="wi-row2">
          <label className="wi-field"><span>Arrives</span><input className="wi-dt" type="datetime-local" value={start_} onChange={(e) => setStart(e.target.value)} /></label>
          <label className="wi-field"><span>Pick-up</span><input className="wi-dt" type="datetime-local" value={pickup} onChange={(e) => setPickup(e.target.value)} /></label>
        </div>
      ) : (
        <div className="wi-field">
          <span>How long?</span>
          <div className="wi-seg">
            <button type="button" className={openStay ? "on" : ""} onClick={() => setOpenStay(true)}>Open stay <em>pay on the way out</em></button>
            <button type="button" className={!openStay ? "on" : ""} onClick={() => setOpenStay(false)}>Set a pick-up time</button>
          </div>
          {!openStay && (
            <input className="wi-dt" type="datetime-local" value={pickup} onChange={(e) => setPickup(e.target.value)} />
          )}
        </div>
      )}

      {catalog.length > 0 && (
        <div className="wi-field">
          <span>Extras <em>from this space&apos;s add-ons</em></span>
          <div className="wi-extras">
            {catalog.map((a) => (
              <button type="button" key={a.name} className={`wi-extra${extras.includes(a.name) ? " on" : ""}`} onClick={() => toggleExtra(a.name)} aria-pressed={extras.includes(a.name)}>
                {a.title}<em>{a.price > 0 ? `${money(a.price)}${a.chargeEvery && a.chargeEvery !== "once" ? ` / ${a.chargeEvery}` : ""}` : "free"}{a.service ? " · you do this" : ""}</em>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="wi-row2">
        <label className="wi-field"><span>Promo code <em>optional</em></span><input value={promo} onChange={(e) => setPromo(e.target.value.toUpperCase())} placeholder="STOW10" spellCheck={false} /></label>
        <div />
      </div>
      <label className="wi-field"><span>Note <em>optional</em></span><textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything to remember — condition, where you put it, special handling…" /></label>

      {err && <div style={{ marginTop: 4 }}><Alert kind="error">{err}</Alert></div>}

      <div className="wi-foot">
        <span className="muted">{mode === "now" ? "Checks them in right now." : "Books the window; nothing is checked in until they arrive."}</span>
        <button type="button" className="btn clay" disabled={pending || !listingKey} onClick={submit}>
          {pending ? (mode === "now" ? "Taking it in…" : "Reserving…") : mode === "now" ? "Take it in →" : "Reserve →"}
        </button>
      </div>
    </div>
  );
}
