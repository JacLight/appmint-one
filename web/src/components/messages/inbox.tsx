"use client";

import Link from "next/link";
import { routes } from "@/lib/nav";
import { ThreadView } from "./thread-view";
import type { Envelope } from "@/lib/api";
import type { ThreadSummary, CommunityMessage } from "@/lib/community";

function formatWhen(iso?: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    return sameDay
      ? d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
      : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

function nameOf(t: ThreadSummary): string {
  const u = t.otherUser || ({} as ThreadSummary["otherUser"]);
  const full = [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
  return full || u.company || u.email || "Someone";
}

function previewOf(t: ThreadSummary): string {
  const d = t.lastMessage?.data;
  if (!d) return "";
  if (d.content && d.content.trim()) return d.content;
  if (d.contentType === "image" || (d.attachments && d.attachments.length)) return "📷 Photo";
  return "";
}

/**
 * Two-pane inbox: a scrollable thread list on the left, the open conversation on
 * the right. On desktop both panes always show (list + conversation-or-empty).
 * On mobile it collapses to one pane at a time (list when nothing is open, the
 * conversation when a thread is active) with the ThreadView's own back link.
 */
export function Inbox({
  threads,
  me,
  base,
  activeEmail,
  initial,
  otherName,
  emptyNote,
}: {
  threads: ThreadSummary[];
  me: string;
  base: "host" | "account";
  activeEmail?: string;
  initial?: Envelope<CommunityMessage>[];
  otherName?: string;
  /** Empty-inbox line in the setup's words (defaults to Stowbo's). */
  emptyNote?: string;
}) {
  const hrefFor = (email: string) => (base === "host" ? routes.hostThread(email) : routes.thread(email));
  const backHref = base === "host" ? routes.hostMessages : routes.messages;
  const hasActive = Boolean(activeEmail);

  return (
    <div
      className={`sb-inbox${hasActive ? " has-active" : ""}`}
      style={{
        display: "grid",
        gridTemplateColumns: "340px 1fr",
        height: "min(74vh, 720px)",
        border: "1px solid var(--border)",
        borderRadius: 18,
        overflow: "hidden",
        background: "var(--surface)",
      }}
    >
      <style>{`
        @media (max-width: 820px){
          .sb-inbox{grid-template-columns:1fr !important;height:min(76vh,640px) !important}
          .sb-inbox.has-active .sb-list{display:none !important}
          .sb-inbox:not(.has-active) .sb-conv{display:none !important}
        }
      `}</style>

      {/* LEFT — thread list */}
      <aside className="sb-list" style={{ borderRight: "1px solid var(--border-2)", display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div style={{ padding: "16px 18px 12px", borderBottom: "1px solid var(--border-2)" }}>
          <div className="eyebrow" style={{ fontSize: 11 }}>Inbox</div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, marginTop: 2 }}>Messages</div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
          {threads.length === 0 ? (
            <div className="muted" style={{ padding: "26px 20px", fontSize: 14, textAlign: "center" }}>
              {emptyNote || (base === "host" ? "Messages with your guests show up here." : "Message a host about a space and it lives here.")}
            </div>
          ) : (
            threads.map((t) => {
              const email = t.otherUser?.email ?? "";
              const name = nameOf(t);
              const active = email === activeEmail;
              return (
                <Link
                  key={t.threadId || email}
                  href={hrefFor(email)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "13px 16px",
                    borderBottom: "1px solid var(--border-2)",
                    background: active ? "var(--bg-2)" : "transparent",
                    boxShadow: active ? "inset 3px 0 0 var(--primary)" : "none",
                  }}
                >
                  <span style={{ width: 42, height: 42, flex: "none", borderRadius: "50%", background: "var(--accent)", color: "#fff", display: "grid", placeItems: "center", fontFamily: "var(--font-display)", fontWeight: 700 }}>
                    {(name || "?").charAt(0).toUpperCase()}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <b style={{ fontFamily: "var(--font-display)", fontSize: 14.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</b>
                      <span className="muted" style={{ fontSize: 11.5, flex: "none" }}>{formatWhen(t.lastMessage?.data?.sentAt)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 2 }}>
                      <span className="muted" style={{ fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{previewOf(t) || "—"}</span>
                      {t.unreadCount > 0 && (
                        <span style={{ flex: "none", background: "var(--primary)", color: "#fff", borderRadius: 999, fontSize: 11, fontWeight: 700, padding: "1px 8px", lineHeight: 1.7 }}>{t.unreadCount}</span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </aside>

      {/* RIGHT — conversation */}
      <section className="sb-conv" style={{ minHeight: 0, display: "flex", flexDirection: "column" }}>
        {hasActive ? (
          <ThreadView
            otherEmail={activeEmail!}
            otherName={otherName || activeEmail!}
            me={me}
            initial={initial || []}
            backHref={backHref}
          />
        ) : (
          <div style={{ margin: "auto", textAlign: "center", padding: 30, color: "var(--muted)" }}>
            <div style={{ fontSize: 34, marginBottom: 8 }}>💬</div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, color: "var(--text-2)" }}>Select a conversation</div>
            <div style={{ fontSize: 13.5, marginTop: 4 }}>Pick a thread on the left to read and reply.</div>
          </div>
        )}
      </section>
    </div>
  );
}
