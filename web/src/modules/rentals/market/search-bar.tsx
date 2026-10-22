"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ClientCfg } from "./config";
import { I } from "./icons";
import { RangeCalendar } from "./range-calendar";
import { rangeLabel, nightsBetween } from "./shared";

export interface Guests { adults: number; children: number; infants: number; pets: number }
export interface SearchState { q: string; from: string | null; to: string | null; guests: Guests }

export function guestsLabel(g: Guests, empty = "Add guests"): string {
  const n = g.adults + g.children;
  if (!n && !g.infants && !g.pets) return empty;
  return [n ? `${n} guest${n === 1 ? "" : "s"}` : "", g.infants ? `${g.infants} infant${g.infants === 1 ? "" : "s"}` : "", g.pets ? `${g.pets} pet${g.pets === 1 ? "" : "s"}` : ""].filter(Boolean).join(", ");
}

export function searchHref(s: SearchState, keep?: string): string {
  const p = new URLSearchParams(keep || "");
  for (const k of ["q", "from", "to", "adults", "children", "infants", "pets", "page"]) p.delete(k);
  if (s.q.trim()) p.set("q", s.q.trim());
  if (s.from && s.to) { p.set("from", s.from); p.set("to", s.to); }
  if (s.guests.adults) p.set("adults", String(s.guests.adults));
  if (s.guests.children) p.set("children", String(s.guests.children));
  if (s.guests.infants) p.set("infants", String(s.guests.infants));
  if (s.guests.pets) p.set("pets", String(s.guests.pets));
  const qs = p.toString();
  return `/browse${qs ? `?${qs}` : ""}`;
}

export function GuestCounters({ value, onChange, max, pets = true }: { value: Guests; onChange: (g: Guests) => void; max?: number; pets?: boolean }) {
  const total = value.adults + value.children;
  const rows: { k: keyof Guests; t: string; s: string; min: number; cap?: number }[] = [
    { k: "adults", t: "Adults", s: "Ages 13 or above", min: total > 0 || value.infants || value.pets ? 1 : 0 },
    { k: "children", t: "Children", s: "Ages 2–12", min: 0 },
    { k: "infants", t: "Infants", s: "Under 2", min: 0, cap: 5 },
    ...(pets ? [{ k: "pets" as const, t: "Pets", s: "Bringing a service animal? No need to add it", min: 0, cap: 5 }] : []),
  ];
  function set(k: keyof Guests, d: number) {
    const next = { ...value, [k]: Math.max(0, value[k] + d) };
    if (d > 0 && k !== "adults" && next.adults === 0) next.adults = 1;
    onChange(next);
  }
  return (
    <div>
      {rows.map((r) => {
        const atMax = (r.k === "adults" || r.k === "children") ? (max != null && total >= max) : (r.cap != null && value[r.k] >= r.cap);
        return (
          <div className="mk-ctr" key={r.k}>
            <div><b>{r.t}</b><small>{r.s}</small></div>
            <div className="mk-ctr-n">
              <button type="button" aria-label={`Fewer ${r.t.toLowerCase()}`} disabled={value[r.k] <= r.min} onClick={() => set(r.k, -1)}>−</button>
              <span>{value[r.k]}</span>
              <button type="button" aria-label={`More ${r.t.toLowerCase()}`} disabled={atMax} onClick={() => set(r.k, 1)}>+</button>
            </div>
          </div>
        );
      })}
      {max != null && <p className="mk-muted" style={{ fontSize: 13, marginTop: 10 }}>This place has a maximum of {max} guests, not including infants.</p>}
    </div>
  );
}

type Open = null | "where" | "dates" | "who";

