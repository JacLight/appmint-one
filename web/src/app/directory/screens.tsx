"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import type { Screen } from "./catalog";

/** Every screen, stacked like a shot page; any one opens full screen at its real length. */
export function Screens({ screens, name, style }: { screens: Screen[]; name: string; style: CSSProperties }) {
  const [at, setAt] = useState<number | null>(null);
  const close = useCallback(() => setAt(null), []);
  const step = useCallback((d: number) => setAt((i) => (i === null ? i : (i + d + screens.length) % screens.length)), [screens.length]);

  useEffect(() => {
    if (at === null) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") close();
      if (ev.key === "ArrowRight") step(1);
      if (ev.key === "ArrowLeft") step(-1);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [at, close, step]);

  const s = at === null ? null : screens[at];
  return (
    <>
      <ol className="dx-stack">
        {screens.map((x, i) => (
          <li key={x.src}>
            <button type="button" className="dx-panel" style={style} onClick={() => setAt(i)} aria-label={`Open ${x.caption} full screen`}>
              <img src={x.src} alt={`${name}: ${x.caption}`} loading={i < 2 ? "eager" : "lazy"} />
            </button>
            <p className="dx-panel-cap"><span>{String(i + 1).padStart(2, "0")}</span>{x.caption}</p>
          </li>
        ))}
      </ol>

      {s && at !== null && (
        <div className="dx-lb" role="dialog" aria-modal="true" aria-label={`${name}: ${s.caption}`} onClick={close}>
          <div className="dx-lb-bar" onClick={(ev) => ev.stopPropagation()}>
            <b>{s.caption}</b>
            <span>{at + 1} / {screens.length}</span>
            <button type="button" onClick={close} aria-label="Close">✕</button>
          </div>
          <div className="dx-lb-scroll" onClick={(ev) => ev.stopPropagation()}>
            <img key={s.src} src={s.src} alt={`${name}: ${s.caption}`} />
          </div>
          <button type="button" className="dx-lb-nav dx-lb-prev" onClick={(ev) => { ev.stopPropagation(); step(-1); }} aria-label="Previous screen">‹</button>
          <button type="button" className="dx-lb-nav dx-lb-next" onClick={(ev) => { ev.stopPropagation(); step(1); }} aria-label="Next screen">›</button>
        </div>
      )}
    </>
  );
}
