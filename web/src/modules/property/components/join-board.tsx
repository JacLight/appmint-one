"use client";

import { useState, useTransition } from "react";
import { joinBoardAction } from "../actions/property";

/** Ask to join the building's notice board. The office approves residents, so the
 *  button turns into "waiting" until they do. */
export function JoinBoard({ pageId, title }: { pageId: string; title: string }) {
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (sent) return <p className="pm-muted" style={{ margin: 0 }}>Sent. You’ll see {title}’s notices here once the office confirms you live there.</p>;
  return (
    <div style={{ display: "grid", gap: 8, justifyItems: "start" }}>
      <button type="button" className="btn clay sm" disabled={pending} onClick={() => start(async () => {
        setErr(null);
        const r = await joinBoardAction(pageId);
        if (r.ok) setSent(true); else setErr(r.error);
      })}>{pending ? "Sending…" : `Get ${title} notices`}</button>
      {err && <span className="pm-err">{err}</span>}
    </div>
  );
}
