import type { Board } from "../lib/resident";
import { day } from "../lib/format";
import { JoinBoard } from "./join-board";
import { Ic } from "./icons";

/** A building's notices, or how to get them. `big` shows the whole text. */
export function Notices({ board, big = false, limit }: { board: Board | null; big?: boolean; limit?: number }) {
  if (!board) return <p className="pm-muted" style={{ margin: 0 }}>Building notices appear here once you have a lease with us.</p>;
  if (board.status === "missing") return <p className="pm-muted" style={{ margin: 0 }}>Your building’s notice board isn’t set up yet.</p>;
  if (board.status === "pending") return <p className="pm-muted" style={{ margin: 0 }}>You’ve asked for {board.title}’s notices. The office will confirm you live there, usually the same day.</p>;
  if (board.status === "outside") return (
    <div style={{ display: "grid", gap: 10 }}>
      <p className="pm-muted" style={{ margin: 0 }}>Water shut-offs, pest control visits, pool hours: notices for residents of {board.title}.</p>
      <JoinBoard pageId={board.id} title={board.title} />
    </div>
  );
  const list = limit ? board.notices.slice(0, limit) : board.notices;
  if (!list.length) return <p className="pm-muted" style={{ margin: 0 }}>Nothing new from the office. Notices about your building will show up here.</p>;
  return (
    <div>
      {list.map((n) => (
        <article key={n.id} className={`pm-notice${big ? " big" : ""}`}>
          <b>
            {n.pinned && <span className="pm-pill info">Pinned</span>}
            {(n.priority === "high" || n.priority === "urgent") && <span className="pm-pill wait"><Ic n="alert" size={13} /> Important</span>}
            {n.title}
          </b>
          {n.content && <p>{big ? n.content.replace(/<[^>]+>/g, "") : n.content.replace(/<[^>]+>/g, "").slice(0, 160) + (n.content.length > 160 ? "…" : "")}</p>}
          {n.publishedAt && <time dateTime={n.publishedAt}>{day(n.publishedAt)}</time>}
        </article>
      ))}
    </div>
  );
}
