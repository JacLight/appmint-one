import Link from "next/link";
import type { PropertyConfig } from "@/setups/property-config";
import type { Home, Unit } from "../lib/types";
import { availability, bedRange, baths, beds, day, fullAddress, isNow, money, petsLabel, psf, psfRange, rentRange, sfRange, sqft, terms, unitSize, yearsTerms } from "../lib/format";
import { Ic } from "./icons";
import { HomeMap } from "./home-map";
import { UnitTable } from "./unit-table";
import { SuiteTable } from "./suite-table";

const AMEN_ICON: Record<string, string> = { pool: "sun", gym: "bolt", parking: "car", garage: "car", "ev-charging": "bolt", "pets-allowed": "paw", "controlled-access": "key", "in-unit-laundry": "drop", "shared-laundry": "drop", "loading-dock": "box", "grade-door": "box", signage: "building", storefront: "building", "24-7-access": "key", fiber: "bolt" };

function Gallery({ images, title }: { images: string[]; title: string }) {
  const list = images.slice(0, 5);
  if (!list.length) return null;
  return (
    <div className={`pm-gallery n${Math.min(list.length, 5)}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {list.map((src, i) => <img key={src + i} src={src} alt={i === 0 ? title : ""} loading={i ? "lazy" : "eager"} />)}
    </div>
  );
}

function Amenities({ cfg, ids }: { cfg: PropertyConfig; ids: string[] }) {
  const list = [...new Set(ids)].filter((a) => cfg.amenities[a]);
  if (!list.length) return null;
  return (
    <ul className="pm-amen">
      {list.map((a) => <li key={a}><Ic n={AMEN_ICON[a] || "check"} /> {cfg.amenities[a]}</li>)}
    </ul>
  );
}

function Office({ cfg }: { cfg: PropertyConfig }) {
  return (
    <div className="pm-box">
      <h3>{cfg.office.name}</h3>
      <div className="pm-office">
        <a href={`tel:${cfg.office.phone.replace(/[^\d+]/g, "")}`}>{cfg.office.phone}</a>
        <span className="pm-muted">{cfg.office.hours}</span>
        <span className="pm-muted">{cfg.office.address}</span>
      </div>
    </div>
  );
}

/** A building: gallery, its homes and/or commercial suites, about, amenities, policies, map. */
export function BuildingPage({ cfg, home, mapsKey }: { cfg: PropertyConfig; home: Home; mapsKey: string | null }) {
  const homes = home.units.filter((u) => u.segment === "residential");
  const suites = home.units.filter((u) => u.segment === "commercial");
  const openHomes = homes.filter((u) => u.available);
  const openSuites = suites.filter((u) => u.available);
  const biz = homes.length === 0 && suites.length > 0;
  const open = biz ? openSuites : openHomes;
  return (
    <div className="pm wrap">
      <nav className="pm-crumbs" aria-label="Breadcrumb"><Link href={biz ? "/commercial" : "/homes"}>{biz ? "Commercial" : "Homes"}</Link><span>/</span><Link href={`${biz ? "/commercial" : "/homes"}?q=${encodeURIComponent(home.neighborhood)}`}>{home.neighborhood}</Link><span>/</span><span>{home.title}</span></nav>
      <Gallery images={home.images} title={home.title} />
      <div className="pm-detail">
        <div>
          <span className="pm-kicker">{home.type}</span>
          <h1>{home.title}</h1>
          <div className="pm-addr">{fullAddress(home.address)}</div>
          <div className="pm-facts">
            {biz ? (
              <>
                <div><small>Rate</small><b>{open.length ? `${psfRange(open)}/SF/yr` : "—"}</b></div>
                <div><small>Space</small><b>{open.length ? sfRange(open) : sfRange(suites)}</b></div>
              </>
            ) : (
              <>
                <div><small>Rent</small><b>{open.length ? rentRange(open) : "—"}</b></div>
                <div><small>Layouts</small><b>{open.length ? bedRange(open) : bedRange(homes)}</b></div>
              </>
            )}
            <div><small>Available</small><b>{open.length} of {biz ? suites.length : home.totalUnits}</b></div>
            {!biz && suites.length > 0 && <div><small>Commercial</small><b>{openSuites.length} {openSuites.length === 1 ? "space" : "spaces"}</b></div>}
            {home.yearBuilt && <div><small>Built</small><b>{home.yearBuilt}</b></div>}
          </div>

          {homes.length > 0 && (
            <section className="pm-block" id="units">
              <h2>Available homes</h2>
              <UnitTable units={homes} />
            </section>
          )}

          {suites.length > 0 && (
            <section className="pm-block" id="suites">
              <h2>{biz ? "Available space" : "Commercial space"}</h2>
              {!biz && <p className="pm-muted">Ground-floor space in {home.title} for shops, restaurants and offices.</p>}
              <SuiteTable units={suites} />
            </section>
          )}

          {home.description && (
            <section className="pm-block">
              <h2>About {home.title}</h2>
              {home.description.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}
            </section>
          )}

          {home.features.length > 0 && (
            <section className="pm-block">
              <h2>{biz ? "Building features" : "Amenities"}</h2>
              <Amenities cfg={cfg} ids={home.features} />
            </section>
          )}

          <section className="pm-block">
            <h2>{biz ? "Lease terms" : "Policies"}</h2>
            <div className="pm-policy">
              {biz
                ? <div><small>Terms</small>{yearsTerms([...new Set(suites.flatMap((u) => u.leaseTerms))])}</div>
                : <div><small>Lease terms</small>{terms([...new Set(homes.flatMap((u) => u.leaseTerms))])}</div>}
              {biz && [...new Set(suites.map((u) => u.leaseType).filter(Boolean))].length > 0 && <div><small>Lease type</small>{[...new Set(suites.map((u) => u.leaseType).filter(Boolean))].join(", ")}</div>}
              {!biz && home.petPolicy && <div><small>Pets</small>{home.petPolicy}</div>}
              {home.parking && <div><small>Parking</small>{home.parking}</div>}
              {home.utilities && <div><small>{biz ? "Operating costs" : "Utilities"}</small>{home.utilities}</div>}
            </div>
          </section>

          <section className="pm-block">
            <h2>Location</h2>
            <p className="pm-muted">{fullAddress(home.address)}</p>
            <div className="pm-map-box"><HomeMap home={home} mapsKey={mapsKey} /></div>
          </section>
        </div>

        <aside className="pm-side">
          <div className="pm-box">
            {biz
              ? <div className="rent">{open.length ? psfRange(open) : "Fully leased"} {open.length > 0 && <small>/SF/yr</small>}</div>
              : <div className="rent">{open.length ? rentRange(open) : "Fully leased"} {open.length > 0 && <small>/ mo</small>}</div>}
            <p className="pm-muted" style={{ margin: "6px 0 16px" }}>
              {open.length
                ? `${open.length} ${biz ? (open.length === 1 ? "space" : "spaces") : open.length === 1 ? "home" : "homes"} available${open.some(isNow) ? ", some right now" : ""}.`
                : "Nothing is available here right now. The office can tell you what’s coming up."}
            </p>
            <a className="btn clay" href={biz ? "#suites" : "#units"}>{biz ? "See available space" : "See available homes"}</a>
            {!biz && openSuites.length > 0 && <a className="btn ghost" style={{ marginTop: 8 }} href="#suites">Commercial space</a>}
          </div>
          <Office cfg={cfg} />
        </aside>
      </div>
    </div>
  );
}

/** One space to lease: an apartment or room in a building, a whole house, or a commercial suite. */
export function UnitPage({ cfg, home, unit, mapsKey, signedIn }: { cfg: PropertyConfig; home: Home; unit: Unit; mapsKey: string | null; signedIn: boolean }) {
  if (unit.segment === "commercial") return <SpacePage cfg={cfg} home={home} unit={unit} mapsKey={mapsKey} signedIn={signedIn} />;
  const inBuilding = home.kind === "building";
  const others = inBuilding ? home.units.filter((u) => u.available && u.id !== unit.id && u.segment === "residential").slice(0, 4) : [];
  const pets = petsLabel(unit.pets) || home.petPolicy;
  const apply = signedIn ? `/apply/${unit.id}` : `/login?next=${encodeURIComponent(`/apply/${unit.id}`)}`;
  return (
    <div className="pm wrap">
      <nav className="pm-crumbs" aria-label="Breadcrumb">
        <Link href="/homes">Homes</Link><span>/</span>
        {inBuilding ? <><Link href={`/homes/${home.id}`}>{home.title}</Link><span>/</span><span>{unit.title}</span></> : <span>{home.title}</span>}
      </nav>
      <Gallery images={unit.images} title={unit.title} />
      <div className="pm-detail">
        <div>
          <span className="pm-kicker">{unit.type === "room" ? "Private room" : unit.typeLabel}{inBuilding ? ` · ${home.title}` : ""}</span>
          <h1>{inBuilding ? unit.title : home.title}</h1>
          <div className="pm-addr">{fullAddress(unit.address)}</div>
          <div className="pm-facts">
            <div><small>Rent</small><b>{money(unit.rent)}</b></div>
            <div><small>{unit.type === "room" ? "Room" : "Bedrooms"}</small><b>{unit.type === "room" ? "Private" : beds(unit.beds)}</b></div>
            {unit.baths != null && <div><small>Bathrooms</small><b>{unit.baths}</b></div>}
            {unit.sqft != null && <div><small>Size</small><b>{sqft(unit.sqft)}</b></div>}
            <div><small>Move in</small><b>{unit.available ? (isNow(unit) ? "Now" : day(unit.availableFrom, { month: "short", day: "numeric" })) : "Leased"}</b></div>
          </div>

          {unit.description && (
            <section className="pm-block">
              <h2>About this home</h2>
              {unit.description.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}
            </section>
          )}

          <section className="pm-block">
            <h2>Features</h2>
            <Amenities cfg={cfg} ids={[...unit.features, ...(inBuilding ? home.features : [])]} />
          </section>

          <section className="pm-block">
            <h2>Lease &amp; policies</h2>
            <div className="pm-policy">
              <div><small>Lease terms</small>{terms(unit.leaseTerms)}</div>
              <div><small>Security deposit</small>{unit.deposit != null ? money(unit.deposit) : "Set after screening"}</div>
              {pets && <div><small>Pets</small>{pets}</div>}
              {home.parking && <div><small>Parking</small>{home.parking}</div>}
              {home.utilities && <div><small>Utilities</small>{unit.features.includes("utilities-included") ? "Included in rent" : home.utilities}</div>}
              {unit.furnished && <div><small>Furnishing</small>Furnished</div>}
            </div>
          </section>

          {inBuilding && (
            <section className="pm-block">
              <h2>About {home.title}</h2>
              {home.description && <p>{home.description.split(/\n{2,}/)[0]}</p>}
              <Link className="pm-link" href={`/homes/${home.id}`}>See the building and every available home</Link>
            </section>
          )}

          <section className="pm-block">
            <h2>Location</h2>
            <p className="pm-muted">{fullAddress(unit.address)} · {home.neighborhood}</p>
            <div className="pm-map-box"><HomeMap home={home} mapsKey={mapsKey} /></div>
          </section>

          {others.length > 0 && (
            <section className="pm-block">
              <h2>More homes in {home.title}</h2>
              <ul className="pm-rows">
                {others.map((u) => (
                  <li key={u.id}>
                    <Link className="t" href={`/homes/${u.id}`}>{u.title} · {u.type === "room" ? "Private room" : beds(u.beds)}{u.baths ? ` · ${baths(u.baths)}` : ""}</Link>
                    <b>{money(u.rent)}</b>
                    <span className="s">{availability(u)}{u.sqft ? ` · ${sqft(u.sqft)}` : ""}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="pm-side">
          <div className="pm-box">
            <div className="rent">{money(unit.rent)} <small>/ month</small></div>
            <div style={{ marginTop: 8 }}>{unit.available ? <span className={`pm-pill${isNow(unit) ? " now" : " info"}`}><i className="pm-dot" /> {availability(unit)}</span> : <span className="pm-pill bad">Leased</span>}</div>
            <dl>
              <dt>Deposit</dt><dd>{unit.deposit != null ? money(unit.deposit) : "After screening"}</dd>
              <dt>Lease</dt><dd>{terms(unit.leaseTerms)}</dd>
              {pets && <><dt>Pets</dt><dd>{unit.pets === true ? "Welcome" : unit.pets === false ? "No" : "Ask"}</dd></>}
            </dl>
            {unit.available
              ? <Link className="btn clay" href={apply}>Apply for this home</Link>
              : <Link className="btn ghost" href={inBuilding ? `/homes/${home.id}` : "/homes"}>See what’s available</Link>}
            {unit.available && <p className="pm-muted" style={{ fontSize: 13.5, margin: "12px 0 0" }}>Takes about 10 minutes. We reply within two business days.</p>}
          </div>
          {unit.available && (
            <div className="pm-box">
              <h3>Have these ready</h3>
              <ul>{cfg.applyChecklist.map((c) => <li key={c}>{c}</li>)}</ul>
            </div>
          )}
          <Office cfg={cfg} />
        </aside>
      </div>
    </div>
  );
}

/** A commercial space, read like a listing sheet: rate and lease type up top, the specs a
 *  tenant's broker checks, then the building. */
function SpacePage({ cfg, home, unit, mapsKey, signedIn }: { cfg: PropertyConfig; home: Home; unit: Unit; mapsKey: string | null; signedIn: boolean }) {
  const inBuilding = home.kind === "building";
  const others = inBuilding ? home.units.filter((u) => u.available && u.id !== unit.id && u.segment === "commercial").slice(0, 4) : [];
  const apply = signedIn ? `/apply/${unit.id}` : `/login?next=${encodeURIComponent(`/apply/${unit.id}`)}`;
  const biz = cfg.commercial;
  return (
    <div className="pm wrap">
      <nav className="pm-crumbs" aria-label="Breadcrumb">
        <Link href="/commercial">Commercial</Link><span>/</span>
        {inBuilding ? <><Link href={`/homes/${home.id}#suites`}>{home.title}</Link><span>/</span><span>{unit.title}</span></> : <span>{home.title}</span>}
      </nav>
      <Gallery images={unit.images} title={unit.title} />
      <div className="pm-detail">
        <div>
          <span className="pm-kicker">{[unit.typeLabel, unit.condition].filter(Boolean).join(" · ")}</span>
          <h1>{inBuilding ? `${unit.title}, ${home.title}` : home.title}</h1>
          <div className="pm-addr">{fullAddress(unit.address)}</div>
          <div className="pm-facts">
            <div><small>Rate</small><b>{psf(unit.ratePsf)}</b></div>
            {unit.leaseType && <div><small>Lease type</small><b>{unit.leaseType}</b></div>}
            <div><small>Size</small><b>{unitSize(unit)}</b></div>
            <div><small>Available</small><b>{unit.available ? (isNow(unit) ? "Now" : day(unit.availableFrom, { month: "short", day: "numeric" })) : "Leased"}</b></div>
          </div>

          {unit.description && (
            <section className="pm-block">
              <h2>About this space</h2>
              {unit.description.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}
            </section>
          )}

          {unit.specs.length > 0 && (
            <section className="pm-block">
              <h2>Specifications</h2>
              <div className="pm-policy">
                {unit.specs.map((s) => <div key={s.label}><small>{s.label}</small>{s.value}</div>)}
              </div>
            </section>
          )}

          <section className="pm-block">
            <h2>Features</h2>
            <Amenities cfg={cfg} ids={[...unit.features, ...(inBuilding ? home.features : [])]} />
          </section>

          <section className="pm-block">
            <h2>Lease terms</h2>
            <div className="pm-policy">
              <div><small>Term</small>{yearsTerms(unit.leaseTerms)}</div>
              {unit.leaseType && <div><small>Lease type</small>{unit.leaseType}</div>}
              {unit.opex != null && <div><small>Est. operating expenses</small>{psf(unit.opex)} (taxes, insurance, common area)</div>}
              <div><small>Security deposit</small>{unit.deposit != null ? money(unit.deposit) : "Set after credit review"}</div>
              {home.parking && <div><small>Parking</small>{home.parking}</div>}
              {home.utilities && <div><small>Operating costs</small>{home.utilities}</div>}
            </div>
          </section>

          {inBuilding && (
            <section className="pm-block">
              <h2>About {home.title}</h2>
              {home.description && <p>{home.description.split(/\n{2,}/)[0]}</p>}
              <Link className="pm-link" href={`/homes/${home.id}#suites`}>See the building and all its space</Link>
            </section>
          )}

          <section className="pm-block">
            <h2>Location</h2>
            <p className="pm-muted">{fullAddress(unit.address)} · {home.neighborhood}</p>
            <div className="pm-map-box"><HomeMap home={home} mapsKey={mapsKey} /></div>
          </section>

          {others.length > 0 && (
            <section className="pm-block">
              <h2>More space in {home.title}</h2>
              <ul className="pm-rows">
                {others.map((u) => (
                  <li key={u.id}>
                    <Link className="t" href={`/homes/${u.id}`}>{u.title} · {unitSize(u)}</Link>
                    <b>{psf(u.ratePsf)}</b>
                    <span className="s">{availability(u)}{u.leaseType ? ` · ${u.leaseType}` : ""}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="pm-side">
          <div className="pm-box">
            <div className="rent">{psf(unit.ratePsf).replace("/SF/yr", "")} <small>/SF/yr{unit.leaseType ? ` ${unit.leaseType}` : ""}</small></div>
            <div style={{ marginTop: 8 }}>{unit.available ? <span className={`pm-pill${isNow(unit) ? " now" : " info"}`}><i className="pm-dot" /> {availability(unit)}</span> : <span className="pm-pill bad">Leased</span>}</div>
            <dl>
              <dt>Size</dt><dd>{unitSize(unit)}</dd>
              {unit.rent != null && <><dt>Base rent</dt><dd>{money(unit.rent)} / mo</dd></>}
              {unit.opex != null && <><dt>Est. opex</dt><dd>{psf(unit.opex)}</dd></>}
              <dt>Term</dt><dd>{yearsTerms(unit.leaseTerms)}</dd>
            </dl>
            {unit.available
              ? <Link className="btn clay" href={apply}>Apply to lease</Link>
              : <Link className="btn ghost" href="/commercial">See what’s available</Link>}
            {unit.available && <a className="btn ghost" style={{ marginTop: 8 }} href={`tel:${cfg.office.phone.replace(/[^\d+]/g, "")}`}>Call to tour · {cfg.office.phone}</a>}
            {biz && <p className="pm-muted" style={{ fontSize: 13.5, margin: "12px 0 0" }}>{biz.note}</p>}
          </div>
          {unit.available && biz && (
            <div className="pm-box">
              <h3>Have these ready</h3>
              <ul>{biz.checklist.map((c) => <li key={c}>{c}</li>)}</ul>
            </div>
          )}
          <Office cfg={cfg} />
        </aside>
      </div>
    </div>
  );
}
