import type { HostDiscount } from "@/api/rentals";

// Client-safe helpers only — this file must never import runtime code from lib/stowbo.ts,
// which reaches next/headers and would take every client bundle down with it.

/** The listing codes a host coupon is scoped to, whichever field the server wrote
 *  (`products`; `rentalItems`/`listings` on older rows). Empty = every listing the host has,
 *  now or later — the server matches on `merchant` (the host), `products` only narrows. */
export const couponScope = (d?: HostDiscount | null): string[] => d?.products ?? d?.rentalItems ?? d?.listings ?? [];
