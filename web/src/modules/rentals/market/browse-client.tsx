"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ClientCfg } from "./config";
import { I } from "./icons";
import { BrowseMap } from "./browse-map";
import { StayCard } from "./stay-card";
import type { MarketCard } from "./shared";

function useParamNav() {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  return {
    sp,
    set(patch: Record<string, string | null>) {
      const p = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(patch)) { if (v == null || v === "") p.delete(k); else p.set(k, v); }
      const qs = p.toString();
      router.push(`${path}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
  };
}
const csv = (s: string | null) => (s || "").split(",").map((x) => x.trim()).filter(Boolean);

/** Chip row: types, quick amenities, and the full Filters sheet. */
export function FilterChips({ cfg }: { cfg: ClientCfg }) {
  const { sp, set } = useParamNav();
  const types = csv(sp.get("types"));
  const amen = csv(sp.get("amenities"));
  const [sheet, setSheet] = useState(false);
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]).join(",") || null;
  const quick = cfg.amenities.slice(0, 4);
  const count = (sp.get("minPrice") ? 1 : 0) + (sp.get("maxPrice") ? 1 : 0) + (sp.get("bedrooms") ? 1 : 0) + amen.filter((a) => !quick.includes(a)).length;

  return (
    <>
      <div className="mk-filters" role="toolbar" aria-label="Filters">
        <button type="button" className="mk-chip" onClick={() => setSheet(true)}>{I.sliders} Filters {count > 0 && <span className="n">{count}</span>}</button>
        <span className="sep" />
        {cfg.types.map((t) => (
          <button type="button" key={t.id} className={`mk-chip${types.includes(t.id) ? " on" : ""}`} onClick={() => set({ types: toggle(types, t.id) })}>{t.plural}</button>
        ))}
        <span className="sep" />
        {quick.map((a) => (
          <button type="button" key={a} className={`mk-chip${amen.includes(a) ? " on" : ""}`} onClick={() => set({ amenities: toggle(amen, a) })}>{a}</button>
        ))}
      </div>
      {sheet && <FilterSheet cfg={cfg} onClose={() => setSheet(false)} />}
    </>
  );
}

function FilterSheet({ cfg, onClose }: { cfg: ClientCfg; onClose: () => void }) {
  const { sp, set } = useParamNav();
  const [minP, setMinP] = useState(sp.get("minPrice") || "");
  const [maxP, setMaxP] = useState(sp.get("maxPrice") || "");
  const [beds, setBeds] = useState(sp.get("bedrooms") || "");
  const [amen, setAmen] = useState<string[]>(csv(sp.get("amenities")));
  const apply = () => { set({ minPrice: minP || null, maxPrice: maxP || null, bedrooms: beds || null, amenities: amen.join(",") || null }); onClose(); };
  return (
    <div className="mk mk-sheet-bg" onClick={onClose}>
      <div className="mk-sheet" role="dialog" aria-modal="true" aria-label="Filters" onClick={(e) => e.stopPropagation()}>
        <div className="mk-sheet-h"><button type="button" aria-label="Close" onClick={onClose}>✕</button>Filters</div>
        <div className="mk-sheet-b">
          <h4>Price per {cfg.unit}</h4>
          <div className="mk-price-in">
            <label>Minimum<input inputMode="numeric" value={minP} placeholder="$0" onChange={(e) => setMinP(e.target.value.replace(/\D/g, ""))} /></label>
            <span>–</span>
            <label>Maximum<input inputMode="numeric" value={maxP} placeholder="Any" onChange={(e) => setMaxP(e.target.value.replace(/\D/g, ""))} /></label>
          </div>
          {cfg.facts.some((f) => f.key === "bedrooms") && (
            <>
              <h4>Bedrooms</h4>
              <div className="mk-seg">
                {["", "1", "2", "3", "4", "5"].map((b) => (
                  <button type="button" key={b || "any"} className={`mk-chip${beds === b ? " on" : ""}`} onClick={() => setBeds(b)}>{b ? `${b}+` : "Any"}</button>
                ))}
              </div>
            </>
          )}
          <h4>{cfg.copy.offersTitle}</h4>
          <div className="mk-amen-pick">
            {cfg.amenities.map((a) => (
              <button type="button" key={a} className={`mk-chip${amen.includes(a) ? " on" : ""}`} onClick={() => setAmen(amen.includes(a) ? amen.filter((x) => x !== a) : [...amen, a])}>{a}</button>
            ))}
          </div>
        </div>
        <div className="mk-sheet-f">
          <button type="button" className="mk-link" onClick={() => { setMinP(""); setMaxP(""); setBeds(""); setAmen([]); }}>Clear all</button>
          <button type="button" className="mk-btn" onClick={apply}>Show results</button>
        </div>
      </div>
    </div>
  );
}

export function SortSelect() {
  const { sp, set } = useParamNav();
  return (
    <select aria-label="Sort" value={sp.get("sort") || "recommended"} onChange={(e) => set({ sort: e.target.value === "recommended" ? null : e.target.value })}>
      <option value="recommended">Recommended</option>
      <option value="price_asc">Price: low to high</option>
      <option value="price_desc">Price: high to low</option>
      <option value="rating">Top rated</option>
    </select>
  );
}

/** Results list + sticky map, kept in step (hover a card → its pin lifts). */
export function BrowseSplit({ cards, mapsKey, title, note, dateQs }: { cards: MarketCard[]; mapsKey: string | null; title: string; note?: string | null; dateQs: string }) {
  const [hover, setHover] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);
  const { set } = useParamNav();
  const href = (id: string) => `/listing/${id}${dateQs ? `?${dateQs}` : ""}`;
  return (
    <div className="mk-browse">
      <div className="mk-results">
        <div className="mk-results-head">
          <div><h1>{title}</h1>{note && <span className="note">{note}</span>}</div>
          <SortSelect />
        </div>
        {cards.length === 0 ? (
          <div className="mk-empty">
            <h2>No exact matches</h2>
            <p>Try different dates, fewer filters, or a wider area.</p>
            <Link className="mk-btn ghost" href="/browse">Clear search and filters</Link>
          </div>
        ) : (
          <div className="mk-grid">
            {cards.map((c, i) => <StayCard key={c.id} c={c} href={href(c.id)} onHover={setHover} priority={i < 6} />)}
          </div>
        )}
      </div>
      <div className={`mk-mapcol${showMap ? " show" : ""}`}>
        <BrowseMap cards={cards} mapsKey={mapsKey} hover={hover} linkQs={dateQs}
          onArea={(b) => set({ swLat: b.swLat.toFixed(4), swLng: b.swLng.toFixed(4), neLat: b.neLat.toFixed(4), neLng: b.neLng.toFixed(4), q: null })} />
      </div>
      <button type="button" className="mk-maptoggle" onClick={() => setShowMap(!showMap)}>{showMap ? <>{I.list} Show list</> : <>{I.map} Show map</>}</button>
    </div>
  );
}
