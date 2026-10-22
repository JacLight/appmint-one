import "server-only";
import { getSetup } from "@/lib/setup";
import type { Setup } from "@/setups/types";
import type { RentalsConfig } from "@/setups/rentals-config";

/** The active setup's marketplace config — null for Stowbo (storage), which keeps its
 *  own screens untouched. Every route in (rentals) asks this first and branches. */
export async function getMarket(): Promise<{ setup: Setup; cfg: RentalsConfig } | null> {
  const setup = await getSetup();
  const cfg = setup.rentals;
  if (!cfg || cfg.experience === "storage") return null;
  return { setup, cfg };
}

/** Same, for screens that only exist in a marketplace setup. */
export async function requireMarket(): Promise<{ setup: Setup; cfg: RentalsConfig }> {
  const m = await getMarket();
  if (!m) {
    const { notFound } = await import("next/navigation");
    notFound();
  }
  return m!;
}

/** A client-safe slice of the config for client components (plain data). */
export type ClientCfg = Pick<RentalsConfig, "experience" | "unit" | "types" | "facts" | "amenities" | "guests" | "timeOfDay" | "search" | "copy">;
export function clientCfg(cfg: RentalsConfig): ClientCfg {
  const { experience, unit, types, facts, amenities, guests, timeOfDay, search, copy } = cfg;
  return { experience, unit, types, facts, amenities, guests, timeOfDay, search, copy };
}
