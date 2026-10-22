import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export function StowboPrivacy() {
  return (
    <>
      <SiteHeader />

      <section className="pagehead"><div className="wrap">
        <p className="eyebrow">Legal</p>
        <h1>Privacy Policy</h1>
        <p className="sub">What personal information Stowbo collects, why we collect it, who we share it with, and the choices you have.</p>
        <p className="updated">Last updated August 18, 2026</p>
      </div></section>

      <div className="wrap"><div className="legal">
        <aside className="toc">
          <h5>On this page</h5>
          <a href="#collect">Information we collect</a>
          <a href="#use">How we use it</a>
          <a href="#share">How we share it</a>
          <a href="#cookies">Cookies</a>
          <a href="#retention">Data retention</a>
          <a href="#rights">Your rights &amp; choices</a>
          <a href="#security">Security</a>
          <a href="#children">Children</a>
          <a href="#international">International transfers</a>
          <a href="#changes">Changes &amp; contact</a>
        </aside>
        <article className="prose">
          <div className="callout">
            <h4>The short version</h4>
            <p>Renter and host details, along with the exact address of a space, are shared with each other only after a booking is confirmed. Payments are handled by our processor, Stripe — we never store full card numbers. California residents can use the &quot;Do Not Sell or Share My Personal Information&quot; choice below.</p>
          </div>

          <h2 id="collect">Information we collect</h2>
          <p>We collect information you give us and information generated as you use the platform, including:</p>
          <ul>
            <li><b>Account information</b> — name, email, phone number, and password.</li>
            <li><b>Identity verification</b> — documents and details used to confirm who you are, processed through our verification vendor.</li>
            <li><b>Payment information</b> — handled by our payment processor; we receive limited confirmation data, not full card numbers.</li>
            <li><b>Listing and photos</b> — descriptions, images, availability, and pricing that hosts publish.</li>
            <li><b>Space address</b> — the precise location of a listed space.</li>
            <li><b>Device and usage data</b> — IP address, browser type, pages viewed, and interactions.</li>
            <li><b>Messages</b> — communications sent between members through the platform.</li>
          </ul>

          <h2 id="use">How we use it</h2>
          <p>We use the information to operate the marketplace: to create and secure your account, match renters with suitable spaces, process bookings and payments, verify identity, prevent fraud, provide support, and improve the service. We also use it to send you service-related messages and, where permitted, relevant updates you can opt out of.</p>

          <h2 id="share">How we share it</h2>
          <p>We share personal information only as needed to run the platform:</p>
          <ul>
            <li><b>Matched members</b> — once a booking is confirmed, the renter and host receive each other&apos;s contact details and the space address.</li>
            <li><b>Service providers</b> — vendors that host our systems, send communications, and provide analytics under contract.</li>
            <li><b>Identity and payment vendors</b> — to verify members and process transactions.</li>
            <li><b>Legal reasons</b> — when required by law, subpoena, or to protect rights and safety.</li>
            <li><b>Business transfers</b> — in connection with a merger, acquisition, or sale of assets.</li>
          </ul>
          <p>We do not sell your personal information for money.</p>

          <h2 id="cookies">Cookies</h2>
          <p>We and our partners use cookies and similar technologies to keep you signed in, remember preferences, and understand how the platform is used. You can learn more and manage your choices in our <Link href="/cookies">Cookie Policy</Link>.</p>

          <h2 id="retention">Data retention</h2>
          <p>We keep personal information for as long as your account is active and for a reasonable period afterward to meet legal, accounting, tax, and dispute-resolution obligations. When information is no longer needed, we delete it or anonymize it.</p>

          <h2 id="rights">Your rights &amp; choices</h2>
          <p>Depending on where you live, you may have the right to access, correct, delete, or port your personal information, and to object to or restrict certain processing. Residents of the EU and UK have these rights under the GDPR, and California residents have rights under the CCPA, including the right to know, delete, and opt out.</p>
          <p><b>Do Not Sell or Share My Personal Information</b> — California residents may exercise this choice at any time by contacting us using the details below or through the in-account privacy controls. We honor recognized opt-out preference signals where required.</p>

          <h2 id="security">Security</h2>
          <p>We use administrative, technical, and physical safeguards designed to protect personal information, including encryption in transit and restricted internal access. No system is perfectly secure, so we cannot guarantee absolute security, but we work to keep your data protected and to notify you if a significant incident occurs.</p>

          <h2 id="children">Children</h2>
          <p>The platform is intended for adults. It is not directed to anyone under 18, and we do not knowingly collect personal information from children. If we learn that a minor has provided information, we will delete it.</p>

          <h2 id="international">International transfers</h2>
          <p>We operate primarily in the United States, and your information may be processed there or in other countries where our providers operate. Where required, we rely on appropriate safeguards to protect information transferred across borders.</p>

          <h2 id="changes">Changes &amp; contact</h2>
          <p>We may update this policy as our practices evolve. We will revise the date above and, for significant changes, provide additional notice. To exercise your rights or ask a question, contact us below.</p>

          <div className="contact-block">Questions? Email <a href="mailto:support@stowbo.com">support@stowbo.com</a>.</div>
        </article>
      </div></div>

      <SiteFooter />
    </>
  );
}
