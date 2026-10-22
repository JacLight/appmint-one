"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { attachIdentityFileAction, submitIdentityAction } from "../actions/banking";
import type { IdentityDocType, IdentityFileKind, IdentityInput, IdentityStatus, IdentityView, ProofOfAddressType } from "../api/types";
import { fmtDate } from "../lib/format";
import { Icon } from "./icons";

const DOC_LABEL: Record<IdentityDocType, string> = {
  drivers_license: "Driver’s license", passport: "Passport", national_id: "National ID card", residence_permit: "Permanent resident card",
  military_id: "Military ID", visa: "Visa", voter_id: "Voter ID", other: "Other government ID",
};
const DOC_CHOICES: IdentityDocType[] = ["drivers_license", "passport", "national_id", "residence_permit", "military_id", "other"];
const PROOF_LABEL: Record<ProofOfAddressType, string> = {
  utility_bill: "Utility bill", bank_statement: "Bank statement", lease_agreement: "Lease", tax_document: "Tax document", government_letter: "Government letter", other: "Other",
};

/** What each status reads as at the top of the page. */
const HEAD: Record<IdentityStatus, { title: string; icon: string; tone: "todo" | "wait" | "ok" | "bad" }> = {
  not_started: { title: "Verify your identity", icon: "shield", tone: "todo" },
  submitted: { title: "Your details are with us", icon: "clock", tone: "wait" },
  in_review: { title: "We’re checking your details", icon: "clock", tone: "wait" },
  needs_info: { title: "We need something more", icon: "alert", tone: "todo" },
  verified: { title: "You’re verified", icon: "shieldOk", tone: "ok" },
  rejected: { title: "We couldn’t verify you", icon: "alert", tone: "bad" },
};

const MAX_MB = 10;
const dateLimits = () => {
  const t = new Date();
  const adult = new Date(t.getFullYear() - 18, t.getMonth(), t.getDate());
  const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { adult: ymd(adult), tomorrow: ymd(new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1)) };
};
const isUS = (c?: string | null) => !c || /^(us|usa|united states)$/i.test(c.trim());

/**
 * The customer's identity check (the bank's Customer Identification Program). Status first,
 * then what's still needed, then the details and the photos. The bank decides; this page only
 * collects and shows the customer what they may see. The taxpayer ID is typed, sent once and
 * only ever read back as its last 4.
 */
