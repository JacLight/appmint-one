import type { Metadata } from "next";
import Link from "next/link";
import { getSetup } from "@/lib/setup";
import { PageTitle } from "@/components/dashboard-shell";
import { applicationStage, myApplications, myBoard, myRent, myRequests, myTenancy, requestStage, responseClock } from "@/modules/property/lib/resident";
import { day, fullAddress, money, terms, yearsTerms } from "@/modules/property/lib/format";
import { Notices } from "@/modules/property/components/notices";
import { Ic } from "@/modules/property/components/icons";

export const metadata: Metadata = { title: "My home" };

/** The resident's home screen (AppFolio/Buildium style): what's owed, what's being
 *  fixed, what the building said, and the lease. Before a lease: where the application is. */
export default async function MyHomePage() {
  const setup = await getSetup();
  const cfg = setup.property!;
  const apps = await myApplications(cfg);
  const tenancy = await myTenancy(cfg, apps).catch(() => null);

  if (!tenancy) {
    const latest = apps[0];
    const st = latest ? applicationStage(latest.status) : null;
    return (
      <>
        <PageTitle title="My home" />
        <div className="pm-panel" style={{ display: "grid", gap: 14, maxWidth: 720 }}>
          {latest && st ? (
            <>
              <span className="pm-kicker">Your application</span>
              <h2 style={{ fontSize: 26 }}>{latest.unitTitle}{latest.homeTitle ? `, ${latest.homeTitle}` : ""}</h2>
              {latest.company && <p className="pm-muted" style={{ margin: "-8px 0 0" }}>For {latest.company}</p>}
              <div><span className={`pm-pill ${st.tone}`}>{st.label}</span></div>
              <p className="pm-muted" style={{ margin: 0 }}>Once the leasing team approves it and your lease starts, this page {latest.segment === "commercial" ? "runs your space" : "becomes your home"}: rent, repairs and building notices in one place.</p>
              <div className="pm-btn-row"><Link className="btn clay sm" href="/account/applications">See your application</Link><Link className="btn ghost sm" href="/homes">Browse homes</Link></div>
            </>
          ) : (
            <>
              <h2 style={{ fontSize: 26 }}>You don’t have a lease with us yet</h2>
              <p className="pm-muted" style={{ margin: 0 }}>When you rent from {setup.brand.name}, this is where you pay rent, send repair requests and read notices from your building. Already a resident? Ask the office to link your lease to {` `}this account.</p>
              <div className="pm-btn-row"><Link className="btn clay sm" href="/homes">Find a home</Link><a className="btn ghost sm" href={`tel:${cfg.office.phone.replace(/[^\d+]/g, "")}`}>Call the office</a></div>
            </>
          )}
        </div>
      </>
    );
  }

  const { home, unit, application } = tenancy;
  const biz = unit.segment === "commercial";
  const [rent, requests, board] = await Promise.all([myRent(), myRequests(), myBoard(home, 4)]);
  // What is owed is each invoice's own balance, as the engine sent it: never added up here.
  const next = [...rent.open].sort((a, b) => String(a.dueAt || "").localeCompare(String(b.dueAt || "")))[0];
  const openReq = requests.filter((r) => requestStage(r.status).step < 3);

  return (
    <>
      <div className="pm-acct-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {(unit.images[0] || home.images[0]) && <img src={unit.images[0] || home.images[0]} alt="" />}
        <div>
          <span className="pm-kicker">{biz ? `Your space${application.company ? ` · ${application.company}` : ""}` : "Your home"}</span>
          <h1>{home.kind === "building" ? `${unit.title}, ${home.title}` : home.title}</h1>
          <p>{fullAddress(unit.address)}</p>
        </div>
        <div className="pm-btn-row">
          <Link className="btn clay sm" href="/account/rent">Pay rent</Link>
          <Link className="btn ghost sm" href="/account/requests/new">Request a repair</Link>
        </div>
      </div>

      <div className="pm-tiles">
        <div className={`pm-tile${next ? " due" : ""}`}>
          <small>Rent</small>
          {next ? (
            <>
              <div className="big">{money(next.balance, next.currency)}</div>
              <p>{next.dueAt ? `Due ${day(next.dueAt)}` : "Due now"}{rent.open.length > 1 ? ` · ${rent.open.length - 1} more open` : ""}</p>
              <Link className="btn clay sm" href="/account/rent">Pay now</Link>
            </>
          ) : (
            <>
              <div className="big">All paid</div>
              <p>{rent.paid[0] ? `Last payment: ${rent.paid[0].description || `invoice ${rent.paid[0].number}`}` : "Your rent invoices show up here each month."}</p>
            </>
          )}
        </div>
        <div className="pm-tile">
          <small>Repairs</small>
          <div className="big">{openReq.length ? `${openReq.length} open` : "None open"}</div>
          <p>{openReq[0] ? `${openReq[0].title} · ${requestStage(openReq[0].status).label}` : `We respond within ${cfg.sla.responseHours} hours.`}</p>
          <Link className="btn ghost sm" href={openReq.length ? "/account/requests" : "/account/requests/new"}>{openReq.length ? "See requests" : "Request a repair"}</Link>
        </div>
        <div className="pm-tile">
          <small>Lease</small>
          <div className="big">{money(unit.rent)}<span style={{ fontSize: 15, fontWeight: 500, color: "var(--muted)" }}> / mo</span></div>
          <p>{application.moveIn ? `${biz ? "Occupied" : "Moved in"} ${day(application.moveIn)}` : "Move-in date with the office"}{application.term ? ` · ${biz ? yearsTerms([application.term]) : terms([application.term])}` : ""}{biz && unit.leaseType ? ` · ${unit.leaseType}` : ""}</p>
          <Link className="btn ghost sm" href="/account/documents">Lease &amp; documents</Link>
        </div>
      </div>

      <div className="pm-two">
        <div style={{ display: "grid", gap: 22 }}>
          <section className="pm-panel">
            <div className="pm-panel-h"><h2>Notices</h2>{board?.status === "member" && board.notices.length > 0 && <Link href="/account/notices">All notices</Link>}</div>
            <Notices board={board} limit={3} />
          </section>
          <section className="pm-panel">
            <div className="pm-panel-h"><h2>Repair requests</h2><Link href="/account/requests">All requests</Link></div>
            {openReq.length ? (
              <ul className="pm-rows">
                {openReq.slice(0, 4).map((r) => {
                  const st = requestStage(r.status);
                  const c = responseClock(cfg, r);
                  return (
                    <li key={r.id}>
                      <Link className="t" href={`/account/requests/${encodeURIComponent(r.number)}`}>{r.title}</Link>
                      <span className={`pm-pill ${c.late ? "wait" : st.tone}`}>{st.label}</span>
                      <span className="s">#{r.number} · sent {day(r.createdAt)}{!c.answered ? ` · response due ${c.due.toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: cfg.timezone })}` : ""}</span>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="pm-muted" style={{ margin: 0 }}>Nothing open. Something broken? <Link className="pm-link" href="/account/requests/new">Tell us</Link>.</p>}
          </section>
        </div>
        <div style={{ display: "grid", gap: 16 }}>
          <div className="pm-emergency">
            <Ic n="phone" size={22} />
            <div><b>Emergency? Call <a href={`tel:${cfg.sla.emergencyPhone.replace(/[^\d+]/g, "")}`}>{cfg.sla.emergencyPhone}</a></b>{cfg.sla.emergencyNote}</div>
          </div>
          <div className="pm-panel">
            <div className="pm-panel-h"><h2>Your office</h2></div>
            <div className="pm-office">
              <b>{cfg.office.name}</b>
              <a href={`tel:${cfg.office.phone.replace(/[^\d+]/g, "")}`}>{cfg.office.phone}</a>
              <span className="pm-muted">{cfg.office.hours}</span>
              <span className="pm-muted">{cfg.office.address}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
