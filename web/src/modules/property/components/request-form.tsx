"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PropertyConfig, RequestCategory } from "@/setups/property-config";
import { requestRepairAction } from "../actions/property";
import { Ic } from "./icons";

interface Photo { name: string; path: string; preview: string }
const MAX_MB = 10;

/** A repair request: what, where, how bad, can we come in. Photos upload to the
 *  resident's own files first; the request carries their paths. */
export function RequestForm({ categories, areas, where, sla }: { categories: RequestCategory[]; areas: string[]; where: string | null; sla: PropertyConfig["sla"] }) {
  const router = useRouter();
  const [cat, setCat] = useState("");
  const [area, setArea] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [urgency, setUrgency] = useState("routine");
  const [entry, setEntry] = useState("yes");
  const [pets, setPets] = useState("");
  const [times, setTimes] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  async function add(files: FileList | null) {
    if (!files?.length) return;
    const list = Array.from(files).slice(0, 6 - photos.length);
    const big = list.find((f) => f.size > MAX_MB * 1024 * 1024);
    if (big) { setErr(`${big.name} is over ${MAX_MB} MB.`); return; }
    setErr(null); setBusy(true);
    try {
      const folder = `repairs/${new Date().toISOString().slice(0, 10)}`;
      for (const f of list) {
        const fd = new FormData();
        fd.append("file", f);
        fd.append("location", folder);
        const res = await fetch("/api/client-data/files/upload", { method: "POST", body: fd });
        if (!res.ok) throw new Error(`Upload of ${f.name} failed.`);
        setPhotos((p) => [...p, { name: f.name, path: `${folder}/${f.name}`, preview: URL.createObjectURL(f) }]);
      }
    } catch (e: any) {
      setErr(e?.message || "Upload failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const send = () => {
    if (!cat) { setErr("Pick what kind of problem it is."); return; }
    if (!title.trim() || !description.trim()) { setErr("Give it a short title and tell us what’s happening."); return; }
    setErr(null);
    start(async () => {
      const r = await requestRepairAction({ category: cat, area, title, description, urgency, permissionToEnter: entry, petsInHome: pets, bestTimes: times, photos: photos.map((p) => p.path) });
      if (!r.ok) { setErr(r.error); return; }
      router.push(`/account/requests${r.number ? `?sent=${encodeURIComponent(r.number)}` : ""}`);
      router.refresh();
    });
  };

  return (
    <div className="pm-form" style={{ maxWidth: 860 }}>
      {where && <p className="pm-muted" style={{ marginTop: 0 }}>For <b style={{ color: "var(--text)" }}>{where}</b></p>}

      <div className="pm-field" style={{ marginBottom: 22 }}>
        <span>What’s the problem?</span>
        <div className="pm-cats">
          {categories.map((c) => (
            <button key={c.id} type="button" className={`pm-cat${cat === c.id ? " on" : ""}`} aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>
              <Ic n={c.icon} size={22} />
              <b>{c.label}</b>
              <span>{c.hint}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="pm-grid">
        <label className="pm-field"><span>Short title</span><input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="e.g. Kitchen sink draining slowly" /></label>
        <label className="pm-field"><span>Where in your home</span>
          <select value={area} onChange={(e) => setArea(e.target.value)}>
            <option value="">Choose a room</option>
            {areas.map((a) => <option key={a}>{a}</option>)}
          </select>
        </label>
        <label className="pm-field full"><span>What’s happening</span><textarea rows={5} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="When it started, what you’ve tried, anything we should know before we come." /></label>

        <div className="pm-field full">
          <span>How urgent is it?</span>
          <div className="pm-yn" role="group">
            <button type="button" className={urgency === "routine" ? "on" : ""} onClick={() => setUrgency("routine")}>It can wait a few days</button>
            <button type="button" className={urgency === "urgent" ? "on" : ""} onClick={() => setUrgency("urgent")}>It needs fixing soon</button>
          </div>
          {urgency === "urgent" && (
            <div className="pm-emergency" style={{ marginTop: 10 }}>
              <Ic n="alert" size={20} />
              <div><b>Is it an emergency? Call <a href={`tel:${sla.emergencyPhone.replace(/[^\d+]/g, "")}`}>{sla.emergencyPhone}</a> now.</b>{sla.emergencyNote}</div>
            </div>
          )}
        </div>

        <div className="pm-field">
          <span>Can we come in if you’re not home?</span>
          <div className="pm-yn" role="group">
            <button type="button" className={entry === "yes" ? "on" : ""} onClick={() => setEntry("yes")}>Yes</button>
            <button type="button" className={entry === "no" ? "on" : ""} onClick={() => setEntry("no")}>No, call me first</button>
          </div>
        </div>
        <label className="pm-field"><span>Pets at home <em>optional</em></span><input value={pets} onChange={(e) => setPets(e.target.value)} placeholder="e.g. a friendly dog, crated" /></label>
        <label className="pm-field full"><span>Best times to reach you or come by <em>optional</em></span><input value={times} onChange={(e) => setTimes(e.target.value)} placeholder="e.g. weekdays after 4 PM" /></label>

        <div className="pm-field full">
          <span>Photos <em>optional, up to 6</em></span>
          <div className="pm-upl">
            <div className="pm-upl-h">
              <div><b>A photo saves a second visit</b><span>Show us the problem and anything nearby (model plate, the leak, the breaker).</span></div>
              {photos.length < 6 && (
                <label className="btn ghost xs" style={{ cursor: "pointer" }}>
                  <Ic n="camera" size={15} /> {busy ? "Uploading…" : "Add photos"}
                  <input type="file" accept="image/*" multiple hidden disabled={busy} onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
                </label>
              )}
            </div>
            {photos.length > 0 && (
              <div className="pm-thumbs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {photos.map((p) => <img key={p.path} src={p.preview} alt={p.name} title={p.name} />)}
              </div>
            )}
          </div>
        </div>
      </div>

      {err && <p className="pm-err" role="alert" style={{ marginTop: 18 }}>{err}</p>}
      <div className="pm-form-foot">
        <span className="pm-muted" style={{ fontSize: 14 }}>We respond within {sla.responseHours} hours and schedule routine work within {sla.routineDays} business days.</span>
        <button type="button" className="btn clay sm" disabled={pending || busy} onClick={send}>{pending ? "Sending…" : "Send request"}</button>
      </div>
    </div>
  );
}
