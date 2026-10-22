import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export function StowboTerms() {
  return (
    <>
      <SiteHeader />

      <section className="pagehead"><div className="wrap">
        <p className="eyebrow">Legal</p>
        <h1>Terms of Service</h1>
        <p className="sub">The agreement between you and Stowbo when you browse, book, or list short-term storage and parking space through our platform.</p>
        <p className="updated">Last updated August 18, 2026</p>
      </div></section>

      <div className="wrap"><div className="legal">
        <aside className="toc">
          <h5>On this page</h5>
          <a href="#acceptance">Acceptance of terms</a>
          <a href="#definitions">Definitions</a>
          <a href="#role">Stowbo&apos;s role</a>
          <a href="#eligibility">Eligibility &amp; accounts</a>
          <a href="#payments">Bookings, payments &amp; fees</a>
          <a href="#host-obligations">Host obligations</a>
          <a href="#renter-obligations">Renter obligations</a>
          <a href="#end-of-rental">End of rental &amp; abandoned items</a>
          <a href="#prohibited">Prohibited conduct &amp; items</a>
          <a href="#cancellations">Cancellations &amp; refunds</a>
          <a href="#protection">Host protection</a>
          <a href="#disclaimers">Disclaimers</a>
          <a href="#liability">Limitation of liability</a>
          <a href="#indemnification">Indemnification</a>
          <a href="#disputes">Dispute resolution</a>
          <a href="#changes">Changes to these terms</a>
          <a href="#contact">Contact</a>
        </aside>
        <article className="prose">
          <div className="callout">
            <h4>The short version</h4>
            <p>Stowbo is a booking platform that connects independent renters and hosts. We do not own, operate, or take custody of the spaces or the items stored in them — we are not a warehouse or a bailee. By creating an account or using the service, you agree to everything set out below.</p>
          </div>

          <h2 id="acceptance">Acceptance of terms</h2>
          <p>These Terms of Service form a binding contract between you and Stowbo, Inc. Please read them carefully. If you access the website, mobile experience, or any related service, you are confirming that you have read, understood, and agreed to be bound by these terms and by our <Link href="/privacy">Privacy Policy</Link>. If you do not agree, you should not use the platform.</p>
          <p>Some features may carry additional posted guidelines or policies. Where those exist, they are folded into this agreement, and continued use after we publish an update means you accept the current version.</p>

          <h2 id="definitions">Definitions</h2>
          <ul>
            <li><b>Platform</b> — the Stowbo website, apps, and connected services.</li>
            <li><b>Host</b> — a member who lists a space for storage or parking.</li>
            <li><b>Renter</b> — a member who books a listed space.</li>
            <li><b>Listing</b> — the description, photos, price, and rules a host publishes for a space.</li>
            <li><b>Booking</b> — a confirmed reservation of a listing for a set period.</li>
            <li><b>Content</b> — anything members submit, including text, photos, and messages.</li>
          </ul>

          <h2 id="role">Stowbo&apos;s role</h2>
          <p>Stowbo is an intermediary and nothing more. We provide the technology that helps renters and hosts find each other, agree on terms, and handle payment. We are not a party to the rental arrangement itself, which is made directly between the renter and the host.</p>
          <p>We do not store, hold, move, inspect, or take possession of any item, and we are not a warehouse operator or a bailee. We never take custody of stored belongings or parked vehicles. Any duty of care over an item or a space rests with the members involved, not with Stowbo.</p>

          <h2 id="eligibility">Eligibility &amp; accounts</h2>
          <p>You must be at least 18 years old and able to form a binding contract to use the platform. When you register, you agree to give accurate information and to keep it current. You are responsible for everything that happens under your account and for keeping your login credentials private.</p>
          <p>We may verify your identity, refuse a registration, or suspend an account if we believe the terms have been broken or if activity looks fraudulent or unsafe.</p>

          <h2 id="payments">Bookings, payments, fees &amp; payouts</h2>
          <p>When a renter confirms a booking, payment is collected through our third-party payment processor. Stowbo charges a service fee shown before checkout, and hosts pay a separate host fee deducted from their earnings. Prices, taxes, and fees are displayed before you commit.</p>
          <p>Hosts receive payouts to their connected account on the schedule described at the time of listing, typically after the rental begins. We may place a hold, delay, or reverse a payout in the event of a dispute, suspected fraud, or a policy violation.</p>

          <h2 id="host-obligations">Host obligations</h2>
          <p>Hosts must have the legal right to rent the space they list and must describe it honestly, including size, access, and any restrictions. Hosts agree to keep the space reasonably safe and available for the booked period and to comply with local laws, leases, and any applicable HOA or building rules.</p>

          <h2 id="renter-obligations">Renter obligations</h2>
          <p>Renters must use a space only for its intended lawful purpose, follow the host&apos;s posted rules, and store only items they are legally entitled to store. Renters are responsible for the condition, value, and legality of whatever they place in a space, and for removing everything by the end of the booking.</p>

          <h2 id="end-of-rental">End of rental &amp; abandoned items</h2>
          <p>Renters must retrieve their belongings on or before the agreed end date. If items are left behind after a rental ends and reasonable notice has been given, they may be treated as abandoned, and the host may remove, store, or dispose of them in line with applicable local law. Stowbo is not responsible for abandoned property or for any cost of dealing with it.</p>

          <h2 id="prohibited">Prohibited conduct &amp; items</h2>
          <p>Certain behavior and certain items are never allowed on the platform, including illegal, dangerous, or hazardous goods and any attempt to defraud or harass other members. The full list is set out in our <Link href="/prohibited">Acceptable Use &amp; Prohibited Items</Link> policy, which forms part of these terms.</p>

          <h2 id="cancellations">Cancellations &amp; refunds</h2>
          <p>Each listing follows one of our published cancellation tiers, and refunds depend on the timing and cause of a cancellation. Full details are in the <Link href="/cancellation">Cancellation &amp; Refund Policy</Link>.</p>

          <h2 id="protection">Host protection</h2>
          <p>Eligible on-platform bookings may qualify for the Stowbo host guarantee, a limited program that is not insurance. The scope, limits, and claim process are described in <Link href="/protection">Stowbo Protection &amp; Host Guarantee</Link>.</p>

          <h2 id="disclaimers">Disclaimers</h2>
          <p>The platform and all listings are provided on an &quot;as is&quot; and &quot;as available&quot; basis, without warranties of any kind, whether express or implied. We do not guarantee that any listing, space, host, or renter will meet your expectations, that the service will be uninterrupted, or that any space is suitable for a particular purpose.</p>

          <h2 id="liability">Limitation of liability</h2>
          <p>To the fullest extent the law allows, Stowbo is not liable for any indirect, incidental, special, or consequential damages, or for lost, stolen, or damaged items, arising out of your use of the platform. Where liability cannot be excluded, our total liability is limited to the fees you paid to Stowbo for the booking that gave rise to the claim.</p>

          <h2 id="indemnification">Indemnification</h2>
          <p>You agree to defend and hold Stowbo harmless from claims, losses, and expenses, including reasonable legal fees, arising from your use of the platform, your content, your rental arrangement, or your breach of these terms or of any law.</p>

          <h2 id="disputes">Dispute resolution</h2>
          <p>Most disputes are resolved informally, and we ask that you contact us first. If a dispute cannot be settled, you and Stowbo agree to resolve it through final, binding individual arbitration rather than in court, and you waive any right to participate in a class or representative action. These terms are governed by the laws of the State of Delaware, without regard to conflict-of-law rules, except where local consumer-protection law provides otherwise.</p>

          <h2 id="changes">Changes to these terms</h2>
          <p>We may update these terms from time to time. When we do, we will revise the date above and, for significant changes, provide additional notice. Continuing to use the platform after an update takes effect means you accept the revised terms.</p>

          <h2 id="contact">Contact</h2>
          <p>If you have questions about these terms, reach out to our team using the details below.</p>

          <div className="contact-block">Questions? Email <a href="mailto:support@stowbo.com">support@stowbo.com</a>.</div>
        </article>
      </div></div>

      <SiteFooter />
    </>
  );
}
