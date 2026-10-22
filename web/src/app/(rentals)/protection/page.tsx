import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata = { title: "Stowbo Protection & Host Guarantee" };

export default function ProtectionPage() {
  return (
    <>
      <SiteHeader />

      <section className="pagehead"><div className="wrap">
        <p className="eyebrow">Legal</p>
        <h1>Stowbo Protection &amp; Host Guarantee</h1>
        <p className="sub">A limited guarantee that helps cover physical damage to a host&apos;s space from a booked renter — and what it does and does not include.</p>
        <p className="updated">Last updated August 18, 2026</p>
      </div></section>

      <div className="wrap"><div className="legal">
        <aside className="toc">
          <h5>On this page</h5>
          <a href="#overview">Overview &amp; coverage limit</a>
          <a href="#not-insurance">Not insurance</a>
          <a href="#covered">What&apos;s covered</a>
          <a href="#not-covered">What&apos;s not covered</a>
          <a href="#eligibility">Eligibility conditions</a>
          <a href="#claim">How to file a claim</a>
          <a href="#timeline">Review &amp; payout timeline</a>
          <a href="#renter">Renter responsibility</a>
        </aside>
        <article className="prose">
          <div className="callout">
            <h4>The short version</h4>
            <p>The guarantee applies only to bookings kept on-platform and paid through Stowbo. It covers physical damage to a host&apos;s property — never cash or irreplaceable valuables — and it does not replace the renter&apos;s own belongings unless a Protection Plan was purchased.</p>
          </div>

          <h2 id="overview">Overview &amp; coverage limit</h2>
          <p>Stowbo Protection is a program that helps hosts recover from certain physical damage caused by a booked renter, up to a limit of $5,000 per booking. It exists to give hosts extra peace of mind when they open their space to the community.</p>

          <h2 id="not-insurance">This is a limited guarantee, not insurance</h2>
          <p>Stowbo Protection is not an insurance policy, and it is not a substitute for a host&apos;s own insurance. It does not create an insurance relationship, and hosts should keep their own homeowner, renter, or commercial coverage in place. The guarantee is a discretionary program offered by Stowbo under the conditions described here.</p>

          <h2 id="covered">What&apos;s covered</h2>
          <p>Subject to the limit and conditions, the guarantee may help with:</p>
          <ul>
            <li>Physical damage to the host&apos;s space directly caused by a renter during a valid, paid booking.</li>
            <li>Damage to a renter&apos;s stored items, only where the renter purchased the optional Protection Plan at checkout and the loss is covered under that plan&apos;s terms.</li>
          </ul>

          <h2 id="not-covered">What&apos;s not covered</h2>
          <ul>
            <li>Normal wear and tear.</li>
            <li>Cash, securities, or irreplaceable valuables.</li>
            <li>Personal injury or third-party liability claims.</li>
            <li>Damage arising from prohibited items or prohibited conduct.</li>
            <li>Any booking or payment made off-platform.</li>
          </ul>

          <h2 id="eligibility">Eligibility conditions</h2>
          <p>To be eligible, the booking must have been made and paid for on Stowbo, and both parties must have followed these terms, the <Link href="/prohibited">Acceptable Use &amp; Prohibited Items</Link> policy, and the host&apos;s listed rules. Off-platform arrangements are never eligible.</p>

          <h2 id="claim">How to file a claim</h2>
          <p>Report the damage to Stowbo within the claim window stated at the time of your booking. You will need to provide photo documentation, a description of what happened, and any supporting records, and to cooperate reasonably with our review, including reasonable requests for additional information.</p>

          <h2 id="timeline">Claim review &amp; payout timeline</h2>
          <p>We review each claim on a case-by-case basis. Once we have the information we need, we aim to reach a decision and, where a claim is approved, issue payment to the host&apos;s connected account within a reasonable period. Timelines can vary with the complexity of a claim.</p>

          <h2 id="renter">Renter responsibility</h2>
          <p>The guarantee does not relieve a renter of responsibility. Renters remain liable for damage they cause, and Stowbo may seek reimbursement from a renter for amounts paid under the guarantee.</p>

          <div className="contact-block">Questions? Email <a href="mailto:support@stowbo.com">support@stowbo.com</a>.</div>
        </article>
      </div></div>

      <SiteFooter />
    </>
  );
}
