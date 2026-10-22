import Link from "next/link";
import type { StoreView } from "../lib/config";
import { Icon } from "./icons";

/** The thin offer bar above a shop's header. */
export function Announcement({ view }: { view: StoreView }) {
  if (!view.announcement) return null;
  return <div className="sf-announce"><span>{view.announcement}</span></div>;
}

/** One line of promises (shipping, returns) with small icons. */
export function Perks({ perks, compact }: { perks: string[]; compact?: boolean }) {
  if (!perks.length) return null;
  const icon = (t: string) => (/return/i.test(t) ? "ret" : /ship|deliver/i.test(t) ? "truck" : "check");
  return (
    <ul className={`sf-perks${compact ? " compact" : ""}`}>
      {perks.map((t) => <li key={t}><Icon name={icon(t)} size={compact ? 16 : 20} />{t}</li>)}
    </ul>
  );
}

/** Department tiles: tall photos with the label on the photo. */
export function CategoryTiles({ view, active }: { view: StoreView; active?: string }) {
  if (!view.categories.length) return null;
  return (
    <div className="sf-tiles">
      {view.categories.map((c) => (
        <Link key={c.slug} className={`sf-tile${active === c.slug ? " on" : ""}`} href={`/shop?category=${c.slug}`}>
          {c.image && <img src={c.image} alt="" loading="lazy" />}
          <span>{c.label}</span>
        </Link>
      ))}
    </div>
  );
}
