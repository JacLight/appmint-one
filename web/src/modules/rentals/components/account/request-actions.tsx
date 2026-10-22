"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestBookingAction } from "@/modules/rentals/actions/booking";
import { eventWhen } from "@/modules/rentals/lib/custody";
import type { StowboRequest } from "@/api/rentals";

const REQ_LABEL: Record<string, string> = { out: "Bring my things out", in: "Put my things back", checkout: "Check me out & collect" };
const CUST_STATUS: Record<string, { text: string; cls: string }> = {
  open: { text: "Waiting for your host", cls: "wait" },
  acknowledged: { text: "Your host is on it", cls: "ack" },
  ready: { text: "Ready for you — go collect!", cls: "ready" },
  done: { text: "Done", cls: "done" },
  declined: { text: "Host couldn’t do this", cls: "declined" },
};

/** Customer-side "ask the host" controls + the live status of each ask — the
 *  other half of the custody loop. On a staffed space you can't reach the bay
 *  yourself, so you request and the host fulfils. Only while the stay is open. */
export function RequestActions({ bookingId, staffed, stageIndex, requests }: {
  bookingId: string; staffed: boolean; stageIndex: number; requests: StowboRequest[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const open = (requests || []).filter((r) => r.status !== "done" && r.status !== "declined");
  if (stageIndex !== 1 && open.length === 0) return null; // only while in custody (or if something's live)

  const ask = (type: "out" | "in" | "checkout") => {
    setErr(null);
    start(async () => {
      const r = await requestBookingAction(bookingId, type);
      if (r.ok) router.refresh();
      else setErr(r.error);
    });
  };

  return (
    <div className="tcard bkd-card">
      <h3>Need your things?</h3>

      {open.length > 0 && (
        <div className="req-status">
          {open.map((r) => {
            const s = CUST_STATUS[r.status] ?? { text: r.status, cls: "wait" };
            return (
              <div className={`req-stat s-${s.cls}`} key={r.id}>
                <span className="req-stat-label">{(r as any).label || REQ_LABEL[r.type] || r.type}</span>
                <span className="req-stat-badge">{s.text}</span>
                <span className="req-stat-when">{eventWhen(r.updatedAt || r.createdAt)}</span>
              </div>
            );
          })}
        </div>
      )}

      {stageIndex === 1 && (
        <>
          <p className="req-hint">{staffed
            ? "Ask your host — they’ll get it ready, and you’ll both see it here. As often as you like during your stay."
            : "Let the space know what you need — it shows on the timeline."}</p>
          <div className="req-btns">
            <button type="button" className="req-btn" onClick={() => ask("out")} disabled={pending}>Bring my things out</button>
            <button type="button" className="req-btn" onClick={() => ask("in")} disabled={pending}>Put them back</button>
            <button type="button" className="req-btn primary" onClick={() => ask("checkout")} disabled={pending}>I’m collecting — check me out</button>
          </div>
        </>
      )}

      {err && <div className="bp-error" style={{ marginTop: 8 }}>{err}</div>}
    </div>
  );
}
