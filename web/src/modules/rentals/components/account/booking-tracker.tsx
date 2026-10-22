import { fmtFull } from "@/lib/dates";
import type { Stage } from "@/modules/rentals/lib/custody";

/** The custody status stepper: Booked → In custody → Collected. Shows where the
 *  booking is right now, with the time each stage happened. */
export function BookingTracker({ stage }: { stage: Stage }) {
  if (stage.cancelled) {
    return <div className="trk trk-cancelled">This booking was cancelled.</div>;
  }
  return (
    <div className="trk">
      {stage.steps.map((s, i) => {
        const state = i < stage.index ? "done" : i === stage.index ? "now" : "todo";
        return (
          <div className={`trk-step ${state}`} key={s.key}>
            <div className="trk-dot">{state === "done" ? "✓" : i + 1}</div>
            <div className="trk-meta">
              <b>{s.label}</b>
              {s.at ? <span>{fmtFull(s.at)}</span> : state === "now" ? <span>Now</span> : null}
            </div>
            {i < stage.steps.length - 1 && <div className={`trk-bar ${i < stage.index ? "on" : ""}`} />}
          </div>
        );
      })}
    </div>
  );
}
