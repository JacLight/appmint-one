import Link from "next/link";
import type { JobEnvelope, JobStatus } from "@/modules/logistics/lib/types";
import { customerLabel, driverLabel, tone, shortAddress, pickupOf, dropoffOf, whenOf, whatOf, customerSteps, type Words, type Step } from "@/modules/logistics/lib/status";
import { formatMoney } from "@/lib/utils";

export const money = (n?: number, cur = "USD") => formatMoney(Math.round((n ?? 0) * 100), cur);

export function fmtTime(v?: string): string {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  const today = new Date().toDateString() === d.toDateString();
  return today
    ? d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function StatusPill({ status, words, side = "customer" }: { status: JobStatus; words: Words; side?: "customer" | "driver" }) {
  return <span className={`lg-pill ${tone(status)}`}>{side === "driver" ? driverLabel(status) : customerLabel(status, words)}</span>;
}

/** One row in a list of jobs (customer or driver). */
export function JobRow({ env, href, words, side = "customer", amount, amountNote }: { env: JobEnvelope; href: string; words: Words; side?: "customer" | "driver"; amount?: number; amountNote?: string }) {
  const j = env.data;
  const when = whenOf(j);
  const what = whatOf(j);
  return (
    <Link className="lg-row" href={href}>
      <div className="lg-row-main">
        <div className="lg-row-top">
          <StatusPill status={j.status} words={words} side={side} />
          <span className="lg-row-ref">#{j.jobNumber}{env.createdate ? ` · ${fmtTime(env.createdate)}` : ""}</span>
        </div>
        <div className="lg-row-route">
          <span>{shortAddress(pickupOf(j)) || "Pickup"}</span><i aria-hidden>→</i><span>{shortAddress(dropoffOf(j)) || "Drop-off"}</span>
        </div>
        <div className="lg-row-meta">{[what, when ? `Scheduled ${fmtTime(when)}` : null].filter(Boolean).join(" · ")}</div>
      </div>
      {amount != null && amount > 0 && (
        <div className="lg-row-amt">{money(amount, j.pricing?.currency || j.payment?.currency)}{amountNote ? <small>{amountNote}</small> : null}</div>
      )}
    </Link>
  );
}

export function StepsBar({ steps, index, cancelled }: { steps: Step[]; index: number; cancelled?: boolean }) {
  if (cancelled) return null;
  return (
    <div className="lg-steps">
      {steps.map((s, i) => {
        const state = i < index ? "done" : i === index ? "now" : "todo";
        return (
          <div className={`lg-step ${state}`} key={s.key}>
            <div className="lg-step-dot">{state === "done" ? "✓" : i + 1}</div>
            <div className="lg-step-txt">
              <b>{s.label}</b>
              {s.at ? <span>{fmtTime(s.at)}</span> : state === "now" ? <span>Now</span> : null}
            </div>
            {i < steps.length - 1 && <div className={`lg-step-bar ${i < index ? "on" : ""}`} aria-hidden />}
          </div>
        );
      })}
    </div>
  );
}

export function CustomerSteps({ env, words, kind }: { env: JobEnvelope; words: Words; kind?: "ride" | "package" | "food" }) {
  const { steps, index } = customerSteps(env.data, words, kind);
  return <StepsBar steps={steps} index={index} cancelled={env.data.status === "cancelled" || env.data.status === "failed"} />;
}

/** A map without an API key: the live point when there is one, else the route. */
export function MapEmbed({ point, from, to, tag }: { point?: { lat: number; lng: number } | null; from?: string; to?: string; tag?: React.ReactNode }) {
  let src = "";
  if (point && Number.isFinite(point.lat) && Number.isFinite(point.lng)) src = `https://maps.google.com/maps?q=${point.lat},${point.lng}&z=15&output=embed`;
  else if (from && to) src = `https://maps.google.com/maps?saddr=${encodeURIComponent(from)}&daddr=${encodeURIComponent(to)}&output=embed`;
  else if (to || from) src = `https://maps.google.com/maps?q=${encodeURIComponent(to || from || "")}&z=14&output=embed`;
  if (!src) return null;
  return (
    <div className="lg-map">
      {tag ? <span className="lg-map-tag">{tag}</span> : null}
      <iframe src={src} title="Map" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
    </div>
  );
}

export function initials(name?: string): string {
  return (name || "?").split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

export function directionsUrl(address?: string, point?: { lat?: number; lng?: number }): string | null {
  const dest = point?.lat != null && point?.lng != null ? `${point.lat},${point.lng}` : address;
  return dest ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}` : null;
}
