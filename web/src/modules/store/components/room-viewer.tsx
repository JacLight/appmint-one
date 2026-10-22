"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/** Appmint One: "shop the room" — the shop's own in-room photos, one at a time, with a
 *  pin on each piece it sells. A pin opens a small card (photo, name, price, link); the
 *  first pin starts open, so the card shows without anyone finding the dot. */
export type RoomPiece = { slug: string; name: string; price: string; image?: string; href: string };
export type RoomVM = { label: string; image: string; href: string; pins: { x: number; y: number; piece: RoomPiece }[] };

export function RoomViewer({ rooms }: { rooms: RoomVM[] }) {
  const [at, setAt] = useState(0);
  const [open, setOpen] = useState<number | null>(0);
  const room = rooms[at];

  useEffect(() => { setOpen(0); }, [at]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!room) return null;
  return (
    <div className="sf-room">
      <div className="sf-room-stage">
        {rooms.map((r, i) => (
          <img key={r.image} src={r.image} alt={r.label} className={i === at ? "on" : ""} loading={i === 0 ? "eager" : "lazy"} />
        ))}
        {room.pins.map((p, i) => (
          <div key={`${at}-${i}`} className={`sf-pin${open === i ? " open" : ""}`} style={{ left: `${p.x}%`, top: `${p.y}%` }}>
            <button type="button" aria-expanded={open === i} aria-label={`${p.piece.name}, ${p.piece.price}`} onClick={() => setOpen(open === i ? null : i)}>
              <span aria-hidden="true" />
            </button>
          </div>
        ))}
        {open != null && room.pins[open] && (() => {
          const p = room.pins[open];
          // Beside its pin on a wide screen (on whichever side has room); along the photo's foot on a phone.
          const side = p.x > 55 ? { right: `calc(${100 - p.x}% + 30px)` } : { left: `calc(${p.x}% + 30px)` };
          return (
            <Link key={`${at}-card`} href={p.piece.href} className="sf-pin-card" style={{ ...side, top: `${p.y}%` }}>
              {p.piece.image && <img src={p.piece.image} alt="" />}
              <span><b>{p.piece.name}</b><em>{p.piece.price}</em><u>View piece</u></span>
            </Link>
          );
        })()}
        <span className="sf-room-tag">Shop the room</span>
      </div>
      <div className="sf-room-bar">
        <div className="sf-room-tabs" role="tablist" aria-label="Rooms">
          {rooms.map((r, i) => (
            <button key={r.label + i} type="button" role="tab" aria-selected={i === at} className={i === at ? "on" : ""} onClick={() => setAt(i)}>
              <img src={r.image} alt="" />{r.label}
            </button>
          ))}
        </div>
        <Link className="sf-link" href={room.href}>Shop {room.label.toLowerCase()}</Link>
      </div>
    </div>
  );
}

/** Appmint One: the rooms as one edge-to-edge rail — each photo at its own shape and
 *  near its own size (so it stays sharp), numbered and labelled underneath, pins live.
 *  Drag, swipe or use the arrows; one product card is open at a time. */
export function RoomRail({ rooms }: { rooms: RoomVM[] }) {
  const rail = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<string | null>(rooms[0]?.pins.length ? "0-0" : null);
  const step = (dir: 1 | -1) => {
    const el = rail.current;
    const first = el?.firstElementChild as HTMLElement | null;
    if (el && first) el.scrollBy({ left: dir * (first.offsetWidth + 12), behavior: "smooth" });
  };
  return (
    <div className="sf-rr">
      <div ref={rail} className="sf-rr-track">
        {rooms.map((r, ri) => (
          <figure key={r.image} className="sf-rr-room">
            <div className="sf-rr-photo">
              <img src={r.image} alt={r.label} loading={ri < 2 ? "eager" : "lazy"} />
              {r.pins.map((p, i) => {
                const k = `${ri}-${i}`;
                const side = p.x > 55 ? { right: `calc(${100 - p.x}% + 28px)` } : { left: `calc(${p.x}% + 28px)` };
                return (
                  <div key={k}>
                    <div className={`sf-pin${open === k ? " open" : ""}`} style={{ left: `${p.x}%`, top: `${p.y}%` }}>
                      <button type="button" aria-expanded={open === k} aria-label={`${p.piece.name}, ${p.piece.price}`} onClick={() => setOpen(open === k ? null : k)}>
                        <span aria-hidden="true" />
                      </button>
                    </div>
                    {open === k && (
                      <Link href={p.piece.href} className="sf-pin-card" style={{ ...side, top: `${p.y}%` }}>
                        {p.piece.image && <img src={p.piece.image} alt="" />}
                        <span><b>{p.piece.name}</b><em>{p.piece.price}</em><u>View piece</u></span>
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
            <figcaption>
              <span className="n">{String(ri + 1).padStart(2, "0")}</span>
              <b>{r.label}</b>
              <Link href={r.href}>Shop the room</Link>
            </figcaption>
          </figure>
        ))}
      </div>
      {rooms.length > 1 && (
        <div className="sf-rr-nav">
          <button type="button" onClick={() => step(-1)} aria-label="Previous room"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg></button>
          <button type="button" onClick={() => step(1)} aria-label="Next room"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg></button>
        </div>
      )}
    </div>
  );
}
