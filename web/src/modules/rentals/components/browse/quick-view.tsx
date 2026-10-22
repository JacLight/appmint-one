"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { routes } from "@/lib/nav";
import { BookingPanel } from "@/modules/rentals/components/listing/booking-panel";
import { quickViewAction, type QuickView } from "@/modules/rentals/actions/quick-view";

/** Browse quick-view: a right-side drawer that previews a listing and hosts the
 *  real booking panel, so a card / map-pin click never leaves the results (and
 *  the filters stay put). "View full details" is there for the full page. */
export function QuickViewDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const [data, setData] = useState<QuickView | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) { setData(null); return; }
    let live = true;
    setLoading(true); setData(null);
    quickViewAction(id).then((qv) => { if (live) { setData(qv); setLoading(false); } });
    return () => { live = false; };
  }, [id]);

  // Escape to close. Non-modal: the results + map behind stay fully interactive
  // (no backdrop, no scroll lock) — clicking another card/pin just swaps the panel.
  useEffect(() => {
    if (!id) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); };
  }, [id, onClose]);

  if (!id) return null;

  const fullHref = data
    ? `${routes.listing(data.id)}?ref=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname + window.location.search : routes.browse)}`
    : routes.listing(id);

  return (
    <aside className="qv" aria-label="Space quick view">
        <button className="qv-x" onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2}><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>

        {loading && <div className="qv-loading">Loading…</div>}

        {!loading && data && (
          <>
            <div className="qv-photos">
              {data.photos.length ? (
                data.photos.slice(0, 5).map((src, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={src} alt={`${data.title} photo ${i + 1}`} className={i === 0 ? "qv-photo-lead" : "qv-photo"} />
                ))
              ) : (
                <div className="qv-photo-empty">No photos yet</div>
              )}
            </div>

            <div className="qv-body">
              <div className="qv-head">
                <h2>{data.title}</h2>
                <div className="qv-meta">
                  <span>{data.classLabel}</span>
                  <span>{data.location}</span>
                  <span>{data.staffing}</span>
                  {data.capacity ? <span>capacity {data.capacity}</span> : null}
                  {data.size ? <span>{data.size}</span> : null}
                </div>
              </div>

              {data.description && <p className="qv-desc">{data.description}</p>}

              <BookingPanel
                listingId={data.id}
                price={data.panel.price}
                priceUnit={data.panel.priceUnit}
                capacity={data.panel.capacity}
                unitNoun={data.panel.unitNoun}
                addOns={data.panel.addOns}
                spots={data.panel.spots}
                signedIn={data.panel.signedIn}
                timeOfDay={data.panel.timeOfDay}
                availability={data.panel.availability}
                payment={data.panel.payment}
                title={data.title}
                locationLabel={data.location}
                staffingLabel={data.classLabel}
              />

              <Link className="qv-full" href={fullHref}>View full details →</Link>
            </div>
          </>
        )}

        {!loading && !data && (
          <div className="qv-loading">
            <p className="muted">Couldn’t load this space.</p>
            <Link className="btn ghost sm" href={fullHref}>Open full page →</Link>
          </div>
        )}
    </aside>
  );
}
