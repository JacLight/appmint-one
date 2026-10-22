import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getSetup } from "@/lib/setup";
import { portfolio } from "./lib/homes";
import { money, psf, unitSize } from "./lib/format";
import { HomeCard } from "./components/home-card";
import { Ic } from "./components/icons";
import "./property.css";

/** A landlord's home page: search over the real portfolio, the neighborhoods it's in,
 *  how leasing works, what living here is like (the resident portal) and, when the
 *  landlord leases it, its commercial space as a broker's availability sheet. */
export async function PropertyHome() {
  const setup = await getSetup();
  const cfg = setup.property!;
  const everything = await portfolio(cfg).catch(() => []);
  const hasBiz = !!cfg.commercial && cfg.segments.includes("commercial");
  // Homes and commercial space are told apart per unit: a mixed-use building is in both.
  const only = (seg: "residential" | "commercial") => everything.map((h) => ({ ...h, units: h.units.filter((u) => u.segment === seg) })).filter((h) => h.units.length);
  const all = only("residential");
  const open = all.map((h) => ({ ...h, units: h.units.filter((u) => u.available) })).filter((h) => h.units.length);
  const spaces = hasBiz ? only("commercial").flatMap((h) => h.units.filter((u) => u.available).map((u) => ({ home: h, unit: u }))) : [];
  const kinds = cfg.types.filter((t) => t.segment === "commercial").map((t) => {
    const mine = spaces.filter((x) => x.unit.type === t.id);
    const rates = mine.map((x) => x.unit.ratePsf).filter((r): r is number => r != null);
    return { ...t, count: mine.length, from: rates.length ? Math.min(...rates) : null };
  }).filter((k) => k.count);
  const units = open.flatMap((h) => h.units);
  const low = units.map((u) => u.rent).filter((x): x is number => x != null).sort((a, b) => a - b)[0];
  const names = [...new Set(all.map((h) => h.neighborhood).filter(Boolean))];
  const hoods = names.map((n) => {
    const hs = all.filter((h) => h.neighborhood === n);
    return { name: n, image: hs.find((h) => h.images[0])?.images[0], count: hs.reduce((c, h) => c + h.units.filter((u) => u.available).length, 0) };
  }).slice(0, 4);
  const featured = [...open].sort((a, b) => b.units.length - a.units.length).slice(0, 6);

  return (
    <>
      <SiteHeader />
      <main className="pm">
        <section className="pm-hero">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {cfg.copy.heroImage && <img className="bg" src={cfg.copy.heroImage} alt="" />}
          <div className="wrap">
            <h1>{cfg.copy.heroTitle}</h1>
            <p>{cfg.copy.heroLead}</p>
            <form className="pm-search" action="/homes">
              <label>Where<input name="q" placeholder="Neighborhood, street or ZIP" /></label>
              <label>Type
                <select name="type" defaultValue="">
                  <option value="">Any home</option>
                  {cfg.types.filter((t) => t.segment !== "commercial").map((t) => <option key={t.id} value={t.id}>{t.plural}</option>)}
                </select>
              </label>
              <label>Bedrooms
                <select name="beds" defaultValue="">
                  <option value="">Any</option><option value="0">Studio</option><option value="1">1+</option><option value="2">2+</option><option value="3">3+</option>
                </select>
              </label>
              <label>Max rent
                <select name="max" defaultValue="">
                  <option value="">Any</option>
                  {[1250, 1500, 2000, 2500, 3000, 4000].map((r) => <option key={r} value={r}>{money(r)}</option>)}
                </select>
              </label>
              <button className="btn clay" type="submit">Search</button>
            </form>
            {units.length > 0 && (
              <div className="pm-hero-facts">
                <span><b>{units.length}</b> homes available</span>
                {low != null && <span>from <b>{money(low)}</b> a month</span>}
                <span>replies within <b>2 business days</b></span>
              </div>
            )}
          </div>
        </section>

        {featured.length > 0 && (
          <section className="pm-sec">
            <div className="wrap">
              <div className="pm-sec-h">
                <div><span className="pm-kicker">Available now</span><h2>Homes you can move into</h2></div>
                <Link className="btn ghost sm" href="/homes">See all {units.length} <Ic n="arrow" size={16} /></Link>
              </div>
              <div className="pm-cards">{featured.map((h) => <HomeCard key={h.id} cfg={cfg} home={h} />)}</div>
            </div>
          </section>
        )}

        {hoods.length > 1 && (
          <section className="pm-sec tint">
            <div className="wrap">
              <div className="pm-sec-h">
                <div><span className="pm-kicker">Where we are</span><h2>{names.length} neighborhoods, one office</h2><p>We only rent what we own and look after ourselves, so every home is a short drive from the people who fix it.</p></div>
              </div>
              <div className="pm-hoods">
                {hoods.map((h) => (
                  <Link key={h.name} href={`/homes?q=${encodeURIComponent(h.name)}`} className="pm-hood">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {h.image && <img src={h.image} alt="" loading="lazy" />}
                    <div><b>{h.name}</b><span>{h.count ? `${h.count} available` : "Fully leased"}</span></div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {hasBiz && spaces.length > 0 && (
          <section className="pm-sec pm-biz">
            <div className="wrap">
              <div className="pm-biz-grid">
                <div>
                  <span className="pm-kicker">Commercial</span>
                  <h2>{cfg.commercial!.copy.homeTitle}</h2>
                  <p>{cfg.commercial!.copy.homeLead}</p>
                  <div className="pm-biz-kinds">
                    {kinds.map((k) => (
                      <Link key={k.id} href={`/commercial?type=${k.id}`}>
                        <b>{k.plural}</b>
                        <span>{k.count} {k.count === 1 ? "space" : "spaces"}{k.from != null ? ` · from ${psf(k.from)}` : ""}</span>
                      </Link>
                    ))}
                  </div>
                  <Link className="btn clay" href="/commercial">All commercial space <Ic n="arrow" size={16} /></Link>
                </div>
                <div className="pm-sheet">
                  <div className="pm-sheet-h"><b>Availability</b><span>{spaces.length} {spaces.length === 1 ? "space" : "spaces"} · rates per SF per year</span></div>
                  <ul>
                    {[...spaces].sort((a, b) => (b.unit.sqft ?? 0) - (a.unit.sqft ?? 0)).slice(0, 6).map(({ home, unit }) => (
                      <li key={unit.id}>
                        <Link href={`/homes/${unit.id}`}>
                          <span className="k">{unit.typeLabel}</span>
                          <span className="t"><b>{home.kind === "building" ? `${home.title}, ${unit.title}` : home.title}</b><small>{home.neighborhood}{unit.condition ? ` · ${unit.condition}` : ""}</small></span>
                          <span className="n">{unitSize(unit)}</span>
                          <span className="r">{psf(unit.ratePsf).replace("/SF/yr", "")}<small>{unit.leaseType || "/SF/yr"}</small></span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="pm-sec">
          <div className="wrap">
            <div className="pm-sec-h"><div><span className="pm-kicker">Leasing</span><h2>From viewing to keys, without the runaround</h2></div></div>
            <div className="pm-steps">
              {[
                ["Find it", "Real photos, the actual rent and the date it’s free. What you see is what we lease."],
                ["Apply online", "About ten minutes. Upload your ID and income from your phone; no fax, no printing."],
                ["Hear back fast", "A decision within two business days. You can watch it move in your account."],
                ["Sign and move in", "Sign the lease online, pay the deposit and first month, and pick up your keys."],
              ].map(([t, b], i) => (
                <div className="pm-step" key={t}><em>0{i + 1}</em><b>{t}</b><p>{b}</p></div>
              ))}
            </div>
          </div>
        </section>

        <section className="pm-sec tint">
          <div className="wrap pm-portal">
            <div>
              <span className="pm-kicker">Living here</span>
              <h2 style={{ fontSize: "clamp(30px,3.6vw,48px)", marginTop: 8 }}>Your home, in one account</h2>
              <ul>
                <li><Ic n="card" /><span><b>Pay rent online.</b> See what’s due and pay by card in a minute.</span></li>
                <li><Ic n="wrench" /><span><b>Request a repair, with a clock on it.</b> We respond within {cfg.sla.responseHours} hours and schedule routine work within {cfg.sla.routineDays} business days.</span></li>
                <li><Ic n="bell" /><span><b>Building notices.</b> Water shut-offs, pest control visits and pool hours, before they happen.</span></li>
                <li><Ic n="doc" /><span><b>Your documents.</b> Lease, application and receipts, kept in one place.</span></li>
              </ul>
              <div className="pm-btn-row">
                <Link className="btn clay" href="/account/home">Resident sign in</Link>
                <Link className="btn ghost" href="/account/requests/new">Request a repair</Link>
              </div>
            </div>
            <div className="pm-phone" aria-hidden="true">
              <div className="row"><small>Rent · due Nov 1</small><div className="between"><b>{money(1850)}</b><span className="btn clay xs">Pay now</span></div></div>
              <div className="row"><small>Repair #1042 · Plumbing</small><b>Kitchen sink draining slowly</b><span className="pm-muted" style={{ fontSize: 13.5 }}>Response due in 6 h · technician booked Thu</span><div className="clock"><i style={{ width: "72%" }} /></div></div>
              <div className="row"><small>Notice · pinned</small><b>Water off Tue 10 AM – noon</b><span className="pm-muted" style={{ fontSize: 13.5 }}>Riser repair on floors 3–5. Fill a jug the night before.</span></div>
            </div>
          </div>
        </section>

        <section className="pm-sec">
          <div className="wrap pm-faq">
            <div><span className="pm-kicker">Questions</span><h2 style={{ fontSize: "clamp(30px,3.6vw,44px)", marginTop: 8 }}>Before you apply</h2></div>
            <div>
              {[
                ["What do I need to qualify?", "Usually household income of about three times the rent, a rental history we can check, and no recent evictions. A guarantor or co-applicant can help if you fall short."],
                ["Is there an application fee?", "Our screening partner charges for the credit and background check and emails you the link. We don’t add anything on top."],
                ["Can I bring my pet?", "Most of our homes take cats and dogs. Each listing says so, and the building page has the pet policy."],
                ["How do repairs work?", `Send a request from your account with photos. We respond within ${cfg.sla.responseHours} hours and schedule routine work within ${cfg.sla.routineDays} business days. Emergencies go to ${cfg.sla.emergencyPhone}, any time.`],
                ["How do I pay rent?", "By card from your account. Each month’s rent shows up there with its due date, and every payment gets a receipt."],
              ].map(([q, a]) => (
                <details key={q}><summary>{q}</summary><p>{a}</p></details>
              ))}
            </div>
          </div>
        </section>

        <section className="pm-sec" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <div className="pm-band">
              <div><h2>Know what you’re looking for?</h2><p>Every available home, with the real rent and the date it’s free.</p></div>
              <Link className="btn clay lg" href="/homes">Browse homes <Ic n="arrow" size={18} /></Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
