"use client";

import { useEffect, useState } from "react";
import { I } from "./icons";

/** Five-photo mosaic (desktop), swipe carousel (phone), and the all-photos view. */
export function Gallery({ images, title }: { images: string[]; title: string }) {
  const [all, setAll] = useState(false);
  const [idx, setIdx] = useState(1);
  useEffect(() => { document.body.style.overflow = all ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [all]);
  const five = images.slice(0, 5);
  const n = five.length;
  const sized = (u: string, w: number) => u.replace("w=1600", `w=${w}`);
  return (
    <>
      <div className={`mk-mosaic${n < 5 ? ` n${Math.min(n, 3)}` : ""}`}>
        {five.map((u, i) => (
          <button type="button" key={u} className={i === 0 ? "big" : ""} onClick={() => setAll(true)} aria-label={`Photo ${i + 1} of ${images.length}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={sized(u, i === 0 ? 1400 : 800)} alt={i === 0 ? title : ""} />
          </button>
        ))}
        {images.length > 1 && <button type="button" className="mk-allphotos" onClick={() => setAll(true)}>{I.grid} Show all photos</button>}
      </div>
      <div className="mk-carousel">
        <div className="mk-carousel-track" onScroll={(e) => { const t = e.currentTarget; setIdx(Math.round(t.scrollLeft / t.clientWidth) + 1); }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {images.map((u, i) => <img key={u} src={sized(u, 900)} alt={i === 0 ? title : ""} onClick={() => setAll(true)} loading={i < 2 ? "eager" : "lazy"} />)}
        </div>
        <span className="count">{idx} / {images.length}</span>
      </div>
      {all && (
        <div className="mk mk-lb" role="dialog" aria-modal="true" aria-label="All photos">
          <div className="mk-lb-h">
            <button type="button" aria-label="Close" onClick={() => setAll(false)}>{I.left}</button>
            <span className="mk-muted" style={{ fontSize: 14 }}>{images.length} photos</span>
            <span style={{ width: 36 }} />
          </div>
          <div className="mk-lb-b">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {images.map((u, i) => <img key={u} src={sized(u, 1400)} alt={`${title} — photo ${i + 1}`} loading="lazy" />)}
          </div>
        </div>
      )}
    </>
  );
}
