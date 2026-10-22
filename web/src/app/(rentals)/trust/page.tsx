import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata = { title: "Trust & Safety" };

export default function Trust() {
  return (
    <>
      <SiteHeader />

      {/* PAGE HEADER */}
      <section className="pagehead"><div className="wrap">
        <p className="eyebrow">Trust &amp; safety</p>
        <h1>Every stash, provably safe.</h1>
        <p className="sub">Stowbo is built so a renter can save at a neighbor&apos;s spot and a host can earn from spare space — without either one taking a leap of faith. Verified people, a handoff you can prove, payments that stay on-platform, and protection up to $5,000 behind every booking.</p>
      </div></section>

      {/* TRUST GRID */}
      <section className="sec"><div className="wrap">
        <div className="tgrid" style={{ paddingTop: 0 }}>
          <div className="tg"><div className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /><path d="M17 3l1.5 1.5L21 2" /></svg></div><h3>Identity-verified hosts &amp; renters</h3><p>Everyone on Stowbo confirms who they are before they book or host, so you always know who you&apos;re handing off to. <Link href="/how-it-works">See how it works →</Link></p></div>
          <div className="tg"><div className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="6" width="18" height="14" rx="2" /><circle cx="12" cy="13" r="3.5" /><path d="M8 6l1.5-2h5L16 6" /></svg></div><h3>Code + photo + count handoff</h3><p>Custody changes hands with a one-time code, a timestamped photo and an item count — in both directions. No match, no hand-back. <Link href="/how-it-works">The handoff, step by step →</Link></p></div>
          <div className="tg"><div className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 10h18" /><circle cx="7" cy="14" r="1" /></svg></div><h3>Secure on-platform payments</h3><p>Money stays inside Stowbo — never cash in hand. The host&apos;s payout is released after the handoff is confirmed. <Link href="/protection">How payouts work →</Link></p></div>
          <div className="tg"><div className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z" /><path d="M9 12l2 2 4-4" /></svg></div><h3>Stowbo Protection up to $5,000</h3><p>It&apos;s protection, not insurance: a straightforward promise, backed by the receipt trail, on every booking. <Link href="/protection">See what&apos;s covered →</Link></p></div>
          <div className="tg"><div className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 3l2.9 6 6.1.6-4.6 4.2 1.3 6.2L12 17.8 6.3 20l1.3-6.2L3 9.6 9.1 9z" /></svg></div><h3>Two-way reviews &amp; ratings</h3><p>Renters rate hosts and hosts rate renters after every stash, so good behavior is visible and reputations are earned honestly.</p></div>
          <div className="tg"><div className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z" /><rect x="9.5" y="8" width="5" height="4.5" rx="1" /><path d="M10.5 8V6.5a1.5 1.5 0 013 0V8" /></svg></div><h3>Your address stays private</h3><p>Exact locations are hidden until a booking is confirmed. Hosts and renters only share the details they need, only when they need them.</p></div>
        </div>
      </div></section>

      {/* COMMUNITY STANDARDS */}
      <section className="sec" style={{ paddingTop: 0 }}><div className="wrap">
        <div className="how">
          <p className="eyebrow">Community standards</p>
          <h2>What belongs — and what never does</h2>
          <p className="lead">Stowbo works because people treat each other&apos;s space with care. That means honest listings, on-time handoffs, respectful messages, and keeping everything on-platform. It also means some things simply can&apos;t be stored — hazardous, illegal, perishable-without-cold, or living items among them.</p>
          <p className="lead" style={{ marginTop: 16 }}><Link href="/prohibited" style={{ color: "var(--pop)", borderBottom: "2px solid var(--pop)", paddingBottom: 2, fontFamily: "var(--font-display)", fontWeight: 600 }}>Read the full prohibited items list →</Link></p>
        </div>
      </div></section>

      {/* TIPS CHECKLIST */}
      <section className="sec" style={{ paddingTop: 0 }}><div className="wrap">
        <div className="sec-head"><div><p className="eyebrow">Stay safe out there</p><h2>Simple habits that protect everyone</h2></div></div>
        <div className="checklist">
          <div>
            <h3>Tips for renters</h3>
            <ul>
              <li>Keep all messages and payments on Stowbo — never move off-platform.</li>
              <li>Photograph your items yourself before you drop them off.</li>
              <li>Read the host&apos;s reviews and ratings before you book.</li>
              <li>Check the spot&apos;s access hours and whether it&apos;s manned or self-serve.</li>
              <li>Confirm the code, photo and count match at both drop-off and pickup.</li>
            </ul>
          </div>
          <div>
            <h3>Tips for hosts</h3>
            <ul>
              <li>Keep all messages and payments on Stowbo — payout follows the handoff.</li>
              <li>Take a clear photo and an honest count at every drop-off and pickup.</li>
              <li>Describe your space accurately, including access hours and limits.</li>
              <li>Never accept items on the prohibited list — decline if unsure.</li>
              <li>Store guests&apos; things securely and keep the space as listed.</li>
            </ul>
          </div>
        </div>
      </div></section>

      {/* SUPPORT / REPORT CTA */}
      <section className="sec" style={{ paddingTop: 0 }}><div className="wrap"><div className="hostband">
        <div className="bg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <span className="ph-empty" aria-hidden="true" />
        </div>
        <div className="c"><p className="eyebrow">Something not right?</p><h2>Report it — we&apos;re on it</h2><p>If a stash, a host or a renter ever feels off, tell us. Our team reviews every report, and Stowbo Protection has your back up to $5,000.</p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link className="btn lime lg" href="/help">Get help &amp; report</Link>
            <Link className="btn ghost lg" href="/protection" style={{ borderColor: "#fff", color: "#fff" }}>See protection →</Link>
          </div>
        </div>
      </div></div></section>

      <SiteFooter />
    </>
  );
}
