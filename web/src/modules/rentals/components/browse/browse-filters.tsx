"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { STORAGE_CLASSES, classLabel } from "@/modules/rentals/lib/classes";
import { routes } from "@/lib/nav";

type SP = Record<string, string | undefined>;
type Panel = null | "class" | "dates" | "filters";

const STAFFING: [string, string][] = [
  ["staffed", "Staffed"],
  ["self-serve", "Self-serve"],
];
const AMENITIES = ["Indoor", "Covered", "Climate controlled", "Gated", "CCTV", "Drive-up", "24/7 access", "Ground floor", "Lighting", "EV charging"];
const SORT: [string, string][] = [
  ["", "Sort: Recommended"],
  ["price-asc", "Price: low to high"],
  ["price-desc", "Price: high to low"],
  ["space", "Most space free"],
];

const toSet = (csv?: string) => new Set((csv ?? "").split(",").map((s) => s.trim()).filter(Boolean));
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function fmtDay(s?: string): string {
  if (!s) return "";
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return "";
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Quick date presets → [from, to] as YYYY-MM-DD (local). */
function preset(kind: string): [string, string] {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const add = (base: Date, days: number) => { const x = new Date(base); x.setDate(x.getDate() + days); return x; };
  switch (kind) {
    case "now":
    case "today": return [iso(now), iso(now)];
    case "weekend": {
      const dow = now.getDay();               // 0 Sun … 6 Sat
      const sat = add(now, (6 - dow + 7) % 7);
      return [iso(sat), iso(add(sat, 1))];
    }
    case "7d": return [iso(now), iso(add(now, 7))];
    case "30d": return [iso(now), iso(add(now, 30))];
    default: return ["", ""];
  }
}
const PRESETS: [string, string][] = [
  ["now", "Now"],
  ["today", "Today"],
  ["weekend", "This weekend"],
  ["7d", "Next 7 days"],
  ["30d", "Next 30 days"],
];

export function BrowseFilters({ sp, resultCount }: { sp: SP; resultCount: number }) {
  const router = useRouter();
  const [q, setQ] = useState(sp.q ?? "");
  const [open, setOpen] = useState<Panel>(null);

  // drafts (seeded when a panel opens)
  const [classes, setClasses] = useState<Set<string>>(toSet(sp.c));
  const [from, setFrom] = useState(sp.from ?? "");
  const [to, setTo] = useState(sp.to ?? "");
  const [pmin, setPmin] = useState(sp.pmin ?? "");
  const [pmax, setPmax] = useState(sp.pmax ?? "");
  const [smin, setSmin] = useState(sp.smin ?? "");
  const [smax, setSmax] = useState(sp.smax ?? "");
  const [dist, setDist] = useState(sp.dist ?? "");
  const [staffing, setStaffing] = useState<Set<string>>(toSet(sp.staffing));
  const [amenities, setAmenities] = useState<Set<string>>(toSet(sp.amenities));

  const barRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) { if (barRef.current && !barRef.current.contains(e.target as Node)) setOpen(null); }
    function onEsc(e: KeyboardEvent) { if (e.key === "Escape") setOpen(null); }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onEsc); };
  }, [open]);

  function push(params: SP) {
    const p = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) p.set(k, v); });
    const qs = p.toString();
    setOpen(null);
    router.push(qs ? `${routes.browse}?${qs}` : routes.browse);
  }
  const toggle = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, v: string) =>
    setter((s) => { const n = new Set(s); n.has(v) ? n.delete(v) : n.add(v); return n; });

  function openPanel(which: Exclude<Panel, null>) {
    if (open === which) { setOpen(null); return; }
    setClasses(toSet(sp.c)); setFrom(sp.from ?? ""); setTo(sp.to ?? "");
    setPmin(sp.pmin ?? ""); setPmax(sp.pmax ?? ""); setSmin(sp.smin ?? ""); setSmax(sp.smax ?? ""); setDist(sp.dist ?? "");
    setStaffing(toSet(sp.staffing)); setAmenities(toSet(sp.amenities));
    setOpen(which);
  }

  // labels
  const classSel = toSet(sp.c), staffSel = toSet(sp.staffing), amenSel = toSet(sp.amenities);
  const classLbl = classSel.size === 0 ? "All classes" : classSel.size === 1 ? classLabel([...classSel][0]) : `${classSel.size} classes`;
  const dateLbl = sp.from || sp.to ? `${fmtDay(sp.from) || "Any"} – ${fmtDay(sp.to) || "Any"}` : "Dates";
  const moreCount = (sp.pmin || sp.pmax ? 1 : 0) + (sp.smin || sp.smax ? 1 : 0) + (sp.dist ? 1 : 0) + staffSel.size + amenSel.size;

  // applied chips
  const chips: { key: string; label: string; remove: () => void }[] = [];
  const dropCsv = (name: string, set: Set<string>, v: string) => () => { const n = new Set(set); n.delete(v); push({ ...sp, [name]: [...n].join(",") }); };
  classSel.forEach((v) => chips.push({ key: `c-${v}`, label: classLabel(v), remove: dropCsv("c", classSel, v) }));
  if (sp.from || sp.to) chips.push({ key: "dates", label: dateLbl, remove: () => push({ ...sp, from: "", to: "" }) });
  if (sp.pmin || sp.pmax) chips.push({ key: "price", label: sp.pmin && sp.pmax ? `$${sp.pmin}–$${sp.pmax}` : sp.pmax ? `Up to $${sp.pmax}` : `From $${sp.pmin}`, remove: () => push({ ...sp, pmin: "", pmax: "" }) });
  if (sp.smin || sp.smax) chips.push({ key: "size", label: sp.smin && sp.smax ? `${sp.smin}–${sp.smax} sq ft` : sp.smax ? `≤ ${sp.smax} sq ft` : `≥ ${sp.smin} sq ft`, remove: () => push({ ...sp, smin: "", smax: "" }) });
  if (sp.dist) chips.push({ key: "dist", label: `Within ${sp.dist} mi`, remove: () => push({ ...sp, dist: "" }) });
  staffSel.forEach((v) => chips.push({ key: `s-${v}`, label: STAFFING.find(([x]) => x === v)?.[1] ?? v, remove: dropCsv("staffing", staffSel, v) }));
  amenSel.forEach((v) => chips.push({ key: `a-${v}`, label: v, remove: dropCsv("amenities", amenSel, v) }));

  const caret = <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" style={{ marginLeft: 6, flexShrink: 0 }}><path d="M6 9l6 6 6-6" /></svg>;

  return (
    <>
      <div className="filterbar" ref={barRef}>
        {/* Address */}
        <label className="fpill fpill-addr" style={{ gap: 8 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>
          <input value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); push({ ...sp, q }); } }}
            placeholder="City, address or venue" />
        </label>

        {/* Storage class */}
        <div className="fm-anchor">
          <button type="button" className={`fpill${classSel.size ? " active" : ""}`} onClick={() => openPanel("class")} aria-expanded={open === "class"}>
            {classLbl}{caret}
          </button>
          {open === "class" && (
            <div className="fm-pop" style={{ width: 260 }} role="dialog" aria-label="Storage class">
              <div className="fm-body">
                <div className="fm-checks fm-checks-1">
                  {STORAGE_CLASSES.map((c) => (
                    <label key={c.slug} className="fm-check"><input type="checkbox" checked={classes.has(c.slug)} onChange={() => toggle(setClasses, c.slug)} />{c.label}</label>
                  ))}
                </div>
              </div>
              <div className="fm-foot">
                <button type="button" className="btn ghost sm" onClick={() => { setClasses(new Set()); push({ ...sp, c: "" }); }}>Clear</button>
                <button type="button" className="btn clay sm" onClick={() => push({ ...sp, c: [...classes].join(",") })}>Apply</button>
              </div>
            </div>
          )}
        </div>

        {/* Dates — presets + start→end range */}
        <div className="fm-anchor">
          <button type="button" className={`fpill${sp.from || sp.to ? " active" : ""}`} onClick={() => openPanel("dates")} aria-expanded={open === "dates"}>
            {dateLbl}{caret}
          </button>
          {open === "dates" && (
            <div className="fm-pop" style={{ width: 390 }} role="dialog" aria-label="Dates">
              <div className="fm-body">
                <div className="fm-presets">
                  {PRESETS.map(([k, l]) => {
                    const [pf, pt] = preset(k);
                    const active = from === pf && to === pt;
                    return <button key={k} type="button" className={`fm-preset${active ? " on" : ""}`} onClick={() => { setFrom(pf); setTo(pt); }}>{l}</button>;
                  })}
                </div>
                <div className="fm-row" style={{ marginTop: 14 }}>
                  <label className="fm-num">Start<input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} /></label>
                  <span className="fm-dash">→</span>
                  <label className="fm-num">End<input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} /></label>
                </div>
              </div>
              <div className="fm-foot">
                <button type="button" className="btn ghost sm" onClick={() => { setFrom(""); setTo(""); push({ ...sp, from: "", to: "" }); }}>Clear</button>
                <button type="button" className="btn clay sm" onClick={() => push({ ...sp, from, to })}>Apply</button>
              </div>
            </div>
          )}
        </div>

        {/* Filters — price / staffing / amenities */}
        <div className="fm-anchor">
          <button type="button" className={`fpill${moreCount ? " active" : ""}`} onClick={() => openPanel("filters")} aria-expanded={open === "filters"}>
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" style={{ marginRight: 6 }}><path d="M4 6h16M7 12h10M10 18h4" /></svg>
            Filters{moreCount ? ` · ${moreCount}` : ""}
          </button>
          {open === "filters" && (
            <div className="fm-pop" style={{ width: 440 }} role="dialog" aria-label="Filters">
              <div className="fm-body">
                <section className="fm-sec">
                  <h4>Price <span className="fm-hint">per listed unit</span></h4>
                  <div className="fm-row">
                    <label className="fm-num">Min $<input type="number" min={0} inputMode="numeric" placeholder="0" value={pmin} onChange={(e) => setPmin(e.target.value)} /></label>
                    <span className="fm-dash">–</span>
                    <label className="fm-num">Max $<input type="number" min={0} inputMode="numeric" placeholder="Any" value={pmax} onChange={(e) => setPmax(e.target.value)} /></label>
                  </div>
                </section>
                <section className="fm-sec">
                  <h4>Size <span className="fm-hint">sq ft</span></h4>
                  <div className="fm-row">
                    <label className="fm-num">Min size<input type="number" min={0} inputMode="numeric" placeholder="0" value={smin} onChange={(e) => setSmin(e.target.value)} /></label>
                    <span className="fm-dash">–</span>
                    <label className="fm-num">Max size<input type="number" min={0} inputMode="numeric" placeholder="Any" value={smax} onChange={(e) => setSmax(e.target.value)} /></label>
                  </div>
                </section>
                <section className="fm-sec">
                  <h4>Max distance <span className="fm-hint">from your search location</span></h4>
                  <div className="fm-row">
                    <label className="fm-num" style={{ flex: "0 0 140px" }}>Within (miles)<input type="number" min={0} inputMode="numeric" placeholder="Any" value={dist} onChange={(e) => setDist(e.target.value)} /></label>
                  </div>
                  {!q && !sp.q && <div className="fm-hint" style={{ marginTop: 8, display: "block" }}>Enter a city or address above to filter by distance.</div>}
                </section>
                <section className="fm-sec">
                  <h4>Staffing</h4>
                  <div className="fm-checks">
                    {STAFFING.map(([v, l]) => <label key={v} className="fm-check"><input type="checkbox" checked={staffing.has(v)} onChange={() => toggle(setStaffing, v)} />{l}</label>)}
                  </div>
                </section>
                <section className="fm-sec">
                  <h4>Amenities</h4>
                  <div className="fm-checks">
                    {AMENITIES.map((a) => <label key={a} className="fm-check"><input type="checkbox" checked={amenities.has(a)} onChange={() => toggle(setAmenities, a)} />{a}</label>)}
                  </div>
                </section>
              </div>
              <div className="fm-foot">
                <button type="button" className="btn ghost sm" onClick={() => { setPmin(""); setPmax(""); setSmin(""); setSmax(""); setDist(""); setStaffing(new Set()); setAmenities(new Set()); push({ ...sp, pmin: "", pmax: "", smin: "", smax: "", dist: "", staffing: "", amenities: "" }); }}>Clear</button>
                <button type="button" className="btn clay sm" onClick={() => push({ ...sp, pmin, pmax, smin, smax, dist, staffing: [...staffing].join(","), amenities: [...amenities].join(",") })}>See {resultCount} spaces</button>
              </div>
            </div>
          )}
        </div>

        {/* Search */}
        <button type="button" className="fpill on" onClick={() => push({ ...sp, q })}>Search</button>

        <span className="fbar-sp" />

        <select className="fpill" value={sp.sort ?? ""} onChange={(e) => push({ ...sp, sort: e.target.value })} aria-label="Sort">
          {SORT.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {chips.length > 0 && (
        <div className="filter-chips">
          {chips.map((ch) => (
            <button key={ch.key} type="button" className="chip" onClick={ch.remove}>
              {ch.label}
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          ))}
          <button type="button" className="chip-clear" onClick={() => push({ q: sp.q, sort: sp.sort })}>Clear all</button>
        </div>
      )}
    </>
  );
}
