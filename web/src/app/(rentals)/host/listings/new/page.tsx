import { SiteHeader } from "@/components/site-header";
import { ListingWizard } from "@/modules/rentals/components/host/listing-wizard";
import { requireHost } from "@/lib/guards";
import { getMarket } from "@/modules/rentals/market/config";
import { MarketListingEdit } from "@/modules/rentals/market/market-host";

export const metadata = { title: "New listing" };

export default async function NewListing() {
  await requireHost();
  const market = await getMarket();
  if (market) return <MarketListingEdit m={market} id={null} />;
  return (
    <>
      <SiteHeader />
      <section className="pagehead"><div className="wrap"><p className="eyebrow">New listing</p><h1>List your space</h1><p className="sub">A few quick steps — set it up, then publish when you&apos;re ready.</p></div></section>
      <div className="wrap">
        <ListingWizard />
      </div>
    </>
  );
}
