import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MoreFromHost, ListingCardGrid } from "@/modules/rentals/components/listing/more-from-host";
import { NearbyAlternatives } from "@/modules/rentals/components/listing/nearby-alternatives";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { routes } from "@/lib/nav";
import { classLabel } from "@/modules/rentals/lib/classes";
import { BookingPanel, type PanelAddOn, type PanelSpot } from "@/modules/rentals/components/listing/booking-panel";
import { ListingGallery } from "@/modules/rentals/components/listing/gallery";
import { getSession } from "@/lib/auth";
import { getMarket } from "@/modules/rentals/market/config";
import { MarketListing } from "@/modules/rentals/market/market-listing";
import { stowbo, type ListingDetail } from "@/api/rentals";
import type { Metadata } from "next";
import { abs } from "@/lib/seo";
import { getSetup } from "@/lib/setup";

/** URLs from a listing's `images` (handles both string[] and FileInfo[]). */
function imageUrls(images: unknown): string[] {
  if (!Array.isArray(images)) return [];
  return images
    .map((x) => (typeof x === "string" ? x : x && typeof x === "object" && "url" in x ? (x as { url?: string }).url : undefined))
    .filter((u): u is string => !!u);
}

/** A human noun for one bookable unit of this class. */
const UNIT_NOUN: Record<string, string> = {
  parking: "spot", locker: "locker", "box-storage": "box", "shared-space": "space",
  warehouse: "bay", "spare-room": "room", "cold-storage": "unit", "bike-gear": "slot", "event-bag-drop": "bag",
};

