"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { I } from "./icons";
import { money, stars, type MarketCard } from "./shared";

declare global { interface Window { google?: any; __mkMapsLoading?: Promise<void> } }

function loadMaps(key: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.maps?.OverlayView) return Promise.resolve();
  if (window.__mkMapsLoading) return window.__mkMapsLoading;
  window.__mkMapsLoading = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src*="maps.googleapis.com"]') as HTMLScriptElement | null;
    const wait = () => { const t = setInterval(() => { if (window.google?.maps?.OverlayView) { clearInterval(t); resolve(); } }, 80); setTimeout(() => clearInterval(t), 15000); };
    if (existing) { wait(); return; }
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places`;
    s.async = true;
    s.onload = () => wait();
    s.onerror = () => reject(new Error("maps"));
    document.head.appendChild(s);
  });
  return window.__mkMapsLoading;
}

const STYLE = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#c9dde4" }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#f1f2ee" }] },
];

/** Map with a price pill per listing; hovering a card lifts its pill, a pill opens a mini card. */
export function BrowseMap({ cards, mapsKey, hover, linkQs = "", onArea, single = false, basePath = "/listing" }: {
  cards: MarketCard[]; mapsKey: string | null; hover?: string | null; linkQs?: string; basePath?: string;
  onArea?: (b: { swLat: number; swLng: number; neLat: number; neLng: number }) => void; single?: boolean;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const pins = useRef<Map<string, HTMLButtonElement>>(new Map());
  const overlays = useRef<any[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [moved, setMoved] = useState(false);
  const [failed, setFailed] = useState(false);
  const points = cards.filter((c) => c.lat != null && c.lng != null);
  const sig = points.map((c) => c.id).join(",");

  useEffect(() => {
    if (!mapsKey || !el.current) return;
    let live = true;
    loadMaps(mapsKey).then(() => {
      if (!live || !el.current) return;
      const g = window.google.maps;
      if (!map.current) {
        map.current = new g.Map(el.current, { center: { lat: 33, lng: -96 }, zoom: 5, styles: STYLE, disableDefaultUI: true, zoomControl: true, gestureHandling: single ? "cooperative" : "greedy", clickableIcons: false });
        if (!single) {
          let user = false;
          map.current.addListener("dragstart", () => { user = true; });
          map.current.addListener("zoom_changed", () => { if (user) setMoved(true); });
          map.current.addListener("dragend", () => setMoved(true));
          map.current.addListener("click", () => setSel(null));
        }
      }
      overlays.current.forEach((o) => o.setMap(null));
      overlays.current = [];
      pins.current.clear();
      class Pin extends g.OverlayView {
        c: MarketCard; div: HTMLButtonElement | null = null;
        constructor(c: MarketCard) { super(); this.c = c; }
        onAdd() {
          const b = document.createElement("button");
          b.type = "button";
          b.className = "mk-pin";
          b.textContent = single ? "" : this.c.price != null ? money(this.c.total ?? this.c.price) : this.c.title;
          if (single) { b.style.width = "44px"; b.style.height = "44px"; b.style.borderRadius = "50%"; b.style.background = "var(--primary)"; b.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" stroke-width="1.8"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/></svg>'; }
          b.addEventListener("click", (e) => { e.stopPropagation(); if (!single) setSel(this.c.id); });
          this.div = b;
          pins.current.set(this.c.id, b);
          this.getPanes().overlayMouseTarget.appendChild(b);
        }
        draw() {
          const p = this.getProjection().fromLatLngToDivPixel(new g.LatLng(this.c.lat, this.c.lng));
          if (p && this.div) { this.div.style.left = `${p.x}px`; this.div.style.top = `${p.y}px`; }
        }
        onRemove() { this.div?.remove(); this.div = null; }
      }
      for (const c of points) { const o = new Pin(c); o.setMap(map.current); overlays.current.push(o); }
      if (points.length === 1) { map.current.setCenter({ lat: points[0].lat, lng: points[0].lng }); map.current.setZoom(single ? 12 : 10); }
      else if (points.length > 1) {
        const b = new g.LatLngBounds();
        points.forEach((c) => b.extend({ lat: c.lat, lng: c.lng }));
        map.current.fitBounds(b, 56);
      }
      setMoved(false);
    }).catch(() => setFailed(true));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapsKey, sig]);

  useEffect(() => {
    pins.current.forEach((b, id) => b.classList.toggle("on", id === hover || id === sel));
  }, [hover, sel]);

  const card = sel ? cards.find((c) => c.id === sel) : null;

  return (
    <div className="mk-map">
      <div ref={el} style={{ position: "absolute", inset: 0 }} />
      {(!mapsKey || failed) && <div className="mk-map-fallback">Map unavailable right now</div>}
      {moved && onArea && map.current && (
        <button type="button" className="mk-btn sm" style={{ position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 4, background: "#fff", color: "var(--text)", boxShadow: "0 2px 10px rgba(0,0,0,.2)" }}
          onClick={() => { const b = map.current.getBounds(); if (!b) return; const sw = b.getSouthWest(), ne = b.getNorthEast(); onArea({ swLat: sw.lat(), swLng: sw.lng(), neLat: ne.lat(), neLng: ne.lng() }); setMoved(false); }}>
          {I.search} Search this area
        </button>
      )}
      {card && (
        <div className="mk-mapcard">
          <button type="button" className="x" aria-label="Close" onClick={() => setSel(null)}>✕</button>
          <Link href={`${basePath}/${card.id}${linkQs ? `?${linkQs}` : ""}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {card.image && <img src={card.image.replace("w=1600", "w=640")} alt={card.title} />}
            <div className="b">
              <div className="mk-card-t" style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><b>{card.title}</b>{card.rating.count > 0 && <span className="mk-star">{I.star}{stars(card.rating.average)}</span>}</div>
              <div className="mk-muted">{[card.city, card.state].filter(Boolean).join(", ")}</div>
              <div style={{ marginTop: 4 }}><b>{money(card.price)}</b> {card.unit}{card.total != null && card.span ? <span className="mk-muted"> · {money(card.total)} total</span> : null}</div>
            </div>
          </Link>
        </div>
      )}
    </div>
  );
}
