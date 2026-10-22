"use client";

import Link from "next/link";
import { useState } from "react";
import { I } from "./icons";
import { money, stars, type MarketCard } from "./shared";

/** A listing card: photo carousel, title + rating, place, facts, the posted rate — and,
 *  when dates are chosen, the server's total for those dates. */
export function StayCard({ c, href, onHover, priority = false }: { c: MarketCard; href: string; onHover?: (id: string | null) => void; priority?: boolean }) {
  const imgs = c.images.length ? c.images : c.image ? [c.image] : [];
  const [i, setI] = useState(0);
  const step = (d: number) => (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); setI((x) => (x + d + imgs.length) % imgs.length); };
  const place = [c.city, c.state].filter(Boolean).join(", ");
  return (
    <Link className="mk-card" href={href} onMouseEnter={() => onHover?.(c.id)} onMouseLeave={() => onHover?.(null)}>
      <div className="mk-card-ph">
        {imgs[i] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imgs[i].replace("w=1600", "w=720")} alt={c.title} loading={priority ? "eager" : "lazy"} />
        ) : null}
        {c.badge && <span className="mk-badge">{c.badge}</span>}
        {imgs.length > 1 && (
          <>
            <button type="button" className="mk-ph-nav p" aria-label="Previous photo" onClick={step(-1)}>{I.left}</button>
            <button type="button" className="mk-ph-nav n" aria-label="Next photo" onClick={step(1)}>{I.right}</button>
            <div className="mk-dots">{imgs.map((_, k) => <i key={k} className={k === i ? "on" : ""} />)}</div>
          </>
        )}
      </div>
      <div className="mk-card-b">
        <div className="mk-card-t">
          <b>{c.title}</b>
          {c.rating.count > 0 && <span className="mk-star">{I.star}{stars(c.rating.average)} <span className="mk-muted">({c.rating.count})</span></span>}
        </div>
        <div className="sub">{[c.typeLabel, place].filter(Boolean).join(" in ")}</div>
        {c.facts.length > 0 && <div className="sub">{c.facts.slice(0, 3).join(" · ")}</div>}
        <div className="price">
          {c.price != null && <><b>{money(c.price)}</b> {c.unit}</>}
          {c.total != null && c.span && <span className="tot">· {money(c.total)} total for {c.span}</span>}
        </div>
      </div>
    </Link>
  );
}
