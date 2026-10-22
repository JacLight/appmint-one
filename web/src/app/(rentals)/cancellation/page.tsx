import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata = { title: "Cancellation & Refund Policy" };

export default function CancellationPage() {
  return (
    <>
      <SiteHeader />

      <section className="pagehead"><div className="wrap">
        <p className="eyebrow">Legal</p>
        <h1>Cancellation &amp; Refund Policy</h1>
        <p className="sub">How cancellations work for renters and hosts, the refund tiers hosts can choose, and how money is returned.</p>
        <p className="updated">Last updated August 18, 2026</p>
      </div></section>

      <div className="wrap"><div className="legal">
        <aside className="toc">
          <h5>On this page</h5>
          <a href="#tiers">Policy tiers</a>
          <a href="#renter">Renter-initiated cancellations</a>
          <a href="#host">Host-initiated cancellations</a>
          <a href="#early">Early move-out / mid-term</a>
          <a href="#noshow">No-shows &amp; overstay fees</a>
          <a href="#refunds">How refunds are issued</a>
          <a href="#extenuating">Extenuating circumstances</a>
          <a href="#how">How to cancel</a>
        </aside>
        <article className="prose">
          <div className="callout">
            <h4>The short version</h4>
            <p>Flexible = full refund up to 24 hours before start; Standard = 50% if you cancel within a few days of start; Strict = the first period is non-refundable. The Stowbo service fee is non-refundable except for host cancellations or verified extenuating circumstances.</p>
          </div>

          <h2 id="tiers">Policy tiers</h2>
          <p>Every listing follows one of three cancellation tiers, chosen by the host. The tier is shown on the listing before you book, so you always know the rules in advance.</p>
          <table>
            <thead>
              <tr><th>Tier</th><th>Refund summary</th><th>Best for</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>Flexible</td>
                <td>Full refund of the rental if cancelled at least 24 hours before the start.</td>
                <td>Short, spontaneous bookings</td>
              </tr>
              <tr>
                <td>Standard</td>
                <td>Full refund up to a few days before start; 50% of the rental after that.</td>
                <td>Most listings</td>
              </tr>
              <tr>
                <td>Strict</td>
                <td>First rental period is non-refundable; later periods may be partly refundable.</td>
                <td>Longer or in-demand spaces</td>
              </tr>
            </tbody>
          </table>

          <h2 id="renter">Renter-initiated cancellations</h2>
          <p>If you cancel, the refund depends on the listing&apos;s tier and how far ahead you cancel. The earlier you cancel, the more you get back. In every tier, the Stowbo service fee is non-refundable, and refunds apply to the rental amount only.</p>

          <h2 id="host">Host-initiated cancellations</h2>
          <p>If a host cancels a confirmed booking, the renter receives a full refund, including the service fee. Host-initiated cancellations may also carry a penalty for the host, such as a fee or reduced visibility, because they disrupt the renter&apos;s plans.</p>

          <h2 id="early">Early move-out / mid-term</h2>
          <p>If a renter ends a rental early, the current period is generally not refunded, and future unused periods may be refunded according to the listing&apos;s tier. Month-to-month rentals typically require notice before the next billing period to avoid another charge.</p>

          <h2 id="noshow">No-shows &amp; overstay fees</h2>
          <p>A booking that is never used is treated under the listing&apos;s cancellation tier and is not automatically refunded. If a renter keeps items or a vehicle in a space past the booked end date, overstay fees may apply, charged at the listing&apos;s rate or higher until the space is cleared.</p>

          <h2 id="refunds">How refunds are issued</h2>
          <p>Approved refunds are returned to the original payment method through our payment processor. Depending on your bank, refunds usually appear within 5 to 10 business days after they are issued.</p>

          <h2 id="extenuating">Extenuating circumstances</h2>
          <p>In rare, serious situations outside a member&apos;s control — such as a natural disaster or another qualifying emergency — we may override the standard tiers and offer a fuller refund. These cases require documentation and are reviewed individually.</p>

          <h2 id="how">How to cancel</h2>
          <p>You can cancel a booking from your dashboard under your reservations. The refund estimate is shown before you confirm, so you can see the outcome first. If you need help, contact us using the details below.</p>

          <div className="contact-block">Questions? Email <a href="mailto:support@stowbo.com">support@stowbo.com</a>.</div>
        </article>
      </div></div>

      <SiteFooter />
    </>
  );
}
