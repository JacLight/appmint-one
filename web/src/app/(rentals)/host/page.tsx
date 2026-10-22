import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { DashboardShell } from "@/components/dashboard-shell";
import { EmptyState } from "@/components/empty-state";
import { ApplyHostButton } from "@/modules/rentals/components/host/apply-button";
import { HostMarketing } from "@/modules/rentals/components/host/host-marketing";
import { ControlCenter } from "@/modules/rentals/components/host/control-center";
import { getSession } from "@/lib/auth";
import { routes } from "@/lib/nav";
import { getNav } from "@/lib/nav-server";
import { stowbo, type Earnings, type HostMe } from "@/api/rentals";
import { getMarket } from "@/modules/rentals/market/config";
import { MarketHostHome } from "@/modules/rentals/market/market-host";

export async function generateMetadata() {
  const m = await getMarket();
  return { title: m ? m.cfg.copy.hostPitch : "Host on Stowbo" };
}

export default async function HostPage() {
  // Stays / gear hosts get their own home; Stowbo continues below, unchanged.
  const market = await getMarket();
  if (market) return <MarketHostHome m={market} />;
  const session = await getSession();

  // ── APPROVED host → control center ──
  if (session.signedIn && session.host) {
    const [todayR, earnR, listR] = await Promise.allSettled([stowbo.host.today(), stowbo.host.earnings(), stowbo.host.listings()]);
    const today = (todayR.status === "fulfilled" ? todayR.value : null) ?? { arrivals: [], inCustody: [], departures: [], overdue: [], capacity: [] };
    const earn = (earnR.status === "fulfilled" ? earnR.value : null) as Earnings | null;
    const listingEnv = listR.status === "fulfilled" ? listR.value?.data ?? [] : [];
    const listings = listingEnv.map((l) => ({ sk: l.sk, name: (l.data as any)?.name, title: l.data?.title ?? "Untitled", spaceType: l.data?.spaceType, capacity: l.data?.capacity }));

    return (
      <>
        <SiteHeader />
        <DashboardShell nav={(await getNav()).provider} title="Control center" action={<Link className="btn clay sm" href={routes.hostListingNew}>+ New listing</Link>}>
          {listings.length === 0 ? (
            <EmptyState title="No listings yet" note="Create your first listing to start earning. It stays a draft until you publish it." ctaLabel="Create a listing →" ctaHref={routes.hostListingNew} />
          ) : (
            <ControlCenter today={today} listings={listings} earnings={earn} />
          )}
        </DashboardShell>
      </>
    );
  }

  // ── SIGNED IN but application pending → focused pending view ──
  if (session.signedIn) {
    const me = (await stowbo.host.me().catch(() => null)) as HostMe | null;
    if (me?.applied && !me?.approved) {
      return (
        <>
          <SiteHeader />
          <section className="sec" style={{ paddingTop: 60 }}>
            <div className="wrap" style={{ maxWidth: 500 }}>
              <div className="tcard">
                <p className="eyebrow" style={{ color: "var(--highlight)" }}>Application received</p>
                <h1 style={{ fontSize: 26, marginTop: 8 }}>Pending review</h1>
                <p className="muted" style={{ fontSize: 15, marginTop: 10, lineHeight: 1.6 }}>
                  Thanks for applying to host on Stowbo. Your application is under review — this usually takes 1–3 business days, and you&apos;ll get an email the moment it&apos;s approved.
                </p>
                <Link className="btn ghost sm" href={routes.account} style={{ marginTop: 16 }}>Back to your account</Link>
              </div>
            </div>
          </section>
          <SiteFooter />
        </>
      );
    }
  }

  // ── prospective host → full marketing page ──
  const cta = session.signedIn ? (
    <ApplyHostButton />
  ) : (
    <Link className="btn lime lg" href={routes.login}>Sign in to start hosting</Link>
  );

  return (
    <>
      <SiteHeader />
      <HostMarketing cta={cta} />
      <SiteFooter />
    </>
  );
}
