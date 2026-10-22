/**
 * The three things muvmnt-style logistics sells (Ride, Deliver, Eat) and how a job
 * maps onto them. Client-safe.
 *
 * The engine prices every job on the org's one delivery config, so each service has a
 * single option. A job says what it is through its pickup item ("Ride · Standard · 1 rider",
 * "Small package"), which the request form writes (lib/request.ts).
 */
import type { DeliveryJob } from "./types";

export type ServiceKind = "ride" | "package" | "food";

export const SERVICE_TABS: { id: ServiceKind; label: string; href: string; icon: string; blurb: string }[] = [
  { id: "ride", label: "Ride", href: "/ride", icon: "car", blurb: "A car at your door, priced before you book." },
  { id: "package", label: "Deliver", href: "/send", icon: "box", blurb: "Send anything across town today." },
  { id: "food", label: "Eat", href: "/eat", icon: "bag", blurb: "Order from local kitchens, delivered hot." },
];

/** Ride or package delivery, from what was booked. */
export function jobKind(job: DeliveryJob): ServiceKind {
  const first = job.stops?.find((s) => s.items?.length)?.items?.[0]?.description || "";
  return /^ride\b/i.test(first) ? "ride" : "package";
}

