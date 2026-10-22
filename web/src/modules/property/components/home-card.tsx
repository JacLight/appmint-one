import Link from "next/link";
import type { PropertyConfig } from "@/setups/property-config";
import type { Home } from "../lib/types";
import { bedRange, isNow, place, psfRange, rentRange, sfRange } from "../lib/format";

/** One building or house in a list, Apartments.com style: rent range, beds, how many
 *  homes fit, the place, a few amenities. Commercial reads like LoopNet: $/SF/yr, the
 *  square footage, the lease type. `home.units` is already the matching units. */
export function HomeCard({ cfg, home, hot, onHover, segment = "residential" }: { cfg: PropertyConfig; home: Home; hot?: boolean; onHover?: (id: string | null) => void; segment?: "residential" | "commercial" }) {
  const units = home.units;
  const now = units.some(isNow);
  const biz = segment === "commercial";
  const href = `/homes/${home.id}${biz && home.kind === "building" ? "#suites" : ""}`;
  const tags = home.features.concat(units.flatMap((u) => u.features)).filter((f, i, a) => a.indexOf(f) === i && cfg.amenities[f]).slice(0, 3);
  const leaseTypes = [...new Set(units.map((u) => u.leaseType).filter(Boolean))];
  const kinds = [...new Set(units.map((u) => u.typeLabel).filter(Boolean))];
  const noun = biz ? (units.length === 1 ? "space" : "spaces") : units.length === 1 ? "home" : "homes";
  return (
    <Link href={href} className={`pm-card${hot ? " hot" : ""}`} onMouseEnter={onHover ? () => onHover(home.id) : undefined} onMouseLeave={onHover ? () => onHover(null) : undefined}>
      <div className="pm-card-img">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {home.images[0] && <img src={home.images[0]} alt={home.title} loading="lazy" />}
        {now && <span className="pm-pill now"><i className="pm-dot" /> Available now</span>}
        {home.kind === "building" && <span className="count">{units.length} {noun} available</span>}
      </div>
      <div className="pm-card-b">
        {biz ? (
          <>
            <div className="pm-card-rent">{psfRange(units)} <small>/SF/yr{leaseTypes.length === 1 ? ` ${leaseTypes[0]}` : ""}</small></div>
            <div className="pm-card-beds">{sfRange(units)}{kinds.length ? ` · ${kinds.join(", ")}` : ""}</div>
          </>
        ) : (
          <>
            <div className="pm-card-rent">{rentRange(units)} <small>/ mo</small></div>
            <div className="pm-card-beds">{bedRange(units)}{home.kind === "home" && units[0]?.baths ? ` · ${units[0].baths} bath` : ""}{home.kind === "home" ? ` · ${home.type}` : ""}</div>
          </>
        )}
        <div className="pm-card-t">{home.title}</div>
        <div className="pm-card-a">{place(home)}</div>
        {tags.length > 0 && <div className="pm-card-tags">{tags.map((t) => <span key={t}>{cfg.amenities[t]}</span>)}</div>}
      </div>
    </Link>
  );
}
