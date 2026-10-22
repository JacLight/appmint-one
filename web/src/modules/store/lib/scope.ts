import "server-only";
import { cache } from "react";
import { getSetup } from "@/lib/setup";
import { storeView } from "./config";
import { listProducts, listRestaurants } from "@/api/store";
import type { Order, Restaurant } from "./types";

export interface OrderKind { kind: "shop" | "food"; restaurant?: Restaurant }

/**
 * One org can run several setups, and `client-data/orders` lists every order the
 * customer has with the org. This setup shows only orders of its own catalog, and
 * tells food orders (a restaurant's menu) from shop orders.
 */
export const catalogIndex = cache(async () => {
  const view = storeView(await getSetup());
  const [retail, food, rests] = await Promise.all([
    view.retail ? listProducts({ tags: view.tags, pageSize: 500 }).then((r) => r.products).catch(() => []) : Promise.resolve([]),
    view.food ? listProducts({ tags: [view.foodTag], pageSize: 500 }).then((r) => r.products).catch(() => []) : Promise.resolve([]),
    view.food ? listRestaurants(view.foodTag).catch(() => []) : Promise.resolve([] as Restaurant[]),
  ]);
  const shop = new Set(retail.map((p) => p.data.sku));
  const menu = new Map(food.map((p) => [p.data.sku, p.data.brand || ""]));
  const byName = new Map(rests.map((r) => [r.name, r]));
  return { view, shop, menu, byName };
});

export async function kindOf(o: Order): Promise<OrderKind | null> {
  const ix = await catalogIndex();
  for (const l of o.lines) {
    const b = l.sku ? ix.menu.get(l.sku) : undefined;
    if (b !== undefined) return { kind: "food", restaurant: ix.byName.get(b) };
  }
  if (o.lines.some((l) => l.sku && ix.shop.has(l.sku))) return { kind: "shop" };
  return null;
}
