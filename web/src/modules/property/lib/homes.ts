import "server-only";
import { cache } from "react";
import { stowbo } from "@/api/rentals";
import type { PropertyConfig } from "@/setups/property-config";
import type { Home, Unit, HomeFilters } from "./types";

/**
 * The portfolio, read through the existing Stowbo client routes:
 *   GET client/stowbo/listings/:market     → buildings and stand-alone houses (children)
 *   GET client/stowbo/listings/:building   → that building's units (children)
 * A stand-alone house is its own single unit. A unit is available while its listing is
 * active and `details.leased` is not set; the office flips those in Studio.
 */

const imgs = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x: any) => (typeof x === "string" ? x : x?.url)).filter(Boolean) : [];
const num = (v: unknown): number | null => (v === "" || v == null || Number.isNaN(Number(v)) ? null : Number(v));

function toUnit(cfg: PropertyConfig, row: any, home: { id: string; title: string; neighborhood: string; address: any; lat: number | null; lng: number | null; images: string[] }): Unit {
  const d = row?.data || {};
  const x = d.details || {};
  const own = imgs(d.images);
  return {
    id: String(row.sk),
    name: String(d.name || ""),
    title: d.title || "Home",
    type: String(d.spaceType || ""),
    typeLabel: cfg.types.find((t) => t.id === d.spaceType)?.label || "",
    homeId: home.id,
    homeTitle: home.title,
    neighborhood: home.neighborhood,
    address: d.address?.street1 ? d.address : home.address,
    lat: typeof d.location?.lat === "number" ? d.location.lat : home.lat,
    lng: typeof d.location?.lng === "number" ? d.location.lng : home.lng,
    rent: num(d.price),
    deposit: num(x.deposit ?? d.payment?.deposit),
    beds: num(x.bedrooms) ?? 0,
    baths: num(x.bathrooms),
    sqft: num(x.sqft),
    floor: x.floor ?? null,
    availableFrom: x.availableFrom || null,
    leaseTerms: Array.isArray(x.leaseTerms) ? x.leaseTerms.map(Number).filter(Boolean) : [12],
    furnished: !!x.furnished || (d.features || []).includes("furnished"),
    pets: x.pets ?? null,
    features: Array.isArray(d.features) ? d.features : [],
    images: own.length ? own : home.images,
    description: d.description || "",
    available: d.status === "active" && !x.leased,
    plan: x.plan || null,
    segment: segmentOf(cfg, d.spaceType),
    ratePsf: num(x.ratePsf),
    leaseType: x.leaseType || null,
    opex: num(x.opex),
    minSqft: num(x.minSqft),
    condition: x.condition || null,
    specs: x.specs && typeof x.specs === "object" ? Object.entries(x.specs).map(([label, value]) => ({ label, value: String(value) })).filter((s) => s.value) : [],
  };
}

/** A listing type's segment; anything the setup doesn't list reads as residential. */
export const segmentOf = (cfg: PropertyConfig, type: unknown): "residential" | "commercial" =>
  cfg.types.find((t) => t.id === type)?.segment || "residential";

function toHome(cfg: PropertyConfig, row: any, children: any[]): Home {
  const d = row?.data || {};
  const x = d.details || {};
  const base = {
    id: String(row.sk),
    title: d.title || "Home",
    neighborhood: x.neighborhood || d.address?.city || "",
    address: d.address || {},
    lat: typeof d.location?.lat === "number" ? d.location.lat : null,
    lng: typeof d.location?.lng === "number" ? d.location.lng : null,
    images: imgs(d.images),
  };
  const isBuilding = d.spaceType === "building";
  const units = isBuilding
    ? children.filter((c) => c?.data?.status === "active" || c?.data?.details?.leased).map((c) => toUnit(cfg, c, base))
    : [toUnit(cfg, row, base)];
  return {
    ...base,
    name: String(d.name || ""),
    kind: isBuilding ? "building" : "home",
    type: isBuilding ? (x.buildingType || "Apartment building") : (cfg.types.find((t) => t.id === d.spaceType)?.label || ""),
    description: d.description || "",
    features: Array.isArray(d.features) ? d.features : [],
    yearBuilt: x.yearBuilt || null,
    floors: num(x.floors),
    totalUnits: num(x.totalUnits) ?? units.length,
    petPolicy: x.petPolicy || null,
    parking: x.parking || null,
    utilities: x.utilities || null,
    board: x.board || null,
    highlights: Array.isArray(x.highlights) ? x.highlights : [],
    segment: x.segment === "commercial" || (units.length > 0 && units.every((u) => u.segment === "commercial")) ? "commercial" : "residential",
    units,
  };
}

