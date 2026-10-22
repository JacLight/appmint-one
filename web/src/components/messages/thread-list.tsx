import Link from "next/link";
import { routes } from "@/lib/nav";
import { EmptyState } from "@/components/empty-state";
import type { ThreadSummary } from "@/lib/community";

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

export function ThreadList({ threads, base }: { threads: ThreadSummary[]; base: "host" | "account" }) {
  if (!threads || threads.length === 0) {
    return (
      <EmptyState
        title="No conversations yet"
        note={base === "host" ? "Messages between you and your guests show up here." : "Message a host about a space and the conversation lives here."}
      />
    );
  }
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {threads.map((t) => {
        const name = nameOf(t);
        const email = t.otherUser?.email ?? "";
        const href = base === "host" ? routes.hostThread(email) : routes.thread(email);
        const preview = t.lastMessage?.data?.content ?? "";
        const initial = (name || "?").charAt(0).toUpperCase();
        return (
          <Link
            key={t.threadId || email}
            href={href}
            className="tcard"
            style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px" }}
          >
            <span style={{ width: 42, height: 42, flex: "none", borderRadius: "50%", background: "var(--accent)", color: "#fff", display: "grid", placeItems: "center", fontFamily: "var(--font-display)", fontWeight: 700 }}>{initial}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <b style={{ fontFamily: "var(--font-display)", fontSize: 15 }}>{name}</b>
                <span className="muted" style={{ fontSize: 12, flex: "none" }}>{formatWhen(t.lastMessage?.data?.sentAt)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 2 }}>
                <span className="muted" style={{ fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{preview || "—"}</span>
                {t.unreadCount > 0 && (
                  <span style={{ flex: "none", background: "var(--primary)", color: "#fff", borderRadius: 999, fontSize: 11, fontWeight: 700, padding: "1px 8px", lineHeight: 1.6 }}>{t.unreadCount}</span>
                )}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
