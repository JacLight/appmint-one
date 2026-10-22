import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { RotatingWord } from "@/modules/rentals/components/rotating-word";
import { stowbo } from "@/api/rentals";
import { classLabel } from "@/modules/rentals/lib/classes";
import { routes } from "@/lib/nav";

/** First usable image URL from a listing's `images` (string[] or FileInfo[]). */
function firstImageUrl(images: unknown): string | undefined {
  if (!Array.isArray(images)) return undefined;
  for (const x of images) {
    if (typeof x === "string" && x) return x;
    if (x && typeof x === "object" && "url" in x && (x as { url?: string }).url) return (x as { url?: string }).url;
  }
  return undefined;
}

/** Stowbo's marketplace home, unchanged from stowbo-web — rendered by app/page.tsx
 *  when the setup's home.variant is "stowbo". */
export async function StowboHome() {
  // Real spots for the "ready when you are" strip — links to /listing/[sk], not a dead /listing.
  const res = await stowbo.listings({ pageSize: 8 }).catch(() => null);
  const spots = (res?.data ?? [])
    .map((r) => ({ sk: r.sk, d: r.data }))
    .filter((x) => x.sk && firstImageUrl(x.d?.images))
    .slice(0, 8);

  return (
    <>
      <SiteHeader />

      {/* HERO */}
      <section className="hero"><div className="wrap">
        <div className="herotop">
          <h1>Somewhere to <RotatingWord /></h1>
        </div>

        <div className="services two">
          <Link className="svc store" href="/browse?c=storage">
            <span className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 8l9-4 9 4-9 4-9-4z" /><path d="M3 8v8l9 4 9-4V8" /><path d="M12 12v8" /></svg></span>
            <div className="svc-b"><h3>Store your things</h3><p>A locker, a box‑drop, a warehouse or a spare room — staffed or self‑serve.</p><span className="cta">Find storage →</span></div>
          </Link>
          <Link className="svc park" href="/browse?c=parking">
            <span className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M5 16l1.5-5h11L19 16" /><rect x="3" y="16" width="18" height="4" rx="1" /><circle cx="7" cy="20" r="1" /><circle cx="17" cy="20" r="1" /></svg></span>
            <div className="svc-b"><h3>Park your car</h3><p>Someone&apos;s driveway, a lot, a garage — closer and cheaper than the meter.</p><span className="cta">Find parking →</span></div>
          </Link>
        </div>

        <div className="psearch wide">
          <div className="seg w2"><label>Where to</label><div className="segin"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></svg><input placeholder="City, address or venue" /></div></div>
          <div className="seg"><label>Drop‑off</label><div className="segin"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v4M16 3v4" /></svg><input type="date" /></div></div>
          <div className="seg"><label>Pick‑up</label><div className="segin"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v4M16 3v4" /></svg><input type="date" /></div></div>
          <div className="go"><Link className="btn clay" href="/browse" style={{ borderRadius: 13 }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} width={18} height={18}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg> Find spots</Link></div>
        </div>
        <div className="searchmeta">Over <b>1,200 trusted spots</b> in 38 cities · booked, verified &amp; protected up to $5,000.</div>

        <div className="hero-app">
          <span className="lbl">Book faster in the app —</span>
          <a className="appbadge" href="https://apps.apple.com/us/app/stowbo/id6805764877" target="_blank" rel="noopener" aria-label="Download on the App Store"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.31-1.32-3.15-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83zM13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" /></svg><span><small>Download on the</small><b>App Store</b></span></a>
        </div>
      </div></section>

      {/* LISTINGS */}
      <section className="sec" style={{ paddingTop: 0 }}><div className="wrap">
        <div className="sec-head"><div><p className="eyebrow">Open now near you</p><h2>Spots ready when you are</h2><p>Real businesses with room to spare — rated, verified, and Stowbo‑protected.</p></div><Link className="more" href="/browse">See all →</Link></div>
        <div className="grid">
          {spots.map(({ sk, d }) => {
            const city = d?.address?.city ? `${d.address.city}${d.address?.state ? `, ${d.address.state}` : ""}` : "";
            return (
              <Link className="lcard" href={routes.listing(sk)} key={sk}>
                <div className="ph">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={firstImageUrl(d?.images)} loading="lazy" alt={d?.title ?? ""} />
                  <span className="kind">{classLabel(d?.spaceType)}</span>
                  <button className="fav" aria-label="Save">♡</button>
                </div>
                <div className="b">
                  <div className="row1"><h3>{d?.title}</h3></div>
                  <div className="loc">{city}</div>
                  <div className="pr">{d?.price ? (<><b>${d.price}</b> <small>/ {d?.priceUnit}</small></>) : <small className="muted">Ask for pricing</small>}</div>
                </div>
              </Link>
            );
          })}
        </div>
      </div></section>

      {/* HOW */}
      <section id="how" className="sec" style={{ paddingTop: 0 }}><div className="wrap"><div className="how">
        <p className="eyebrow">How it works</p>
        <h2>Four taps, hands free.</h2>
        <p className="lead">Every handoff is confirmed both ways — a code, a photo, a count. No code, no hand‑back.</p>
        <div className="steps">
          <div className="step"><div className="n">1</div><h3>Book a spot</h3><p>Pick a place and your window. Pay a small hold.</p></div>
          <div className="step"><div className="n">2</div><h3>Drop it off</h3><p>Flash your code. They snap a photo &amp; count — it&apos;s stashed.</p></div>
          <div className="step"><div className="n">3</div><h3>Go do you</h3><p>Hands free. Track what&apos;s where, right from your phone.</p></div>
          <div className="step"><div className="n">4</div><h3>Grab &amp; go</h3><p>Come back, show the code, done. Pay for the time only.</p></div>
        </div>
      </div></div></section>

      {/* TRUST */}
      <section className="sec" style={{ paddingTop: 0 }}><div className="wrap">
        <div className="sec-head"><div><p className="eyebrow">Zero sketch</p><h2>Your stuff, provably safe</h2></div></div>
        <div className="trustrow">
          <div className="tcard"><div className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9 2 2-2 2 2 2-3 3-2-2-3 3" /></svg></div><h3>Code + photo + count</h3><p>Logged on drop‑off and pickup. No match, no release — simple as that.</p></div>
          <div className="tcard"><div className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z" /></svg></div><h3>Protected to $5,000</h3><p>Every stash is covered, with a receipt trail if anything&apos;s ever off.</p></div>
          <div className="tcard"><div className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="9" /><path d="M8 12l3 3 5-6" /></svg></div><h3>Verified hosts</h3><p>Real, ID‑checked businesses — with ratings you can actually trust.</p></div>
        </div>
      </div></section>

      {/* STATS */}
      <section className="sec" style={{ paddingTop: 0 }}><div className="wrap"><div className="stats">
        <div className="stat"><div className="big">1,200+</div><div className="lbl">Trusted spots</div></div>
        <div className="stat"><div className="big">38</div><div className="lbl">Cities live</div></div>
        <div className="stat"><div className="big">190k</div><div className="lbl">Things stashed</div></div>
        <div className="stat"><div className="big">4.9★</div><div className="lbl">Avg. host rating</div></div>
      </div></div></section>

      {/* HOST */}
      <section className="sec" style={{ paddingTop: 0 }}><div className="wrap"><div className="hostband">
        <div className="bg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <span className="ph-empty" aria-hidden="true" />
        </div>
        <div className="c"><p className="eyebrow">Got space?</p><h2>Get paid for the room you&apos;re not using</h2><p>A back counter, a few parking bays, a quiet afternoon — turn it into income. You set the price, we bring the guests.</p><Link className="btn lime lg" href="/host">Start hosting</Link></div>
      </div></div></section>

      <SiteFooter />
    </>
  );
}
