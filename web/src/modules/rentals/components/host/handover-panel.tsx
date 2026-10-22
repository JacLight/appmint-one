"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resolveHandoverAction, completeHandoverAction, refusePickupAction, uploadPhotoAction } from "@/modules/rentals/actions/host";
import { fmtFull } from "@/lib/dates";
import type { HandoverResolve, PickupDelegation, FileInfo } from "@/api/rentals";

const REASON: Record<string, string> = { wrong_person: "Wrong person", expired: "Pass expired", revoked: "Pass cancelled", id_mismatch: "ID doesn’t match", other: "Other" };
const itemName = (i: { label?: string | null; identifier?: string | null; unit?: string | null }, n: number) => i.label || i.identifier || (i.unit ? `bay ${i.unit}` : `Item ${n}`);

/** The counter: someone shows a pickup code (the owner's, or a pass the owner sent
 *  them). Resolve it → see whose items and what must be checked → confirm the checks,
 *  snap a handover photo when it's a delegate → hand over. Or refuse, with a reason;
 *  the owner is told either way. */
export function HandoverPanel({ bookingId, delegations, itemOrder = [] }: { bookingId: string; delegations: PickupDelegation[]; /** booking item ids in the order the custody list shows them, so "Item 2" matches */ itemOrder?: string[] }) {
  const nameOf = (i: { id?: string; label?: string | null; identifier?: string | null; unit?: string | null }, fallback: number) => {
    const idx = i.id ? itemOrder.indexOf(i.id) : -1;
    return itemName(i, idx >= 0 ? idx + 1 : fallback);
  };
  const router = useRouter();
  const [pending, start] = useTransition();
  const [code, setCode] = useState("");
  const [r, setR] = useState<HandoverResolve | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [verified, setVerified] = useState<string[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [photos, setPhotos] = useState<FileInfo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [collectorName, setCollectorName] = useState("");
  const [note, setNote] = useState("");
  const [refusing, setRefusing] = useState(false);
  const [refuse, setRefuse] = useState({ reason: "wrong_person", who: "", note: "" });
  const fileRef = useRef<HTMLInputElement>(null);

  function resolve() {
    setErr(null); setOk(null); setR(null);
    start(async () => {
      const res = await resolveHandoverAction(code);
      if (!res.ok) { setErr(res.error); return; }
      setR(res.data); setVerified(["qr"]); setPicked(res.data.items.map((i) => i.id)); setPhotos([]); setCollectorName(res.data.collector.name || ""); setRefusing(false);
    });
  }
  const toggleV = (v: string) => setVerified((xs) => (xs.includes(v) ? xs.filter((x) => x !== v) : [...xs, v]));
  const toggleI = (id: string) => setPicked((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id]));

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    setUploading(true); setErr(null);
    const fd = new FormData(); fd.append("file", f);
    const res = await uploadPhotoAction(fd);
    setUploading(false);
    if (res.ok) setPhotos((p) => [...p, res.file]); else setErr(res.error);
    if (fileRef.current) fileRef.current.value = "";
  }
  function complete() {
    if (!r) return;
    setErr(null);
    start(async () => {
      const res = await completeHandoverAction(bookingId, { code: code.trim(), items: picked, verified, photos, note: note || undefined, collectorName: collectorName || undefined });
      if (res.ok) { setOk(`Handed over to ${collectorName || r.collector.name || (r.kind === "owner" ? "the owner" : "the collector")}.`); setR(null); setCode(""); router.refresh(); }
      else setErr(res.error);
    });
  }
  function doRefuse() {
    if (!r) return;
    setErr(null);
    start(async () => {
      const target = r.items[0]?.id; if (!target) { setErr("Nothing to refuse."); return; }
      const res = await refusePickupAction(bookingId, target, { reason: refuse.reason, who: refuse.who || collectorName || undefined, note: refuse.note || undefined, delegation: r.delegation || undefined, code: code.trim() });
      if (res.ok) { setOk("Refused — nothing moved, and the owner has been told."); setR(null); setRefusing(false); setCode(""); router.refresh(); }
      else setErr(res.error);
    });
  }

  const missing = r ? r.verify.filter((v) => !verified.includes(v)) : [];
  const canComplete = !!r && r.allowed && picked.length > 0 && missing.length === 0 && (!r.photoRequired || photos.length > 0) && !uploading;
  const live = delegations.filter((d) => d.status === "active");

  return (
    <div className="tcard bkd-card ho">
      <h3>Hand over</h3>
      <p className="muted" style={{ margin: "0 0 10px", fontSize: 13.5 }}>Scan or type the pickup code they show — the owner’s, or a pass the owner sent them.</p>
      <form className="ho-code" onSubmit={(e) => { e.preventDefault(); if (code.trim()) resolve(); }}>
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Pickup code" spellCheck={false} autoCapitalize="characters" />
        <button type="submit" className="btn clay sm" disabled={pending || !code.trim()}>{pending && !r ? "…" : "Look up"}</button>
      </form>
      {err && <div className="bp-error" style={{ marginTop: 8 }}>{err}</div>}
      {ok && <div className="ht-ok" style={{ marginTop: 8 }}>✓ {ok}</div>}

      {r && (
        <div className="ho-res">
          <div className="ho-who">
            <b>{r.kind === "delegate" ? (r.collector.name || "A collector") : "The owner"}</b>
            <span className="muted">{r.kind === "delegate" ? `sent by the owner · ${r.verifyLabel}` : `booking #${r.reference || ""} · their own code`}{r.validUntil ? ` · valid until ${fmtFull(r.validUntil)}` : ""}</span>
            {r.note && <span className="ho-note">Owner’s note: “{r.note}”</span>}
          </div>

          {!r.allowed ? (
            <div className="bp-error" style={{ marginTop: 8 }}>{r.message || "Nothing to hand over."}</div>
          ) : (
            <>
              <div className="set-field" style={{ marginTop: 10 }}><span>They’re collecting</span>
                <div className="cpm-scope">
                  {r.items.map((i, n) => (
                    <label key={i.id} className={`cpm-scope-item${picked.includes(i.id) ? " on" : ""}`}>
                      <input type="checkbox" checked={picked.includes(i.id)} onChange={() => toggleI(i.id)} /><span>{nameOf(i, n + 1)}{i.present === false ? <em> · not on site</em> : null}</span>
                    </label>
                  ))}
                </div>
                {(r.heldForOthers?.length ?? 0) > 0 && <p className="muted" style={{ fontSize: 12.5, margin: "6px 0 0" }}>Not on this code: {r.heldForOthers!.map((i, n) => `${nameOf(i, n + 1)} (handed to ${i.delegatedTo})`).join(", ")}.</p>}
              </div>

              <div className="set-field"><span>Before you hand over, confirm</span>
                <div className="ho-checks">
                  <label className="ho-check on"><input type="checkbox" checked readOnly /><span>Code matches (you just looked it up)</span></label>
                  {r.verify.includes("name") && <label className={`ho-check${verified.includes("name") ? " on" : ""}`}><input type="checkbox" checked={verified.includes("name")} onChange={() => toggleV("name")} /><span>They gave the name <b>{r.collector.name || "on the pass"}</b></span></label>}
                  {r.verify.includes("id") && <label className={`ho-check${verified.includes("id") ? " on" : ""}`}><input type="checkbox" checked={verified.includes("id")} onChange={() => toggleV("id")} /><span>Photo ID matches <b>{r.collector.name || "the name on the pass"}</b></span></label>}
                </div>
              </div>

              {r.kind === "delegate" && (
                <div className="ao-row2">
                  <label className="set-field"><span>Collector’s name <em>(as on their ID)</em></span><input value={collectorName} onChange={(e) => setCollectorName(e.target.value)} placeholder={r.collector.name || "Name"} /></label>
                  <div className="set-field"><span>Handover photo <em>(required)</em></span>
                    <div className="ho-photos">
                      {photos.map((p, i) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={i} src={p.url} alt={`Handover ${i + 1}`} className="ho-photo" />
                      ))}
                      <label className="ho-photo-add">
                        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onPhoto} hidden />
                        {uploading ? "Uploading…" : photos.length ? "+ Another" : "+ Take photo"}
                      </label>
                    </div>
                  </div>
                </div>
              )}
              <label className="set-field"><span>Note <em>(optional)</em></span><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Condition on the way out, anything to remember" /></label>

              {!refusing ? (
                <div className="ht-form-row">
                  <button type="button" className="ht-btn primary" disabled={pending || !canComplete} onClick={complete}>{pending ? "Handing over…" : `Hand over${picked.length && picked.length !== r.items.length ? ` (${picked.length})` : ""}`}</button>
                  <button type="button" className="ht-btn ghost" disabled={pending} onClick={() => setRefusing(true)}>Refuse</button>
                </div>
              ) : null}
              {missing.length > 0 && !refusing && <p className="muted" style={{ fontSize: 12.5, margin: "6px 0 0" }}>Confirm {missing.map((m) => (m === "id" ? "photo ID" : m)).join(" and ")} to enable hand over.</p>}
              {r.photoRequired && photos.length === 0 && !refusing && <p className="muted" style={{ fontSize: 12.5, margin: "2px 0 0" }}>A handover photo is required for a delegated pickup.</p>}
            </>
          )}

          {(refusing || !r.allowed) && (
            <div className="ht-form" style={{ marginTop: 12 }}>
              <p className="ht-q">Refuse this pickup? Nothing moves; the owner gets a message with the reason.</p>
              <select className="ht-input" value={refuse.reason} onChange={(e) => setRefuse({ ...refuse, reason: e.target.value })}>
                {(r.refuseReasons.length ? r.refuseReasons : Object.keys(REASON)).map((k) => <option key={k} value={k}>{REASON[k] || k}</option>)}
              </select>
              <input className="ht-input" placeholder="Who turned up? (optional)" value={refuse.who} onChange={(e) => setRefuse({ ...refuse, who: e.target.value })} />
              <input className="ht-input" placeholder="Note (optional)" value={refuse.note} onChange={(e) => setRefuse({ ...refuse, note: e.target.value })} />
              <div className="ht-form-row">
                <button type="button" className="ht-btn danger" disabled={pending} onClick={doRefuse}>{pending ? "Recording…" : "Refuse pickup"}</button>
                {r.allowed && <button type="button" className="ht-btn ghost" disabled={pending} onClick={() => setRefusing(false)}>Back</button>}
              </div>
            </div>
          )}
        </div>
      )}

      {live.length > 0 && (
        <div className="ho-live">
          <p className="eyebrow">Passes the owner has sent</p>
          {live.map((d) => (
            <div className="ho-live-row" key={d.id}>
              <span><b>{d.delegate?.name || d.delegate?.phone || d.delegate?.email || "Someone"}</b> · {(d.itemDetails ?? []).map((i, n) => nameOf(i, n + 1)).join(", ") || `${d.items.length} item(s)`} · {d.verifyLabel}{d.validUntil ? ` · until ${fmtFull(d.validUntil)}` : ""}</span>
              <button type="button" className="ht-link" onClick={() => { setCode(d.code); setRefusing(false); }}>Use code</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
