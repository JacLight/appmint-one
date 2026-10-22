import "./storefront.css"; // Appmint One: the rooms home (sf-l) lives in the store sheet
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getSetup } from "@/lib/setup";
import { storeView } from "./lib/config";
import { listProducts } from "@/api/store";
import type { Product } from "./lib/types";
import { Announcement, CategoryTiles, Perks } from "./components/shop-chrome";
import { BestSellers } from "./components/best-sellers";
import { ProductGrid } from "./components/product-card";
import { RoomRail, type RoomVM } from "./components/room-viewer";
import { money } from "./lib/money";
import { listPrice, productHref, productImage } from "./lib/options";

/**
 * A shop's home is the shop: the offer bar, one hero photo with one action, the
 * departments as photo tiles, best sellers with real prices, and photo bands between
 * product rows. No explainer sections.
 */
export async function StoreHome() {
  const setup = await getSetup();
  const view = storeView(setup);
  const all = await listProducts({ tags: view.tags, pageSize: 120 }).then((r) => r.products).catch(() => null);
  const products = (all || []).filter((p) => !p.data.giftCard?.enabled);
  const score = (p: Product) => (p.data.badge === "Best seller" ? 1e7 : 0) + (p.data.reviewCount || 0) * (p.data.rating || 0);
  const best = [...products].sort((a, b) => score(b) - score(a));
  const fresh = products.filter((p) => /new|limited/i.test(p.data.badge || ""));
  const more = [...fresh, ...products.filter((p) => !fresh.includes(p) && !best.slice(0, 8).includes(p))].slice(0, 8);
  const hero = view.hero;
  const [ed1, ed2] = view.editorial || [];
  if (view.rooms?.length) {
    // The count on each material is what its link (/shop?q=…) will list — the engine's own word search.
    const matCounts = await Promise.all((view.materials || []).map((m) => listProducts({ tags: view.tags, keyword: m.keyword, pageSize: 1 }).then((r) => r.total).catch(() => 0)));
    return <RoomsHome setup={setup} view={view} products={products} best={best} failed={all === null} matCounts={matCounts} />;
  }

  return (
    <>
      <Announcement view={view} />
      <SiteHeader />
      <main className="sf-home">
        {hero && (
          <section className="sf-hero">
            <img src={hero.image} alt="" />
            <div className="sf-hero-copy">
              <h1>{hero.title}</h1>
              {hero.subtitle && <p>{hero.subtitle}</p>}
              <div className="sf-hero-acts">
                <Link className="sf-btn light lg" href={hero.cta.href}>{hero.cta.label}</Link>
                {hero.secondary && <Link className="sf-btn ghost-light lg" href={hero.secondary.href}>{hero.secondary.label}</Link>}
              </div>
            </div>
          </section>
        )}

        {view.categories.length > 0 && (
          <section className="sf-sec">
            <div className="sf-sec-hd"><h2>Shop by category</h2><Link className="sf-link" href="/shop">Shop all</Link></div>
            <CategoryTiles view={view} />
          </section>
        )}

        <section className="sf-sec">
          <div className="sf-sec-hd"><h2>Best sellers</h2><Link className="sf-link" href="/shop?sort=rating">See all</Link></div>
          {all === null ? (
            <p className="sf-empty-line">We couldn’t load the shop just now. Refresh in a moment.</p>
          ) : best.length ? (
            <BestSellers products={best} categories={view.categories} />
          ) : (
            <div className="sf-empty"><h3>New stock is on its way</h3><p>The shelves are being filled. Check back soon.</p></div>
          )}
        </section>

        {ed1 && (
          <section className="sf-band">
            <img src={ed1.image} alt="" loading="lazy" />
            <div className="sf-band-copy">
              {ed1.eyebrow && <span className="sf-eyebrow">{ed1.eyebrow}</span>}
              <h2>{ed1.title}</h2>
              {ed1.body && <p>{ed1.body}</p>}
              <Link className="sf-btn light" href={ed1.cta.href}>{ed1.cta.label}</Link>
            </div>
          </section>
        )}

        {more.length > 0 && (
          <section className="sf-sec">
            <div className="sf-sec-hd"><h2>{fresh.length ? "New and limited" : "More to love"}</h2><Link className="sf-link" href="/shop?sort=newest">Shop new</Link></div>
            <ProductGrid products={more.slice(0, 4)} />
          </section>
        )}

        {ed2 && (
          <section className="sf-split">
            <img src={ed2.image} alt="" loading="lazy" />
            <div className="sf-split-copy">
              {ed2.eyebrow && <span className="sf-eyebrow">{ed2.eyebrow}</span>}
              <h2>{ed2.title}</h2>
              {ed2.body && <p>{ed2.body}</p>}
              <Link className="sf-btn" href={ed2.cta.href}>{ed2.cta.label}</Link>
            </div>
          </section>
        )}

        <section className="sf-sec sf-perks-sec"><Perks perks={view.perks} /></section>
      </main>
      <SiteFooter />
    </>
  );
}

/** Appmint One: the furniture-brand home, for a shop whose setup has room photos.
 *  The rooms first (its own in-room shots, pins on the pieces it sells), then the
 *  departments as rooms, best sellers in one rail, one piece told in full, and the
 *  materials the catalog is made of. Every name, price, count and photo comes from the
 *  products themselves. */
