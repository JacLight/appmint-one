import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export function StowboHelp() {
  return (
    <>
      <SiteHeader />

      {/* HELP HERO */}
      <section className="helphero"><div className="wrap">
        <h1>How can we help?</h1>
        <p>Whether you&apos;re stashing to save or hosting to earn, find quick answers below — or search for exactly what you need.</p>
        <div className="helpsearch">
          <input type="search" placeholder="Search help articles — bookings, payouts, refunds…" aria-label="Search help" />
          <button type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} width={18} height={18}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg></button>
        </div>
      </div></section>

      {/* TOPICS */}
      <div className="wrap">
        <div className="topics">
          <div className="topic"><div className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="9" /><path d="M12 16v-4M12 8h.01" /></svg></div><h3>Getting started</h3><p>What Stowbo is, how renting and hosting work, and where we operate.</p><a href="#getting-started">Read articles →</a></div>
          <div className="topic"><div className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></svg></div><h3>For renters</h3><p>Finding a spot, booking, dropping off, extending, and what you can store.</p><a href="#for-renters">Read articles →</a></div>
          <div className="topic"><div className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 10l9-6 9 6v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z" /></svg></div><h3>For hosts</h3><p>Listing your space, setting a price, getting paid, and managing bookings.</p><a href="#for-hosts">Read articles →</a></div>
          <div className="topic"><div className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 10h18" /><circle cx="7" cy="14" r="1" /></svg></div><h3>Payments &amp; fees</h3><p>What Stowbo charges, when you&apos;re billed, and how refunds work.</p><a href="#payments">Read articles →</a></div>
          <div className="topic"><div className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z" /><path d="M9 12l2 2 4-4" /></svg></div><h3>Trust &amp; safety</h3><p>How we verify people, protect your stuff, and handle problems.</p><a href="#trust-safety">Read articles →</a></div>
          <div className="topic"><div className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg></div><h3>Account</h3><p>Passwords, profile settings, and closing your Stowbo account.</p><a href="#account">Read articles →</a></div>
        </div>
      </div>

      {/* FAQ ACCORDIONS */}
      <div className="wrap"><div className="faqcol">

        <h2 id="getting-started">Getting started</h2>
        <details className="q"><summary>How does Stowbo work?</summary><p>Stowbo is a peer-to-peer marketplace for short-term storage and parking. Renters find a trusted local spot — a shop counter, a driveway, a locker wall — book a window, and drop off with a code, a photo and a count. You pay only for the time you use, and every stash is protected up to $5,000. Hosts earn by offering space they already have.</p></details>
        <details className="q"><summary>What&apos;s the difference between a renter and a host?</summary><p>A renter is stashing something to save money and hassle — parking, bags, boxes, gear. A host is earning by offering their space to those renters. The same account can do both: book a spot for your weekend trip, and list your spare garage the rest of the week.</p></details>
        <details className="q"><summary>Is Stowbo in my city?</summary><p>Stowbo is live in 38 cities and growing, with over 1,200 trusted spots. The fastest way to check is to search your city or address on the <Link href="/browse">browse page</Link> — if there are spots nearby, you&apos;ll see them on the map right away.</p></details>

        <h2 id="for-renters">For renters</h2>
        <details className="q"><summary>How do I find a spot near me?</summary><p>Head to <Link href="/browse">Browse</Link>, enter your destination and your drop-off and pick-up times, and filter by storage type, price and rating. Spots show on a map so you can pick one close to where you&apos;re going. Exact addresses are shared once you book.</p></details>
        <details className="q"><summary>How do I book and drop off?</summary><p>Choose a spot, confirm your window, and reserve — a small hold locks it in. When you arrive, show your one-time code. The host (or you, at a self-serve spot) takes a photo and counts your items. That&apos;s your custody receipt, and your stuff is stowed.</p></details>
        <details className="q"><summary>How do I extend my booking?</summary><p>If you need more time, open your booking and tap extend, as long as the spot is still free for your new window. You&apos;re only charged for the extra time at the same posted rate — no penalty for running late.</p></details>
        <details className="q"><summary>What can&apos;t I store?</summary><p>Everyday items are welcome — bags, boxes, gear, instruments, event kit and more. But hazardous, illegal, perishable-without-cold and living items are never allowed, among others. Check the full <Link href="/prohibited">prohibited items</Link> list before you book so there are no surprises at drop-off.</p></details>

        <h2 id="for-hosts">For hosts</h2>
        <details className="q"><summary>How do I list my space?</summary><p>Tap <Link href="/host">List your space</Link> and walk through a short setup: what you offer (parking, box storage, lockers, warehouse, shared space, spare room, cold storage, event or bag drop), your access hours, a few photos, and your price. You can go live in minutes.</p></details>
        <details className="q"><summary>How do I set my price?</summary><p>You&apos;re in control — charge by the hour, the day, or per item, whatever suits your space. Stowbo shows you what nearby spots charge so you can price competitively. You can adjust your rates anytime.</p></details>
        <details className="q"><summary>When do I get paid?</summary><p>Payouts are released after each handoff is confirmed, and earnings land in your account weekly. There&apos;s no cash to handle and no invoices to chase — it all flows through Stowbo.</p></details>
        <details className="q"><summary>Can I decline a booking?</summary><p>Yes. You set your availability, and you can decline a request that doesn&apos;t work for you. If someone tries to book something on the prohibited list or outside your hours, you&apos;re free to say no — see our <Link href="/cancellation">cancellation policy</Link> for how timing affects both sides.</p></details>

        <h2 id="payments">Payments &amp; fees</h2>
        <details className="q"><summary>What fees does Stowbo charge?</summary><p>Renters pay the host&apos;s posted rate plus a small service fee that keeps payments secure and every stash protected. Hosts pay a modest commission on their earnings. All fees are shown clearly before you confirm — no hidden charges.</p></details>
        <details className="q"><summary>When am I charged?</summary><p>A small hold is placed when you book to lock in your spot. The full amount is settled based on the time and space you actually use, so if you pick up early or extend, your charge reflects that. Everything stays on-platform.</p></details>
        <details className="q"><summary>How do refunds work?</summary><p>Refunds depend on when you cancel and the host&apos;s terms. Cancel early and you&apos;re generally refunded in full; closer to your window, part of the hold may be kept. Full details are in our <Link href="/cancellation">cancellation policy</Link>.</p></details>

        <h2 id="trust-safety">Trust &amp; safety</h2>
        <details className="q"><summary>How are users verified?</summary><p>Every host and renter confirms their identity before booking or hosting, so you always know who&apos;s on the other side of a handoff. Two-way reviews add another layer — reputations are earned over time. Learn more on our <Link href="/trust">trust &amp; safety</Link> page.</p></details>
        <details className="q"><summary>What if something&apos;s damaged?</summary><p>The code, photo and count on every handoff give you a clear record of your items&apos; condition. If something&apos;s damaged or missing, report it and Stowbo Protection has you covered up to $5,000. See what qualifies on the <Link href="/protection">protection</Link> page.</p></details>
        <details className="q"><summary>How do I report a problem?</summary><p>Open the booking in question and use the report option, or contact support directly. Our team reviews every report — and please keep all messages on Stowbo so there&apos;s a full record if we need to step in.</p></details>

        <h2 id="account">Account</h2>
        <details className="q"><summary>How do I reset my password?</summary><p>On the <Link href="/login">sign-in page</Link>, tap &quot;Forgot password&quot; and enter your email. We&apos;ll send a secure link to set a new one. For your security the link expires after a short time, so use it soon after it arrives.</p></details>
        <details className="q"><summary>How do I delete my account?</summary><p>You can close your account anytime from your account settings, once any active bookings or payouts are complete. Deleting is permanent and removes your profile and history. If you just need a break, you can pause hosting instead of closing.</p></details>

      </div></div>

      {/* CONTACT CTA */}
      <section className="sec" style={{ paddingTop: 0 }}><div className="wrap"><div className="hostband">
        <div className="bg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <span className="ph-empty" aria-hidden="true" />
        </div>
        <div className="c"><p className="eyebrow">Still need help?</p><h2>Talk to Stowbo support</h2><p>Can&apos;t find your answer? Our team is here for renters and hosts alike — reach out and we&apos;ll sort it fast.</p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link className="btn lime lg" href="/account/support">Contact support</Link>
            <Link className="btn ghost lg" href="/trust" style={{ borderColor: "#fff", color: "#fff" }}>Trust &amp; safety →</Link>
          </div>
        </div>
      </div></div></section>

      <SiteFooter />
    </>
  );
}
