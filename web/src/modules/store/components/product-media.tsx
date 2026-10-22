"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { createPortal } from "react-dom";

/** Appmint One: product page media (images and videos).
 *  Wide screens: every photo on the page at once — the first full width, the rest two
 *  across — so the in-room shots and close-ups are seen without hunting for them.
 *  Phones (and the course card): one swipeable slider with dots.
 *  Any photo opens the viewer: full screen, swipe or arrow keys between photos, the
 *  thumbnails along the foot, and a click (or tap) to zoom in and pan around the detail. */
export type MediaItem = { url: string; alt?: string; video?: boolean };

const VIDEO_EXT = /\.(mp4|webm|mov|m4v|ogv)$/i;

/** An image entry is a video when its contentType says so or its URL ends in a video extension. */
export function isVideo(entry: unknown): boolean {
  if (!entry) return false;
  if (typeof entry === "string") return VIDEO_EXT.test(entry.split("?")[0]);
  const e = entry as { url?: string; contentType?: string; mimeType?: string; type?: string };
  const t = e.contentType || e.mimeType || e.type || "";
  return t.startsWith("video/") || VIDEO_EXT.test((e.url || "").split("?")[0]);
}

/** The product's raw image entries keyed by URL, so the slider knows which processed images are videos. */
export function toMedia(images: { url: string; alt?: string }[], raw: unknown[] = []): MediaItem[] {
  const videos = new Set((raw || []).filter(isVideo).map((r) => (typeof r === "string" ? r : (r as { url: string }).url)));
  return images.filter((i) => i.url).map((i) => ({ ...i, video: videos.has(i.url) || isVideo(i.url) }));
}

const Chevron = ({ dir, size = 20 }: { dir: 1 | -1; size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={dir > 0 ? "M9 5l7 7-7 7" : "M15 5l-7 7 7 7"} />
  </svg>
);
const Expand = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
  </svg>
);

function Media({ m, i, name, eager, fit }: { m: MediaItem; i: number; name: string; eager?: boolean; fit?: "cover" | "contain" }) {
  return m.video ? (
    <video data-i={i} src={m.url} muted loop playsInline autoPlay preload={eager ? "auto" : "metadata"} style={fit ? { objectFit: fit } : undefined} />
  ) : (
    <img src={m.url} alt={m.alt || `${name} ${i + 1}`} loading={eager ? "eager" : "lazy"} draggable={false} style={fit ? { objectFit: fit } : undefined} />
  );
}

export function ProductMedia({ items, name, rail = true }: { items: MediaItem[]; name: string; rail?: boolean }) {
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [viewer, setViewer] = useState<number | null>(null);
  const n = items.length;

  const go = useCallback((i: number) => {
    const el = track.current;
    if (!el || !n) return;
    const next = (i + n) % n;
    el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
    setActive(next);
  }, [n]);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setActive(Math.round(el.scrollLeft / Math.max(1, el.clientWidth))));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => { el.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, []);

  // A new variation can bring other images: back to the first.
  const key = items.map((i) => i.url).join("|");
  useEffect(() => { track.current?.scrollTo({ left: 0 }); setActive(0); }, [key]);

  if (!n) return <div className="sf-media-empty" />;

  return (
    <div className={`sf-media${rail ? " is-gallery" : ""}`}>
      {/* Wide screens: the whole set, laid out. */}
      {rail && (
        <div className={`sf-media-grid n${Math.min(n, 4)}`}>
          {items.map((m, i) => (
            <button key={m.url + i} type="button" className="sf-media-cell" onClick={() => setViewer(i)} aria-label={`View ${m.video ? "video" : "photo"} ${i + 1} of ${n} full screen`}>
              <Media m={m} i={i} name={name} eager={i < 3} />
              <span className="sf-media-zoom" aria-hidden="true"><Expand /></span>
            </button>
          ))}
        </div>
      )}

      {/* Phones and narrow cards: one slider. */}
      <div className="sf-media-stage">
        <div ref={track} className="sf-media-track">
          {items.map((m, i) => (
            <button key={m.url + i} type="button" className="sf-media-slide" onClick={() => setViewer(i)} aria-label={`View ${m.video ? "video" : "photo"} ${i + 1} of ${n} full screen`}>
              <Media m={m} i={i} name={name} eager={i === 0} />
            </button>
          ))}
        </div>
        {n > 1 && (
          <>
            <button type="button" className="sf-media-arrow prev" onClick={() => go(active - 1)} aria-label="Previous"><Chevron dir={-1} /></button>
            <button type="button" className="sf-media-arrow next" onClick={() => go(active + 1)} aria-label="Next"><Chevron dir={1} /></button>
            <div className="sf-media-count" aria-live="polite">{active + 1} / {n}</div>
            <div className="sf-media-dots" aria-hidden="true">{items.map((_, i) => <span key={i} className={i === active ? "on" : ""} />)}</div>
          </>
        )}
        <span className="sf-media-zoom stage" aria-hidden="true"><Expand /></span>
      </div>

      {viewer !== null && <Viewer items={items} name={name} start={viewer} onClose={() => setViewer(null)} />}
    </div>
  );
}

