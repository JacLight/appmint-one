import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSetup } from "@/lib/setup";
import { getSession } from "@/lib/auth";
import { documents } from "@/lib/documents";
import { myRequest, requestReplies, requestStage, responseClock } from "@/modules/property/lib/resident";
import { day } from "@/modules/property/lib/format";
import { Ic } from "@/modules/property/components/icons";

type Params = Promise<{ number: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  return { title: `Request #${(await params).number}` };
}

/** One repair request: where it is, the response promise, what was sent, the office's replies. */
export default async function RequestPage({ params }: { params: Params }) {
  const [{ number }, setup, session] = await Promise.all([params, getSetup(), getSession()]);
  const cfg = setup.property!;
  const r = await myRequest(decodeURIComponent(number));
  if (!r) notFound();
  const st = requestStage(r.status);
  const c = responseClock(cfg, r);
  const cat = cfg.requestCategories.find((x) => x.id === r.category);
  const [replies, files] = await Promise.all([
    requestReplies(r.id, session.customer?.email),
    r.photos.length ? documents.list().then((x) => x.files || []).catch(() => []) : Promise.resolve([]),
  ]);
  const photos = r.photos.map((p) => files.find((f) => f.path === p || f.path.endsWith(`/${p}`) || p.endsWith(f.path))).filter((f) => f?.url);
  const when = (d: Date) => d.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: cfg.timezone });

  return (
    <>
      <nav className="pm-crumbs" style={{ paddingTop: 0, marginBottom: 12 }}><Link href="/account/requests">Repairs</Link><span>/</span><span>#{r.number}</span></nav>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: "clamp(24px,3vw,34px)" }}>{r.title}</h1>
          <p className="pm-muted" style={{ margin: "6px 0 0" }}>#{r.number} · sent {day(r.createdAt)}{r.home ? ` · ${r.home}` : ""}</p>
        </div>
        <span className={`pm-pill ${st.tone}`}>{st.label}</span>
      </div>

      <div className="pm-two">
        <div style={{ display: "grid", gap: 22 }}>
          <section className="pm-panel">
            <div className="pm-track">
              <div className="done">Received</div>
              <div className={st.step >= 2 ? "done" : ""}>{st.label === "On hold" ? "On hold" : "In progress"}</div>
              <div className={st.step >= 3 ? "done" : ""}>Done</div>
            </div>
            <div className={`pm-clock${st.step === 3 || c.answered ? " met" : c.late ? " late" : ""}`} style={{ marginTop: 16 }}>
              <Ic n="clock" />
              {st.step === 3 ? "Fixed. If it’s back, send a new request and mention this one."
                : c.answered ? "The office has picked this up."
                : c.late ? `Past our ${cfg.sla.responseHours}-hour promise. The office has been alerted; call ${cfg.office.phone} if you need us sooner.`
                : `We’ll respond by ${when(c.due)}.`}
            </div>
          </section>

          <section className="pm-panel">
            <div className="pm-panel-h"><h2>What you sent</h2></div>
            <p style={{ whiteSpace: "pre-line", margin: "0 0 14px" }}>{r.description}</p>
            <dl style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: "6px 14px", margin: 0, fontSize: 14.5 }}>
              {cat && <><dt className="pm-muted">Kind</dt><dd style={{ margin: 0 }}>{cat.label}</dd></>}
              {r.area && <><dt className="pm-muted">Where</dt><dd style={{ margin: 0 }}>{r.area}</dd></>}
              <dt className="pm-muted">Urgency</dt><dd style={{ margin: 0 }}>{r.urgency === "urgent" ? "Needs fixing soon" : "Can wait a few days"}</dd>
              <dt className="pm-muted">Entry</dt><dd style={{ margin: 0 }}>{r.entry === "no" ? "Call first" : "OK to come in"}</dd>
              {r.pets && <><dt className="pm-muted">Pets</dt><dd style={{ margin: 0 }}>{r.pets}</dd></>}
              {r.times && <><dt className="pm-muted">Best times</dt><dd style={{ margin: 0 }}>{r.times}</dd></>}
            </dl>
            {photos.length > 0 && (
              <div className="pm-thumbs" style={{ marginTop: 14 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {photos.map((f) => <a key={f!.path} href={f!.url} target="_blank" rel="noreferrer"><img src={f!.url} alt={f!.name} /></a>)}
              </div>
            )}
          </section>

          <section className="pm-panel">
            <div className="pm-panel-h"><h2>Updates</h2></div>
            {replies.length ? (
              <div className="pm-thread">
                {replies.map((m, i) => (
                  <div key={i} className={`pm-msg${m.staff ? " staff" : ""}`}><small>{m.staff ? cfg.office.name : "You"}{m.at ? ` · ${day(m.at)}` : ""}</small>{m.text}</div>
                ))}
              </div>
            ) : <p className="pm-muted" style={{ margin: 0 }}>The office’s replies and visit times show up here, and we email you too.</p>}
          </section>
        </div>
        <div style={{ display: "grid", gap: 16 }}>
          <div className="pm-emergency">
            <Ic n="phone" size={22} />
            <div><b>Getting worse? Call <a href={`tel:${cfg.sla.emergencyPhone.replace(/[^\d+]/g, "")}`}>{cfg.sla.emergencyPhone}</a></b>For anything that can’t wait for a reply, call. Mention request #{r.number}.</div>
          </div>
          <div className="pm-panel">
            <div className="pm-panel-h"><h2>Add something?</h2></div>
            <p className="pm-muted" style={{ margin: "0 0 12px", fontSize: 14.5 }}>Reply to the email we sent you about #{r.number}: your reply is added to this request. Or call the office on {cfg.office.phone}.</p>
            <a className="btn ghost sm" href={`tel:${cfg.office.phone.replace(/[^\d+]/g, "")}`}>Call the office</a>
          </div>
        </div>
      </div>
    </>
  );
}
