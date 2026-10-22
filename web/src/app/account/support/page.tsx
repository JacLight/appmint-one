import Link from "next/link";
import { PageTitle } from "@/components/dashboard-shell";
import { requireSession } from "@/lib/guards";
import { getSetup } from "@/lib/setup";
import { routes } from "@/lib/nav";
import { isOn, term } from "@/setups/modules";
import { AppmintChatServer } from "@/components/appmint-chat-server";

export const metadata = { title: "Support" };

/** The customer's support desk: chat with the business right here (the AppMint chat,
 *  signed in as them so there's no form to fill), plus the self-serve routes. */
export default async function SupportPage() {
  const session = await requireSession();
  const setup = await getSetup();
  const c = session.customer;
  const name = [c?.firstName, c?.lastName].filter(Boolean).join(" ") || undefined;
  const chatUser = c?.email ? { email: c.email, ...(name ? { name } : {}), ...(c.phone ? { phone: c.phone } : {}) } : undefined;
  const rentals = isOn(setup, "rentals");
  const stowboPages = setup.legal.variant === "stowbo";

  return (
    <>
      <PageTitle title="Support" />
      <div className="sup-grid">
        {/* The chat sits OUTSIDE any .tcard on purpose: site typography rules such as
            `.tcard p` would otherwise recolour the widget's own text. */}
        <div className="sup-chat">
          <div className="tcard sup-chat-hd">
            <h3>Chat with {setup.brand.name} support</h3>
            <p className="muted">We answer here. You’re signed in as {c?.email || "your account"}, so just type.</p>
          </div>
          <div className="sup-chat-body">
            <AppmintChatServer inline chatUser={chatUser} containerId="appmint-support-chat" fallback />
          </div>
        </div>
        <aside className="sup-side">
          {rentals && (
            <div className="tcard sup-card">
              <h3>About a {term(setup, "booking").toLowerCase()}?</h3>
              <p className="muted">Your {term(setup, "provider").toLowerCase()} is the fastest route for drop-off, access and pick-up questions — message them from the {term(setup, "booking").toLowerCase()}.</p>
              <Link className="btn ghost sm" href={routes.bookings}>My {term(setup, "bookings").toLowerCase()} →</Link>
            </div>
          )}
          <div className="tcard sup-card">
            <h3>Help centre</h3>
            <p className="muted">{stowboPages ? "How Stowbo works, protection up to $5,000, cancellations and refunds." : `How ${setup.brand.name} works, payments, cancellations and your data.`}</p>
            <div className="sup-links">
              <Link href={routes.help}>Help &amp; FAQs</Link>
              {stowboPages && <Link href={routes.protection}>Stowbo protection</Link>}
              {stowboPages && <Link href={routes.cancellation}>Cancellation policy</Link>}
              {stowboPages && <Link href={routes.trust}>Trust &amp; safety</Link>}
              {!stowboPages && <Link href={routes.terms}>Terms</Link>}
              {!stowboPages && <Link href={routes.privacy}>Privacy</Link>}
            </div>
          </div>
          <div className="tcard sup-card">
            <h3>Your account</h3>
            <p className="muted">Name, phone and sign-in details.</p>
            <Link className="btn ghost sm" href={routes.settings}>Settings →</Link>
          </div>
        </aside>
      </div>
    </>
  );
}
