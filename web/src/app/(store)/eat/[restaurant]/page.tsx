import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { requireFood } from "@/modules/store/lib/guard";
import { getRestaurant, menuOf } from "@/api/store";
import { currentCart } from "@/modules/store/lib/cart-cookie";
import { deliveryAddress, deliveryFee, etaRange } from "@/modules/store/lib/food";
import { money2 } from "@/modules/store/lib/money";
import type { Product } from "@/modules/store/lib/types";
import { RestaurantMenu, type MenuSection } from "@/modules/store/components/menu";
import { EatAddress } from "@/modules/store/components/eat-address";
import { compact } from "@/modules/store/components/restaurant-card";
import { Icon } from "@/modules/store/components/icons";

type Params = { params: Promise<{ restaurant: string }> };
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const view = await requireFood();
  const r = await getRestaurant(view.foodTag, decodeURIComponent((await params).restaurant)).catch(() => null);
  return r ? { title: `${r.title} · Delivery`, description: r.description } : { title: "Not found" };
}

/** A restaurant: banner + logo, rating / cuisine / hours, the delivery fee and time to
 *  the customer's address, then the menu with its item sheets and the basket. */
export default async function RestaurantPage({ params }: Params) {
  const view = await requireFood();
  const name = decodeURIComponent((await params).restaurant);
  const r = await getRestaurant(view.foodTag, name);
  if (!r) notFound();
  const saved = await deliveryAddress();
  const address = saved || view.defaultAddress?.address;
  const [items, cart, fee] = await Promise.all([
    menuOf(view.foodTag, r.name).catch(() => [] as Product[]),
    currentCart("food").catch(() => null),
    address ? deliveryFee(r, address) : Promise.resolve(null),
  ]);
  const eta = fee?.ok ? etaRange(r, fee.quote) : null;
  const order = r.sections.filter((s) => s !== "Popular");
  const bySection = new Map<string, typeof items>();
  for (const p of items) {
    const s = p.data.section || "Menu";
    if (!bySection.has(s)) bySection.set(s, []);
    bySection.get(s)!.push(p);
  }
  const names = [...order.filter((s) => bySection.has(s)), ...[...bySection.keys()].filter((s) => !order.includes(s))];
  const sections: MenuSection[] = names.map((s) => ({ id: slug(s), title: s, items: bySection.get(s)! }));
  const popular = items.filter((p) => p.data.popular).slice(0, 6);

  return (
    <>
      <SiteHeader />
      <main className="ea-store">
        <div className="ea-wrap">
          <nav className="sf-crumbs" aria-label="Breadcrumb"><Link href="/eat">Food</Link><span>/</span><span>{r.title}</span></nav>
          <div className="ea-banner">
            {r.image && <img src={r.image} alt="" />}
            {r.logo && <span className="ea-logo"><img src={r.logo} alt="" /></span>}
          </div>
          <div className="ea-store-hd">
            <div>
              <h1>{r.title}</h1>
              <p className="ea-store-meta">
                {r.rating ? <><Icon name="star" size={14} fill />{r.rating.toFixed(1)}{r.ratingCount ? ` (${compact(r.ratingCount)} ratings)` : ""} · </> : null}
                {r.cuisine.join(" · ")}{r.priceLevel ? ` · ${r.priceLevel}` : ""}
              </p>
              {r.description && <p className="ea-store-desc">{r.description}</p>}
              <p className="ea-store-sub">{r.hours ? <>Open {r.hours} · </> : null}{r.street}{r.phone ? ` · ${r.phone}` : ""}</p>
            </div>
            <div className="ea-dbox">
              <div className="ea-dbox-mode"><span className="on">Delivery</span></div>
              <div className="ea-dbox-nums">
                <div><b>{fee?.ok ? money2(fee.quote.amount, fee.quote.currency) : "—"}</b><small>delivery fee</small></div>
                <div><b>{eta ? `${eta[0]}–${eta[1]}` : "—"}</b><small>min</small></div>
              </div>
              {fee && !fee.ok && <p className="sf-err">{fee.error}</p>}
              <EatAddress address={address} label={saved ? undefined : view.defaultAddress?.label} />
            </div>
          </div>

          {items.length ? (
            <RestaurantMenu restaurant={r.name} restaurantTitle={r.title} sections={sections} popular={popular} initialCart={cart} />
          ) : (
            <div className="sf-empty"><h3>The menu is being updated</h3><p>Check back in a little while.</p><Link className="ea-btn" href="/eat">More restaurants</Link></div>
          )}
        </div>
      </main>
    </>
  );
}
