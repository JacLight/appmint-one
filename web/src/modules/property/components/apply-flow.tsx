"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { applyAction } from "../actions/property";
import type { Unit } from "../lib/types";
import { availability, beds, money, terms } from "../lib/format";
import { Ic } from "./icons";

type A = Record<string, string>;
interface Doc { kind: string; name: string; path: string }

const STEPS = ["About you", "Your move", "Income", "Rental history", "Documents", "Review & send"];
const MAX_MB = 15;

const REQUIRED: Record<number, string[]> = {
  0: ["firstName", "lastName", "phone", "currentAddress"],
  1: ["moveIn", "leaseTerm", "adults", "pets"],
  2: ["employmentStatus", "monthlyIncome"],
  3: ["movingReason", "evicted"],
};
const LABEL: Record<string, string> = {
  firstName: "First name", lastName: "Last name", phone: "Mobile phone", currentAddress: "Current address",
  moveIn: "Move-in date", leaseTerm: "Lease length", adults: "Adults", children: "Children", otherOccupants: "Other occupants",
  pets: "Pets", petDetails: "About your pets", vehicles: "Vehicles",
  employmentStatus: "Employment", employer: "Employer", jobTitle: "Job title", monthlyIncome: "Monthly income (before tax)", employedSince: "Since",
  otherIncome: "Other income",
  currentLandlord: "Current landlord", landlordPhone: "Landlord phone", currentRent: "Current rent", movingReason: "Why you’re moving",
  evicted: "Ever been evicted?", evictionDetails: "Eviction details",
};

/** Six steps, one question group each, then a review. Documents upload straight to the
 *  applicant's own files; the application carries their paths. */
