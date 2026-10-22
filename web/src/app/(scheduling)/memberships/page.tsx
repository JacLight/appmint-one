import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getSetup } from "@/lib/setup";
import { getSession } from "@/lib/auth";
import { myMemberships, plans } from "@/modules/scheduling/lib/data";
import { PlanLadder } from "@/modules/scheduling/components/studio/plan-ladder";
import { Empty, Ic } from "@/modules/scheduling/components/bits";

export const metadata: Metadata = { title: "Pricing" };
type SP = Promise<Record<string, string | string[] | undefined>>;

/** The studio's packs and memberships, as the engine prices them. */
export default async function MembershipsPage({ searchParams }: { searchParams: SP }) {
  const [setup, session, sp] = await Promise.all([getSetup(), getSession(), searchParams]);
  const cfg = setup.scheduling!;
  if (cfg.style !== "studio") notFound();
  const [ladder, mine] = await Promise.all([plans(), session.signedIn ? myMemberships() : Promise.resolve([])]);
  const next = typeof sp.next === "string" && sp.next.startsWith("/") && !sp.next.startsWith("//") ? sp.next : undefined;
  const active = mine.filter((m) => m.active);
  return (
    <>
      <SiteHeader />
      <main className="scm sc-studio">
        <section className="bk-band">
          <div className="wrap bk-band-in">
            <div>
              <p className="eyebrow">{setup.brand.name}</p>
              <h1>Packs &amp; memberships</h1>
              <p className="bk-sub">Packs never renew; memberships renew until you cancel.</p>
            </div>
            {active.length > 0 && (
              <div className="bk-credit"><span>You have</span><b className="bk-credit-t">{active.map((m) => m.title).join(", ")}</b></div>
            )}
          </div>
        </section>
        <section className="wrap bk-body">
          {next && <p className="bk-only"><Ic n="cal" size={15} /> Buy a pack or membership and we&rsquo;ll take you straight back to your class. <Link href={next}>Back to the class</Link></p>}
          {ladder.length ? (
            <PlanLadder plans={ladder} next={next} />
          ) : (
            <Empty title="Pricing is being finalised" action={cfg.place.phone ? <a className="btn clay sm" href={`tel:${cfg.place.phone.replace(/[^0-9+]/g, "")}`}><Ic n="phone" size={16} /> {cfg.place.phone}</a> : undefined}>
              Packs and memberships go on sale here shortly. The front desk can tell you about intro offers in the meantime.
            </Empty>
          )}
          {cfg.policy && <p className="st-policy">{cfg.policy}</p>}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
