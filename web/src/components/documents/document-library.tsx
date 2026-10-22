"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/alert";
import { deleteDocumentAction } from "@/app/actions/documents";
import type { CustomerFile } from "@/lib/documents";

const MAX_MB = 20;

function fmtSize(n?: number): string {
  if (!n && n !== 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
function fmtDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
function ext(name: string): string {
  const m = /\.([a-z0-9]{1,5})$/i.exec(name);
  return m ? m[1].toUpperCase() : "FILE";
}
const folderOf = (p: string) => (p.includes("/") ? p.split("/")[0] : "");

/** The customer's own files: upload (drag-drop or pick), grouped by folder, open via
 *  the signed URL, remove. Uploads go straight to the engine through the /api proxy. */
export function DocumentLibrary({ files }: { files: CustomerFile[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [folder, setFolder] = useState("documents");
  const [msg, setMsg] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const groups = useMemo(() => {
    const m = new Map<string, CustomerFile[]>();
    for (const f of files) {
      const k = folderOf(f.path) || "Unfiled";
      m.set(k, [...(m.get(k) || []), f]);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [files]);

  async function upload(list: FileList | File[]) {
    const arr = Array.from(list);
    if (!arr.length) return;
    const tooBig = arr.find((f) => f.size > MAX_MB * 1024 * 1024);
    if (tooBig) { setMsg({ kind: "error", text: `${tooBig.name} is over ${MAX_MB} MB.` }); return; }
    setMsg(null); setBusy(true);
    try {
      const loc = folder.trim().replace(/[^\w\- ]/g, "").replace(/\s+/g, "-") || "documents";
      for (const f of arr) {
        const fd = new FormData();
        fd.append("file", f);
        fd.append("location", loc);
        const res = await fetch("/api/client-data/files/upload", { method: "POST", body: fd });
        if (!res.ok) throw new Error(`Upload of ${f.name} failed.`);
      }
      setMsg({ kind: "success", text: arr.length === 1 ? `${arr[0].name} uploaded.` : `${arr.length} files uploaded.` });
      router.refresh();
    } catch (e: any) {
      setMsg({ kind: "error", text: e?.message || "Upload failed. Please try again." });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  function remove(f: CustomerFile) {
    setMsg(null); setConfirming(null);
    start(async () => {
      const r = await deleteDocumentAction(f.path);
      if (r.ok) { setMsg({ kind: "success", text: `${f.name} removed.` }); router.refresh(); }
      else { setMsg({ kind: "error", text: r.error }); router.refresh(); }
    });
  }

  return (
    <div className="docs">
      {msg && <Alert kind={msg.kind} onDismiss={() => setMsg(null)}>{msg.text}</Alert>}
      <div
        className={`docs-drop${drag ? " on" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files); }}
      >
        <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 16V4M7 9l5-5 5 5M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /></svg>
        <div>
          <b>{busy ? "Uploading…" : "Drop files here or choose from your device"}</b>
          <span>PDF, images, Word or Excel · up to {MAX_MB} MB each</span>
        </div>
        <div className="docs-drop-acts">
          <label className="docs-folder">Folder
            <input value={folder} onChange={(e) => setFolder(e.target.value)} maxLength={40} />
          </label>
          <button type="button" className="btn clay sm" disabled={busy} onClick={() => input.current?.click()}>Choose files</button>
        </div>
        <input ref={input} type="file" multiple hidden onChange={(e) => e.target.files && upload(e.target.files)} />
      </div>

      {files.length === 0 ? (
        <div className="tcard docs-empty">
          <h3>No documents yet</h3>
          <p className="muted">Upload IDs, contracts, forms or photos you want to keep with your account. Only you and the business can see them.</p>
        </div>
      ) : (
        groups.map(([g, list]) => (
          <div className="docs-group" key={g}>
            <div className="docs-group-hd"><b>{g}</b><span>{list.length} file{list.length === 1 ? "" : "s"}</span></div>
            <div className="docs-list">
              {list.map((f) => (
                <div className="docs-row" key={f.path}>
                  <span className="docs-ext">{ext(f.name)}</span>
                  <div className="docs-main">
                    <b>{f.name}</b>
                    <span>{[fmtSize(f.size), fmtDate(f.modified)].filter(Boolean).join(" · ")}</span>
                  </div>
                  <div className="docs-acts">
                    {f.url && <a className="ht-link" href={f.url} target="_blank" rel="noreferrer">Open</a>}
                    {confirming === f.path ? (
                      <>
                        <button type="button" className="ht-link danger" disabled={pending} onClick={() => remove(f)}>Confirm remove</button>
                        <button type="button" className="ht-link" onClick={() => setConfirming(null)}>Cancel</button>
                      </>
                    ) : (
                      <button type="button" className="ht-link danger" disabled={pending} onClick={() => setConfirming(f.path)}>Remove</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
