/**
 * The Store module's view of a setup (client-safe): which variant is on (retail shop,
 * food ordering, both) and which slice of the engine catalog is this setup's.
 */
import type { Setup } from "@/setups/types";
import type { StoreCategory, StoreConfig } from "@/setups/store-config";
import { isOn } from "@/setups/modules";

export interface StoreView extends Omit<StoreConfig, "variant" | "tags" | "foodTag" | "categories" | "perks"> {
  retail: boolean;
  food: boolean;
  tags: string[];
  foodTag: string;
  categories: StoreCategory[];
  perks: string[];
}

export function storeView(setup: Setup): StoreView {
  const c = setup.store || {};
  const v = c.variant || "retail";
  const on = isOn(setup, "store");
  return {
    ...c,
    retail: on && (v === "retail" || v === "both"),
    food: on && (v === "food" || v === "both"),
    tags: c.tags?.length ? c.tags : [setup.id],
    foodTag: c.foodTag || setup.id,
    categories: c.categories || [],
    perks: c.perks || [],
  };
}

export const SHOP = "/shop";
export const EAT = "/eat";
export const ORDERS = "/account/orders";

/** Return reasons the engine accepts, with how they read. */
export const REASONS = ["changed_mind", "defective", "not_as_described", "wrong_item", "damaged_shipping", "other"] as const;
export type ReasonCategory = (typeof REASONS)[number];
export const REASON_LABEL: Record<ReasonCategory, string> = {
  changed_mind: "Changed my mind", defective: "It’s faulty", not_as_described: "Not as described",
  wrong_item: "Wrong item sent", damaged_shipping: "Arrived damaged", other: "Something else",
};
