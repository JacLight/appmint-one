/**
 * The engine's job status names (verbatim) and the words each side sees for them.
 * The customer and the driver read the same status differently: the customer sees
 * where their thing is ("On its way"), the driver sees what they've done ("Picked up").
 * Nouns come from the setup's lexicon — `w.provider` ("Driver"), `w.job` ("Delivery").
 * Client-safe.
 */
import type { JobStatus, DeliveryJob, JobStop, TimelineEvent } from "./types";

export interface Words { job: string; jobs: string; provider: string }

export const OPEN_STATUSES: JobStatus[] = ["pending", "broadcasting"];
export const ACTIVE_STATUSES: JobStatus[] = ["assigned", "en_route_pickup", "arrived_pickup", "picked_up", "en_route_dropoff", "arrived_dropoff"];
export const DONE_STATUSES: JobStatus[] = ["delivered", "completed"];
export const CLOSED_STATUSES: JobStatus[] = ["delivered", "completed", "cancelled", "failed"];
export const UNPAID_STATUSES: JobStatus[] = ["awaiting_payment", "payment_failed", "draft"];

/** Customer cancel rules mirror delivery-client.service.ts cancelDeliveryOrder. */
export const CANCEL_REFUND: Partial<Record<JobStatus, number>> = {
  draft: 100, awaiting_payment: 100, payment_failed: 100, pending: 100, broadcasting: 100, assigned: 90, en_route_pickup: 50,
};
export function canCancel(s: JobStatus): boolean { return CANCEL_REFUND[s] !== undefined; }
export function canRate(s: JobStatus): boolean { return DONE_STATUSES.includes(s); }
export function isLive(s: JobStatus): boolean { return OPEN_STATUSES.includes(s) || ACTIVE_STATUSES.includes(s); }

export function customerLabel(s: JobStatus, w: Words, kind: "ride" | "package" | "food" = "package"): string {
  const p = w.provider;
  if (kind === "ride") {
    switch (s) {
      case "pending":
      case "broadcasting": return `Finding your ${p.toLowerCase()}`;
      case "assigned": return `${p} assigned`;
      case "en_route_pickup": return `${p} on the way`;
      case "arrived_pickup": return `Your ${p.toLowerCase()} is here`;
      case "picked_up":
      case "en_route_dropoff": return "On your way";
      case "arrived_dropoff": return "Arriving now";
      case "delivered":
      case "completed": return "You’ve arrived";
      default: break;
    }
  }
  switch (s) {
    case "draft": return "Draft";
    case "awaiting_payment": return "Waiting for payment";
    case "payment_failed": return "Payment didn’t go through";
    case "pending":
    case "broadcasting": return `Finding your ${p.toLowerCase()}`;
    case "assigned": return `${p} assigned`;
    case "en_route_pickup": return `${p} heading to pickup`;
    case "arrived_pickup": return `${p} at pickup`;
    case "picked_up": return "Picked up";
    case "en_route_dropoff": return "On its way";
    case "arrived_dropoff": return "Arriving now";
    case "delivered":
    case "completed": return "Delivered";
    case "cancelled": return "Cancelled";
    case "failed": return "Couldn’t be completed";
    default: return String(s).replace(/_/g, " ");
  }
}

export function driverLabel(s: JobStatus): string {
  switch (s) {
    case "pending":
    case "broadcasting": return "Open";
    case "assigned": return "Accepted";
    case "en_route_pickup": return "Heading to pickup";
    case "arrived_pickup": return "At pickup";
    case "picked_up": return "Picked up";
    case "en_route_dropoff": return "Heading to drop-off";
    case "arrived_dropoff": return "At drop-off";
    case "delivered": return "Dropped off";
    case "completed": return "Done · paid";
    case "cancelled": return "Cancelled";
    case "failed": return "Not completed";
    default: return String(s).replace(/_/g, " ");
  }
}

/** Pill tone for a status: live / done / off / wait. */
export function tone(s: JobStatus): "live" | "done" | "off" | "wait" {
  if (ACTIVE_STATUSES.includes(s)) return "live";
  if (DONE_STATUSES.includes(s)) return "done";
  if (s === "cancelled" || s === "failed" || s === "payment_failed") return "off";
  return "wait";
}

/* ── the customer's stepper ── */
export interface Step { key: string; label: string; at?: string }

/** Booked → Driver assigned → Picked up → On its way → Delivered, with the time each
 *  step happened (read from the job's own timeline). */
export function customerSteps(job: DeliveryJob, w: Words, kind: "ride" | "package" | "food" = "package"): { steps: Step[]; index: number } {
  const t = job.timeline ?? [];
  const at = (...events: string[]) => t.find((e) => events.includes(e.event))?.timestamp;
  const steps: Step[] = [
    { key: "booked", label: "Booked", at: at("payment_completed") || at("job_created") },
    { key: "assigned", label: `${w.provider} assigned`, at: at("job_assigned", "job_accepted") },
    { key: "picked", label: "Picked up", at: at("status_picked_up") },
    { key: "moving", label: kind === "ride" ? "On the way" : "On its way", at: at("status_en_route_dropoff") },
    { key: "done", label: kind === "ride" ? "Arrived" : "Delivered", at: at("status_delivered", "status_completed") },
  ];
  const s = job.status;
  const index =
    DONE_STATUSES.includes(s) ? 4
    : s === "en_route_dropoff" || s === "arrived_dropoff" ? 3
    : s === "picked_up" ? 2
    : s === "assigned" || s === "en_route_pickup" || s === "arrived_pickup" ? 1
    : 0;
  return { steps, index };
}

