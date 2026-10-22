"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { applyAction } from "../actions/property";
import type { Unit } from "../lib/types";
import { availability, money, psf, unitSize, yearsTerms } from "../lib/format";
import { Ic } from "./icons";

type A = Record<string, string>;
interface Doc { kind: string; name: string; path: string }

const STEPS = ["Your business", "The space", "Financials", "Documents", "Review & send"];
const MAX_MB = 25;

const REQUIRED: Record<number, string[]> = {
  0: ["companyName", "entityType", "firstName", "lastName", "signerTitle", "phone"],
  1: ["moveIn", "leaseTerm", "use", "headcount"],
  2: ["yearsInBusiness", "annualRevenue", "guarantor"],
};
const LABEL: Record<string, string> = {
  companyName: "Company legal name", dba: "Trading as", entityType: "Entity type", stateOfFormation: "State of formation", website: "Website",
  firstName: "Signer first name", lastName: "Signer last name", signerTitle: "Signer title", phone: "Phone",
  moveIn: "Target occupancy", leaseTerm: "Lease term", use: "How you’ll use the space", headcount: "People on site", hours: "Hours of operation",
  buildOut: "Build-out needs", needs: "Power, venting, deliveries", currentLocation: "Where you operate now",
  yearsInBusiness: "Years in business", annualRevenue: "Annual revenue", guarantor: "Personal guarantee", guarantorName: "Guarantor",
  bankName: "Bank", currentLandlord: "Current landlord", landlordPhone: "Landlord phone",
};
const STEP_OF: Record<string, number> = Object.fromEntries(Object.entries({
  0: ["companyName", "dba", "entityType", "stateOfFormation", "website", "firstName", "lastName", "signerTitle", "phone"],
  1: ["moveIn", "leaseTerm", "use", "headcount", "hours", "buildOut", "needs", "currentLocation"],
  2: ["yearsInBusiness", "annualRevenue", "guarantor", "guarantorName", "bankName", "currentLandlord", "landlordPhone"],
}).flatMap(([s, ks]) => ks.map((k) => [k, Number(s)])));

const DOCS: [kind: string, title: string, hint: string, required: boolean][] = [
  ["financials", "Financial statements", "Two years of P&L and balance sheet or business tax returns. New company? A business plan with projections.", true],
  ["formation", "Formation documents", "Articles or certificate of formation, or a certificate of good standing", false],
  ["id", "Signer’s photo ID", "Driver’s licence or passport for whoever signs or guarantees", false],
  ["other", "Anything else", "Menu or concept deck, floor plan sketch, references", false],
];

/** The commercial lease application: who the tenant is, what they need from the space,
 *  whether they can carry the rent, then documents. Sent to the commercial form. */
