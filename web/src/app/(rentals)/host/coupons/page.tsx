import { SiteHeader } from "@/components/site-header";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireHost } from "@/lib/guards";
import { getNav } from "@/lib/nav-server";
import { stowbo, type HostDiscount, type HostBookingRow } from "@/api/rentals";
import type { Envelope } from "@/lib/api";
import { CouponsManager, type CouponStats, type ScopeListing, type Redemption } from "@/modules/rentals/components/host/coupons-manager";

export const metadata = { title: "Coupons" };

/** The host's coupon desk: every code they own, how it's doing, and the controls —
 *  switch on/off, retire, edit the rules, add or remove the spaces it applies to. */
export default async function HostCouponsPage() {
  await requireHost();
  const [discountsR, listingsR, bookingsR] = await Promise.allSettled([
    stowbo.host.discounts(),
    stowbo.host.listings(),
    stowbo.host.allBookings(),
  ]);
  const discounts = (discountsR.status === "fulfilled" && Array.isArray(discountsR.value) ? discountsR.value : []) as Envelope<HostDiscount>[];
  const listings: ScopeListing[] = (listingsR.status === "fulfilled" ? (listingsR.value as any)?.data ?? [] : [])
    .map((l: any) => ({ code: l.data?.name, title: l.data?.title || l.data?.name, status: l.data?.status }))
    .filter((l: ScopeListing) => !!l.code);
  const rows = (bookingsR.status === "fulfilled" && Array.isArray(bookingsR.value) ? bookingsR.value : []) as HostBookingRow[];

  // Usage per code from the host's own bookings — the server stamps discountCode +
  // discount on each row. Cancelled / no-show bookings don't count as a redemption.
  const stats: Record<string, CouponStats> = {};
  // Who used each code, on which space — every booking that carried it, newest first,
  // cancelled ones included but marked (they don't count toward the totals).
  const redemptions: Record<string, Redemption[]> = {};
  const hasRowStats = rows.some((r) => r.discountCode !== undefined);
  for (const r of rows) {
    const code = (r.discountCode || "").toUpperCase();
    if (!code) continue;
    (redemptions[code] ??= []).push({ booking: r.booking, reference: r.reference ?? null, customer: r.guest?.name || r.customer || null, listingTitle: r.listingTitle ?? r.listing ?? null, status: String(r.status), discount: Number(r.discount || 0), total: Number(r.total || 0), at: r.at ?? r.start ?? null });
    const s = (stats[code] ??= { bookings: 0, discounted: 0, revenue: 0, lastUsed: null, released: 0 });
    if (["cancelled", "no_show"].includes(String(r.status))) { s.released += 1; continue; }
    s.bookings += 1;
    s.discounted += Number(r.discount || 0);
    s.revenue += Number(r.total || 0);
    if (r.at && (!s.lastUsed || r.at > s.lastUsed)) s.lastUsed = r.at;
  }

  return (
    <>
      <SiteHeader />
      <DashboardShell nav={(await getNav()).provider} title="Coupons">
        <CouponsManager mine={discounts} listings={listings} stats={stats} redemptions={redemptions} statsAvailable={hasRowStats} />
      </DashboardShell>
    </>
  );
}
