import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { DashboardShell } from "@/components/dashboard-shell";
import { getSession } from "@/lib/auth";
import { getSetup } from "@/lib/setup";
import { getNav } from "@/lib/nav-server";
import { term } from "@/setups/modules";
import { addDays, dayKey, dayLong, duration, todayKey } from "../../lib/format";
import { myTimes, myTypes } from "../../lib/provider-data";
import { Empty, Ic, Img } from "../bits";
import { SessionCard } from "./session-card";
import { ProviderLimits } from "./provider-limits";

/** /provider for a Scheduling business: the team member's day — their booked times today
 *  and tomorrow, and the booking types they're on. Anyone else sees the team door. */
export async function ProviderToday() {
  const [setup, session] = await Promise.all([getSetup(), getSession()]);
  const cfg = setup.scheduling!;
  const tz = cfg.timezone;
  const provider = term(setup, "provider");

  if (!session.signedIn || !session.host) {
    return (
      <>
        <SiteHeader />
        <main className="scm pv-door">
          <div className="wrap pv-door-in">
            <div className="pv-door-ph"><Img src={cfg.place.image} alt="" w={1100} /></div>
            <div>
              <p className="eyebrow">{setup.brand.name} team</p>
              <h1>{provider} sign in</h1>
              {!session.signedIn ? (
                <>
                  <p className="cv-quiet">Your day at a glance: every {cfg.style === "studio" ? "class you teach and how full it is" : "booked time on your calendar"}. Sign in with the email the practice has on your calendar.</p>
                  <div className="cv-acts"><Link className="btn clay" href="/login?next=/provider">Sign in</Link></div>
                </>
              ) : (
                <>
                  <p className="cv-quiet">You&rsquo;re signed in as {session.customer?.email}, which isn&rsquo;t on a {provider.toLowerCase()}&rsquo;s calendar here. If you&rsquo;ve just joined, ask the office to add you to your {cfg.style === "studio" ? "classes" : "booking types"}.</p>
                  <div className="cv-acts"><Link className="btn clay" href="/account">Go to your account</Link></div>
                </>
              )}
            </div>
          </div>
        </main>
        <SiteFooter />
      </>
    );
  }

  const email = session.customer?.email || "";
  const today = todayKey(tz);
  const [times, types] = await Promise.all([myTimes(email, today, 2), myTypes(email)]);
  const todays = (times || []).filter((s) => dayKey(s.startTime, tz) === today);
  const tomorrow = (times || []).filter((s) => dayKey(s.startTime, tz) === addDays(today, 1));
  const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: tz }).format(new Date()));
  const places = todays.reduce((n, s) => n + s.booked, 0);
  const nav = (await getNav()).provider;

  return (
    <>
      <SiteHeader />
      <DashboardShell nav={nav}>
        <div className="scm">
          <div className="pv-top">
            <div>
              <p className="eyebrow">{dayLong(new Date().toISOString(), tz)}</p>
              <h1>Good {hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening"}, {session.customer?.firstName || provider}</h1>
            </div>
            {times && <div className="pv-kpis"><span><b>{todays.length}</b>{cfg.style === "studio" ? "classes today" : "booked today"}</span>{cfg.style === "studio" && <span><b>{places}</b>places taken</span>}</div>}
          </div>
          {times === null ? (
            <Empty title="Your calendar isn’t loading right now">Please try again in a moment.</Empty>
          ) : todays.length === 0 ? (
            <Empty title="Nothing booked with you today">{tomorrow.length ? `Tomorrow: ${tomorrow.length} booked ${tomorrow.length === 1 ? "time" : "times"}, from ${new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz }).format(new Date(tomorrow[0].startTime))}.` : "Enjoy the quiet."}</Empty>
          ) : (
            <div className="pv-list">{todays.map((s) => <SessionCard key={`${s.type.id}-${s.startTime}`} s={s} tz={tz} />)}</div>
          )}
          {times && tomorrow.length > 0 && todays.length > 0 && (
            <p className="cv-quiet" style={{ marginTop: 18 }}>Tomorrow: {tomorrow.length} booked {tomorrow.length === 1 ? "time" : "times"}. <Link href="/provider/schedule" className="sc-more">See the week <Ic n="arrow" size={14} /></Link></p>
          )}
          {types.length > 0 && (
            <section className="pv-types">
              <h2>On your calendar</h2>
              <ul>
                {types.map((t) => (
                  <li key={t.id}><b>{t.title}</b><span>{[duration(t.services[0]?.duration || 0), t.kind === "class" ? `up to ${t.spots}` : "one-to-one", t.workDays.length ? t.workDays.map((d) => d.slice(0, 3)).join(", ") : ""].filter(Boolean).join(" · ")}</span></li>
                ))}
              </ul>
            </section>
          )}
          <ProviderLimits style={cfg.style} />
        </div>
      </DashboardShell>
    </>
  );
}
