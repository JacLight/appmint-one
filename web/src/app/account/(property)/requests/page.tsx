import type { Metadata } from "next";
import Link from "next/link";
import { getSetup } from "@/lib/setup";
import { PageTitle } from "@/components/dashboard-shell";
import { myRequests, requestStage, responseClock } from "@/modules/property/lib/resident";
import { day } from "@/modules/property/lib/format";
import { Ic } from "@/modules/property/components/icons";

export const metadata: Metadata = { title: "Repairs" };

type SP = Promise<Record<string, string | undefined>>;

/** Repair requests: open ones first with their response clock, then the done ones. */
export default async function RequestsPage({ searchParams }: { searchParams: SP }) {
  const [setup, sp] = await Promise.all([getSetup(), searchParams]);
  const cfg = setup.property!;
  const all = await myRequests();
  const open = all.filter((r) => requestStage(r.status).step < 3);
  const done = all.filter((r) => requestStage(r.status).step === 3);
  const when = (d: Date) => d.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: cfg.timezone });
  const row = (r: (typeof all)[number]) => {
    const st = requestStage(r.status);
    const c = responseClock(cfg, r);
    return (
      <li key={r.id}>
        <Link className="t" href={`/account/requests/${encodeURIComponent(r.number)}`}>{r.title}</Link>
        <span className={`pm-pill ${c.late ? "wait" : st.tone}`}>{c.late ? "Response late" : st.label}</span>
        <span className="s">#{r.number} · sent {day(r.createdAt)}{st.step < 3 && !c.answered ? ` · we respond by ${when(c.due)}` : ""}{r.area ? ` · ${r.area}` : ""}</span>
      </li>
    );
  };
  return (
    <>
      <PageTitle title="Repairs" action={<Link className="btn clay sm" href="/account/requests/new">New request</Link>} />
      {sp.sent && <div className="pm-ok" style={{ marginBottom: 18 }}><Ic n="check" /> Request #{sp.sent} sent. We’ll respond within {cfg.sla.responseHours} hours.</div>}
      <div className="pm-emergency" style={{ marginBottom: 22 }}>
        <Ic n="phone" size={22} />
        <div><b>Emergency? Call <a href={`tel:${cfg.sla.emergencyPhone.replace(/[^\d+]/g, "")}`}>{cfg.sla.emergencyPhone}</a></b>{cfg.sla.emergencyNote}</div>
      </div>
      <section className="pm-panel" style={{ marginBottom: 22 }}>
        <div className="pm-panel-h"><h2>Open</h2></div>
        {open.length ? <ul className="pm-rows">{open.map(row)}</ul> : <p className="pm-muted" style={{ margin: 0 }}>Nothing open. We respond to every request within {cfg.sla.responseHours} hours and schedule routine work within {cfg.sla.routineDays} business days.</p>}
      </section>
      {done.length > 0 && (
        <section className="pm-panel">
          <div className="pm-panel-h"><h2>Done</h2></div>
          <ul className="pm-rows">{done.slice(0, 30).map(row)}</ul>
        </section>
      )}
    </>
  );
}
