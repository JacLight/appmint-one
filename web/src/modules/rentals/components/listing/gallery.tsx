"use client";

import { useCallback, useEffect, useState } from "react";

/** Photo gallery.
 *  Desktop: big main image + prev/next arrows + clickable thumbnails (main swaps,
 *  no lightbox); left/right arrow keys also navigate.
 *  Mobile: full-width, swipeable slide carousel (scroll-snap) — no thumbnails. */
export function ListingGallery({ photos, title }: { photos: string[]; title?: string }) {
  const [active, setActive] = useState(0);
  const n = photos.length;

  const go = useCallback((dir: number) => setActive((a) => (a + dir + n) % n), [n]);

  useEffect(() => {
    if (n < 2) return;
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && /^(input|select|textarea)$/i.test(t.tagName)) return; // don't hijack form typing
      if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, n]);

  if (!n) return <div className="pdg-empty">No photos yet</div>;

  const Arrow = ({ dir, label, d }: { dir: number; label: string; d: string }) => (
    <button type="button" className={`pdg-arrow pdg-arrow-${dir > 0 ? "next" : "prev"}`} onClick={() => go(dir)} aria-label={label}>
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={2.2}><path d={d} /></svg>
    </button>
  );

  return (
    <div className="pdg">
      {/* desktop */}
      <div className="pdg-desk">
        <div className="pdg-hero">
          <img src={photos[active]} alt={title} loading="eager" />
          {n > 1 && (
            <>
              <Arrow dir={-1} label="Previous photo" d="M15 5l-7 7 7 7" />
              <Arrow dir={1} label="Next photo" d="M9 5l7 7-7 7" />
              <div className="pdg-count">{active + 1} / {n}</div>
            </>
          )}
        </div>
        {n > 1 && (
          <div className="pdg-strip">
            {photos.map((p, i) => (
              <button type="button" key={i} className={`pdg-thumb${i === active ? " on" : ""}`} onClick={() => setActive(i)} aria-label={`Show photo ${i + 1}`}>
                <img src={p} alt={`${title ?? "Photo"} ${i + 1}`} loading="lazy" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* mobile: swipe slides */}
      <div className="pdg-slides">
        {photos.map((p, i) => (
          <div className="pdg-slide" key={i}><img src={p} alt={`${title ?? "Photo"} ${i + 1}`} loading={i === 0 ? "eager" : "lazy"} /></div>
        ))}
      </div>
    </div>
  );
}