export function ApplyFlow({ unit, homeTitle, email, first, last, phone, checklist, screeningNote }: {
  unit: Unit; homeTitle: string; email: string; first?: string; last?: string; phone?: string; checklist: string[]; screeningNote: string;
}) {
  const [step, setStep] = useState(0);
  const [a, setA] = useState<A>({ firstName: first || "", lastName: last || "", phone: phone || "", leaseTerm: String(unit.leaseTerms.includes(12) ? 12 : unit.leaseTerms[0] || 12), adults: "1", children: "0", moveIn: unit.availableFrom && unit.availableFrom > new Date().toISOString().slice(0, 10) ? unit.availableFrom : "" });
  const [docs, setDocs] = useState<Doc[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const top = useRef<HTMLDivElement>(null);

  const v = (k: string) => a[k] || "";
  const on = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setA((x) => ({ ...x, [k]: e.target.value }));
  const yn = (k: string) => (
    <div className="pm-yn" role="group">
      {["yes", "no"].map((o) => <button key={o} type="button" className={v(k) === o ? "on" : ""} aria-pressed={v(k) === o} onClick={() => setA((x) => ({ ...x, [k]: o }))}>{o === "yes" ? "Yes" : "No"}</button>)}
    </div>
  );
  const go = (n: number) => { setErr(null); setStep(n); top.current?.scrollIntoView({ behavior: "smooth", block: "start" }); };
  const next = () => {
    const missing = (REQUIRED[step] || []).filter((k) => !v(k).trim());
    if (step === 1 && v("pets") === "yes" && !v("petDetails").trim()) missing.push("petDetails");
    if (missing.length) { setErr(`Please fill in: ${missing.map((k) => LABEL[k] || k).join(", ")}.`); return; }
    if (step === 4 && !docs.some((d) => d.kind === "id")) { setErr("Add a photo ID to continue. You can add more documents later from your account."); return; }
    go(step + 1);
  };

  async function upload(kind: string, files: FileList | null) {
    if (!files?.length) return;
    const list = Array.from(files);
    const big = list.find((f) => f.size > MAX_MB * 1024 * 1024);
    if (big) { setErr(`${big.name} is over ${MAX_MB} MB.`); return; }
    setErr(null); setBusy(kind);
    try {
      const folder = `applications/${unit.title.replace(/[^\w\- ]/g, "").replace(/\s+/g, "-").toLowerCase() || "home"}`;
      for (const f of list) {
        const fd = new FormData();
        fd.append("file", f);
        fd.append("location", folder);
        const res = await fetch("/api/client-data/files/upload", { method: "POST", body: fd });
        if (!res.ok) throw new Error(res.status === 401 ? "Your session ended. Sign in again to upload." : `Upload of ${f.name} failed.`);
        setDocs((d) => [...d, { kind, name: f.name, path: `${folder}/${f.name}` }]);
      }
    } catch (e: any) {
      setErr(e?.message || "Upload failed. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  const submit = () => {
    if (v("consent") !== "yes") { setErr("Tick the box to let us screen your application."); return; }
    setErr(null);
    start(async () => {
      const r = await applyAction(unit.id, a, docs.map((d) => `${d.kind}:${d.path}`));
      if (!r.ok) { setErr(r.error); return; }
      setSent(true);
      top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const Sum = (
    <aside className="pm-sum">
      <div className="pm-box">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {unit.images[0] && <img src={unit.images[0]} alt="" />}
        <span className="pm-kicker">You’re applying for</span>
        <h3 style={{ marginTop: 4 }}>{unit.title}</h3>
        <div className="pm-muted" style={{ fontSize: 14.5 }}>{homeTitle}</div>
        <dl>
          <dt>Rent</dt><dd>{money(unit.rent)} / mo</dd>
          <dt>Layout</dt><dd>{unit.type === "room" ? "Private room" : beds(unit.beds)}{unit.baths ? ` · ${unit.baths} ba` : ""}</dd>
          <dt>Move in</dt><dd>{availability(unit).replace("Available ", "")}</dd>
          <dt>Lease</dt><dd>{terms(unit.leaseTerms)}</dd>
        </dl>
        <p className="pm-muted" style={{ fontSize: 13.5, margin: 0 }}>{screeningNote}</p>
      </div>
    </aside>
  );

  if (sent) {
    return (
      <div className="pm-apply" ref={top} style={{ gridTemplateColumns: "minmax(0,1fr) 320px" }}>
        <div className="pm-form pm-done">
          <div className="tick"><Ic n="check" size={30} sw={2.2} /></div>
          <h2>Application sent</h2>
          <p className="pm-muted" style={{ maxWidth: "46ch", margin: "10px auto 26px" }}>
            We’ve got it, {v("firstName")}. The leasing team reads every application and replies within two business days. Watch for the screening email at {email}.
          </p>
          <div className="pm-track four" style={{ textAlign: "left", margin: "0 0 28px" }}>
            <div className="done">Sent</div><div>Screening</div><div>Decision</div><div>Lease &amp; keys</div>
          </div>
          <div className="pm-btn-row" style={{ justifyContent: "center" }}>
            <Link className="btn clay" href="/account/applications">Track your application</Link>
            <Link className="btn ghost" href="/homes">Keep browsing</Link>
          </div>
        </div>
        {Sum}
      </div>
    );
  }

  return (
    <div className="pm-apply" ref={top}>
      <ol className="pm-steps-nav">
        {STEPS.map((s, i) => (
          <li key={s} className={i === step ? "on" : i < step ? "done" : ""}>
            <i>{i < step ? <Ic n="check" size={14} sw={2.4} /> : i + 1}</i>{s}
          </li>
        ))}
      </ol>

      <div className="pm-form">
        <span className="pm-kicker">Step {step + 1} of {STEPS.length}</span>
        <h2 style={{ marginTop: 6 }}>{STEPS[step]}</h2>

        {step === 0 && (
          <>
            <p className="lead">Tell us who’s applying. Everyone over 18 who will live there applies separately with their own account.</p>
            <div className="pm-grid">
              <label className="pm-field"><span>First name</span><input value={v("firstName")} onChange={on("firstName")} autoComplete="given-name" /></label>
              <label className="pm-field"><span>Last name</span><input value={v("lastName")} onChange={on("lastName")} autoComplete="family-name" /></label>
              <label className="pm-field"><span>Email</span><input value={email} readOnly disabled /><small>From your account. We send updates here.</small></label>
              <label className="pm-field"><span>Mobile phone</span><input value={v("phone")} onChange={on("phone")} type="tel" autoComplete="tel" /></label>
              <label className="pm-field full"><span>Current address</span><input value={v("currentAddress")} onChange={on("currentAddress")} autoComplete="street-address" placeholder="Street, city, state, ZIP" /></label>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <p className="lead">When you’d like to move in, for how long, and who’s coming with you.</p>
            <div className="pm-grid">
              <label className="pm-field"><span>Move-in date</span><input type="date" value={v("moveIn")} onChange={on("moveIn")} min={unit.availableFrom || new Date().toISOString().slice(0, 10)} /></label>
              <label className="pm-field"><span>Lease length</span>
                <select value={v("leaseTerm")} onChange={on("leaseTerm")}>{unit.leaseTerms.map((m) => <option key={m} value={m}>{m} months</option>)}</select>
              </label>
              <label className="pm-field"><span>Adults (18+), including you</span><input type="number" min={1} max={8} value={v("adults")} onChange={on("adults")} /></label>
              <label className="pm-field"><span>Children</span><input type="number" min={0} max={8} value={v("children")} onChange={on("children")} /></label>
              <label className="pm-field full"><span>Other occupants <em>optional</em></span><input value={v("otherOccupants")} onChange={on("otherOccupants")} placeholder="Names of anyone else who’ll live with you" /></label>
              <div className="pm-field full"><span>Any pets?</span>{yn("pets")}</div>
              {v("pets") === "yes" && <label className="pm-field full"><span>About your pets</span><input value={v("petDetails")} onChange={on("petDetails")} placeholder="Kind, breed, weight — e.g. dog, beagle, 25 lb" /></label>}
              <label className="pm-field full"><span>Vehicles <em>optional</em></span><input value={v("vehicles")} onChange={on("vehicles")} placeholder="Make, model and plate, if you’ll park here" /></label>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <p className="lead">Most homes ask for household income of about three times the rent. Tell us what you earn now.</p>
            <div className="pm-grid">
              <label className="pm-field"><span>Employment</span>
                <select value={v("employmentStatus")} onChange={on("employmentStatus")}>
                  <option value="">Choose one</option>
                  {["Employed", "Self-employed", "Student", "Retired", "Not working", "Other"].map((o) => <option key={o}>{o}</option>)}
                </select>
              </label>
              <label className="pm-field"><span>Monthly income (before tax)</span><input type="number" min={0} step={50} inputMode="decimal" value={v("monthlyIncome")} onChange={on("monthlyIncome")} placeholder="e.g. 5200" /></label>
              <label className="pm-field"><span>Employer <em>optional</em></span><input value={v("employer")} onChange={on("employer")} autoComplete="organization" /></label>
              <label className="pm-field"><span>Job title <em>optional</em></span><input value={v("jobTitle")} onChange={on("jobTitle")} autoComplete="organization-title" /></label>
              <label className="pm-field"><span>Since <em>optional</em></span><input type="month" value={v("employedSince")} onChange={on("employedSince")} /></label>
              <label className="pm-field"><span>Other income <em>optional</em></span><input value={v("otherIncome")} onChange={on("otherIncome")} placeholder="Child support, benefits, a guarantor…" /></label>
            </div>
            {unit.rent != null && v("monthlyIncome") && Number(v("monthlyIncome")) < unit.rent * 3 && (
              <p className="pm-muted" style={{ marginTop: 16, fontSize: 14.5 }}>That’s under three times the rent. You can still apply: a guarantor, savings or a co-applicant often closes the gap. Tell us in “Other income”.</p>
            )}
          </>
        )}

        {step === 3 && (
          <>
            <p className="lead">We call your current landlord, so make sure the number’s right.</p>
            <div className="pm-grid">
              <label className="pm-field"><span>Current landlord <em>optional if you own or live with family</em></span><input value={v("currentLandlord")} onChange={on("currentLandlord")} /></label>
              <label className="pm-field"><span>Landlord phone <em>optional</em></span><input type="tel" value={v("landlordPhone")} onChange={on("landlordPhone")} /></label>
              <label className="pm-field"><span>Current rent <em>optional</em></span><input type="number" min={0} inputMode="decimal" value={v("currentRent")} onChange={on("currentRent")} /></label>
              <label className="pm-field"><span>Why you’re moving</span><input value={v("movingReason")} onChange={on("movingReason")} placeholder="e.g. new job, need more space" /></label>
              <div className="pm-field full"><span>Have you ever been evicted?</span>{yn("evicted")}</div>
              {v("evicted") === "yes" && <label className="pm-field full"><span>Tell us what happened <em>optional</em></span><textarea rows={3} value={v("evictionDetails")} onChange={on("evictionDetails")} /></label>}
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <p className="lead">PDF or photos, up to {MAX_MB} MB each. They go to your private documents; only our leasing team sees them.</p>
            <div style={{ display: "grid", gap: 14 }}>
              {[["id", "Photo ID", "Driver’s licence, state ID or passport", true], ["income", "Proof of income", "Two recent pay stubs, an offer letter or bank statements", false], ["other", "Anything else", "A reference letter, pet records, guarantor details", false]].map(([kind, title, hint, req]) => {
                const mine = docs.filter((d) => d.kind === kind);
                return (
                  <div className="pm-upl" key={kind as string}>
                    <div className="pm-upl-h">
                      <div><b>{title as string}{req ? "" : <em className="pm-muted" style={{ fontStyle: "normal", fontWeight: 500 }}> · optional</em>}</b><span>{hint as string}</span></div>
                      <label className="btn ghost xs" style={{ cursor: "pointer" }}>
                        <Ic n="upload" size={15} /> {busy === kind ? "Uploading…" : mine.length ? "Add another" : "Choose file"}
                        <input type="file" accept=".pdf,image/*" multiple hidden disabled={!!busy} onChange={(e) => { upload(kind as string, e.target.files); e.target.value = ""; }} />
                      </label>
                    </div>
                    {mine.length > 0 && (
                      <ul className="pm-files">
                        {mine.map((d) => <li key={d.path}><span><Ic n="doc" size={15} /> {d.name}</span><button type="button" onClick={() => setDocs((x) => x.filter((y) => y !== d))}>Remove</button></li>)}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {step === 5 && (
          <div className="pm-review">
            <p className="lead" style={{ margin: "8px 0 4px", color: "var(--muted)" }}>Check everything, then send. You can’t edit it after, but the leasing team can.</p>
            {[0, 1, 2, 3].map((s) => (
              <section key={s}>
                <h3>{STEPS[s]}<button type="button" onClick={() => go(s)}>Edit</button></h3>
                <dl>
                  {s === 0 && <><dt>Email</dt><dd>{email}</dd></>}
                  {Object.keys(LABEL).filter((k) => fieldStep(k) === s && v(k)).map((k) => (
                    <FragmentRow key={k} k={LABEL[k]} v={k === "monthlyIncome" || k === "currentRent" ? money(Number(v(k))) : k === "leaseTerm" ? `${v(k)} months` : v(k) === "yes" ? "Yes" : v(k) === "no" ? "No" : v(k)} />
                  ))}
                </dl>
              </section>
            ))}
            <section>
              <h3>Documents<button type="button" onClick={() => go(4)}>Edit</button></h3>
              <dl>{docs.length ? docs.map((d) => <FragmentRow key={d.path} k={d.kind === "id" ? "Photo ID" : d.kind === "income" ? "Income" : "Other"} v={d.name} />) : <FragmentRow k="Files" v="None" />}</dl>
            </section>
            <label className="pm-consent">
              <input type="checkbox" checked={v("consent") === "yes"} onChange={(e) => setA((x) => ({ ...x, consent: e.target.checked ? "yes" : "" }))} />
              <span>I confirm this is true and complete, and I authorise {homeTitle}’s leasing team and its screening partner to check my credit, rental and criminal history and to contact my landlord and employer. {screeningNote}</span>
            </label>
          </div>
        )}

        {err && <p className="pm-err" role="alert" style={{ marginTop: 18 }}>{err}</p>}

        <div className="pm-form-foot">
          {step > 0 ? <button type="button" className="btn ghost sm" onClick={() => go(step - 1)}><Ic n="back" size={16} /> Back</button> : <Link className="btn ghost sm" href={`/homes/${unit.id}`}>Cancel</Link>}
          {step < STEPS.length - 1
            ? <button type="button" className="btn clay sm" onClick={next} disabled={!!busy}>Continue <Ic n="arrow" size={16} /></button>
            : <button type="button" className="btn clay sm" onClick={submit} disabled={pending}>{pending ? "Sending…" : "Send application"}</button>}
        </div>
        {step === 0 && (
          <div className="pm-box" style={{ marginTop: 22, boxShadow: "none", background: "var(--bg-2)", border: 0 }}>
            <h3 style={{ fontSize: 16 }}>Have these ready</h3>
            <ul>{checklist.map((c) => <li key={c}>{c}</li>)}</ul>
          </div>
        )}
      </div>

      {Sum}
    </div>
  );
}

function fieldStep(k: string): number {
  if (["firstName", "lastName", "phone", "currentAddress"].includes(k)) return 0;
  if (["moveIn", "leaseTerm", "adults", "children", "otherOccupants", "pets", "petDetails", "vehicles"].includes(k)) return 1;
  if (["employmentStatus", "employer", "jobTitle", "monthlyIncome", "employedSince", "otherIncome"].includes(k)) return 2;
  return 3;
}

function FragmentRow({ k, v }: { k: string; v: string }) {
  return <><dt>{k}</dt><dd>{v}</dd></>;
}
