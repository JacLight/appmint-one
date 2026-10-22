import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getSetup } from "@/lib/setup";
import { getSession } from "@/lib/auth";
import { plans } from "@/modules/scheduling/lib/data";
import { money } from "@/modules/scheduling/lib/format";
import { Ic } from "@/modules/scheduling/components/bits";
import { BuyPlan } from "@/modules/scheduling/components/studio/buy-plan";

type P = Promise<{ plan: string }>;
type SP = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: P }): Promise<Metadata> {
  const { plan } = await params;
  const p = (await plans()).find((x) => x.name === plan) || null;
  return { title: p?.title || "Checkout" };
}

/** Checkout for one pack or membership: what it covers, then the card. */
export default async function PlanCheckout({ params, searchParams }: { params: P; searchParams: SP }) {
  const [{ plan: name }, sp, setup, session] = await Promise.all([params, searchParams, getSetup(), getSession()]);
  const cfg = setup.scheduling!;
  if (cfg.style !== "studio") notFound();
  const plan = (await plans()).find((p) => p.name === name);
  if (!plan) notFound();
  const next = typeof sp.next === "string" && sp.next.startsWith("/") && !sp.next.startsWith("//") ? sp.next : undefined;
  const here = `/memberships/${plan.name}${next ? `?next=${encodeURIComponent(next)}` : ""}`;
  const price = plan.displayPrice || money(plan.price, plan.currency);
  const covers = plan.credits === "unlimited" ? "Unlimited group classes" : typeof plan.credits === "number" ? `${plan.credits} ${plan.scope === "private" ? "private sessions" : "group classes"}${plan.kind === "membership" ? " every month" : ""}` : "";
  const term = plan.kind === "membership" ? `Renews every ${plan.duration === 1 ? plan.durationUnit : `${plan.duration} ${plan.durationUnit}s`} until you cancel` : `Valid ${plan.duration} ${plan.durationUnit}${plan.duration === 1 ? "" : "s"} from today · doesn’t renew`;

  return (
    <>
      <SiteHeader />
      <main className="scm sc-studio">
        <section className="wrap bt-top"><Link href={next ? `/memberships?next=${encodeURIComponent(next)}` : "/memberships"} className="bt-back"><Ic n="back" size={16} /> Packs &amp; memberships</Link></section>
        <section className="wrap sco-grid">
          <div className="sco-plan">
            <p className="eyebrow">{plan.kind === "membership" ? "Membership" : plan.scope === "private" ? "Private sessions" : "Class pack"}</p>
            <h1>{plan.title}</h1>
            <p className="sco-price"><b>{price}</b>{plan.kind === "membership" ? <i> / {plan.duration === 1 ? plan.durationUnit : `${plan.duration} ${plan.durationUnit}s`}</i> : null}</p>
            <ul className="sco-list">
              {covers && <li><Ic n="check" size={17} /> {covers}</li>}
              <li><Ic n="check" size={17} /> {term}</li>
              {plan.perks.map((x) => <li key={x}><Ic n="check" size={17} /> {x}</li>)}
            </ul>
            {plan.description && <p className="bt-desc">{plan.description}</p>}
            {cfg.policy && <p className="bk-fine">{cfg.policy}</p>}
          </div>
          <div className="bt-card sco-pay">
            <h2>Pay by card</h2>
            {session.signedIn ? (
              <>
                <p className="bk-fine" style={{ marginBottom: 14 }}>Signed in as {session.customer?.email}. It&rsquo;s on your account the moment the payment goes through.</p>
                <BuyPlan plan={plan.name} label={`Pay ${price}`} next={next} />
              </>
            ) : (
              <div className="bk-cta">
                <p className="bk-cta-note">Sign in so your {plan.kind === "membership" ? "membership" : "pack"} is on your account.</p>
                <Link className="btn clay lg bk-wide" href={`/login?next=${encodeURIComponent(here)}`}>Sign in to buy</Link>
                <Link className="btn ghost bk-wide" href={`/signup?next=${encodeURIComponent(here)}`}>Create an account</Link>
              </div>
            )}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
