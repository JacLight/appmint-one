import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata = { title: "Acceptable Use & Prohibited Items" };

export default function ProhibitedPage() {
  return (
    <>
      <SiteHeader />

      <section className="pagehead"><div className="wrap">
        <p className="eyebrow">Legal</p>
        <h1>Acceptable Use &amp; Prohibited Items</h1>
        <p className="sub">The behavior we expect on the platform and the things that may never be stored or parked through Stowbo.</p>
        <p className="updated">Last updated August 18, 2026</p>
      </div></section>

      <div className="wrap"><div className="legal">
        <aside className="toc">
          <h5>On this page</h5>
          <a href="#principles">Acceptable use principles</a>
          <a href="#conduct">Prohibited platform conduct</a>
          <a href="#items">Items you may not store</a>
          <a href="#parking">Parking rules</a>
          <a href="#space">Host space rules</a>
          <a href="#consequences">Consequences</a>
          <a href="#report">How to report a violation</a>
        </aside>
        <article className="prose">
          <div className="callout">
            <h4>The short version</h4>
            <p>These rules protect hosts, neighbors, and property. Renters are responsible for the legality of whatever they store or park, and anything dangerous, illegal, or perishable is off-limits.</p>
          </div>

          <h2 id="principles">Acceptable use principles</h2>
          <p>Stowbo works because members treat each other, and each other&apos;s property, with respect. Use the platform honestly, follow the law, keep your agreements, and store only items you are legally allowed to store. When in doubt about whether something is permitted, ask before you book.</p>

          <h2 id="conduct">Prohibited platform conduct</h2>
          <p>The following behavior is not allowed and may lead to account action:</p>
          <ul>
            <li>Fraud, misrepresentation, or impersonating another person.</li>
            <li>Arranging or accepting payment off-platform to avoid fees or protections.</li>
            <li>Harassment, threats, discrimination, or abusive messages.</li>
            <li>Creating fake, duplicate, or misleading listings.</li>
            <li>Scraping, reverse-engineering, or interfering with the platform or other members&apos; data.</li>
          </ul>

          <h2 id="items">Items you may not store</h2>
          <p>You may never store the following through Stowbo:</p>
          <ul>
            <li>Illegal drugs or other contraband.</li>
            <li>Weapons, firearms, and ammunition.</li>
            <li>Explosives and fireworks.</li>
            <li>Flammable or combustible liquids and gases.</li>
            <li>Hazardous, toxic, or radioactive materials.</li>
            <li>Perishable food or anything that rots, spoils, or attracts pests.</li>
            <li>Live animals or plants.</li>
            <li>Biological, medical, or human waste.</li>
            <li>Stolen goods or property you have no right to.</li>
            <li>Large amounts of cash or irreplaceable valuables.</li>
          </ul>

          <h2 id="parking">Parking rules</h2>
          <p>Vehicles parked through Stowbo must have valid registration and current insurance. Vehicles must not be leaking fluids or otherwise inoperable, and no one may live in a parked vehicle. Renters are responsible for following all local parking and vehicle laws.</p>

          <h2 id="space">Host space rules</h2>
          <p>Hosts must have the legal right to rent the space they list, including compliance with any lease, mortgage, HOA, or local zoning rules. A host may not list a space they do not control or that they are not permitted to sublet or share.</p>

          <h2 id="consequences">Consequences</h2>
          <p>Breaking these rules can lead to removal of a listing, cancellation of a booking, withheld payouts, suspension, or a permanent ban. Serious violations, including anything illegal or dangerous, may be reported to the relevant authorities.</p>

          <h2 id="report">How to report a violation</h2>
          <p>If you see a listing, message, or item that breaks these rules, tell us right away using the contact details below or the in-app report tools. We review reports promptly and take action where appropriate.</p>

          <div className="contact-block">Questions? Email <a href="mailto:support@stowbo.com">support@stowbo.com</a>.</div>
        </article>
      </div></div>

      <SiteFooter />
    </>
  );
}
