import type { Metadata } from "next";
import Link from "next/link";
import { getSetup } from "@/lib/setup";
import { PageTitle } from "@/components/dashboard-shell";
import { applicationStage, myApplications } from "@/modules/property/lib/resident";
import { day, money, terms, yearsTerms } from "@/modules/property/lib/format";

export const metadata: Metadata = { title: "Applications" };

/** Rental and commercial lease applications and where each one is. The leasing team moves them in Studio. */
export default async function ApplicationsPage() {
  const setup = await getSetup();
  const cfg = setup.property!;
  const apps = await myApplications(cfg);
  return (
    <>
      <PageTitle title="Applications" action={<Link className="btn ghost sm" href="/homes">Browse homes</Link>} />
      {apps.length === 0 ? (
        <div className="pm-panel"><p className="pm-muted" style={{ margin: 0 }}>You haven’t applied for a home yet. When you do, you can follow it here, step by step.</p></div>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {apps.map((a) => {
            const st = applicationStage(a.status);
            const docs = Array.isArray(a.values.documents) ? a.values.documents.length : 0;
            const biz = a.segment === "commercial";
            return (
              <section className="pm-panel" key={a.id}>
                <div className="pm-panel-h">
                  <div>
                    <h2>{a.unitTitle || (biz ? "Space" : "Home")}{a.homeTitle && a.homeTitle !== a.unitTitle ? `, ${a.homeTitle}` : ""}</h2>
                    <p className="pm-muted" style={{ margin: "4px 0 0", fontSize: 14.5 }}>
                      {a.submittedAt ? `Sent ${day(a.submittedAt)}` : "Not sent yet"}{biz && a.company ? ` · for ${a.company}` : ""}{a.rent != null ? ` · ${money(a.rent)}/mo${biz ? " base" : ""}` : ""}{a.moveIn ? ` · ${biz ? "occupancy" : "move in"} ${day(a.moveIn)}` : ""}{a.term ? ` · ${biz ? yearsTerms([a.term]) : terms([a.term])}` : ""}
                    </p>
                  </div>
                  <span className={`pm-pill ${st.tone}`}>{st.label}</span>
                </div>
                {a.status !== "archived" && (
                  <div className="pm-track four" style={{ marginTop: 14 }}>
                    <div className="done">Sent</div>
                    <div className={st.step >= 2 ? "done" : ""}>{biz ? "Credit review" : "Screening"}</div>
                    <div className={st.step >= 3 ? "done" : ""}>{a.status === "rejected" ? "Not approved" : "Decision"}</div>
                    <div className={a.status === "approved" ? "done" : ""}>Lease &amp; keys</div>
                  </div>
                )}
                <p className="pm-muted" style={{ fontSize: 14.5, margin: "16px 0 0" }}>
                  {a.status === "approved" ? (biz
                    ? <>Approved. The leasing team will send a letter of intent, then the lease and your deposit and build-out schedule. <Link className="pm-link" href="/account/home">Go to your space</Link></>
                    : <>Approved. The leasing team will send your lease to sign and your move-in costs. <Link className="pm-link" href="/account/home">Go to your home</Link></>)
                    : a.status === "rejected" ? <>This one didn’t go through. Call {cfg.office.phone} to ask why, or <Link className="pm-link" href={biz ? "/commercial" : "/homes"}>{biz ? "look at other space" : "look at other homes"}</Link>.</>
                    : a.status === "pending" || a.status === "incomplete" ? <>The leasing team needs something more. Check your email, or upload it in <Link className="pm-link" href="/account/documents">Documents</Link>.</>
                    : <>The leasing team replies within two business days.{docs ? ` ${docs} document${docs === 1 ? "" : "s"} attached.` : ""} {biz ? "Watch for an email to set up a tour." : "Watch for the screening email."}</>}
                </p>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
