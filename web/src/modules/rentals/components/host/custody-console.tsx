"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { checkInAction, movementAction, checkOutAction, respondRequestAction } from "@/modules/rentals/actions/host";
import { BookingActivity } from "@/modules/rentals/components/account/booking-activity";
import { fmtFull } from "@/lib/dates";
import { eventWhen } from "@/modules/rentals/lib/custody";
import type { StowboBookingItem, BookingTimeline, StowboRequest, RequestStatus } from "@/api/rentals";
import type { Envelope } from "@/lib/api";

const REQ_LABEL: Record<string, string> = { out: "Bring their things out", in: "Put their things back", checkout: "Check out & collect" };
const REQ_STATUS: Record<string, string> = { open: "New request", acknowledged: "You’re on it", ready: "Ready for guest", done: "Done", declined: "Declined" };

/** Presence is the direction of the LAST movement — out at 2pm means at lunch,
 *  not finished. Never a stored flag. */
function isPresent(m?: StowboBookingItem["movements"]) {
  const last = m?.[(m?.length ?? 0) - 1];
  return last?.direction === "in";
}
function statusLabel(status?: string, present?: boolean): { text: string; cls: string } {
  if (status === "reserved") return { text: "Awaiting drop-off", cls: "reserved" };
  if (status === "ended") return { text: "Collected", cls: "ended" };
  if (status === "cancelled") return { text: "Cancelled", cls: "cancelled" };
  if (status === "active") return present ? { text: "In storage", cls: "in" } : { text: "Out", cls: "out" };
  return { text: status || "—", cls: "reserved" };
}

/** The host's working custody surface for one booking: the guest's request queue
 *  (respond: acknowledge → ready → done), then the Model-A item engine (check in
 *  → move in/out → check out), then the shared activity feed. */
export function CustodyConsole({ bookingId, items, timeline, requests }: {
  bookingId: string;
  items: Envelope<StowboBookingItem>[];
  timeline: BookingTimeline | null;
  requests: StowboRequest[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const run = (fn: () => Promise<any>) => {
    setErr(null);
    start(async () => {
      const r = await fn();
      if (r && r.ok === false) setErr(r.error || "Couldn’t complete that.");
      else router.refresh();
    });
  };

  const openReqs = (requests || []).filter((r) => r.status !== "done" && r.status !== "declined");

  return (
    <div className="csl">
      {openReqs.length > 0 && (
        <div className="csl-reqs">
          <h3>Guest requests <span className="csl-reqs-n">{openReqs.length}</span></h3>
          {openReqs.map((r) => (
            <div className={`csl-req-row s-${r.status}`} key={r.id}>
              <div className="csl-req-main">
                <b>{(r as any).label || REQ_LABEL[r.type] || r.type}{(r.type === "addon" || r.type === "service") && <span className="csl-req-tag">upgrade</span>}</b>
                {r.note ? <span className="csl-req-note">“{r.note}”</span> : null}
                <span className="csl-req-meta">{REQ_STATUS[r.status]} · asked {eventWhen(r.createdAt)}</span>
              </div>
              <div className="csl-req-actions">
                {r.status === "open" && (
                  <>
                    <button className="csl-btn primary" onClick={() => run(() => respondRequestAction(bookingId, r.id, "acknowledged"))} disabled={pending}>Acknowledge</button>
                    <button className="csl-btn ghost" onClick={() => run(() => respondRequestAction(bookingId, r.id, "declined"))} disabled={pending}>Can’t do it</button>
                  </>
                )}
                {r.status === "acknowledged" && (
                  <>
                    <button className="csl-btn primary" onClick={() => run(() => respondRequestAction(bookingId, r.id, "ready"))} disabled={pending}>Mark ready</button>
                    <button className="csl-btn" onClick={() => run(() => respondRequestAction(bookingId, r.id, "done"))} disabled={pending}>Mark done</button>
                  </>
                )}
                {r.status === "ready" && (
                  <button className="csl-btn primary" onClick={() => run(() => respondRequestAction(bookingId, r.id, "done"))} disabled={pending}>Mark done</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="csl-items">
        <h3>In your care</h3>
        {items.length === 0 && <p className="muted">No trackable items on this booking yet.</p>}
        {items.map((env) => {
          const it = env.data;
          const id = String(env.sk);
          const present = isPresent(it.movements);
          const { text, cls } = statusLabel(it.status, present);
          const title = it.label || it.unit || it.identifier || (it.line != null ? `Item ${it.line + 1}` : "Item");
          return (
            <div className="csl-item" key={id}>
              <div className="csl-item-hd">
                <b>{title}</b>
                <span className={`csl-status s-${cls}`}>{text}</span>
              </div>
              <div className="csl-when">{fmtFull(it.startDate)} → {fmtFull(it.endDate)}</div>
              <div className="csl-actions">
                {it.status === "reserved" && (
                  <button className="csl-btn primary" onClick={() => run(() => checkInAction(id))} disabled={pending}>Check in (received)</button>
                )}
                {it.status === "active" && present && (
                  <button className="csl-btn" onClick={() => run(() => movementAction(id, "out"))} disabled={pending}>Move out</button>
                )}
                {it.status === "active" && !present && (
                  <button className="csl-btn" onClick={() => run(() => movementAction(id, "in"))} disabled={pending}>Move in</button>
                )}
                {it.status === "active" && (
                  <button className="csl-btn primary" onClick={() => run(() => checkOutAction(id))} disabled={pending}>Check out (hand back)</button>
                )}
                {it.status === "ended" && <span className="csl-done">✓ Collected</span>}
              </div>
            </div>
          );
        })}
      </div>

      {err && <div className="bp-error" style={{ marginTop: 10 }}>{err}</div>}

      <div className="csl-activity">
        <h3>Activity</h3>
        <BookingActivity events={timeline?.timeline ?? []} />
      </div>
    </div>
  );
}
