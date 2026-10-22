import Link from "next/link";
import { redirect } from "next/navigation";
import { PageTitle } from "@/components/dashboard-shell";
import { requireSession } from "@/lib/guards";
import { getSetup } from "@/lib/setup";
import { finance, type WalletBundle } from "@/lib/finance";
import { community } from "@/lib/community";
import { formatMoney } from "@/lib/utils";
import { MODULES, isOn, moduleLabel, term, hasProviderSide } from "@/setups/modules";
import { rentalsOverviewData, RentalsStuffList } from "@/modules/rentals/components/account/rentals-overview";

export const metadata = { title: "Your account" };

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="tcard">
      <p className="eyebrow">{label}</p>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 700, marginTop: 6 }}>{value}</div>
      {sub && <p className="muted" style={{ fontSize: 13 }}>{sub}</p>}
    </div>
  );
}

export default async function AccountOverview() {
  const session = await requireSession();
  const setup = await getSetup();
  // A bank opens straight into its banking home (balances first).
  if (setup.homeModule === "money" && setup.modules.length === 1) redirect("/account/banking/home");
  // A ticketing setup opens on your tickets (Dice / RA / Eventbrite all do).
  if (setup.homeModule === "events") redirect("/account/events");
  const rentals = isOn(setup, "rentals");
  const [walletR, unreadR, rentalsR] = await Promise.allSettled([
    finance.wallet(),
    community.unreadCount(),
    rentals ? rentalsOverviewData() : Promise.resolve(null),
  ]);
  const wallet = walletR.status === "fulfilled" ? (walletR.value as WalletBundle | null) : null;
  const unread = unreadR.status === "fulfilled" ? Number((unreadR.value as any)?.count ?? 0) : 0;
  const r = rentalsR.status === "fulfilled" ? rentalsR.value : null;

  const c = session.customer;
  const name = c?.firstName || c?.email?.split("@")[0] || "";
  const providerHome = setup.provider?.home || "/provider";
  const provider = term(setup, "provider");
  const action = hasProviderSide(setup)
    ? session.host
      ? <Link className="btn ink sm" href={providerHome}>{provider} dashboard</Link>
      : <Link className="btn ghost sm" href={providerHome}>Become a {provider.toLowerCase()}</Link>
    : undefined;

  // Modules this setup uses that aren't built yet — shown as "coming soon" cards.
  const upcoming = setup.modules.filter((m) => !MODULES[m].built);

  return (
    <>
      <PageTitle title={`Hi${name ? `, ${name}` : ""} 👋`} action={action} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 16, marginBottom: 28 }}>
        <Stat label="Wallet" value={formatMoney((wallet?.summary?.availableBalance ?? 0) * 100, wallet?.wallet?.data?.currency || "USD")} sub={wallet ? "Available" : "No activity yet"} />
        {r ? (
          <>
            <Stat label="In custody" value={String(r.stuff.length)} sub="Stored now" />
            <Stat label={term(setup, "bookings")} value={String(r.bookings.length)} sub="All time" />
          </>
        ) : (
          <>
            <Stat label="Messages" value={String(unread)} sub={unread ? "Unread" : "All caught up"} />
          </>
        )}
      </div>

      {r && <RentalsStuffList stuff={r.stuff} titleMap={r.titleMap} />}

      {upcoming.length > 0 && (
        <>
          <h2 style={{ fontSize: 20, margin: r ? "28px 0 12px" : "0 0 12px" }}>Your {setup.brand.name}</h2>
          <div className="acct-mods">
            {upcoming.map((m) => (
              <Link key={m} className="tcard acct-mod" href={MODULES[m].accountPath}>
                <span className="acct-mod-ic" aria-hidden>
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={MODULES[m].icon} /></svg>
                </span>
                <b>{moduleLabel(setup, m)}</b>
                <span className="muted">{setup.moduleCopy?.[m]?.blurb || MODULES[m].customer[0]}</span>
                <span className="soon-chip">Coming soon</span>
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  );
}
