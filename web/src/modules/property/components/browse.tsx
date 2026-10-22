"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BrowseMap } from "@/modules/rentals/market/browse-map";
import type { MarketCard } from "@/modules/rentals/market/shared";
import type { PropertyConfig } from "@/setups/property-config";
import type { Home } from "../lib/types";
import { HomeCard } from "./home-card";

const BEDS: [string, string][] = [["", "Any"], ["0", "Studio"], ["1", "1+"], ["2", "2+"], ["3", "3+"]];
const RENTS = [1000, 1250, 1500, 1750, 2000, 2500, 3000, 4000];
const SIZES = [1000, 2500, 5000, 10000, 25000];
const RATES = [20, 25, 30, 40, 50];
const LEASES = ["NNN", "Modified gross", "Full service gross"];

/** Filter bar, list and map. Every filter is in the URL, so a search can be shared and
 *  the server does the narrowing. */
export function Browse({ cfg, homes, mapsKey, title, lead, segment = "residential" }: { cfg: PropertyConfig; homes: Home[]; mapsKey: string | null; title: string; lead: string; segment?: "residential" | "commercial" }) {
  const biz = segment === "commercial";
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [hover, setHover] = useState<string | null>(null);
  const [q, setQ] = useState(sp.get("q") || "");
  const types = (sp.get("type") || "").split(",").filter(Boolean);

  const set = (patch: Record<string, string | null>) => {
    const n = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) n.set(k, v);
      else n.delete(k);
    }
    router.push(`${path}${n.toString() ? `?${n}` : ""}`, { scroll: false });
  };
  const toggleType = (id: string) => set({ type: (types.includes(id) ? types.filter((t) => t !== id) : [...types, id]).join(",") || null });

  const cards: MarketCard[] = homes.map((h) => {
    const rents = h.units.map((u) => (biz ? u.ratePsf : u.rent)).filter((x): x is number => x != null);
    return {
      id: h.id, title: h.title, type: h.type, typeLabel: h.type, city: h.neighborhood, state: h.address?.state || "",
      image: h.images[0] || null, images: h.images.slice(0, 3), price: rents.length ? Math.min(...rents) : null, unit: biz ? "/SF/yr" : "/ mo",
      facts: [], rating: { average: null, count: 0 }, lat: h.lat, lng: h.lng,
    };
  });
  const count = homes.reduce((n, h) => n + h.units.length, 0);

  return (
    <div className="pm">
      <div className="pm-filters">
        <div className="wrap">
          <form onSubmit={(e) => { e.preventDefault(); set({ q: q.trim() || null }); }} style={{ display: "contents" }}>
            <input type="search" placeholder={biz ? "Area, street or ZIP" : "Neighborhood, street or ZIP"} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search homes" />
          </form>
          {cfg.types.filter((t) => t.segment === segment).map((t) => (
            <button key={t.id} type="button" className={`pm-chip${types.includes(t.id) ? " on" : ""}`} aria-pressed={types.includes(t.id)} onClick={() => toggleType(t.id)}>{t.plural}</button>
          ))}
          {biz ? (
            <>
              <select aria-label="Minimum size" value={sp.get("minSf") || ""} onChange={(e) => set({ minSf: e.target.value || null })}>
                <option value="">Any size</option>
                {SIZES.map((n) => <option key={n} value={n}>{n.toLocaleString("en-US")}+ SF</option>)}
              </select>
              <select aria-label="Maximum rate" value={sp.get("maxPsf") || ""} onChange={(e) => set({ maxPsf: e.target.value || null })}>
                <option value="">Any rate</option>
                {RATES.map((n) => <option key={n} value={n}>Up to ${n}/SF/yr</option>)}
              </select>
              <select aria-label="Lease type" value={sp.get("lease") || ""} onChange={(e) => set({ lease: e.target.value || null })}>
                <option value="">Any lease type</option>
                {LEASES.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </>
          ) : (
            <>
              <div className="pm-seg" role="group" aria-label="Bedrooms">
                {BEDS.map(([v, l]) => (
                  <button key={l} type="button" className={(sp.get("beds") || "") === v ? "on" : ""} onClick={() => set({ beds: v || null })}>{l}</button>
                ))}
              </div>
              <select aria-label="Maximum rent" value={sp.get("max") || ""} onChange={(e) => set({ max: e.target.value || null })}>
                <option value="">Any rent</option>
                {RENTS.map((r) => <option key={r} value={r}>Up to ${r.toLocaleString("en-US")}</option>)}
              </select>
              <button type="button" className={`pm-chip${sp.get("pets") ? " on" : ""}`} onClick={() => set({ pets: sp.get("pets") ? null : "1" })}>Pets OK</button>
              <button type="button" className={`pm-chip${sp.get("furnished") ? " on" : ""}`} onClick={() => set({ furnished: sp.get("furnished") ? null : "1" })}>Furnished</button>
            </>
          )}
          <span className="sp" />
          <select aria-label="Sort" value={sp.get("sort") || ""} onChange={(e) => set({ sort: e.target.value || null })}>
            <option value="">{biz ? "Rate: low to high" : "Rent: low to high"}</option>
            <option value="rent_desc">{biz ? "Rate: high to low" : "Rent: high to low"}</option>
            {biz && <option value="size">Largest first</option>}
            <option value="available">Move in soonest</option>
          </select>
        </div>
      </div>

      <div className="pm-split">
        <div className="pm-split-list">
          <div className="pm-list-h">
            <div>
              <h1>{title}</h1>
              <p>{count} {biz ? (count === 1 ? "space" : "spaces") : count === 1 ? "home" : "homes"} in {homes.length} {homes.length === 1 ? "place" : "places"}. {lead}</p>
            </div>
          </div>
          {homes.length ? (
            <div className="pm-cards">
              {homes.map((h) => <HomeCard key={h.id} cfg={cfg} home={h} hot={hover === h.id} onHover={setHover} segment={segment} />)}
            </div>
          ) : (
            <div className="pm-empty">
              {[...sp.keys()].some((k) => k !== "sort") ? (
                <>
                  <b>Nothing matches all of that right now.</b>
                  Try fewer filters, or <button type="button" className="pm-link" style={{ border: 0, background: "none", font: "inherit", cursor: "pointer" }} onClick={() => router.push(path)}>see everything available</button>.
                </>
              ) : (
                <>
                  <b>{biz ? "No space is listed right now." : "No homes are listed right now."}</b>
                  Call the office on <a className="pm-link" href={`tel:${cfg.office.phone.replace(/[^\d+]/g, "")}`}>{cfg.office.phone}</a> to hear what’s coming up.
                </>
              )}
            </div>
          )}
        </div>
        <div className="pm-split-map">
          <BrowseMap cards={cards} mapsKey={mapsKey} hover={hover} basePath="/homes" />
        </div>
      </div>
    </div>
  );
}
