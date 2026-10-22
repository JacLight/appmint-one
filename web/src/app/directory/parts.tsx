import Link from "next/link";
import type { CSSProperties } from "react";
import type { Entry } from "./data";
import { liveUrl } from "./data";

export const FONTS = "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap";

/** Brand colour for the shot backdrop. */
export const tint = (e: Entry) => ({ "--b": e.brand, "--bi": e.brandInk } as CSSProperties);

export function TopBar({ q = "", c }: { q?: string; c?: string }) {
  return (
    <header className="dx-top">
      <Link href="/directory" className="dx-logo" aria-label="Appmint One directory">
        <span className="dx-logo-mark" aria-hidden="true" />Appmint One
      </Link>
      <form action="/directory" className="dx-search" role="search">
        {c && <input type="hidden" name="c" value={c} />}
        <input name="q" defaultValue={q} placeholder="Search apps, like “Airbnb” or “tickets”" aria-label="Search apps" />
        <button aria-label="Search">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        </button>
      </form>
      <p className="dx-top-note">One app · one engine · every business</p>
    </header>
  );
}

/** The brand mark: the business's initial on its own colour. */
export function Mark({ e, size = 24 }: { e: Entry; size?: number }) {
  return <span className="dx-mark" style={{ ...tint(e), width: size, height: size, fontSize: size * 0.46 }} aria-hidden="true">{e.name.replace(/[^A-Za-z]/g, "").charAt(0)}</span>;
}

/** A composed "shot": the desktop screen and the phone on the brand's backdrop. */
export function Shot({ e, big = false }: { e: Entry; big?: boolean }) {
  return (
    <div className={big ? "dx-shot dx-shot-big" : "dx-shot"} style={tint(e)}>
      {e.cover && <img className="dx-shot-desk" src={e.cover} alt="" loading={big ? "eager" : "lazy"} />}
      {e.phone && <img className="dx-shot-phone" src={e.phone} alt="" loading={big ? "eager" : "lazy"} />}
    </div>
  );
}

export function Card({ e, host }: { e: Entry; host: string }) {
  return (
    <li className="dx-card">
      <div className="dx-card-media">
        <Link href={`/directory/${e.id}`} aria-label={`${e.name}, ${e.category}`}><Shot e={e} /></Link>
        <div className="dx-hover">
          <p className="dx-hover-pitch">{e.customer.slice(0, 3).join(" · ")}</p>
          <div className="dx-hover-row">
            <Link href={`/directory/${e.id}`} className="dx-btn dx-btn-light">View details</Link>
            <a href={liveUrl(host, e.id)} target="_blank" rel="noreferrer" className="dx-btn dx-btn-light">Try it live ↗</a>
          </div>
        </div>
      </div>
      <div className="dx-meta">
        <Link href={`/directory/${e.id}`} className="dx-meta-name"><Mark e={e} /> <b>{e.name}</b></Link>
        <span className="dx-badge">{e.category}</span>
        <span className="dx-count" title={`${e.screens.length} screens`}>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="14" rx="2" /><path d="M8 21h8" /></svg>
          {e.screens.length}
        </span>
      </div>
      <p className="dx-like">Like {e.like}</p>
    </li>
  );
}