/** Full-screen viewer: swipe/arrows between photos, thumbnails, click to zoom and pan. */
function Viewer({ items, name, start, onClose }: { items: MediaItem[]; name: string; start: number; onClose: () => void }) {
  const track = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const [at, setAt] = useState(start);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const n = items.length;

  const go = useCallback((i: number, smooth = true) => {
    const el = track.current;
    if (!el) return;
    const next = Math.max(0, Math.min(n - 1, i));
    setZoom(null);
    el.scrollTo({ left: next * el.clientWidth, behavior: smooth ? "smooth" : "auto" });
    setAt(next);
  }, [n]);

  useEffect(() => {
    go(start, false);
    closeBtn.current?.focus();
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    return () => { html.style.overflow = prev; };
  }, [go, start]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { if (zoom) setZoom(null); else onClose(); }
      else if (e.key === "ArrowRight") go(at + 1);
      else if (e.key === "ArrowLeft") go(at - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [at, go, onClose, zoom]);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setAt(Math.round(el.scrollLeft / Math.max(1, el.clientWidth))));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => { el.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, []);

  const down = useRef<{ x: number; y: number } | null>(null);
  const point = (e: RPointerEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 };
  };

  return createPortal(
    <div className="sf-viewer" role="dialog" aria-modal="true" aria-label={`${name} photos`}>
      <div className="sf-viewer-top">
        <span>{name}</span>
        <span className="count">{at + 1} / {n}</span>
        <button ref={closeBtn} type="button" onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>

      <div ref={track} className={`sf-viewer-track${zoom ? " locked" : ""}`}>
        {items.map((m, i) => (
          <div key={m.url + i} className="sf-viewer-slide">
            {m.video ? (
              <video src={m.url} controls playsInline autoPlay={i === start} muted loop />
            ) : (
              <img
                src={m.url}
                alt={m.alt || `${name} ${i + 1}`}
                draggable={false}
                className={zoom && i === at ? "zoomed" : ""}
                style={zoom && i === at ? { transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined}
                onPointerDown={(e) => { down.current = { x: e.clientX, y: e.clientY }; }}
                onPointerUp={(e) => {
                  // A tap or click zooms in (or back out); a swipe between photos does not.
                  const d = down.current;
                  if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) return;
                  setZoom(zoom ? null : point(e));
                }}
                onPointerMove={(e) => { if (zoom && e.pointerType !== "touch") setZoom(point(e)); }}
              />
            )}
          </div>
        ))}
      </div>

      {n > 1 && (
        <>
          <button type="button" className="sf-viewer-arrow prev" onClick={() => go(at - 1)} disabled={at === 0} aria-label="Previous photo"><Chevron dir={-1} size={26} /></button>
          <button type="button" className="sf-viewer-arrow next" onClick={() => go(at + 1)} disabled={at === n - 1} aria-label="Next photo"><Chevron dir={1} size={26} /></button>
          <div className="sf-viewer-thumbs" role="tablist" aria-label="Photos">
            {items.map((m, i) => (
              <button key={m.url + i} type="button" role="tab" aria-selected={i === at} className={i === at ? "on" : ""} onClick={() => go(i)} aria-label={`Photo ${i + 1}`}>
                {m.video ? <video src={`${m.url}#t=0.5`} muted playsInline preload="metadata" /> : <img src={m.url} alt="" loading="lazy" />}
              </button>
            ))}
          </div>
        </>
      )}
      <p className="sf-viewer-hint">{zoom ? "Move to look around · click or tap to zoom out" : "Click or tap the photo to zoom in"}</p>
    </div>,
    document.body,
  );
}
