import Link from "next/link";
import type { Product } from "../lib/types";
import { money } from "../lib/money";
import { hasPriceOptions, listPrice, productHref, productImage, wasPrice } from "../lib/options";
import { Stars } from "./icons";

/** Studio photo on a warm tile, a small badge, name, price ("From" when options can
 *  raise it), stars and colour swatches — the Shopify-brand product card. */
export function ProductCard({ p, priority }: { p: Product; priority?: boolean }) {
  const d = p.data;
  const img = productImage(p);
  const alt = d.images?.[1]?.url;
  const was = wasPrice(p);
  const colors = (d.attributes || []).find((a) => a.display === "color")?.options || [];
  return (
    <Link className="sf-card" href={productHref(p)}>
      <span className="sf-card-img">
        {img && <img src={img} alt={d.name} loading={priority ? "eager" : "lazy"} />}
        {alt && <img className="alt" src={alt} alt="" loading="lazy" />}
        {d.badge && <span className="sf-badge">{d.badge}</span>}
      </span>
      <span className="sf-card-body">
        <b className="sf-card-name">{d.name}</b>
        <span className="sf-card-price">
          {hasPriceOptions(p) && <span className="from">From</span>}
          {was && <s>{money(was)}</s>}
          <span>{money(listPrice(p))}</span>
        </span>
        <Stars value={d.rating} count={d.reviewCount} small />
        {colors.length > 1 && (
          <span className="sf-swatches" aria-label={`${colors.length} colors`}>
            {colors.slice(0, 5).map((c) => <i key={c.value} style={{ background: c.color || "#ddd" }} title={c.label} />)}
            {colors.length > 5 && <em>+{colors.length - 5}</em>}
          </span>
        )}
      </span>
    </Link>
  );
}

export function ProductGrid({ products, cols = 4 }: { products: Product[]; cols?: 3 | 4 }) {
  return (
    <div className={`sf-grid c${cols}`}>
      {products.map((p, i) => <ProductCard key={p.sk} p={p} priority={i < 4} />)}
    </div>
  );
}
