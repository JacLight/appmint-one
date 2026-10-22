import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getSetup } from "@/lib/setup";
import { getSession } from "@/lib/auth";
import { findHome } from "@/modules/property/lib/homes";
import { ApplyFlow } from "@/modules/property/components/apply-flow";
import { LeaseApplyFlow } from "@/modules/property/components/lease-apply-flow";

type Params = Promise<{ unitId: string }>;

export const metadata: Metadata = { title: "Apply", robots: { index: false } };

/** /apply/[unitId] — the rental (or commercial lease) application, for a signed-in applicant. */
export default async function ApplyPage({ params }: { params: Params }) {
  const [{ unitId }, setup, session] = await Promise.all([params, getSetup(), getSession()]);
  if (!session.signedIn || !session.customer) redirect(`/login?next=${encodeURIComponent(`/apply/${unitId}`)}`);
  const cfg = setup.property!;
  const found = await findHome(cfg, unitId).catch(() => null);
  if (!found?.unit) notFound();
  const { home, unit } = found;
  const c = session.customer;
  const biz = unit.segment === "commercial" && cfg.commercial;
  return (
    <>
      <SiteHeader />
      <main className="pm wrap">
        <nav className="pm-crumbs" aria-label="Breadcrumb"><Link href={biz ? "/commercial" : "/homes"}>{biz ? "Commercial" : "Homes"}</Link><span>/</span><Link href={`/homes/${unit.id}`}>{home.kind === "building" ? `${unit.title}, ${home.title}` : home.title}</Link><span>/</span><span>Apply</span></nav>
        {unit.available && biz ? (
          <LeaseApplyFlow unit={unit} homeTitle={home.title} email={c.email} first={c.firstName} last={c.lastName} phone={c.phone} checklist={biz.checklist} note={biz.note} />
        ) : unit.available ? (
          <ApplyFlow unit={unit} homeTitle={home.title} email={c.email} first={c.firstName} last={c.lastName} phone={c.phone} checklist={cfg.applyChecklist} screeningNote={cfg.screeningNote} />
        ) : (
          <div className="pm-empty" style={{ margin: "40px 0 90px" }}>
            <b>{unit.title} has just been leased.</b>
            <Link className="pm-link" href={home.kind === "building" ? `/homes/${home.id}` : biz ? "/commercial" : "/homes"}>See what else is available</Link>
          </div>
        )}
      </main>
    </>
  );
}