/** Every building and house in this setup, with their units. One call per building. */
export const portfolio = cache(async (cfg: PropertyConfig): Promise<Home[]> => {
  const root: any = await stowbo.listing(cfg.market).catch(() => null);
  const tops = ((root?.children as any[]) || []).filter((r) => r?.data?.status === "active");
  return Promise.all(tops.map(async (row) => {
    if (row?.data?.spaceType !== "building") return toHome(cfg, row, []);
    const detail: any = await stowbo.listing(String(row.sk)).catch(() => null);
    return toHome(cfg, row, (detail?.children as any[]) || []);
  }));
});

/** A building or house by id, or the home a unit id belongs to (with that unit). */
export async function findHome(cfg: PropertyConfig, id: string): Promise<{ home: Home; unit: Unit | null } | null> {
  const all = await portfolio(cfg);
  const home = all.find((h) => h.id === id || h.name === id);
  if (home) return { home, unit: home.kind === "home" ? home.units[0] : null };
  for (const h of all) {
    const u = h.units.find((x) => x.id === id || x.name === id);
    if (u) return { home: h, unit: u };
  }
  return null;
}

export function matches(u: Unit, f: HomeFilters): boolean {
  if (!u.available) return false;
  if (f.segment && u.segment !== f.segment) return false;
  if (f.minSqft != null && (u.sqft ?? 0) < f.minSqft) return false;
  if (f.maxPsf != null && (u.ratePsf == null || u.ratePsf > f.maxPsf)) return false;
  if (f.leaseType && u.leaseType !== f.leaseType) return false;
  if (f.types?.length && !f.types.includes(u.type)) return false;
  if (f.beds != null && (f.beds === 0 ? u.beds !== 0 : u.beds < f.beds)) return false;
  if (f.maxRent != null && (u.rent == null || u.rent > f.maxRent)) return false;
  if (f.pets && u.pets === false) return false;
  if (f.furnished && !u.furnished) return false;
  if (f.moveIn && u.availableFrom && u.availableFrom > f.moveIn) return false;
  return true;
}

/** Homes with at least one unit that fits, each carrying only the units that fit. */
export function search(all: Home[], f: HomeFilters): Home[] {
  const q = (f.q || "").trim().toLowerCase();
  let out = all
    .filter((h) => !q || [h.title, h.neighborhood, h.address?.city, h.address?.street1, h.address?.zip].some((v) => String(v || "").toLowerCase().includes(q)))
    .map((h) => ({ ...h, units: h.units.filter((u) => matches(u, f)) }))
    .filter((h) => h.units.length > 0);
  // Commercial is compared on the quoted $/SF/yr, homes on monthly rent.
  const low = (h: Home) => Math.min(...h.units.map((u) => (f.segment === "commercial" ? u.ratePsf : u.rent) ?? Infinity));
  const soon = (h: Home) => h.units.map((u) => u.availableFrom || "0000").sort()[0];
  if (f.sort === "rent_desc") out = out.sort((a, b) => low(b) - low(a));
  else if (f.sort === "size") out = out.sort((a, b) => Math.max(...b.units.map((u) => u.sqft ?? 0)) - Math.max(...a.units.map((u) => u.sqft ?? 0)));
  else if (f.sort === "available") out = out.sort((a, b) => soon(a).localeCompare(soon(b)));
  else out = out.sort((a, b) => low(a) - low(b));
  return out;
}