function initials(name?: string): string {
  if (!name) return "H";
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "H";
}
function monthYear(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/** Per-listing SEO: a real title/description/canonical + the listing's own photo
 *  as the share image. Pulls from the same record the page renders. */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const detail = (await stowbo.listing(id).catch(() => null)) as ListingDetail | null;
  const d = detail?.listing?.data as any;
  if (!d) return { title: "Space not found" };
  if (await getMarket()) {
    const where = [d.address?.city, d.address?.state].filter(Boolean).join(", ");
    const photo = imageUrls(d.images)[0];
    const t = [d.title, [d.details?.propertyType, where].filter(Boolean).join(" in ")].filter(Boolean).join(" — ");
    return { title: t, description: String(d.description || "").slice(0, 300), alternates: { canonical: `/listing/${id}` }, openGraph: { type: "website", title: t, url: abs(`/listing/${id}`), ...(photo ? { images: [{ url: photo }] } : {}) } };
  }

  const cls = classLabel(d.spaceType);
  const city = d.address?.city ? `${d.address.city}${d.address?.state ? `, ${d.address.state}` : ""}` : null;
  const title = [d.title, city ? `${cls} in ${city}` : cls].filter(Boolean).join(" — ");
  const price = d.price ? `From $${d.price}/${d.priceUnit || "day"}. ` : "";
  const SITE_NAME = (await getSetup()).brand.name;
  const description = (d.description as string)?.trim()
    || `${price}Book this ${cls.toLowerCase()}${city ? ` in ${city}` : ""} on ${SITE_NAME} — reserved in seconds, dropped off with a code, grabbed whenever you're done.`;
  const photos = imageUrls(d.images);
  const canonical = `/listing/${id}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      title,
      description,
      url: abs(canonical),
      ...(photos.length ? { images: [{ url: photos[0] }] } : {}),
    },
    twitter: { card: "summary_large_image", title, description, ...(photos.length ? { images: [photos[0]] } : {}) },
  };
}

export default async function ListingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ from?: string; to?: string; ref?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  // Stays / gear setups render their own listing page; Stowbo continues below, unchanged.
  const market = await getMarket();
  if (market) return <MarketListing m={market} id={id} sp={sp as Record<string, string | undefined>} />;
  // Back to the filtered browse they came from (internal paths only), else /browse.
  const browseHref = sp.ref && /^\/[^/]/.test(decodeURIComponent(sp.ref)) ? decodeURIComponent(sp.ref) : routes.browse;
  const detail = (await stowbo.listing(id).catch(() => null)) as ListingDetail | null;
  if (!detail?.listing) notFound();

  const d = detail.listing.data;
  const spots = detail.children ?? [];
  const addOns = detail.addOns ?? [];
  const photos = imageUrls(d?.images);
  const features: string[] = Array.isArray(d?.features) ? d.features : [];
  const session = await getSession();
  const unitNoun = (d?.unitLabel as string) || UNIT_NOUN[d?.spaceType ?? ""] || "unit";

  const panelAddOns: PanelAddOn[] = addOns.map((a) => ({
    name: a.data?.name, title: a.data?.title || a.data?.name, price: a.data?.price, chargeEvery: a.data?.chargeEvery,
  })).filter((a) => a.name);
  const panelSpots: PanelSpot[] = spots.map((s) => ({
    sk: s.sk, title: s.data?.title || s.data?.spaceType || "Spot",
    price: s.data?.price, priceUnit: s.data?.priceUnit, capacity: s.data?.capacity ?? 1,
  }));
  // Time-of-day matters for hourly / same-day drops (bag check, hourly parking);
  // for day/week/month storage it's all-day, so date-only.
  const timeOfDay = d?.spaceType === "event-bag-drop" || d?.priceUnit === "hour" || panelSpots.some((s) => s.priceUnit === "hour");

  // Host profile: prefer the server's guest-safe `host` block; fall back to the
  // fields denormalized onto the listing (older prod, before the endpoint ships).
  const host = detail.host ?? ((d as any)?.hostName
    ? { id: (d as any)?.hostId || (detail.listing as any)?.owner?.id || "", displayName: (d as any).hostName as string, avatar: null, memberSince: (d as any).hostSince as string | undefined, listingCount: (d as any).hostListingCount as number | undefined }
    : null);
  const hostName = host?.displayName;
  const hostSince = monthYear(host?.memberSince as string | undefined);
  const hostId = host?.id || (detail.listing as any)?.owner?.id;
  const loc = (d as any)?.location;

  // Product + offer structured data for rich results.
  const productLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: d?.title,
    category: classLabel(d?.spaceType),
    ...(d?.description ? { description: d.description } : {}),
    ...(photos.length ? { image: photos } : {}),
    ...(d?.price
      ? {
          offers: {
            "@type": "Offer",
            price: d.price,
            priceCurrency: "USD",
            availability: "https://schema.org/InStock",
            url: abs(`/listing/${id}`),
          },
        }
      : {}),
    ...(d?.address?.city
      ? { areaServed: { "@type": "City", name: d.address.city } }
      : {}),
    ...(hostName ? { brand: { "@type": "Brand", name: hostName } } : {}),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productLd) }} />
      <SiteHeader />
      <div className="wrap wrap-pd" style={{ paddingTop: 20 }}>
        <div className="crumb"><Link href={routes.home}>Home</Link> / <Link href={browseHref}>Browse</Link> / <b>{d?.title}</b></div>

        {/* title + key info FIRST (above the picture), then gallery left / booking right */}
        <div className="pd-head">
          <h1>{d?.title}</h1>
          <div className="meta">
            <span>{classLabel(d?.spaceType)}</span>
            <span>{d?.address?.city || "—"}{d?.address?.state ? `, ${d.address.state}` : ""}</span>
            <span>{d?.staffing === "manned" ? "Staffed" : "Self-serve"}</span>
            {d?.capacity ? <span>capacity {d.capacity}</span> : null}
            {d?.size ? <span>{d.size}</span> : null}
          </div>
          {features.length > 0 && <div className="chiprow" style={{ marginTop: 12 }}>{features.map((f, i) => <span key={i}>{f}</span>)}</div>}
        </div>

        <div className="pd-split">
          <div className="pd-info">
            <ListingGallery photos={photos} title={d?.title} />

            {d?.description && (
              <div className="ldsec"><h2>About this space</h2><p className="muted" style={{ fontSize: 15, lineHeight: 1.7 }}>{d.description}</p></div>
            )}

            <div className="ldsec">
              <h2>{spots.length ? "Spot types" : "The space"}</h2>
              {spots.length === 0 ? (
                <p className="muted">A single space with a capacity of {d?.capacity ?? 1} — book one {unitNoun} or several, each with its own dates.</p>
              ) : (
                <div className="spots">
                  {spots.map((s) => (
                    <div key={s.sk} className="spot">
                      <div className="spot-main"><b>{s.data?.title}</b><span>{s.data?.size || s.data?.spaceType}</span></div>
                      <span className="spot-avail">capacity {s.data?.capacity ?? 1}</span>
                      <div className="spot-price">{s.data?.price ? (<>from <b>${s.data.price}</b><small>/ {s.data.priceUnit}</small></>) : <small>—</small>}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {addOns.length > 0 && (
              <div className="ldsec">
                <h2>Add-ons</h2>
                <div style={{ display: "grid", gap: 10 }}>
                  {addOns.map((a) => (
                    <div key={a.sk} className="tcard" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <b style={{ fontFamily: "var(--font-display)" }}>{a.data?.title || a.data?.name}</b>
                      <span className="fpill" style={{ fontSize: 12 }}>{a.data?.price ? `+$${a.data.price}` : "Free"}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {host && hostName && (
              <div className="ldsec">
                <h2>Hosted by {hostName}</h2>
                <div className="hostcard">
                  {host.avatar
                    ? <img className="hostcard-av hostcard-av-img" src={host.avatar} alt={hostName} />
                    : <div className="hostcard-av" aria-hidden>{initials(hostName)}</div>}
                  <div className="hostcard-meta">
                    <b>{hostName}</b>
                    <span>{[hostSince ? `Host since ${hostSince}` : null, host.listingCount ? `${host.listingCount} space${host.listingCount === 1 ? "" : "s"} on Stowbo` : null].filter(Boolean).join(" · ")}</span>
                    <span className="hostcard-verified">✓ Identity verified</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <aside className="pd-side">
            {d?.status && d.status !== "active" ? (
              // The server refuses guest bookings on a non-active listing (409) — say so
              // up front instead of letting them build a cart that can't check out.
              <div className="tcard pd-paused">
                <h3>{d.status === "paused" ? "Not taking bookings right now" : "Not available"}</h3>
                <p className="muted">{d.status === "paused" ? "The host has paused this space. Existing bookings stand; new ones will open when it’s back." : "This space isn’t published, so it can’t be booked."}</p>
                <Link className="btn ghost" href={browseHref}>Find another space</Link>
              </div>
            ) : (
            <BookingPanel
              listingId={id}
              price={d?.price}
              priceUnit={d?.priceUnit}
              capacity={d?.capacity ?? 1}
              unitNoun={unitNoun}
              addOns={panelAddOns}
              spots={panelSpots}
              signedIn={session.signedIn}
              timeOfDay={timeOfDay}
              availability={d?.availability}
              payment={d?.payment}
              initialFrom={sp.from ?? ""}
              initialTo={sp.to ?? ""}
              title={d?.title}
              locationLabel={[d?.address?.city, d?.address?.state].filter(Boolean).join(", ") || undefined}
              staffingLabel={classLabel(d?.spaceType)}
            />
            )}
          </aside>
        </div>

        {(detail.moreFromHost?.length ?? 0) > 0
          ? <ListingCardGrid title={`More from ${hostName || "this host"}`} cards={detail.moreFromHost!} />
          : (
            <Suspense fallback={null}>
              <MoreFromHost listingId={id} hostId={hostId} excludeSk={id} hostName={hostName} />
            </Suspense>
          )}

        <Suspense fallback={null}>
          <NearbyAlternatives listingId={id} spaceType={d?.spaceType} lat={loc?.lat} lng={loc?.lng} excludeSk={id} />
        </Suspense>
      </div>
      <SiteFooter />
    </>
  );
}
