import Link from "next/link";
import { requireFood } from "../lib/guard";
import { listRestaurants } from "@/api/store";
import { deliveryAddress, deliveryFee, etaRange, type FeeResult } from "../lib/food";
import type { Restaurant } from "../lib/types";
import { EatAddress } from "./eat-address";
import { RestaurantCard } from "./restaurant-card";
import { Icon } from "./icons";

export type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || "";

const FILTERS = [
  { id: "fast", label: "Under 40 min" },
  { id: "top", label: "Rating 4.7+" },
  { id: "cheap", label: "$" },
];

/** The food feed: where it's going, cuisines, quick filters, then restaurants with the
 *  delivery fee and time to THIS address on every card. */
export async function EatFeed({ sp = {} }: { sp?: SP }) {
  const view = await requireFood();
  const cuisine = one(sp.cuisine);
  const filter = one(sp.f);
  const q = one(sp.q).trim().toLowerCase().slice(0, 60);
  const saved = await deliveryAddress();
  const address = saved || view.defaultAddress?.address;
  const label = saved ? undefined : view.defaultAddress?.label;

  const all = await listRestaurants(view.foodTag).catch(() => null);
  const fees = new Map<string, FeeResult>();
  if (address && all?.length) {
    const res = await Promise.all(all.map((r) => deliveryFee(r, address)));
    all.forEach((r, i) => fees.set(r.name, res[i]));
  }
  const eta = (r: Restaurant) => { const f = fees.get(r.name); return f?.ok ? etaRange(r, f.quote)?.[1] ?? 999 : 999; };
  const cuisines = [...new Set((all || []).flatMap((r) => r.cuisine))];
  const chipImg = (c: string) => (all || []).find((r) => r.cuisine.includes(c))?.image;

  let list = [...(all || [])];
  if (cuisine) list = list.filter((r) => r.cuisine.includes(cuisine));
  if (q) list = list.filter((r) => [r.title, r.description, ...r.cuisine].join(" ").toLowerCase().includes(q));
  if (filter === "fast") list = list.filter((r) => eta(r) <= 40);
  if (filter === "top") list = list.filter((r) => (r.rating || 0) >= 4.7);
  if (filter === "cheap") list = list.filter((r) => r.priceLevel === "$");
  list.sort((a, b) => (b.ratingCount || 0) * (b.rating || 0) - (a.ratingCount || 0) * (a.rating || 0));
  const fastest = !cuisine && !filter && !q ? [...list].filter((r) => eta(r) < 999).sort((a, b) => eta(a) - eta(b)).slice(0, 4) : [];
  const href = (patch: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ cuisine, f: filter, q: one(sp.q), ...patch })) if (v) u.set(k, v);
    const s = u.toString();
    return s ? `/eat?${s}` : "/eat";
  };

  return (
        <div className="ea-wrap">
          <div className="ea-top">
            <EatAddress address={address} label={label} />
            <form className="ea-search" action="/eat" role="search">
              <Icon name="search" size={18} />
              <input name="q" defaultValue={one(sp.q)} placeholder="Search restaurants and cuisines" aria-label="Search food" />
            </form>
          </div>

          {cuisines.length > 0 && (
            <div className="ea-cuisines" role="list">
              {cuisines.map((c) => (
                <Link role="listitem" key={c} href={href({ cuisine: cuisine === c ? undefined : c })} className={cuisine === c ? "on" : ""}>
                  <span>{chipImg(c) && <img src={chipImg(c)} alt="" loading="lazy" />}</span>{c}
                </Link>
              ))}
            </div>
          )}

          {!!all?.length && (
          <div className="ea-filters">
            {FILTERS.map((f) => (
              <Link key={f.id} href={href({ f: filter === f.id ? undefined : f.id })} className={filter === f.id ? "on" : ""}>{f.label}{filter === f.id && <Icon name="x" size={12} />}</Link>
            ))}
            {(cuisine || filter || q) && <Link className="clear" href="/eat">Clear all</Link>}
          </div>
          )}

          {all === null ? (
            <div className="sf-empty"><h3>We couldn’t load restaurants</h3><p>Refresh in a moment.</p></div>
          ) : !all.length ? (
            <div className="sf-empty big"><Icon name="store" size={36} /><h3>No restaurants near you yet</h3><p>Kitchens are joining soon. Check back, or try another address.</p></div>
          ) : (
            <>
              {fastest.length > 0 && (
                <section className="ea-sec-feed">
                  <h2>Fastest near you</h2>
                  <div className="ea-grid c4">{fastest.map((r) => <RestaurantCard key={r.name} r={r} fee={fees.get(r.name) ?? null} />)}</div>
                </section>
              )}
              <section className="ea-sec-feed">
                <h2>{cuisine ? `${cuisine} near you` : q ? `Results for “${one(sp.q)}”` : "All restaurants"}{list.length ? <span> · {list.length}</span> : null}</h2>
                {list.length ? (
                  <div className="ea-grid c4">{list.map((r) => <RestaurantCard key={r.name} r={r} fee={address ? fees.get(r.name) ?? null : null} />)}</div>
                ) : (
                  <div className="sf-empty"><h3>Nothing matches that</h3><p>Try another cuisine or clear the filters.</p><Link className="ea-btn" href="/eat">Clear filters</Link></div>
                )}
              </section>
            </>
          )}
        </div>
  );
}
