import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { DashboardShell } from "@/components/dashboard-shell";
import { EmptyState } from "@/components/empty-state";
import { ListingEditor } from "@/modules/rentals/components/host/listing-editor";
import { requireHost } from "@/lib/guards";
import { routes } from "@/lib/nav";
import { getNav } from "@/lib/nav-server";
import { stowbo } from "@/api/rentals";
import { getMarket } from "@/modules/rentals/market/config";
import { MarketListingEdit } from "@/modules/rentals/market/market-host";

export const metadata = { title: "Edit listing" };

export default async function EditListingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  await requireHost();
  const { id } = await params;
  const market = await getMarket();
  if (market) return <MarketListingEdit m={market} id={id} created={!!(await searchParams).created} />;
  const detail = await stowbo.host.listing(id).catch(() => null);

  if (!detail?.listing) {
    return (
      <>
        <SiteHeader />
        <DashboardShell nav={(await getNav()).provider} title="Edit listing" action={<Link className="btn ghost sm" href={routes.hostListings}>← All listings</Link>}>
          <EmptyState title="Listing not found" note="This listing may have been removed, or it isn't one of yours." ctaLabel="Back to listings" ctaHref={routes.hostListings} />
        </DashboardShell>
      </>
    );
  }

  const l = detail.listing.data;
  return (
    <>
      <SiteHeader />
      <DashboardShell nav={(await getNav()).provider} title={l?.title ? `Edit · ${l.title}` : "Edit listing"} action={<Link className="btn ghost sm" href={routes.hostListing(id)}>← Back to listing</Link>}>
        <ListingEditor
          id={id}
          listingName={l?.name ?? id}
          listing={l ?? {}}
          units={(detail.units ?? []).map((u) => ({ sk: u.sk, ...u.data }))}
        />
      </DashboardShell>
    </>
  );
}