export function IdentityCenter({ initial, support }: { initial: IdentityView; support: string }) {
  const [view, setView] = useState(initial);
  const d = view.details;
  const doc = d.identityDocuments.find((x) => x.documentType) || null;
  const [editing, setEditing] = useState(view.status === "not_started" || view.status === "needs_info");
  const [docOpen, setDocOpen] = useState(!doc || doc.expired);
  const [f, setF] = useState({
    firstName: d.firstName || "", middleName: d.middleName || "", lastName: d.lastName || "", dateOfBirth: d.dateOfBirth || "",
    usPerson: isUS(d.nationality) ? "yes" : "no", nationality: isUS(d.nationality) ? "" : d.nationality || "",
    street1: d.address.street1 || "", street2: d.address.street2 || "", city: d.address.city || "", state: d.address.state || "",
    postalCode: d.address.postalCode || "", country: d.address.country || "United States",
    taxId: "", documentType: (doc?.documentType || "drivers_license") as IdentityDocType, documentNumber: "",
    issuingCountry: doc?.issuingCountry || "United States", issuingAuthority: doc?.issuingAuthority || "", issueDate: doc?.issueDate || "", expiryDate: "",
  });
  const [showTin, setShowTin] = useState(false);
  // Date bounds for the pickers, fixed when the page opens (18 years ago; tomorrow).
  const [limits] = useState(dateLimits);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const head = HEAD[view.status];
  const verified = view.status === "verified";
  const sent = view.status !== "not_started";

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((x) => ({ ...x, [k]: e.target.value }));

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null); setNote(null);
    const tin = f.taxId.replace(/[\s-]/g, "");
    if (tin && !/^\d{9}$/.test(tin)) { setErr("Your Social Security number or ITIN is 9 digits."); return; }
    if (!d.tinOnFile && !tin && f.usPerson === "yes") { setErr("Enter your Social Security number or ITIN."); return; }
    const input: IdentityInput = {
      firstName: f.firstName, middleName: f.middleName, lastName: f.lastName, dateOfBirth: f.dateOfBirth,
      nationality: f.usPerson === "yes" ? "United States" : f.nationality,
      address: { street1: f.street1, street2: f.street2, city: f.city, state: f.state, postalCode: f.postalCode, country: f.country },
      ...(tin ? { taxId: tin } : {}),
      ...(docOpen ? { identityDocument: { documentType: f.documentType, documentNumber: f.documentNumber.trim(), issuingCountry: f.issuingCountry, issuingAuthority: f.issuingAuthority || undefined, issueDate: f.issueDate || undefined, expiryDate: f.expiryDate } } : {}),
    };
    start(async () => {
      const r = await submitIdentityAction(input);
      if (!r.ok) { setErr(r.error); return; }
      setView(r.data);
      setF((x) => ({ ...x, taxId: "", documentNumber: "", expiryDate: "" }));
      setShowTin(false);
      setDocOpen(false);
      setEditing(false);
      setNote(r.data.changeRequest?.message || (sent ? "Saved. We’ll review your changes." : "Sent. Now add photos of your ID below; they speed up the review."));
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  return (
    <div className="mn-grid-main mn-id">
      <div className="mn-id-main">
        <section className={`mn-panel mn-id-status ${head.tone}`}>
          <span className="mn-id-ic"><Icon name={head.icon as any} size={26} /></span>
          <div>
            <h2>{head.title}</h2>
            <p>{view.statusText}</p>
            {(view.submittedAt || view.verifiedAt) && (
              <p className="mn-muted mn-id-when">
                {view.verifiedAt ? `Verified ${fmtDate(view.verifiedAt, { month: "long", day: "numeric", year: "numeric" })}` : `Sent ${fmtDate(view.submittedAt!, { month: "long", day: "numeric", year: "numeric" })}`}
              </p>
            )}
          </div>
          <ol className="mn-id-track" aria-label="Progress">
            <li className={sent ? "done" : "on"}>Your details</li>
            <li className={verified || view.status === "rejected" ? "done" : sent ? "on" : ""}>Bank review</li>
            <li className={verified ? "done" : ""}>{view.status === "rejected" ? "Not verified" : "Verified"}</li>
          </ol>
        </section>

        {view.requestedInfo && (
          <div className="mn-id-ask" role="note">
            <Icon name="mail" size={18} />
            <div><b>The bank asked{view.requestedInfo.at ? ` on ${fmtDate(view.requestedInfo.at)}` : ""}</b><p>{view.requestedInfo.message || "Check the details below and send them again."}</p></div>
          </div>
        )}
        {note && <div className="mn-notice" role="status"><Icon name="check" size={16} />{note}</div>}

        {view.status === "rejected" ? (
          <section className="mn-panel">
            <p style={{ margin: 0 }}>Changes can’t be sent online now. Talk to us and we’ll go through what we need.</p>
            <div className="mn-actions" style={{ justifyContent: "flex-start" }}><Link className="btn clay sm" href={support}>Contact the bank</Link></div>
          </section>
        ) : editing ? (
          <form className="mn-panel mn-id-form" onSubmit={save} noValidate>
            {verified && <div className="mn-notice" style={{ marginTop: 0, marginBottom: 18 }}><Icon name="info" size={16} />You’re already verified, so changes go to the bank as a request. Your verified details stay until the bank updates them.</div>}

            <fieldset>
              <h3 className="mn-id-h">Legal name and birth date</h3>
              <p className="mn-muted">Exactly as on your ID.</p>
              <div className="mn-row3">
                <div className="mn-field"><label htmlFor="id-fn">First name</label><input id="id-fn" value={f.firstName} onChange={set("firstName")} autoComplete="given-name" required /></div>
                <div className="mn-field"><label htmlFor="id-mn">Middle name <em>optional</em></label><input id="id-mn" value={f.middleName} onChange={set("middleName")} autoComplete="additional-name" /></div>
                <div className="mn-field"><label htmlFor="id-ln">Last name</label><input id="id-ln" value={f.lastName} onChange={set("lastName")} autoComplete="family-name" required /></div>
              </div>
              <div className="mn-row2">
                <div className="mn-field"><label htmlFor="id-dob">Date of birth</label><input id="id-dob" type="date" value={f.dateOfBirth} onChange={set("dateOfBirth")} autoComplete="bday" max={limits.adult} required /></div>
                <div className="mn-field"><label htmlFor="id-us">US citizen or resident?</label>
                  <select id="id-us" value={f.usPerson} onChange={set("usPerson")}><option value="yes">Yes</option><option value="no">No</option></select>
                </div>
              </div>
              {f.usPerson === "no" && <div className="mn-field"><label htmlFor="id-nat">Nationality</label><input id="id-nat" value={f.nationality} onChange={set("nationality")} placeholder="Country of citizenship" /></div>}
            </fieldset>

            <fieldset>
              <h3 className="mn-id-h">Home address</h3>
              <p className="mn-muted">Where you live. A PO box can’t be used.</p>
              <div className="mn-field"><label htmlFor="id-s1">Street address</label><input id="id-s1" value={f.street1} onChange={set("street1")} autoComplete="address-line1" required /></div>
              <div className="mn-field"><label htmlFor="id-s2">Apartment, suite <em>optional</em></label><input id="id-s2" value={f.street2} onChange={set("street2")} autoComplete="address-line2" /></div>
              <div className="mn-row3">
                <div className="mn-field"><label htmlFor="id-city">City</label><input id="id-city" value={f.city} onChange={set("city")} autoComplete="address-level2" required /></div>
                <div className="mn-field"><label htmlFor="id-st">State</label><input id="id-st" value={f.state} onChange={set("state")} autoComplete="address-level1" placeholder="TX" maxLength={30} /></div>
                <div className="mn-field"><label htmlFor="id-zip">ZIP code</label><input id="id-zip" value={f.postalCode} onChange={set("postalCode")} autoComplete="postal-code" inputMode="numeric" required /></div>
              </div>
              <div className="mn-field"><label htmlFor="id-ctry">Country</label><input id="id-ctry" value={f.country} onChange={set("country")} autoComplete="country-name" /></div>
            </fieldset>

            <fieldset>
              <h3 className="mn-id-h">Taxpayer ID</h3>
              <div className="mn-field">
                <label htmlFor="id-tin">Social Security number or ITIN{d.tinOnFile ? <em> optional</em> : f.usPerson === "no" ? <em> if you have one</em> : null}</label>
                <div className="mn-id-tin">
                  <input id="id-tin" type={showTin ? "text" : "password"} value={f.taxId} onChange={set("taxId")} inputMode="numeric" autoComplete="off" spellCheck={false} placeholder={d.tinOnFile ? `On file, ending ${d.tinLast4 || "••••"}` : "123-45-6789"} maxLength={11} />
                  <button type="button" className="mn-id-eye" onClick={() => setShowTin((s) => !s)} aria-label={showTin ? "Hide number" : "Show number"}><Icon name={showTin ? "eyeOff" : "eye"} size={18} /></button>
                </div>
                <span className="hint">{d.tinOnFile ? "Leave blank to keep the one on file." : "Federal law requires it to open an account. It’s encrypted; we only ever show the last 4."}{f.usPerson === "no" && !d.tinOnFile ? " Without one, your passport or national ID below is used instead." : ""}</span>
              </div>
            </fieldset>

            <fieldset>
              <h3 className="mn-id-h">Identity document</h3>
              {doc && !docOpen ? (
                <div className="mn-id-doc">
                  <Icon name="card" size={20} />
                  <span><b>{DOC_LABEL[doc.documentType!]} {doc.documentNumber}</b><span className="mn-muted">{[doc.issuingAuthority, doc.issuingCountry].filter(Boolean).join(", ")}{doc.expiryDate ? ` · expires ${fmtDate(doc.expiryDate, { month: "short", year: "numeric" })}` : ""}</span></span>
                  <button type="button" className="mn-link" onClick={() => setDocOpen(true)}>Use a different ID</button>
                </div>
              ) : (
                <>
                  {doc?.expired && <p className="mn-formerr"><Icon name="alert" size={16} />The ID on file has expired. Add a current one.</p>}
                  <div className="mn-row2">
                    <div className="mn-field"><label htmlFor="id-dt">Type</label>
                      <select id="id-dt" value={f.documentType} onChange={set("documentType")}>{DOC_CHOICES.map((t) => <option key={t} value={t}>{DOC_LABEL[t]}</option>)}</select>
                    </div>
                    <div className="mn-field"><label htmlFor="id-dn">Number</label><input id="id-dn" value={f.documentNumber} onChange={set("documentNumber")} autoComplete="off" spellCheck={false} required /></div>
                  </div>
                  <div className="mn-row2">
                    <div className="mn-field"><label htmlFor="id-ic">Issuing country</label><input id="id-ic" value={f.issuingCountry} onChange={set("issuingCountry")} /></div>
                    <div className="mn-field"><label htmlFor="id-ia">{f.documentType === "drivers_license" ? "Issuing state" : "Issued by"} <em>{f.documentType === "drivers_license" ? "" : "optional"}</em></label><input id="id-ia" value={f.issuingAuthority} onChange={set("issuingAuthority")} placeholder={f.documentType === "drivers_license" ? "e.g. Texas" : ""} /></div>
                  </div>
                  <div className="mn-row2">
                    <div className="mn-field"><label htmlFor="id-id">Issue date <em>optional</em></label><input id="id-id" type="date" value={f.issueDate} onChange={set("issueDate")} /></div>
                    <div className="mn-field"><label htmlFor="id-ed">Expiry date</label><input id="id-ed" type="date" value={f.expiryDate} onChange={set("expiryDate")} min={limits.tomorrow} required /></div>
                  </div>
                  {doc && <button type="button" className="mn-link" onClick={() => setDocOpen(false)}>Keep the ID on file</button>}
                </>
              )}
            </fieldset>

            {err && <p className="mn-formerr" role="alert"><Icon name="alert" size={16} />{err}</p>}
            <div className="mn-actions">
              {sent && <button type="button" className="btn ghost sm" onClick={() => { setEditing(false); setErr(null); }}>Cancel</button>}
              <button type="submit" className="btn clay sm" disabled={pending}>{pending ? "Sending…" : verified ? "Send change request" : sent ? "Save and send" : "Send for review"}</button>
            </div>
            <p className="mn-secure"><Icon name="lock" size={14} />Encrypted in transit and at rest. Only the bank’s verification team sees it.</p>
          </form>
        ) : (
          <section className="mn-panel">
            <div className="mn-panel-hd"><span>Your details</span>{view.canEdit || verified ? <button type="button" className="mn-link" onClick={() => { setEditing(true); setNote(null); }}>{verified ? "Request a change" : "Edit"}</button> : null}</div>
            <dl className="mn-dl">
              <dt>Legal name</dt><dd>{[d.firstName, d.middleName, d.lastName].filter(Boolean).join(" ") || "—"}</dd>
              <dt>Date of birth</dt><dd>{d.dateOfBirth ? fmtDate(d.dateOfBirth, { month: "long", day: "numeric", year: "numeric" }) : "—"}</dd>
              <dt>Home address</dt><dd>{[d.address.street1, d.address.street2, d.address.city, [d.address.state, d.address.postalCode].filter(Boolean).join(" "), isUS(d.address.country) ? "" : d.address.country].filter(Boolean).join(", ") || "—"}</dd>
              <dt>Taxpayer ID</dt><dd className="mono">{d.tinOnFile ? `•••-••-${d.tinLast4 || "••••"}` : "—"}</dd>
              <dt>ID</dt><dd>{doc ? `${DOC_LABEL[doc.documentType!]} ${doc.documentNumber || ""}${doc.expiryDate ? ` · exp. ${fmtDate(doc.expiryDate, { month: "short", year: "numeric" })}` : ""}` : "—"}</dd>
            </dl>
          </section>
        )}

        {sent && view.status !== "rejected" && <Photos view={view} onChange={setView} />}
      </div>

      <aside className="mn-side">
        {!verified && view.status !== "rejected" && (
          <section className="mn-panel">
            <div className="mn-panel-hd"><span>{view.missing.length ? "Still needed" : "Nothing missing"}</span></div>
            {view.missing.length ? (
              <ul className="mn-id-list">{view.missing.map((m) => <li key={m}><i />{m}</li>)}</ul>
            ) : <p className="mn-muted" style={{ margin: 0, fontSize: 14 }}>The bank has everything it needs. Most checks finish within one business day.</p>}
          </section>
        )}

        {view.accountsWaiting.length > 0 && (
          <section className="mn-panel">
            <div className="mn-panel-hd"><span>Waiting to open</span></div>
            <ul className="mn-id-acc">
              {view.accountsWaiting.map((a) => (
                <li key={a.sk}>
                  <span className="mn-acc-ic checking"><Icon name="bank" size={16} /></span>
                  <span><b>{a.nickname || (a.kind ? `${a.kind[0].toUpperCase()}${a.kind.slice(1)} account` : "New account")}{a.accountNumber ? ` ${a.accountNumber}` : ""}</b>
                    <span className="mn-muted">{a.gaps.length ? a.gaps[0] : "Opens as soon as you’re verified."}</span></span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {view.changeRequests.length > 0 && (
          <section className="mn-panel">
            <div className="mn-panel-hd"><span>Change requests</span></div>
            <ul className="mn-id-acc">
              {view.changeRequests.map((c, i) => (
                <li key={i}><span className={`mn-chip ${c.done ? "s-completed" : "s-pending"}`}>{c.done ? "Done" : "With the bank"}</span><span><span className="mn-muted">{fmtDate(c.at)}</span> {c.details}</span></li>
              ))}
            </ul>
          </section>
        )}

        <section className="mn-panel mn-id-why">
          <div className="mn-panel-hd"><span>Why we ask</span></div>
          <p>US law requires every bank to confirm who it opens accounts for, so we check your name, birth date, address and taxpayer ID against your ID.</p>
          <p>We only use it to verify you and meet those rules. You’ll never be asked for it by phone or email.</p>
          <Link className="mn-link" href={support}>Questions? Contact us</Link>
        </section>
      </aside>
    </div>
  );
}

/** Photos of the ID, proof of address and a selfie: uploaded to the customer's own files, then attached. */
function Photos({ view, onChange }: { view: IdentityView; onChange: (v: IdentityView) => void }) {
  const d = view.details;
  const doc = d.identityDocuments.find((x) => x.documentType) || null;
  const [busy, setBusy] = useState<IdentityFileKind | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [proofType, setProofType] = useState<ProofOfAddressType>("utility_bill");
  const locked = view.status === "verified";

  async function upload(kind: IdentityFileKind, files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (file.size > MAX_MB * 1024 * 1024) { setErr(`${file.name} is over ${MAX_MB} MB.`); return; }
    setErr(null); setBusy(kind);
    try {
      const name = `${kind}-${file.lastModified}-${file.size}.${(file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "")}`;
      const fd = new FormData();
      fd.append("file", new File([file], name, { type: file.type }));
      fd.append("location", "identity");
      const res = await fetch("/api/client-data/files/upload", { method: "POST", body: fd });
      if (!res.ok) throw new Error(res.status === 401 ? "Your session ended. Sign in again to upload." : "The upload didn’t go through. Try again.");
      const r = await attachIdentityFileAction({ kind, path: `identity/${name}`, ...(kind.startsWith("id_") && doc?.documentType ? { documentType: doc.documentType } : {}), ...(kind === "proof_of_address" ? { proofType } : {}) });
      if (!r.ok) throw new Error(r.error);
      onChange(r.data);
    } catch (e: any) {
      setErr(e?.message || "The upload didn’t go through. Try again.");
    } finally {
      setBusy(null);
    }
  }

  const tiles: { kind: IdentityFileKind; title: string; hint: string; done: boolean; capture?: "user"; hide?: boolean }[] = [
    { kind: "id_front", title: "Front of your ID", hint: "All four corners in frame, no glare.", done: !!doc?.front },
    { kind: "id_back", title: "Back of your ID", hint: "Skip this for a passport.", done: !!doc?.back, hide: doc?.documentType === "passport" },
    { kind: "proof_of_address", title: "Proof of address", hint: "Dated in the last 3 months, showing your name and home address.", done: !!d.proofOfAddress },
    { kind: "selfie", title: "A selfie", hint: "Face the camera in good light. We match it to your ID photo.", done: !!d.selfie, capture: "user" },
  ];

  return (
    <section className="mn-panel">
      <div className="mn-panel-hd"><span>Photos</span><span className="mn-muted">{tiles.filter((t) => !t.hide && t.done).length} of {tiles.filter((t) => !t.hide).length} added</span></div>
      <p className="mn-muted" style={{ margin: "0 0 14px", fontSize: 14 }}>Photos let the bank check your ID without asking you to come in. JPG, PNG or PDF, up to {MAX_MB} MB.</p>
      <div className="mn-id-tiles">
        {tiles.filter((t) => !t.hide).map((t) => (
          <div key={t.kind} className={`mn-id-tile${t.done ? " done" : ""}`}>
            <span className="mn-id-tile-ic"><Icon name={t.done ? "check" : t.kind === "selfie" ? "user" : t.kind === "proof_of_address" ? "statement" : "card"} size={18} /></span>
            <span className="mn-id-tile-t"><b>{t.title}</b><span className="mn-muted">{t.done ? "Added" : t.hint}</span></span>
            {t.kind === "proof_of_address" && !t.done && !locked && (
              <select className="mn-input mn-id-proof" value={proofType} onChange={(e) => setProofType(e.target.value as ProofOfAddressType)} aria-label="Kind of document">
                {(Object.keys(PROOF_LABEL) as ProofOfAddressType[]).map((k) => <option key={k} value={k}>{PROOF_LABEL[k]}</option>)}
              </select>
            )}
            {!locked && (
              <label className={`btn ${t.done ? "ghost" : "clay"} xs`}>
                {busy === t.kind ? "Uploading…" : t.done ? "Replace" : "Add photo"}
                <input type="file" hidden accept={t.kind === "selfie" ? "image/*" : "image/*,.pdf"} capture={t.capture} disabled={!!busy} onChange={(e) => { upload(t.kind, e.target.files); e.target.value = ""; }} />
              </label>
            )}
          </div>
        ))}
      </div>
      {err && <p className="mn-formerr" role="alert" style={{ marginTop: 14, marginBottom: 0 }}><Icon name="alert" size={16} />{err}</p>}
    </section>
  );
}
