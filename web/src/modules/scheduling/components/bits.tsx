import Link from "next/link";
import { initials, keyParts } from "../lib/format";
import type { TeamMember } from "../lib/types";

const PATHS: Record<string, string> = {
  clock: "M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z",
  pin: "M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  phone: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2",
  arrow: "M5 12h14M13 6l6 6-6 6",
  back: "M19 12H5M11 6l-6 6 6 6",
  check: "M5 12l5 5L20 7",
  video: "M3 7h12v10H3zM15 10l6-3v10l-6-3",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
  users: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M16 3.5a4 4 0 0 1 0 7.5M18 14a6 6 0 0 1 4 7",
  card: "M3 6h18v12H3zM3 10h18",
  doc: "M7 3h7l5 5v13H7zM14 3v5h5M9 13h6M9 17h6",
  chat: "M4 5h16v11H8l-4 4z",
  cal: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
  flag: "M5 21V4h11l-1.5 4L16 12H5",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
  spark: "M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6",
  plus: "M12 5v14M5 12h14",
  x: "M6 6l12 12M18 6L6 18",
  door: "M6 3h10v18H6zM13 12h.01",
  scale: "M12 3v18M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0zM8 21h8",
};

export function Ic({ n, size = 18 }: { n: keyof typeof PATHS | string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={PATHS[n] || PATHS.spark} />
    </svg>
  );
}

export function Img({ src, alt = "", className, w = 900 }: { src?: string; alt?: string; className?: string; w?: number }) {
  if (!src) return <span className={`sc-img-ph ${className || ""}`} aria-hidden />;
  const url = src.includes("images.unsplash.com") ? src.replace(/([?&])w=\d+/, `$1w=${w}`) : src;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className={className} loading="lazy" />;
}

export function Avatar({ m, size = 44 }: { m?: TeamMember; size?: number }) {
  if (!m) return null;
  return (
    <span className="sc-av" style={{ width: size, height: size }}>
      {m.photo ? <Img src={m.photo} alt="" w={size * 3} /> : <span>{initials(m.name)}</span>}
    </span>
  );
}

/** "3 spots left" / "Full" / "10 open". */
export function Spots({ left, total }: { left: number; total: number }) {
  if (left <= 0) return <span className="sc-spots full">Full</span>;
  if (left <= 3) return <span className="sc-spots low">{left === 1 ? "1 spot left" : `${left} spots left`}</span>;
  return <span className="sc-spots">{left} of {total} open</span>;
}

/** Horizontal day strip; each day is a link (server-rendered, no JS). */
export function DayStrip({ days, active, href, counts }: { days: string[]; active: string; href: (k: string) => string; counts?: Record<string, number> }) {
  return (
    <nav className="sc-days" aria-label="Pick a day">
      {days.map((k) => {
        const p = keyParts(k);
        const n = counts?.[k];
        return (
          <Link key={k} href={href(k)} scroll={false} className={`sc-day${k === active ? " on" : ""}${n === 0 ? " none" : ""}`} aria-current={k === active ? "date" : undefined}>
            <span className="wd">{p.wd}</span>
            <b>{p.d}</b>
            <span className="mo">{n === undefined ? p.mon : n === 0 ? "—" : `${n} open`}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function Empty({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="sc-empty">
      <h3>{title}</h3>
      {children && <div className="sc-empty-b">{children}</div>}
      {action && <div className="sc-empty-a">{action}</div>}
    </div>
  );
}

export function StatusPill({ status, label }: { status: string; label: string }) {
  const s = String(status || "").toLowerCase();
  const tone = ["cancelled", "canceled", "no_show", "declined", "rejected", "expired"].includes(s) ? "off" : s === "completed" || s === "used" ? "done" : s === "pending" ? "wait" : "ok";
  return <span className={`sc-pill ${tone}`}>{label}</span>;
}
