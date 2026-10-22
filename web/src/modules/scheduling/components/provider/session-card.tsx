import { duration, time } from "../../lib/format";
import type { ProviderSlot } from "../../lib/types";

/** One of the provider's taken times: a class with its places taken, or a booked one-to-one. */
export function SessionCard({ s, tz }: { s: ProviderSlot; tz: string }) {
  const group = s.type.kind === "class";
  const mins = Math.round((Date.parse(s.endTime) - Date.parse(s.startTime)) / 60000);
  const past = Date.parse(s.endTime) < Date.now();
  const title = s.shared ? "Booked appointment" : s.type.title;
  return (
    <article className={`pv-s${past ? " past" : ""}`}>
      <div className="pv-s-time"><b>{time(s.startTime, tz)}</b><span>{duration(mins)}</span></div>
      <div className="pv-s-b">
        <div className="pv-s-h">
          <h3>{title}</h3>
          <span className="pv-s-m">{group ? `${s.booked} of ${s.capacity} places taken` : "Booked"}{s.type.room ? ` · ${s.type.room}` : ""}</span>
        </div>
        {group && <span className="pv-fill" aria-hidden><i style={{ width: `${Math.min(100, Math.round((s.booked / Math.max(1, s.capacity)) * 100))}%` }} /></span>}
      </div>
    </article>
  );
}
