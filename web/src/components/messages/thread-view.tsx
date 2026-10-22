"use client";

import { useState, useRef, useEffect, useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/alert";
import { sendMessageAction } from "@/app/actions/community";
import type { Envelope } from "@/lib/api";
import type { CommunityMessage } from "@/lib/community";

/* ───────────────────────── time helpers ───────────────────────── */
function parse(iso?: string): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}
function clockTime(iso?: string): string {
  const d = parse(iso);
  return d ? d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : "";
}
function dayLabel(iso?: string): string {
  const d = parse(iso);
  if (!d) return "";
  const now = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(d)) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString(undefined, { weekday: "long" });
  return d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: d.getFullYear() === now.getFullYear() ? undefined : "numeric" });
}
function dayKey(iso?: string): string {
  const d = parse(iso);
  return d ? `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` : "?";
}

/* ───────────────────────── attachment helpers ───────────────────────── */
function imageUrlOf(m?: CommunityMessage): string | null {
  if (!m) return null;
  const att = Array.isArray(m.attachments) ? m.attachments : [];
  for (const a of att) {
    const url = a?.url || a?.publicUrl || (typeof a === "string" ? a : "");
    const ct = a?.contentType || "";
    if (url && (ct.startsWith("image") || /\.(png|jpe?g|gif|webp|avif)$/i.test(url))) return url;
  }
  if (m.contentType === "image" && att[0]?.url) return att[0].url;
  return null;
}
async function uploadImage(file: File): Promise<{ url: string; contentType: string; name: string }> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("location", "messages");
  const res = await fetch("/api/repository/customer/file/upload", { method: "POST", body: fd });
  if (!res.ok) throw new Error("Upload failed. Please try again.");
  const j = await res.json().catch(() => null);
  const rec = Array.isArray(j) ? j[0] : j?.data ?? j;
  const record = Array.isArray(rec) ? rec[0] : rec;
  const url = record?.url || record?.publicUrl || record?.path;
  if (!url) throw new Error("Upload didn’t return an image URL.");
  return { url, contentType: file.type || "image/*", name: file.name };
}

