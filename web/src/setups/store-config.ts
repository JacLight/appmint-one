/**
 * How the Store module reads for one setup — what it sells (a retail catalog, food from
 * local restaurants, or both), which slice of the engine's catalog is this setup's, and
 * the merchandising around it. Plain data (server + client safe).
 *
 * Catalog scoping: products carry `post.tags`; a setup shows the products tagged with
 * `tags` (retail) / `foodTag` (restaurants and menus). Both default to the setup id, so
 * a setup that only says `modules: [..., "store"]` gets its own catalog with no config.
 */
import type { Cta } from "./types";

export type StoreVariant = "retail" | "food" | "both";

export interface StoreCategory {
  /** The value products carry in `post.categories`. */
  slug: string;
  label: string;
  /** Tile photo (absolute URL). */
  image?: string;
}

export interface StoreEditorial {
  eyebrow?: string;
  title: string;
  body?: string;
  image: string;
  cta: Cta;
}

/** Appmint One: a room photo from the shop's own product shots, with pins on the pieces it sells. */
export interface StoreRoom {
  label: string;
  /** In-room photo (absolute URL) — one of the products' own images. */
  image: string;
  /** Where the room's department lives (e.g. "/shop?category=Dining"). */
  href: string;
  /** Pins: a product slug and where it sits in the photo (percent from the left / top). */
  pins: { slug: string; x: number; y: number }[];
}

/** Appmint One: a material the catalog is made of — a close-up photo and the word products use for it. */
export interface StoreMaterial {
  label: string;
  image: string;
  /** Searched in product names and descriptions (e.g. "walnut"). */
  keyword: string;
}

export interface StoreConfig {
  /** retail → /shop; food → /eat (restaurants, delivery); both → both. Default retail. */
  variant?: StoreVariant;
  /** Retail catalog tag(s). Default [setup.id]. */
  tags?: string[];
  /** Restaurants + menus tag. Default setup.id. */
  foodTag?: string;
  /** Retail categories, in menu order. Empty → no category row. */
  categories?: StoreCategory[];
  /** Thin bar above the header on shop pages (one line, e.g. the shipping offer). */
  announcement?: string;
  /** Shop home hero. */
  hero?: { title: string; subtitle?: string; image: string; cta: Cta; secondary?: Cta };
  /** Full-width photo bands between product rows on the shop home. */
  editorial?: StoreEditorial[];
  /** Appmint One: the shop home's "shop the room" viewer, in order (first one shows first). */
  rooms?: StoreRoom[];
  /** Appmint One: the materials strip on the shop home. */
  materials?: StoreMaterial[];
  /** Appmint One: one product told in full on the shop home (its slug), with an in-room photo. */
  spotlight?: { slug: string; image: string; eyebrow?: string };
  /** One-line promises shown under Add to bag and on the bag (e.g. "Free returns for 60 days"). */
  perks?: string[];
  /** Food: the address delivery fees are quoted to until the customer enters theirs. */
  defaultAddress?: { label: string; address: string };
  /** Food: cuisine chips on /eat (label must match a restaurant's `cuisine[]`). */
  cuisines?: { label: string; image?: string }[];
}
