import Link from "next/link";
import { routes } from "@/lib/nav";
import { classLabel } from "@/modules/rentals/lib/classes";
import { stowbo, type ListingCard } from "@/api/rentals";

function imageUrl(images: unknown): string | undefined {
  if (!Array.isArray(images)) return undefined;
  const f = images.find((x) => typeof x === "string" || (x && typeof x === "object" && "url" in x));
  return typeof f === "string" ? f : (f as { url?: string })?.url;
}

/** Shared presentational grid of listing cards. */
export function ListingCardGrid({ title, cards }: { title: string; cards: ListingCard[] }) {
  if (!cards.length) return null;
  return (
    <section className="hostmore">
      <h2>{title}</h2>
      <div className="hostmore-grid">
        {cards.map((m) => (
          <Link key={m.sk} href={routes.listing(m.sk)} className="hostmore-card">
            <div className="hostmore-img" style={m.image ? { backgroundImage: `url(${m.image})` } : undefined}>{!m.image && <span>{classLabel(m.spaceType)}</span>}</div>
            <div className="hostmore-body">
              <b>{m.title || "Space"}</b>
              <span className="hostmore-sub">{[classLabel(m.spaceType), m.city, m.distanceKm != null ? `${m.distanceKm.toFixed(m.distanceKm < 10 ? 1 : 0)} km away` : null].filter(Boolean).join(" · ")}</span>
              {m.price != null && <span className="hostmore-price">from <b>${m.price}</b>{m.priceUnit ? <small>/{m.priceUnit}</small> : null}</span>}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

/** "More from this host" — prefers the real endpoint; falls back to an owner query
 *  on older prod where the endpoint isn't deployed yet. Streamed via Suspense so a
 *  slow query never blocks the listing page. */
export async function MoreFromHost({ listingId, hostId, excludeSk, hostName }: { listingId: string; hostId?: string; excludeSk: string; hostName?: string }) {
  // 1. The real endpoint (guest-safe cards, priced + trimmed server-side).
  const viaEndpoint = await stowbo.moreFromHost(listingId).catch(() => null);
  if (viaEndpoint?.data?.length) {
    return <ListingCardGrid title={`More from ${viaEndpoint.host?.displayName || hostName || "this host"}`} cards={viaEndpoint.data} />;
  }
  // 2. Fallback: filter the browse by owner id (works on current prod).
  if (!hostId) return null;
  const all = await stowbo.listings({ pageSize: 200 }).catch(() => null);
  const cards: ListingCard[] = (all?.data ?? [])
    .filter((l) => {
      const x: any = l.data ?? {};
      return (x.hostId === hostId || (l as any)?.owner?.id === hostId) && l.sk !== excludeSk && !x.parent && (x.status ?? "active") === "active";
    })
    .slice(0, 6)
    .map((l) => {
      const x: any = l.data ?? {};
      return { sk: l.sk, title: x.title, spaceType: x.spaceType, city: x.address?.city, image: imageUrl(x.images), price: x.price, priceUnit: x.priceUnit };
    });
  return <ListingCardGrid title={`More from ${hostName || "this host"}`} cards={cards} />;
}