/** Destination · dates · guests. Desktop: a pill with popovers. Phone: a pill that opens a full sheet. */
export function SearchBar({ cfg, initial, compact = false, keep }: { cfg: ClientCfg; initial?: Partial<SearchState>; compact?: boolean; keep?: string }) {
  const router = useRouter();
  const [s, setS] = useState<SearchState>({ q: initial?.q || "", from: initial?.from || null, to: initial?.to || null, guests: initial?.guests || { adults: 0, children: 0, infants: 0, pets: 0 } });
  const [open, setOpen] = useState<Open>(null);
  const [sheet, setSheet] = useState(false);
  const [mStep, setMStep] = useState<Open>("where");
  const ref = useRef<HTMLDivElement>(null);
  const whereRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(null); }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  useEffect(() => { document.body.style.overflow = sheet ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [sheet]);

  function go(next = s) { setOpen(null); setSheet(false); router.push(searchHref(next, keep)); }
  const nights = nightsBetween(s.from || undefined, s.to || undefined);
  const dateText = s.from && s.to ? rangeLabel(s.from, s.to) : s.from ? `${rangeLabel(s.from)} – ` : "";
  const guestText = guestsLabel(s.guests, cfg.search.whoPlaceholder || "Add guests");

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <form className={`mk-sb${compact ? " compact" : ""}`} onSubmit={(e) => { e.preventDefault(); go(); }} role="search">
        <label className={`mk-sb-seg where${open === "where" ? " on" : ""}`} onClick={() => setOpen("where")}>
          <b>{cfg.search.where}</b>
          <input ref={whereRef} value={s.q} placeholder={cfg.search.wherePlaceholder} onChange={(e) => setS({ ...s, q: e.target.value })} onFocus={() => setOpen("where")} aria-label={cfg.search.where} />
        </label>
        <button type="button" className={`mk-sb-seg${open === "dates" ? " on" : ""}`} onClick={() => setOpen(open === "dates" ? null : "dates")}>
          <b>{cfg.search.start}</b>
          <span className={s.from ? "val" : ""}>{s.from ? rangeLabel(s.from) : "Add dates"}</span>
        </button>
        <button type="button" className={`mk-sb-seg${open === "dates" ? " on" : ""}`} onClick={() => setOpen(open === "dates" ? null : "dates")}>
          <b>{cfg.search.end}</b>
          <span className={s.to ? "val" : ""}>{s.to ? rangeLabel(s.to) : "Add dates"}</span>
        </button>
        {cfg.guests && (
          <button type="button" className={`mk-sb-seg${open === "who" ? " on" : ""}`} onClick={() => setOpen(open === "who" ? null : "who")}>
            <b>{cfg.search.who}</b>
            <span className={s.guests.adults ? "val" : ""}>{guestText}</span>
          </button>
        )}
        <div className="mk-sb-go"><button type="submit">{I.search}<span>{cfg.search.button}</span></button></div>
      </form>

      {open === "where" && (
        <div className="mk-pop where">
          <h6>Popular right now</h6>
          {cfg.search.destinations
            .filter((d) => !s.q || d.label.toLowerCase().includes(s.q.toLowerCase().split(",")[0]))
            .map((d) => (
              <button type="button" key={d.label} className="mk-dest" onClick={() => { setS({ ...s, q: d.label }); setOpen("dates"); }}>
                <i>{I.pin}</i><span><b>{d.label}</b><small>{d.sub}</small></span>
              </button>
            ))}
        </div>
      )}
      {open === "dates" && (
        <div className="mk-pop dates">
          <RangeCalendar from={s.from} to={s.to} onChange={(f, t) => { setS({ ...s, from: f, to: t }); if (f && t && cfg.guests) setOpen("who"); }} />
          <div className="mk-cal-foot">
            <small>{nights > 0 ? `${nights} ${cfg.unit === "night" ? (nights === 1 ? "night" : "nights") : nights === 1 ? "day" : "days"} · ${dateText}` : "Pick your dates"}</small>
            <button type="button" className="mk-link" onClick={() => setS({ ...s, from: null, to: null })}>Clear dates</button>
          </div>
        </div>
      )}
      {open === "who" && cfg.guests && (
        <div className="mk-pop who">
          <GuestCounters value={s.guests} onChange={(g) => setS({ ...s, guests: g })} />
        </div>
      )}

      {/* phone */}
      <button type="button" className="mk-mpill" onClick={() => { setSheet(true); setMStep(s.q ? (s.from ? (cfg.guests ? "who" : "dates") : "dates") : "where"); }}>
        {I.search}
        <span style={{ minWidth: 0 }}>
          <b>{s.q || (cfg.unit === "night" ? "Where to?" : "What do you need?")}</b>
          <small>{[s.from && s.to ? rangeLabel(s.from, s.to) : "Any week", cfg.guests ? guestsLabel(s.guests) : null].filter(Boolean).join(" · ")}</small>
        </span>
      </button>
      {sheet && (
        <div className="mk mk-msheet" role="dialog" aria-modal="true" aria-label="Search">
          <div className="mk-msheet-h">
            <button type="button" aria-label="Close" onClick={() => setSheet(false)}>✕</button>
            <span />
          </div>
          <div className="mk-msheet-b">
            {mStep === "where" ? (
              <div className="mk-mcard">
                <h3>{cfg.unit === "night" ? "Where to?" : "Where?"}</h3>
                <input className="mk-in" autoFocus value={s.q} placeholder={cfg.search.wherePlaceholder} onChange={(e) => setS({ ...s, q: e.target.value })} />
                <div style={{ marginTop: 10 }}>
                  {cfg.search.destinations.map((d) => (
                    <button type="button" key={d.label} className="mk-dest" onClick={() => { setS({ ...s, q: d.label }); setMStep("dates"); }}>
                      <i>{I.pin}</i><span><b>{d.label}</b><small>{d.sub}</small></span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <button type="button" className="mk-mcard closed" onClick={() => setMStep("where")}><span>{cfg.search.where}</span><b>{s.q || "Anywhere"}</b></button>
            )}
            {mStep === "dates" ? (
              <div className="mk-mcard">
                <h3>{cfg.unit === "night" ? "When's your trip?" : "When do you need it?"}</h3>
                <RangeCalendar months={1} from={s.from} to={s.to} onChange={(f, t) => setS({ ...s, from: f, to: t })} />
                <div className="mk-cal-foot">
                  <button type="button" className="mk-link" onClick={() => setS({ ...s, from: null, to: null })}>Clear</button>
                  <button type="button" className="mk-btn sm" onClick={() => setMStep(cfg.guests ? "who" : null)}>Next</button>
                </div>
              </div>
            ) : (
              <button type="button" className="mk-mcard closed" onClick={() => setMStep("dates")}><span>When</span><b>{s.from && s.to ? rangeLabel(s.from, s.to) : "Add dates"}</b></button>
            )}
            {cfg.guests && (mStep === "who" ? (
              <div className="mk-mcard"><h3>Who&apos;s coming?</h3><GuestCounters value={s.guests} onChange={(g) => setS({ ...s, guests: g })} /></div>
            ) : (
              <button type="button" className="mk-mcard closed" onClick={() => setMStep("who")}><span>Who</span><b>{guestsLabel(s.guests)}</b></button>
            ))}
          </div>
          <div className="mk-msheet-f">
            <button type="button" className="mk-link" onClick={() => setS({ q: "", from: null, to: null, guests: { adults: 0, children: 0, infants: 0, pets: 0 } })}>Clear all</button>
            <button type="button" className="mk-btn warm lg" onClick={() => go()}>{I.search}<span>{cfg.search.button}</span></button>
          </div>
        </div>
      )}
    </div>
  );
}
