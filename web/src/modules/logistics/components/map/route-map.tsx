"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The muvmnt map: Google Maps JS with the org's key (getMapsKey on the server — never
 * hard-coded). Draws the pickup (dot), the drop-off (square), the road route between
 * them, and the driver when there is a live position. With no key, a blocked key or a
 * failed load it renders a clean fallback instead of a grey box.
 */

type LatLng = { lat: number; lng: number };

declare global {
  interface Window {
    google?: any;
    __gmapsLoading?: Promise<void>;
    __gmapsFailed?: boolean;
    gm_authFailure?: () => void;
  }
}

const listeners = new Set<() => void>();

export function loadGoogleMaps(key: string): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.__gmapsFailed) return Promise.reject(new Error("maps auth failed"));
  if (window.google?.maps?.Map) return Promise.resolve();
  if (window.__gmapsLoading) return window.__gmapsLoading;
  const prev = window.gm_authFailure;
  window.gm_authFailure = () => {
    window.__gmapsFailed = true;
    listeners.forEach((f) => f());
    prev?.();
  };
  window.__gmapsLoading = new Promise<void>((resolve, reject) => {
    const wait = () => {
      const t0 = Date.now();
      const iv = setInterval(() => {
        if (window.google?.maps?.Map) { clearInterval(iv); resolve(); }
        else if (Date.now() - t0 > 15000) { clearInterval(iv); reject(new Error("maps timeout")); }
      }, 80);
    };
    if (document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]')) { wait(); return; }
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places`;
    s.async = true;
    s.onload = wait;
    s.onerror = () => reject(new Error("maps failed to load"));
    document.head.appendChild(s);
  });
  window.__gmapsLoading.catch(() => { window.__gmapsLoading = undefined; });
  return window.__gmapsLoading;
}

/** Subscribe to a key/billing failure Google reports after the script loaded. */
export function onMapsAuthFailure(f: () => void): () => void {
  listeners.add(f);
  return () => { listeners.delete(f); };
}

/** Quiet, low-contrast basemap so the route reads first. */
export const MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#f2f2ee" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#6b6d66" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#f6f6f2" }] },
  { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#e7e8e1" }] },
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#dcebd9" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road.arterial", elementType: "labels.text.fill", stylers: [{ color: "#808279" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#e3e3dc" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#5d5f58" }] },
  { featureType: "road.local", elementType: "labels.text.fill", stylers: [{ color: "#9a9c94" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#cfdde3" }] },
];

const svgUrl = (svg: string) => "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
const PIN_PICKUP = svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26"><circle cx="13" cy="13" r="11" fill="#111"/><circle cx="13" cy="13" r="4.5" fill="#fff"/></svg>`);
const PIN_DROP = svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26"><rect x="2" y="2" width="22" height="22" rx="3" fill="#111"/><rect x="9" y="9" width="8" height="8" fill="#fff"/></svg>`);
const PIN_DRIVER = svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44"><circle cx="22" cy="22" r="20" fill="#00e07a" opacity=".25"/><circle cx="22" cy="22" r="13" fill="#111"/><path d="M15.5 25h13M16.5 25l1.4-5h8.2l1.4 5M18 22.5h.01M26 22.5h.01" stroke="#fff" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg>`);

export interface RouteMapProps {
  apiKey: string | null;
  pickup?: LatLng | null;
  dropoff?: LatLng | null;
  driver?: LatLng | null;
  /** Where to look before there is a route. */
  center?: LatLng | null;
  /** Extra room around the route for panels laid over the map (px). */
  padding?: { top?: number; right?: number; bottom?: number; left?: number };
  /** Shown in the fallback when the map can't load. */
  fromLabel?: string;
  toLabel?: string;
  className?: string;
  zoom?: number;
}

const ok = (p?: LatLng | null): p is LatLng => !!p && Number.isFinite(p.lat) && Number.isFinite(p.lng);

export function RouteMap({ apiKey, pickup, dropoff, driver, center, padding, fromLabel, toLabel, className, zoom = 13 }: RouteMapProps) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const layers = useRef<any[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "failed">(apiKey ? "loading" : "failed");

  // Load once.
  useEffect(() => {
    if (!apiKey) { setState("failed"); return; }
    let alive = true;
    const off = onMapsAuthFailure(() => alive && setState("failed"));
    loadGoogleMaps(apiKey)
      .then(() => {
        if (!alive || !el.current) return;
        const g = window.google;
        map.current = new g.maps.Map(el.current, {
          center: ok(center) ? center : ok(pickup) ? pickup : { lat: 32.7831, lng: -96.8067 },
          zoom,
          styles: MAP_STYLE,
          disableDefaultUI: true,
          zoomControl: true,
          zoomControlOptions: { position: g.maps.ControlPosition.RIGHT_BOTTOM },
          gestureHandling: "cooperative",
          clickableIcons: false,
        });
        setState(window.__gmapsFailed ? "failed" : "ready");
      })
      .catch(() => alive && setState("failed"));
    return () => { alive = false; off(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  // Draw the route / pins whenever they change.
  const key = JSON.stringify([pickup, dropoff, driver, center]);
  useEffect(() => {
    const g = window.google;
    if (state !== "ready" || !g?.maps || !map.current) return;
    layers.current.forEach((l) => l.setMap(null));
    layers.current = [];
    const m = map.current;
    const add = (o: any) => { layers.current.push(o); return o; };
    const pin = (pos: LatLng, url: string, size: number, z: number) =>
      add(new g.maps.Marker({ position: pos, map: m, zIndex: z, icon: { url, scaledSize: new g.maps.Size(size, size), anchor: new g.maps.Point(size / 2, size / 2) } }));
    const bounds = new g.maps.LatLngBounds();
    let any = false;
    if (ok(pickup)) { pin(pickup, PIN_PICKUP, 24, 3); bounds.extend(pickup); any = true; }
    if (ok(dropoff)) { pin(dropoff, PIN_DROP, 24, 3); bounds.extend(dropoff); any = true; }
    if (ok(driver)) { pin(driver, PIN_DRIVER, 44, 5); bounds.extend(driver); any = true; }
    // Side padding is for the desktop overlay panel; on a narrow map (phone, panel below)
    // it would leave no room and Google zooms out to the whole region.
    const narrow = (el.current?.clientWidth ?? 1000) < 760;
    const pad = narrow ? { top: 70, right: 36, bottom: 50, left: 36 } : { top: 60, right: 60, bottom: 60, left: 60, ...padding };

    const line = (path: any[]) => {
      add(new g.maps.Polyline({ path, map: m, strokeColor: "#111111", strokeOpacity: 1, strokeWeight: 5, zIndex: 2 }));
      path.forEach((p: any) => bounds.extend(p));
      m.fitBounds(bounds, pad);
    };
    if (ok(pickup) && ok(dropoff)) {
      let alive = true;
      try {
        new g.maps.DirectionsService().route(
          { origin: pickup, destination: dropoff, travelMode: g.maps.TravelMode.DRIVING },
          (res: any, status: string) => {
            if (!alive) return;
            if (status === "OK" && res?.routes?.[0]?.overview_path?.length) line(res.routes[0].overview_path);
            else line([pickup, dropoff]);
          },
        );
      } catch { line([pickup, dropoff]); }
      return () => { alive = false; };
    }
    if (any) {
      if (layers.current.length > 1) m.fitBounds(bounds, pad);
      else { m.setCenter(bounds.getCenter()); m.setZoom(15); }
    } else if (ok(center)) {
      m.setCenter(center);
      m.setZoom(zoom);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, key]);

  return (
    <div className={`mv-map ${className || ""}`}>
      <div ref={el} className="mv-map-canvas" aria-label="Map" role="img" style={state === "failed" ? { display: "none" } : undefined} />
      {state === "loading" && <div className="mv-map-loading" aria-hidden />}
      {state === "failed" && <MapFallback from={fromLabel} to={toLabel} />}
    </div>
  );
}

/** What shows when the map can't load: the route as text on a quiet street grid. */
export function MapFallback({ from, to }: { from?: string; to?: string }) {
  return (
    <div className="mv-map-fallback">
      <svg className="mv-map-grid" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden>
        {[30, 85, 150, 205, 262].map((y) => <line key={`h${y}`} x1="0" x2="400" y1={y} y2={y + 14} />)}
        {[40, 120, 190, 270, 345].map((x) => <line key={`v${x}`} x1={x} x2={x - 20} y1="0" y2="300" />)}
        <path className="mv-map-grid-main" d="M-10 220 C 90 200, 160 120, 410 90" />
      </svg>
      {(from || to) && (
        <div className="mv-map-fallback-card">
          {from && <div><i className="mv-pin pu" />{from}</div>}
          {to && <div><i className="mv-pin dr" />{to}</div>}
        </div>
      )}
    </div>
  );
}
