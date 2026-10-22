import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { DashboardShell } from "@/components/dashboard-shell";
import { EmptyState } from "@/components/empty-state";
import { requireHost } from "@/lib/guards";
import { routes } from "@/lib/nav";
import { getNav } from "@/lib/nav-server";
import { stowbo } from "@/api/rentals";
import { getMarket } from "@/modules/rentals/market/config";
import { MarketHostListings } from "@/modules/rentals/market/market-host";

export const metadata = { title: "Your listings" };

export default async function HostListings() {
  await requireHost();
  const market = await getMarket();
  if (market) return <MarketHostListings m={market} />;
  const res = await stowbo.host.listings().catch(() => null);
  const listings = res?.data ?? [];

  return (
    <>
      <SiteHeader />
      <DashboardShell nav={(await getNav()).provider} title="Listings" action={<Link className="btn clay sm" href={routes.hostListingNew}>+ New listing</Link>}>
        {listings.length === 0 ? (
          <EmptyState title="No listings yet" note="Create your first space. It stays a draft until you publish it." ctaLabel="Create a listing →" ctaHref={routes.hostListingNew} />
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {listings.map((l) => (
              <Link key={l.sk} href={routes.hostListing(l.sk)} className="tcard" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
                <div>
                  <b style={{ fontFamily: "var(--font-display)" }}>{l.data?.title}</b>
                  <div className="muted" style={{ fontSize: 13 }}>{l.data?.spaceType} · capacity {l.data?.capacity ?? 1} · {l.data?.price ? `$${l.data.price}/${l.data.priceUnit}` : "no price"}</div>
                </div>
                <span className="fpill on" style={{ fontSize: 12 }}>{l.data?.status}</span>
              </Link>
            ))}
          </div>
        )}
      </DashboardShell>
    </>
  );
}
