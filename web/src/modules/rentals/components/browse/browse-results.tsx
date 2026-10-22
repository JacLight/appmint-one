"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { routes } from "@/lib/nav";
import { classLabel } from "@/modules/rentals/lib/classes";
import { QuickViewDrawer } from "./quick-view";

export type BrowseItem = {
  sk: string;
  title: string;
  spaceType: string;
  city: string;
  staffing: string;
  capacity: number;
  size?: string;
  price?: number;
  priceUnit?: string;
  features: string[];
  image?: string;
  lat: number;
  lng: number;
};

declare global {
  interface Window {
    google?: any;
    __gmapsLoading?: Promise<void>;
  }
}

/** Classic Google Maps loader — the exact pattern the admin's GoogleMap wrapper uses. */
function loadGoogle(key: string): Promise<void> {
  if (typeof window === "undefined") return Promise.reject();
  if (window.google?.maps) return Promise.resolve();
  if (window.__gmapsLoading) return window.__gmapsLoading;
  window.__gmapsLoading = new Promise<void>((resolve, reject) => {
    if (document.querySelector('script[src*="maps.googleapis.com"]')) {
      const iv = setInterval(() => { if (window.google?.maps) { clearInterval(iv); resolve(); } }, 100);
      return;
    }
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places`;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Google Maps failed to load"));
    document.head.appendChild(s);
  });
  return window.__gmapsLoading;
}

/** A price-pill marker icon as an SVG data URL — works with classic Markers (no mapId). */
function pinIcon(g: any, price: number | undefined, active: boolean) {
  const label = price ? `$${price}` : "•";
  const w = 22 + label.length * 8;
  const bg = active ? "#cf6a3c" : "#ffffff";
  const fg = active ? "#ffffff" : "#181a12";
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='30'>` +
    `<rect x='1' y='1' rx='14' ry='14' width='${w - 2}' height='26' fill='${bg}' stroke='#181a12' stroke-width='1.4'/>` +
    `<text x='50%' y='19' font-family='Inter,Arial,sans-serif' font-size='13' font-weight='700' fill='${fg}' text-anchor='middle'>${label}</text></svg>`;
  return { url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg), anchor: new g.maps.Point(w / 2, 15) };
}

function isPark(it: BrowseItem) {
  return /park|car|vehicle|garage|lot|rv|boat/i.test(`${it.spaceType} ${it.title}`);
}

/** Great-circle distance in miles. */
function milesBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 3959 * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}
const GEO_RADIUS_MI = 20;

type View = "both" | "list" | "map";