export function LeaseApplyFlow({ unit, homeTitle, email, first, last, phone, checklist, note }: {
  unit: Unit; homeTitle: string; email: string; first?: string; last?: string; phone?: string; checklist: string[]; note: string;
}) {
  const terms = unit.leaseTerms.length ? unit.leaseTerms : [36, 60];
  const [step, setStep] = useState(0);
  const [a, setA] = useState<A>({
    firstName: first || "", lastName: last || "", phone: phone || "",
    leaseTerm: String(terms.includes(60) ? 60 : terms[0]),
    moveIn: unit.availableFrom && unit.availableFrom > new Date().toISOString().slice(0, 10) ? unit.availableFrom : "",
  });
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
    if (step === 2 && v("guarantor") === "yes" && !v("guarantorName").trim()) missing.push("guarantorName");
    if (missing.length) { setErr(`Please fill in: ${missing.map((k) => LABEL[k] || k).join(", ")}.`); return; }
    if (step === 3 && !docs.some((d) => d.kind === "financials")) { setErr("Add your financial statements, tax returns or business plan to continue."); return; }
    go(step + 1);
  };

  async function upload(kind: string, files: FileList | null) {
    if (!files?.length) return;
    const list = Array.from(files);
    const big = list.find((f) => f.size > MAX_MB * 1024 * 1024);
    if (big) { setErr(`${big.name} is over ${MAX_MB} MB.`); return; }
    setErr(null); setBusy(kind);
    try {
      const folder = `applications/${`${homeTitle}-${unit.title}`.replace(/[^\w\- ]/g, "").replace(/\s+/g, "-").toLowerCase() || "space"}`;
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
    if (v("consent") !== "yes") { setErr("Tick the box to let us review your application."); return; }
    setErr(null);
    start(async () => {
      const r = await applyAction(unit.id, a, docs.map((d) => `${d.kind}:${d.path}`));
      if (!r.ok) { setErr(r.error); return; }
      setSent(true);
      top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const shown = (k: string) => {
    const x = v(k);
    if (k === "annualRevenue") return money(Number(x));
    if (k === "leaseTerm") return yearsTerms([Number(x)]);
    if (k === "guarantor") return x === "yes" ? "Yes" : "No";
    return x;
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
          <dt>Rate</dt><dd>{psf(unit.ratePsf)}{unit.leaseType ? ` ${unit.leaseType}` : ""}</dd>
          <dt>Size</dt><dd>{unitSize(unit)}</dd>
          {unit.rent != null && <><dt>Base rent</dt><dd>{money(unit.rent)} / mo</dd></>}
          <dt>Available</dt><dd>{availability(unit).replace("Available ", "")}</dd>
          <dt>Term</dt><dd>{yearsTerms(terms)}</dd>
        </dl>
        <p className="pm-muted" style={{ fontSize: 13.5, margin: 0 }}>{note}</p>
      </div>
    </aside>
  );

  if (sent) {
    return (
      <div className="pm-apply" ref={top} style={{ gridTemplateColumns: "minmax(0,1fr) 320px" }}>
        <div className="pm-form pm-done">
          <div className="tick"><Ic n="check" size={30} sw={2.2} /></div>
          <h2>Application sent</h2>
          <p className="pm-muted" style={{ maxWidth: "48ch", margin: "10px auto 26px" }}>
            Thanks, {v("firstName")}. Our leasing team reviews {v("companyName") || "your company"}’s application within two business days and will email {email} to set up a tour and talk terms.
          </p>
          <div className="pm-track four" style={{ textAlign: "left", margin: "0 0 28px" }}>
            <div className="done">Sent</div><div>Credit review</div><div>Letter of intent</div><div>Lease &amp; keys</div>
          </div>
          <div className="pm-btn-row" style={{ justifyContent: "center" }}>
            <Link className="btn clay" href="/account/applications">Track your application</Link>
            <Link className="btn ghost" href="/commercial">Keep browsing</Link>
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
            <p className="lead">The company that will sign the lease, and the person signing for it.</p>
            <div className="pm-grid">
              <label className="pm-field full"><span>Company legal name</span><input value={v("companyName")} onChange={on("companyName")} autoComplete="organization" placeholder="As registered with the state" /></label>
              <label className="pm-field"><span>Trading as <em>optional</em></span><input value={v("dba")} onChange={on("dba")} placeholder="The name on the door" /></label>
              <label className="pm-field"><span>Entity type</span>
                <select value={v("entityType")} onChange={on("entityType")}>
                  <option value="">Choose one</option>
                  {["LLC", "Corporation", "Partnership", "Sole proprietor", "Nonprofit", "Other"].map((o) => <option key={o}>{o}</option>)}
                </select>
              </label>
              <label className="pm-field"><span>State of formation <em>optional</em></span><input value={v("stateOfFormation")} onChange={on("stateOfFormation")} placeholder="e.g. Texas" /></label>
              <label className="pm-field"><span>Website <em>optional</em></span><input value={v("website")} onChange={on("website")} type="url" placeholder="https://" /></label>
              <label className="pm-field"><span>Signer first name</span><input value={v("firstName")} onChange={on("firstName")} autoComplete="given-name" /></label>
              <label className="pm-field"><span>Signer last name</span><input value={v("lastName")} onChange={on("lastName")} autoComplete="family-name" /></label>
              <label className="pm-field"><span>Signer title</span><input value={v("signerTitle")} onChange={on("signerTitle")} autoComplete="organization-title" placeholder="e.g. Owner, CEO, Managing member" /></label>
              <label className="pm-field"><span>Phone</span><input value={v("phone")} onChange={on("phone")} type="tel" autoComplete="tel" /></label>
              <label className="pm-field full"><span>Email</span><input value={email} readOnly disabled /><small>From your account. We send updates and the letter of intent here.</small></label>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <p className="lead">What you’ll do in {unit.title} and when you need it. This is how we check the space and zoning fit before anyone spends money on a build-out.</p>
            <div className="pm-grid">
              <label className="pm-field"><span>Target occupancy</span><input type="date" value={v("moveIn")} onChange={on("moveIn")} min={unit.availableFrom || new Date().toISOString().slice(0, 10)} /></label>
              <label className="pm-field"><span>Lease term</span>
                <select value={v("leaseTerm")} onChange={on("leaseTerm")}>{terms.map((m) => <option key={m} value={m}>{yearsTerms([m])}</option>)}</select>
              </label>
              <label className="pm-field full"><span>How you’ll use the space</span><input value={v("use")} onChange={on("use")} placeholder="e.g. coffee shop with seating for 30, architecture studio, e-commerce fulfilment" /></label>
              <label className="pm-field"><span>People on site</span><input type="number" min={1} value={v("headcount")} onChange={on("headcount")} placeholder="Staff on a normal day" /></label>
              <label className="pm-field"><span>Hours of operation <em>optional</em></span><input value={v("hours")} onChange={on("hours")} placeholder="e.g. Mon–Sat 7am–9pm" /></label>
              <label className="pm-field full"><span>Build-out needs <em>optional</em></span><input value={v("buildOut")} onChange={on("buildOut")} placeholder="Take as-is, or what you’d change: walls, kitchen, restrooms, finishes" /></label>
              <label className="pm-field full"><span>Power, venting, deliveries <em>optional</em></span><textarea rows={3} value={v("needs")} onChange={on("needs")} placeholder="Three-phase power, a hood or grease trap, dock or box-truck deliveries, signage, after-hours access" /></label>
              <label className="pm-field full"><span>Where you operate now <em>optional</em></span><input value={v("currentLocation")} onChange={on("currentLocation")} placeholder="Address, or ‘new business’" /></label>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <p className="lead">Enough to judge whether the business can carry the rent. Your statements in the next step back these up.</p>
            <div className="pm-grid">
              <label className="pm-field"><span>Years in business</span>
                <select value={v("yearsInBusiness")} onChange={on("yearsInBusiness")}>
                  <option value="">Choose one</option>
                  {["New business", "Under 2 years", "2–5 years", "5–10 years", "Over 10 years"].map((o) => <option key={o}>{o}</option>)}
                </select>
              </label>
              <label className="pm-field"><span>Annual revenue</span><input type="number" min={0} step={1000} inputMode="decimal" value={v("annualRevenue")} onChange={on("annualRevenue")} placeholder="Last year, or projected" /></label>
              <div className="pm-field full"><span>Will an owner personally guarantee the lease?</span>{yn("guarantor")}</div>
              {v("guarantor") === "yes" && <label className="pm-field full"><span>Guarantor</span><input value={v("guarantorName")} onChange={on("guarantorName")} placeholder="Full name and relationship to the company" /></label>}
              <label className="pm-field"><span>Bank <em>optional</em></span><input value={v("bankName")} onChange={on("bankName")} /></label>
              <label className="pm-field"><span>Current landlord <em>optional</em></span><input value={v("currentLandlord")} onChange={on("currentLandlord")} /></label>
              <label className="pm-field"><span>Landlord phone <em>optional</em></span><input type="tel" value={v("landlordPhone")} onChange={on("landlordPhone")} /></label>
            </div>
            {unit.rent != null && v("annualRevenue") && Number(v("annualRevenue")) < unit.rent * 12 * 8 && (
              <p className="pm-muted" style={{ marginTop: 16, fontSize: 14.5 }}>Rent would be a large share of that revenue. You can still apply: a personal guarantee, a larger deposit or a shorter first term often makes it work.</p>
            )}
          </>
        )}

        {step === 3 && (
          <>
            <p className="lead">PDF or photos, up to {MAX_MB} MB each. They go to your company’s private documents; only our leasing team sees them.</p>
            <div style={{ display: "grid", gap: 14 }}>
              {DOCS.map(([kind, title, hint, req]) => {
                const mine = docs.filter((d) => d.kind === kind);
                return (
                  <div className="pm-upl" key={kind}>
                    <div className="pm-upl-h">
                      <div><b>{title}{req ? "" : <em className="pm-muted" style={{ fontStyle: "normal", fontWeight: 500 }}> · optional</em>}</b><span>{hint}</span></div>
                      <label className="btn ghost xs" style={{ cursor: "pointer" }}>
                        <Ic n="upload" size={15} /> {busy === kind ? "Uploading…" : mine.length ? "Add another" : "Choose file"}
                        <input type="file" accept=".pdf,image/*" multiple hidden disabled={!!busy} onChange={(e) => { upload(kind, e.target.files); e.target.value = ""; }} />
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

        {step === 4 && (
          <div className="pm-review">
            <p className="lead" style={{ margin: "8px 0 4px", color: "var(--muted)" }}>Check everything, then send. Nothing here is binding: if it’s a fit we send a letter of intent before any lease.</p>
            {[0, 1, 2].map((s) => (
              <section key={s}>
                <h3>{STEPS[s]}<button type="button" onClick={() => go(s)}>Edit</button></h3>
                <dl>
                  {s === 0 && <><dt>Email</dt><dd>{email}</dd></>}
                  {Object.keys(LABEL).filter((k) => STEP_OF[k] === s && v(k)).map((k) => <Row key={k} k={LABEL[k]} v={shown(k)} />)}
                </dl>
              </section>
            ))}
            <section>
              <h3>Documents<button type="button" onClick={() => go(3)}>Edit</button></h3>
              <dl>{docs.length ? docs.map((d) => <Row key={d.path} k={DOCS.find((x) => x[0] === d.kind)?.[1] || "Other"} v={d.name} />) : <Row k="Files" v="None" />}</dl>
            </section>
            <label className="pm-consent">
              <input type="checkbox" checked={v("consent") === "yes"} onChange={(e) => setA((x) => ({ ...x, consent: e.target.checked ? "yes" : "" }))} />
              <span>I’m authorised to apply for {v("companyName") || "this company"}. This is true and complete, and I agree that {homeTitle}’s leasing team may run a business credit check, contact our bank and landlord and, if a guarantee is offered, check the guarantor’s credit.</span>
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

function Row({ k, v }: { k: string; v: string }) {
  return <><dt>{k}</dt><dd>{v}</dd></>;
}