/** Read receipt ticks for my own messages. */
function Receipt({ status }: { status?: string }) {
  const read = status === "read";
  const delivered = status === "read" || status === "delivered";
  const color = read ? "#8fd0ff" : "rgba(255,255,255,.7)";
  return (
    <svg width="16" height="11" viewBox="0 0 20 11" fill="none" style={{ marginLeft: 4, verticalAlign: "-1px" }} aria-hidden>
      <path d="M1 6l3 3 6-7" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      {delivered && <path d="M8 9l1.6 1.6L16 3" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}

function Avatar({ name, size = 30 }: { name: string; size?: number }) {
  return (
    <span style={{ width: size, height: size, flex: "none", borderRadius: "50%", background: "var(--accent)", color: "#fff", display: "grid", placeItems: "center", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: size * 0.42 }}>
      {(name || "?").charAt(0).toUpperCase()}
    </span>
  );
}

export function ThreadView({
  otherEmail,
  otherName,
  me,
  initial,
  backHref,
}: {
  otherEmail: string;
  otherName: string;
  me: string;
  initial: Envelope<CommunityMessage>[];
  backHref: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attach, setAttach] = useState<{ file: File; preview: string } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const msgs = useMemo(
    () =>
      [...(initial || [])].sort(
        (a, b) => new Date(a.data?.sentAt || 0).getTime() - new Date(b.data?.sentAt || 0).getTime(),
      ),
    [initial],
  );

  // Precompute run flags: a "run" is consecutive messages, same sender, same day, within 5 min.
  const rows = useMemo(() => {
    return msgs.map((env, i) => {
      const m = env.data;
      const prev = msgs[i - 1]?.data;
      const next = msgs[i + 1]?.data;
      const sameRun = (a?: CommunityMessage, b?: CommunityMessage) =>
        !!a && !!b && a.sender === b.sender && dayKey(a.sentAt) === dayKey(b.sentAt) &&
        Math.abs(new Date(a.sentAt || 0).getTime() - new Date(b.sentAt || 0).getTime()) < 5 * 60_000;
      const newDay = i === 0 || dayKey(m?.sentAt) !== dayKey(prev?.sentAt);
      const runStart = newDay || !sameRun(m, prev);
      const runEnd = i === msgs.length - 1 || dayKey(m?.sentAt) !== dayKey(next?.sentAt) || !sameRun(m, next);
      return { env, m, newDay, runStart, runEnd };
    });
  }, [msgs]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [initial]);

  // auto-grow textarea
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = Math.min(el.scrollHeight, 150) + "px";
  }, [text]);

  function reset() { setText(""); if (attach) URL.revokeObjectURL(attach.preview); setAttach(null); }

  function send() {
    const content = text.trim();
    if (!content && !attach) return;
    setError(null);
    if (attach) {
      setUploading(true);
      (async () => {
        try {
          const uploaded = await uploadImage(attach.file);
          const r = await sendMessageAction({ recipientId: otherEmail, content, contentType: "image", attachments: [uploaded] });
          if (r.ok) { reset(); router.refresh(); } else setError(r.error);
        } catch (err: any) {
          setError(err?.message || "Could not send the photo.");
        } finally { setUploading(false); }
      })();
      return;
    }
    start(async () => {
      const r = await sendMessageAction({ recipientId: otherEmail, content });
      if (r.ok) { setText(""); router.refresh(); } else setError(r.error);
    });
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }
  function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (attach) URL.revokeObjectURL(attach.preview);
    setError(null);
    setAttach({ file, preview: URL.createObjectURL(file) });
    taRef.current?.focus();
  }

  const busy = pending || uploading;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, overflow: "hidden" }}>
      <style>{`
        .sb-thread-scroll::-webkit-scrollbar{width:8px}
        .sb-thread-scroll::-webkit-scrollbar-thumb{background:rgba(0,0,0,.14);border-radius:8px}
        .sb-bubble-in{animation:sbpop .18s ease-out}
        @keyframes sbpop{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
      `}</style>

      {/* header */}
      <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "12px 18px", borderBottom: "1px solid var(--border-2)", flex: "none", background: "var(--surface)" }}>
        <Link href={backHref} className="sb-back" style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--text-2)", textDecoration: "none", fontSize: 18, lineHeight: 1 }} aria-label="Back to inbox">←</Link>
        <Avatar name={otherName} size={38} />
        <div style={{ minWidth: 0 }}>
          <b style={{ fontFamily: "var(--font-display)", fontSize: 15.5, display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{otherName}</b>
          <span className="muted" style={{ fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block", maxWidth: 260 }}>{otherEmail}</span>
        </div>
      </div>

      {/* messages */}
      <div className="sb-thread-scroll" style={{ flex: 1, overflowY: "auto", minHeight: 0, padding: "16px 16px 8px", background: "var(--bg-2)" }}>
        {rows.length === 0 ? (
          <div className="muted" style={{ margin: "auto", textAlign: "center", fontSize: 14, paddingTop: 40 }}>
            <div style={{ fontSize: 30, marginBottom: 6 }}>👋</div>
            No messages yet. Say hello to {otherName}.
          </div>
        ) : (
          rows.map(({ env, m, newDay, runStart, runEnd }, i) => {
            const mine = (m?.sender || "") === me;
            const img = imageUrlOf(m);
            const body = m?.content;
            return (
              <div key={env.sk || i}>
                {newDay && (
                  <div style={{ display: "flex", justifyContent: "center", margin: "14px 0 12px" }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--muted)", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 999, padding: "3px 12px", fontFamily: "var(--font-display)" }}>{dayLabel(m?.sentAt)}</span>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", alignItems: "flex-end", gap: 8, marginTop: runStart ? 10 : 2 }}>
                  {!mine && (
                    <div style={{ width: 30, flex: "none" }}>{runEnd ? <Avatar name={otherName} /> : null}</div>
                  )}
                  <div className="sb-bubble-in" style={{ maxWidth: "72%", display: "flex", flexDirection: "column", alignItems: mine ? "flex-end" : "flex-start" }}>
                    <div
                      style={{
                        background: mine ? "var(--primary)" : "var(--surface)",
                        color: mine ? "#fff" : "var(--text)",
                        border: mine ? "none" : "1px solid var(--border)",
                        borderRadius: 18,
                        borderBottomRightRadius: mine && runEnd ? 5 : 18,
                        borderBottomLeftRadius: !mine && runEnd ? 5 : 18,
                        padding: img ? 4 : "8px 13px",
                        fontSize: 14.5,
                        lineHeight: 1.45,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        boxShadow: "0 1px 1px rgba(0,0,0,.04)",
                      }}
                    >
                      {img && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <a href={img} target="_blank" rel="noreferrer" style={{ display: "block" }}>
                          <img src={img} alt="attachment" style={{ display: "block", maxWidth: 240, width: "100%", borderRadius: 14 }} />
                        </a>
                      )}
                      {body ? <div style={{ padding: img ? "6px 9px 3px" : 0 }}>{body}</div> : null}
                    </div>
                    {runEnd && (
                      <div className="muted" style={{ fontSize: 10.5, marginTop: 3, display: "flex", alignItems: "center" }}>
                        <span>{clockTime(m?.sentAt)}</span>
                        {mine && <Receipt status={m?.status} />}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      {/* composer */}
      <div style={{ borderTop: "1px solid var(--border-2)", padding: 12, flex: "none", background: "var(--surface)" }}>
        {error && <Alert kind="error" onDismiss={() => setError(null)}>{error}</Alert>}
        {attach && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, padding: 8, background: "var(--bg-2)", borderRadius: 12, border: "1px solid var(--border)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={attach.preview} alt="preview" style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 8, flex: "none" }} />
            <div style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
              <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{attach.file.name}</div>
              <div className="muted" style={{ fontSize: 12 }}>{uploading ? "Sending…" : "Add a caption, or hit send"}</div>
            </div>
            <button type="button" onClick={reset} disabled={uploading} aria-label="Remove attachment" style={{ flex: "none", background: "none", border: 0, color: "var(--muted)", cursor: "pointer", fontSize: 16 }}>✕</button>
          </div>
        )}
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickImage} />
          <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} title="Attach a photo"
            style={{ flex: "none", width: 42, height: 42, borderRadius: "50%", border: "1px solid var(--border)", background: "var(--surface)", cursor: busy ? "default" : "pointer", fontSize: 18, display: "grid", placeItems: "center", color: "var(--text-2)" }}>📎</button>
          <textarea
            ref={taRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKey}
            rows={1}
            placeholder={`Message ${otherName}…`}
            style={{ flex: 1, resize: "none", minHeight: 42, maxHeight: 150, padding: "11px 15px", borderRadius: 22, border: "1px solid var(--border)", font: "inherit", fontSize: 14.5, background: "var(--bg-2)", lineHeight: 1.4 }}
          />
          <button type="button" disabled={busy || (!text.trim() && !attach)} onClick={send} aria-label="Send"
            style={{ flex: "none", width: 42, height: 42, borderRadius: "50%", border: 0, background: (busy || (!text.trim() && !attach)) ? "var(--faint)" : "var(--primary)", color: "#fff", cursor: "pointer", display: "grid", placeItems: "center" }}>
            {busy ? (
              <span style={{ fontSize: 15 }}>…</span>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M4 12l16-8-6 16-3-6-7-2z" fill="currentColor" /></svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
