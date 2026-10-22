/**
 * Canonical Stowbo storage-class taxonomy — the ONE source of truth.
 * Slugs are stored as `listing.data.spaceType`; labels are what users see.
 * Import this everywhere (browse filter, listing form, cards) so the list
 * never drifts per-file again.
 */
export interface StorageClass {
  slug: string;
  label: string;
  /** longer label for the listing form's dropdown */
  formLabel?: string;
}

export const STORAGE_CLASSES: StorageClass[] = [
  { slug: "parking", label: "Parking lot" },
  { slug: "locker", label: "Locker" },
  { slug: "box-storage", label: "Storage box" },
  { slug: "shared-space", label: "Shared space" },
  { slug: "warehouse", label: "Warehouse & pallets" },
  { slug: "spare-room", label: "Spare room" },
  { slug: "cold-storage", label: "Cold storage" },
  { slug: "bike-gear", label: "Bike & gear" },
  { slug: "event-bag-drop", label: "Event & bag drop" },
];

/** Human label for a class slug, with a graceful fallback for unknown values. */
export function classLabel(slug?: string): string {
  if (!slug) return "Space";
  const c = STORAGE_CLASSES.find((x) => x.slug === slug);
  if (c) return c.label;
  return slug.replace(/-/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}