/* ── the driver's step flow ── */
export type DriverStep = "start-pickup" | "arrive-pickup" | "complete-pickup" | "start-dropoff" | "arrive-dropoff" | "complete-dropoff" | "complete";

/** What the driver does next from this status, the engine route it calls, and whether
 *  a photo is part of it. */
export function nextDriverStep(s: JobStatus): { step: DriverStep; label: string; photo?: "optional" | "required"; hint: string } | null {
  switch (s) {
    case "assigned": return { step: "start-pickup", label: "Head to pickup", hint: "Lets the customer know you’re on the way." };
    case "en_route_pickup": return { step: "arrive-pickup", label: "I’m at the pickup", hint: "Tap when you’ve pulled up." };
    case "arrived_pickup": return { step: "complete-pickup", label: "Confirm pickup", photo: "optional", hint: "Snap the item as you collect it — it protects you both." };
    case "picked_up": return { step: "start-dropoff", label: "Head to drop-off", hint: "Starts live tracking for the customer." };
    case "en_route_dropoff": return { step: "arrive-dropoff", label: "I’m at the drop-off", hint: "Tap when you’ve arrived." };
    case "arrived_dropoff": return { step: "complete-dropoff", label: "Complete drop-off", photo: "required", hint: "A photo of the item where you left it is your proof of drop-off." };
    case "delivered": return { step: "complete", label: "Finish and get paid", hint: "Closes it out and credits your earnings." };
    default: return null;
  }
}

/** The stop a step acts on: the first pickup / drop-off not yet completed. */
export function stopIndexFor(job: DeliveryJob, type: "pickup" | "dropoff"): number {
  const i = job.stops.findIndex((st) => st.type === type && st.status !== "completed");
  if (i >= 0) return i;
  return Math.max(0, job.stops.findIndex((st) => st.type === type));
}

/* ── addresses ── */
export function stopAddress(st?: JobStop): string {
  if (!st) return "";
  const a = st.location?.address;
  if (st.location?.formattedAddress) return st.location.formattedAddress.replace(/, USA$/, "");
  if (typeof a === "string") return a;
  if (a && typeof a === "object") return [a.street1 || a.street, a.city, a.state, a.zip || a.zipCode].filter(Boolean).join(", ");
  return st.location?.placeName || "";
}
/** "2600 Main St" — the first line, for compact cards. */
export function shortAddress(st?: JobStop): string {
  return stopAddress(st).split(",")[0] || "";
}
export function pickupOf(job: DeliveryJob): JobStop | undefined { return job.stops.find((s) => s.type === "pickup"); }
export function dropoffOf(job: DeliveryJob): JobStop | undefined { return [...job.stops].reverse().find((s) => s.type === "dropoff"); }

/** When the customer asked for it: "now" or the scheduled time on the pickup stop. */
export function whenOf(job: DeliveryJob): string | undefined {
  const tw = pickupOf(job)?.timeWindow;
  return tw?.type === "scheduled" && tw.scheduledAt ? tw.scheduledAt : job.scheduling?.type === "scheduled" ? job.scheduling.scheduledDate : undefined;
}

/** What is being moved, from the first stop's items. */
export function whatOf(job: DeliveryJob): string {
  const it = pickupOf(job)?.items?.[0] ?? job.stops.find((s) => s.items?.length)?.items?.[0];
  return it?.description || "";
}

export function jobRef(job: DeliveryJob): string { return job.jobNumber ? `#${job.jobNumber}` : ""; }

/**
 * One line of the job's activity, in the reader's words. The engine's timeline is
 * written for the office ("Broadcast to 4 agents", "Payment completed via stripe"), so
 * each event is re-worded per side, and office-only events are left out (null).
 */
export function activityText(e: TimelineEvent, side: "customer" | "driver", w: Words): string | null {
  const job = w.job, p = w.provider;
  const ev = String(e.event || "");
  if (ev.startsWith("status_")) {
    const s = ev.slice(7) as JobStatus;
    return side === "driver" ? driverLabel(s) : customerLabel(s, w);
  }
  switch (ev) {
    case "job_created": return `${job} requested`;
    case "payment_completed": return side === "driver" ? null : "Paid";
    case "payment_failed": return side === "driver" ? null : "Payment didn’t go through";
    case "job_accepted":
    case "job_assigned": return side === "driver" ? "You accepted" : `${p} assigned`;
    case "images_added": return "Photo added";
    case "issue_reported": return side === "driver" ? "Problem reported" : "You reported a problem";
    case "issue_resolved": return "Problem resolved";
    case "full_refund":
    case "partial_refund": return side === "driver" ? null : (e.description || "Refunded").replace(/ processed$/, "");
    case "tip_added": return side === "driver" ? "Tip added" : "You added a tip";
    default: return null; // job_broadcast, job_offered, job_alert_sent, job_rejected, pricing_updated, adjustments…
  }
}