export function BrowseResults({ items, apiKey, origin, dateQuery = "" }: { items: BrowseItem[]; apiKey: string | null; origin?: { lat: number; lng: number } | null; dateQuery?: string }) {
  const resultsEl = useRef<HTMLDivElement>(null);
  const mapEl = useRef<HTMLDivElement>(null);
  const mapObj = useRef<any>(null);
  const boundsRef = useRef<any>(null);
  const markers = useRef<Record<string, any>>({});
  const inited = useRef(false);
  const [hover, setHover] = useState<string | null>(null);
  const [view, setView] = useState<View>("both");
  // The current filtered-browse URL, carried onto each listing link as `ref` so
  // that returning here (from the listing crumb or checkout) keeps the filters.
  const [ref, setRef] = useState("");
  useEffect(() => { setRef(window.location.pathname + window.location.search); }, []);
  // Clicking a card or a map pin opens a quick-view drawer — it never leaves the
  // results, so the filters + map position stay exactly as they are.
  const [quickId, setQuickId] = useState<string | null>(null);
  const linkTo = (sk: string) => {
    const base = `${routes.listing(sk)}${dateQuery}`;
    return ref ? `${base}${dateQuery ? "&" : "?"}ref=${encodeURIComponent(ref)}` : base;
  };
  // "Search as I move the map": when on, the list shows only listings inside the
  // map's current viewport. `box` is the live viewport (n/s/e/w) from map idle.
  const [moveSearch, setMoveSearch] = useState(true);
  const [box, setBox] = useState<{ north: number; south: number; east: number; west: number } | null>(null);
  const moveSearchRef = useRef(moveSearch);
  moveSearchRef.current = moveSearch;
  const priceBySk: Record<string, number | undefined> = Object.fromEntries(items.map((i) => [i.sk, i.price]));

  // "My location": the visitor's own coords (client-only — never in the URL). A
  // typed search (`origin`) always wins; otherwise we default to spots within 20
  // miles, nearest first, and let them widen to all spots.
  const [myLoc, setMyLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [showAll, setShowAll] = useState(false);
  const geoActive = !!myLoc && !origin && !showAll;

  useEffect(() => {
    if (origin) return;                                  // a searched center takes over
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    try { if (sessionStorage.getItem("stowbo-geo-denied") === "1") return; } catch { /* private mode */ }
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (pos) => { if (!cancelled) setMyLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }); },
      () => { try { sessionStorage.setItem("stowbo-geo-denied", "1"); } catch { /* ignore */ } },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 },
    );
    return () => { cancelled = true; };
  }, [origin]);

  const inBox = (it: BrowseItem) =>
    !box ? true : it.lat <= box.north && it.lat >= box.south && it.lng >= box.west && it.lng <= box.east;
  // Narrow to "near me" first (when active), then to the map viewport.
  const base = geoActive
    ? items.filter((it) => milesBetween(myLoc!, it) <= GEO_RADIUS_MI).sort((a, b) => milesBetween(myLoc!, a) - milesBetween(myLoc!, b))
    : items;
  const shown = moveSearch && box ? base.filter(inBox) : base;

  // Re-frame the map on the visitor + their nearby spots once geolocation lands.
  useEffect(() => {
    const g = window.google;
    if (!g?.maps || !mapObj.current || !geoActive || !myLoc) return;
    const b = new g.maps.LatLngBounds();
    b.extend({ lat: myLoc.lat, lng: myLoc.lng });
    items.filter((it) => milesBetween(myLoc, it) <= GEO_RADIUS_MI).forEach((it) => b.extend({ lat: it.lat, lng: it.lng }));
    mapObj.current.fitBounds(b, 60);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geoActive, myLoc]);

  useEffect(() => {
    if (!apiKey || !mapEl.current || inited.current) return;
    inited.current = true;
    const fallback = origin ?? { lat: 39.5, lng: -98.35 };

    // Build the map ONLY once its container actually has a non-zero size. A Google
    // raster map created at 0×0 (before the grid lays the column out) caches that
    // size and never loads tiles, even after later resize events — so we wait for
    // real dimensions first. This is the root fix for the blank split-view map.
    const build = () => {
      const el = mapEl.current;
      if (!el) return;
      const g = window.google;
      const map = new g.maps.Map(el, {
        center: { lat: 20, lng: 0 },
        zoom: 2,
        mapTypeId: "roadmap",
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
        zoomControl: false,          // rely on gestures — pinch on mobile, scroll on desktop
        gestureHandling: "greedy",   // one-finger pan + pinch-zoom on mobile
      });
      const bounds = new g.maps.LatLngBounds();
      for (const it of items) {
        const m = new g.maps.Marker({ position: { lat: it.lat, lng: it.lng }, map, icon: pinIcon(g, it.price, false), zIndex: 1 });
        m.addListener("mouseover", () => setHover(it.sk));
        m.addListener("mouseout", () => setHover(null));
        m.addListener("click", () => setQuickId(it.sk));
        markers.current[it.sk] = m;
        bounds.extend({ lat: it.lat, lng: it.lng });
      }
      // 0/1 result: synthesize a bounds box so fitBounds still frames a real area
      // (fitBounds is the op that actually forces tiles to paint).
      if (items.length <= 1) {
        const c = items.length === 1 ? { lat: items[0].lat, lng: items[0].lng } : fallback;
        const pad = items.length === 1 ? 0.04 : (origin ? 0.2 : 22);
        bounds.extend({ lat: c.lat - pad, lng: c.lng - pad });
        bounds.extend({ lat: c.lat + pad, lng: c.lng + pad });
      }
      map.fitBounds(bounds, 60);
      // Pan/zoom → update the visible viewport so the list can follow the map.
      map.addListener("idle", () => {
        if (!moveSearchRef.current) return;
        const b = map.getBounds();
        if (b) setBox(b.toJSON());
      });
      mapObj.current = map;
      boundsRef.current = bounds;

      // Keep it framed on any later size change (view toggle, window resize).
      const refit = () => { g.maps.event.trigger(map, "resize"); map.fitBounds(bounds, 60); };
      if (typeof ResizeObserver !== "undefined" && mapEl.current) {
        new ResizeObserver(() => refit()).observe(mapEl.current);
      }
    };

    loadGoogle(apiKey)
      .then(() => {
        const el = mapEl.current;
        if (!el) return;
        if (el.offsetWidth > 0 && el.offsetHeight > 0) { build(); return; }
        // Container not laid out yet — wait until it has real dimensions, then build.
        if (typeof ResizeObserver !== "undefined") {
          const ro = new ResizeObserver(() => {
            if (mapEl.current && mapEl.current.offsetWidth > 0 && mapEl.current.offsetHeight > 0) {
              ro.disconnect();
              build();
            }
          });
          ro.observe(el);
        } else {
          setTimeout(build, 300);
        }
      })
      .catch(() => { inited.current = false; });
  }, [items, apiKey, origin]);

  // When the map becomes visible after a view switch, it needs a resize + refit
  // or it renders as a grey 0-size tile.
  useEffect(() => {
    const g = window.google;
    if (!g?.maps || !mapObj.current || view === "list") return;
    const t = setTimeout(() => {
      g.maps.event.trigger(mapObj.current, "resize");
      if (boundsRef.current) mapObj.current.fitBounds(boundsRef.current, 60);
    }, 60);
    return () => clearTimeout(t);
  }, [view, items.length]);

  useEffect(() => {
    const g = window.google;
    if (!g?.maps) return;
    for (const [sk, m] of Object.entries(markers.current)) {
      const active = sk === hover;
      m.setIcon(pinIcon(g, priceBySk[sk], active));
      m.setZIndex(active ? 10 : 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hover]);

  return (
    <div className={`results view-${view}`} ref={resultsEl}>
      <div className="listcol">
        <div className="rhead">
          <div>
            <h1>{shown.length} {shown.length === 1 ? "space" : "spaces"}{geoActive ? " near you" : (moveSearch && box && shown.length !== items.length ? " in this area" : "")}</h1>
            <div className="cnt">Real spots with room to spare — verified &amp; Stowbo-protected.</div>
          </div>
          <label className="movesearch">
            <input type="checkbox" checked={moveSearch} onChange={(e) => setMoveSearch(e.target.checked)} />
            Search as I move the map
          </label>
        </div>
        {myLoc && !origin && (
          <div className="geobar">
            {showAll ? (
              <span><b>Showing all spots.</b> <button type="button" className="geolink" onClick={() => setShowAll(false)}>Back to near me</button></span>
            ) : (
              <span>
                <span className="geopin" aria-hidden>📍</span> Spots within <b>{GEO_RADIUS_MI} mi</b> of you, nearest first.
                {" "}<button type="button" className="geolink" onClick={() => setShowAll(true)}>Show all spots</button>
                <span className="geohint"> · search a city above to pick another area</span>
              </span>
            )}
          </div>
        )}
        {items.length === 0 && (
          <div className="browse-empty">
            <h3>No spaces here yet</h3>
            <p>Nothing matches — try a broader search, or check back as hosts add spaces.</p>
            <Link className="btn clay" href={routes.host}>Become a host →</Link>
          </div>
        )}
        {items.length > 0 && shown.length === 0 && (
          <div className="browse-empty">
            <h3>No spaces in this area</h3>
            <p>Zoom or drag the map to a different area, or turn off “Search as I move the map”.</p>
          </div>
        )}
        <div className="blist">
          {shown.map((it) => (
            <Link
              key={it.sk}
              className={`lcard${hover === it.sk ? " hov" : ""}`}
              href={linkTo(it.sk)}
              onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return; e.preventDefault(); setQuickId(it.sk); }}
              onMouseEnter={() => setHover(it.sk)}
              onMouseLeave={() => setHover(null)}
            >
              <div className="ph">
                {it.image ? (
                  <img src={it.image} alt={it.title} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                ) : (
                  <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", background: "linear-gradient(150deg,#e7efdf,#d7e3c8)" }}>
                    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth={1.4} style={{ opacity: 0.5 }}>
                      {isPark(it) ? (<><path d="M5 16l1.5-5h11L19 16" /><rect x="3" y="16" width="18" height="4" rx="1" /><circle cx="7" cy="20" r="1" /><circle cx="17" cy="20" r="1" /></>) : (<><path d="M3 8l9-4 9 4-9 4-9-4z" /><path d="M3 8v8l9 4 9-4V8" /><path d="M12 12v8" /></>)}
                    </svg>
                  </div>
                )}
                <span className="kind">{classLabel(it.spaceType)}</span>
                {it.capacity ? <span className="avail">{it.capacity} spaces</span> : null}
              </div>
              <div className="b">
                <div className="row1"><h3>{it.title}</h3></div>
                <div className="loc">{it.city || "—"} · {it.staffing}</div>
                <div className="specs">capacity {it.capacity}{it.size ? ` · ${it.size}` : ""} · {it.staffing}</div>
                {it.features.length > 0 && <div className="chiprow">{it.features.map((f, i) => <span key={i}>{f}</span>)}</div>}
                <div className="prrow">
                  <span className="pr">{it.price ? (<><small style={{ color: "var(--muted)" }}>from</small> <b>${it.price}</b> <small>/ {it.priceUnit}</small></>) : <small className="muted">Ask for pricing</small>}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
      <div className="mapcol">
        {items.length === 0 ? (
          <div className="map-empty">
            <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>
            <p>Spaces show up on the map here.<br />Try a broader search, or check back as hosts add spaces.</p>
          </div>
        ) : apiKey ? (
          <div ref={mapEl} style={{ width: "100%", height: "100%" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", background: "var(--bg-2)", color: "var(--muted)" }}>Map unavailable</div>
        )}
      </div>

      <div className="viewseg" role="group" aria-label="View">
        <button type="button" className={view === "list" ? "on" : ""} onClick={() => setView("list")}>List</button>
        <button type="button" className={view === "both" ? "on" : ""} onClick={() => setView("both")}>Both</button>
        <button type="button" className={view === "map" ? "on" : ""} onClick={() => setView("map")}>Map</button>
      </div>

      <QuickViewDrawer id={quickId} onClose={() => setQuickId(null)} />
    </div>
  );
}