function RoomsHome({ setup, view, products, best, failed, matCounts }: { setup: Awaited<ReturnType<typeof getSetup>>; view: ReturnType<typeof storeView>; products: Product[]; best: Product[]; failed: boolean; matCounts: number[] }) {
  const bySlug = new Map(products.map((p) => [p.data.slug || p.data.sku, p]));
  const piece = (p: Product) => ({ slug: p.data.slug || p.data.sku, name: p.data.name, price: money(listPrice(p)), image: productImage(p) || undefined, href: productHref(p) });
  const rooms: RoomVM[] = (view.rooms || []).map((r) => ({
    label: r.label, image: r.image, href: r.href,
    pins: r.pins.flatMap((pin) => { const p = bySlug.get(pin.slug); return p ? [{ x: pin.x, y: pin.y, piece: piece(p) }] : []; }),
  }));
  const count = (slug: string) => products.filter((p) => (p.post?.categories || []).includes(slug)).length;
  const materials = (view.materials || []).map((m, i) => ({ ...m, n: matCounts[i] || 0 })).filter((m) => m.n > 0);
  const spot = view.spotlight ? bySlug.get(view.spotlight.slug) : undefined;
  const parcel = (spot?.data as any)?.parcel || {};
  const unit = parcel.dimensionUnit === "cm" ? " cm" : "″";
  const spotFacts = spot ? [
    parcel.width && parcel.length && parcel.height ? ["Dimensions", `${parcel.width}${unit} W × ${parcel.length}${unit} D × ${parcel.height}${unit} H`] : null,
    Number(parcel.weight) > 0 ? ["Weight", `${parcel.weight} ${parcel.weightUnit || "lb"}`] : null,
    ["Department", (spot.post?.categories || [])[0] || ""],
  ].filter((f): f is string[] => !!f && !!f[1]) : [];
  const spotLede = spot ? String(spot.data.description || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "";
  const hero = view.hero;
  const [lead, ...rest] = view.categories;

  return (
    <>
      <Announcement view={view} />
      <SiteHeader />
      <main className="sf-home sf-l">
        <section className="sf-l-hero">
          <div className="sf-l-hero-hd">
            <div>
              {materials.length > 0 && <p className="sf-l-eyebrow">{materials.map((m) => m.label).join(" / ")}</p>}
              <h1>{hero?.title || setup.brand.tagline}</h1>
            </div>
            <div className="sf-l-hero-side">
              {(hero?.subtitle || setup.brand.description) && <p className="sf-l-lead">{hero?.subtitle || setup.brand.description}</p>}
              <div className="sf-l-acts">
                <Link className="sf-btn lg" href="/shop">Shop all {products.length} pieces</Link>
                {hero?.cta && <Link className="sf-btn ghost lg" href={hero.cta.href}>{hero.cta.label}</Link>}
              </div>
            </div>
          </div>
          <RoomRail rooms={rooms} />
          {view.perks.length > 0 && <div className="sf-l-perks"><Perks perks={view.perks} compact /></div>}
        </section>

        {view.categories.length > 0 && (
          <section className="sf-l-sec">
            <div className="sf-l-hd"><h2>Shop by room</h2><Link className="sf-link" href="/shop">Everything</Link></div>
            <div className="sf-l-rooms">
              {[lead, ...rest].filter(Boolean).map((c, i) => (
                <Link key={c.slug} href={`/shop?category=${encodeURIComponent(c.slug)}`} className={`sf-l-room${i === 0 ? " big" : ""}`}>
                  {c.image && <img src={c.image} alt="" loading="lazy" />}
                  <span><b>{c.label}</b>{count(c.slug) > 0 && <em>{count(c.slug)} pieces</em>}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="sf-l-sec">
          <div className="sf-l-hd"><h2>Best sellers</h2><Link className="sf-link" href="/shop?sort=rating">See all</Link></div>
          {failed ? (
            <p className="sf-empty-line">We couldn’t load the shop just now. Refresh in a moment.</p>
          ) : (
            <div className="sf-l-rail">
              {best.slice(0, 10).map((p, i) => (
                <Link key={p.sk} href={productHref(p)} className="sf-l-card">
                  <span className="img">{productImage(p) && <img src={productImage(p)!} alt="" loading={i < 4 ? "eager" : "lazy"} />}<i>{String(i + 1).padStart(2, "0")}</i></span>
                  <b>{p.data.name}</b>
                  <em>{money(listPrice(p))}</em>
                </Link>
              ))}
            </div>
          )}
        </section>

        {spot && view.spotlight && (
          <section className="sf-l-spot">
            <figure><img src={view.spotlight.image} alt={spot.data.name} loading="lazy" /></figure>
            <div className="sf-l-spot-copy">
              {view.spotlight.eyebrow && <p className="sf-l-eyebrow">{view.spotlight.eyebrow}</p>}
              <h2>{spot.data.name}</h2>
              <p className="sf-l-price">{money(listPrice(spot))}</p>
              {spotLede && <p className="sf-l-lead">{spotLede}</p>}
              {spotFacts.length > 0 && <dl>{spotFacts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>}
              <div className="sf-l-acts">
                <Link className="sf-btn lg" href={productHref(spot)}>See the {spot.data.name.split(" ").slice(-1)[0].toLowerCase()}</Link>
                {productImage(spot) && <span className="sf-l-spot-thumb"><img src={productImage(spot)!} alt="" /></span>}
              </div>
            </div>
          </section>
        )}

        {materials.length > 0 && (
          <section className="sf-l-sec">
            <div className="sf-l-hd"><h2>Made from</h2><p>Pick the finish you want to live with.</p></div>
            <div className="sf-l-mats">
              {materials.map((m) => (
                <Link key={m.label} href={`/shop?q=${encodeURIComponent(m.keyword)}`} className="sf-l-mat">
                  <img src={m.image} alt="" loading="lazy" />
                  <span><b>{m.label}</b><em>{m.n} {m.n === 1 ? "piece" : "pieces"}</em></span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
