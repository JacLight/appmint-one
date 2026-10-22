import Link from "next/link";
import type { Restaurant } from "../lib/types";
import type { FeeResult } from "../lib/food";
import { etaRange } from "../lib/food";
import { money2 } from "../lib/money";
import { Icon } from "./icons";

export const compact = (n?: number) => (!n ? "" : n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "")}k+` : String(n));

/** Food photo, name, rating · cuisine · price level, and the delivery fee + ETA to
 *  the customer's address — up front, the way delivery apps show it. */
export function RestaurantCard({ r, fee }: { r: Restaurant; fee?: FeeResult | null }) {
  const eta = fee?.ok ? etaRange(r, fee.quote) : null;
  return (
    <Link className="ea-card" href={`/eat/${encodeURIComponent(r.name)}`}>
      <span className="ea-card-img">{r.image && <img src={r.image} alt="" loading="lazy" />}{eta && <i className="ea-eta">{eta[0]}–{eta[1]} min</i>}</span>
      <span className="ea-card-row">
        <b>{r.title}</b>
        {r.rating ? <span className="ea-rate"><Icon name="star" size={11} fill />{r.rating.toFixed(1)}</span> : null}
      </span>
      <span className="ea-card-meta">
        {r.cuisine.slice(0, 2).join(" · ")}{r.priceLevel ? ` · ${r.priceLevel}` : ""}{r.ratingCount ? ` · ${compact(r.ratingCount)} ratings` : ""}
      </span>
      <span className="ea-card-fee">
        {fee == null ? "Add your address for delivery fee" : fee.ok ? <><b>{money2(fee.quote.amount, fee.quote.currency)} delivery fee</b>{fee.quote.route ? ` · ${fee.quote.route.miles.toFixed(1)} mi` : ""}</> : <span className="ea-off">{fee.error}</span>}
      </span>
    </Link>
  );
}
