import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { DashboardShell } from "@/components/dashboard-shell";
import { EmptyState } from "@/components/empty-state";
import { ListingConsole } from "@/modules/rentals/components/host/listing-console";
import { requireHost } from "@/lib/guards";
import { routes } from "@/lib/nav";
import { getNav } from "@/lib/nav-server";
import { stowbo, type StowboBooking, type StowboCalendar } from "@/api/rentals";
import { getMarket } from "@/modules/rentals/market/config";
import { redirect } from "next/navigation";

export const metadata = { title: "Listing" };

export default async function ListingDashboard({ params }: { params: Promise<{ id: string }> }) {
  await requireHost();
  const { id } = await params;
  if (await getMarket()) redirect(`/host/listings/${id}/edit`);
  const now = new Date();
  const monthFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const monthDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const [detail, bookings, calendar, myAddons, myFees, myDiscounts] = await Promise.all([
    stowbo.host.listing(id).catch(() => null),
    stowbo.host.listingBookings(id).catch(() => [] as any[]),
    stowbo.host.calendar(id, { from: `${monthFrom}T12:00:00`, days: monthDays }).catch(() => null as StowboCalendar | null),
    // Add-ons need backend routes that older appengine builds don't have. A 404 means
    // "this server can't do add-ons yet" — hide the tab rather than showing a dead one.
    stowbo.host.addons().then(
      (r) => ({ supported: true, addons: Array.isArray(r) ? r : [] }),
      (e: any) => {
        const st = e?.response?.status ?? e?.status ?? e?.response?.data?.statusCode;
        return { supported: st !== 404, addons: [] as any[] };
      },
    ),
    stowbo.host.fees().then(
      (r) => ({ supported: true, fees: Array.isArray(r) ? r : [] }),
      (e: any) => {
        const st = e?.response?.status ?? e?.status ?? e?.response?.data?.statusCode;
        return { supported: st !== 404, fees: [] as any[] };
      },
    ),
    stowbo.host.discounts().then(
      (r) => ({ supported: true, discounts: Array.isArray(r) ? r : [] }),
      (e: any) => {
        const st = e?.response?.status ?? e?.status ?? e?.response?.data?.statusCode;
        return { supported: st !== 404, discounts: [] as any[] };
      },
    ),
  ]);

  if (!detail?.listing) {
    return (
      <>
        <SiteHeader />
        <DashboardShell nav={(await getNav()).provider} title="Space" action={<Link className="btn ghost sm" href={routes.hostListings}>← All listings</Link>}>
          <EmptyState title="Listing not found" note="This listing may have been removed, or it isn't one of yours." ctaLabel="Back to listings" ctaHref={routes.hostListings} />
        </DashboardShell>
      </>
    );
  }

  const l = detail.listing.data;
  const units = detail.units ?? [];
  const bs = (bookings ?? []) as { sk: string; data: StowboBooking }[];

  return (
    <>
      <SiteHeader />
      <DashboardShell
        nav={(await getNav()).provider}
        title={l?.title || "Space"}
        action={<Link className="btn ghost sm" href={routes.hostListings}>← All listings</Link>}
      >
        <ListingConsole id={id} l={l} units={units} bookings={bs} calendar={calendar} myAddons={myAddons.addons} addonsSupported={myAddons.supported} myFees={myFees.fees} feesSupported={myFees.supported} myDiscounts={myDiscounts.discounts} discountsSupported={myDiscounts.supported} />
      </DashboardShell>
    </>
  );
}
