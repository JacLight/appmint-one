import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata = { title: "How it works" };

export default function HowItWorks() {
  return (
    <>
      <SiteHeader />

      {/* PAGE HEADER */}
      <section className="pagehead"><div className="wrap">
        <p className="eyebrow">How it works</p>
        <h1>Stow it. Go enjoy. Grab it later.</h1>
        <p className="sub">Stowbo connects you with trusted local spots for your bags, boxes, gear or car. Renters save by stashing at a neighbor&apos;s place instead of paying downtown rates. Hosts earn from space they already have. Every handoff is confirmed with a code, a photo and a count.</p>
      </div></section>

      {/* RENTER FLOW */}
      <section className="sec"><div className="wrap"><div className="how">
        <p className="eyebrow">For renters — you save</p>
        <h2>Four taps, hands free.</h2>
        <p className="lead">Find a spot, book a window, drop it off, and pick it up whenever you&apos;re done. You only pay for the time you actually use.</p>
        <div className="steps">
          <div className="step"><div className="n">1</div><h3>Search a spot near you</h3><p>Enter where you&apos;re headed and what you&apos;re stashing. Browse verified spots by distance, price and rating.</p></div>
          <div className="step"><div className="n">2</div><h3>Book your window</h3><p>Pick your drop-off and pick-up times and reserve in seconds. A small hold locks in your spot.</p></div>
          <div className="step"><div className="n">3</div><h3>Drop it off</h3><p>Show your code, the host snaps a photo and counts your items. That&apos;s your custody receipt.</p></div>
          <div className="step"><div className="n">4</div><h3>Grab it whenever</h3><p>Come back, show the code, walk away. Pay only for the time used — nothing wasted.</p></div>
        </div>
      </div></div></section>

      {/* FOR HOSTS */}
      <section className="sec" style={{ paddingTop: 0 }}><div className="wrap">
        <div className="sec-head"><div><p className="eyebrow">For hosts — you earn</p><h2>Turn spare space into steady income</h2><p>A back counter, a few parking bays, a locker wall or a quiet spare room. You set the price and your hours — Stowbo brings the guests and handles payment.</p></div></div>
        <div className="hsteps">
          <div className="hstep"><div className="n"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 10l9-6 9 6v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z" /></svg></div><h3>List your space</h3><p>Tell us what you&apos;ve got — parking, lockers, a box-drop, cold storage or a spare room. Set your price and availability.</p></div>
          <div className="hstep"><div className="n"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 12l5 5 11-11" /></svg></div><h3>Accept drop-offs</h3><p>Guests book, arrive with a code, and you log a quick photo and count. Every handoff is on the record.</p></div>
          <div className="hstep"><div className="n"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 10h18" /><circle cx="7" cy="14" r="1" /></svg></div><h3>Get paid weekly</h3><p>Earnings land in your account every week — no chasing cash, no invoices. Payout follows the handoff.</p></div>
        </div>
      </div></section>

      {/* CUSTODY + PROTECTION */}
      <section className="sec" style={{ paddingTop: 0 }}><div className="wrap">
        <div className="sec-head"><div><p className="eyebrow">The handoff</p><h2>Code, photo, count — every time</h2><p>Custody changes hands the same way in both directions, so there&apos;s never a question about what was left or picked up. That&apos;s protection, not insurance — covered up to $5,000.</p></div></div>
        <div className="tgrid" style={{ paddingTop: 0 }}>
          <div className="tg"><div className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></svg></div><h3>A one-time code</h3><p>You get a unique code for the drop-off and another for pickup. No matching code, no hand-back — simple as that.</p></div>
          <div className="tg"><div className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="6" width="18" height="14" rx="2" /><circle cx="12" cy="13" r="3.5" /><path d="M8 6l1.5-2h5L16 6" /></svg></div><h3>A photo on record</h3><p>The host snaps your items at drop-off and pickup, timestamped and stored, so the condition is never in doubt.</p></div>
          <div className="tg"><div className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z" /><path d="M9 12l2 2 4-4" /></svg></div><h3>Protected to $5,000</h3><p>Every stash is covered by Stowbo Protection, with a receipt trail if anything is ever off. <Link href="/protection">See what&apos;s covered →</Link></p></div>
        </div>
      </div></section>

      {/* FAQ */}
      <section className="sec" style={{ paddingTop: 0 }}><div className="wrap">
        <div className="sec-head"><div><p className="eyebrow">Good to know</p><h2>Questions people ask</h2></div></div>
        <div className="faqcol" style={{ paddingTop: 0 }}>
          <details className="q"><summary>What can I store?</summary><p>Everyday things: bags and luggage, boxes, sports and camping gear, instruments, event kit, coats and more. Spots list what they take — from parking and lockers to box storage, warehouse, shared space, spare rooms, cold storage, and event or bag drop. A few things are never allowed; check the <Link href="/prohibited">prohibited items</Link> list before you book.</p></details>
          <details className="q"><summary>How is my stuff kept safe?</summary><p>Every handoff uses a code, a photo and a count in both directions, so there&apos;s a clear record of what you left and what you picked up. Hosts and renters are identity-verified, payments stay on-platform, and each stash is backed by Stowbo Protection up to $5,000. It&apos;s protection, not insurance — a straightforward promise with a receipt trail.</p></details>
          <details className="q"><summary>What does it cost?</summary><p>You pay for the time and space you actually use — by the hour, the day, or per item, depending on the spot. Prices are shown up front before you book, and hosts set their own rates, so a driveway or a back counter is usually far cheaper than a downtown garage or a left-luggage desk.</p></details>
          <details className="q"><summary>Manned or unmanned spots?</summary><p>Both. Manned spots have someone on hand to do the photo-and-count with you — think a coffee shop, hotel or shop counter. Unmanned spots are self-serve, like a locker wall or a secure driveway, where you log the code and photo yourself. Each listing says which it is and its access hours.</p></details>
          <details className="q"><summary>Can I extend?</summary><p>Yes. If you need more time, extend right from your phone as long as the spot is still available for your new window. You&apos;re only charged for the extra time you use, at the same posted rate — no penalty for staying a little longer.</p></details>
        </div>
      </div></section>

      {/* CTA BAND */}
      <section className="sec" style={{ paddingTop: 0 }}><div className="wrap"><div className="hostband">
        <div className="bg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <span className="ph-empty" aria-hidden="true" />
        </div>
        <div className="c"><p className="eyebrow">Ready when you are</p><h2>Find a spot, or list your own</h2><p>Renters save by stashing nearby. Hosts earn from space they already have. Either way, it takes a minute to start.</p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link className="btn clay lg" href="/browse">Browse spots</Link>
            <Link className="btn lime lg" href="/host">List your space</Link>
          </div>
        </div>
      </div></div></section>

      <SiteFooter />
    </>
  );
}
