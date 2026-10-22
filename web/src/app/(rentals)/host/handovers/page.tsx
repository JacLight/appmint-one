import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { DashboardShell } from "@/components/dashboard-shell";
import { EmptyState } from "@/components/empty-state";
import { requireHost } from "@/lib/guards";
import { routes } from "@/lib/nav";
import { getNav } from "@/lib/nav-server";
import { stowbo, type HostHandovers } from "@/api/rentals";
import { fmtFull } from "@/lib/dates";

export const metadata = { title: "Hand-offs" };

const STATE: Record<string, { label: string; cls: string }> = {
  active: { label: "Live", cls: "wait" }, completed: { label: "Handed over", cls: "ok" }, revoked: { label: "Cancelled", cls: "off" }, expired: { label: "Expired", cls: "off" },
};
const REASON: Record<string, string> = { wrong_person: "Wrong person", expired: "Pass expired", revoked: "Pass cancelled", id_mismatch: "ID didn’t match", other: "Other" };
// The report has no booking item list to number against, so an unnamed item is just "an item".
const itemName = (i: { label?: string | null; identifier?: string | null; unit?: string | null }) => i.label || i.identifier || (i.unit ? `bay ${i.unit}` : "");
/** ISO timestamp `days` ago — kept out of the component so the render stays pure. */
const sinceIso = (days: number) => new Date(Date.now() - days * 86400000).toISOString();
const RANGE: { k: string; label: string; days: number | null }[] = [{ k: "7", label: "7 days", days: 7 }, { k: "30", label: "30 days", days: 30 }, { k: "90", label: "90 days", days: 90 }, { k: "all", label: "All", days: null }];

/** Every pickup that went to someone other than the owner, and every one you turned
 *  away — who came, what they took, what was checked, the photo. */
export default async function HandoversPage({ searchParams }: { searchParams: Promise<{ range?: string; status?: string }> }) {
  await requireHost();
  const sp = await searchParams;
  const range = RANGE.find((r) => r.k === sp.range) || RANGE[1];
  const from = range.days ? sinceIso(range.days) : undefined;
  const status = sp.status && sp.status !== "all" ? sp.status : undefined;
  const rep: HostHandovers | null = await stowbo.host.handovers({ from, status }).catch(() => null);
  const handoffs = rep?.handoffs ?? [];
  const refusals = rep?.refusals ?? [];
  const t = rep?.totals ?? { handoffs: handoffs.length, completed: 0, active: 0, refusals: refusals.length };
  const q = (over: Record<string, string | undefined>) => {
    const u = new URLSearchParams(); const cur = { range: range.k, status: sp.status || "all", ...over };
    Object.entries(cur).forEach(([k, v]) => { if (v && !(k === "status" && v === "all") && !(k === "range" && v === "30")) u.set(k, v); });
    const s = u.toString(); return `${routes.hostHandovers}${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <SiteHeader />
      <DashboardShell nav={(await getNav()).provider} title="Hand-offs" action={<Link className="btn ghost sm" href={routes.hostCustody}>Custody</Link>}>
        <p className="muted" style={{ margin: "-6px 0 16px", fontSize: 14 }}>Pickups the owner handed to someone else, and the ones you refused. To hand over, open the booking from Custody and look up their code.</p>

        <div className="hov-stats">
          <div className="hov-stat"><span>Passes</span><b>{t.handoffs}</b></div>
          <div className="hov-stat"><span>Handed over</span><b>{t.completed}</b></div>
          <div className="hov-stat"><span>Still live</span><b>{t.active}</b></div>
          <div className="hov-stat"><span>Refused</span><b className={t.refusals ? "hov-bad" : ""}>{t.refusals}</b></div>
        </div>

        <div className="hov-filters">
          <div className="seg">{RANGE.map((r) => <Link key={r.k} className={`seg-btn${range.k === r.k ? " on" : ""}`} href={q({ range: r.k })}>{r.label}</Link>)}</div>
          <div className="seg">{[["all", "Any state"], ["active", "Live"], ["completed", "Handed over"], ["revoked", "Cancelled"], ["expired", "Expired"]].map(([k, l]) => <Link key={k} className={`seg-btn${(sp.status || "all") === k ? " on" : ""}`} href={q({ status: k })}>{l}</Link>)}</div>
        </div>

        {!rep && <EmptyState title="Couldn’t load hand-offs" note="The server didn’t answer. Try again in a moment." />}

        {rep && handoffs.length === 0 && refusals.length === 0 && (
          <EmptyState title="No hand-offs yet" note="When a guest sends someone else to collect, the pass and what happened at the counter show up here." />
        )}

        {handoffs.length > 0 && (
          <div className="tcard bkd-card">
            <h3>Passes</h3>
            <div className="hov-list">
              {handoffs.map((h) => {
                const st = STATE[h.status] || { label: h.status, cls: "off" };
                const who = h.delegate?.name || h.delegate?.phone || h.delegate?.email || "Someone";
                const named = (h.itemDetails ?? []).map((i) => itemName(i)).filter(Boolean);
                const what = named.length === h.items.length && named.length ? named.join(", ") : `${h.items.length} item${h.items.length === 1 ? "" : "s"}`;
                const hv = h.handovers ?? [];
                return (
                  <div className="hov-row" key={h.id}>
                    <div className="hov-main">
                      <b>{who} <span className={`hp-pill ${st.cls}`}>{st.label}</span></b>
                      <span className="hov-meta">Pass #{h.reference} · <Link href={`${routes.hostCustody}/${h.booking}`}>Open booking</Link> · {what} · {h.verifyLabel}{h.validUntil ? ` · valid until ${fmtFull(h.validUntil)}` : ""}</span>
                      {h.note && <span className="hov-meta">Owner’s note: “{h.note}”</span>}
                      {hv.map((x, i) => (
                        <div className="hov-done" key={i}>
                          <span>Handed over {fmtFull(x.at)}{x.name ? ` to ${x.name}` : ""} · checked: {x.verified.map((v) => (v === "id" ? "photo ID" : v === "qr" ? "code" : v)).join(", ") || "code"}</span>
                          {x.photos?.length > 0 && <div className="hov-photos">{x.photos.map((p, j) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <a key={j} href={p.url} target="_blank" rel="noreferrer"><img src={p.url} alt={`Handover ${j + 1}`} /></a>
                          ))}</div>}
                        </div>
                      ))}
                      {h.status === "completed" && hv.length === 0 && <span className="hov-meta">Handed over{h.collectedBy ? ` to ${h.collectedBy}` : ""}{h.completedAt ? ` · ${fmtFull(h.completedAt)}` : ""}</span>}
                    </div>
                    <span className="hov-when">{h.createdAt ? fmtFull(h.createdAt) : ""}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {refusals.length > 0 && (
          <div className="tcard bkd-card">
            <h3>Refused at the counter</h3>
            <div className="hov-list">
              {refusals.map((r, i) => (
                <div className="hov-row" key={i}>
                  <div className="hov-main">
                    <b>{REASON[r.reason] || r.reason}{r.who ? ` — ${r.who}` : ""}</b>
                    <span className="hov-meta"><Link href={`${routes.hostCustody}/${r.booking}`}>Open booking</Link>{r.label ? ` · ${r.label}` : ""}{r.delegation ? " · on a pass" : " · owner’s code"}</span>
                    {r.note && <span className="hov-meta">“{r.note}”</span>}
                  </div>
                  <span className="hov-when">{fmtFull(r.at)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </DashboardShell>
    </>
  );
}
